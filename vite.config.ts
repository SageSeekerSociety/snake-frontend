import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    // 只启用gzip压缩（标准nginx支持）
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
