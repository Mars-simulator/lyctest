import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 主应用不需要被 qiankun 加载，但开放 CORS 便于本地联调
    cors: true,
    strictPort: true,
  },
});
