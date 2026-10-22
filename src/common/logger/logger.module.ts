import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { createLoggerOptions } from './logger.config.js';

/**
 * 全局日志模块。
 * exports PinoLoggerModule，使同一模块（AppModule）内的控制器
 * 可以直接注入 PinoLogger，自动携带当前请求的 requestId。
 */
@Module({
  imports: [PinoLoggerModule.forRoot(createLoggerOptions())],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
