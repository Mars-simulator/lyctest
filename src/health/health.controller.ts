import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PinoLogger } from 'nestjs-pino';
import { Public } from '../common/decorators/public.decorator.js';

/**
 * 健康检查路由
 *
 * - GET /health ：Liveness 存活探针，只确认进程活着
 * - GET /ready  ：Readiness 就绪探针，检查 DB / Redis 等依赖
 *
 * 这两个路径在 logger.config.ts 的 autoLogging.ignore 中已排除，
 * K8s 探活不会产生日志噪音。
 */
@Controller()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Liveness：进程活着即 200，不检查依赖
   * K8s 失败会重启容器
   */
  @Public()
  @Get('health')
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness：检查依赖可用性
   * 不可用返回 503，K8s 会将 Pod 从负载均衡摘除
   *
   * 接入真实 DB / Redis 时，在这里添加 indicator：
   *   return this.healthCheckService.check([
   *     () => this.db.pingCheck('database'),
   *     () => this.redis.pingCheck('redis'),
   *   ]);
   */
  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.healthCheckService.check([
      // 示例：注入真实依赖后取消注释
      // () => this.dbHealthIndicator.pingCheck('database'),
    ]);
  }
}
