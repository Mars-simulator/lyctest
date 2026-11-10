# Elasticsearch 检索练习笔记（账务流水）

> 环境：Elasticsearch 8.15.3 单节点（Docker）
> 数据：从 MySQL `ledger_transaction` 采样导入 20,000 条
> 目标：用真实业务数据把 ES 的查询、聚合、分页能力跑一遍，记录可用语句与踩坑

---

## 1. 起一个本地 ES

### 1.1 镜像拉取

```powershell
docker pull docker.m.daocloud.io/library/elasticsearch:8.15.3
```

### 1.2 启动单节点

```powershell
docker run -d --name ledger-es -p 9200:9200 `
  -e "discovery.type=single-node" `
  -e "xpack.security.enabled=false" `
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" `
  docker.m.daocloud.io/library/elasticsearch:8.15.3
```

| 参数 | 作用 |
| --- | --- |
| `discovery.type=single-node` | 免去集群发现配置 |
| `xpack.security.enabled=false` | 本地练习关掉 TLS/账号密码，否则需要证书 |
| `ES_JAVA_OPTS=-Xms512m -Xmx512m` | 限制堆内存，Docker 7.6G 环境下够用 |

验证：

```powershell
Invoke-RestMethod http://localhost:9200
```

```
ES_VERSION=8.15.3
CLUSTER=docker-cluster
TAGLINE=You Know, for Search
```

---

## 2. 数据建模

### 2.1 Mapping

```json
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": {
    "properties": {
      "id":              { "type": "long" },
      "txnNo":           { "type": "keyword" },
      "type":            { "type": "keyword" },
      "amount":          { "type": "long" },
      "fromAccountId":   { "type": "integer" },
      "toAccountId":     { "type": "integer" },
      "fromBalanceAfter":{ "type": "long" },
      "toBalanceAfter":  { "type": "long" },
      "status":          { "type": "keyword" },
      "remark": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
      },
      "operatorId":      { "type": "integer" },
      "createTime":      { "type": "date" }
    }
  }
}
```

### 2.2 为什么这样分类型

| 字段 | 类型 | 理由 |
| --- | --- | --- |
| `txnNo` | `keyword` | 流水号是精确匹配/前缀匹配，不需要分词 |
| `type` / `status` | `keyword` | 枚举值，`term` 查询 + 聚合都要求 keyword |
| `amount` | `long` | 金额单位是分，整数足够，且便于 `range` 与 `stats` 聚合 |
| `remark` | `text` + `.keyword` 子字段 | 既要全文检索，又要能按备注精确聚合 |
| `createTime` | `date` | 支持范围查询与 `date_histogram` |

> 如果 `type` 建成 `text`，`term` 查询会因为分词后大小写归一而失配（例如 `Transfer` 被索引成 `transfer`），聚合也会报 `Fielddata is disabled`。

---

## 3. 数据导入

脚本：`scripts/es-import.mjs`（mysql2 读 MySQL → 组装 NDJSON → `_bulk` 写入）

```powershell
node scripts/es-import.mjs
```

```
索引已重建: ledger_transaction
导入完成: indexed=20000, failed=0
索引当前文档数: 20000
```

### 3.1 采样坑：周期性偏差

第一版用 `WHERE id % 10 = 0` 采样，结果：

```
BY_TYPE=transfer:20000     ← 全是转账，没有 deposit
AMOUNT min/max/avg=100/100/100
UNIQUE_ACCOUNTS=10         ← 100 个账户只剩 10 个
```

原因：造数脚本里 `type = IF(MOD(n,10) < 6, 'deposit', 'transfer')`、`toAccountId = 3 + MOD(n,100)`，而 `id` 与 `n` 线性相关。用 10 的倍数采样，恰好锁死在同一个相位上。

改为 `id % 7 = 3`（7 与 10 互质）后：

```
BY_TYPE=deposit:11999, transfer:8001
UNIQUE_TO_ACCOUNTS=100
```

**教训：按自增 ID 做等距采样前，先确认业务字段是否也按这个周期分布。**

### 3.2 数据概览

| 维度 | 值 |
| --- | --- |
| 文档数 | 20,000 |
| deposit | 11,999（60%） |
| transfer | 8,001（40%） |
| 账户数 | 100 |
| 金额 | 恒为 100 分 |
| 时间范围 | 2026-11-08T22:50 ~ 2026-11-09T01:09 |
| 按小时分布 | 1429 / 8571 / 8571 / 1429 |

> 金额恒定的原因：造数时 amount 写死 100。这让 `range` 金额查询无法体现区分度，练习中改用了时间范围和账户维度。真实环境应保证金额分布有梯度。

---

## 4. 查询练习

### 4.1 基础查询

```json
// 1. 全量 + 排序
{ "size": 2, "query": { "match_all": {} }, "sort": [{ "id": "asc" }] }
```

```json
// 2. term：精确匹配枚举
{ "query": { "term": { "type": "transfer" } } }
```

> 实测：**8,001 条**

```json
// 3. exists：转出账户非空（等价于「转账」）
{ "query": { "exists": { "field": "fromAccountId" } } }
```

> 实测：**8,001 条**（与 transfer 数量一致，业务上自洽）

```json
// 4. range：时间区间（左闭右开）
{
  "query": {
    "range": {
      "createTime": { "gte": "2026-11-08T23:00:00Z", "lt": "2026-11-09T00:00:00Z" }
    }
  }
}
```

> 实测：**8,571 条**，与 `date_histogram` 的 23 点桶完全吻合

```json
// 5. prefix：流水号前缀
{ "query": { "prefix": { "txnNo": "LOAD0000000" } } }
```

> 实测：**143 条**

```json
// 6. wildcard：通配（性能差，仅作兜底）
{ "query": { "wildcard": { "txnNo": "LOAD000000*" } } }
```

> 实测：**1,429 条**

| 查询 | 适用场景 | 注意 |
| --- | --- | --- |
| `term` | keyword 精确匹配 | 对 `text` 字段用 `term` 大概率查不到 |
| `terms` | 多值 IN | 值多时用 `terms` + `lookup` 避免请求体膨胀 |
| `range` | 时间/金额区间 | 日期用 ISO8601 或 epoch_millis |
| `prefix` | 编号前缀 | 比 `wildcard` 快，走 FST |
| `wildcard` | 模糊兜底 | 前缀通配尚可，`*中间*` 会全扫 |

### 4.2 复合查询：bool

业务场景：查「账户 18 在 23 点之后的转账流水」。

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type": "transfer" } },
        {
          "bool": {
            "should": [
              { "term": { "fromAccountId": 18 } },
              { "term": { "toAccountId": 18 } }
            ],
            "minimum_should_match": 1
          }
        }
      ]
    }
  }
}
```

> 实测：**200 条**

关键点：

| 子句 | 是否算分 | 是否缓存 | 用途 |
| --- | --- | --- | --- |
| `must` | 是 | 否 | 需要相关性排序的全文条件 |
| `filter` | 否 | **是** | 枚举、范围、权限过滤——**优先用 filter** |
| `should` | 是 | 否 | 满足其一即可，需配 `minimum_should_match` |
| `must_not` | 否 | 是 | 排除，但不影响评分 |

`fromAccountId = ? OR toAccountId = ?` 这种「同一逻辑维度两个字段」的查询，在 ES 里就是 `should` + `minimum_should_match: 1`；在 MySQL 里是 `OR`（容易导致索引失效），这是 ES 相对顺手的地方。

### 4.3 全文检索与高亮

先给数据补上备注（原表 remark 全为 NULL）：

```json
{
  "script": {
    "lang": "painless",
    "source": "if (ctx._source.type == 'transfer') { ctx._source.remark = '转账-月度对账调整' } else { ctx._source.remark = '入金-客户充值' }"
  },
  "query": { "match_all": {} }
}
```

```json
{
  "size": 2,
  "_source": ["txnNo", "type", "remark", "createTime"],
  "query": { "match": { "remark": "对账" } },
  "highlight": {
    "pre_tags": ["<em>"],
    "post_tags": ["</em>"],
    "fields": { "remark": {} }
  }
}
```

> 实测：**8,001 条**，高亮结果：
>
> ```
> txnNo=LOAD0000000008 | highlight=转<em>账</em>-月度<em>对</em><em>账</em>调整
> ```

**注意这是问题不是特性**：`standard` 分词器把中文按单字切分，所以「对账」被拆成「对」+「账」两个词元，高亮也是分开的。生产环境的中文检索需要安装 IK 分词器并指定 `analyzer: ik_max_word`。

### 4.4 聚合

```json
// 按类型分组，并在组内做金额统计与 TOP 账户
{
  "size": 0,
  "aggs": {
    "by_type": {
      "terms": { "field": "type" },
      "aggs": {
        "avg_amount": { "avg": { "field": "amount" } },
        "top_account": { "terms": { "field": "toAccountId", "size": 3 } }
      }
    }
  }
}
```

> 实测：`deposit:11999, transfer:8001`

```json
// TOP 5 收款账户 + 组内金额求和
{
  "size": 0,
  "aggs": {
    "top_to": {
      "terms": { "field": "toAccountId", "size": 5 },
      "aggs": { "amount_sum": { "sum": { "field": "amount" } } }
    }
  }
}
```

> 实测：`9:201(sum=20100), 16:201(sum=20100), 23:201(sum=20100), 30:201(sum=20100), 37:201(sum=20100)`

```json
// 按小时直方图
{
  "size": 0,
  "aggs": {
    "by_hour": { "date_histogram": { "field": "createTime", "calendar_interval": "hour" } }
  }
}
```

> 实测：`22点:1429 | 23点:8571 | 00点:8571 | 01点:1429`

```json
// 基数与分位数
{
  "size": 0,
  "aggs": {
    "uniq_to": { "cardinality": { "field": "toAccountId" } },
    "amt_pct": { "percentiles": { "field": "amount", "percents": [50, 90, 99] } }
  }
}
```

> 实测：`UNIQUE_TO_ACCOUNTS=100`，`AMOUNT_P50=100`

| 聚合 | 用途 | 精度说明 |
| --- | --- | --- |
| `terms` | 分组计数 / TOP N | `size` 默认只返回 10 个桶；桶多时用 `composite` |
| `stats` | 一次拿到 min/max/avg/sum/count | 精确 |
| `date_histogram` | 时序趋势 | `calendar_interval` 按日历，`fixed_interval` 按固定时长 |
| `cardinality` | 去重计数 | 基于 HyperLogLog++，**近似值**，可调 `precision_threshold` |
| `percentiles` | 分位延迟/金额 | 基于 TDigest，**近似值** |

### 4.5 分页：from+size vs search_after

**深分页限制**：

```json
{ "from": 10001, "size": 10, "query": { "match_all": {} } }
```

> 实测：**400 错误**。因为 `index.max_result_window` 默认 10000。

**游标分页**（推荐用于深翻页 / 导出）：

```json
// 第一页
{
  "size": 3,
  "query": { "term": { "type": "transfer" } },
  "sort": [{ "createTime": "desc" }, { "id": "asc" }],
  "_source": ["id", "txnNo", "createTime"]
}
```

> 实测：`PAGE1=10,31,38`，最后一条排序值 `LAST_SORT=1794186562000,38`

```json
// 第二页：用上一页最后一条的 sort 值续读
{
  "size": 3,
  "query": { "term": { "type": "transfer" } },
  "sort": [{ "createTime": "desc" }, { "id": "asc" }],
  "search_after": [1794186562000, 38]
}
```

> 实测：`PAGE2=59,80,101`，与第一页无重叠

| 方式 | 优点 | 缺点 | 适用 |
| --- | --- | --- | --- |
| `from + size` | 可跳页 | 深分页时每个分片都要取 `from+size` 条，代价线性增长，且有 10000 上限 | 前几页 |
| `search_after` | O(1) 续读，无上限 | 不能跳页，必须有序且排序值唯一（建议加 `id` 兜底） | 导出、翻页流 |

---

## 5. 踩坑清单

### 5.1 `hits.total.value` 默认最大 10000

第一次聚合时出现矛盾结果：

```
TOTAL=10000
BY_TYPE=transfer:20000       ← 桶内总和 20000，但 total 显示 10000
```

原因：ES 默认 `track_total_hits: 10000`，超过就封顶。加 `"track_total_hits": true` 后变为 `20000`。

**建议**：精确计数场景必须显式开启；只做展示时可保持默认以省性能。

### 5.2 `keyword` 与 `text` 混用

- 聚合字段必须是 `keyword`（或带 `fielddata`），否则报 `Fielddata is disabled on text fields`
- `term` 查询走的是「不分词的完整值」，对 `text` 字段几乎必然失败
- 一个字段两种用途时，用 `fields` 建 `.keyword` 子字段（本项目 `remark` 的写法）

---

## 6. ES vs MySQL：什么时候该用谁

| 能力 | MySQL | ES |
| --- | --- | --- |
| 精确事务（余额变更） | ✅ 唯一正确选择 | ❌ 无事务 |
| 按账户查流水（有索引） | ✅ 足够快 | ✅ 也快 |
| 多条件任意组合过滤 | 索引设计难覆盖 | ✅ 倒排索引天然支持 |
| 全文检索（备注、摘要） | `LIKE '%x%'` 全表扫 | ✅ 分词 + 相关性打分 |
| 分组统计 / 时序趋势 | `GROUP BY` 有压力 | ✅ 聚合快 |
| 分页翻到第 100 万条 | `LIMIT offset` 越翻越慢 | `search_after` 恒定 |
| 中文模糊搜索 | 需额外方案 | 装 IK 即可 |

**结论**：账务流水的主存储仍是 MySQL（事务 + 一致性），ES 作为**查询侧异构副本**，通过 binlog/CDC 同步，承担列表检索、统计报表、模糊搜索。这也是前面《大表拆分方案》里「管理员全量分页走 ES/ClickHouse」的落地方式。

---

## 7. 复现步骤

```powershell
# 1. 起 ES
docker start ledger-es    # 已创建过则直接启动
# 首次创建见第 1 节

# 2. 确保 MySQL 在跑（数据源）
docker compose --profile split up -d mysql

# 3. 导入数据（默认采样 2 万条）
node scripts/es-import.mjs

# 4. 验证
Invoke-RestMethod http://localhost:9200/ledger_transaction/_count
```

清理：

```powershell
docker stop ledger-es
docker rm ledger-es
```
