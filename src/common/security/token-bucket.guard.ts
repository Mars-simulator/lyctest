import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOKEN_BUCKET_KEY } from './token-bucket.decorator.js';
import { TokenBucketService, type TokenBucketOptions } from './token-bucket.service.js';

/** 默认策略：容量 100，每分钟补充 100 个（约 1.67 个/秒） */
const DEFAULT_OPTIONS: TokenBucketOptions = { capacity: 100, refillPerSec: 100 / 60 };

interface RequestLike {
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * 令牌桶限流守卫（Redis 版，多实例共享计数）。
 *
 * 用法：在需要限流的路由上标注 @TokenBucket({...})，并 @UseGuards(TokenBucketGuard)，
 * 或把本守卫注册为局部 Guard。它与全局的内存 RateLimitGuard 相互独立，互不干扰。
 */
@Injectable()
export class TokenBucketGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenBucket: TokenBucketService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<TokenBucketOptions>(TOKEN_BUCKET_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_OPTIONS;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `ratelimit:tb:${route}:${ip}`;

    const result = await this.tokenBucket.consume(key, options);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '请求过于频繁，请稍后再试',
          remaining: result.remaining,
          retryAfter: result.waitMs > 0 ? Math.ceil(result.waitMs / 1000) : undefined,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
