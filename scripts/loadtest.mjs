#!/usr/bin/env node
/**
 * 零依赖压测脚本（只用 Node 内置 http 模块，避免引入 k6/autocannon 等额外工具）。
 *
 * 用法：
 *   node scripts/loadtest.mjs --mode=read  --c=20 --d=15 --token=<jwt>
 *   node scripts/loadtest.mjs --mode=write --c=20 --d=15 --token=<jwt>
 *
 * 参数：
 *   --url       目标地址，默认 http://localhost:3002（账务服务）
 *   --mode      read = GET /ledger/transactions（按账户查流水）
 *               write = POST /ledger/transactions/deposit（入金）
 *   --c         并发数，默认 20
 *   --d         压测时长（秒），默认 15
 *   --token     Bearer 令牌（必填）
 *   --accounts  参与压测的账户 id，逗号分隔，默认 "3"
 *
 * 输出：QPS、成功/失败数、错误率、P50/P95/P99/Max 延迟
 */
import http from 'node:http';

const arg = (name, def) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const BASE_URL = arg('url', 'http://localhost:3002');
const MODE = arg('mode', 'read');
const CONCURRENCY = Number(arg('c', 20));
const DURATION_S = Number(arg('d', 15));
const TOKEN = arg('token', '');
const ACCOUNTS = arg('accounts', '3')
  .split(',')
  .map(Number)
  .filter((n) => Number.isInteger(n));

if (!TOKEN) {
  console.error('缺少 --token');
  process.exit(1);
}

const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY * 2 });
const target = new URL(BASE_URL);

function send(method, path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path,
        method,
        agent,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          ...(data
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 100)}`));
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const latencies = [];
let ok = 0;
let fail = 0;
let stop = false;
const errors = new Map();

async function worker() {
  let seq = 0;
  while (!stop) {
    const accountId = ACCOUNTS[seq % ACCOUNTS.length];
    const t0 = process.hrtime.bigint();
    try {
      if (MODE === 'read') {
        await send('GET', `/ledger/transactions?accountId=${accountId}&page=1&pageSize=20`);
      } else {
        await send('POST', '/ledger/transactions/deposit', {
          accountId,
          amount: 1,
          // 保证幂等键唯一，避免被幂等逻辑短路而测不到真实写入
          txnNo: `LT${process.pid}${seq}${Date.now().toString(36)}`,
        });
      }
      latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
      ok += 1;
    } catch (error) {
      fail += 1;
      const key = String(error.message).slice(0, 80);
      errors.set(key, (errors.get(key) ?? 0) + 1);
    }
    seq += 1;
  }
}

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

const startedAt = Date.now();
setTimeout(() => {
  stop = true;
}, DURATION_S * 1000);

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const elapsed = (Date.now() - startedAt) / 1000;
latencies.sort((a, b) => a - b);
const total = ok + fail;

console.log(
  JSON.stringify(
    {
      mode: MODE,
      concurrency: CONCURRENCY,
      duration_s: Number(elapsed.toFixed(1)),
      total,
      ok,
      fail,
      qps: Number((total / elapsed).toFixed(1)),
      error_rate: `${total ? ((fail / total) * 100).toFixed(2) : '0.00'}%`,
      p50_ms: Number(percentile(latencies, 0.5).toFixed(1)),
      p95_ms: Number(percentile(latencies, 0.95).toFixed(1)),
      p99_ms: Number(percentile(latencies, 0.99).toFixed(1)),
      max_ms: Number((latencies[latencies.length - 1] ?? 0).toFixed(1)),
      top_errors: [...errors.entries()].slice(0, 3),
    },
    null,
    2,
  ),
);

agent.destroy();
