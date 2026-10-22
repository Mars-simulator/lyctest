# 单元测试与覆盖说明

> 项目：`nest-typeorm-crud`
> 测试框架：Jest 30 + ts-jest（ESM 模式）
> e2e 框架：Jest + Supertest
> 最后更新：2026-10-15

## 1. 概览

| 指标 | 数值 |
| --- | --- |
| 测试文件 | 8 |
| 测试用例 | 88 |
| 语句覆盖率 | 47.25% |
| 分支覆盖率 | 41.85% |
| 函数覆盖率 | 42.51% |
| 行覆盖率 | 48.13% |

运行命令：

```bash
npm run test          # 单次运行
npm run test:watch    # 监听模式
npm run test:cov      # 带覆盖率报告
npm run test:e2e      # e2e（Supertest，需要 MySQL）
```

> **ESM 说明**：项目 `package.json` 为 `"type": "module"`，Jest 的 ESM 支持需要 `--experimental-vm-modules`。
> 该参数已内置在 `package.json` 的脚本中，直接使用 `npm run test` 即可，无需手动添加。

> **覆盖率口径**：`jest.config.cjs` 的 `collectCoverageFrom: ['src/**/*.ts', ...]` 统计**全部源文件**，
> 因此整体数值（47%）会把尚未编写测试的控制器、DTO、守卫、日志等一并计入分母。
> 判断质量应看核心业务服务的单文件覆盖率（见下表，普遍在 87% ~ 98%）。

## 2. 覆盖率明细（核心模块）

```
File                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files                   |   47.25 |    41.85 |   42.51 |   48.13 |
 src/auth/service
  auth.service.ts           |   96.96 |    85.71 |     100 |   96.77 | 26
  password.util.ts          |   94.11 |     87.5 |     100 |     100 | 9
 src/user
  user.service.ts           |   87.87 |    80.76 |      80 |   92.85 | 39,75
 src/product
  product.service.ts        |   96.92 |    93.33 |    87.5 |   98.18 | 107
 src/ledger
  account.service.ts        |   97.67 |    97.05 |   91.66 |   97.36 | 64
  transaction.service.ts    |   95.61 |    86.58 |   95.45 |   97.16 | 196,208,230
 src/ledger/utils
  money.util.ts             |     100 |      100 |     100 |     100 |
 src/ledger/enums           |     100 |      100 |     100 |     100 |
 src/common/enums           |     100 |      100 |     100 |     100 |
 src/app.service.ts         |     100 |      100 |     100 |     100 |
```

未纳入统计的文件（当前无测试）：各 `*.controller.ts`、`*.module.ts`、`dto/*.ts`、`guards/*.ts`、
`common/filters`、`common/logger`、`common/security`、`config/redis.config.ts`、`health`、`orders`。

## 3. 测试文件与用例清单

### 3.1 `src/auth/utils/password.util.spec.ts`（8 例）

口令哈希工具，无外部依赖，全部使用真实实现（不 mock）：

| 分组 | 用例 |
| --- | --- |
| `hashPassword` | 生成 `salt:hash` 格式密文（32 位 salt + 128 位 hash） |
| | 相同明文两次哈希结果不同（随机 salt） |
| | 密文中不包含明文 |
| `verifyPassword` | 明文正确返回 `true` |
| | 明文错误返回 `false` |
| | 大小写敏感 |
| | 密文格式非法时返回 `false` 而非抛错 |
| | 哈希长度不匹配时返回 `false`（防越界比较） |

### 3.2 `src/user/user.service.spec.ts`（14 例）

Repository 通过 `getRepositoryToken(User)` 注入 mock。

| 分组 | 用例 | 校验点 |
| --- | --- | --- |
| `create` | 密码哈希后落库，默认分配 `user` 角色 | 密文格式、默认角色 |
| | 返回值中不包含密码 | 敏感字段不泄露 |
| | 显式传入 `roles` 时不被覆盖 | 内部初始化管理员可用 |
| | 忽略入参中多余字段 | 防 mass assignment |
| `findPage` | `pageSize` 超上限钳制为 100 | 防超大分页拖垮数据库 |
| | 非法分页参数回落到默认值 | `page=0`、`pageSize=NaN` |
| | 按 `(page-1)*pageSize` 计算 skip | 分页正确性 |
| `findOne` | 不存在时抛 `NotFoundException` | 404 语义 |
| | 存在时返回实体 | — |
| `findByUsernameWithPassword` | 使用参数绑定查询 | 断言 `where('user.username = :username', {username})`，防 SQL 注入 |
| `update` | 只更新白名单字段，忽略 `roles` 越权 | 防提权 |
| | 传入 `password` 时重新哈希 | 不落明文 |
| | 返回值中不包含密码 | — |
| `remove` | 先确认存在再删除 | — |

### 3.3 `src/auth/auth.service.spec.ts`（10 例）

`UserService`、`JwtService` 注入 mock，`token-store` 用 `jest.mock` 整体替换（避免创建真实 Redis 连接）。

| 分组 | 用例 |
| --- | --- |
| `onModuleInit` | 管理员已存在时不重复创建 |
| | 不存在时创建，并赋予 `admin + user` 角色 |
| `register` | 用户名已存在抛 `ConflictException`，且不创建用户 |
| | 成功返回访问令牌，默认角色为 `user`，响应结构完整 |
| `login` | 用户不存在抛 `UnauthorizedException`，且不签发令牌 |
| | 密码错误抛 `UnauthorizedException` |
| | 账号被禁用（`status !== 1`）抛 `ForbiddenException` |
| | 凭据正确时签发令牌，断言 payload `{sub, username, roles}` 与 `jwtid` / `expiresIn` 选项 |
| `logout` | 把 `jti` 与剩余有效期写入黑名单 |
| | 缺少 `jti`/`exp` 时跳过拉黑，仍返回成功 |

### 3.4 `src/product/product.service.spec.ts`（13 例）

Repository 注入 mock；`../config/redis.config.js` 用 `jest.mock` 整体替换（该模块顶层会 `new Redis()`，必须阻断真实连接）。

| 分组 | 用例 | 校验点 |
| --- | --- | --- |
| `onModuleInit` | 把库中已有商品 id 全部加入布隆过滤器 | `select: { id: true }` |
| `getProductById` | 布隆过滤器判定不存在 → 直接 `null` | 不查缓存、不查库 |
| | 缓存命中 → 返回反序列化结果 | 不查库 |
| | 命中空值缓存 `NULL` → 返回 `null` | 防穿透 |
| | 缓存未命中 → 加锁回源、写回缓存、释放锁 | 断言锁 key 与 TTL |
| | 数据库不存在 → 写入空值缓存 | `EX 30` |
| | 抢不到锁 → 抛业务异常且不误释放他人锁 | 重试 3 次 |
| | 双重检查命中缓存 → 直接返回 | 不再查库、仍释放锁 |
| `updateProduct` | 无可更新字段返回 `false` 且不访问数据库 | — |
| | 只把白名单字段写入数据库 | 防越权更新 |
| | `affected === 0` 返回 `false` | — |
| | 更新成功后删除缓存 | 缓存一致性 |
| `addProduct` | 只落库白名单字段，并把新 id 加入布隆过滤器 | 防 mass assignment |

### 3.5 `src/ledger/utils/money.util.spec.ts`（5 例）

| 分组 | 用例 |
| --- | --- |
| `centsToYuan` | 整数金额补齐两位小数；负数保留符号 |
| `yuanToCents` | 按四舍五入转换，规避 `0.1 + 0.2` 之类的浮点误差 |
| `bigintTransformer` | 读取时把数据库返回的字符串转为 number；写入时原样传递（含 null/undefined） |

### 3.6 `src/ledger/account.service.spec.ts`（14 例）

| 分组 | 用例 | 校验点 |
| --- | --- | --- |
| `create` | 新账户余额恒为 0，并生成账户号 | 格式 `AC` + 时间戳 + 随机 |
| | 未指定 `ownerId` 时归属当前操作人 | 默认归属 |
| | 管理员可为他人开户 | — |
| | 未指定类型与币种时使用默认值 | `asset` / `CNY` |
| `findPage` | `pageSize` 超上限钳制为 100 | — |
| | 非法分页参数回落到默认值 | — |
| | 按 `ownerId` / `status` / 关键词构造参数化查询 | 防 SQL 注入 |
| `findOne` | 不存在时抛 `NotFoundException` | — |
| `findOneFor` | 本人可访问自己的账户 | — |
| | 管理员可访问任何账户 | — |
| | 普通用户访问他人账户抛 `ForbiddenException` | **防越权 IDOR** |
| `update` | 只更新名称与状态，夹带 `balance` 越权字段无效 | 余额不可直接改 |
| | 可冻结账户 | — |
| `findIdsByOwner` | 返回该用户名下所有账户 id | 供流水权限过滤 |

### 3.7 `src/ledger/transaction.service.spec.ts`（23 例）

资金一致性是账务系统的核心，用例重点覆盖**并发、幂等、越权、余额校验**。
`DataSource.transaction` 被 mock 为直接执行回调并注入 `EntityManager` mock，因此可断言事务内的账户变更与加锁行为。

| 分组 | 用例 | 校验点 |
| --- | --- | --- |
| `deposit` | 余额增加并记录变动后余额快照 | `toBalanceAfter` |
| | 相同 `txnNo` 重复提交不会重复入账 | 幂等前置检查、未加锁、未写库 |
| | 并发撞唯一索引时回查返回既有流水 | 捕获 `ER_DUP_ENTRY` 兜底 |
| | 操作他人账户抛 `ForbiddenException` | 防越权 |
| | 账户不存在抛 `NotFoundException` | — |
| `withdraw` | 余额减少 | `fromBalanceAfter` |
| | 余额不足拒绝且不写库 | 资金不被透支 |
| | 冻结账户禁止出金 | 状态校验 |
| `transfer` | 双方余额同时变更，快照分别记录 | 原子性 |
| | 使用悲观写锁按 id 集合加锁 | `lock: pessimistic_write`，防并发死锁 |
| | 转出与转入相同直接拒绝 | 不开启事务 |
| | 余额不足拒绝 | — |
| | 币种不一致拒绝 | — |
| | 账户缺失抛 `NotFoundException` | — |
| | 非本人账户不可作为转出方 | 出金方归属校验 |
| `findPage` | 管理员查询不做归属过滤 | — |
| | 普通用户未持有账户直接返回空结果 | 短路、不执行查询 |
| | 普通用户查询他人账户抛 `ForbiddenException` | 防越权 |
| | 普通用户查询自己账户时按转出/转入双向过滤 | — |
| | 时间区间与类型使用参数绑定过滤 | 防 SQL 注入 |
| `findByTxnNo` | 流水不存在抛 `NotFoundException` | — |
| | 与本人账户无关的流水抛 `ForbiddenException` | 防越权 |
| | 本人账户相关的流水可查询 | — |

### 3.8 `src/app.controller.spec.ts`（1 例）

Nest 脚手架自带用例，校验 `/` 返回 `Hello World!`。

### 3.9 `test/app.e2e-spec.ts`（e2e，Supertest）

用 `supertest` 对真实 HTTP 层发起请求，启动完整 `AppModule`（需要 MySQL 可用）：

```ts
it('/ (GET)', () => {
  return request(app.getHttpServer())
    .get('/')
    .expect(200)
    .expect('Hello World!');
});
```

## 4. Mock 策略

| 依赖 | 处理方式 | 原因 |
| --- | --- | --- |
| TypeORM `Repository` | `{ provide: getRepositoryToken(X), useValue: repoMock }` | 单测不依赖数据库 |
| `DataSource` / `EntityManager` | `useValue` mock，`transaction` 直接执行回调 | 可在无数据库下断言事务内行为 |
| `JwtService` | `useValue: { signAsync: jest.fn() }` | 无需真实签名 |
| `UserService`（在 AuthService 中） | `useValue` mock | 隔离被测单元 |
| `AccountService`（在 TransactionService 中） | **使用真实实例** + mock Repository | 覆盖真实的归属校验逻辑 |
| `../config/redis.config.js` | `jest.unstable_mockModule()` + 动态 `import()` | 该模块顶层会 `new Redis()`，必须阻断真实连接；ESM 下 `jest.mock()` 不生效 |
| `./token-store.js` | `jest.unstable_mockModule()` + 动态 `import()` | 内部依赖 Redis 客户端 |
| Logger / console | `jest.spyOn(...).mockImplementation()` | 抑制噪音输出 |
| 口令哈希 | 不 mock，跑真实 scrypt | 校验真实行为（格式、随机性、比较逻辑） |

### 与 Vitest 的关键差异

| 能力 | Vitest | Jest |
| --- | --- | --- |
| 断言 / 生命周期 | 全局 或 `import from 'vitest'` | 全局（`@types/jest`） |
| mock 函数 | `vi.fn()` | `jest.fn()` |
| 模块 mock | `vi.mock()` 可直接拦截 | **ESM 下 `jest.mock()` 不生效**，必须 `jest.unstable_mockModule()` + 动态 `import()` |
| `jest` 全局对象 | `vi` 全局可用 | **ESM 下不是全局**，需 `import { jest } from '@jest/globals'` |
| 提升后共享变量 | `vi.hoisted()` | 工厂内直接写 `jest.fn()`，再用 `jest.mocked()` 取回引用 |
| 清理 mock | `vi.clearAllMocks()` | `jest.clearAllMocks()`（已在 `jest.config.cjs` 中开启 `clearMocks: true`） |
| 运行 ESM | 原生支持 | 需要 `--experimental-vm-modules` |
| `.js` 后缀导入 | Vite 自动回退到 `.ts` | 需要 `moduleNameMapper`：`'^(\\.{1,2}/.*)\\.js$': '$1'` |

## 5. 未覆盖点

| 位置 | 说明 | 建议 |
| --- | --- | --- |
| `auth.service.ts:26` | 生产环境缺少 `JWT_SECRET` 时的快速失败守卫（模块加载即抛错） | 用子进程或 e2e 覆盖，单测会污染全局环境 |
| `user.service.ts:39,75` | `findAll()` / `findByUsername()` 未直接覆盖 | 各补 1 例 |
| `product.service.ts:107` | 延迟删缓存分支未覆盖 | 配合 fake timers 补 1 例 |
| `account.service.ts:64` | 账户关键字查询的空关键词分支 | 补 1 例 |
| `transaction.service.ts:196,208,230` | 余额不足 / 冻结 / 币种不一致的部分分支 | 补分支用例 |
| `user.entity.ts:8-10` | `rolesTransformer` 的 `to`/`from` 转换 | 需集成测试或单独导出 transformer 后单测 |

以下模块**当前未纳入单测**，属于后续补充范围：

- `auth/guards/jwt-auth.guard.ts`、`roles.guard.ts`（安全核心，建议优先补）
- `common/security/rate-limit.guard.ts`、`security-headers.ts`
- `common/filters/all-exceptions.filter.ts`
- `common/logger/*`（pino 配置）
- 各 `dto/*.ts` 的校验规则（可用 `class-validator` 的 `validate()` 直接断言）
- `controllers/*`、`main.ts`（启动流程）

## 6. 后续建议

1. 补齐上表 6 个未覆盖点，可把核心服务覆盖率推到 98% 以上。
2. 优先为 `RolesGuard` / `RateLimitGuard` 补单测——它们承载 RBAC 与限流的安全语义。
3. 为 DTO 补校验单测：构造非法 payload，断言校验失败；账务的金额单位、幂等键格式尤其值得覆盖。
4. 用 Supertest 扩充 e2e：401 / 403 / 400（多余字段、危险字符）/ 429（限流）全链路；账务可加"并发转账余额不为负"的集成用例。
5. 在 CI 中加入覆盖率阈值（建议只对核心 `service` 设阈值，如 `lines: 90`）与 `npm run test` 门禁。
6. 若后续引入数据库事务的集成测试（如 Testcontainers），可验证悲观锁与唯一索引的真实行为。

## 7. 相关文档

- [TEST-CASES.md](./TEST-CASES.md) —— 全部用例源码
- [SUMMARY.md](./SUMMARY.md) —— 阶段小结
- [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md) —— 接口安全自查清单
- [LOGGING.md](./LOGGING.md) —— 统一日志方案
