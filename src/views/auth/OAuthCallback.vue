<template>
  <div class="auth-container">
    <div class="auth-card pixel-border">
      <div class="auth-header">
        <h1 class="auth-title">认证中</h1>
        <div class="pixel-snake"></div>
      </div>
      
      <div class="oauth-message" :class="{ 'error': hasError }">
        {{ message }}
      </div>
      
      <div v-if="showEmailInfo" class="email-info">
        <p>您的账户邮箱: {{ userEmail }}</p>
      </div>
      
      <div class="auth-actions">
        <p class="redirect-message">{{ redirectMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { authService } from '../../services/api';

const router = useRouter();
const route = useRoute();

const message = ref('处理中...');
const redirectMessage = ref('正在重定向到主页...');
const hasError = ref(false);
const showEmailInfo = ref(false);
const userEmail = ref('');

// 处理OAuth回调
const handleOAuthCallback = async () => {
  const token = route.query.token as string;
  const error = route.query.error as string;
  const email = route.query.email as string;
  
  if (token) {
    // 存储token
    localStorage.setItem('accessToken', token);
    message.value = '登录成功！';
    
    // 如果有email，显示邮箱信息
    if (email) {
      showEmailInfo.value = true;
      userEmail.value = email;
    }
    
    try {
      // 获取用户信息
      const response = await authService.getCurrentUser();
      localStorage.setItem("userData", JSON.stringify(response));
    } catch (err) {
      console.error('获取用户信息失败:', err);
    }
    
    // 3秒后重定向到主页
    setTimeout(() => {
      router.push('/');
    }, 3000);
  } else if (error) {
    // 显示错误信息
    message.value = `登录失败: ${decodeURIComponent(error)}`;
    hasError.value = true;
    redirectMessage.value = '请重试登录';
    
    // 5秒后重定向到登录页
    setTimeout(() => {
      router.push('/login');
    }, 5000);
  } else {
    // 未获取到token或错误信息
    message.value = '登录请求未返回有效数据';
    hasError.value = true;
    redirectMessage.value = '即将返回登录页';
    
    // 3秒后重定向到登录页
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  }
};

onMounted(() => {
  handleOAuthCallback();
});
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.auth-card {
  background-color: var(--card-bg);
  width: 100%;
  max-width: 400px;
  padding: 30px;
  border-radius: 8px;
}

.pixel-border {
  position: relative;
  border: 4px solid var(--border-color);
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.2);
  image-rendering: pixelated;
}

.auth-header {
  margin-bottom: 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.auth-title {
  font-size: 24px;
  color: var(--accent-color);
  margin-bottom: 15px;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.pixel-snake {
  position: relative;
  width: 50px;
  height: 50px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  image-rendering: pixelated;
  transform: scale(0.8);
}

.pixel-snake::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 8px;
  background: linear-gradient(
    to right,
    var(--accent-color) 25%,
    transparent 25%,
    transparent 50%,
    var(--accent-color) 50%,
    var(--accent-color) 75%,
    transparent 75%
  );
  background-size: 16px 8px;
  transform: translateY(-50%);
}

.oauth-message {
  font-size: 14px;
  text-align: center;
  padding: 15px;
  margin-bottom: 20px;
  background-color: rgba(74, 222, 128, 0.1);
  border: 2px solid var(--accent-color);
  border-radius: 4px;
  color: var(--text-color);
}

.oauth-message.error {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
  color: var(--error-color);
}

.email-info {
  font-size: 12px;
  text-align: center;
  padding: 10px;
  margin-bottom: 20px;
  background-color: var(--input-bg);
  border-radius: 4px;
}

.auth-actions {
  text-align: center;
}

.redirect-message {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.7;
}
</style> 