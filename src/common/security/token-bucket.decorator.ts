import { SetMetadata } from '@nestjs/common';
import type { TokenBucketOptions } from './token-bucket.service.js';

/** 令牌桶元数据 key，由 TokenBucketGuard 读取 */
export const TOKEN_BUCKET_KEY = 'tokenBucket';

/**
 * 声明接口的令牌桶限流策略（与 @RateLimit 的内存固定窗口相互独立）。
 * @example @TokenBucket({ capacity: 5, refillPerSec: 5 / 60 }) // 每分钟 5 个，允许突发
 */
export const TokenBucket = (options: TokenBucketOptions) =>
  SetMetadata(TOKEN_BUCKET_KEY, options);
