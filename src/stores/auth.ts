import { reactive, readonly } from 'vue';
import { authService } from '../services/api';
import { User } from '../types/User';

// 认证状态类型
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// 创建响应式状态
const state = reactive<AuthState>({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,
  error: null
});

// 恢复用户数据
const initializeAuth = () => {
  // 尝试从localStorage恢复用户数据
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      state.user = JSON.parse(userData);
      state.isAuthenticated = true;
    } catch (error) {
      // 数据解析错误，清除无效数据
      localStorage.removeItem('userData');
      localStorage.removeItem('accessToken');
    }
  }
};

// 调用恢复函数
initializeAuth();

// 操作方法
const actions = {
  // OAuth登录后更新状态
  updateAuthState: (user: User, token: string) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('userData', JSON.stringify(user));
    
    state.user = user;
    state.isAuthenticated = true;
    state.error = null;
  },

  // 注册方法
  async register(username: string, password: string, nickname: string, emailCode: string): Promise<boolean> {
    state.loading = true;
    state.error = null;
    
    try {
      // 生成邮箱（学号+@ruc.edu.cn）
      const email = `${username}@ruc.edu.cn`;
      
      console.log('注册请求数据:', { username, nickname, email, emailCode });
      
      const response = await authService.register({
        username,
        nickname,
        password,
        email,
        emailCode
      });
      
      console.log('注册请求响应:', response);
      
      if (response.code === 201) {
        const { accessToken, user } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userData', JSON.stringify(user));
        
        state.user = user;
        state.isAuthenticated = true;
        return true;
      } else {
        state.error = response.message || '注册失败';
        return false;
      }
    } catch (error: any) {
      console.error('注册请求错误:', error);
      state.error = error.response?.data?.message || '注册请求失败';
      return false;
    } finally {
      state.loading = false;
    }
  },
  
  // 登录方法
  async login(username: string, password: string): Promise<boolean> {
    state.loading = true;
    state.error = null;
    
    try {
      console.log('登录请求数据:', { username });
      
      const response = await authService.login({ username, password });
      
      console.log('登录请求响应:', response);
      
      if (response.code === 201) {
        const { accessToken, user } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userData', JSON.stringify(user));
        
        state.user = user;
        state.isAuthenticated = true;
        return true;
      } else {
        state.error = response.message || '登录失败';
        return false;
      }
    } catch (error: any) {
      console.error('登录请求错误:', error);
      state.error = error.response?.data?.message || '登录请求失败';
      return false;
    } finally {
      state.loading = false;
    }
  },
  
  // 登出方法
  async logout() {
    state.loading = true;
    
    try {
      await authService.logout();
    } catch (error) {
      // 即使退出请求失败，我们仍然清除本地状态
      console.error('退出请求失败，但仍然清除本地登录状态');
    } finally {
      // 清除本地存储和状态
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
      
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
    }
  },
  
  // 发送验证码
  async sendEmailCode(username: string) {
    try {
      const email = `${username}@ruc.edu.cn`;
      console.log('发送验证码:', email);
      return await authService.sendEmailCode(email);
    } catch (error: any) {
      console.error('发送验证码错误:', error);
      state.error = error.response?.data?.message || '发送验证码失败';
      throw error;
    }
  }
};

// 导出只读状态和操作方法
export const useAuth = () => {
  return {
    state: readonly(state),
    ...actions
  };
}; 