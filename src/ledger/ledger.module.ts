import { Module } from '@nestjs/common';
import { AccountModule } from './account.module.js';
import { TransactionModule } from './transaction.module.js';

/** 账务聚合模块：单体模式下同时暴露账户 + 交易接口（向后兼容 AppModule） */
@Module({
  imports: [AccountModule, TransactionModule],
  exports: [AccountModule, TransactionModule],
})
export class LedgerModule {}
