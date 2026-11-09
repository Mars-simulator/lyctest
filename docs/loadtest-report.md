# 账务服务接口压测报告与优化对比

> 压测时间：2026-11-09
> 被测服务：`ledger-service`（`APP_ROLE=ledger`）
> 数据规模：`ledger_transaction` 20 万行 / 102 个账户
> 结论：**读接口 QPS 提升 217%，P95 延迟下降 65%**；连接池调大是无效优化。

---

## 1. 结论摘要

| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| 读 QPS（`GET /ledger/transactions`） | 63.0 | **199.7** | **+217%** |
| 读 P95 延迟 | 419.0 ms | **146.9 ms** | **−65%** |
| 读 P99 延迟 | 494.7 ms | **176.5 ms** | **−64%** |
| 写 QPS（`POST /deposit`） | 141.3 | **178.2** | **+26%** |
| 写 P95 延迟 | 243.2 ms | **156.9 ms** | **−35%** |
| 写 P99 延迟 | 761.9 ms | **289.3 ms** | **−62%** |

核心结论三条：

1. **读接口的瓶颈是索引缺失，不是 CPU 或连接池**。`fromAccountId` / `toAccountId` 无索引，导致每次分页都要全表 `COUNT(*)`。
2. **连接池不是越大越好**。并发 20 的场景下，池 10 反而比池 30 快 17%。
3. **压测前必须先处理限流**，否则 99.5% 的请求会变成 429。

---

## 2. 压测环境

| 项 | 配置 |
| --- | --- |
| 宿主机 | Windows 11 Enterprise LTSC 2024 |
| 容器运行时 | Docker Desktop 29.9.1 |
| 编排 | `docker compose --profile split` |
| 服务实例 | `ledger-service` × 1、`account-service` × 1 |
| 数据库 | MySQL 8.0（容器内 3306，宿主 3307） |
| 缓存 | Redis 7-alpine |
| Node | 24-alpine |

启动命令：

```powershell
docker compose --profile split up -d mysql redis account-service ledger-service
```

健康校验：

```powershell
Invoke-RestMethod http://localhost:3002/health   # {"status":"ok",...}
Invoke-RestMethod http://localhost:3001/health
```

---

## 3. 数据准备

### 3.1 账户

批量生成 100 个压测账户（`id` 3~102），余额 100 万元，归属 `ownerId=1`：

```sql
SET SESSION cte_max_recursion_depth = 10000;
INSERT INTO ledger_account
  (id, accountNo, name, type, currency, balance, status, ownerId, version, createTime, updateTime)
WITH RECURSIVE seq AS (SELECT 3 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 102)
SELECT n, CONCAT('LOADTEST', LPAD(n, 6, '0')), CONCAT('loadtest-account-', n),
       'asset', 'CNY', 100000000, 1, 1, 1, NOW(), NOW()
FROM seq;
```

### 3.2 流水

插入 20 万行，按账户均匀散列，**60% 为存入（仅 `toAccountId`）、40% 为转账（`from` + `to` 都有值）**，以便同时压到 `OR` 的两个分支：

```sql
SET SESSION cte_max_recursion_depth = 300000;
INSERT INTO ledger_transaction
  (txnNo, type, amount, fromAccountId, toAccountId,
   fromBalanceAfter, toBalanceAfter, status, remark, operatorId, createTime)
WITH RECURSIVE seq AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 200000)
SELECT CONCAT('LOAD', LPAD(n, 10, '0')),
       IF(MOD(n, 10) < 6, 'deposit', 'transfer'),
       100,
       IF(MOD(n, 10) < 6, NULL, 3 + MOD(n + 7, 100)),
       3 + MOD(n, 100),
       IF(MOD(n, 10) < 6, NULL, 100),
       100,
       'success', NULL, 1,
       NOW() - INTERVAL (n DIV 1000) MINUTE
FROM seq;
```

最终 200,002 行（含历史 2 行），每个账户约 2000 条。

---

## 4. 压测方案

### 4.1 工具

自研 `scripts/loadtest.mjs`，**零依赖**（仅用 Node 内置 `http`），避免引入 k6 / autocannon：

- 固定并发 worker 循环，固定时长
- `http.Agent({ keepAlive: true })` 复用连接，贴近真实客户端
- 输出 QPS、成功/失败数、错误率、P50/P95/P99/Max

### 4.2 场景

| 场景 | 接口 | 说明 |
| --- | --- | --- |
| read | `GET /ledger/transactions?accountId=X&page=1&pageSize=20` | 走 `getManyAndCount()`，含一次全表 `COUNT(*)` |
| write | `POST /ledger/transactions/deposit` | 幂等检查 → 跨服务校验 → 悲观锁 → 落库 |

### 4.3 参数

```
并发 20 / 持续 15 秒 / 10 个账户轮转（id 3~12） / admin 令牌
```

命令：

```powershell
$login = Invoke-RestMethod http://localhost:3001/auth/login -Method Post `
  -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'

node scripts/loadtest.mjs --mode=read  --c=20 --d=15 --token=$($login.accessToken) --accounts=3,4,5,6,7,8,9,10,11,12
node scripts/loadtest.mjs --mode=write --c=20 --d=15 --token=$($login.accessToken) --accounts=3,4,5,6,7,8,9,10,11,12
```

### 4.4 前置：关闭限流（否则压测无效）

首次压测直接被打回，99.52% 为 429：

```json
{
  "total": 20656, "ok": 100, "fail": 20556,
  "error_rate": "99.52%",
  "top_errors": [["HTTP 429: 请求过于频繁，请稍后再试", 20556]]
}
```

`RateLimitGuard` 是硬编码的「单 IP 单接口 100 次/60 秒」，必须加开关才能压：

```ts
canActivate(context: ExecutionContext): boolean {
  // 压测 / 内网联调可临时关闭；生产环境必须保持开启
  if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
  ...
}
```

压测时启动参数：

```powershell
$env:RATE_LIMIT_DISABLED='true'
docker compose --profile split up -d ledger-service account-service
```

> 注意：`write` 场景还额外受 `@RateLimit({ limit: 30 })` 限制，同样被该开关覆盖。

---

## 5. 基线结果

### 读接口（无索引）

```json
{
  "mode": "read", "concurrency": 20, "duration_s": 15.3,
  "total": 961, "ok": 961, "fail": 0,
  "qps": 63.0, "error_rate": "0.00%",
  "p50_ms": 302.1, "p95_ms": 419.0, "p99_ms": 494.7, "max_ms": 659.7
}
```

### 写接口（无索引）

```json
{
  "mode": "write", "concurrency": 20, "duration_s": 15.1,
  "total": 2132, "ok": 2132, "fail": 0,
  "qps": 141.3, "error_rate": "0.00%",
  "p50_ms": 117.0, "p95_ms": 243.2, "p99_ms": 761.9, "max_ms": 1081.6
}
```

**异常信号**：读接口（63 QPS）比写接口（141 QPS）还慢一半——读操作本应远快于写，说明读路径存在严重问题。

---

## 6. 瓶颈定位

### 6.1 执行计划

```sql
EXPLAIN SELECT COUNT(*) FROM ledger_transaction
WHERE (fromAccountId = 5 OR toAccountId = 5);
```

```
type: ALL
possible_keys: NULL
key: NULL
rows: 199122
Extra: Using where
```

**全表扫 19.9 万行，无任何可用索引。**

### 6.2 根因

实体上 `txnNo`（唯一）、`operatorId`、`createTime` 都建了索引，唯独查询主维度 `fromAccountId` / `toAccountId` 没有：

```ts
@Column({ type: 'int', nullable: true, comment: '转出账户 id（为空表示外部）' })
fromAccountId: number | null;

@Column({ type: 'int', nullable: true, comment: '转入账户 id（为空表示外部）' })
toAccountId: number | null;
```

而分页查询每次都要跑两遍：

```ts
qb.andWhere('(txn.fromAccountId = :aid OR txn.toAccountId = :aid)', { aid: query.accountId });
...
const [list, total] = await qb.orderBy('txn.id', 'DESC').skip(...).take(...).getManyAndCount();
```

- 列表查询：优化器退化为 `PRIMARY` 反向扫描，靠 `LIMIT 20` 提前收敛，勉强可接受
- **`COUNT(*)`：必须全表扫，这是 300ms P50 的主要来源**

---

## 7. 优化措施

### 7.1 复合索引（核心）

```sql
ALTER TABLE ledger_transaction
  ADD INDEX idx_from_time (fromAccountId, createTime),
  ADD INDEX idx_to_time  (toAccountId,  createTime);
```

同时写进实体，防止 `synchronize: true` 在重启时把它当"多余索引"删除：

```ts
@Entity('ledger_transaction')
// 流水查询固定按「账户 + 时间倒序」过滤，复合索引可同时覆盖
// WHERE 与 ORDER BY，避免 fromAccountId/toAccountId 无索引导致的全表扫描
@Index('idx_from_time', ['fromAccountId', 'createTime'])
@Index('idx_to_time', ['toAccountId', 'createTime'])
export class Transaction {
```

> 加索引后重启服务并复查 `SHOW INDEX`，确认 `synchronize` 未删除这两个索引。

### 7.2 连接池可配置（保留默认 10）

```ts
extra: {
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
},
```

### 7.3 日志降级

压测期间 `LOG_LEVEL=warn`，减少 stdout 写入。对吞吐影响不显著，但能降低 I/O 干扰。

---

## 8. 优化前后对比

### 8.1 读接口

| 阶段 | QPS | P50 | P95 | P99 | 错误率 |
| --- | --- | --- | --- | --- | --- |
| 基线（无索引） | 63.0 | 302.1 ms | 419.0 ms | 494.7 ms | 0% |
| ① + 复合索引 | 205.5 | 92.5 ms | 145.1 ms | 170.9 ms | 0% |
| ② + 连接池 30 + 日志 warn | 166.2 | 110.7 ms | 211.0 ms | 249.6 ms | 0% |
| ③ 回退连接池 10 + 日志 warn（最终） | **199.7** | **94.8 ms** | **146.9 ms** | **176.5 ms** | 0% |

### 8.2 写接口

| 阶段 | QPS | P50 | P95 | P99 | 错误率 |
| --- | --- | --- | --- | --- | --- |
| 基线 | 141.3 | 117.0 ms | 243.2 ms | 761.9 ms | 0% |
| ① + 复合索引 | 187.2 | 101.8 ms | 140.6 ms | 193.0 ms | 0% |
| ③ 最终配置 | 178.2 | 103.5 ms | 156.9 ms | 289.3 ms | 0% |

> 写接口最终值略低于阶段①，属正常波动：压测过程中持续写入约 5000 行，数据量与 Buffer Pool 命中率在变化。三次写压测的 P99 在 193~289ms 间浮动。

### 8.3 执行计划变化

| | 优化前 | 优化后 |
| --- | --- | --- |
| type | `ALL` | `index_merge` |
| possible_keys | `NULL` | `idx_from_time, idx_to_time` |
| rows | 199122 | **2779** |
| Extra | `Using where` | `Using sort_union(idx_from_time, idx_to_time); Using where` |

**扫描行数减少 98.6%**，这是读接口提升 3.2 倍的直接原因。

---

## 9. 归因分析

### ✅ 有效：复合索引

收益来自两处：

1. `COUNT(*)` 从全表扫（19.9 万行）变为 `index_merge` 扫描（2779 行）
2. 列表查询可用索引收敛，不再依赖主键反向扫描碰运气

索引开销：写路径多维护两棵 B+ 树，但写吞吐仍净增 26%，说明查询收益远大于写入成本。

### ❌ 无效（负向）：连接池 10 → 30

| 连接池 | 读 QPS |
| --- | --- |
| 10 | 199.7 |
| 30 | 166.2 |

**池 30 反而慢 17%。**

原因分析：单次查询约 90ms，20 并发下 10 个连接已基本饱和（理论排队时间 ≈ 90ms × 20/10 = 180ms，与实测 P95 146ms 吻合）。扩到 30 后，MySQL 侧并发连接数增加，上下文切换与内部锁竞争上升，而排队瓶颈并不在连接数上。

**结论：连接池大小应按照「实际并发 × 单请求耗时」反推，而不是照着并发数配。**

### ⚪ 中性：日志降级

单独无法量化（与索引提升叠加后差异在波动区间内），保留作为压测环境的标准配置。

---

## 10. 代码变更清单

| 文件 | 变更 |
| --- | --- |
| `scripts/loadtest.mjs` | 新增：零依赖压测脚本 |
| `src/common/security/rate-limit.guard.ts` | 新增 `RATE_LIMIT_DISABLED` 开关 |
| `src/ledger/entities/transaction.entity.ts` | 新增 `idx_from_time` / `idx_to_time` 索引声明 |
| `src/config/typeorm-options.ts` | 连接池大小可配（`DB_POOL_SIZE`，默认 10） |
| `docker-compose.yml` | `account-service` / `ledger-service` 透传 `RATE_LIMIT_DISABLED`、`DB_POOL_SIZE` |

---

## 11. 复现步骤

```powershell
# 1. 启动环境
docker compose --profile split up -d mysql redis account-service ledger-service

# 2. 灌数据（见第 3 节两条 SQL）

# 3. 关闭限流后重启
$env:RATE_LIMIT_DISABLED='true'
$env:LOG_LEVEL='warn'
docker compose --profile split up -d ledger-service account-service

# 4. 取令牌并压测
$login = Invoke-RestMethod http://localhost:3001/auth/login -Method Post `
  -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
node scripts/loadtest.mjs --mode=read  --c=20 --d=15 --token=$($login.accessToken) --accounts=3,4,5,6,7,8,9,10,11,12

# 5. 对照实验：删索引后重测
#    DROP INDEX idx_from_time ON ledger_transaction;
#    DROP INDEX idx_to_time   ON ledger_transaction;
```

---

## 12. 遗留事项与后续计划

### 必须处理

**当前容器仍以 `RATE_LIMIT_DISABLED=true` 运行**，验证完成后需恢复：

```powershell
$env:RATE_LIMIT_DISABLED='false'
docker compose --profile split up -d ledger-service account-service
```

压测数据清理：

```sql
DELETE FROM ledger_transaction WHERE txnNo LIKE 'LOAD%' OR txnNo LIKE 'LT%';
DELETE FROM ledger_account    WHERE accountNo LIKE 'LOADTEST%';
```

### 后续压测计划

| 优先级 | 项目 | 目的 |
| --- | --- | --- |
| P0 | 并发爬坡 20 → 50 → 100 | 找拐点，当前 20 并发远未触顶 |
| P0 | 热点账户（全部打同一账户） | 暴露 `SELECT FOR UPDATE` 行锁排队 |
| P1 | 30 分钟长稳 | 观察内存与连接泄漏 |
| P1 | K8s 双副本 + CPU limit 1 | 验证水平扩展线性度 |
| P2 | `findPage` 改游标分页 | 消除 `offset` 深分页 |
| P2 | `COUNT(*)` 改近似值或缓存 | 彻底去掉分页计数开销 |

### 与分库分表设计的衔接

本报告的索引结论与「按 `accountId` 分片 + 双分录模型」的设计结论一致：索引只能让单表多撑一个量级，真正的结构性问题（`OR` 查询无法拆分、`COUNT(*)` 必然全表扫）需要靠「双分录模型 + 按 `accountId` 分片」根治。

---

## 附：压测原始输出

<details>
<summary>读接口 - 基线</summary>

```json
{"mode":"read","concurrency":20,"duration_s":15.3,"total":961,"ok":961,"fail":0,
 "qps":63,"error_rate":"0.00%","p50_ms":302.1,"p95_ms":419,"p99_ms":494.7,"max_ms":659.7}
```
</details>

<details>
<summary>读接口 - 加索引后</summary>

```json
{"mode":"read","concurrency":20,"duration_s":15.1,"total":3105,"ok":3105,"fail":0,
 "qps":205.5,"error_rate":"0.00%","p50_ms":92.5,"p95_ms":145.1,"p99_ms":170.9,"max_ms":260.4}
```
</details>

<details>
<summary>读接口 - 连接池 30</summary>

```json
{"mode":"read","concurrency":20,"duration_s":15.1,"total":2504,"ok":2504,"fail":0,
 "qps":166.2,"error_rate":"0.00%","p50_ms":110.7,"p95_ms":211,"p99_ms":249.6,"max_ms":404.1}
```
</details>

<details>
<summary>读接口 - 连接池 10（最终）</summary>

```json
{"mode":"read","concurrency":20,"duration_s":15.1,"total":3009,"ok":3009,"fail":0,
 "qps":199.7,"error_rate":"0.00%","p50_ms":94.8,"p95_ms":146.9,"p99_ms":176.5,"max_ms":399.3}
```
</details>

<details>
<summary>写接口 - 基线</summary>

```json
{"mode":"write","concurrency":20,"duration_s":15.1,"total":2132,"ok":2132,"fail":0,
 "qps":141.3,"error_rate":"0.00%","p50_ms":117,"p95_ms":243.2,"p99_ms":761.9,"max_ms":1081.6}
```
</details>

<details>
<summary>写接口 - 加索引后</summary>

```json
{"mode":"write","concurrency":20,"duration_s":15.1,"total":2822,"ok":2822,"fail":0,
 "qps":187.2,"error_rate":"0.00%","p50_ms":101.8,"p95_ms":140.6,"p99_ms":193,"max_ms":408.9}
```
</details>

<details>
<summary>写接口 - 最终配置</summary>

```json
{"mode":"write","concurrency":20,"duration_s":15.1,"total":2686,"ok":2686,"fail":0,
 "qps":178.2,"error_rate":"0.00%","p50_ms":103.5,"p95_ms":156.9,"p99_ms":289.3,"max_ms":715.1}
```
</details>
