import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser, RequestWithUser } from '../../auth/interfaces/jwt-payload.interface.js';

/**
 * 从请求中取出 JwtAuthGuard 注入的当前用户
 * @example profile(@CurrentUser() user: AuthUser) {}
 * @example profile(@CurrentUser('userId') userId: number) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
