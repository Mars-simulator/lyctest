import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Role } from '../common/enums/role.enum.js';
import { UserService } from '../user/user.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthUser, JwtPayload } from './interfaces/jwt-payload.interface.js';
import { revokeToken } from './token-store.js';
import { verifyPassword } from './utils/password.util.js';

/** 访问令牌有效期（秒） */
export const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;

const DEV_JWT_SECRET = 'nest-jwt-rbac-demo-secret';

// 快速失败：生产环境绝不允许使用开发默认密钥
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('生产环境必须通过环境变量 JWT_SECRET 配置 JWT 密钥');
}

export const JWT_SECRET = process.env.JWT_SECRET ?? DEV_JWT_SECRET;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  /** 首次启动时初始化一个管理员账号，方便开箱体验 */
  async onModuleInit(): Promise<void> {
    const admin = await this.userService.findByUsername('admin');
    if (admin) return;

    await this.userService.create({
      username: 'admin',
      password: 'admin123',
      nickname: '超级管理员',
      roles: [Role.Admin, Role.User],
    });
    this.logger.log('已初始化默认管理员账号：admin / admin123');
  }

  /** 注册：默认分配 user 角色，成功后直接返回令牌 */
  async register(dto: RegisterDto) {
    const exists = await this.userService.findByUsername(dto.username);
    if (exists) {
      throw new ConflictException(`用户名 ${dto.username} 已存在`);
    }

    const user = await this.userService.create({
      username: dto.username,
      password: dto.password,
      nickname: dto.nickname,
      roles: [Role.User],
    });

    return this.issueToken(user.id, user.username, user.roles);
  }

  /** 登录：校验密码与状态 */
  async login(dto: LoginDto) {
    const user = await this.userService.findByUsernameWithPassword(dto.username);
    if (!user || !(await verifyPassword(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== 1) {
      throw new ForbiddenException('账号已被禁用');
    }

    return this.issueToken(user.id, user.username, user.roles);
  }

  /** 登出：把当前令牌 jti 拉黑，剩余有效期内不可再用 */
  async logout(user: AuthUser) {
    if (user.jti && user.exp) {
      const ttl = user.exp - Math.floor(Date.now() / 1000);
      await revokeToken(user.jti, ttl);
    }
    return { success: true };
  }

  private async issueToken(userId: number, username: string, roles: string[]) {
    const payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'> = {
      sub: userId,
      username,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      jwtid: randomUUID(),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: userId, username, roles },
    };
  }
}
