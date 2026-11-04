import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { redisClient } from '../../config/redis.config.js';

/** 加锁选项 */
export interface LockOptions {
  /** 锁自动过期时间（毫秒），防止持锁进程崩溃导致死锁，默认 10s */
  ttlMs?: number;
  /** 获取失败重试次数，默认 3 */
  retryTimes?: number;
  /** 重试间隔（毫秒），默认 200 */
  retryDelayMs?: number;
}

/**
 * 释放锁的 Lua 脚本：
 * 仅当 key 的当前值等于本次持有的 token 时才删除，避免「超时后误删他人锁」。
 */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * Redis 分布式锁（SET NX PX + Lua 安全释放）。
 *
 * 三个关键点：
 * 1. 加锁用 `SET key token NX PX ttl` 原子完成，避免「先 SETNX 再 EXPIRE」的非原子问题；
 * 2. 值为唯一 token（UUID），释放时用 Lua 校验，防止误删别人的锁；
 * 3. PX 过期时间兜底，进程崩溃也不会永久死锁。
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  private readonly defaultTtlMs = 10_000;
  private readonly defaultRetryTimes = 3;
  private readonly defaultRetryDelayMs = 200;

  /**
   * 尝试加锁。
   * @returns 成功返回锁 token（释放时需回传），失败返回 null
   */
  async acquire(key: string, options: LockOptions = {}): Promise<string | null> {
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const retryTimes = options.retryTimes ?? this.defaultRetryTimes;
    const retryDelayMs = options.retryDelayMs ?? this.defaultRetryDelayMs;
    const token = randomUUID();

    for (let attempt = 0; attempt < retryTimes; attempt++) {
      const result = await redisClient.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') return token;

      if (attempt < retryTimes - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return null;
  }

  /**
   * 释放锁：Lua 校验 token 后删除，保证只释放自己持有的锁。
   * @returns 是否真正删除
   */
  async release(key: string, token: string): Promise<boolean> {
    const deleted = await redisClient.eval(RELEASE_SCRIPT, 1, key, token);
    return Number(deleted) === 1;
  }

  /**
   * 模板方法：自动加锁 / 释放，业务只需关注临界区。
   * @throws Error 获取锁失败
   */
  async withLock<T>(key: string, work: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const token = await this.acquire(key, options);
    if (!token) {
      throw new Error(`获取锁失败，请稍后重试: ${key}`);
    }

    try {
      return await work();
    } finally {
      try {
        await this.release(key, token);
      } catch (error) {
        // 释放失败不影响业务结果：锁会在 TTL 到期后自动释放
        this.logger.error(`释放锁失败: ${key}`, error as Error);
      }
    }
  }
}
