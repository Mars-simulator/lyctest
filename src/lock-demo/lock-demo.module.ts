import { Module } from '@nestjs/common';
import { RedisLockModule } from '../common/lock/redis-lock.module.js';
import { TokenBucketModule } from '../common/security/token-bucket.module.js';
import { LockDemoController } from './lock-demo.controller.js';

/** 分布式锁 + 令牌桶练习模块 */
@Module({
  imports: [RedisLockModule, TokenBucketModule],
  controllers: [LockDemoController],
})
export class LockDemoModule {}
