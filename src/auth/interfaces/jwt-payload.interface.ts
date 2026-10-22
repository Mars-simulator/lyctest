import type { IncomingHttpHeaders } from 'node:http';

/** 写入 JWT 的载荷 */
export interface JwtPayload {
  /** 用户 id（标准声明 sub） */
  sub: number;
  username: string;
  roles: string[];
  /** 令牌唯一 id，用于登出拉黑 */
  jti?: string;
  iat?: number;
  /** 过期时间（秒级时间戳） */
  exp?: number;
}

/** 认证通过后挂载到 request.user 上的用户信息 */
export interface AuthUser {
  userId: number;
  username: string;
  roles: string[];
  jti?: string;
  exp?: number;
}

/** 携带 user 的请求：只声明守卫/装饰器用到的字段，避免耦合 express 类型 */
export interface RequestWithUser {
  headers: IncomingHttpHeaders;
  user?: AuthUser;
}
