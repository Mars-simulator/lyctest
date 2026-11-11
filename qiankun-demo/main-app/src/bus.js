/**
 * 极简全局状态 + 事件总线。
 *
 * 微前端里主应用与子应用是两套独立运行时，不能直接共享 Vue 实例，
 * 常见做法有两种：
 *   1. 通过 props 把主应用的 store / router 传给子应用（本项目采用）；
 *   2. 用发布订阅（event bus）做松散通信（本项目用这个演示跨应用通知）。
 */
import { reactive, watch } from 'vue';

export const globalState = reactive({
  user: { name: '张三', role: 'admin' },
  theme: 'light',
  /** 子应用通过 props 写入，用于验证跨应用数据传递 */
  messageCount: 0,
});

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

/** 主应用侧监听子应用通知，演示「子 → 主」通信 */
export function initBusBridge() {
  return on('sub:notify', (payload) => {
    globalState.messageCount += 1;
    console.log('[main] 收到子应用消息:', payload);
  });
}

// 主题变化时同步到 <html data-theme>
watch(
  () => globalState.theme,
  (theme) => {
    document.documentElement.dataset.theme = theme;
  },
  { immediate: true },
);
