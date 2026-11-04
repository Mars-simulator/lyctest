import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/redis.config.js', () => ({
  redisClient: { eval: jest.fn() },
}));

const { redisClient } = await import('../../config/redis.config.js');
const { TokenBucketService } = await import('./token-bucket.service.js');

const evalMock = redisClient.eval as unknown as jest.Mock;

describe('TokenBucketService', () => {
  let service: TokenBucketService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenBucketService();
  });

  it('有令牌时放行，返回剩余令牌', async () => {
    evalMock.mockResolvedValue([1, 4, 0]);

    const result = await service.consume('k', { capacity: 5, refillPerSec: 5 / 60 });

    expect(result).toEqual({ allowed: true, remaining: 4, waitMs: 0 });
  });

  it('无令牌时拒绝，并返回建议等待时间', async () => {
    evalMock.mockResolvedValue([0, 0, 12_000]);

    const result = await service.consume('k', { capacity: 5, refillPerSec: 5 / 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, waitMs: 12_000 });
  });

  it('把 capacity / refillPerSec / cost 正确传给 Lua 脚本', async () => {
    evalMock.mockResolvedValue([1, 9, 0]);

    await service.consume('k', { capacity: 10, refillPerSec: 2, cost: 1 });

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'k',
      10,
      2,
      expect.any(Number),
      1,
    );
  });

  it('默认 cost 为 1', async () => {
    evalMock.mockResolvedValue([1, 0, 0]);

    await service.consume('k', { capacity: 1, refillPerSec: 1 });

    // 第 7 个参数（ARGV[4]）即 cost
    expect(evalMock.mock.calls[0][6]).toBe(1);
  });
});
