<template>
  <div class="submit-container container-base">
    <div class="submit-card pixel-border">
      <div class="submit-header">
        <h1 class="submit-title">蛇王争霸</h1>
        <div class="pixel-snake"></div>
        <p class="submit-subtitle">上传你的算法，参与2024年中国人民大学信息学院蛇王争霸赛</p>
      </div>

      <div class="submit-content">
        <div class="upload-section">
          <label for="codeFile" class="file-label" :class="{ 'has-file': !!selectedFile }">
            <div class="file-icon"></div>
            <div class="file-text">
              {{ selectedFile ? selectedFile.name : '点击选择 C++ 源代码文件' }}
            </div>
            <input
              type="file"
              id="codeFile"
              accept=".cpp,.h,.hpp"
              @change="handleFileChange"
              class="file-input"
            />
          </label>

          <div class="file-info" v-if="selectedFile">
            <div class="info-row">
              <span class="info-label">文件名:</span>
              <span class="info-value">{{ selectedFile.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">大小:</span>
              <span class="info-value">{{ formatFileSize(selectedFile.size) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后修改:</span>
              <span class="info-value">{{ formatDate(selectedFile.lastModified) }}</span>
            </div>
          </div>

          <div v-if="error" class="error-message">{{ error }}</div>
          <div v-if="success" class="success-message">{{ success }}</div>

          <div class="submit-actions">
            <button
              @click="handleSubmit"
              class="pixel-button"
              :disabled="isSubmitting || !selectedFile"
            >
              {{ isSubmitting ? '上传中...' : '提交代码' }}
            </button>
          </div>
        </div>

        <div v-if="diagnoseResult" class="diagnose-section">
          <h2 class="diagnose-title">诊断结果</h2>
          <div class="diagnose-content">
            <div v-if="isSubmitSuccess" class="diagnose-success">
              <div class="success-icon"></div>
              <div class="success-text">提交成功！</div>
            </div>
            <pre class="diagnose-text">{{ diagnoseResult }}</pre>
          </div>
        </div>
      </div>

      <div class="submit-footer">
        <div class="rules-section">
          <h3 class="rules-title">提交须知</h3>
          <ul class="rules-list">
            <li>仅支持 .cpp, .h, .hpp 等 C++ 文件</li>
            <li>文件大小不超过 1MB</li>
            <li>代码需要实现 Snake 类及所需算法</li>
            <li>查看<router-link to="/docs" class="pixel-link">文档</router-link>了解更多</li>
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
import { ref, onUnmounted } from 'vue';
import { sandboxService } from '../services/sandboxService';
import { useAuth } from '../stores/auth';
import { SSE } from 'sse.js';

const { state } = useAuth();

const selectedFile = ref<File | null>(null);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const isSubmitting = ref(false);
const diagnoseResult = ref<string | null>(null);
const isSubmitSuccess = ref(false);
const jobId = ref<string | null>(null);
const sseSource = ref<SSE | null>(null);

const closeSSEConnection = () => {
  if (sseSource.value) {
    sseSource.value.close();
    sseSource.value = null;
  }
  isSubmitting.value = false;
};

const resetSubmitArea = () => {
  closeSSEConnection();
  isSubmitting.value = false;
};

const handleFileChange = (event: Event) => {
  closeSSEConnection(); // 关闭之前的SSE连接
  jobId.value = null; // 重置作业ID
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];

    // 检查文件类型
    const allowedExtensions = ['.cpp', '.h', '.hpp'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      error.value = `不支持的文件类型: ${fileExtension}。请上传C++源代码文件`;
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
    success.value = null;
    diagnoseResult.value = null;
    isSubmitSuccess.value = false;
  } else {
    selectedFile.value = null;
  }
};

const handleSSEMessages = (data: any) => {
  console.log('收到SSE消息:', data);

  if (data && typeof data === 'object') {
    const status = data.status;
    const eventType = data.eventType;
    const jobIdFromResponse = data.jobId || jobId.value;

    // 如果收到了jobId，则更新存储的jobId
    if (data.jobId && !jobId.value) {
      jobId.value = data.jobId;
      console.log('更新jobId:', jobId.value);
    }

    // 根据事件类型处理
    if (eventType === 'SUBMITTED') {
      diagnoseResult.value = `作业ID: ${jobIdFromResponse}\n状态: 已提交\n消息: ${data.message || '代码已提交，等待编译...'}`;
    }
    else if (eventType === 'STATUS_UPDATE') {
      let statusInfo = `作业ID: ${jobIdFromResponse}\n`;
      statusInfo += `状态: ${status}\n`;
      statusInfo += `消息: ${data.message || '正在处理中...'}\n`;

      if (status === 'SUCCESS') {
        success.value = '编译成功';
      } else if (status === 'FAILED' || status === 'ERROR') {
        error.value = '编译失败';
      }

      diagnoseResult.value = statusInfo;
    }
    else if (eventType === 'FINAL_RESULT') {
      // 处理最终结果，包含完整的信息
      if (data.data) {
        const resultData = data.data;
        const compilerOutput = resultData.compilerOutput || '';
        const errorDetails = resultData.errorDetails || '';

        // 添加时间信息
        const submitTime = resultData.submitTime ? new Date(resultData.submitTime).toLocaleString('zh-CN') : '未知';
        const startTime = resultData.startTime ? new Date(resultData.startTime).toLocaleString('zh-CN') : '未知';
        const endTime = resultData.endTime ? new Date(resultData.endTime).toLocaleString('zh-CN') : '处理中';

        let statusInfo = `作业ID: ${jobIdFromResponse}\n`;
        statusInfo += `提交时间: ${submitTime}\n`;
        statusInfo += `开始时间: ${startTime}\n`;
        statusInfo += `完成时间: ${endTime}\n`;
        statusInfo += `状态: ${status}\n`;

        if (status === 'SUCCESS') {
          success.value = '编译成功';
          statusInfo += `编译输出:\n${compilerOutput}`;
          diagnoseResult.value = statusInfo;
          isSubmitSuccess.value = true;
          resetSubmitArea();
        } else if (status === 'FAILED' || status === 'ERROR') {
          error.value = '编译失败';
          statusInfo += `编译输出:\n${compilerOutput}\n`;
          statusInfo += `错误详情: ${errorDetails}`;
          diagnoseResult.value = statusInfo;
          isSubmitSuccess.value = false;
          resetSubmitArea();
        } else {
          diagnoseResult.value = statusInfo;
        }
      } else {
        // 如果没有data字段，使用简单的状态显示
        let statusInfo = `作业ID: ${jobIdFromResponse}\n`;
        statusInfo += `状态: ${status}\n`;
        statusInfo += `消息: ${data.message || '处理完成'}`;
        diagnoseResult.value = statusInfo;

        if (status === 'SUCCESS') {
          success.value = '编译成功';
          isSubmitSuccess.value = true;
          resetSubmitArea();
        } else if (status === 'FAILED' || status === 'ERROR') {
          error.value = '编译失败';
          isSubmitSuccess.value = false;
          resetSubmitArea();
        }
      }
    }
    else {
      // 其他类型的事件
      let statusInfo = `作业ID: ${jobIdFromResponse}\n`;
      statusInfo += `状态: ${status || '未知'}\n`;
      statusInfo += `事件类型: ${eventType || '未知'}\n`;
      statusInfo += `消息: ${data.message || '正在处理中...'}`;
      diagnoseResult.value = statusInfo;
    }
  } else {
    // 处理非JSON格式的消息
    diagnoseResult.value = `状态: 更新中... (收到未知格式消息)`;
  }
};

const handleSSEError = (err: any) => {
  console.error('SSE连接错误:', err);
  error.value = '监听编译状态时出错';
  diagnoseResult.value += '\n连接中断，请刷新页面重试。';
  isSubmitSuccess.value = false;
  resetSubmitArea();
};

const handleSubmit = async () => {
  if (!selectedFile.value) {
    error.value = '请选择要上传的文件';
    return;
  }

  closeSSEConnection(); // 关闭之前的SSE连接
  isSubmitting.value = true;
  error.value = null;
  success.value = null;
  diagnoseResult.value = null;
  isSubmitSuccess.value = false;
  jobId.value = null;

  console.log('开始上传代码文件', selectedFile.value.name);
  diagnoseResult.value = '正在提交编译...';
  success.value = '开始监听编译结果...';

  try {
    // 使用SSE监听编译状态
    sseSource.value = await sandboxService.submitCodeWithSSE(
      selectedFile.value,
      handleSSEMessages,
      handleSSEError
    );
  } catch (err: any) {
    console.error('创建SSE连接错误:', err);
    error.value = err.message || '创建SSE连接失败';
    diagnoseResult.value = '提交过程中发生错误';
    isSubmitSuccess.value = false;
    isSubmitting.value = false;
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

// 组件卸载时清理SSE连接
onUnmounted(() => {
  closeSSEConnection();
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  background-color: var(--input-bg);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 30px;
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

.file-text {
  font-size: 14px;
  color: var(--text-color);
  text-align: center;
}

.file-input {
  display: none;
}

.file-info {
  background-color: var(--input-bg);
  border-radius: 4px;
  padding: 15px;
  border: 2px solid var(--border-color);
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

.diagnose-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.diagnose-title {
  font-size: 18px;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.diagnose-content {
  background-color: var(--input-bg);
  border-radius: 4px;
  padding: 15px;
  border: 2px solid var(--border-color);
  overflow: hidden;
}

.diagnose-success {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(16, 185, 129, 0.1);
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.success-icon {
  width: 20px;
  height: 20px;
  background-color: var(--success-color);
  border-radius: 50%;
  position: relative;
}

.success-icon::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 5px;
  width: 8px;
  height: 4px;
  border: solid white;
  border-width: 0 0 2px 2px;
  transform: rotate(-45deg);
}

.success-text {
  color: var(--success-color);
  font-size: 14px;
}

.diagnose-text {
  font-family: monospace;
  font-size: 12px;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
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
    padding: 20px;
  }

  .diagnose-text {
    max-height: 300px;
  }
}
</style>