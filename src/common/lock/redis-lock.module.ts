import { Global, Module } from '@nestjs/common';
import { RedisLockService } from './redis-lock.service.js';

/** 全局分布式锁模块：任何模块都可直接注入 RedisLockService */
@Global()
@Module({
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisLockModule {}
