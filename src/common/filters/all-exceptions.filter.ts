import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Response, Request } from 'express';

/**
 * 全局异常过滤器
 *
 * 职责：
 * - 所有未捕获异常统一走 pino 记录（带 traceId）
 * - 4xx 记 warn，5xx 记 error
 * - 返回统一错误响应格式
 *
 * 注意：pino-http 的 customLogLevel 已经会根据最终 statusCode 自动分级，
 * 这里主要是确保异常发生时有结构化的错误日志（含 stack）。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const err = exception instanceof Error ? exception : new Error(String(exception));

    // 4xx 记 warn，5xx 记 error
    const logData = {
      err,
      method: request.method,
      url: request.url,
      statusCode: status,
      body: request.body,
    };

    if (status >= 500) {
      this.logger.error(logData, `Unhandled exception: ${message}`);
    } else {
      this.logger.warn(logData, `Request failed: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
