import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    // gzip压缩（nginx支持静态预压缩）
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
    // 使用esbuild（比terser快20-40倍，Vite 6默认推荐）
    minify: 'esbuild',
    
    // 现代浏览器目标（减小bundle大小）
    target: 'es2022',
    
    // 块大小警告阈值
    chunkSizeWarningLimit: 1000,
    
    // 构建优化
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // 将Vue相关库单独打包
          vue: ['vue', 'vue-router'],
          // 将大型依赖库单独打包
          vendor: ['axios'],
        },
      },
    },
    
    // 生产环境不生成source map（提升构建速度和安全性）
    sourcemap: false,
    
    // 内联小于4KB的资源为base64（默认值，显式声明）
    assetsInlineLimit: 4096,
  },
  
  // esbuild配置（替代terser的console删除）
  esbuild: {
    // 生产环境移除console和debugger
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  
  // 依赖优化
  optimizeDeps: {
    // 预构建包含的依赖
    include: ['vue', 'vue-router'],
  },
});
