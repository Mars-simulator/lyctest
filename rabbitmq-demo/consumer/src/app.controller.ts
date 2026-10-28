import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  @EventPattern('task')
  handleTask(@Payload() data: { text?: string; at?: string }) {
    console.log(`[consumer] received message: ${JSON.stringify(data)}`);
  }
}
