import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardModule } from '../auth/auth-guard.module.js';
import { AppLoggerModule } from '../common/logger/logger.module.js';
import { createTypeOrmOptions } from '../config/typeorm-options.js';
import { HealthController } from '../health/health.controller.js';
import { Account } from '../ledger/entities/account.entity.js';
import { Transaction } from '../ledger/entities/transaction.entity.js';
import { TransactionModule } from '../ledger/transaction.module.js';
import { sharedGlobalProviders } from './shared.js';

/**
 * 账务服务根模块（APP_ROLE=ledger）。
 * 承载资金操作（存入/取出/转账）与流水查询，
 * 通过 AccountPort（由 ACCOUNT_SERVICE_URL 决定实现）调用账户服务做校验。
 */
@Module({
  imports: [
    TypeOrmModule.forRoot(createTypeOrmOptions([Account, Transaction])),
    AuthGuardModule,
    TransactionModule,
    AppLoggerModule,
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [...sharedGlobalProviders],
})
export class LedgerAppModule {}
