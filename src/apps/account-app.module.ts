import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AppLoggerModule } from '../common/logger/logger.module.js';
import { createTypeOrmOptions } from '../config/typeorm-options.js';
import { HealthController } from '../health/health.controller.js';
import { AccountModule } from '../ledger/account.module.js';
import { Account } from '../ledger/entities/account.entity.js';
import { User } from '../user/entities/user.entity.js';
import { sharedGlobalProviders } from './shared.js';

/**
 * 账户服务根模块（APP_ROLE=account）。
 * 承载认证（登录/注册）+ 账户主数据 + 供账务服务调用的内部校验接口。
 * 登录走本服务，账务服务通过 JWT 无状态验签，无需回调认证服务。
 */
@Module({
  imports: [
    TypeOrmModule.forRoot(createTypeOrmOptions([Account, User])),
    AuthModule,
    AccountModule,
    AppLoggerModule,
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [...sharedGlobalProviders],
})
export class AccountAppModule {}
