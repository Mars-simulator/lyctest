import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { TransactionController } from './transaction.controller.js';
import { TransactionService } from './transaction.service.js';

/** 账务管理模块：账户 + 资金流水 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction])],
  controllers: [AccountController, TransactionController],
  providers: [AccountService, TransactionService],
  exports: [AccountService, TransactionService],
})
export class LedgerModule {}
