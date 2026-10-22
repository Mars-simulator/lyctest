// main.ts
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { securityHeaders } from './common/security/security-headers.js';

/** 配置了证书路径则启用 HTTPS；生产环境更推荐由 Nginx 等反向代理终止 TLS */
function loadHttpsOptions(): { key: Buffer; cert: Buffer } | undefined {
  const keyPath = process.env.HTTPS_KEY;
  const certPath = process.env.HTTPS_CERT;
  if (!keyPath || !certPath) return undefined;
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

/** CORS 白名单：逗号分隔；未配置时反射请求 Origin（仅便于本地调试，生产必须显式配置） */
function resolveCorsOrigin(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return true;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const httpsOptions = loadHttpsOptions();
  // bufferLogs：启动早期日志先缓存，容器就绪后统一交给 pino 输出，避免丢失或格式分裂
  const app = await NestFactory.create(AppModule, { httpsOptions, bufferLogs: true });

  // 接管 Nest 框架自身日志（InstanceLoader / RouterExplorer / 未捕获异常等），
  // 使框架日志与业务日志共用同一个 pino 出口
  app.useLogger(app.get(PinoNestLogger));

  // 响应 SIGTERM / SIGINT，容器 stop 时触发 onModuleDestroy 优雅关停
  app.enableShutdownHooks();

  // 注意：Nest 的 Logger 实例会绑定「创建时」的全局 logger，
  // 必须在 useLogger 之后再创建，框架日志与这里的日志才会统一走 pino
  const logger = new Logger('Bootstrap');

  const expressApp = app.getHttpAdapter().getInstance() as {
    disable(setting: string): void;
    set(setting: string, value: unknown): void;
  };
  // 隐藏技术栈指纹，减少被针对性扫描
  expressApp.disable('x-powered-by');
  // 反向代理场景下取真实客户端 IP（限流依赖）
  expressApp.set('trust proxy', 1);

  // 安全响应头必须最先执行
  app.use(securityHeaders);

  // 严格的全局参数校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 剥离 DTO 未声明的字段
      forbidNonWhitelisted: true, // 出现多余字段直接 400，防参数污染
      transform: true, // 按 DTO 声明做类型转换（配合 @Type）
      forbidUnknownValues: true, // 拒绝未知对象
      stopAtFirstError: true,
      validationError: { target: false, value: false }, // 不回显原始输入
    }),
  );

  // 凭据只走 Authorization: Bearer，不使用 Cookie，因此天然免疫 CSRF。
  // 若将来改为 Cookie 承载凭据，必须开启 SameSite 并引入 CSRF Token。
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log(`应用已启动: ${httpsOptions ? 'https' : 'http'}://localhost:${port}`);
}

void bootstrap();
