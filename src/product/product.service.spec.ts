import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './product.entity.js';

// ESM 下 jest.mock 无法拦截模块加载，必须使用 unstable_mockModule + 动态 import。
// redis.config 顶层会 new Redis()，必须阻断真实连接。
jest.unstable_mockModule('../config/redis.config.js', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  bloomFilter: {
    has: jest.fn(),
    add: jest.fn(),
  },
  CACHE_PROD_KEY: 'cache:product:',
  NULL_TTL: 30,
  BASE_TTL: 1800,
  RANDOM_OFFSET: 1,
  tryAcquireLock: jest.fn(),
  releaseLock: jest.fn(),
}));

const { bloomFilter, redisClient, releaseLock, tryAcquireLock } = await import(
  '../config/redis.config.js'
);
const { ProductService } = await import('./product.service.js');

// 被 mock 后的引用；ioredis 的 set/del 是重载签名，统一按 Mock 使用
const redisGetMock = redisClient.get as unknown as jest.Mock;
const redisSetMock = redisClient.set as unknown as jest.Mock;
const redisDelMock = redisClient.del as unknown as jest.Mock;
const bloomHasMock = bloomFilter.has as unknown as jest.Mock;
const bloomAddMock = bloomFilter.add as unknown as jest.Mock;
const tryAcquireLockMock = tryAcquireLock as unknown as jest.Mock;
const releaseLockMock = releaseLock as unknown as jest.Mock;

function createRepositoryMock() {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    create: jest.fn((input: Partial<Product>) => input),
    save: jest.fn(async (entity: Partial<Product>) => ({ id: 100, ...entity })),
  };
}

describe('ProductService', () => {
  let service: ProductService;
  let repo: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // 默认（happy path）行为，个别用例再覆盖
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue('OK');
    redisDelMock.mockResolvedValue(1);
    bloomHasMock.mockReturnValue(true);
    tryAcquireLockMock.mockResolvedValue('lock-uuid');
    releaseLockMock.mockResolvedValue(undefined);

    repo = createRepositoryMock();

    const moduleRef = await Test.createTestingModule({
      providers: [ProductService, { provide: getRepositoryToken(Product), useValue: repo }],
    }).compile();

    service = moduleRef.get(ProductService);
  });

  describe('onModuleInit（布隆过滤器预热）', () => {
    it('把库中已有商品 id 全部加入布隆过滤器', async () => {
      repo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await service.onModuleInit();

      expect(repo.find).toHaveBeenCalledWith({ select: { id: true } });
      expect(bloomAddMock).toHaveBeenCalledWith('1');
      expect(bloomAddMock).toHaveBeenCalledWith('2');
    });
  });

  describe('getProductById', () => {
    it('布隆过滤器判定不存在时直接返回 null，不查缓存与数据库', async () => {
      bloomHasMock.mockReturnValue(false);

      await expect(service.getProductById(1)).resolves.toBeNull();

      expect(redisGetMock).not.toHaveBeenCalled();
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('缓存命中时返回反序列化结果，不查数据库', async () => {
      const cached = { id: 1, name: 'demo', price: 9 };
      redisGetMock.mockResolvedValue(JSON.stringify(cached));

      await expect(service.getProductById(1)).resolves.toEqual(cached);
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('命中空值缓存（NULL）时返回 null，不查数据库', async () => {
      redisGetMock.mockResolvedValue('NULL');

      await expect(service.getProductById(1)).resolves.toBeNull();
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('缓存未命中时加锁回源，写回缓存并释放锁', async () => {
      const product = { id: 1, name: 'demo', price: 9 };
      repo.findOneBy.mockResolvedValue(product);

      await expect(service.getProductById(1)).resolves.toEqual(product);

      expect(tryAcquireLockMock).toHaveBeenCalledWith('lock:product:1', 10000);
      expect(redisSetMock).toHaveBeenCalledWith(
        'cache:product:1',
        JSON.stringify(product),
        'EX',
        expect.any(Number),
      );
      expect(releaseLockMock).toHaveBeenCalledWith('lock:product:1', 'lock-uuid');
    });

    it('数据库不存在时写入空值缓存，防止缓存穿透', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.getProductById(404)).resolves.toBeNull();

      expect(redisSetMock).toHaveBeenCalledWith('cache:product:404', 'NULL', 'EX', 30);
    });

    it('抢不到锁时抛业务异常，且不会误释放他人锁', async () => {
      tryAcquireLockMock.mockResolvedValue(null);

      await expect(service.getProductById(1)).rejects.toThrow('请求繁忙，请稍后重试');

      expect(tryAcquireLockMock).toHaveBeenCalledTimes(3);
      expect(releaseLockMock).not.toHaveBeenCalled();
    });

    it('双重检查命中缓存时直接返回，不再查库', async () => {
      const cached = { id: 1, name: 'demo', price: 9 };
      redisGetMock
        .mockResolvedValueOnce(null) // 第一次未命中
        .mockResolvedValueOnce(JSON.stringify(cached)); // 加锁后双重检查命中

      await expect(service.getProductById(1)).resolves.toEqual(cached);

      expect(repo.findOneBy).not.toHaveBeenCalled();
      expect(releaseLockMock).toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('未提供任何可更新字段时返回 false，不访问数据库', async () => {
      await expect(service.updateProduct({ id: 1 })).resolves.toBe(false);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('只把白名单字段写入数据库', async () => {
      repo.update.mockResolvedValue({ affected: 1 });

      await service.updateProduct({ id: 1, name: 'new' });

      expect(repo.update).toHaveBeenCalledWith(1, { name: 'new' });
    });

    it('影响行数为 0 时返回 false', async () => {
      repo.update.mockResolvedValue({ affected: 0 });

      await expect(service.updateProduct({ id: 1, name: 'x' })).resolves.toBe(false);
    });

    it('更新成功后删除对应缓存', async () => {
      repo.update.mockResolvedValue({ affected: 1 });

      await expect(service.updateProduct({ id: 1, price: 19.9 })).resolves.toBe(true);

      expect(redisDelMock).toHaveBeenCalledWith('cache:product:1');
    });
  });

  describe('addProduct', () => {
    it('只落库白名单字段，并把新 id 加入布隆过滤器', async () => {
      const result = await service.addProduct({ name: 'demo', price: 9 });

      expect(repo.create).toHaveBeenCalledWith({ name: 'demo', price: 9 });
      expect(bloomAddMock).toHaveBeenCalledWith('100');
      expect(result).toBe(100);
    });
  });
});
