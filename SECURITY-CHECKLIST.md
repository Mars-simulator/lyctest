# 接口安全 Checklist

> 项目：`nest-typeorm-crud`（NestJS 12 + TypeORM + MySQL + Redis）
> 最后更新：2026-10-12
>
> 标记说明：`[x]` 已落实 · `[ ]` 待办 · 条目末尾标注「部分」表示已有基础防护但仍存在缺口


## 环境变量参考

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `NODE_ENV` | 生产必填 | - | 设为 `production` 会强制校验 `JWT_SECRET` 并关闭 `synchronize` |
| `JWT_SECRET` | 生产必填 | 开发默认值 | 生产缺失将直接启动失败 |
| `DB_HOST` / `DB_PORT` | 否 | `127.0.0.1` / `3306` | 数据库连接 |
| `DB_USERNAME` / `DB_PASSWORD` | 否 | `root` / `faben123` | **建议改为最小权限专用账号** |
| `DB_DATABASE` | 否 | `nest_crud_demo` | 数据库名 |
| `DB_SYNC` | 否 | 跟随 NODE_ENV | 设为 `false` 可禁用自动同步表结构 |
| `CORS_ORIGINS` | 生产必填 | 反射任意 Origin | 逗号分隔白名单，如 `https://a.com,https://b.com` |
| `PORT` | 否 | `3000` | 监听端口 |
| `HTTPS_KEY` / `HTTPS_CERT` | 否 | - | 同时提供才启用 HTTPS |

---

## 1. 认证 Authentication

- [x] 全局默认拒绝匿名访问：`JwtAuthGuard` 通过 `APP_GUARD` 全局注册
- [x] 公开接口白名单：仅 `@Public()` 标注的路由可匿名（`/`、`/auth/login`、`/auth/register`）
- [x] 密码哈希：Node 内置 scrypt + 随机 salt，比较使用 `timingSafeEqual`（防时序攻击）
- [x] 密码不出现在响应：实体 `select: false` + `UserService.toSafeUser()` 显式剔除
- [ ] 删除或强制修改默认账号 `admin / admin123`（`AuthService.onModuleInit` 会自动创建）
- [ ] 账号禁用即时生效（当前 `status` 仅在登录时校验，禁用后已签发 token 在到期前仍有效）
- [ ] Refresh Token 与轮换机制（当前仅有 2 小时 access token）

## 2. 授权 Authorization

- [x] RBAC 角色校验：`@Roles()` + `RolesGuard`，普通用户访问 `/user` 返回 403
- [x] 写操作管理员限定：`/user/*`、`POST|PUT /product` 均需 `admin`
- [x] 防越权赋值（mass assignment）：create / update 均使用字段白名单
- [ ] 确认管理员超级权限（`RolesGuard` 中 admin 直接放行）的影响面是否符合预期

## 3. 输入与参数校验

- [x] 全局严格校验：`whitelist` + `forbidNonWhitelisted` + `transform` + `forbidUnknownValues` + `stopAtFirstError`
- [x] 校验错误不回显原始输入：`validationError: { target: false, value: false }`
- [x] 所有写接口均有 DTO：`CreateProductDto` / `UpdateProductDto` / `RegisterDto` / `CreateUserDto`
- [x] 路径参数校验：`ParseIntPipe`，`/product/abc` 返回 400
- [x] 分页参数约束：`PageQueryDto` 限制 `pageSize <= 100`，Service 层再次钳制
- [x] 密码策略：8–64 位且须同时包含字母和数字
- [x] 用户名格式：`^[A-Za-z0-9_]+$`，3–50 位
- [x] 自由文本限制：昵称 / 商品名拒绝 `<` `>` 并过滤控制字符
- [ ] 显式设置请求体大小限制（当前依赖 express 默认 100KB）
- [ ] 显式拒绝非 `application/json` 的写请求

## 4. 注入类

- [x] SQL 注入：全部使用 TypeORM 参数化查询，无字符串拼接 SQL
- [x] 查询参数污染：`forbidNonWhitelisted` 会拒绝 DTO 之外的参数
- [x] 命令注入 / SSRF / 不安全反序列化：项目无相关功能，攻击面为 0（新增功能时需重新评估）

## 5. XSS 与输出安全

- [x] 安全响应头中间件：`src/common/security/security-headers.ts`
- [x] `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: no-referrer`、`Permissions-Policy`、`Cross-Origin-Resource-Policy`
- [x] 输入层拦截标签字符与控制字符

## 6. CSRF

- [x] 凭据仅通过 `Authorization: Bearer` 传递，不使用 Cookie，天然免疫 CSRF
- [x] CORS `credentials: false`，浏览器不会自动携带凭据
- [x] 代码注释中已固化 Cookie 方案预案（SameSite + CSRF Token + Origin 校验）

## 7. 传输安全 HTTPS

- [x] 证书驱动启用 HTTPS：设置 `HTTPS_KEY` / `HTTPS_CERT` 即可
- [x] HSTS：仅 HTTPS 下下发 `max-age=31536000; includeSubDomains`
- [x] `trust proxy` 已开启，反代后限流可取得真实客户端 IP
- [ ] HTTP → HTTPS 强制跳转（建议在反向代理层完成 301）
- [ ] 生产环境由 Nginx / 网关终止 TLS，应用只监听内网 HTTP

## 8. 令牌与限流

- [x] 令牌有效期 2 小时（`ACCESS_TOKEN_TTL_SECONDS`）
- [x] 主动失效：登出按 `jti` 写入 Redis 黑名单，剩余有效期内不可复用
- [x] 接口限流：全局 100 次/分，登录与注册收紧至 5 次/分，超限返回 429
- [ ] 限流迁移到 Redis 计数器（当前为单实例内存实现，集群下不准确）
- [ ] 账号级失败锁定（当前仅 IP 维度）
- [ ] 登录验证码 / 人机校验（高频攻击场景）

## 9. 错误处理与信息泄露

- [x] 统一异常过滤器 `AllExceptionsFilter`：5xx 仅记录服务端日志，客户端只收到通用文案
- [x] 不向客户端返回堆栈或数据库错误细节
- [x] 校验错误不包含原始输入值
- [ ] 评估 404 与 403 的区分是否暴露资源存在性（高敏感业务可统一为 404）

## 10. 配置与密钥管理

- [x] 敏感配置外部化：数据库、JWT 密钥、CORS、端口、HTTPS 证书均支持环境变量
- [x] `.env` 已在 `.gitignore` 中
- [x] 生产环境强制 `JWT_SECRET`，缺失则启动失败（快速失败）
- [x] 生产环境自动关闭 `synchronize`
- [ ] 补充 `.env.example` 变量模板
- [ ] 数据库使用最小权限专用账号（当前为 `root`）
- [ ] 数据库连接启用 TLS（mysql2 `ssl` 配置）

## 11. 数据与存储

- [x] 敏感字段默认不查询：`password` 为 `select: false`
- [x] 响应体剔除敏感字段
- [ ] `findAll` 无分页限制，大数据量时建议改为分页或加保护
- [ ] 字段级加密（如手机号、身份证等敏感信息）
- [ ] 表结构变更流程：生产禁用 `synchronize` 后需引入 migration

## 12. 日志与审计

- [ ] 审计日志：登录成功/失败、权限拒绝、敏感写操作未落库

## 13. 依赖与供应链

- [x] `package-lock.json` 已纳入版本管理
- [ ] 接入 `npm audit` 等漏洞扫描
- [ ] CI 中加入依赖检查与构建门禁

## 14. 测试与验证

- [ ] 安全回归用例：401（未认证）、403（越权）、400（脏参数）、429（限流）
- [ ] 每次发布前跑一遍下方「快速自测命令」

---

## 上线前必做（按优先级）

1. 删除默认管理员账号，或首次启动强制改密
2. 显式配置 `CORS_ORIGINS`、`JWT_SECRET`、`DB_*`，并将数据库账号换成最小权限用户
3. 部署 TLS（反向代理终止）并开启 HTTP → HTTPS 跳转
4. 限流迁移到 Redis，并增加账号级失败锁定
5. 接入依赖漏洞扫描与安全回归测试
6. 补齐审计日志与日志脱敏
