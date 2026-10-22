import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 首页作为公开的健康检查，无需登录
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
