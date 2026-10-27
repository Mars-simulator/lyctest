import type { Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { RateLimitGuard } from '../common/security/rate-limit.guard.js';

/**
 * 拆分后的各服务共用的全局 Provider（守卫 + 异常过滤器）。
 * 顺序即执行顺序：先限流，再认证，最后 RBAC 鉴权。
 */
export const sharedGlobalProviders: Provider[] = [
  { provide: APP_GUARD, useClass: RateLimitGuard },
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
];
