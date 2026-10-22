import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '../common/enums/role.enum.js';
import { UserService } from '../user/user.service.js';
import { hashPassword } from './utils/password.util.js';

// ESM 下 jest.mock 无法拦截模块加载，必须使用 unstable_mockModule + 动态 import。
// token-store 会创建真实 Redis 连接，测试中整体 mock 掉。
jest.unstable_mockModule('./token-store.js', () => ({
  revokeToken: jest.fn(),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
}));

const { revokeToken } = await import('./token-store.js');
const { ACCESS_TOKEN_TTL_SECONDS, AuthService } = await import('./auth.service.js');

const revokeTokenMock = jest.mocked(revokeToken);

type UserServiceMock = {
  findByUsername: jest.Mock;
  findByUsernameWithPassword: jest.Mock;
  create: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserServiceMock;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    // 清理上一个用例的调用记录（模块级 mock 是跨用例共享的）
    jest.clearAllMocks();
    // 抑制 Nest Logger 在单测中的输出
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    userService = {
      findByUsername: jest.fn(),
      findByUsernameWithPassword: jest.fn(),
      create: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('onModuleInit（初始化默认管理员）', () => {
    it('管理员已存在时不重复创建', async () => {
      userService.findByUsername.mockResolvedValue({ id: 1, username: 'admin' });

      await service.onModuleInit();

      expect(userService.create).not.toHaveBeenCalled();
    });

    it('管理员不存在时创建，并赋予 admin + user 角色', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.create.mockResolvedValue({ id: 1, username: 'admin' });

      await service.onModuleInit();

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          roles: [Role.Admin, Role.User],
        }),
      );
    });
  });

  describe('register', () => {
    it('用户名已存在时抛 ConflictException，且不创建用户', async () => {
      userService.findByUsername.mockResolvedValue({ id: 1, username: 'tom' });

      await expect(
        service.register({ username: 'tom', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('注册成功返回访问令牌，默认角色为 user', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.create.mockResolvedValue({ id: 7, username: 'tom', roles: [Role.User] });

      const result = await service.register({ username: 'tom', password: 'Passw0rd' });

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'tom', roles: [Role.User] }),
      );
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: { id: 7, username: 'tom', roles: [Role.User] },
      });
    });
  });

  describe('login', () => {
    it('用户不存在时抛 UnauthorizedException，且不签发令牌', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ username: 'ghost', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('密码错误时抛 UnauthorizedException', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 1,
        username: 'tom',
        status: 1,
        roles: [Role.User],
        password: await hashPassword('CorrectPassw0rd'),
      });

      await expect(
        service.login({ username: 'tom', password: 'WrongPassw0rd' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('账号被禁用时抛 ForbiddenException', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 1,
        username: 'tom',
        status: 0,
        roles: [Role.User],
        password: await hashPassword('Passw0rd'),
      });

      await expect(
        service.login({ username: 'tom', password: 'Passw0rd' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('凭据正确时签发令牌，payload 与选项符合预期', async () => {
      userService.findByUsernameWithPassword.mockResolvedValue({
        id: 9,
        username: 'tom',
        status: 1,
        roles: [Role.User],
        password: await hashPassword('Passw0rd'),
      });

      const result = await service.login({ username: 'tom', password: 'Passw0rd' });

      expect(result.accessToken).toBe('signed.jwt.token');
      const [payload, options] = jwtService.signAsync.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload).toEqual({ sub: 9, username: 'tom', roles: [Role.User] });
      expect(options).toEqual(
        expect.objectContaining({
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          jwtid: expect.any(String),
        }),
      );
    });
  });

  describe('logout', () => {
    it('把 jti 与剩余有效期写入黑名单', async () => {
      const now = Math.floor(Date.now() / 1000);

      await service.logout({
        userId: 1,
        username: 'tom',
        roles: [Role.User],
        jti: 'jti-1',
        exp: now + 600,
      });

      expect(revokeTokenMock).toHaveBeenCalledTimes(1);
      const [jti, ttl] = revokeTokenMock.mock.calls[0];
      expect(jti).toBe('jti-1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('缺少 jti 或 exp 时跳过拉黑，仍返回成功', async () => {
      await expect(
        service.logout({ userId: 1, username: 'tom', roles: [Role.User] }),
      ).resolves.toEqual({ success: true });
      expect(revokeTokenMock).not.toHaveBeenCalled();
    });
  });
});
