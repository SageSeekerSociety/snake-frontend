// src/runtime-config.d.ts

// 扩展全局的 Window 接口
declare global {
  interface Window {
    // 定义 runtimeConfig 对象的结构和类型
    runtimeConfig: {
      VITE_API_URL: string;
      VITE_SANDBOX_URL: string;
    };
  }
}

// 导出一个空对象以确保该文件被视为一个模块
export {};
