import { Injectable } from '@nestjs/common';
import { redisClient } from '../../config/redis.config.js';

/** 令牌桶参数 */
export interface TokenBucketOptions {
  /** 桶容量（允许的最大突发量） */
  capacity: number;
  /** 每秒补充的令牌数（恒定速率） */
  refillPerSec: number;
  /** 本次请求消耗的令牌数，默认 1 */
  cost?: number;
}

/** 令牌桶判定结果 */
export interface TokenBucketResult {
  /** 是否放行 */
  allowed: boolean;
  /** 放行后剩余令牌数（向下取整） */
  remaining: number;
  /** 被限流时，建议等待多少毫秒再重试 */
  waitMs: number;
}

/**
 * 令牌桶 Lua 脚本（原子执行，避免并发下的读-改-写竞态）。
 *
 * KEYS[1] = 限流 key
 * ARGV[1] = capacity       桶容量
 * ARGV[2] = refillPerSec   每秒补充速率
 * ARGV[3] = now            当前时间（毫秒）
 * ARGV[4] = cost           本次消耗
 *
 * 返回 { allowed, floor(remaining), waitMs }
 */
const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', KEYS[1], 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

-- 首次访问：桶是满的
if tokens == nil then
  tokens = capacity
end
if lastRefill == nil then
  lastRefill = now
end

-- 按时间差补充令牌，封顶 capacity
local elapsedMs = math.max(0, now - lastRefill)
if refillPerSec > 0 then
  tokens = math.min(capacity, tokens + elapsedMs / 1000 * refillPerSec)
end
lastRefill = now

local allowed = 0
local waitMs = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  if refillPerSec > 0 then
    waitMs = math.ceil((cost - tokens) / refillPerSec * 1000)
  else
    waitMs = -1
  end
end

redis.call('HMSET', KEYS[1], 'tokens', tokens, 'lastRefill', now)
-- 空闲一段时间后 key 自动回收，避免 Redis 无限增长
local ttlMs = math.ceil(capacity / (refillPerSec > 0 and refillPerSec or 1) * 1000) + 60000
redis.call('PEXPIRE', KEYS[1], ttlMs)

return { allowed, math.floor(tokens), waitMs }
`;

/**
 * 基于 Redis 的令牌桶限流器（分布式可用）。
 *
 * 相比固定窗口：
 * - 令牌以恒定速率补充，允许一定突发（桶容量），流量更平滑；
 * - 不存在固定窗口「跨窗口边界双倍放行」的问题；
 * - 状态集中在 Redis，多实例共享同一份计数。
 */
@Injectable()
export class TokenBucketService {
  /** 消耗令牌并返回判定结果 */
  async consume(key: string, options: TokenBucketOptions): Promise<TokenBucketResult> {
    const cost = options.cost ?? 1;

    const raw = (await redisClient.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      options.capacity,
      options.refillPerSec,
      Date.now(),
      cost,
    )) as [number, number, number];

    return {
      allowed: Number(raw[0]) === 1,
      remaining: Number(raw[1]),
      waitMs: Number(raw[2]),
    };
  }
}
