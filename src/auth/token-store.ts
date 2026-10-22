import { redisClient } from '../config/redis.config.js';

const BLACKLIST_PREFIX = 'auth:blacklist:';

/**
 * 将已登出的令牌 jti 写入 Redis 黑名单
 * @param jti 令牌唯一 id
 * @param ttlSeconds 剩余有效期（秒），过期后自动清理
 */
export async function revokeToken(jti: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  try {
    await redisClient.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  } catch (error) {
    // Redis 不可用时降级：令牌仍会在自身过期时间失效
    console.warn('[auth] 令牌拉黑失败，Redis 可能未启动:', error);
  }
}

/**
 * 判断令牌是否已被拉黑
 * Redis 异常时降级放行（令牌本身已通过签名与过期校验），避免缓存故障导致全部 401
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  try {
    const cached = await redisClient.get(`${BLACKLIST_PREFIX}${jti}`);
    return cached !== null;
  } catch (error) {
    console.warn('[auth] Redis 黑名单校验失败，已降级跳过:', error);
    return false;
  }
}
