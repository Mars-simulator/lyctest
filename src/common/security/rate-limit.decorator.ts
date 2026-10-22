import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** 窗口内允许的最大请求数 */
  limit: number;
  /** 窗口大小（毫秒） */
  windowMs: number;
}

/**
 * 覆盖默认限流策略，例如登录接口收紧到 5 次/分钟，抵御暴力破解
 * @example @RateLimit({ limit: 5, windowMs: 60_000 })
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
