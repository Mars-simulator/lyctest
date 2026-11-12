import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { registerMicroApps, start, addGlobalUncaughtErrorHandler } from 'qiankun';
import App from './App.vue';
import Home from './views/Home.vue';
import SubAppView from './views/SubAppView.vue';
import { globalState, initBusBridge, emit, on } from './bus.js';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    // 子应用路由统一兜底到这里，容器由该组件渲染
    { path: '/sub-app/:pathMatch(.*)*', name: 'sub-app', component: SubAppView },
  ],
});

const app = createApp(App);
app.use(router);
app.mount('#main-app');

initBusBridge();

/** 把 qiankun 的关键阶段打到页面上，便于排查「子应用没挂上」 */
function mark(message) {
  console.log('[qiankun]', message);
  let box = document.getElementById('qk-debug');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'qk-debug';
    box.style.display = 'none';
    document.body.appendChild(box);
  }
  box.textContent += `${message}\n`;
}

/**
 * 微前端最常见的故障是「子应用没挂上但页面一片空白」，
 * 这里把 qiankun 捕获到的未处理异常直接渲染到页面上，方便定位。
 */
addGlobalUncaughtErrorHandler((event) => {
  const reason = event?.reason ?? event;
  const message = reason?.message ?? String(reason);
  console.error('[qiankun] 未处理异常:', reason);

  let box = document.getElementById('qiankun-error');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'qiankun-error';
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;margin:0;padding:12px;background:#fee;color:#900;font-size:12px;z-index:9999;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  box.textContent += `${message}\n`;
});

/**
 * 关键时序：
 * qiankun 挂载子应用时需要一个真实存在的容器 DOM，
 * 而容器由 SubAppView 渲染，因此必须等 router ready 之后再 start()。
 * 否则直接访问 /sub-app 会因为容器还没渲染而报 "container not found"。
 */
router.isReady().then(() => {
  registerMicroApps(
    [
      {
        name: 'sub-app',
        // 子应用入口：dev 指向 dev server，构建时可用 VITE_SUB_APP_ENTRY 覆盖
        entry: import.meta.env.VITE_SUB_APP_ENTRY || '//localhost:5174',
        container: '#sub-container',
        activeRule: '/sub-app',
        // 通过 props 把主应用能力注入子应用（状态、路由、标识）
        props: {
          globalState,
          mainRouter: router,
          mainAppName: 'qiankun-main-app',
          // 子应用是独立构建的产物，无法 import 主应用的模块，
          // 因此把事件总线的 emit/on 作为 props 注入
          bus: { emit, on },
        },
      },
    ],
    {
      beforeLoad: [async (microApp) => mark(`beforeLoad: ${microApp.name}`)],
      beforeMount: [async (microApp) => mark(`beforeMount: ${microApp.name}`)],
      afterMount: [async (microApp) => mark(`afterMount: ${microApp.name}`)],
      afterUnmount: [async (microApp) => mark(`afterUnmount: ${microApp.name}`)],
    },
  );

  start({
    prefetch: 'all',
    sandbox: {
      // 用实验性样式隔离，避免子应用样式污染主应用
      experimentalStyleIsolation: true,
    },
  });
});
