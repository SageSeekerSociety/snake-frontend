import { apiClient, sandboxClient } from './httpClient';
import { authService } from './authService';
import { sandboxService } from './sandboxService';
import { avatarService } from './avatarService';

// 导出所有服务
export {
  apiClient,
  sandboxClient,
  authService,
  sandboxService,
  avatarService
};

// 为了向后兼容，也导出沙盒API的别名
export const sandboxApi = sandboxClient;

export default apiClient;