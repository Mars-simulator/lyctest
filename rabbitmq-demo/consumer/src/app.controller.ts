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

    // 幂等：该消息已处理过（如 ack 丢失导致重投递），直接确认丢弃，避免重复处理
    if (this.processedIds.has(messageId)) {
      this.logger.warn(`[consumer] 重复消息，跳过: ${messageId}`);
      return; // 正常返回 = NestJS 自动 ack（消费确认，消息从队列移除）
    }

    try {
      await this.process(data);
      // 处理成功后才登记；即使随后的 ack 丢失导致重投递，也会被上面的去重拦下
      this.processedIds.add(messageId);
      this.logger.log(`[consumer] 处理成功: ${messageId}`);
      // 正常返回 = NestJS 自动 ack（消费确认）
    } catch (err) {
      // 抛出异常 = NestJS 自动 nack，消息重新入队等待重试
      this.logger.error(
        `[consumer] 处理失败，消息将重新入队: ${messageId}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  private async process(data: TaskMessage): Promise<void> {
    // 模拟业务处理
    console.log(`[consumer] received message: ${JSON.stringify(data)}`);
    // 约定：text 为 'fail' 时模拟处理失败（演示 nack 重试）
    if (data.text === 'fail') {
      throw new Error('模拟业务处理失败');
    }
  }
}
