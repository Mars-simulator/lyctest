import { Redis } from 'ioredis';
import { BloomFilter } from 'bloom-filters';

// 连接失败的告警只打印一次，避免 ioredis 重连时刷屏
let redisErrorLogged = false;

// 连接参数走环境变量，便于容器化部署（compose 中指向 redis 服务名）
const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const REDIS_DB = Number(process.env.REDIS_DB ?? 0);

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  // 空字符串会被 ioredis 当作“需要认证但密码为空”，这里转为 undefined
  password: REDIS_PASSWORD || undefined,
  db: REDIS_DB,
  // 连接不可用时不排队重试过多次，让命令尽快失败（调用方做降级）
  maxRetriesPerRequest: 2,
  // 重连退避：最长 5s 一次；Redis 后续启动后可自动恢复连接
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

// ioredis 在没有 error 监听器时会打印 "Unhandled error event"，这里显式接管
redisClient.on('error', (err: Error) => {
  if (redisErrorLogged) return;
  redisErrorLogged = true;
  console.warn(
    `[redis] 无法连接 ${REDIS_HOST}:${REDIS_PORT}（${err.message}）。请先启动 Redis；缓存/登出黑名单功能会降级，不影响接口可用`,
  );
});

redisClient.on('ready', () => {
  redisErrorLogged = false;
  console.log('[redis] 连接成功');
});

/**
 * 获取锁
 * @param lockKey 锁key
 * @param ttl 毫秒
 * @returns {Promise<string|null>} 成功返回锁标识uuid，失败null
 */
export async function tryAcquireLock(lockKey: string, ttl: number): Promise<string | null> {
  const uuid = Date.now().toString() + Math.random().toString(36);
  const result = await redisClient.set(lockKey, uuid, 'EX', Math.ceil(ttl / 1000), 'NX');
  return result === 'OK' ? uuid : null;
}

/**
 * 释放锁：lua脚本，保证只有持有锁的线程才能删除锁，防止误删
 */
export async function releaseLock(lockKey: string, lockValue: string) {
  const lua = `
    if redis.call('GET',KEYS[1]) == ARGV[1] then
      return redis.call('DEL',KEYS[1])
    else
      return 0
    end
  `;
  await redisClient.eval(lua, 1, lockKey, lockValue);
}

// 内存布隆过滤器：预估100万容量，误判率0.01
export const bloomFilter = BloomFilter.create(1000000, 0.01);

// 缓存常量
export const CACHE_PROD_KEY = 'cache:product:';
export const NULL_TTL = 30;
export const BASE_TTL = 30 * 60;
export const RANDOM_OFFSET = 600;
