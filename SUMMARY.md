# 阶段小结

> 项目：`nest-typeorm-crud`
> 技术栈：NestJS 12 + TypeORM + MySQL + Redis + nestjs-pino
> 最后更新：2026-10-13

## 1. 技术栈

| 分类 | 选型 | 说明 |
| --- | --- | --- |
| 运行时 / 模块 | Node.js 24、ESM（`"type": "module"`） | 相对导入需带 `.js` 后缀 |
| 框架 | NestJS 12 | 全局守卫 / 管道 / 过滤器 |
| 编译 | TypeScript 6 + `nest build` | `module`/`moduleResolution` 均为 `nodenext` |
| 数据库 | MySQL + TypeORM 1.x | `synchronize` 仅开发环境开启 |
| 缓存 | Redis（ioredis 5） | 商品缓存、分布式锁、登出黑名单 |
| 认证 | `@nestjs/jwt` | HS256，access token 2h，无 refresh token |
| 密码 | Node 内置 `crypto.scrypt` | 零外部依赖，`timingSafeEqual` 比较 |
| 日志 | nestjs-pino + pino-http + pino-pretty | 统一出口，含脱敏与链路追踪 |
| 健康检查 | `@nestjs/terminus` | `/health`、`/ready` |
| 校验 | class-validator / class-transformer | 全局严格模式 |
| 测试 | Jest 30 + ts-jest（ESM）/ Supertest（e2e） | `npm run test`、`npm run test:e2e` |

## 2. 目录结构

```
src/
├── auth/                        认证与授权
│   ├── dto/                     login / register DTO
│   ├── guards/                  jwt-auth.guard、roles.guard
│   ├── interfaces/              JwtPayload / AuthUser / RequestWithUser
│   ├── utils/password.util.ts   scrypt 哈希与校验
│   ├── token-store.ts           Redis 登出黑名单
│   ├── auth.controller.ts / auth.service.ts / auth.module.ts
├── common/                      通用能力
│   ├── decorators/              @Public() @Roles() @CurrentUser()
│   ├── enums/role.enum.ts       Role 枚举
│   ├── filters/                 全局异常过滤器
│   ├── logger/                  pino 配置与全局日志模块
│   ├── security/                安全响应头、限流守卫与装饰器
│   └── utils/sanitize.util.ts   输入清洗
├── config/redis.config.ts       Redis 客户端、分布式锁、布隆过滤器
├── health/health.controller.ts  存活 / 就绪探针
├── ledger/                      账务管理（账户 + 流水：事务 / 悲观锁 / 幂等）
├── orders/                      日志方案演示（controller / service / dto）
├── product/                     商品模块（entity + dto + service + controller）
├── user/                        用户模块（entity + dto + service + controller）
├── app.module.ts                根模块：TypeORM、全局守卫、全局过滤器
├── app.controller.ts / app.service.ts
└── main.ts                      安全头、严格校验、CORS、HTTPS、日志接管
```

## 3. 已完成能力

### 3.1 基础设施

- TypeORM 连接 MySQL，实体自动扫描；开发环境 `synchronize`，生产自动关闭。
- Redis 客户端带错误监听与重连退避，连接不可用时优雅降级（不阻塞接口）。
- 商品模块实现 `cache-aside` + 分布式锁 + 空值缓存（防缓存穿透）+ 布隆过滤器预热。

### 3.2 认证与授权（JWT + RBAC）

- 全局 `JwtAuthGuard` 默认拒绝匿名访问，`@Public()` 显式放行。
- `RolesGuard` 读取 `@Roles()` 做角色校验，`admin` 拥有全部权限。
- 登出按 `jti` 写入 Redis 黑名单，剩余有效期内令牌失效。
- 首次启动自动创建管理员账号（**生产必须改密或删除**）。

### 3.3 安全加固

- **参数校验**：全局 `whitelist` + `forbidNonWhitelisted` + `transform` + `forbidUnknownValues`；所有写接口均有 DTO；路径参数用 `ParseIntPipe`；分页上限 100。
- **SQL 注入**：全部 TypeORM 参数化查询，无字符串拼接；写操作使用字段白名单防 mass assignment。
- **XSS**：安全响应头（CSP `default-src 'none'`、`nosniff`、`X-Frame-Options`、`Referrer-Policy` 等）；隐藏 `x-powered-by`；输入拒绝 `<` `>` 并过滤控制字符。
- **CSRF**：凭据仅走 `Authorization: Bearer`，不使用 Cookie，天然免疫；`credentials: false` + CORS 来源白名单。
- **HTTPS**：证书驱动启用；HSTS 仅在 HTTPS 下下发；`trust proxy` 保证限流取到真实 IP。
- **限流**：全局 100 次/分，登录与注册收紧至 5 次/分（429）。
- **错误处理**：统一异常过滤器，5xx 只进日志、不回堆栈。
- **配置外部化**：数据库、JWT 密钥、CORS、端口、HTTPS 证书均支持环境变量；生产强制 `JWT_SECRET`。

### 3.4 统一日志（nestjs-pino）

- 三类日志（框架 / 请求 / 业务）统一到同一个 pino 出口。
- 请求链路追踪：`reqId` 优先沿用 `X-Request-Id`，否则生成并回写响应头。
- 敏感字段脱敏：`password` / `authorization` / `token` 等自动变 `[REDACTED]`。
- 按状态码分级：5xx→error、4xx→warn、3xx→silent、其余→info。
- 健康检查降噪：`/health`、`/ready` 不产生请求日志。
- 环境差异化：开发 `pino-pretty` 彩色，生产单行 JSON。

### 3.5 账务管理（ledger）

- **账户**：账户号自动生成；余额只能通过资金操作变更，支持冻结 / 解冻。
- **资金操作**：存入 / 取出 / 转账，统一用「转出账户 → 转入账户」模型表达（任一端为空即代表外部）。
- **一致性保障**：数据库事务 + 悲观写锁（`SELECT ... FOR UPDATE`）；转账按账户 id **升序加锁**避免死锁；`@VersionColumn` 乐观锁双保险。
- **幂等**：`txnNo` 唯一索引 + 事务内前置检查 + 唯一键冲突回查，重复提交只入账一次。
- **对账**：每笔流水记录变动后余额快照（`fromBalanceAfter` / `toBalanceAfter`）。
- **金额精度**：统一以「分」的整数存储（`bigint` + transformer），杜绝浮点误差。
- **权限**：出金方必须为本人或管理员；流水查询按账户归属过滤（防越权 IDOR）。

### 3.6 健康检查

- `GET /health`：存活探针，只确认进程存活。
- `GET /ready`：就绪探针，接入依赖检查后可返回 503。

## 4. 接口清单

| 接口 | 权限 | 备注 |
| --- | --- | --- |
| `GET /` | 公开 | 返回 `Hello World!` |
| `GET /health`、`GET /ready` | 公开 | 探针，日志已降噪 |
| `POST /auth/register` | 公开 | 限流 5/分，默认 `user` 角色 |
| `POST /auth/login` | 公开 | 限流 5/分 |
| `GET /auth/profile`、`POST /auth/logout` | 需登录 | 登出拉黑 `jti` |
| `GET /product/:id` | 需登录 | 走缓存 + 分布式锁 |
| `POST /product`、`PUT /product` | admin | 字段白名单更新 |
| `/user` 全部 | admin | 分页 `pageSize ≤ 100` |
| `GET /orders/:id`、`POST /orders`、`GET /orders/boom` | 需登录 | 日志演示 |
| `POST` / `GET /ledger/accounts`、`PATCH /ledger/accounts/:id` | admin | 开户 / 账户列表 / 改名称与状态 |
| `GET /ledger/accounts/:id`、`/ledger/accounts/:id/balance` | 本人或 admin | 详情 / 余额查询 |
| `POST /ledger/transactions/deposit`、`/withdraw`、`/transfer` | 本人或 admin | 资金操作，限流 30/分 |
| `GET /ledger/transactions`、`/ledger/transactions/:txnNo` | 按账户归属过滤 | 流水分页 / 按流水号查询 |

## 5. 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `NODE_ENV` | 生产必填 | - | `production` 会强制 `JWT_SECRET`、关闭 `synchronize` |
| `JWT_SECRET` | 生产必填 | 开发默认值 | 缺失则启动失败 |
| `DB_HOST` / `DB_PORT` | 否 | `127.0.0.1` / `3306` | 数据库连接 |
| `DB_USERNAME` / `DB_PASSWORD` | 否 | `root` / `faben123` | 建议改最小权限账号 |
| `DB_DATABASE` | 否 | `nest_crud_demo` | 库名 |
| `DB_SYNC` | 否 | 跟随 NODE_ENV | 设为 `false` 禁用同步 |
| `CORS_ORIGINS` | 生产必填 | 反射任意 Origin | 逗号分隔白名单 |
| `PORT` | 否 | `3000` | 监听端口 |
| `HTTPS_KEY` / `HTTPS_CERT` | 否 | - | 同时提供才启用 HTTPS |
| `LOG_LEVEL` | 否 | 生产 info / 开发 debug | 覆盖日志级别 |
| `SERVICE_NAME` / `APP_VERSION` | 否 | `nestjs-app` / `1.0.0` | 写入日志 base 字段 |

## 6. 踩坑记录

| # | 现象 | 原因与处理 |
| --- | --- | --- |
| 1 | `'NX' does not exist in type 'Callback<"OK">'` | ioredis 不支持 `set(key, value, {NX, EX})` 选项对象，必须写成位置参数 `set(k, v, 'EX', s, 'NX')`；同时移除与 v5 自带类型冲突的 `@types/ioredis` |
| 2 | `Type '"id"[]' has no properties in common with 'FindOptionsSelect'` | TypeORM 的 `select` 是**对象**不是数组，应写 `select: { id: true }` |
| 3 | `number` 不能赋给 `HashableInput` | `bloom-filters` 只接受 `string \| ArrayBuffer \| Buffer`，调用处统一 `String(id)` |
| 4 | `BLOB, TEXT ... column 'roles' can't have a default value` | MySQL 的 text 列不允许默认值；`simple-array` 会映射成 text，改用 `varchar` + 自定义 transformer |
| 5 | `value.split is not a function` | TypeORM 在 insert 后的 hydration 会把**数组**传给 `transformer.from`，需兼容 `Array.isArray` |
| 6 | `Data too long for column 'password'` | scrypt 密文形如 `salt:hash` 约 161 字符，列长从 100 调整为 255 |
| 7 | `TS2307 Cannot find module './xxx'` | ESM + `nodenext` 下相对导入**必须带 `.js` 后缀** |
| 8 | Bootstrap 日志未走 pino | Nest 的 `Logger` 实例绑定创建时的全局 logger，`new Logger()` 必须放在 `app.useLogger()` **之后** |
| 9 | `ERR_HTTP_HEADERS_SENT` | 异常过滤器在 `main.ts` 与 `APP_FILTER` 各注册一次，被处理两次；只保留一处 |
| 10 | devDependencies 全部缺失 | `npm config get omit` 为 `dev`，需 `npm install --include=dev` |
| 11 | `npm run build` 的 safe-delete 报错 | `nest-cli.json` 的 `deleteOutDir: true` 触发目录清理被拦截，改为 `false` |
| 12 | pino-http 回调类型不兼容 | `autoLogging.ignore` / `genReqId` 的参数是 Node 原生 `IncomingMessage` / `ServerResponse`，不是 express 的 `Request` |
| 13 | `/orders/boom` 返回 200 | `@Get(':id')` 声明在 `@Get('boom')` 之前，静态路径被参数路由吃掉；静态路由必须前置 |
| 14 | `GET /` 一直 404 | `AppController` 未在 `AppModule` 注册，需显式加入 `controllers` |
| 15 | `DataTypeNotSupportedError: Data type "Object" in "Transaction.fromAccountId"` | 可空列的联合类型（`number \| null`）经反射后是 `Object`，TypeORM 无法推断列类型，必须显式声明 `type: 'int'`（字符串同理写 `type: 'varchar'`）。编译与单测都发现不了，只有真实启动才暴露 |

## 7. 运行与验证

```powershell
npm install --include=dev     # 注意 omit=dev 配置
npm run build
$env:NODE_ENV='production'; $env:JWT_SECRET='your-secret'; node dist/main.js
# 或开发模式（彩色日志）
npm run start:dev
```

前置依赖：MySQL 需在 `127.0.0.1:3306` 运行；Redis 可选（缺失时缓存与黑名单降级，仅打印告警）。

冒烟验证：

```bash
curl -I http://localhost:3000/                      # 安全响应头
curl http://localhost:3000/health                   # 探针（不产生请求日志）
curl http://localhost:3000/user                     # 401
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:3000/user   # 403
```

## 8. 待办 / 下一步

- [ ] 删除或强制修改默认管理员账号
- [ ] 接入 refresh token 与轮换机制
- [ ] 限流迁移到 Redis（支持多实例）+ 账号级失败锁定
- [ ] 引入 migration 替代 `synchronize`
- [ ] 数据库最小权限账号 + 连接启用 TLS
- [ ] 补充审计日志（登录成功/失败、权限拒绝、敏感写操作）
- [ ] 接入依赖漏洞扫描（`npm audit` / Dependabot）
- [ ] 增加 401/403/400/429 的安全回归测试
- [ ] 账务模块补充数据库集成测试，验证悲观锁与唯一索引的真实行为（并发转账余额不为负）
- [ ] 全局 `@Public()` 之外的接口补 e2e 用例

详细清单见 [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md)。

## 9. 相关文档

- [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md) —— 接口安全自查清单（14 分类）
- [LOGGING.md](./LOGGING.md) —— 统一日志方案（含实测输出与验证方法）
