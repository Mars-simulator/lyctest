import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';

/** 角色元数据 key，由 RolesGuard 读取 */
export const ROLES_KEY = 'roles';

/**
 * 声明访问该路由所需的角色（满足任意一个即可）
 * @example @Roles(Role.Admin)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
