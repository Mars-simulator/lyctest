import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service.js';
import { Account } from './entities/account.entity.js';

/**
 * 账户领域模块：仅提供 AccountService（无对外控制器），
 * 供账户服务、账务服务按需组合，避免账务服务被连带加载账户 HTTP 接口。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountDomainModule {}
