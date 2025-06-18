import { apiClient } from "./httpClient";
import { User } from "../types/User";
import { ApiResponse } from "../types/Api";

// 用户认证服务
export const authService = {
  /**
   * 用户注册
   * @param userData 用户注册信息
   */
  register: async (userData: {
    username: string;
    nickname: string;
    password: string;
    email: string;
    emailCode: string;
  }) => {
    const response = await apiClient.post("/users", userData);
    return response.data;
  },

  /**
   * 用户登录
   * @param credentials 登录凭证
   */
  login: async (credentials: { username: string; password: string }) => {
    const response = await apiClient.post("/users/auth/login", credentials, {
      withCredentials: true,
    });
    return response.data;
  },

  /**
   * 用户登出
   */
  logout: async () => {
    const response = await apiClient.post("/users/auth/logout", null, {
      withCredentials: true,
    });
    return response.data;
  },

  /**
   * 发送邮箱验证码
   * @param email 邮箱地址
   */
  sendEmailCode: async (email: string) => {
    const response = await apiClient.post(
      "/users/verify/email",
      { email },
      { withCredentials: true }
    );
    return response.data;
  },

  /**
   * 获取指定用户信息
   * @param userId 用户ID
   */
  getUserInfo: async (userId: number) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  /**
   * 获取OAuth提供商列表
   */
  getOAuthProviders: async () => {
    const response = await apiClient.get("/users/auth/oauth/providers");
    return response.data;
  },

  /**
   * 获取当前登录用户信息
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>(
      "/users/me"
    );
    return response.data.data.user;
  },

  /**
   * 更新用户信息
   * @param userId 用户ID
   * @param userData 更新的用户数据
   */
  updateUserInfo: async (userId: number, userData: {
    nickname: string;
    intro: string;
    avatarId: number;
  }) => {
    const response = await apiClient.put(`/users/${userId}`, userData);
    return response.data;
  },

  /**
   * 获取可用的头像ID列表
   * @param type 头像类型，默认为 'predefined'
   */
  getAvailableAvatarIds: async (type: string = 'predefined') => {
    const response = await apiClient.get('/avatars', {
      params: { type }
    });
    return response.data;
  },

  /**
   * 上传自定义头像
   * @param avatarFile 头像图片文件
   */
  uploadAvatar: async (avatarFile: File) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await apiClient.post('/avatars', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
};
