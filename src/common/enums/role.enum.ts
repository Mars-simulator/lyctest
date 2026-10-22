/**
 * RBAC 角色枚举
 * 新增角色只需在此扩展，并在需要处用 @Roles(Role.xxx) 标注
 */
export enum Role {
  /** 管理员：拥有所有权限 */
  Admin = 'admin',
  /** 普通用户：只读权限 */
  User = 'user',
}
