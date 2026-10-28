import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller()
export class AppController {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** 触发一次消息发送：POST /emit  {"text":"hello"} */
  @Post('emit')
  async emit(@Body() body: { text?: string }) {
    const payload = {
      text: body.text ?? 'hello from producer',
      at: new Date().toISOString(),
    };
    // emit 为事件式投递（fire-and-forget），lastValueFrom 等待发送完成
    await lastValueFrom(this.client.emit('task', payload));
    return { sent: payload };
  }
}
