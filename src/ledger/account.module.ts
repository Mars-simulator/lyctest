import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountDomainModule } from './account-domain.module.js';
import { InternalAccountController } from './internal-account.controller.js';

/** 账户服务：对外账户接口 + 供账务服务调用的内部校验接口 */
@Module({
  imports: [AccountDomainModule],
  controllers: [AccountController, InternalAccountController],
})
export class AccountModule {}
