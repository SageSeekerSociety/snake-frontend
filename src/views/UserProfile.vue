<template>
  <div class="profile-container container-base">
    <div class="profile-card content-card">
      <h1 class="profile-title">个人资料</h1>

      <div class="avatar-section">
        <div class="current-avatar">
          <img :src="getAvatarUrl(form.avatarId || defaultAvatarId)" alt="用户头像" class="avatar-image" />
        </div>

        <div class="avatar-tabs">
          <button
            class="tab-button"
            :class="{ 'active': activeTab === 'predefined' }"
            @click="activeTab = 'predefined'"
          >
            系统头像
          </button>
          <button
            class="tab-button"
            :class="{ 'active': activeTab === 'upload' }"
            @click="activeTab = 'upload'"
          >
            上传头像
          </button>
        </div>

        <!-- 系统头像选择 -->
        <div v-if="activeTab === 'predefined'" class="avatar-content">
          <div v-if="isLoadingAvatars" class="loading-message">
            <div class="pixel-spinner"></div>
            加载头像中...
          </div>
          <div v-else-if="avatarError" class="error-message">
            {{ avatarError }}
          </div>
          <div v-else class="avatar-options">
            <div
              v-for="id in availableAvatarIds"
              :key="id"
              class="avatar-option"
              :class="{ 'selected': form.avatarId === id }"
              @click="form.avatarId = id"
            >
              <img :src="getAvatarUrl(id)" alt="头像选项" class="avatar-image" />
            </div>
          </div>
        </div>

        <!-- 上传头像 -->
        <div v-if="activeTab === 'upload'" class="upload-avatar-section">
          <label for="avatarFile" class="file-label" :class="{ 'has-file': !!selectedAvatarFile }">
            <div class="file-icon"></div>
            <div class="file-text">
              {{ selectedAvatarFile ? selectedAvatarFile.name : '点击选择图片文件' }}
            </div>
            <input
              type="file"
              id="avatarFile"
              accept="image/*"
              @change="handleAvatarFileChange"
              class="file-input"
            />
          </label>

          <div v-if="selectedAvatarFile" class="preview-section">
            <div class="preview-title">预览</div>
            <div class="avatar-preview">
              <img :src="avatarPreviewUrl" alt="头像预览" class="avatar-image" />
            </div>
            <button
              @click="uploadAvatarFile"
              class="pixel-button upload-button"
              :disabled="isUploading"
            >
              {{ isUploading ? '上传中...' : '上传头像' }}
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="nickname">昵称</label>
        <input
          type="text"
          id="nickname"
          class="pixel-input"
          v-model="form.nickname"
          placeholder="请输入昵称"
          maxlength="20"
        />
      </div>

      <div class="form-group">
        <label for="intro">个人简介</label>
        <textarea
          id="intro"
          class="pixel-input profile-textarea"
          v-model="form.intro"
          placeholder="请输入个人简介"
          maxlength="200"
          rows="4"
        ></textarea>
        <div class="char-count">{{ form.intro.length }}/200</div>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="success" class="success-message">{{ success }}</div>

      <div class="profile-actions">
        <button @click="goBack" class="pixel-button cancel-button">取消</button>
        <button @click="saveProfile" class="pixel-button" :disabled="isSubmitting">
          {{ isSubmitting ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { authService, avatarService } from '../services/api';

const router = useRouter();
const { state } = useAuth();

const form = ref({
  nickname: '',
  intro: '',
  avatarId: 0
});

const error = ref('');
const success = ref('');
const isSubmitting = ref(false);
const isLoadingAvatars = ref(true);
const avatarError = ref('');
const availableAvatarIds = ref<number[]>([]);
const activeTab = ref('predefined');
const selectedAvatarFile = ref<File | null>(null);
const avatarPreviewUrl = ref('');
const isUploading = ref(false);
const defaultAvatarId = ref(1); // 默认头像ID

// 生成头像颜色
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

// 获取头像URL
const getAvatarUrl = (avatarId: number) => {
  return avatarService.getAvatarUrl(avatarId);
};

// 获取默认头像ID
const getDefaultAvatarId = async () => {
  try {
    const response = await avatarService.getDefaultAvatarId();
    if (response.data && response.data.avatarId) {
      return response.data.avatarId;
    }
  } catch (err) {
    console.error('获取默认头像ID失败:', err);
  }
  return 1; // 如果获取失败，返回默认值1
};

// 获取可用的头像ID列表
const fetchAvatarIds = async () => {
  isLoadingAvatars.value = true;
  avatarError.value = '';

  try {
    // 获取默认头像ID
    const defaultId = await getDefaultAvatarId();
    defaultAvatarId.value = defaultId;

    // 获取可用头像列表
    const response = await avatarService.getAvailableAvatarIds();
    if (response.data && response.data.avatarIds) {
      // 检查默认头像是否已经在列表中
      const avatarIds = response.data.avatarIds;
      if (!avatarIds.includes(defaultId)) {
        // 如果默认头像不在列表中，添加它
        avatarIds.unshift(defaultId);
      }
      availableAvatarIds.value = avatarIds;
    } else {
      // 如果API返回为空，使用默认的10个头像ID
      availableAvatarIds.value = Array.from({ length: 10 }, (_, i) => i);
    }
  } catch (err: any) {
    console.error('获取头像列表失败:', err);
    avatarError.value = '获取头像列表失败，使用默认头像';
    // 使用默认的10个头像ID
    availableAvatarIds.value = Array.from({ length: 10 }, (_, i) => i);
  } finally {
    isLoadingAvatars.value = false;
  }
};

// 处理头像文件选择
const handleAvatarFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      error.value = '请选择图片文件';
      selectedAvatarFile.value = null;
      avatarPreviewUrl.value = '';
      return;
    }

    // 检查文件大小（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
      error.value = '图片文件过大，请选择小于2MB的文件';
      selectedAvatarFile.value = null;
      avatarPreviewUrl.value = '';
      return;
    }

    selectedAvatarFile.value = file;

    // 创建预览URL
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value);
    }
    avatarPreviewUrl.value = URL.createObjectURL(file);

    error.value = '';
  }
};

// 上传头像文件
const uploadAvatarFile = async () => {
  if (!selectedAvatarFile.value) {
    error.value = '请先选择头像文件';
    return;
  }

  isUploading.value = true;
  error.value = '';

  try {
    const response = await avatarService.uploadAvatar(selectedAvatarFile.value);

    if (response && response.id) {
      // 上传成功，设置新的头像ID
      form.value.avatarId = response.id;
      success.value = '头像上传成功';

      // 清理预览
      if (avatarPreviewUrl.value) {
        URL.revokeObjectURL(avatarPreviewUrl.value);
        avatarPreviewUrl.value = '';
      }
      selectedAvatarFile.value = null;

      // 切换回预定义头像标签页，这样用户可以看到自己上传的头像
      activeTab.value = 'predefined';

      // 重新加载可用头像列表，以包含新上传的头像
      await fetchAvatarIds();
    } else {
      error.value = '头像上传失败，请重试';
    }
  } catch (err: any) {
    console.error('上传头像出错:', err);
    error.value = err.response?.data?.message || '上传头像失败';
  } finally {
    isUploading.value = false;
  }
};

// 获取当前用户ID
const userId = computed(() => state.user?.userId || 0);

// 加载用户信息
const loadUserInfo = async () => {
  if (!state.user) {
    router.push('/login');
    return;
  }

  form.value.nickname = state.user.nickname || '';
  form.value.intro = state.user.intro || '';
  form.value.avatarId = state.user.avatarId || 0;
};

// 保存用户信息
const saveProfile = async () => {
  error.value = '';
  success.value = '';

  // 表单验证
  if (!form.value.nickname.trim()) {
    error.value = '昵称不能为空';
    return;
  }

  if (!form.value.intro.trim()) {
    error.value = '个人简介不能为空';
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await authService.updateUserInfo(userId.value, {
      nickname: form.value.nickname,
      intro: form.value.intro,
      avatarId: form.value.avatarId
    });

    if (response.code === 200) {
      success.value = '个人资料更新成功';

      // 更新本地存储的用户数据
      if (state.user) {
        const updatedUser = {
          ...state.user,
          nickname: form.value.nickname,
          intro: form.value.intro,
          avatarId: form.value.avatarId
        };

        localStorage.setItem('userData', JSON.stringify(updatedUser));

        // 延迟返回，让用户看到成功消息
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } else {
      error.value = response.message || '更新失败，请重试';
    }
  } catch (err: any) {
    console.error('更新用户信息出错:', err);
    error.value = err.response?.data?.message || '更新请求失败';
  } finally {
    isSubmitting.value = false;
  }
};

// 返回上一页
const goBack = () => {
  // 清理预览URL
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
  }
  router.back();
};

onMounted(() => {
  loadUserInfo();
  fetchAvatarIds();
});

// 组件卸载时清理资源
onUnmounted(() => {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
  }
});
</script>

<style scoped>
.profile-container {
  align-items: flex-start;
}

.profile-card {
  width: 100%;
  max-width: 600px;
  padding: 30px;
}

.profile-title {
  font-size: 24px;
  color: var(--accent-color);
  text-align: center;
  margin-bottom: 30px;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  width: 100%;
}

.current-avatar {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 4px solid var(--border-color);
  background-color: var(--input-bg);
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
  font-size: 36px;
  color: var(--text-color);
  background-color: var(--input-bg);
}

.avatar-tabs {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.tab-button {
  padding: 8px 16px;
  background-color: var(--input-bg);
  border: 2px solid var(--border-color);
  color: var(--text-color);
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button.active {
  background-color: var(--accent-color);
  color: #000;
  border-color: var(--accent-color);
}

.avatar-content {
  width: 100%;
  margin-top: 15px;
}

.avatar-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 400px;
}

.avatar-option {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.avatar-option:hover {
  transform: scale(1.1);
}

.avatar-option.selected {
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
}

.upload-avatar-section {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 15px;
}

.file-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  background-color: var(--input-bg);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-label:hover {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.05);
}

.file-label.has-file {
  border-style: solid;
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
}

.file-icon {
  width: 32px;
  height: 40px;
  background-color: var(--border-color);
  position: relative;
}

.file-icon::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: var(--bg-color);
  clip-path: polygon(0 0, 100% 100%, 100% 0);
}

.file-text {
  font-size: 12px;
  color: var(--text-color);
  text-align: center;
}

.file-input {
  display: none;
}

.preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.preview-title {
  font-size: 14px;
  color: var(--accent-color);
}

.avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.upload-button {
  font-size: 12px;
  padding: 8px 16px;
}

.loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-color);
  font-size: 14px;
}

.pixel-spinner {
  width: 24px;
  height: 24px;
  background-color: var(--accent-color);
  animation: pixel-spin 1s steps(8) infinite;
}

@keyframes pixel-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.form-group {
  margin-bottom: 20px;
  width: 100%;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--accent-color);
}

.pixel-input {
  width: 100%;
  padding: 12px;
  background-color: var(--input-bg);
  border: 2px solid var(--border-color);
  color: var(--text-color);
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}

.pixel-input:focus {
  border-color: var(--accent-color);
}

.profile-textarea {
  resize: none;
  min-height: 100px;
}

.char-count {
  text-align: right;
  font-size: 10px;
  color: var(--border-color);
  margin-top: 5px;
}

.profile-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
}

.cancel-button {
  background-color: var(--border-color);
}

.error-message {
  color: var(--error-color);
  font-size: 12px;
  margin: 10px 0;
  text-align: center;
}

.success-message {
  color: var(--success-color);
  font-size: 12px;
  margin: 10px 0;
  text-align: center;
}

/* 响应式样式 */
@media (max-width: 600px) {
  .profile-card {
    padding: 20px;
  }

  .avatar-options {
    max-width: 300px;
  }

  .avatar-option {
    width: 50px;
    height: 50px;
  }

  .tab-button {
    font-size: 8px;
    padding: 6px 10px;
  }
}
</style>
