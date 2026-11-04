import { jest } from '@jest/globals';

// ESM 下必须用 unstable_mockModule 阻断 redis.config 顶层的真实 Redis 连接
jest.unstable_mockModule('../../config/redis.config.js', () => ({
  redisClient: {
    set: jest.fn(),
    eval: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

const { redisClient } = await import('../../config/redis.config.js');
const { RedisLockService } = await import('./redis-lock.service.js');

const setMock = redisClient.set as unknown as jest.Mock;
const evalMock = redisClient.eval as unknown as jest.Mock;

describe('RedisLockService', () => {
  let service: RedisLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisLockService();
  });

  describe('acquire', () => {
    it('SET NX PX 成功时返回唯一 token', async () => {
      setMock.mockResolvedValue('OK');

      const token = await service.acquire('lock:test');

      expect(token).toBeTruthy();
      expect(setMock).toHaveBeenCalledWith('lock:test', token, 'PX', 10_000, 'NX');
    });

    it('重试次数用尽仍失败时返回 null', async () => {
      setMock.mockResolvedValue(null);

      const token = await service.acquire('lock:test', { retryTimes: 2, retryDelayMs: 1 });

      expect(token).toBeNull();
      expect(setMock).toHaveBeenCalledTimes(2);
    });

    it('首次失败、重试成功后返回 token', async () => {
      setMock.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');

      const token = await service.acquire('lock:test', { retryTimes: 3, retryDelayMs: 1 });

      expect(token).toBeTruthy();
      expect(setMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('release', () => {
    it('Lua 返回 1 表示删除成功', async () => {
      evalMock.mockResolvedValue(1);

      await expect(service.release('lock:test', 'token-1')).resolves.toBe(true);
      expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, 'lock:test', 'token-1');
    });

    it('Lua 返回 0（token 不匹配，非本人锁）时返回 false', async () => {
      evalMock.mockResolvedValue(0);

      await expect(service.release('lock:test', 'token-x')).resolves.toBe(false);
    });
  });

  describe('withLock', () => {
    it('正常执行临界区并释放锁', async () => {
      setMock.mockResolvedValue('OK');
      evalMock.mockResolvedValue(1);

      const result = await service.withLock('lock:test', async () => 42);

      expect(result).toBe(42);
      expect(evalMock).toHaveBeenCalledTimes(1);
    });

    it('获取锁失败时抛错，且不执行临界区', async () => {
      setMock.mockResolvedValue(null);
      const work = jest.fn(async () => 1);

      await expect(service.withLock('lock:test', work, { retryTimes: 1 })).rejects.toThrow(
        /获取锁失败/,
      );
      expect(work).not.toHaveBeenCalled();
    });

    it('临界区抛异常时仍会释放锁', async () => {
      setMock.mockResolvedValue('OK');
      evalMock.mockResolvedValue(1);

      await expect(
        service.withLock('lock:test', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(evalMock).toHaveBeenCalledTimes(1);
    });
  });
});
