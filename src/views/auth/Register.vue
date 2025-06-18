<template>
  <div class="auth-container">
    <div class="auth-card pixel-border">
      <div class="auth-header">
        <h1 class="auth-title">注册</h1>
        <div class="pixel-snake"></div>
      </div>
      
      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label for="username">学号：</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            class="pixel-input" 
            placeholder="请输入学号"
            required
          />
          <small class="form-hint">注册后将用于登录，邮箱自动使用学号@ruc.edu.cn</small>
        </div>
        
        <div class="form-group">
          <label for="nickname">昵称：</label>
          <input 
            type="text" 
            id="nickname" 
            v-model="nickname" 
            class="pixel-input" 
            placeholder="请输入昵称"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="password">密码：</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            class="pixel-input" 
            placeholder="请输入密码"
            required
          />
        </div>
        
        <div class="form-group">
          <div class="captcha-container">
            <label for="emailCode">验证码：</label>
            <div class="captcha-input-group">
              <input 
                type="text" 
                id="emailCode" 
                v-model="emailCode" 
                class="pixel-input captcha-input" 
                placeholder="请输入验证码"
                required
              />
              <button 
                type="button" 
                class="pixel-button captcha-button" 
                @click="handleSendCode" 
                :disabled="countdown > 0 || !username || isLoading"
              >
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="auth-actions">
          <button type="submit" class="pixel-button" :disabled="isLoading">
            {{ isLoading ? '注册中...' : '注册' }}
          </button>
          <router-link to="/login" class="auth-link">已有账号？登录</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../stores/auth';

const router = useRouter();
const { state, register, sendEmailCode } = useAuth();

const username = ref('');
const nickname = ref('');
const password = ref('');
const emailCode = ref('');
const countdown = ref(0);
const error = computed(() => state.error);
const isLoading = computed(() => state.loading);
const isAuthenticated = computed(() => state.isAuthenticated);

// 监听认证状态变化，自动跳转
watchEffect(() => {
  if (isAuthenticated.value) {
    console.log('检测到注册后登录状态，跳转到主页');
    router.push('/');
  }
});

const handleSendCode = async () => {
  if (!username.value) {
    return;
  }
  
  try {
    await sendEmailCode(username.value);
    startCountdown();
  } catch (err) {
    // 错误已在 sendEmailCode 中处理
  }
};

const startCountdown = () => {
  countdown.value = 60;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleRegister = async () => {
  if (!username.value || !nickname.value || !password.value || !emailCode.value) {
    return;
  }
  
  console.log('开始注册请求');
  const success = await register(username.value, password.value, nickname.value, emailCode.value);
  console.log('注册请求完成, 成功状态:', success);
  
  if (success) {
    console.log('注册成功，跳转到主页');
    router.push('/');
  }
};
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

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 12px;
  color: var(--text-color);
}

.form-hint {
  font-size: 8px;
  color: var(--border-color);
  margin-top: 4px;
}

.pixel-input {
  background-color: var(--input-bg);
  border: 3px solid var(--border-color);
  color: var(--text-color);
  padding: 10px;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  width: 100%;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s;
}

.pixel-input:focus {
  border-color: var(--accent-color);
}

.captcha-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.captcha-input-group {
  display: flex;
  gap: 10px;
}

.captcha-input {
  flex: 1;
}

.captcha-button {
  font-size: 8px;
  padding: 8px;
  min-width: 100px;
  height: 100%;
}

.pixel-button {
  background-color: var(--button-color);
  border: none;
  padding: 12px 20px;
  color: black;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  text-transform: uppercase;
  box-shadow: 0px 4px 0px rgba(0, 0, 0, 0.2);
}

.pixel-button:hover:not(:disabled) {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0px 6px 0px rgba(0, 0, 0, 0.2);
}

.pixel-button:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0px 0px 0px rgba(0, 0, 0, 0.2);
}

.pixel-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.auth-link {
  color: var(--accent-color);
  text-decoration: none;
  font-size: 10px;
  transition: all 0.2s;
}

.auth-link:hover {
  text-decoration: underline;
  color: var(--button-hover);
}

.error-message {
  color: var(--error-color);
  font-size: 10px;
  text-align: center;
  padding: 5px;
  border: 2px solid var(--error-color);
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
}
</style> 