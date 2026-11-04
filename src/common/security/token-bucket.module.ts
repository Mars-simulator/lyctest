import { Module } from '@nestjs/common';
import { TokenBucketGuard } from './token-bucket.guard.js';
import { TokenBucketService } from './token-bucket.service.js';

/** 令牌桶限流模块：提供 Redis 版令牌桶服务与守卫 */
@Module({
  providers: [TokenBucketService, TokenBucketGuard],
  exports: [TokenBucketService, TokenBucketGuard],
})
export class TokenBucketModule {}
