import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    // nestjs-pino 注入的 logger，自动带当前请求的 requestId
    private readonly logger: PinoLogger,
  ) {}

  // 静态路径必须声明在 :id 之前，否则 /orders/boom 会先被 :id 匹配走
  @Get('boom')
  boom() {
    this.logger.error('Triggering simulated error');
    throw new Error('Database connection pool exhausted');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.info({ orderId: id }, 'Fetching order');
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    // password 会被 redact 自动脱敏为 [REDACTED]
    this.logger.info({ userId: dto.userId, amount: dto.amount }, 'Creating order');

    // DTO 已保证 amount > 0，这里是服务层防御
    if (!dto.amount || dto.amount <= 0) {
      this.logger.warn({ userId: dto.userId, amount: dto.amount }, 'Invalid amount');
      throw new Error('Invalid amount');
    }

    return this.ordersService.create({ userId: dto.userId, amount: dto.amount });
  }
}
