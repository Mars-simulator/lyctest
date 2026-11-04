# Redis 分布式锁与令牌桶限流

> 基于项目现有 `redisClient`（ioredis 单例）实现的两套练习组件：
> **Redis 分布式锁**（防并发竞态）与 **Redis 令牌桶限流**（分布式限速）。

## 1. 概述

| 组件 | 解决的问题 | 关键实现 |
| --- | --- | --- |
| `RedisLockService` | 多实例/多请求并发修改同一资源（如账户余额）导致超扣、负余额 | `SET NX PX` 原子加锁 + Lua 校验 token 释放 |
| `TokenBucketService` / `TokenBucketGuard` | 分布式环境下对接口限速（多实例共享计数） | Redis Hash + Lua 原子「补充→扣减→续期」 |

两者都通过 **Lua 脚本**保证 Redis 操作的原子性，避免「读-改-写」竞态。

## 2. 文件清单

```
src/
├── common/
│   ├── lock/
│   │   ├── redis-lock.service.ts        # 分布式锁服务
│   │   ├── redis-lock.service.spec.ts   # 单测
│   │   └── redis-lock.module.ts         # @Global() 模块
│   └── security/
│       ├── token-bucket.service.ts      # 令牌桶核心（Lua）
│       ├── token-bucket.service.spec.ts # 单测
│       ├── token-bucket.guard.ts        # NestJS 守卫
│       ├── token-bucket.decorator.ts    # @TokenBucket()
│       └── token-bucket.module.ts       # 模块
└── lock-demo/
    ├── lock-demo.controller.ts          # 演示接口（下单扣款）
    └── lock-demo.module.ts
```

## 3. Redis 分布式锁

### 3.1 原理

```
加锁：SET lock:key <uuid> PX <ttl> NX
         └─ 原子：不存在才设置 + 自带过期，避免死锁
释放：Lua = if GET key == uuid then DEL key
         └─ 原子：只删自己持有的锁，避免超时后误删他人锁
```

### 3.2 核心实现

```ts
// src/common/lock/redis-lock.service.ts

/** 释放锁：仅当值等于本次 token 才删除 */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisLockService {
  /** 加锁，成功返回 token，失败返回 null（带重试） */
  async acquire(key: string, options: LockOptions = {}): Promise<string | null> {
    const ttlMs = options.ttlMs ?? 10_000;
    const retryTimes = options.retryTimes ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 200;
    const token = randomUUID();

    for (let attempt = 0; attempt < retryTimes; attempt++) {
      // 原子加锁 + 自动过期
      const result = await redisClient.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') return token;
      if (attempt < retryTimes - 1) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
    return null;
  }

  /** 释放锁：Lua 校验 token 后删除 */
  async release(key: string, token: string): Promise<boolean> {
    const deleted = await redisClient.eval(RELEASE_SCRIPT, 1, key, token);
    return Number(deleted) === 1;
  }

  /** 模板方法：自动加锁 / 释放，异常也会释放 */
  async withLock<T>(key: string, work: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const token = await this.acquire(key, options);
    if (!token) throw new Error(`获取锁失败，请稍后重试: ${key}`);
    try {
      return await work();
    } finally {
      await this.release(key, token).catch((err) =>
        this.logger.error(`释放锁失败: ${key}`, err),
      );
    }
  }
}
```

### 3.3 关键点

| 点 | 说明 |
| --- | --- |
| **原子加锁** | 用 `SET ... PX ... NX` 一次完成，不能拆成 `SETNX` + `EXPIRE`（中间崩溃会永久死锁） |
| **唯一 token** | 值为 UUID，释放时校验，防止「A 超时 → B 拿锁 → A 释放了 B 的锁」 |
| **过期兜底** | `PX ttl` 保证持锁进程崩溃后锁能自动释放 |
| **重试** | 短暂争用时可重试，避免直接失败 |
| **异常释放** | `withLock` 的 `finally` 保证业务异常时也释放锁 |

### 3.4 使用

```ts
constructor(private readonly lock: RedisLockService) {}

async deduct(accountId: number, amount: number) {
  return this.lock.withLock(`lock:account:${accountId}`, async () => {
    const balance = await this.getBalance(accountId);
    if (balance < amount) throw new BadRequestException('余额不足');
    await this.setBalance(accountId, balance - amount);
    return balance - amount;
  }, { ttlMs: 5_000 });
}
```

## 4. 令牌桶限流

### 4.1 原理

- 桶有固定容量 `capacity`，以恒定速率 `refillPerSec` 补充令牌；
- 每个请求消耗 `cost`（默认 1）个令牌，有则放行，无则拒绝并给出等待时间；
- 允许一定突发（桶内积压的令牌），但长期速率受 `refillPerSec` 约束。

### 4.2 Lua 脚本（原子执行）

```lua
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', KEYS[1], 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if tokens == nil then tokens = capacity end
if lastRefill == nil then lastRefill = now end

-- 按时间差补充令牌，封顶 capacity
local elapsedMs = math.max(0, now - lastRefill)
if refillPerSec > 0 then
  tokens = math.min(capacity, tokens + elapsedMs / 1000 * refillPerSec)
end
lastRefill = now

local allowed = 0
local waitMs = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  if refillPerSec > 0 then
    waitMs = math.ceil((cost - tokens) / refillPerSec * 1000)
  else
    waitMs = -1
  end
end

redis.call('HMSET', KEYS[1], 'tokens', tokens, 'lastRefill', now)
local ttlMs = math.ceil(capacity / (refillPerSec > 0 and refillPerSec or 1) * 1000) + 60000
redis.call('PEXPIRE', KEYS[1], ttlMs)

return { allowed, math.floor(tokens), waitMs }
```

### 4.3 核心实现

```ts
// src/common/security/token-bucket.service.ts
@Injectable()
export class TokenBucketService {
  async consume(key: string, options: TokenBucketOptions): Promise<TokenBucketResult> {
    const cost = options.cost ?? 1;
    const raw = (await redisClient.eval(
      TOKEN_BUCKET_SCRIPT, 1, key,
      options.capacity, options.refillPerSec, Date.now(), cost,
    )) as [number, number, number];

    return { allowed: Number(raw[0]) === 1, remaining: Number(raw[1]), waitMs: Number(raw[2]) };
  }
}
```

### 4.4 与固定窗口对比

| 维度 | 固定窗口（现有 `RateLimitGuard`） | 令牌桶（`TokenBucketService`） |
| --- | --- | --- |
| 存储 | 进程内存 `Map` | Redis（多实例共享） |
| 流量形态 | 窗口边界可能双倍放行 | 恒定补充，允许平滑突发 |
| 多实例 | 每实例独立计数 | 全局统一计数 |
| 适用 | 单实例轻量防护 | 分布式限流 |

### 4.5 使用

```ts
@TokenBucket({ capacity: 5, refillPerSec: 5 / 60 }) // 每分钟 5 个，允许突发
@UseGuards(TokenBucketGuard)
@Post('deduct')
deduct() { ... }
```

## 5. 演示接口

`src/lock-demo/lock-demo.controller.ts`（`/demo` 前缀，`@Public()` 免登录）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/demo/accounts/:id/deduct` | 分布式锁保护扣款 + 令牌桶限流 |
| GET | `/demo/accounts/:id` | 查余额 |

扣款逻辑用内存 `Map` 模拟账户，并在临界区内 `setTimeout(50ms)` 模拟 DB 往返以放大竞态窗口。

## 6. 验证

### 6.1 单元测试

```powershell
npm test -- --runInBand
```

新增两个测试套件：
- `redis-lock.service.spec.ts`：加锁成功/失败重试、Lua 释放、`withLock` 异常释放等 7 个用例
- `token-bucket.service.spec.ts`：放行/拒绝/参数传递等 4 个用例

### 6.2 验证分布式锁（并发不超扣）

```powershell
docker compose up -d mysql redis
npm run start:dev

# 并发 20 个扣款请求（每个扣 100，初始余额 10000）
1..20 | ForEach-Object {
  Start-Job -ScriptBlock {
    try {
      Invoke-RestMethod -Uri "http://localhost:3000/demo/accounts/1/deduct" -Method Post `
        -ContentType "application/json" -Body '{"amount":100}'
    } catch { $_.Exception.Message }
  }
} | Wait-Job | Receive-Job

# 查余额：应精确等于 10000 - 成功次数*100，绝不为负
Invoke-RestMethod -Uri "http://localhost:3000/demo/accounts/1"
```

**判定**：余额精确、无负数 → 锁生效。去掉 `withLock` 再测，会出现负数或超扣。

### 6.3 验证令牌桶限流

```powershell
1..8 | ForEach-Object {
  try {
    Invoke-RestMethod -Uri "http://localhost:3000/demo/accounts/1/deduct" -Method Post `
      -ContentType "application/json" -Body '{"amount":1}'
  } catch {
    Write-Output "第 $_ 次: $($_.Exception.Response.StatusCode.value__)"
  }
}
```

**判定**：前 5 次成功，第 6 次起返回 `429`。

查看 Redis 中的桶状态：

```bash
redis-cli HGETALL "ratelimit:tb:LockDemoController.deduct:<ip>"
# tokens: 当前令牌数
# lastRefill: 上次补充时间（毫秒）
```

## 7. 注意事项与生产建议

### 分布式锁

1. **锁粒度**：key 要精确到资源（`lock:account:{id}`），过粗会互相阻塞。
2. **TTL 取值**：应大于临界区最长耗时；临界区可能超时则需考虑**看门狗自动续期**（本实现未做）。
3. **不可重入**：同一线程重复加同一 key 会失败，若需重入需额外记录。
4. **主从切换**：Redis 主从异步复制下，主节点宕机可能丢锁；强一致场景可用 Redlock 或等待主从同步。
5. **锁 + 事务**：锁只保证串行，不替代数据库事务；余额变更仍应在事务内完成。

### 令牌桶

1. **参数换算**：`refillPerSec = limit / (windowMs / 1000)`；例如 100 次/分钟 = `100/60`。
2. **cost 支持**：批量操作可一次消耗多个令牌（如一次扣 5 个）。
3. **key 维度**：按 `IP + 路由` 是最常见维度，也可按 `userId`、`apiKey` 限流。
4. **时钟依赖**：脚本用应用侧 `Date.now()`，多实例时钟偏差会影响补充精度；对精度要求高可用 Redis `TIME`。
5. **降级**：Redis 不可用时应决定「放行（可用性优先）」还是「拒绝（安全优先）」，需显式策略。
