#!/usr/bin/env node
/**
 * 把 MySQL 里的账务流水导入 Elasticsearch，用于检索练习。
 *
 * 用法：
 *   node scripts/es-import.mjs                 # 默认导入最近 5000 条
 *   LIMIT=20000 node scripts/es-import.mjs     # 指定条数（PowerShell: $env:LIMIT='20000'）
 *
 * 环境变量：
 *   ES_URL     默认 http://localhost:9200
 *   ES_INDEX   默认 ledger_transaction
 *   LIMIT      默认 5000
 *   DB_HOST 等 复用项目默认值（127.0.0.1:3307 / root / faben123 / nest_crud_demo）
 */
import mysql from 'mysql2/promise';

const ES_URL = process.env.ES_URL ?? 'http://localhost:9200';
const INDEX = process.env.ES_INDEX ?? 'ledger_transaction';
const LIMIT = Number(process.env.LIMIT ?? 20000);
/**
 * 采样参数：id % STEP = OFFSET 的行参与导入。
 * 步长必须与造数时的周期（10）互质，否则会采到同一类数据
 * —— 用 id % 10 = 0 采样时曾出现「全部是 transfer、金额全是 100」的偏差。
 */
const SAMPLE_STEP = Number(process.env.SAMPLE_STEP ?? 7);
const SAMPLE_OFFSET = Number(process.env.SAMPLE_OFFSET ?? 3);
const BATCH = 500;

const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'faben123',
  database: process.env.DB_DATABASE ?? 'nest_crud_demo',
};

/** 账务流水索引 mapping：区分精确匹配（keyword）与全文检索（text） */
const MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    properties: {
      id: { type: 'long' },
      txnNo: { type: 'keyword' },
      type: { type: 'keyword' },
      amount: { type: 'long' },
      fromAccountId: { type: 'integer' },
      toAccountId: { type: 'integer' },
      fromBalanceAfter: { type: 'long' },
      toBalanceAfter: { type: 'long' },
      status: { type: 'keyword' },
      remark: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      operatorId: { type: 'integer' },
      createTime: { type: 'date' },
    },
  },
};

async function es(path, init) {
  const res = await fetch(`${ES_URL}${path}`, init);
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

/** 删除旧索引并重建，保证每次练习的数据一致 */
async function recreateIndex() {
  await es(`/${INDEX}`, { method: 'DELETE' }).catch(() => null);
  await es(`/${INDEX}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(MAPPING),
  });
  console.log(`索引已重建: ${INDEX}`);
}

async function main() {
  await recreateIndex();

  const conn = await mysql.createConnection(dbConfig);
  // 均匀采样，保证 deposit / transfer、不同金额与账户都能覆盖到
  const [rows] = await conn.query(
    `SELECT id, txnNo, type, amount, fromAccountId, toAccountId,
            fromBalanceAfter, toBalanceAfter, status, remark, operatorId, createTime
     FROM ledger_transaction
     WHERE id % ? = ?
     ORDER BY id
     LIMIT ?`,
    [SAMPLE_STEP, SAMPLE_OFFSET, LIMIT],
  );
  await conn.end();

  console.log(`从 MySQL 读取 ${rows.length} 条`);

  let indexed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const lines = [];

    for (const row of slice) {
      const doc = {
        id: Number(row.id),
        txnNo: row.txnNo,
        type: row.type,
        // mysql2 默认把 bigint 读成字符串，这里统一转数字
        amount: Number(row.amount),
        fromAccountId: row.fromAccountId === null ? null : Number(row.fromAccountId),
        toAccountId: row.toAccountId === null ? null : Number(row.toAccountId),
        fromBalanceAfter: row.fromBalanceAfter === null ? null : Number(row.fromBalanceAfter),
        toBalanceAfter: row.toBalanceAfter === null ? null : Number(row.toBalanceAfter),
        status: row.status,
        remark: row.remark,
        operatorId: Number(row.operatorId),
        createTime: new Date(row.createTime).toISOString(),
      };
      lines.push(JSON.stringify({ index: { _index: INDEX, _id: doc.id } }));
      lines.push(JSON.stringify(doc));
    }

    // 末尾必须换行，否则 bulk 会丢掉最后一条
    const body = `${lines.join('\n')}\n`;
    const result = await es('/_bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/x-ndjson' },
      body,
    });

    indexed += result.items.length;
    failed += result.items.filter((it) => it.index.error).length;
    process.stdout.write(`\r已写入 ${indexed}/${rows.length}`);
  }

  console.log(`\n导入完成: indexed=${indexed}, failed=${failed}`);

  // 刷新让文档立即可搜
  await es(`/${INDEX}/_refresh`, { method: 'POST' });
  const count = await es(`/${INDEX}/_count`);
  console.log(`索引当前文档数: ${count.count}`);
}

main().catch((err) => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
