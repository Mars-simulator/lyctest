import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';

/**
 * Pino 日志配置工厂
 *
 * 核心配置项：
 * - level: 生产 info / 开发 debug
 * - redact: 敏感字段自动脱敏
 * - autoLogging.ignore: 健康检查路径降噪
 * - customLogLevel: 按 HTTP 状态码自动分级
 * - base: 注入 service / env / version
 */

const REDACT_PATHS = [
  'password',
  'oldPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'creditCard',
  'ssn',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  '*.password',
  '*.token',
  'user.password',
  'user.idCard',
];

// 健康检查路径 —— 不打请求日志
const HEALTH_CHECK_PATHS = new Set(['/health', '/healthz', '/ready', '/livez']);

export function createLoggerOptions(): { pinoHttp: Options } {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    pinoHttp: {
      // ── 日志级别 ──
      level: process.env.LOG_LEVEL || (isProd ? 'info' : isTest ? 'silent' : 'debug'),

      // ── 基础配置 ──
      base: {
        service: process.env.SERVICE_NAME || 'nestjs-app',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
      },

      // ── ISO 时间格式 ──
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,

      // ── level 输出字符串而非数字 ──
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },

      // ── 敏感字段脱敏 ──
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },

      // ── 健康检查降噪 ──
      // 注意：pino-http 的回调参数是 Node 原生 IncomingMessage，而非 express 的 Request
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const path = req.url?.split('?')[0] ?? '';
          return HEALTH_CHECK_PATHS.has(path) || path.startsWith('/health/');
        },
      },

      // ── 按状态码自动分级 ──
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        if (res.statusCode >= 300 && res.statusCode < 400) return 'silent';
        return 'info';
      },

      // ── 自定义消息 ──
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },

      customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err?.message || 'error'}`;
      },

      // ── 自定义请求 ID：优先 X-Request-Id ──
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers['x-request-id'];
        if (typeof incoming === 'string' && incoming) return incoming;
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },

      // ── 开发环境美化 ──
      transport:
        !isProd && !isTest
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname,service,env,version,req,res',
              },
            }
          : undefined,
    },
  };
}
