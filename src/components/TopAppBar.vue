<template>
  <div class="top-app-bar" v-if="shouldShowAppBar">
    <div class="app-bar-container">
      <div class="app-bar-left">
        <div class="app-bar-logo">
          <router-link to="/" class="logo-link">
            <span class="logo-text" @click.stop.prevent="onLogoTap">蛇王争霸</span>
          </router-link>
        </div>

        <div class="app-bar-nav">
          <router-link to="/" class="nav-link" :class="{ active: isActive('/') }">
            首页
          </router-link>
          <router-link to="/game" class="nav-link" :class="{ active: isActive('/game') }">
            游戏
          </router-link>
          <router-link to="/submit" class="nav-link" :class="{ active: isActive('/submit') }">
            提交算法
          </router-link>
          <router-link to="/recordings" class="nav-link" :class="{ active: isActive('/recordings') || isActive('/replay') }">
            对局记录
          </router-link>
          <router-link to="/rules" class="nav-link" :class="{ active: isActive('/rules') }">
            游戏规则
          </router-link>
        </div>
      </div>

      <div class="app-bar-user">
        <button
          v-if="showExport"
          class="export-zip-button"
          :disabled="exporting"
          @click="downloadLatestSources"
          title="导出最新源码Zip"
        >
          {{ exporting ? '导出中…' : '导出源码' }}
        </button>
        <template v-if="isAuthenticated">
          <div class="user-info">
            <router-link to="/profile" class="user-profile-link" title="编辑个人资料">
              <div class="user-avatar">
                <img :src="getAvatarUrl(avatarId)" alt="用户头像" class="avatar-image" />
              </div>
              <span class="user-name">{{ nickname }}</span>
            </router-link>
            <button @click="handleLogout" class="logout-button">
              <div class="logout-icon"></div>
            </button>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="login-button">
            登录
          </router-link>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { avatarService, sandboxService } from '../services/api';
import { RateLimitError } from '../types/RateLimitError';

const route = useRoute();
const router = useRouter();
const { state, logout } = useAuth();

const isAuthenticated = computed(() => state.isAuthenticated);
const nickname = computed(() => state.user?.nickname || '用户');
const avatarId = computed(() => state.user?.avatarId || 0);

// 根据路由判断是否显示顶部导航栏
const shouldShowAppBar = computed(() => {
  // 登录、注册等页面不显示顶部导航栏
  const hiddenRoutes = ['/login', '/register', '/oauth-callback', '/tournament/display'];
  return !hiddenRoutes.includes(route.path);
});

// 判断当前路由是否激活
const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

// 获取默认头像ID
const defaultAvatarId = ref(1); // 默认值为1

// 获取默认头像ID
const fetchDefaultAvatarId = async () => {
  // try {
  //   const response = await avatarService.getDefaultAvatarId();
  //   if (response.data && response.data.avatarId) {
  //     defaultAvatarId.value = response.data.avatarId;
  //   }
  // } catch (err) {
  //   console.error('获取默认头像ID失败:', err);
  // }
};

// 获取头像URL
const getAvatarUrl = (avatarId: number) => {
  // 如果没有头像ID，使用默认头像
  const id = avatarId || defaultAvatarId.value;
  return avatarService.getAvatarUrl(id);
};

// 在组件挂载时获取默认头像ID
onMounted(() => {
  fetchDefaultAvatarId();
  // 读取隐藏入口解锁状态
  try {
    if (localStorage.getItem('exportUnlocked') === '1') {
      showExport.value = true;
    }
  } catch {}
});

// 生成头像颜色（用于没有头像时的占位符）
const avatarColors = [
  "#4ade80", // 绿色
  "#ef4444", // 红色
  "#3b82f6", // 蓝色
  "#f59e0b", // 橙色
  "#8b5cf6", // 紫色
  "#10b981", // 深绿色
  "#06b6d4", // 青色
  "#f43f5e", // 粉色
  "#f97316", // 橙红色
  "#14b8a6"  // 蓝绿色
];

const getAvatarColor = (avatarId: number) => {
  return avatarColors[avatarId % avatarColors.length];
};

// 登出处理
const handleLogout = async () => {
  await logout();
  router.push('/login');
};

// 隐藏入口：连续点击 Logo 若干次显示导出按钮
const tapCount = ref(0);
const showExport = ref(false);
const exporting = ref(false);
let tapResetTimer: number | undefined;

const onLogoTap = () => {
  tapCount.value += 1;
  // 3 秒不再点击则重置计数，避免误触
  if (tapResetTimer) window.clearTimeout(tapResetTimer);
  tapResetTimer = window.setTimeout(() => (tapCount.value = 0), 3000);

  if (tapCount.value >= 7) {
    showExport.value = true;
    try { localStorage.setItem('exportUnlocked', '1'); } catch {}
  }
};

const downloadLatestSources = async () => {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const { blob, filename } = await sandboxService.downloadLatestSourcesZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'latest-sources.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds ? ` 请在 ${err.retryAfterSeconds}s 后重试。` : '';
      alert('导出频率过高。' + wait);
    } else if (err?.response?.status === 401) {
      alert('未授权或登录已过期，请重新登录。');
      router.push('/login');
    } else {
      console.error('导出失败:', err);
      alert('导出失败，请稍后重试。');
    }
  } finally {
    exporting.value = false;
  }
};
</script>

<style scoped>
.top-app-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background-color: var(--card-bg);
  border-bottom: 3px solid var(--border-color);
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
}

.app-bar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.app-bar-left {
  display: flex;
  align-items: center;
  gap: 30px;
}

.app-bar-logo {
  display: flex;
  align-items: center;
}

.logo-link {
  text-decoration: none;
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: 18px;
  color: var(--accent-color);
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.app-bar-nav {
  display: flex;
  gap: 20px;
}

.nav-link {
  color: var(--text-color);
  text-decoration: none;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.app-bar-user {
  display: flex;
  align-items: center;
}

.export-zip-button {
  margin-right: 8px;
  background-color: var(--accent-color);
  color: #000;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Press Start 2P', monospace;
  cursor: pointer;
  transition: all 0.2s;
}

.export-zip-button:hover:not(:disabled) {
  background-color: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.export-zip-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-profile-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.user-profile-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-weight: bold;
  font-size: 14px;
}

.user-name {
  font-size: 12px;
  color: var(--text-color);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-button {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
}

.logout-icon {
  width: 16px;
  height: 16px;
  background-color: var(--error-color);
  clip-path: polygon(
    0% 25%, 75% 25%, 75% 0%, 100% 50%,
    75% 100%, 75% 75%, 0% 75%
  );
}

.login-button {
  background-color: var(--accent-color);
  color: #000;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  text-decoration: none;
  font-family: 'Press Start 2P', monospace;
  transition: all 0.2s;
}

.login-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

/* 响应式样式 */
@media (max-width: 768px) {
  .app-bar-left {
    gap: 15px;
  }

  .app-bar-nav {
    gap: 10px;
  }

  .nav-link {
    font-size: 10px;
    padding: 4px 6px;
  }

  .user-name {
    display: none;
  }
}

@media (max-width: 480px) {
  .app-bar-container {
    padding: 0 10px;
  }

  .app-bar-left {
    gap: 10px;
  }

  .logo-text {
    font-size: 14px;
  }
}
</style>
