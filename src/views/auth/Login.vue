<template>
  <div class="auth-container">
    <div class="auth-card pixel-border">
      <div class="auth-header">
        <h1 class="auth-title">登录</h1>
        <div class="pixel-snake"></div>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
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

        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="auth-actions">
          <button type="submit" class="pixel-button" :disabled="isLoading">
            {{ isLoading ? "登录中..." : "登录" }}
          </button>
          <router-link to="/register" class="auth-link"
            >没有账号？注册</router-link
          >
        </div>
      </form>

      <!-- OAuth 登录部分 -->
      <div class="oauth-section" v-if="oauthProviders.length > 0">
        <div class="oauth-divider">
          <span>或使用以下方式登录</span>
        </div>
        <div class="oauth-buttons">
          <button
            v-for="provider in oauthProviders"
            :key="provider.id"
            @click="handleOAuthLogin(provider)"
            class="oauth-button pixel-button"
            :class="`oauth-${provider.id}`"
          >
            使用{{ provider.name }}登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../../stores/auth";
import { authService } from "../../services/api";
import { API_URL } from "../../services/httpClient";

const router = useRouter();
const { state, login } = useAuth();

const username = ref("");
const password = ref("");
const error = computed(() => state.error);
const isLoading = computed(() => state.loading);
const isAuthenticated = computed(() => state.isAuthenticated);
const oauthProviders = ref<{ id: string; name: string }[]>([]);

// 监听认证状态变化，自动跳转
watchEffect(() => {
  if (isAuthenticated.value) {
    console.log("检测到登录状态，跳转到主页");
    router.push("/");
  }
});

// 获取OAuth提供商列表
const getOAuthProviders = async () => {
  try {
    const response = await authService.getOAuthProviders();
    if (response.code === 200) {
      oauthProviders.value = response.data;
    }
  } catch (err) {
    console.error("获取OAuth提供商失败:", err);
  }
};

// 处理OAuth登录
const handleOAuthLogin = (provider: { id: string; name: string }) => {
  const redirectUrl = `${window.location.origin}/oauth-callback`;
  window.location.href = `${API_URL}/users/auth/oauth/login/${
    provider.id
  }?redirect_uri=${encodeURIComponent(redirectUrl)}`;
};

// 处理常规登录
const handleLogin = async () => {
  if (!username.value || !password.value) {
    return;
  }

  console.log("开始登录请求");
  const success = await login(username.value, password.value);
  console.log("登录请求完成, 成功状态:", success);

  if (success) {
    console.log("登录成功，跳转到主页");
    router.push("/");
  }
};

onMounted(() => {
  // 获取OAuth提供商列表
  getOAuthProviders();
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

.pixel-input {
  background-color: var(--input-bg);
  border: 3px solid var(--border-color);
  color: var(--text-color);
  padding: 10px;
  font-family: "Press Start 2P", monospace;
  font-size: 12px;
  width: 100%;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s;
}

.pixel-input:focus {
  border-color: var(--accent-color);
}

.pixel-button {
  background-color: var(--button-color);
  border: none;
  padding: 12px 20px;
  color: black;
  font-family: "Press Start 2P", monospace;
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

/* OAuth登录相关样式 */
.oauth-section {
  margin-top: 30px;
}

.oauth-divider {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  font-size: 10px;
  color: var(--text-color);
}

.oauth-divider::before,
.oauth-divider::after {
  content: "";
  flex: 1;
  height: 2px;
  background-color: var(--border-color);
}

.oauth-divider span {
  padding: 0 10px;
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oauth-button {
  width: 100%;
  font-size: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* RUC特定样式 */
.oauth-ruc {
  background-color: #e74c3c;
}

.oauth-ruc:hover:not(:disabled) {
  background-color: #c0392b;
}
</style>
