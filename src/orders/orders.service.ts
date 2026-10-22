import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface Order {
  id: string;
  userId: string;
  amount: number;
  createdAt: string;
}

/** 订单服务（演示用，数据存内存） */
@Injectable()
export class OrdersService {
  private readonly orders = new Map<string, Order>();

  findOne(id: string): Order {
    const order = this.orders.get(id);
    if (!order) {
      // 抛 404 便于演示「按状态码分级」：pino-http 会把它记为 warn
      throw new NotFoundException(`订单 ${id} 不存在`);
    }
    return order;
  }

  create(body: { userId: string; amount: number }): Order {
    const order: Order = {
      id: randomUUID(),
      userId: body.userId,
      amount: body.amount,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);
    return order;
  }
}
