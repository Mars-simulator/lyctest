# 统一日志方案（nestjs-pino）

> 项目：`nest-typeorm-crud`（NestJS 12 + TypeORM + MySQL + Redis + ESM）
> 最后更新：2026-10-13

## 1. 目标

一份日志出口，覆盖三类来源，并做到可追踪、可脱敏、可分级、可分环境：

| 来源 | 说明 |
| --- | --- |
| Nest 框架日志 | `InstanceLoader` / `RouterExplorer` / `NestApplication` 等启动与运行日志 |
| HTTP 请求日志 | 每个请求的 method / url / status / 耗时 / 客户端信息 |
| 业务日志 | 在 Controller / Service 中主动打印的结构化日志 |

统一后，任意一条错误都能凭 `reqId` 串起「请求 → 业务处理 → 异常」的完整链路。

## 2. 方案概览

```
                    ┌─────────────────────────────┐
HTTP 请求 ─────────▶ │  pino-http（自动请求日志）    │
                    │  · genReqId 生成/透传 reqId   │
                    │  · autoLogging 健康检查降噪   │
                    │  · customLogLevel 状态码分级  │
                    └──────────────┬──────────────┘
                                   │
Nest 框架日志 ─────┐                ▼
                  ├──▶  pino 单出口  ──▶  stdout
业务 PinoLogger ──┤     · redact 脱敏
异常过滤器 ────────┘     · base 字段
                        · 开发 pino-pretty / 生产 JSON
```

关键点：**所有日志最终都落到同一个 pino 实例**，因此字段结构、脱敏规则、输出格式完全一致。

## 3. 依赖

```bash
npm install nestjs-pino pino-http pino-pretty
```

| 包 | 作用 |
| --- | --- |
| `nestjs-pino` | Nest 集成层，提供 `LoggerModule` / `Logger` / `PinoLogger` |
| `pino-http` | 自动生成 HTTP 请求日志（本方案的类型来源） |
| `pino-pretty` | 开发环境人类可读的彩色输出 |

## 4. 文件结构与职责

| 文件 | 职责 |
| --- | --- |
| `src/common/logger/logger.config.ts` | 日志配置工厂：级别、脱敏、降噪、分级、时间格式、transport |
| `src/common/logger/logger.module.ts` | `AppLoggerModule`，用 `LoggerModule.forRoot()` 装配并导出 |
| `src/main.ts` | `bufferLogs` + `app.useLogger()`，把框架日志接到 pino |
| `src/common/filters/all-exceptions.filter.ts` | 未捕获异常统一走 pino，并返回统一错误响应 |
| `src/orders/*` | 业务日志示例：注入 `PinoLogger` 打印带 reqId 的结构化日志 |
| `src/health/health.controller.ts` | 健康检查接口（日志侧被降噪排除） |

## 5. 核心实现

### 5.1 配置工厂 `logger.config.ts`

```ts
export function createLoggerOptions(): { pinoHttp: Options } {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || (isProd ? 'info' : isTest ? 'silent' : 'debug'),

      // 每条日志都带的基础字段，便于多服务日志检索
      base: {
        service: process.env.SERVICE_NAME || 'nestjs-app',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
      },

      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,

      formatters: { level(label: string) { return { level: label }; } },

      // 敏感字段自动脱敏
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },

      // 健康检查降噪：K8s 探活不产生日志噪音
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const path = req.url?.split('?')[0] ?? '';
          return HEALTH_CHECK_PATHS.has(path) || path.startsWith('/health/');
        },
      },

      // 按最终状态码自动分级
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        if (res.statusCode >= 300 && res.statusCode < 400) return 'silent';
        return 'info';
      },

      customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} - ${err?.message || 'error'}`,

      // requestId：优先沿用客户端 X-Request-Id，否则生成并回写响应头
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers['x-request-id'];
        if (typeof incoming === 'string' && incoming) return incoming;
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },

      transport: !isProd && !isTest
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
  };
}
```

脱敏路径（`REDACT_PATHS`）：

```
password, oldPassword, newPassword,
token, accessToken, refreshToken, authorization,
creditCard, ssn,
req.headers.authorization, req.headers.cookie, req.headers["x-api-key"],
*.password, *.token, user.password, user.idCard
```

### 5.2 全局日志模块 `logger.module.ts`

```ts
@Module({
  imports: [PinoLoggerModule.forRoot(createLoggerOptions())],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
```

`exports` 是关键：`AppModule` 导入它之后，同模块下的 Controller 才能注入 `PinoLogger`。

### 5.3 接管框架日志 `main.ts`

```ts
// bufferLogs：启动早期日志先缓存，容器就绪后统一交给 pino 输出
const app = await NestFactory.create(AppModule, { httpsOptions, bufferLogs: true });

// 接管 Nest 框架自身日志（InstanceLoader / RouterExplorer / 未捕获异常等）
app.useLogger(app.get(PinoNestLogger));

// 注意：Nest 的 Logger 实例会绑定「创建时」的全局 logger，
// 必须在 useLogger 之后再创建
const logger = new Logger('Bootstrap');
```

同时在 `app.module.ts` 的 `imports` 中注册 `AppLoggerModule`。

### 5.4 异常统一出口 `all-exceptions.filter.ts`

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // ...
    const logData = { err, method: request.method, url: request.url, statusCode: status, body: request.body };

    if (status >= 500) this.logger.error(logData, `Unhandled exception: ${message}`);
    else this.logger.warn(logData, `Request failed: ${message}`);

    // 响应只给通用文案，不泄露堆栈
    response.status(status).json({ statusCode: status, message, timestamp: new Date().toISOString(), path: request.url });
  }
}
```

注册方式（`app.module.ts`，**只注册一处**）：

```ts
{ provide: APP_FILTER, useClass: AllExceptionsFilter }
```

> 不要同时在 `main.ts` 里 `app.useGlobalFilters(...)`，否则异常被处理两次，第二次写响应会抛 `ERR_HTTP_HEADERS_SENT`。

### 5.5 业务日志用法

在 Controller / Service 构造函数注入 `PinoLogger`，它会自动携带当前请求的 `reqId`：

```ts
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly logger: PinoLogger,
  ) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.info({ orderId: id }, 'Fetching order');
    return this.ordersService.findOne(id);
  }
}
```

约定：**第一个参数放结构化字段对象，第二个参数放 msg 字符串**，便于日志平台按字段检索。

## 6. 能力清单

| 能力 | 实现位置 | 效果 |
| --- | --- | --- |
| 请求日志 | `pino-http` | 自动记录 method / url / status / responseTime / remoteAddress |
| 链路追踪 | `genReqId` | 沿用或生成 `X-Request-Id`，并回写响应头 |
| 敏感信息脱敏 | `redact` | `password` / `authorization` 等显示为 `[REDACTED]` |
| 状态码分级 | `customLogLevel` | 5xx→error、4xx→warn、3xx→silent、其余→info |
| 探活降噪 | `autoLogging.ignore` | `/health`、`/healthz`、`/ready`、`/livez` 不打请求日志 |
| 多服务检索 | `base` | 每条日志带 `service` / `env` / `version` |
| 异常统一出口 | `AllExceptionsFilter` | 异常走 pino 并保留 `err` 堆栈，响应体不含堆栈 |
| 环境差异化 | `transport` | 开发彩色可读，生产单行 JSON |
| 级别可调 | `LOG_LEVEL` | 运行时覆盖默认级别 |

## 7. 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 决定级别与输出格式（`production` → info + JSON） |
| `LOG_LEVEL` | 见上 | 显式覆盖级别，如 `error` |
| `SERVICE_NAME` | `nestjs-app` | 写入 `base.service` |
| `APP_VERSION` | `1.0.0` | 写入 `base.version` |

## 8. 踩坑记录

1. **`new Logger()` 必须在 `useLogger()` 之后创建**
   Nest 的 `Logger` 实例在构造时绑定当时的全局 logger。写在模块顶层会导致这条日志绕过 pino。

2. **不要重复注册异常过滤器**
   `main.ts` 的 `useGlobalFilters` 与 `app.module.ts` 的 `APP_FILTER` 同时存在时，异常被处理两次 → `ERR_HTTP_HEADERS_SENT`。

3. **pino-http 回调参数是 Node 原生类型**
   `autoLogging.ignore` / `genReqId` 的 `req` 是 `IncomingMessage`，不是 express 的 `Request`；`res` 是 `ServerResponse`。用 express 类型会编译报错。

4. **ESM + `nodenext` 下相对导入必须带 `.js`**
   例如 `import { OrdersService } from './orders.service.js';`，漏写会报 `TS2307 Cannot find module`。

5. **静态路由要声明在参数路由之前**
   `@Get('boom')` 若写在 `@Get(':id')` 之后，会被 `:id` 匹配走，永远不触发。同理适用于 `/user/page`。

## 9. 验证方法

启动（生产模式看 JSON，开发模式看彩色）：

```powershell
npm run build
$env:NODE_ENV='production'; $env:JWT_SECRET='demo-secret'; node dist/main.js
```

### 9.1 框架日志已并入 pino

预期输出（不再出现 `[Nest] 12345 - ... LOG [RouterExplorer]` 这种格式）：

```json
{"level":"info","service":"nestjs-app","env":"production","version":"1.0.0","context":"RouterExplorer","msg":"Mapped {/user, GET} route"}
{"level":"info",...,"context":"NestApplication","msg":"Nest application successfully started"}
{"level":"info",...,"context":"Bootstrap","msg":"应用已启动: http://localhost:3000"}
```

### 9.2 请求日志与 reqId 透传

```powershell
curl.exe -H "X-Request-Id: trace-abc-123" http://localhost:3000/
```

```json
{"level":"info",...,"req":{"id":"trace-abc-123","method":"GET","url":"/","headers":{"x-request-id":"trace-abc-123"}},"res":{"statusCode":200},"responseTime":5,"msg":"GET / 200"}
```

不带请求头时，响应头会出现新生成的 `X-Request-Id`，且与日志 `req.id` 一致。

### 9.3 健康检查降噪

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/ready
```

预期：**不产生请求日志**（同批次请求 `/` 仍然有日志）。

### 9.4 脱敏

```powershell
$t = (Invoke-RestMethod http://localhost:3000/auth/login -Method Post -ContentType 'application/json' `
      -Body '{"username":"admin","password":"admin123"}').accessToken

Invoke-RestMethod http://localhost:3000/orders -Method Post -ContentType 'application/json' `
  -Headers @{Authorization="Bearer $t"} -Body (@{userId='u1';amount=10;password='secret123'} | ConvertTo-Json)
```

预期日志中 `password` 与 `req.headers.authorization` 均为 `"[REDACTED]"`。

### 9.5 分级与链路串联

| 操作 | 预期 |
| --- | --- |
| `GET /orders/<不存在的id>` | `"level":"warn"`，msg 含 `404` |
| `GET /orders/boom` | `"level":"error"`，含 `err` 堆栈；响应体仅 `Internal server error` |
| 任意成功请求 | `"level":"info"` |
| 上述任一订单请求 | 业务日志 `Fetching order` 与请求日志的 `reqId` **相同** |

## 10. 生产建议

- 保持 `NODE_ENV=production`，输出单行 JSON，交给采集端（Loki / ELK / 云日志）解析，不要用 `pino-pretty`。
- `pino-pretty` 只用于本地开发（当前已在 `transport` 中按环境隔离）。
- 多实例部署时，`reqId` 建议由网关统一注入 `X-Request-Id`，便于跨服务串联。
- 日志中禁止出现明文凭据；新增字段若可能含敏感信息，记得同步加入 `REDACT_PATHS`。
- 上报到日志平台前确认脱敏已生效，避免凭据进入第三方存储。
