# 单元测试用例源码

> 项目：`nest-typeorm-crud`
> 测试框架：Jest 30 + ts-jest（ESM 模式）
> e2e 框架：Jest + Supertest
> 用例总数：46（单测）+ 1（e2e）
> 最后更新：2026-10-14

## 目录

| # | 文件 | 用例数 |
| --- | --- | --- |
| 1 | [`src/auth/utils/password.util.spec.ts`](#1-srcauthutilspasswordutilspects) | 8 |
| 2 | [`src/user/user.service.spec.ts`](#2-srcuseruserservicespects) | 14 |
| 3 | [`src/auth/auth.service.spec.ts`](#3-srcauthauthservicespects) | 10 |
| 4 | [`src/product/product.service.spec.ts`](#4-srcproductproductservicespects) | 13 |
| 5 | [`src/app.controller.spec.ts`](#5-srcappcontrollerspects) | 1 |
| 6 | [`test/app.e2e-spec.ts`](#6-testappe2e-spectssupertest) | 1 |

---

## 1. `src/auth/utils/password.util.spec.ts`

口令哈希工具，无外部依赖，全部使用真实实现（不 mock）。

```ts
import { hashPassword, verifyPassword } from './password.util.js';

describe('password.util', () => {
  describe('hashPassword', () => {
    it('生成 salt:hash 格式的密文', async () => {
      const stored = await hashPassword('Passw0rd');

      // salt 16 字节 hex(32) + ':' + scrypt 64 字节 hex(128)
      expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('相同明文两次哈希结果不同（随机 salt）', async () => {
      const first = await hashPassword('Passw0rd');
      const second = await hashPassword('Passw0rd');

      expect(first).not.toBe(second);
    });

    it('密文中不包含明文', async () => {
      const stored = await hashPassword('Passw0rd');

      expect(stored).not.toContain('Passw0rd');
    });
  });

  describe('verifyPassword', () => {
    it('明文正确时返回 true', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('Passw0rd', stored)).resolves.toBe(true);
    });

    it('明文错误时返回 false', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
    });

    it('大小写敏感', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('passw0rd', stored)).resolves.toBe(false);
    });

    it('密文格式非法时返回 false 而不抛错', async () => {
      await expect(verifyPassword('x', 'not-a-valid-hash')).resolves.toBe(false);
      await expect(verifyPassword('x', '')).resolves.toBe(false);
    });

    it('哈希长度不匹配时返回 false（防越界比较）', async () => {
      const stored = await hashPassword('Passw0rd');
      const [salt] = stored.split(':');

      await expect(verifyPassword('Passw0rd', `${salt}:00ff`)).resolves.toBe(false);
    });
  });
});
```

---

## 2. `src/user/user.service.spec.ts`

Repository 通过 `getRepositoryToken(User)` 注入 mock。

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../common/enums/role.enum.js';
import { User } from './entities/user.entity.js';
import { UserService } from './user.service.js';

/** 模拟 QueryBuilder 链式调用 */
function createQueryBuilderMock() {
  const builder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  return builder;
}

function createRepositoryMock() {
  const builder = createQueryBuilderMock();
  return {
    create: jest.fn((input: Partial<User>) => input),
    save: jest.fn(async (entity: Partial<User>) => ({ id: 1, ...entity })),
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
    builder,
  };
}

describe('UserService', () => {
  let service: UserService;
  let repo: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repo = createRepositoryMock();

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = moduleRef.get(UserService);
  });

  describe('create', () => {
    it('密码哈希后落库，默认分配 user 角色', async () => {
      const result = await service.create({ username: 'tom', password: 'Passw0rd' });

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(payload.password).not.toBe('Passw0rd');
      expect(payload.roles).toEqual([Role.User]);
      expect(result.username).toBe('tom');
    });

    it('返回值中不包含密码', async () => {
      const result = await service.create({ username: 'tom', password: 'Passw0rd' });

      expect(result).not.toHaveProperty('password');
    });

    it('显式传入 roles 时不被覆盖（供内部初始化管理员使用）', async () => {
      await service.create({
        username: 'admin',
        password: 'Passw0rd',
        roles: [Role.Admin, Role.User],
      });

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload.roles).toEqual([Role.Admin, Role.User]);
    });

    it('忽略入参中多余的字段，防止越权写入（mass assignment）', async () => {
      const maliciousInput = { username: 'tom', password: 'Passw0rd', id: 999 };

      await service.create(maliciousInput);

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload).not.toHaveProperty('id');
    });
  });

  describe('findPage', () => {
    it('pageSize 超上限时钳制为 100', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage(1, 99999);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 100,
        order: { createTime: 'DESC' },
      });
      expect(result.pageSize).toBe(100);
    });

    it('非法分页参数回落到默认值', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage(0, Number.NaN);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('正常分页按 (page - 1) * pageSize 计算 skip', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);

      const result = await service.findPage(3, 20);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(3);
    });
  });

  describe('findOne', () => {
    it('用户不存在时抛 NotFoundException', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('用户存在时返回实体', async () => {
      repo.findOneBy.mockResolvedValue({ id: 42, username: 'tom' });

      await expect(service.findOne(42)).resolves.toEqual({ id: 42, username: 'tom' });
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('使用参数绑定查询，不做 SQL 字符串拼接', async () => {
      repo.builder.getOne.mockResolvedValue(null);
      const injection = "tom' OR '1'='1";

      await service.findByUsernameWithPassword(injection);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(repo.builder.where).toHaveBeenCalledWith('user.username = :username', {
        username: injection,
      });
    });
  });

  describe('update', () => {
    it('只更新白名单字段，忽略 roles 等越权字段', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 1,
        username: 'tom',
        nickname: 'old',
        status: 1,
        roles: [Role.User],
      });
      const dtoWithEscalation = { nickname: 'new', roles: [Role.Admin] };

      await service.update(1, dtoWithEscalation);

      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.nickname).toBe('new');
      expect(saved.roles).toEqual([Role.User]);
    });

    it('传入 password 时重新哈希后再保存', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, username: 'tom' });

      await service.update(1, { password: 'NewPassw0rd' });

      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(saved.password).not.toBe('NewPassw0rd');
    });

    it('返回值中不包含密码', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, username: 'tom' });

      const result = await service.update(1, { nickname: 'x' });

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('remove', () => {
    it('先确认用户存在，再执行删除', async () => {
      const user = { id: 1, username: 'tom' };
      repo.findOneBy.mockResolvedValue(user);
      repo.remove.mockResolvedValue(user);

      await service.remove(1);

      expect(repo.remove).toHaveBeenCalledWith(user);
    });
  });
});
```

---

## 3. `src/auth/auth.service.spec.ts`

`UserService`、`JwtService` 注入 mock；`token-store` 用 `jest.mock` 整体替换（避免创建真实 Redis 连接）。

> **ESM 下 `jest.mock()` 不会生效**，必须用 `jest.unstable_mockModule()` 配合动态 `import()`，写法见下方代码。

```ts
import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '../common/enums/role.enum.js';
import { UserService } from '../user/user.service.js';
import { hashPassword } from './utils/password.util.js';

// ESM 下 jest.mock 无法拦截模块加载，必须使用 unstable_mockModule + 动态 import。
// token-store 会创建真实 Redis 连接，测试中整体 mock 掉。
jest.unstable_mockModule('./token-store.js', () => ({
  revokeToken: jest.fn(),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
}));

const { revokeToken } = await import('./token-store.js');
const { ACCESS_TOKEN_TTL_SECONDS, AuthService } = await import('./auth.service.js');

const revokeTokenMock = jest.mocked(revokeToken);

type UserServiceMock = {
  findByUsername: jest.Mock;
  findByUsernameWithPassword: jest.Mock;
  create: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserServiceMock;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    // 清理上一个用例的调用记录（模块级 mock 是跨用例共享的）
    jest.clearAllMocks();
    // 抑制 Nest Logger 在单测中的输出
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    userService = {
      findByUsername: jest.fn(),
      findByUsernameWithPassword: jest.fn(),
      create: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('onModuleInit（初始化默认管理员）', () => {
    it('管理员已存在时不重复创建', async () => {
      userService.findByUsername.mockResolvedValue({ id: 1, username: 'admin' });

      await service.onModuleInit();

      expect(userService.create).not.toHaveBeenCalled();
    });

    it('管理员不存在时创建，并赋予 admin + user 角色', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.create.mockResolvedValue({ id: 1, username: 'admin' });

      await service.onModuleInit();

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          roles: [Role.Admin, Role.User],
        }),
      );
    });
  });

  describe('register', () => {
    it('用户名已存在时抛 ConflictException，且不创建用户', async () => {
      userService.findByUsername.mockResolvedValue({ id: 1, username: 'tom' });

      await expect(
        service.register({ username: 'tom', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('注册成功返回访问令牌，默认角色为 user', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.create.mockResolvedValue({ id: 7, username: 'tom', roles: [Role.User] });

      const result = await service.register({ username: 'tom', password: 'Passw0rd' });

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'tom', roles: [Role.User] }),
      );
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: { id: 7, username: 'tom', roles: [Role.User] },
      });
    });
  });

  describe('login', () => {
    it('用户不存在时抛 UnauthorizedException，且不签发令牌', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ username: 'ghost', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('密码错误时抛 UnauthorizedException', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 1,
        username: 'tom',
        status: 1,
        roles: [Role.User],
        password: await hashPassword('CorrectPassw0rd'),
      });

      await expect(
        service.login({ username: 'tom', password: 'WrongPassw0rd' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('账号被禁用时抛 ForbiddenException', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 1,
        username: 'tom',
        status: 0,
        roles: [Role.User],
        password: await hashPassword('Passw0rd'),
      });

      await expect(
        service.login({ username: 'tom', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('凭据正确时签发令牌，payload 与选项符合预期', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 9,
        username: 'tom',
        status: 1,
        roles: [Role.User],
        password: await hashPassword('Passw0rd'),
      });

      const result = await service.login({ username: 'tom', password: 'Passw0rd' });

      expect(result.accessToken).toBe('signed.jwt.token');
      const [payload, options] = jwtService.signAsync.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload).toEqual({ sub: 9, username: 'tom', roles: [Role.User] });
      expect(options).toEqual(
        expect.objectContaining({
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          jwtid: expect.any(String),
        }),
      );
    });
  });

  describe('logout', () => {
    it('把 jti 与剩余有效期写入黑名单', async () => {
      const now = Math.floor(Date.now() / 1000);

      await service.logout({
        userId: 1,
        username: 'tom',
        roles: [Role.User],
        jti: 'jti-1',
        exp: now + 600,
      });

      expect(revokeTokenMock).toHaveBeenCalledTimes(1);
      const [jti, ttl] = revokeTokenMock.mock.calls[0];
      expect(jti).toBe('jti-1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('缺少 jti 或 exp 时跳过拉黑，仍返回成功', async () => {
      await expect(
        service.logout({ userId: 1, username: 'tom', roles: [Role.User] }),
      ).resolves.toEqual({ success: true });
      expect(revokeTokenMock).not.toHaveBeenCalled();
    });
  });
});
```

---

## 4. `src/product/product.service.spec.ts`

Repository 注入 mock；`../config/redis.config.js` 用 `jest.mock` 整体替换（该模块顶层会 `new Redis()`，必须阻断真实连接）。

```ts
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
```

---

## 5. `src/app.controller.spec.ts`

Nest 脚手架自带用例，保留未改动。

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

---

## 6. `test/app.e2e-spec.ts`（Supertest）

用 Supertest 对真实 HTTP 层发起请求，启动完整 `AppModule`（需要 MySQL 可用）。

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
```

---

## 附：运行方式

```bash
npm run test          # 运行全部单测
npm run test:watch    # 监听模式
npm run test:cov      # 带覆盖率报告
npm run test:e2e      # e2e（Supertest，需要 MySQL）
```

`package.json` 中的脚本形式（ESM 需要 `--experimental-vm-modules`）：

```json
"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
"test:cov": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage",
"test:e2e": "node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest-e2e.config.cjs"
```

配置文件：

- `jest.config.cjs` —— 单元测试
- `jest-e2e.config.cjs` —— e2e

## 附：编写约定

1. **测试文件与源码同目录**，命名 `*.spec.ts`；e2e 放 `test/` 下，命名 `*.e2e-spec.ts`。
2. **相对导入必须带 `.js` 后缀**（项目为 ESM + `nodenext`），由 `moduleNameMapper` 映射回 `.ts`。
3. `describe` / `it` / `expect` 为全局，无需 import（类型来自 `@types/jest`）。
4. 涉及 Redis 的模块必须 mock 掉，否则会发起真实连接。
5. **ESM 下 `jest.mock()` 不生效**，必须用 `jest.unstable_mockModule(path, factory)` 配合动态 `import()`；factory 内直接写 `jest.fn()`，再用 `jest.mocked()` 或 `as unknown as jest.Mock` 取回引用。
6. `beforeEach` 中调用 `jest.clearAllMocks()`（`jest.config.cjs` 也已开启 `clearMocks: true`），避免共享 mock 的调用记录跨用例泄漏。
7. 断言优先校验**行为与安全语义**（参数绑定、白名单、敏感字段不泄露），而非仅校验返回值。

## 相关文档

- [TESTING.md](./TESTING.md) —— 测试与覆盖率说明
- [SUMMARY.md](./SUMMARY.md) —— 阶段小结
- [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md) —— 接口安全自查清单
- [LOGGING.md](./LOGGING.md) —— 统一日志方案
