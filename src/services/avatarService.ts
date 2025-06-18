import { apiClient } from "./httpClient";

// 头像服务
export const avatarService = {
  /**
   * 获取可用的头像ID列表
   * @param type 头像类型，默认为predefined
   */
  getAvailableAvatarIds: async (type: string = "predefined") => {
    const response = await apiClient.get(`/avatars?type=${type}`);
    return response.data;
  },

  /**
   * 上传自定义头像
   * @param avatarFile 头像文件
   */
  uploadAvatar: async (avatarFile: File) => {
    const formData = new FormData();
    formData.append("avatar", avatarFile);

    const response = await apiClient.post("/avatars", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * 获取默认头像ID
   */
  getDefaultAvatarId: async () => {
    const response = await apiClient.get("/avatars/default/id");
    return response.data;
  },

  /**
   * 获取头像图片URL
   * @param avatarId 头像ID
   */
  getAvatarUrl: (avatarId: number) => {
    return `${apiClient.defaults.baseURL}/avatars/${avatarId}`;
  }
};
