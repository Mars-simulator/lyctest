import { Body, Controller, Get, Inject, OnModuleInit, Post } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { lastValueFrom } from 'rxjs';

@Controller()
export class AppController implements OnModuleInit {
  constructor(@Inject('KAFKA_SERVICE') private readonly client: ClientKafka) {}

  // Kafka 客户端需要显式建立连接
  async onModuleInit() {
    await this.client.connect();
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** 触发一次消息发送：POST /emit {"text":"hello","messageId":"可选"} */
  @Post('emit')
  async emit(@Body() body: { text?: string; messageId?: string }) {
    const payload = {
      // 支持外部指定 messageId，便于验证幂等；不传则自动生成
      messageId: body.messageId ?? randomUUID(),
      text: body.text ?? 'hello from kafka',
      at: new Date().toISOString(),
    };
    // Kafka: emit(topic, message)，topic 为 'task'
    await lastValueFrom(this.client.emit('task', payload));
    return { sent: payload };
  }
}
