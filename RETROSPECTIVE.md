# 阶段复盘报告

> 项目：`nest-typeorm-crud`
> 复盘日期：2026-10-16
> 复盘范围：修复遗留缺陷 → JWT/RBAC → 安全加固 → 统一日志 → 单元测试 → 测试框架迁移 → 账务管理模块

## 1. 结论摘要

本阶段把一个仅有基础 CRUD 的 NestJS demo，扩展为具备**认证授权、安全加固、统一日志、账务管理**的可运行后端服务，
并配套完整文档与 88 个单元测试。

整体评价：**功能交付达标，工程规范显著提升，但"验证层次"是最大短板**——
多个缺陷是编译与单测都无法发现、只有真实启动才暴露的，这类问题在本阶段出现了 4 次。

## 2. 交付成果

### 2.1 功能

| 模块 | 内容 |
| --- | --- |
| 认证授权 | JWT 注册 / 登录 / 登出、RBAC、登出黑名单、默认管理员初始化 |
| 用户管理 | CRUD + 分页，整体限管理员 |
| 商品管理 | 查询走缓存 + 布隆过滤器 + 分布式锁 + 空值缓存 |
| 账务管理 | 账户管理、存入 / 取出 / 转账、流水查询、余额快照 |
| 日志演示 | 结构化业务日志样例（内存存储） |
| 健康检查 | Liveness / Readiness 探针 |

### 2.2 工程能力

- 全局严格参数校验、字段白名单、资源归属校验
- 安全响应头（CSP / nosniff / HSTS 等）、CORS 策略、限流
- 统一异常过滤、统一日志（含脱敏与链路追踪）
- 配置外部化、生产环境防护（强制密钥、关闭 synchronize）
- HTTPS 支持

### 2.3 量化

| 项 | 数值 |
| --- | --- |
| HTTP 接口 | 29 |
| 业务数据表 | 4 |
| 单元测试 | 8 个 suite / 88 个用例，全部通过 |
| 测试框架 | Jest 30 + ts-jest（ESM）+ Supertest |
| 文档 | 7 份（README + 6 份专题） |
| 本阶段修复的缺陷 | 20 项（见第 3 章） |

## 3. 关键问题清单

### 3.1 类型与编译类（6 项）

| # | 问题 | 处理 |
| --- | --- | --- |
| 1 | `'NX' does not exist in type 'Callback<"OK">'` | ioredis 不支持 `set(k, v, {NX, EX})` 选项对象，改为位置参数 `set(k, v, 'EX', s, 'NX')`；同时移除与 v5 自带类型冲突的 `@types/ioredis` |
| 2 | `Type '"id"[]' has no properties in common with 'FindOptionsSelect'` | TypeORM 的 `select` 是对象不是数组，改为 `select: { id: true }` |
| 3 | `number` 不能赋给 `HashableInput` | `bloom-filters` 只接受 `string \| ArrayBuffer \| Buffer`，调用处统一 `String(id)` |
| 4 | `Could not find a declaration file for module 'express'` | `@types/express` 缺失；改为使用 `node:http` 的 `IncomingMessage` / `ServerResponse`，与 express 类型解耦 |
| 5 | `TS2307 Cannot find module './xxx'` | ESM + `nodenext` 下相对导入必须带 `.js` 后缀（涉及 logger / health / orders 的 4 处 import） |
| 6 | pino-http 回调类型不兼容 | `autoLogging.ignore` / `genReqId` 的参数是 Node 原生类型，不是 express 的 `Request` |

### 3.2 数据库与运行时类（4 项）

| # | 问题 | 处理 |
| --- | --- | --- |
| 7 | `BLOB, TEXT ... column 'roles' can't have a default value` | `simple-array` 映射为 MySQL `text`，而 text 不支持默认值；改用 `varchar` + 自定义 transformer |
| 8 | `value.split is not a function` | TypeORM 在 insert 后的 hydration 会把**数组**传给 `transformer.from`，需兼容 `Array.isArray` |
| 9 | `Data too long for column 'password'` | scrypt 密文 `salt:hash` 约 161 字符，列长 100 → 255 |
| 10 | `DataTypeNotSupportedError: Data type "Object" in "Transaction.fromAccountId"` | 可空列的联合类型（`number \| null`）经反射为 `Object`，TypeORM 无法推断，必须显式声明 `type: 'int'`（字符串同理 `type: 'varchar'`） |

### 3.3 架构与设计类（3 项）

| # | 问题 | 处理 |
| --- | --- | --- |
| 11 | 商品写接口用 `Partial<Product>`，零运行时校验，存在 mass assignment 风险 | 引入 DTO + Service 层字段白名单 |
| 12 | 异常过滤器注册两次（`main.ts` 的 `useGlobalFilters` + `APP_FILTER`） | 异常被处理两次会导致 `ERR_HTTP_HEADERS_SENT`，只保留一处 |
| 13 | Bootstrap 日志未走 pino | Nest 的 `Logger` 实例绑定**创建时**的全局 logger，`new Logger()` 必须放在 `app.useLogger()` 之后 |

### 3.4 工程环境类（4 项）

| # | 问题 | 处理 |
| --- | --- | --- |
| 14 | devDependencies 全部缺失（229 个包） | `npm config get omit` 为 `dev`，改用 `npm install --include=dev` 补齐 |
| 15 | `npm run build` 失败于 safe-delete | `nest-cli.json` 的 `deleteOutDir: true` 触发目录清理被拦截，改为 `false` |
| 16 | 依赖安装审批多次超时 | 改用**零依赖实现**：安全响应头中间件等价 helmet 核心项、内存限流守卫等价 throttler |
| 17 | `EADDRINUSE: address already in use :::3000` | 残留 node 进程占用端口，需先结束进程再启动 |

### 3.5 流程与验证类（3 项）

| # | 问题 | 处理 |
| --- | --- | --- |
| 18 | `GET /orders/boom` 返回 200 而非 500 | `@Get(':id')` 声明在 `@Get('boom')` 之前，静态路径被参数路由吃掉；静态路由必须前置 |
| 19 | `GET /` 一直 404 | `AppController` 从未在 `AppModule` 的 `controllers` 中注册（既有遗留问题） |
| 20 | 编译通过 + 88 单测通过，但**启动即崩溃** | 第 10 项问题只有真实启动才暴露——单测 mock 了 Repository，不经过 TypeORM 元数据校验 |

## 4. 根因分析

归为四条主线：

1. **ESM + `nodenext` 的严格解析规则被低估**
   相对导入后缀、CJS/ESM 类型互操作、Jest 在 ESM 下的 mock 限制，共引发 6 个问题（#4 #5 #6 及测试迁移中的 2 个）。
   → 应固化为规范与模板，而非每次踩坑。

2. **TypeORM 元数据推断依赖运行时反射，对 TS 类型工具不透明**
   联合类型 → `Object`、`simple-array` → `text`、transformer 的调用时机，共 4 个问题（#7 #8 #10 及 password 长度）。
   → 实体定义应遵循"显式声明类型"的硬规则。

3. **验证层次不完整**
   编译通过 ≠ 元数据正确 ≠ 运行时可启动 ≠ 端到端可用。
   #10 与 #20 说明：**缺少真实启动这一层，缺陷会一路穿透到交付**。

4. **环境约束改变了技术选型**
   `omit=dev`、删除拦截、安装审批超时 → 直接导致依赖补齐方式调整与零依赖实现（#14 #15 #16）。

## 5. 做得好的地方

| 项 | 说明 |
| --- | --- |
| 安全语义内建 | 越权、幂等、注入防护都有对应测试断言（如"忽略 `roles` 越权字段"、"参数绑定查询"） |
| 账务一致性设计 | 事务 + 悲观写锁 + **按 id 升序加锁防死锁** + 乐观锁 + 幂等三层兜底 + 余额快照，是本次质量最高的一块 |
| 零依赖替代能力 | 依赖装不上时，用自研中间件/守卫落地安全头与限流，未因环境阻塞交付 |
| 文档体系化 | 7 份文档互相引用，覆盖业务、安全、日志、测试四个视角 |
| 端到端实测 | 账务模块完成"开户 → 存入 → 取出 → 查余额 → 查流水"真机验证，金额分毫不差（10000-3000=7000） |

## 6. 做得不足的地方

| 项 | 说明 | 影响 |
| --- | --- | --- |
| 验证不完整 | 多次因命令执行被跳过，部分改动仅通过静态诊断确认，未运行验证 | 缺陷可能延迟暴露 |
| 缺陷多次"自造自修" | 如异常过滤器重复注册、幂等前置检查缺失，是我在实现中引入后又修正 | 返工成本 |
| 文档与代码耦合过紧 | 测试框架迁移后 `TEST-CASES.md` 需整篇重写（手抄源码） | 维护成本高、易失真 |
| 测试覆盖不均衡 | 核心 service 87%~98%，但 controller / guard / dto 覆盖率为 0 | 安全关键组件（RolesGuard、RateLimitGuard）无回归保护 |
| 账务缺少集成测试 | 悲观锁、唯一索引的真实行为未在数据库层验证 | 并发正确性依赖人工推理 |
| 安全项有取舍 | CSRF 靠"不使用 Cookie"而非显式机制；限流为内存单实例 | 架构变更时会失效 |

## 7. 改进点与行动计划

| # | 改进项 | 优先级 | 具体动作 | 验收标准 |
| --- | --- | --- | --- | --- |
| 1 | **建立四层验证门禁** | 高 | `tsc --noEmit` → 单元测试 → **启动冒烟**（等待端口就绪 + 探活）→ 端到端脚本 | `npm run verify` 一条命令串起四层 |
| 2 | **固化 ESM 规范** | 高 | 在文档中列出：相对导入必须 `.js`；Jest 需 `--experimental-vm-modules` + `unstable_mockModule` + `moduleNameMapper` | 新增文件不再出现 TS2307 / mock 失效 |
| 3 | **实体定义硬规则** | 高 | 所有可空列、联合类型列显式声明 `type`；金额列统一走 transformer | 启动零 `DataTypeNotSupportedError` |
| 4 | **安全待办收口** | 高 | 删除/强制修改默认管理员；`CORS_ORIGINS`、`JWT_SECRET` 显式配置；限流迁移 Redis；引入 migration | 对照 `SECURITY-CHECKLIST.md` 勾选 |
| 5 | 覆盖率按模块设阈值 | 中 | CI 中只对核心 `*.service.ts` 设 `lines ≥ 90`，避免整体口径稀释 | CI 可阻断劣化 |
| 6 | 补 controller / guard / dto 测试 | 中 | 优先 `RolesGuard`、`RateLimitGuard`；DTO 用 `validate()` 直接断言 | 安全关键路径有回归保护 |
| 7 | 账务集成测试 | 中 | 用真实数据库验证并发转账后余额不为负、幂等键生效 | 悲观锁行为可验证 |
| 8 | 文档改为生成而非手抄 | 中 | `TEST-CASES.md` 用脚本从源码提取生成，减少失真 | 代码变更后一键刷新 |
| 9 | 启动自检脚本 | 中 | `npm run smoke`：启动 → 探活 → 关键接口冒烟 → 退出码 | 发布前必跑 |
| 10 | 补齐 refresh token 与账号禁用即时生效 | 低 | 引入刷新令牌与令牌版本号 | 禁用账号后旧令牌立即失效 |

## 8. 风险登记（遗留）

| 风险 | 等级 | 说明 | 缓解措施 |
| --- | --- | --- | --- |
| 默认管理员弱口令 | 高 | `admin/admin123` 自动创建 | 生产必须删除或强制改密 |
| 生产依赖 `synchronize` 关闭后无 migration | 高 | 表结构变更无版本化能力 | 尽快引入 migration |
| 限流为单实例内存实现 | 中 | 集群部署下限流失效 | 迁移到 Redis 计数器 |
| 令牌无刷新与吊销 | 中 | 禁用账号后令牌在 2h 内仍有效 | 引入令牌版本号 / 黑名单校验 |
| 账务未验证数据库层并发 | 中 | 悲观锁行为仅靠推理 | 补集成测试 |
| 订单模块数据在内存 | 低 | 重启即失，仅作演示 | 明确标注，不用于生产 |

## 9. 下一步建议

1. **先补验证能力，再扩功能**——第 7 章第 1、3、9 项成本低、收益高，能拦住本阶段 4 次"启动才暴露"类缺陷。
2. **安全待办按清单收口**——`SECURITY-CHECKLIST.md` 中 7 项"上线前必做"应在本阶段收尾。
3. **账务模块补集成测试**——它是资金相关模块，正确性要求高于其他模块。
4. **文档减负**——把手工维护的源码型文档改为生成，避免下次框架或实现变动时再次整篇重写。

## 10. 相关文档

- [FEATURES.md](./FEATURES.md) —— 功能与业务总览
- [SUMMARY.md](./SUMMARY.md) —— 阶段小结
- [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md) —— 接口安全自查清单
- [LOGGING.md](./LOGGING.md) —— 统一日志方案
- [TESTING.md](./TESTING.md) —— 单元测试与覆盖率说明
- [TEST-CASES.md](./TEST-CASES.md) —— 单元测试用例源码
