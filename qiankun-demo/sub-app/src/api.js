/**
 * 账务接口封装。
 *
 * 注意：子应用在主应用里运行时，页面 origin 是 5173，
 * 所以所有接口必须用绝对地址，不能写相对路径。
 */
const ACCOUNT_API = 'http://localhost:3001';
const LEDGER_API = 'http://localhost:3002';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message = (data && data.message) || `HTTP ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join('; ') : message);
  }
  return data;
}

export function login(username, password) {
  return request(`${ACCOUNT_API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export function fetchAccounts(token, page = 1, pageSize = 100) {
  return request(`${ACCOUNT_API}/ledger/accounts?page=${page}&pageSize=${pageSize}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

// pageSize 上限与后端 QueryTransactionDto 的 @Max(100) 对齐，超过会直接 400
export function fetchTransactions(token, accountId, page = 1, pageSize = 100) {
  return request(
    `${LEDGER_API}/ledger/transactions?accountId=${accountId}&page=${page}&pageSize=${pageSize}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
}

export function deposit(token, accountId, amountCents, txnNo) {
  return request(`${LEDGER_API}/ledger/transactions/deposit`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ accountId, amount: amountCents, txnNo }),
  });
}
