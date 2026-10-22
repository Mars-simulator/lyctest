import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { RateLimit } from '../common/security/rate-limit.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthUser } from './interfaces/jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 注册（公开，限流收紧） */
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** 登录（公开，限流收紧以防暴力破解） */
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** 登出：拉黑当前令牌 */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user);
  }

  /** 当前登录用户信息 */
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
