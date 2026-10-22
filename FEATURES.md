# 项目功能与业务说明

> 项目：`nest-typeorm-crud`
> 技术栈：NestJS 12 + TypeORM + MySQL + Redis + nestjs-pino
> 最后更新：2026-10-15

## 1. 系统概览

一个基于 NestJS 的后端服务，覆盖 **认证授权、用户管理、商品管理、账务管理** 四类业务，
并配套 **统一日志、健康检查、安全加固、限流** 等工程能力。

| 项 | 说明 |
| --- | --- |
| 运行形态 | HTTP 服务，默认监听 `3000` |
| 数据存储 | MySQL（业务数据）+ Redis（缓存、分布式锁、令牌黑名单） |
| 认证方式 | JWT（HS256），凭据经 `Authorization: Bearer <token>` 传递 |
| 权限模型 | RBAC，角色 `admin` / `user` |
| 启动 | `npm run start:dev`（开发）/ `npm run build && node dist/main.js`（生产） |
| 默认账号 | 首次启动自动创建管理员 `admin / admin123`（生产须改密或删除） |

## 2. 角色与权限

| 能力 | 匿名 | user | admin |
| --- | :---: | :---: | :---: |
| `GET /`、`/health`、`/ready` | 是 | 是 | 是 |
| 注册 / 登录 | 是 | 是 | 是 |
| 查看个人资料、登出 | 否 | 是 | 是 |
| 商品查询 | 否 | 是 | 是 |
| 商品新增 / 修改 | 否 | 否 | 是 |
| 用户管理（增删改查） | 否 | 否 | 是 |
| 账户详情 / 余额 | 否 | 仅本人 | 是 |
| 开户 / 账户列表 / 改名冻结 | 否 | 否 | 是 |
| 资金操作（存入 / 取出 / 转账） | 否 | 仅本人账户出金 | 是 |
| 流水查询 | 否 | 仅本人账户 | 是 |
| 订单演示接口 | 否 | 是 | 是 |

> 权限实现：全局 `JwtAuthGuard` 默认拒绝匿名访问，`@Public()` 显式放行；`RolesGuard` 读取 `@Roles()` 做角色校验，`admin` 拥有全部权限。资源级归属校验（如"仅本人账户"）在各 Service 内完成。

## 3. 功能模块

### 3.1 认证与授权（`src/auth`）

| 功能 | 说明 |
| --- | --- |
| 注册 | 用户名查重、密码强度校验，成功后直接返回令牌，默认分配 `user` 角色 |
| 登录 | 校验密码（scrypt）与账号状态，签发 2 小时访问令牌 |
| 登出 | 按 `jti` 写入 Redis 黑名单，令牌在剩余有效期内失效 |
| 当前用户 | 返回 `userId` / `username` / `roles` / `jti` / `exp` |
| 密码存储 | Node 内置 `scrypt` + 随机 salt，比较使用 `timingSafeEqual` |
| 令牌载荷 | `{ sub, username, roles, jti, iat, exp }` |

**限制**：只有 access token（2h），无 refresh token 与主动轮换；账号被禁用后已签发令牌在到期前仍有效。

### 3.2 用户管理（`src/user`）

标准 CRUD，**整体仅管理员可访问**：

| 功能 | 说明 |
| --- | --- |
| 创建用户 | 密码自动哈希；默认 `user` 角色；支持指定归属角色（内部使用） |
| 列表 / 分页 | `pageSize` 上限 100，非法参数回落默认值 |
| 详情 / 更新 / 删除 | 更新走字段白名单（`username` / `nickname` / `status` / `password`），越权字段无效 |
| 敏感字段 | `password` 列 `select: false`，响应统一剔除 |

### 3.3 商品管理（`src/product`）

| 功能 | 说明 |
| --- | --- |
| 商品查询 | `GET /product/:id`，已登录即可 |
| 新增 / 修改 | 仅管理员；金额与名称走 DTO 校验与字段白名单 |
| 缓存 | Redis `cache-aside`，缓存空值防穿透 |
| 布隆过滤器 | 启动时预热全量商品 id，拦截不存在的 id，减少无效查询 |
| 分布式锁 | 缓存未命中时加锁回源，避免缓存击穿 |
| 缓存一致性 | 更新后立即删除缓存，并延迟 500ms 二次删除（延迟双删） |

### 3.4 账务管理（`src/ledger`）

| 功能 | 说明 |
| --- | --- |
| 账户管理 | 开户（余额恒为 0）、列表、详情、余额查询、改名 / 冻结 |
| 资金操作 | 存入、取出、转账，均支持幂等键 `txnNo` |
| 流水查询 | 分页 + 按账户 / 类型 / 时间区间过滤；按账户归属做权限过滤 |
| 余额快照 | 每笔流水记录变动后余额，便于对账 |
| 金额精度 | 统一以「分」的整数存储与传输，杜绝浮点误差 |

**账户模型**：`type`（`asset` 资产 / `liability` 负债）、`currency`（默认 `CNY`）、`status`（1 正常 / 0 冻结，冻结后禁止出金）。

### 3.5 日志与可观测（`src/common/logger`、`src/orders`）

| 功能 | 说明 |
| --- | --- |
| 统一日志 | nestjs-pino 单出口，覆盖框架日志、请求日志、业务日志 |
| 链路追踪 | `reqId` 优先沿用 `X-Request-Id`，否则生成并回写响应头 |
| 敏感脱敏 | `password` / `authorization` / `token` 等自动转为 `[REDACTED]` |
| 状态码分级 | 5xx → error，4xx → warn，3xx → silent，其余 info |
| 探活降噪 | `/health`、`/ready` 不产生请求日志 |
| 订单演示 | `src/orders` 提供服务层结构化日志示例（**数据存内存，重启丢失，仅用于演示**） |

### 3.6 健康检查（`src/health`）

| 接口 | 说明 |
| --- | --- |
| `GET /health` | Liveness，进程存活即 200，**不检查依赖** |
| `GET /ready` | Readiness，可挂载 DB / Redis 等依赖检查，不可用返回 503 |

## 4. 核心业务流程

### 4.1 登录与鉴权

```
客户端                        服务端
  │  POST /auth/login           │
  │  { username, password }     │
  ├────────────────────────────▶│  1. 限流校验（5 次/分/IP）
  │                             │  2. 查询用户（含密码）
  │                             │  3. scrypt 校验密码
  │                             │  4. 校验 status === 1
  │                             │  5. 签发 JWT（含 roles、jti，2h）
  │◀────────────────────────────┤  { accessToken, expiresIn, user }
  │                             │
  │  GET /ledger/accounts/1     │
  │  Authorization: Bearer xxx  │
  ├────────────────────────────▶│  1. JwtAuthGuard：验签 + 过期 + 黑名单
  │                             │  2. RolesGuard：角色校验
  │                             │  3. Service：资源归属校验
  │◀────────────────────────────┤  200 / 401 / 403
```

失败语义：**401** = 未认证（无令牌 / 无效 / 过期 / 已登出）；**403** = 已认证但无权限（角色不足或非资源归属人）。

### 4.2 商品查询（缓存链路）

```
GET /product/:id
   │
   ├─ 布隆过滤器判定不存在 ──▶ 直接返回 null（不查缓存、不查库）
   │
   ├─ 查 Redis 缓存
   │     ├─ 命中且为 "NULL" ──▶ 返回 null（空值缓存，防穿透）
   │     ├─ 命中实体 ─────────▶ 返回缓存
   │     └─ 未命中
   │            │
   │            ├─ 获取分布式锁（最多重试 3 次，各等 200ms）
   │            │     └─ 抢不到 ──▶ 抛"请求繁忙，请稍后重试"
   │            │
   │            ├─ 双重检查缓存（可能已被其他请求回填）
   │            │
   │            ├─ 回源数据库
   │            │     ├─ 不存在 ──▶ 写 "NULL" 缓存（TTL 30s）
   │            │     └─ 存在 ────▶ 写缓存（TTL 1800s + 随机 0~600s，防雪崩）
   │            │
   │            └─ finally：释放锁（Lua 脚本保证只删自己的锁）
```

### 4.3 资金流转

**开户**：管理员创建账户 → 生成账户号 → 余额固定为 0（余额不可直接赋值）。

**存入 / 取出**：

```
POST /ledger/transactions/deposit    （from = 外部，to = 账户）
POST /ledger/transactions/withdraw   （from = 账户，to = 外部）
```

流程：开启事务 → 幂等前置检查 → 悲观写锁锁定账户 → 归属校验 →
（取出时）校验账户未冻结、余额充足 → 变更余额 → 写流水（含余额快照）→ 提交。

**转账**：

```
POST /ledger/transactions/transfer   （from = A，to = B）
```

流程：校验转出≠转入 → 开启事务 → 幂等前置检查 → **按账户 id 升序**加悲观写锁 →
校验归属、冻结状态、余额充足、币种一致 → 双向变更余额 → 写流水（双边余额快照）→ 提交。

**一致性保障**：

| 机制 | 作用 |
| --- | --- |
| 数据库事务 | 余额变更与流水写入原子提交，失败整体回滚 |
| 悲观写锁 | `SELECT ... FOR UPDATE` 串行化同一账户的并发变更 |
| 升序加锁 | 避免 A→B 与 B→A 并发时互相等待造成死锁 |
| 乐观锁 | `@VersionColumn` 双保险 |
| 幂等键 | `txnNo` 唯一索引 + 事务内前置检查 + 唯一键冲突回查 |
| 余额快照 | `fromBalanceAfter` / `toBalanceAfter` 支持对账 |

## 5. 接口总览

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | 公开 | 健康问候，返回 `Hello World!` |
| GET | `/health` | 公开 | Liveness 探针 |
| GET | `/ready` | 公开 | Readiness 探针 |
| POST | `/auth/register` | 公开（限流 5/分） | 注册并返回令牌 |
| POST | `/auth/login` | 公开（限流 5/分） | 登录 |
| POST | `/auth/logout` | 登录 | 登出并拉黑当前令牌 |
| GET | `/auth/profile` | 登录 | 当前用户信息 |
| POST | `/user` | admin | 创建用户 |
| GET | `/user` | admin | 用户列表 |
| GET | `/user/page` | admin | 用户分页 |
| GET | `/user/:id` | admin | 用户详情 |
| PATCH | `/user/:id` | admin | 更新用户 |
| DELETE | `/user/:id` | admin | 删除用户 |
| GET | `/product/:id` | 登录 | 商品查询（走缓存） |
| POST | `/product` | admin | 新增商品 |
| PUT | `/product` | admin | 修改商品 |
| POST | `/ledger/accounts` | admin | 开户 |
| GET | `/ledger/accounts` | admin | 账户列表（分页 + 过滤） |
| GET | `/ledger/accounts/:id` | 本人或 admin | 账户详情 |
| GET | `/ledger/accounts/:id/balance` | 本人或 admin | 余额查询 |
| PATCH | `/ledger/accounts/:id` | admin | 改名 / 冻结 |
| POST | `/ledger/transactions/deposit` | 登录（限流 30/分） | 存入 |
| POST | `/ledger/transactions/withdraw` | 登录（限流 30/分） | 取出 |
| POST | `/ledger/transactions/transfer` | 登录（限流 30/分） | 转账 |
| GET | `/ledger/transactions` | 按归属过滤 | 流水分页 |
| GET | `/ledger/transactions/:txnNo` | 按归属过滤 | 按流水号查询 |
| GET | `/orders/:id` | 登录 | 订单演示查询 |
| POST | `/orders` | 登录 | 订单演示创建 |
| GET | `/orders/boom` | 登录 | 订单演示错误样例（触发 500） |

## 6. 数据模型

| 实体 | 表名 | 关键字段 |
| --- | --- | --- |
| `User` | `sys_user` | `id`、`username`、`password`(select:false)、`roles`、`nickname`、`status`、`createTime`、`updateTime` |
| `Product` | `product` | `id`、`name`、`price` |
| `Account` | `ledger_account` | `id`、`accountNo`、`name`、`type`、`currency`、`balance`(分)、`status`、`ownerId`、`version`、`createTime`、`updateTime` |
| `Transaction` | `ledger_transaction` | `id`、`txnNo`、`type`、`amount`(分)、`fromAccountId`、`toAccountId`、`fromBalanceAfter`、`toBalanceAfter`、`status`、`remark`、`operatorId`、`createTime` |

> `roles` 以逗号分隔的 `varchar` 存储（MySQL 的 `text` 不支持默认值）。
> 示例数据：`ledger_account` 与 `ledger_transaction` 在开发环境由 `synchronize` 自动建表。

## 7. 非功能能力

| 能力 | 实现 |
| --- | --- |
| 参数校验 | 全局严格 `ValidationPipe`（白名单 + 拒绝多余字段 + 类型转换），所有写接口均有 DTO |
| 安全响应头 | CSP、`nosniff`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`、HSTS（HTTPS 下） |
| CSRF | 凭据仅走 Header，不使用 Cookie，天然免疫；CORS `credentials: false` |
| 限流 | 全局 100 次/分，登录与注册 5 次/分，资金操作 30 次/分 |
| 异常处理 | 统一过滤器，5xx 只进日志、不回堆栈 |
| 配置 | 数据库 / JWT 密钥 / CORS / 端口 / 证书均可通过环境变量注入 |
| 生产防护 | 生产强制 `JWT_SECRET`、自动关闭 `synchronize` |

## 8. 已知限制与待办

| 项 | 说明 |
| --- | --- |
| 默认管理员 | `admin/admin123` 需在生产删除或改密 |
| 令牌 | 无 refresh token；禁用账号后令牌在 2h 内仍有效 |
| 订单模块 | 数据存内存，重启即失，仅作日志演示 |
| 限流 | 内存单实例实现，集群部署需迁移到 Redis |
| 表结构 | 依赖 `synchronize`，生产应改用 migration |
| 对账 | 已记录余额快照，但尚无自动对账 / 冲正接口 |
