import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RateLimitGuard } from './common/security/rate-limit.guard.js';
import { UserModule } from './user/user.module.js';
import { ProductModule } from './product/product.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { TerminusModule } from '@nestjs/terminus';
import { AppLoggerModule } from './common/logger/logger.module.js';
import { HealthController } from './health/health.controller.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';

// ESM 下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      // 敏感配置优先从环境变量读取（开发默认值仅为方便本地启动）
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USERNAME ?? 'root',
      password: process.env.DB_PASSWORD ?? 'faben123',
      database: process.env.DB_DATABASE ?? 'nest_crud_demo',
      // 替换 entities 路径
      entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
      // 生产默认关闭自动同步（应改用 migration）；
      // 容器 / CI 首次初始化可用 DB_SYNC=true 显式开启
      synchronize:
        process.env.DB_SYNC === 'true' || (!isProduction && process.env.DB_SYNC !== 'false'),
      logging: false,
    }),
    AuthModule,
    UserModule,
    ProductModule,
    // 账务管理（账户 + 流水）
    LedgerModule,
    // 统一日志模块（全局）
    AppLoggerModule,
    // 健康检查
    TerminusModule,
  ],
  controllers: [AppController,HealthController, OrdersController],
  providers: [
    AppService,
    // 限流最先执行：先挡住暴力破解与刷接口，再做认证与鉴权
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // 全局守卫：默认所有接口都需要登录，@Public() 可放行
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局守卫：读取 @Roles() 做 RBAC 校验
    { provide: APP_GUARD, useClass: RolesGuard },
    OrdersService,
    // 全局异常过滤器，所有异常走 pino 记录
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
