# qiankun + Vue3 微前端示例

主应用 + 子应用的最小可运行示例，全部使用 Vue3 + Vite，并记录 Vite 接入 qiankun 的四个真实坑。

| 应用 | 技术栈 | 端口 | 职责 |
| --- | --- | --- | --- |
| `main-app` | Vue3 + vue-router + qiankun | 5173 | 基座：路由、导航、共享状态、加载子应用 |
| `sub-app` | Vue3 + vite-plugin-qiankun | 5174 | 微应用：账户中心页面，可独立运行 |

---

## 一、快速开始

```powershell
# 1. 安装依赖（两个应用分别安装）
cd qiankun-demo/main-app; npm install
cd ../sub-app; npm install

# 2. 先启动子应用，再启动主应用
cd qiankun-demo/sub-app; npm run dev     # http://localhost:5174
cd qiankun-demo/main-app; npm run dev    # http://localhost:5173
```

访问：

| 地址 | 效果 |
| --- | --- |
| http://localhost:5173/ | 主应用首页 |
| http://localhost:5173/sub-app | 主应用内挂载子应用（微前端模式） |
| http://localhost:5174/ | 子应用独立运行（独立调试用） |

---

## 二、目录结构

```
qiankun-demo/
├── main-app/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.js              # 注册微应用、启动 qiankun
│       ├── bus.js               # 全局共享状态 + 事件总线
│       ├── App.vue              # 侧边栏布局 + 主题切换
│       ├── style.css
│       └── views/
│           ├── Home.vue         # 主应用首页
│           └── SubAppView.vue   # 子应用宿主页（#sub-container）
└── sub-app/
    ├── index.html
    ├── vite.config.js           # qiankun 插件 + dev 兼容处理
    └── src/
        ├── main.js              # 生命周期导出（bootstrap/mount/unmount）
        ├── App.vue              # 账户中心页面
        └── style.css
```

---

## 三、主应用：注册与启动

### 3.1 路由与容器

主应用用 `vue-router` 把 `/sub-app` 映射到一个只负责提供容器的页面：

```js
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    // 子应用路由统一兜底到这里，容器由该组件渲染
    { path: '/sub-app/:pathMatch(.*)*', name: 'sub-app', component: SubAppView },
  ],
});
```

```vue
<!-- SubAppView.vue -->
<div id="sub-container" class="sub-container"></div>
```

### 3.2 注册微应用

```js
router.isReady().then(() => {
  registerMicroApps(
    [
      {
        name: 'sub-app',
        entry: '//localhost:5174',
        container: '#sub-container',
        activeRule: '/sub-app',
        props: {
          globalState,        // 共享状态（响应式对象）
          mainRouter: router, // 主应用路由，子应用可调用 push
          mainAppName: 'qiankun-main-app',
          bus: { emit, on },  // 事件总线（子应用无法 import 主应用模块）
        },
      },
    ],
    {
      beforeLoad: [async (app) => mark(`beforeLoad: ${app.name}`)],
      beforeMount: [async (app) => mark(`beforeMount: ${app.name}`)],
      afterMount: [async (app) => mark(`afterMount: ${app.name}`)],
      afterUnmount: [async (app) => mark(`afterUnmount: ${app.name}`)],
    },
  );

  start({
    prefetch: 'all',
    sandbox: { experimentalStyleIsolation: true },
  });
});
```

**关键时序**：`start()` 必须等 `router.isReady()`，因为 qiankun 挂载时需要 `#sub-container` 已存在于 DOM。直接 `start()` 后访问 `/sub-app` 会因为容器还没渲染而报 `container not found`。

### 3.3 内置排错能力

微前端最常见的故障是「页面空白但控制台没报错」。示例里加了两处兜底：

```js
// 1. 未捕获异常直接画到页面上
addGlobalUncaughtErrorHandler((event) => {
  const message = event?.reason?.message ?? String(event?.reason ?? event);
  // 渲染到 #qiankun-error
});

// 2. 生命周期阶段写入隐藏节点 #qk-debug
function mark(message) {
  document.getElementById('qk-debug').textContent += `${message}\n`;
}
```

排查时打开 DevTools 查看 `#qk-debug` 内容，就知道卡在 `beforeLoad` 还是 `beforeMount`。

---

## 四、子应用：生命周期

```js
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

function render(props = {}) {
  const { container, globalState, mainRouter, mainAppName, bus } = props;
  app = createApp(App, { sharedState: globalState, mainRouter, mainAppName, bus });
  // 被 qiankun 加载时必须挂到主应用给的容器内
  app.mount(container ? container.querySelector('#app') : '#app');
}

renderWithQiankun({
  bootstrap() {},                 // 只执行一次
  mount(props) { render(props); }, // 每次进入子应用路由都会执行
  unmount() { app?.unmount(); app = null; },
  update(props) {},
});

// 独立运行（直接访问 5174）也要能跑
if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render();
}
```

---

## 五、三种通信方式

| 方式 | 方向 | 实现 |
| --- | --- | --- |
| 共享响应式状态 | 双向 | 主应用把 `reactive` 对象通过 `props.globalState` 传下去，子应用直接改字段，主应用界面自动刷新 |
| 事件总线 | 子 → 主 | 主应用把 `{ emit, on }` 作为 props 注入，子应用 `bus.emit('sub:notify', payload)` |
| 主应用路由 | 子 → 主 | `props.mainRouter.push('/')` 让子应用跳回主应用首页 |

> 为什么事件总线要通过 props 传？因为子应用是**独立构建**的产物，不能在编译期 `import` 主应用的模块，只能靠运行时注入。

子应用界面会显示「运行模式：qiankun 微前端 / 独立运行」和「宿主：qiankun-main-app」，用来直观验证 props 是否到位。

---

## 六、Vite 接入 qiankun 的四个坑

### 坑 1：`@vite/client` 被当普通脚本执行

**现象**：子应用不渲染，页面底部出现

```
Uncaught SyntaxError: Cannot use import statement outside a module
```

**原因**：Vite 会往子应用 HTML 注入 `<script type="module" src="/@vite/client">`。qiankun 的 `import-html-entry` 把所有 `<script>` 取出来用普通脚本方式执行，而 `/@vite/client` 内部是 ESM 静态 import，因此语法报错。

**解决**：dev 模式下从 HTML 中移除该标签。

```js
transformIndexHtml(html) {
  return html.replace(/\s*<script type="module" src="\/@vite\/client"><\/script>/, '');
}
```

> 代价：子应用在微前端模式下没有 HMR。需要 HMR 时直接访问 `5174` 单独调试。

### 坑 2：`import('/src/main.js')` 请求到了主应用

**现象**：没有报错，但子应用白屏，`#qk-debug` 只显示 `beforeLoad`，`beforeMount` 永远不触发。

**原因**：`vite-plugin-qiankun` 在 dev 模式下把入口改写成内联的 `import('/src/main.js')`。这个**绝对路径以主应用 origin 为基准**解析，实际请求了 `http://localhost:5173/src/main.js`（主应用自己的入口），导致子应用的生命周期根本没有注册，`bootstrap` 的 deferred promise 永远不会 resolve。

**解决**：改写成子应用的完整地址。

```js
.replace(/import\('\/src\/main\.js'\)/g, `import('http://localhost:5174/src/main.js')`)
```

**这个坑最难查**：既不报错、也不白屏提示，只是静默卡住。

### 坑 3：`NODE_ENV=production` 让 dev 模式的 base 错乱

**现象**：dev 下子应用 HTML 里的资源路径变成 `/sub-app/src/main.js`，qiankun 加载报 404。

**原因**：配置里用 `process.env.NODE_ENV === 'production'` 判断环境，而当前 shell 从项目 `.env` 继承了 `NODE_ENV=production`，导致 Vite dev 也被当成生产。

**解决**：改用 Vite 自己的 `mode` 参数。

```js
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/sub-app/' : '/',
  // ...
}));
```

### 坑 4：`npm omit=dev` 导致插件没装

**现象**：

```
Cannot find package '@vitejs/plugin-vue'
error when starting dev server
```

**原因**：本机 npm 全局配置了 `omit=dev`，`npm install` 默认跳过 devDependencies，而 vite 和所有插件都在 devDependencies 里。

**排查**：

```powershell
npm config get omit   # 输出 dev
```

**解决**：

```powershell
npm install --include=dev
```

---

## 七、验证结果

用 headless Chrome 抓取渲染后的真实 DOM（`--dump-dom`）确认挂载成功：

```powershell
# 需要 -Wait，Chrome 在 Windows 上启动后会立刻返回
Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new","--disable-gpu","--no-sandbox",
  "--user-data-dir=$env:TEMP\qk-profile",
  "--dump-dom","--virtual-time-budget=15000",
  "http://localhost:5173/sub-app"
) -RedirectStandardOutput $dom -RedirectStandardError $log -Wait
```

实测抓到的子应用 DOM：

```html
<div class="sub-root">
  <header class="sub-header">
    <div class="sub-badge">sub</div>
    <h2>子应用 · 账户中心</h2>
    <p class="sub-meta">运行模式：<b>qiankun 微前端</b><span> · 宿主：qiankun-main-app</span></p>
  </header>
  <div class="sub-grid">
    <div class="sub-card"><h4>读取主应用状态</h4><p>用户：<b>张三</b></p><p>主题：<b>light</b></p></div>
    ...
  </div>
</div>
```

三个关键验证点：

| 验证点 | DOM 证据 | 说明 |
| --- | --- | --- |
| 子应用已挂载 | `<div class="sub-root">` 出现在主应用 DOM 内 | qiankun 生命周期正常 |
| 运行在微前端模式 | `运行模式：qiankun 微前端` | `__POWERED_BY_QIANKUN__` 为 true |
| props 传递成功 | `用户：张三`、`宿主：qiankun-main-app` | 主应用状态与标识已注入 |

生产构建也验证通过：

```
main-app: dist/index.html + 220 KB js
sub-app : dist/index.html + 68 KB js
```

---

## 八、生产部署

子应用的 `base` 在生产时为 `/sub-app/`，需要把 `dist` 部署到该子路径：

```
nginx/
├── dist-main/          -> /
└── dist-sub/           -> /sub-app/
```

nginx 关键配置（子应用静态资源要允许跨域，因为 qiankun 是 fetch 加载）：

```nginx
location /sub-app/ {
  alias /usr/share/nginx/html/dist-sub/;
  add_header Access-Control-Allow-Origin *;
  # history 路由回退
  try_files $uri $uri/ /sub-app/index.html;
}
```

主应用侧把 `entry` 改成生产地址：

```js
entry: process.env.NODE_ENV === 'production' ? '/sub-app/' : '//localhost:5174',
```

---

## 九、与其它方案的取舍

| 方案 | 优势 | 代价 |
| --- | --- | --- |
| qiankun（本示例） | 生态成熟、JS 沙箱 + 样式隔离、改动小 | Vite 需插件；跨应用通信靠 props/bus；无 HMR |
| Module Federation | 构建期共享依赖、原生 ESM | 需要统一构建工具版本，路由/沙箱要自己解决 |
| iframe | 隔离最彻底 | 通信麻烦、弹窗/路由受限、体验割裂 |
| Web Components | 标准化 | 生态与调试工具不成熟 |

**建议**：如果子应用技术栈统一且能用同一构建工具，优先 Module Federation；如果是接手异构老系统（Vue2/jQuery/React 混布），qiankun 更省改造量。

---

## 十、踩坑速查表

| 现象 | 大概率原因 | 处理 |
| --- | --- | --- |
| `Cannot use import statement outside a module` | `@vite/client` 被当普通脚本执行 | 从 HTML 移除该标签 |
| 白屏，`#qk-debug` 停在 `beforeLoad` | 入口 `import('/src/main.js')` 指到了主应用 | 改写成子应用完整 URL |
| 资源 404 `/sub-app/...` | `NODE_ENV` 污染导致 dev 用了生产 base | 改用 `mode` 判断 |
| `Cannot find package '@vitejs/plugin-vue'` | npm 全局 `omit=dev` | `npm install --include=dev` |
| `container not found` | qiankun 早于容器渲染启动 | 等 `router.isReady()` 后再 `start()` |
| 子应用样式污染主应用 | 未开启样式隔离 | `sandbox.experimentalStyleIsolation` 或 `strictStyleIsolation` |
