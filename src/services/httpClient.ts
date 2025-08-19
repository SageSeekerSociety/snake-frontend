import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import router from "../router";

const runtimeConfig = window.runtimeConfig || {
  VITE_API_URL:
    import.meta.env.VITE_API_URL || "http://localhost:8080/api/cheese-auth",
  VITE_SANDBOX_URL:
    import.meta.env.VITE_SANDBOX_URL || "http://localhost:8080/api/sandbox",
};

const API_URL = runtimeConfig.VITE_API_URL;
const SANDBOX_URL = runtimeConfig.VITE_SANDBOX_URL;

// 创建主API客户端实例
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 创建沙盒API客户端实例
export const sandboxClient = axios.create({
  baseURL: SANDBOX_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 刷新token相关变量
let isRefreshing = false;
let failedQueue: {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}[] = [];

// 处理刷新完成后的请求队列
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// 统一的刷新token函数
export const refreshToken = async (): Promise<string> => {
  try {
    const response = await axios.post(
      `${API_URL}/users/auth/refresh-token`,
      null,
      {
        withCredentials: true,
      }
    );

    if (response.data.code === 201) {
      const { accessToken } = response.data.data;
      localStorage.setItem("accessToken", accessToken);

      // 更新所有axios实例的默认头部
      apiClient.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${accessToken}`;
      sandboxClient.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${accessToken}`;

      return accessToken;
    }
    throw new Error("刷新token失败: 服务器返回错误码");
  } catch (error) {
    console.error("刷新token失败:", error);
    // 清除本地凭证
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userData");

    // 重定向到登录页面
    router.push("/login");
    throw error;
  }
};

// 通用请求拦截器
const setupRequestInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

// 通用响应拦截器
const setupResponseInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // 如果是刷新token的请求被拒绝，直接登出不再尝试刷新
      if (
        error.response?.status === 401 &&
        originalRequest.url?.includes("/users/auth")
      ) {
        console.error("刷新token请求被拒绝，直接登出");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userData");
        router.push("/login");
        return Promise.reject(error);
      }

      // 如果响应状态码为401且未尝试过刷新token
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // 如果已经在刷新，将请求加入队列
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((_token) => {
              return instance(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const token = await refreshToken();
          processQueue(null, token);
          return instance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          console.error("刷新token失败，原始请求将被拒绝:", refreshError);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
};

// 为两个API客户端实例设置拦截器
setupRequestInterceptor(apiClient);
setupResponseInterceptor(apiClient);
setupRequestInterceptor(sandboxClient);
setupResponseInterceptor(sandboxClient);
