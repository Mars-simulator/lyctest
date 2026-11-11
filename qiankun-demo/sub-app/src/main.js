import { createApp } from 'vue';
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';
import App from './App.vue';
import './style.css';

let app = null;

function render(props = {}) {
  const { container, globalState, mainRouter, mainAppName, bus } = props;

  app = createApp(App, {
    // 主应用注入的能力，全部通过 props 下发
    sharedState: globalState ?? null,
    mainRouter: mainRouter ?? null,
    mainAppName: mainAppName ?? '',
    bus: bus ?? null,
  });

  // 被 qiankun 加载时必须挂到主应用给的容器内，否则会挂到主应用的 body 上
  const mountNode = container ? container.querySelector('#app') : '#app';
  app.mount(mountNode);
}

/**
 * qiankun 会在合适的时机调用这些生命周期。
 * bootstrap 只执行一次，mount/unmount 可多次（切走再切回）。
 */
renderWithQiankun({
  bootstrap() {
    console.log('[sub-app] bootstrap');
  },
  mount(props) {
    console.log('[sub-app] mount, 收到主应用 props:', Object.keys(props ?? {}));
    render(props);
  },
  unmount() {
    console.log('[sub-app] unmount');
    app?.unmount();
    app = null;
  },
  update(props) {
    console.log('[sub-app] update', props);
  },
});

// 独立运行（直接访问 http://localhost:5174）时走这里，便于单独调试
if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render();
}
