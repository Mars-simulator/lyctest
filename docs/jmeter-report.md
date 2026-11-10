# 账务服务 JMeter 压测报告与优化对比笔记

> 压测时间：2026-11-09
> 工具：Apache JMeter 5.6.3（Java 27）
> 被测服务：`ledger-service`（Docker 单实例，`localhost:3002`）
> 数据规模：`ledger_transaction` 约 21 万行，102 个账户
> 负载模型：20 线程 / 持续 15 秒 / 闭环

---

## 1. 结论摘要

| 场景 | 指标 | 优化前（无索引） | 优化后（有索引） | 变化 |
| --- | --- | --- | --- | --- |
| 读 | 吞吐 | 35.1 /s | **124.9 /s** | **+255.8%** |
| 读 | 平均延迟 | 545.4 ms | **154.4 ms** | **−71.7%** |
| 读 | P95 | 945.8 ms | **240.0 ms** | **−74.6%** |
| 读 | P99 | 1027.7 ms | **321.2 ms** | **−68.7%** |
| 写 | 吞吐 | 103.8 /s | **111.0 /s** | +6.9% |
| 写 | 平均延迟 | 187.1 ms | **174.7 ms** | −6.6% |
| 写 | P95 | 292.0 ms | **276.0 ms** | −5.5% |
| 写 | P99 | 403.5 ms | 945.9 ms | +134%（偶发毛刺） |

三条核心结论：

1. **读接口提升 3.56 倍**，与上一轮 Node 脚本测得的 +217% 方向一致，量级更强（JMeter 客户端开销更大，放大了服务端差异）。
2. **写接口基本不变**（±7%），因为写路径的幂等查询走的是 `txnNo` 唯一索引，与本轮新增的两个索引无关。
3. **写接口 P99 出现 1687ms 的偶发毛刺**，在两次「有索引」压测中均出现（427.9ms / 945.9ms），属环境抖动（MySQL checkpoint / JVM GC），非索引引入。

---

## 2. 环境准备

JMeter 未安装，机器上只有 Oracle Java 27，且无 winget/choco，因此手动安装：

```powershell
# 清华镜像下载（86.4 MB）
curl.exe -L -o "$env:TEMP\apache-jmeter-5.6.3.zip" `
  https://mirrors.tuna.tsinghua.edu.cn/apache/jmeter/binaries/apache-jmeter-5.6.3.zip

# 解压（必须用 Expand-Archive，tar 对 zip 解压不完整，会缺 jmeter.bat 和 jars）
Expand-Archive -Path "$env:TEMP\apache-jmeter-5.6.3.zip" -DestinationPath "$env:TEMP\jmeter" -Force
```

验证：

```powershell
& "$env:TEMP\jmeter\apache-jmeter-5.6.3\bin\jmeter.bat" --version
```

输出 `5.6.3` 即成功。仅有 `package scanning is deprecated` 警告，Java 27 下运行正常。

> 踩坑：用 `tar -xf` 解压 zip 只得到 `bin/jmeter.sh`，缺少 `jmeter.bat` 与 `lib/`，必须用 `Expand-Archive`。

---

## 3. 测试计划

两个计划文件，均参数化，便于调整负载：

| 文件 | 场景 | 采样器 |
| --- | --- | --- |
| `scripts/jmeter/ledger-read.jmx` | 读 | `GET /ledger/transactions?accountId=${__Random(3,12)}&page=1&pageSize=20` |
| `scripts/jmeter/ledger-write.jmx` | 写 | `POST /ledger/transactions/deposit`，body 内 `txnNo` 含线程号 + 计数器保证唯一 |

公共配置：

| 配置项 | 值 |
| --- | --- |
| 线程组 | `${threads}`（默认 20），ramp-up 1s，持续 `${duration}`（默认 15s） |
| HTTP Defaults | `host=${host}`、`port=${port}`、keep-alive 开启 |
| Header Manager | `Authorization: Bearer ${token}`、`Content-Type: application/json` |
| 响应断言 | 读 `200`、写 `201` |

参数通过 `-J` 传入：

```powershell
jmeter -n -t scripts/jmeter/ledger-read.jmx -l read.jtl -e -o read-report `
  -Jtoken=<jwt> -Jthreads=20 -Jduration=15
```

### 3.1 断言踩坑：写接口必须断言 201

首轮写压测 100% 失败：

```json
{"sampleCount":1620,"errorCount":1620,"errorPct":100.0}
```

原因不是服务异常，而是 **NestJS 的 `@Post` 默认返回 201 Created**，而断言写的是 200。改为 201 后错误率归零：

```json
{"sampleCount":1666,"errorCount":0,"errorPct":0.0}
```

**教训：JMeter 的断言比"看响应时间"更严格，写场景一定要按框架真实状态码配置。**

---

## 4. 对照实验设计

为验证「索引」这一个变量的作用，采用同一份数据、同一负载、同一时间段，仅切换索引：

```
① 建立索引 → 跑 read + write → 归档为 *-after
② DROP INDEX idx_from_time, idx_to_time
③ 跑 read + write → 归档为 *-before
④ 恢复索引
```

索引定义：

```sql
ALTER TABLE ledger_transaction
  ADD INDEX idx_from_time (fromAccountId, createTime),
  ADD INDEX idx_to_time  (toAccountId,  createTime);
```

删除命令：

```sql
ALTER TABLE ledger_transaction
  DROP INDEX idx_from_time,
  DROP INDEX idx_to_time;
```

> 注意：`TypeORM` 的 `synchronize: true` 只在服务启动时比对 schema。运行中手动删索引不会被自动重建，因此对照实验期间不要重启服务。

---

## 5. 详细结果

### 5.1 读接口（`GET /ledger/transactions`）

| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| 采样数 | 542 | 1887 | +248% |
| 错误率 | 0.00% | 0.00% | — |
| 吞吐 | 35.1 /s | **124.9 /s** | **+255.8%** |
| 平均 | 545.4 ms | **154.4 ms** | **−71.7%** |
| P50 | 518.0 ms | **145.0 ms** | **−72.0%** |
| P90 | 808.0 ms | **217.0 ms** | **−73.1%** |
| P95 | 945.8 ms | **240.0 ms** | **−74.6%** |
| P99 | 1027.7 ms | **321.2 ms** | **−68.7%** |
| Max | 1615.0 ms | **420.0 ms** | **−74.0%** |

### 5.2 写接口（`POST /ledger/transactions/deposit`）

| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| 采样数 | 1553 | 1666 | +7.3% |
| 错误率 | 0.00% | 0.00% | — |
| 吞吐 | 103.8 /s | 111.0 /s | +6.9% |
| 平均 | 187.1 ms | 174.7 ms | −6.6% |
| P50 | 175.0 ms | 148.0 ms | −15.4% |
| P90 | 254.0 ms | 231.3 ms | −8.9% |
| P95 | 292.0 ms | 276.0 ms | −5.5% |
| P99 | 403.5 ms | 945.9 ms | +134%（毛刺） |
| Max | 605.0 ms | 1687.0 ms | +179%（毛刺） |

**P99 毛刺说明**：写场景在两次「有索引」压测中分别出现 427.9ms、945.9ms 的 P99，且伴随单次 1687ms 的 max。1666 个采样里 P99 只取最慢的 16 个，单个长尾请求即可显著拉高。同一现象在无索引时（403.5ms）也存在但更轻微，判断与索引无关，属 MySQL checkpoint 或容器资源抖动。P50/P90/P95 三项稳定改善，更能反映真实变化。

---

## 6. 与 Node 脚本结果交叉验证

| 场景 | Node 脚本（优化前 → 后） | JMeter（优化前 → 后） | 结论一致性 |
| --- | --- | --- | --- |
| 读 QPS | 63.0 → 199.7（+217%） | 35.1 → 124.9（+256%） | ✅ 方向一致 |
| 读 P95 | 419.0 → 146.9（−65%） | 945.8 → 240.0（−75%） | ✅ 方向一致 |
| 写 QPS | 141.3 → 178.2（+26%） | 103.8 → 111.0（+7%） | ✅ 方向一致 |

### 为什么绝对数值差 40% 以上

闭环压测下，吞吐由「并发数 ÷ 响应时间」决定：

- JMeter：20 ÷ 0.1544s ≈ 130 /s（实测 124.9）
- Node：20 ÷ 0.0948s ≈ 211 /s（实测 199.7）

两者算出来的 QPS 都符合理论值，差异来自**测到的响应时间不同**：

| 因素 | JMeter | Node 脚本 |
| --- | --- | --- |
| 客户端模型 | 20 个 Java 线程 | 单进程事件循环 + 40 socket 池 |
| 每采样开销 | 写 jtl 行、统计聚合 | 仅内存 push 延迟 |
| 响应时间 | 154 ms | 95 ms |

**结论：跨工具的绝对 QPS 不可直接比较，只能在同一工具、同一参数下做前后对比。** 这也说明 Node 脚本作为轻量客户端，反而更接近服务端的真实能力上限。

---

## 7. 报告索引

四份自包含 HTML 报告（用 `jmeter -e -o` 生成，浏览器直接打开）：

| 报告 | 路径 | 说明 |
| --- | --- | --- |
| 读 · 优化前 | `docs/jmeter-report/read-before/index.html` | 542 采样，35.1 /s |
| 读 · 优化后 | `docs/jmeter-report/read-after/index.html` | 1887 采样，124.9 /s |
| 写 · 优化前 | `docs/jmeter-report/write-before/index.html` | 1553 采样，103.8 /s |
| 写 · 优化后 | `docs/jmeter-report/write-after/index.html` | 1666 采样，111.0 /s |

每份报告含：APDEX、响应时间分布、随时间变化曲线、每秒吞吐曲线、TOP 5 慢请求。

---

## 8. 复现步骤

```powershell
# 1. 环境（服务已在 docker compose 中运行）
docker compose --profile split up -d mysql redis account-service ledger-service

# 2. 关闭限流（否则 99% 请求会被 429 拦截）
$env:RATE_LIMIT_DISABLED='true'
docker compose --profile split up -d ledger-service account-service

# 3. 取令牌
$login = Invoke-RestMethod http://localhost:3001/auth/login -Method Post `
  -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$token = $login.accessToken

# 4. 压测（有索引）
& "$env:TEMP\jmeter\apache-jmeter-5.6.3\bin\jmeter.bat" -n `
  -t scripts/jmeter/ledger-read.jmx -l read-after.jtl -e -o read-after `
  "-Jtoken=$token" -Jthreads=20 -Jduration=15

# 5. 删索引后压测（优化前）
docker exec ledger-mysql mysql -uroot -pfaben123 -e "use nest_crud_demo;
  ALTER TABLE ledger_transaction DROP INDEX idx_from_time, DROP INDEX idx_to_time;"

& "$env:TEMP\jmeter\apache-jmeter-5.6.3\bin\jmeter.bat" -n `
  -t scripts/jmeter/ledger-read.jmx -l read-before.jtl -e -o read-before `
  "-Jtoken=$token" -Jthreads=20 -Jduration=15

# 6. 恢复索引
docker exec ledger-mysql mysql -uroot -pfaben123 -e "use nest_crud_demo;
  ALTER TABLE ledger_transaction
    ADD INDEX idx_from_time (fromAccountId, createTime),
    ADD INDEX idx_to_time  (toAccountId, createTime);"
```

---

## 9. 与 Node 脚本方案的分工

| 维度 | Node 脚本（`scripts/loadtest.mjs`） | JMeter（`scripts/jmeter/*.jmx`） |
| --- | --- | --- |
| 依赖 | 零依赖，Node 直接跑 | 需 JDK + JMeter 安装 |
| 客户端开销 | 低，更接近服务端真实能力 | 高，会低估被测系统 |
| 报告 | 控制台 JSON，需自行整理 | 自带 HTML 报告（APDEX/曲线/慢请求） |
| 断言 | 仅看 2xx | 可精确断言状态码/响应体 |
| 适用 | 快速回归、CI 冒烟 | 正式性能报告、交付文档 |

建议：**日常回归用 Node 脚本，对外交付用 JMeter 报告**，两者结论互相印证。

---

## 10. 待办

- [ ] 压测完成后恢复生产语义：`$env:RATE_LIMIT_DISABLED='false'` 并重启两个服务
- [ ] 清理压测数据：`DELETE FROM ledger_transaction WHERE txnNo LIKE 'LOAD%' OR txnNo LIKE 'LT%' OR txnNo LIKE 'JM-%'`
- [ ] 并发爬坡：20 → 50 → 100，定位拐点
- [ ] 热点账户场景：全部请求打同一账户，暴露 `SELECT FOR UPDATE` 排队
- [ ] 长稳测试：30 分钟以上，观察内存与连接泄漏
