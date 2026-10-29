import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
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

  /** 触发一次消息发送：POST /emit  {"text":"hello","messageId":"可选"} */
  @Post('emit')
  async emit(@Body() body: { text?: string; messageId?: string }) {
    const payload = {
      // 支持外部指定 messageId，便于验证幂等；不传则自动生成
      messageId: body.messageId ?? randomUUID(),
      text: body.text ?? 'hello from producer',
      at: new Date().toISOString(),
    };
    // emit 为事件式投递（fire-and-forget），lastValueFrom 等待发送完成
    await lastValueFrom(this.client.emit('task', payload));
    return { sent: payload };
  }
}
