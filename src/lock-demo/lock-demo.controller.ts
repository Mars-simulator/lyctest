import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { RedisLockService } from '../common/lock/redis-lock.service.js';
import { RateLimit } from '../common/security/rate-limit.decorator.js';
import { TokenBucket } from '../common/security/token-bucket.decorator.js';
import { TokenBucketGuard } from '../common/security/token-bucket.guard.js';

/**
 * 分布式锁 + 令牌桶限流 练习接口（「下单扣款」场景）。
 *
 * - 分布式锁：并发扣减同一账户时串行化，避免读-改-写竞态导致超扣/负余额。
 * - 令牌桶：按 IP + 路由限流，capacity=5、每分钟补 5 个（允许突发、平滑限速）。
 *
 * 演示接口统一 @Public() 免登录，方便直接压测。
 */
@Controller('demo')
@Public()
@UseGuards(TokenBucketGuard)
export class LockDemoController {
  /** 内存模拟账户余额（单位：分），仅用于演示锁效果 */
  private readonly balances = new Map<number, number>([[1, 10_000]]);

  constructor(private readonly lock: RedisLockService) {}

  /** 并发扣款：分布式锁保证串行执行 */
  @TokenBucket({ capacity: 5, refillPerSec: 5 / 60 })
  @RateLimit({ limit: 1000, windowMs: 60_000 }) // 放宽内存限流，让令牌桶成为主限制
  @Post('accounts/:id/deduct')
  async deduct(@Param('id', ParseIntPipe) id: number, @Body() body: { amount: number }) {
    return this.lock.withLock(
      `lock:account:${id}`,
      async () => {
        const balance = this.balances.get(id) ?? 0;
        // 模拟一次数据库往返，放大并发竞态窗口（无锁时更容易扣成负数）
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (balance < body.amount) {
          throw new BadRequestException(`余额不足：当前 ${balance}，需要 ${body.amount}`);
        }

        const next = balance - body.amount;
        this.balances.set(id, next);
        return { accountId: id, deducted: body.amount, balance: next };
      },
      { ttlMs: 5_000 },
    );
  }

  /** 查询余额（用于核对扣款结果） */
  @Get('accounts/:id')
  balance(@Param('id', ParseIntPipe) id: number) {
    return { accountId: id, balance: this.balances.get(id) ?? 0 };
  }
}
