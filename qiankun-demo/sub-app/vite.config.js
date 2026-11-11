import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import qiankun from 'vite-plugin-qiankun';

const DEV_ORIGIN = 'http://localhost:5174';

/**
 * Vite + qiankun 在 dev 模式下的两个已知问题：
 *
 * 1. Vite 会往 HTML 注入 `<script type="module" src="/@vite/client">`，
 *    qiankun 的 import-html-entry 把脚本当普通 script 执行，
 *    而 /@vite/client 内部是 ESM 静态 import → 报
 *    "Cannot use import statement outside a module"。
 *
 * 2. 插件生成的入口是 `import('/src/main.js')`，这个绝对路径在 qiankun 沙箱里
 *    会以「主应用的 origin」为基准解析，实际请求到 http://localhost:5173/src/main.js，
 *    导致子应用的生命周期永远注册不上（表现为卡在 bootstrap，页面空白）。
 *    因此需要把入口改写成子应用的完整地址。
 */
function qiankunDevFixes() {
  return {
    name: 'qiankun-dev-fixes',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/\s*<script type="module" src="\/@vite\/client"><\/script>/, '')
        .replace(/import\('\/src\/main\.js'\)/g, `import('${DEV_ORIGIN}/src/main.js')`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  // 生产部署在 /sub-app/ 子路径，开发时用根路径
  base: mode === 'production' ? '/sub-app/' : '/',
  plugins: [
    vue(),
    // 第一个参数必须与主应用 registerMicroApps 里的 name 完全一致
    qiankun('sub-app', { useDevMode: true }),
    qiankunDevFixes(),
  ],
  server: {
    port: 5174,
    // 主应用要跨域 fetch 子应用的 HTML 与资源，必须开 CORS
    cors: true,
    // 显式声明 origin，避免 dev 模式下资源地址被解析成相对路径
    origin: DEV_ORIGIN,
    strictPort: true,
  },
}));
