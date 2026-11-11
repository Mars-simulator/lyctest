<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  sharedState: { type: Object, default: null },
  mainRouter: { type: Object, default: null },
  mainAppName: { type: String, default: '' },
  bus: { type: Object, default: null },
});

const localCount = ref(0);
const sentCount = ref(0);

const isInQiankun = computed(() => Boolean(props.sharedState));
const theme = computed(() => props.sharedState?.theme ?? 'light');
const userName = computed(() => props.sharedState?.user?.name ?? '独立运行');

/** 子应用直接改主应用的响应式状态，主应用界面会同步更新 */
function toggleMainTheme() {
  if (!props.sharedState) return;
  props.sharedState.theme = props.sharedState.theme === 'light' ? 'dark' : 'light';
}

/** 通过事件总线通知主应用 */
function notifyMain() {
  sentCount.value += 1;
  props.bus?.emit('sub:notify', {
    from: 'sub-app',
    seq: sentCount.value,
    at: new Date().toLocaleTimeString(),
  });
}

/** 调用主应用路由跳转 */
function backToMainHome() {
  props.mainRouter?.push('/');
}
</script>

<template>
  <div class="sub-root">
    <header class="sub-header">
      <div class="sub-badge">sub</div>
      <div>
        <h2>子应用 · 账户中心</h2>
        <p class="sub-meta">
          运行模式：
          <b>{{ isInQiankun ? 'qiankun 微前端' : '独立运行' }}</b>
          <span v-if="props.mainAppName"> · 宿主：{{ props.mainAppName }}</span>
        </p>
      </div>
    </header>

    <div class="sub-grid">
      <div class="sub-card">
        <h4>子应用本地状态</h4>
        <p class="sub-metric">{{ localCount }}</p>
        <button class="sub-btn" @click="localCount++">本地 +1</button>
      </div>

      <div class="sub-card">
        <h4>读取主应用状态</h4>
        <p>用户：<b>{{ userName }}</b></p>
        <p>主题：<b>{{ theme }}</b></p>
        <button class="sub-btn ghost" :disabled="!isInQiankun" @click="toggleMainTheme">
          切换主应用主题
        </button>
      </div>

      <div class="sub-card">
        <h4>与主应用通信</h4>
        <p>已发送：<b>{{ sentCount }}</b> 条</p>
        <div class="sub-actions">
          <button class="sub-btn" :disabled="!isInQiankun" @click="notifyMain">通知主应用</button>
          <button class="sub-btn ghost" :disabled="!isInQiankun" @click="backToMainHome">
            回主应用首页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
