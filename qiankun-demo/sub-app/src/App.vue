<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  login as apiLogin,
  fetchAccounts,
  fetchTransactions,
  deposit as apiDeposit,
} from './api.js';

const props = defineProps({
  sharedState: { type: Object, default: null },
  mainAppName: { type: String, default: '' },
});

const TOKEN_KEY = 'ledger_token';

// 方便本地直接打开账务视图，自动化测试也走这个入口跳过手动登录
const urlToken = new URLSearchParams(location.search).get('token');
if (urlToken) localStorage.setItem(TOKEN_KEY, urlToken);

const token = ref(localStorage.getItem(TOKEN_KEY) || '');
const username = ref('admin');
const password = ref('admin123');

const accounts = ref([]);
const selectedId = ref(null);
const transactions = ref([]);
const txnTotal = ref(0);

// 分页：首屏只渲染 20 行。一次渲染 100 行会明显拉长 LCP，
// 而用户实际翻页的需求集中在最近几十条。
const PAGE_SIZE = 20;
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(txnTotal.value / PAGE_SIZE)));

const loading = ref(false);
const error = ref('');
const notice = ref('');

const depositAmount = ref('100');

const isInQiankun = computed(() => Boolean(props.sharedState));
const selectedAccount = computed(
  () => accounts.value.find((item) => item.id === selectedId.value) || null,
);

function yuan(cents) {
  if (cents === null || cents === undefined) return '-';
  return (Number(cents) / 100).toFixed(2);
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function loadAccounts() {
  const res = await fetchAccounts(token.value);
  accounts.value = res.list || res.items || [];
  if (!selectedId.value && accounts.value.length) {
    selectedId.value = accounts.value[0].id;
  }
}

async function loadTransactions(targetPage = page.value) {
  if (!selectedId.value) {
    transactions.value = [];
    txnTotal.value = 0;
    return;
  }
  const res = await fetchTransactions(token.value, selectedId.value, targetPage, PAGE_SIZE);
  transactions.value = res.list || [];
  txnTotal.value = res.total || 0;
  page.value = targetPage;
}

async function gotoPage(target) {
  const next = Math.min(Math.max(1, target), pageCount.value);
  if (next === page.value) return;
  loading.value = true;
  try {
    await loadTransactions(next);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    const res = await apiLogin(username.value, password.value);
    token.value = res.accessToken;
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    await loadAccounts();
    await loadTransactions();
  } catch (err) {
    error.value = err.message || '登录失败';
    token.value = '';
    localStorage.removeItem(TOKEN_KEY);
  } finally {
    loading.value = false;
  }
}

async function selectAccount(id) {
  if (selectedId.value === id) return;
  selectedId.value = id;
  notice.value = '';
  loading.value = true;
  try {
    await loadTransactions(1);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleDeposit() {
  error.value = '';
  notice.value = '';
  const cents = Math.round(Number(depositAmount.value) * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    error.value = '入金金额需大于 0';
    return;
  }
  loading.value = true;
  try {
    const res = await apiDeposit(token.value, selectedId.value, cents, `WEB${Date.now()}`);
    notice.value = `入金成功，流水号 ${res.txnNo}`;
    await loadAccounts();
    await loadTransactions();
  } catch (err) {
    error.value = err.message || '入金失败';
  } finally {
    loading.value = false;
  }
}

function logout() {
  token.value = '';
  localStorage.removeItem(TOKEN_KEY);
  accounts.value = [];
  transactions.value = [];
  selectedId.value = null;
}

onMounted(async () => {
  if (!token.value) return;
  loading.value = true;
  try {
    await loadAccounts();
    await loadTransactions();
  } catch (err) {
    error.value = err.message;
    logout();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="sub-root">
    <header class="sub-header">
      <div class="sub-badge">sub</div>
      <div class="sub-title">
        <h2>账户中心</h2>
        <p class="sub-meta">
          {{ isInQiankun ? '运行于主应用' : '独立运行' }}
          <span v-if="props.mainAppName"> · {{ props.mainAppName }}</span>
        </p>
      </div>
      <button v-if="token" class="sub-btn ghost sub-logout" @click="logout">退出</button>
    </header>

    <form v-if="!token" class="login-card" @submit.prevent="handleLogin">
      <label>
        用户名
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <button class="sub-btn" type="submit" :disabled="loading">
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </form>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="notice" class="alert ok">{{ notice }}</div>

    <div v-if="token" class="ledger-layout">
      <aside class="account-list">
        <h3>账户（{{ accounts.length }}）</h3>
        <button
          v-for="acc in accounts"
          :key="acc.id"
          class="account-item"
          :class="{ active: acc.id === selectedId }"
          @click="selectAccount(acc.id)"
        >
          <span class="acc-name">{{ acc.name }}</span>
          <span class="acc-no">{{ acc.accountNo }}</span>
          <span class="acc-balance">{{ yuan(acc.balance) }}</span>
        </button>
      </aside>

      <section class="account-detail">
        <div v-if="selectedAccount" class="balance-card">
          <div>
            <p class="label">账户余额</p>
            <p class="amount">{{ yuan(selectedAccount.balance) }}</p>
          </div>
          <div class="balance-meta">
            <p>{{ selectedAccount.name }}</p>
            <p>{{ selectedAccount.currency }} · {{ selectedAccount.accountNo }}</p>
          </div>
        </div>

        <form class="deposit-form" @submit.prevent="handleDeposit">
          <input v-model="depositAmount" inputmode="decimal" />
          <button class="sub-btn" type="submit" :disabled="loading">入金</button>
        </form>

        <div class="txn-panel">
          <div class="txn-head">
            <h3>交易流水</h3>
            <span>共 {{ txnTotal }} 条</span>
          </div>
          <table class="txn-table">
            <thead>
              <tr>
                <th>流水号</th>
                <th>类型</th>
                <th>金额</th>
                <th>变动后余额</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="txn in transactions" :key="txn.id">
                <td class="mono">{{ txn.txnNo }}</td>
                <td>{{ txn.type }}</td>
                <td class="num">{{ yuan(txn.amount) }}</td>
                <td class="num">{{ yuan(txn.toBalanceAfter ?? txn.fromBalanceAfter) }}</td>
                <td>{{ formatTime(txn.createTime) }}</td>
              </tr>
              <tr v-if="!transactions.length">
                <td colspan="5" class="empty">暂无流水</td>
              </tr>
            </tbody>
          </table>

          <div v-if="pageCount > 1" class="txn-pager">
            <button class="sub-btn ghost" :disabled="page <= 1" @click="gotoPage(page - 1)">
              上一页
            </button>
            <span>{{ page }} / {{ pageCount }}</span>
            <button
              class="sub-btn ghost"
              :disabled="page >= pageCount"
              @click="gotoPage(page + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
