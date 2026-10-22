import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { RequestWithUser } from '../interfaces/jwt-payload.interface.js';

/**
 * RBAC 角色守卫：读取 @Roles() 元数据，与当前用户角色比对
 * 未标注 @Roles() 的路由直接放行（仅要求登录）
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('未认证');
    }

    // 管理员拥有所有权限
    if (user.roles.includes(Role.Admin)) return true;

    const allowed = requiredRoles.some((role) => user.roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException(`无权访问，需要角色: ${requiredRoles.join(' / ')}`);
    }

    return true;
  }
}
