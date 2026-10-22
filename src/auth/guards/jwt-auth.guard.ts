import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import type { AuthUser, JwtPayload, RequestWithUser } from '../interfaces/jwt-payload.interface.js';
import { isTokenRevoked } from '../token-store.js';

/**
 * JWT 认证守卫：解析 Authorization: Bearer <token>，校验签名/有效期/黑名单
 * 通过后将用户信息挂到 request.user
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('缺少访问令牌，请先登录');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }

    if (payload.jti && (await isTokenRevoked(payload.jti))) {
      throw new UnauthorizedException('访问令牌已失效，请重新登录');
    }

    request.user = {
      userId: Number(payload.sub),
      username: payload.username,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      jti: payload.jti,
      exp: payload.exp,
    } satisfies AuthUser;

    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    const header = request.headers.authorization;
    if (!header) return null;

    const [type, value] = header.split(' ');
    return type?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
