import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';

/** 默认策略：单 IP 单接口 60 秒内最多 100 次 */
const DEFAULT_OPTIONS: RateLimitOptions = { limit: 100, windowMs: 60_000 };
/** 超过该数量时触发一次过期清理，避免 Map 无限增长 */
const MAX_TRACKED_KEYS = 10_000;

interface Counter {
  count: number;
  resetAt: number;
}

interface RequestLike {
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * 轻量内存限流（固定窗口算法），用于防暴力破解与接口刷取。
 * 单实例内存实现；多实例部署时应替换为 Redis 计数器（可复用项目中的 redisClient）。
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_OPTIONS;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `${ip}:${route}`;

    const now = Date.now();
    this.cleanupExpired(now);

    const counter = this.counters.get(key);
    if (!counter || counter.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    counter.count += 1;
    if (counter.count > options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((counter.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanupExpired(now: number): void {
    if (this.counters.size < MAX_TRACKED_KEYS) return;
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
