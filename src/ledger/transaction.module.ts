import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountDomainModule } from './account-domain.module.js';
import { AccountPort } from './account-port.js';
import { AccountService } from './account.service.js';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { LocalAccountPort } from './local-account-port.js';
import { RemoteAccountClient } from './remote-account-client.js';
import { TransactionController } from './transaction.controller.js';
import { TransactionService } from './transaction.service.js';

/**
 * 资金交易模块。
 *
 * AccountPort 的实现由环境变量 ACCOUNT_SERVICE_URL 决定：
 * - 未设置：LocalAccountPort 进程内调用 AccountService（单体模式）
 * - 已设置：RemoteAccountClient 通过 HTTP 调用账户服务（微服务拆分模式）
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction]), AccountDomainModule],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    {
      provide: AccountPort,
      inject: [AccountService],
      useFactory: (accountService: AccountService): AccountPort => {
        const url = process.env.ACCOUNT_SERVICE_URL;
        return url ? new RemoteAccountClient(url) : new LocalAccountPort(accountService);
      },
    },
  ],
  exports: [TransactionService],
})
export class TransactionModule {}
