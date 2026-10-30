import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

/** 消息结构（与 producer 约定） */
interface TaskMessage {
  messageId: string;
  text?: string;
  at?: string;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  /**
   * 已处理消息去重表（幂等）。
   * 演示用内存 Set；生产应改用 Redis SETNX / 数据库唯一键，跨副本共享并持久化。
   */
  private readonly processedIds = new Set<string>();

  @EventPattern('task')
  async handleTask(@Payload() data: TaskMessage) {
    const { messageId } = data;

    // 幂等：该消息已处理过（Kafka 至少一次投递可能重放），直接跳过
    if (this.processedIds.has(messageId)) {
      this.logger.warn(`[consumer] 重复消息，跳过: ${messageId}`);
      return;
    }

    try {
      await this.process(data);
      this.processedIds.add(messageId);
      this.logger.log(`[consumer] 处理成功: ${messageId}`);
    } catch (err) {
      // Kafka 没有 nack/requeue 概念，失败由 offset 提交策略决定是否重放
      this.logger.error(`[consumer] 处理失败: ${messageId}`, (err as Error).stack);
      throw err;
    }
  }

  private async process(data: TaskMessage): Promise<void> {
    console.log(`[consumer] received message: ${JSON.stringify(data)}`);
    // 约定：text 为 'fail' 时模拟处理失败
    if (data.text === 'fail') {
      throw new Error('模拟业务处理失败');
    }
  }
}
