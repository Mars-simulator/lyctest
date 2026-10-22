import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RateLimit } from '../common/security/rate-limit.decorator.js';
import { MoneyOperationDto } from './dto/money-operation.dto.js';
import { QueryTransactionDto } from './dto/query-transaction.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { TransactionService } from './transaction.service.js';

@Controller('ledger/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  /** 存入（入金） */
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Post('deposit')
  deposit(@Body() dto: MoneyOperationDto, @CurrentUser() operator: AuthUser) {
    return this.transactionService.deposit(dto, operator);
  }

  /** 取出（出金） */
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Post('withdraw')
  withdraw(@Body() dto: MoneyOperationDto, @CurrentUser() operator: AuthUser) {
    return this.transactionService.withdraw(dto, operator);
  }

  /** 转账 */
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Post('transfer')
  transfer(@Body() dto: TransferDto, @CurrentUser() operator: AuthUser) {
    return this.transactionService.transfer(dto, operator);
  }

  /** 流水分页查询 */
  @Get()
  findPage(@Query() query: QueryTransactionDto, @CurrentUser() operator: AuthUser) {
    return this.transactionService.findPage(query, operator);
  }

  /** 按业务流水号查询单笔流水 */
  @Get(':txnNo')
  findOne(@Param('txnNo') txnNo: string, @CurrentUser() operator: AuthUser) {
    return this.transactionService.findByTxnNo(txnNo, operator);
  }
}
