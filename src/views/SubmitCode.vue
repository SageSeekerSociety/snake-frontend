<template>
  <div class="submit-container container-base">
    <div class="submit-card pixel-border">
      <div class="submit-header">
        <h1 class="submit-title">提交算法</h1>
        <div class="pixel-snake"></div>
      </div>

      <div class="submit-content">
        <div v-if="!isCompilingUI && !hasResult" class="upload-section">
          <label for="codeFile" class="file-label pixel-border"
            :class="{ 'has-file': !!selectedFile, dragging: isDragging, uploading: isUploading }"
            :style="isUploading ? { '--upload-progress': uploadProgress + '%' } : {}" @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
            <div class="file-icon"></div>
            <div class="file-content">
              <template v-if="selectedFile">
                <div class="file-name" :title="selectedFile.name">{{ selectedFile.name }}</div>
                <div class="file-meta">
                  <span class="meta-chip">大小: {{ formatFileSize(selectedFile.size) }}</span>
                  <span class="meta-chip">最后修改: {{ formatDate(selectedFile.lastModified) }}</span>
                </div>
              </template>
              <template v-else>
                <div class="file-text">{{ isUploading ? '上传中...' : '点击选择 .cpp 源代码文件' }}</div>
                <div class="file-hint">{{ isUploading ? `${uploadProgress}%` : '仅支持 .cpp，最大 1MB' }}</div>
              </template>
            </div>
            <div v-if="selectedFile" class="file-actions">
              <button class="pixel-link-button small" type="button"
                @click.stop.prevent="triggerChooseFile">更换文件</button>
              <button class="pixel-link-button danger small" type="button" @click.stop.prevent="clearFile">清除</button>
            </div>
            <input type="file" id="codeFile" accept=".cpp" @change="handleFileChange" class="file-input"
              ref="fileInputRef" />
          </label>

          <div class="submit-actions">
            <button @click="handleSubmit" class="pixel-button"
              :disabled="isUploading || !selectedFile || rateLimitCountdown > 0">
              {{ isUploading ? '上传中...' : rateLimitCountdown > 0 ? `等待${rateLimitCountdown}秒` : '提交代码' }}
            </button>
          </div>

          <!-- 显示所有上传阶段的错误（文件类型、大小、429等） -->
          <div v-if="error" :class="['error-message', { 'rate-limit-error': rateLimitCountdown > 0 }]">
            {{ rateLimitCountdown > 0 ? `请求频率过高，请${rateLimitCountdown}秒后重试` : error }}
          </div>
        </div>

        <!-- 编译/结果区域：在上传完成后或 SUBMITTED 后进入显示（统一使用状态条样式） -->
        <div v-if="isCompilingUI || compilationStatus" class="result-section">
          <!-- 统一的状态条（编译中/成功/失败） -->
          <div class="status-bar pixel-border" :class="statusBarClass">
            <div class="status-icon" :class="statusIconClass"></div>
            <div class="status-info">
              <div class="status-text">{{ effectiveStatusText }}</div>
              <div v-if="jobId" class="job-id">ID: {{ jobId }}</div>
            </div>
            <div v-if="compilationTime && hasResult" class="compilation-time">{{ compilationTime }}</div>
          </div>

          <!-- 编译输出 -->
          <div v-if="compilationOutput" class="console-output pixel-border">
            <div class="console-header">
              <div class="console-title">编译输出</div>
              <div class="console-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
            <pre class="console-content">{{ compilationOutput }}</pre>
          </div>

          <!-- 操作区：编译中与结果阶段都提供便捷操作 -->
          <div v-if="isCompilingUI && !hasResult" class="result-actions">
            <button class="pixel-link-button danger small" @click="cancelAndReselect">取消并重新选择</button>
          </div>

          <div v-if="hasResult" class="result-actions">
            <button class="pixel-link-button danger" @click="reselectFile">重新选择文件</button>
            <router-link to="/" class="pixel-link-button">返回首页</router-link>
          </div>
        </div>
      </div>

      <!-- 提交须知：在编译/结果阶段隐藏，保持界面简洁聚焦 -->
      <div v-if="!isCompilingUI && !hasResult" class="submit-footer">
        <div class="rules-section">
          <h3 class="rules-title">提交须知</h3>
          <ul class="rules-list">
            <li>仅支持提交单个 C++ 文件</li>
            <li>查看<router-link to="/rules" class="pixel-link">规则文档</router-link>了解更多</li>
          </ul>
        </div>

        <div class="actions-container">
          <router-link to="/" class="pixel-link-button">返回首页</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed, nextTick } from 'vue';
import { sandboxService } from '../services/sandboxService';
import { useAuth } from '../stores/auth';
import { SSE } from 'sse.js';
import { RateLimitError } from '../types/RateLimitError';

const { state } = useAuth();

const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const uploadProgress = ref(0);
const error = ref<string | null>(null);
const isUploading = ref(false);
const isSubmitting = ref(false);
const compilationStatus = ref<'success' | 'error' | 'compiling' | null>(null);
const compilationOutput = ref<string | null>(null);
const compilationTime = ref<string | null>(null);
const statusText = ref<string | null>(null);
const jobId = ref<string | null>(null);
const rateLimitCountdown = ref<number>(0);
const rateLimitTimer = ref<number | null>(null);

const statusBarClass = computed(() => {
  if (hasResult.value && compilationStatus.value) {
    return `status-${compilationStatus.value}`;
  }
  if (isCompilingUI.value) return 'status-compiling';
  return '';
});

const statusIconClass = computed(() => {
  if (hasResult.value && compilationStatus.value) {
    return `icon-${compilationStatus.value}`;
  }
  if (isCompilingUI.value) return 'icon-compiling';
  return '';
});
const sseSource = ref<SSE | null>(null);

// UI 阶段状态
const isCompiling = computed(() => compilationStatus.value === 'compiling');
const hasResult = computed(() => compilationStatus.value === 'success' || compilationStatus.value === 'error');
const hasJobId = computed(() => !!jobId.value);
// 显示编译界面：有jobId但还没有最终结果
const isCompilingUI = computed(() => hasJobId.value && !hasResult.value);
const compilingHint = computed(() => (isCompiling.value ? '请稍候，正在编译...' : '上传完成，等待编译开始...'));
const effectiveStatusText = computed(() => statusText.value || compilingHint.value);

const closeSSEConnection = () => {
  if (sseSource.value) {
    sseSource.value.close();
    sseSource.value = null;
  }
  isUploading.value = false;
  isSubmitting.value = false;
};

const clearRateLimitTimer = () => {
  if (rateLimitTimer.value) {
    clearInterval(rateLimitTimer.value);
    rateLimitTimer.value = null;
  }
  rateLimitCountdown.value = 0;
};

const startRateLimitCountdown = (seconds: number) => {
  clearRateLimitTimer();
  rateLimitCountdown.value = seconds;

  rateLimitTimer.value = setInterval(() => {
    rateLimitCountdown.value--;
    if (rateLimitCountdown.value <= 0) {
      clearRateLimitTimer();
      // 倒计时结束时清除错误信息
      if (error.value?.includes('请求频率过高')) {
        error.value = null;
      }
    }
  }, 1000);
};

const resetSubmitArea = () => {
  closeSSEConnection();
  isUploading.value = false;
  isSubmitting.value = false;
};

const processFile = (file: File) => {
  // 检查文件类型
  const allowedExtensions = ['.cpp'];
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    error.value = `不支持的文件类型: ${fileExtension}。仅支持 .cpp 源代码文件`;
    selectedFile.value = null;
    return;
  }

  // 检查文件大小（最大1MB）
  if (file.size > 1024 * 1024) {
    error.value = '文件太大，请上传小于1MB的文件';
    selectedFile.value = null;
    return;
  }

  selectedFile.value = file;
  error.value = null;
  compilationStatus.value = null;
  compilationOutput.value = null;
  compilationTime.value = null;
  statusText.value = null;
  uploadProgress.value = 0;
};

const handleFileChange = (event: Event) => {
  closeSSEConnection(); // 关闭之前的SSE连接
  jobId.value = null; // 重置作业ID
  compilationStatus.value = null; // 重置编译状态
  compilationOutput.value = null;
  compilationTime.value = null;
  statusText.value = null;
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    processFile(input.files[0]);
  } else {
    selectedFile.value = null;
  }
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    closeSSEConnection();
    jobId.value = null;
    compilationStatus.value = null; // 重置编译状态
    compilationOutput.value = null;
    compilationTime.value = null;
    statusText.value = null;
    processFile(file);
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
};

const triggerChooseFile = () => {
  fileInputRef.value?.click();
};

const clearFile = () => {
  closeSSEConnection();
  clearRateLimitTimer();
  selectedFile.value = null;
  error.value = null;
  compilationStatus.value = null;
  compilationOutput.value = null;
  compilationTime.value = null;
  statusText.value = null;
  jobId.value = null; // 重置jobId
  uploadProgress.value = 0;
  if (fileInputRef.value) fileInputRef.value.value = '';
};

// 重新选择：清空并自动打开文件选择器，确保读取本地最新内容
const reselectFile = async () => {
  clearFile();
  await nextTick();
  fileInputRef.value?.click();
};

// 取消并重新选择：中断监听后直接打开文件选择器
const cancelAndReselect = () => {
  reselectFile();
};

const handleSSEMessages = (data: any) => {
  console.log('收到SSE消息:', data);

  if (data && typeof data === 'object') {
    const status = data.status;
    const eventType = data.eventType;

    // 更新jobId
    if (data.jobId && !jobId.value) {
      jobId.value = data.jobId;
    }

    // 根据事件类型处理
    if (eventType === 'SUBMITTED') {
      compilationStatus.value = 'compiling';
      statusText.value = '代码已提交，正在编译...';
      isUploading.value = false;
      isSubmitting.value = true;
    }
    else if (eventType === 'STATUS_UPDATE') {
      if (status === 'SUCCESS') {
        compilationStatus.value = 'success';
        statusText.value = '编译成功';
      } else if (status === 'FAILED' || status === 'ERROR') {
        compilationStatus.value = 'error';
        statusText.value = '编译失败';
      } else {
        compilationStatus.value = 'compiling';
        statusText.value = data.message || '正在处理中...';
      }
    }
    else if (eventType === 'FINAL_RESULT') {
      if (data.data) {
        const resultData = data.data;
        const compilerOutput = resultData.compilerOutput || '';
        const startTime = resultData.startTime ? new Date(resultData.startTime).toLocaleString('zh-CN') : null;
        const endTime = resultData.endTime ? new Date(resultData.endTime).toLocaleString('zh-CN') : null;

        // 计算编译时间
        if (startTime && endTime) {
          const duration = new Date(resultData.endTime).getTime() - new Date(resultData.startTime).getTime();
          compilationTime.value = `${(duration / 1000).toFixed(2)}s`;
        }

        if (status === 'SUCCESS') {
          compilationStatus.value = 'success';
          statusText.value = '编译成功';
        } else if (status === 'FAILED' || status === 'ERROR') {
          compilationStatus.value = 'error';
          statusText.value = '编译失败';
        }

        // 设置编译输出
        if (compilerOutput.trim()) {
          compilationOutput.value = compilerOutput;
        }

        resetSubmitArea();
      }
    }
  }
};

const handleSSEError = (err: any) => {
  console.error('SSE连接错误:', err);
  compilationStatus.value = 'error';
  statusText.value = '连接中断，请刷新页面重试';
  resetSubmitArea();
};

const handleSubmit = async () => {
  if (!selectedFile.value) {
    error.value = '请选择要上传的文件';
    return;
  }

  // 重置状态
  closeSSEConnection();
  isUploading.value = true;
  error.value = null;
  compilationStatus.value = null;
  compilationOutput.value = null;
  compilationTime.value = null;
  statusText.value = null;
  jobId.value = null;
  uploadProgress.value = 0;

  console.log('开始上传代码文件', selectedFile.value.name);

  try {
    // 第一步：提交代码
    const submittedJobId = await sandboxService.submitCode(
      selectedFile.value,
      (progressPercent: number) => {
        uploadProgress.value = progressPercent;
      }
    );

    jobId.value = submittedJobId;
    isUploading.value = false;

    // 第二步：监听编译状态
    sseSource.value = sandboxService.listenToCompilationStream(
      submittedJobId,
      handleSSEMessages,
      handleSSEError
    );

  } catch (err: any) {
    console.error('代码提交失败:', err);

    // 检查是否为Rate Limit错误
    if (err instanceof RateLimitError) {
      if (err.retryAfterSeconds) {
        error.value = `请求频率过高，请${err.retryAfterSeconds}秒后重试`;
        startRateLimitCountdown(err.retryAfterSeconds);
      } else {
        error.value = '请求频率过高，请稍后重试';
      }
    } else {
      error.value = err.message || '代码提交失败';
    }

    isUploading.value = false;
    uploadProgress.value = 0;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

// 组件卸载时清理SSE连接和定时器
onUnmounted(() => {
  closeSSEConnection();
  clearRateLimitTimer();
});
</script>

<style scoped>
.submit-container {
  align-items: center;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.submit-card {
  width: 100%;
  max-width: 800px;
  background-color: var(--card-bg);
  padding: 30px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

/* 自定义滚动条样式 */
.submit-card::-webkit-scrollbar {
  width: 12px;
}

.submit-card::-webkit-scrollbar-track {
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  border-radius: 0;
}

.submit-card::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border: 1px solid var(--border-color);
  border-radius: 0;
  transition: background-color 0.2s ease;
}

.submit-card::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 222, 128, 0.8);
}

.submit-card::-webkit-scrollbar-corner {
  background: var(--bg-color);
}

.submit-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
  text-align: center;
}

.submit-title {
  font-size: 24px;
  color: var(--accent-color);
  margin-bottom: 15px;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.submit-subtitle {
  font-size: 14px;
  color: var(--text-color);
  margin-top: 15px;
}

.submit-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin-bottom: 30px;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.file-label {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 16px;
  background-color: var(--input-bg);
  border: 4px solid var(--border-color);
  border-radius: 8px;
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.12);
  position: relative;
  overflow: hidden;
}

.file-label:hover {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.06);
}

.file-label.has-file {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.08);
}

.file-label.dragging {
  border-color: var(--accent-color);
  background: repeating-linear-gradient(45deg,
      rgba(74, 222, 128, 0.12),
      rgba(74, 222, 128, 0.12) 8px,
      rgba(74, 222, 128, 0.06) 8px,
      rgba(74, 222, 128, 0.06) 16px);
}

.file-label.uploading::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--upload-progress, 0%);
  background: linear-gradient(90deg,
      rgba(74, 222, 128, 0.08) 0%,
      rgba(74, 222, 128, 0.12) 50%,
      rgba(74, 222, 128, 0.08) 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  z-index: -1;
}

.file-label.uploading {
  border-color: rgba(74, 222, 128, 0.3);
  background-color: rgba(74, 222, 128, 0.03);
}

.file-quick-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.pixel-link-button.danger {
  border-color: var(--error-color);
  color: var(--error-color);
}

.pixel-link-button.danger:hover {
  box-shadow: 0px 4px 0px rgba(0, 0, 0, 0.2);
}

.file-icon {
  width: 48px;
  height: 60px;
  background-color: var(--border-color);
  position: relative;
}

.file-icon::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 15px;
  height: 15px;
  background-color: var(--bg-color);
  clip-path: polygon(0 0, 100% 100%, 100% 0);
}

.file-content {
  min-width: 0;
}

.file-text {
  font-size: 14px;
  color: var(--text-color);
}

.file-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--border-color);
}

.file-name {
  font-size: 15px;
  color: var(--text-color);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  margin-top: 8px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 12px;
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 8px;
}

.file-input {
  display: none;
}

.file-actions {
  display: flex;
  gap: 12px;
  align-self: start;
  justify-self: end;
}

.pixel-link-button.small {
  padding: 6px 10px;
  font-size: 10px;
}

/* 合并后不再需要单独的 file-info 容器 */

.icon-button {
  width: 36px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pixel-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
  image-rendering: pixelated;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}


.info-row {
  display: flex;
  margin-bottom: 10px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 12px;
  color: var(--border-color);
  width: 100px;
  flex-shrink: 0;
}

.info-value {
  font-size: 12px;
  color: var(--text-color);
}

.submit-actions {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

/* 新的结果显示区域 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 编译中的可视化块 */
.compiling-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--input-bg);
  border: 2px solid var(--border-color);
}

.pixel-loader {
  display: grid;
  grid-template-columns: repeat(4, 12px);
  gap: 8px;
}

.pixel-loader span {
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  image-rendering: pixelated;
  animation: loaderPulse 1.1s steps(2, end) infinite;
}

.pixel-loader span:nth-child(1) {
  animation-delay: 0s;
}

.pixel-loader span:nth-child(2) {
  animation-delay: 0.1s;
}

.pixel-loader span:nth-child(3) {
  animation-delay: 0.2s;
}

.pixel-loader span:nth-child(4) {
  animation-delay: 0.3s;
}

@keyframes loaderPulse {

  0%,
  100% {
    filter: brightness(1);
    opacity: 1;
  }

  50% {
    filter: brightness(0.6);
    opacity: 0.8;
  }
}

.compiling-hint {
  font-size: 12px;
  color: var(--text-color);
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.resubmit-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--border-color);
  text-align: center;
}

/* 状态条 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--input-bg);
  border: 2px solid var(--border-color);
  transition: all 0.2s ease;
}

.status-bar.status-success {
  border-color: var(--success-color);
  background: rgba(16, 185, 129, 0.08);
}

.status-bar.status-error {
  border-color: var(--error-color);
  background: rgba(239, 68, 68, 0.08);
}

.status-bar.status-compiling {
  border-color: var(--accent-color);
  background: rgba(74, 222, 128, 0.08);
  animation: pulse 2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

/* 状态图标 */
.status-icon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon.icon-success {
  background: var(--success-color);
  position: relative;
}

.status-icon.icon-success::after {
  content: '';
  width: 6px;
  height: 3px;
  border: solid white;
  border-width: 0 0 2px 2px;
  transform: rotate(-45deg);
}

.status-icon.icon-error {
  background: var(--error-color);
  position: relative;
}

.status-icon.icon-error::after {
  content: '×';
  color: white;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
}

.status-icon.icon-compiling {
  background: var(--accent-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 状态信息 */
.status-info {
  flex: 1;
  min-width: 0;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 2px;
}

.job-id {
  font-size: 11px;
  color: var(--border-color);
  font-family: 'Courier New', monospace;
}

.compilation-time {
  font-size: 12px;
  color: var(--border-color);
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 2px;
  font-family: monospace;
}

/* Console输出区域 */
.console-output {
  background: #1a1a1a;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid var(--border-color);
}

.console-title {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

.console-dots {
  display: flex;
  gap: 4px;
}

.console-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
}

.console-dots span:nth-child(1) {
  background: #ff5f57;
}

.console-dots span:nth-child(2) {
  background: #ffbd2e;
}

.console-dots span:nth-child(3) {
  background: #28ca42;
}

.console-content {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 12px;
  color: #f8f8f2;
  background: #1a1a1a;
  padding: 12px;
  margin: 0;
  line-height: 1.4;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.console-content::-webkit-scrollbar {
  width: 8px;
}

.console-content::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.console-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.console-content::-webkit-scrollbar-thumb:hover {
  background: #777;
}

/* Rate Limit 错误样式 */
.error-message.rate-limit-error {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 12px 16px;
  animation: rateLimit 2s infinite;
}

@keyframes rateLimit {

  0%,
  100% {
    border-color: rgba(239, 68, 68, 0.3);
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  50% {
    border-color: rgba(239, 68, 68, 0.5);
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%);
  }
}

.submit-footer {
  border-top: 2px dashed var(--border-color);
  padding-top: 20px;
  margin-top: 20px;
}

.rules-section {
  margin-bottom: 30px;
}

.rules-title {
  font-size: 16px;
  color: var(--accent-color);
  margin-bottom: 15px;
}

.rules-list {
  list-style-type: none;
  padding-left: 0;
}

.rules-list li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-color);
}

.rules-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 8px;
  height: 8px;
  background-color: var(--accent-color);
}

.pixel-link {
  color: var(--accent-color);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-color);
}

.actions-container {
  display: flex;
  justify-content: center;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .submit-content {
    grid-template-columns: 1fr;
  }

  .file-label {
    grid-template-columns: 48px 1fr auto;
    padding: 14px 16px;
  }

  .diagnose-text {
    max-height: 300px;
  }
}
</style>
