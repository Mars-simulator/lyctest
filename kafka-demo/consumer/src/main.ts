import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'consumer',
        brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID ?? 'task-consumer',
      },
    },
  });
  await app.listen();
  console.log('Consumer is listening on Kafka topic "task"');
}
void bootstrap();
