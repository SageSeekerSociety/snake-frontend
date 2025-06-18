<template>
  <div class="recordings-container container-base">
    <div class="content-card pixel-border recordings-card">
      <h2 class="recordings-title">对局记录</h2>
      
      <div class="recordings-actions">
        <button @click="refreshRecordings" class="pixel-button">
          刷新列表
        </button>
        <label class="pixel-button import-button">
          导入记录
          <input
            type="file"
            accept=".json"
            @change="handleImport"
            class="hidden-input"
          />
        </label>
      </div>
      
      <div v-if="isLoading" class="loading-message">
        加载中...
      </div>
      
      <div v-else-if="recordings.length === 0" class="empty-message">
        暂无对局记录。开始一局游戏并启用录制功能来创建记录。
      </div>
      
      <div v-else class="recordings-list">
        <div
          v-for="recording in recordings"
          :key="recording.id"
          class="recording-item pixel-border"
        >
          <div class="recording-info">
            <div class="recording-name">
              <input
                type="text"
                v-model="recording.name"
                @blur="updateRecordingName(recording as GameRecording)"
                class="name-input"
              />
            </div>
            <div class="recording-date">
              {{ formatDate(recording.timestamp) }}
            </div>
            <div class="recording-details">
              {{ recording.players.length }} 名玩家 | {{ recording.frames.length }} 帧
            </div>
          </div>
          
          <div class="recording-actions">
            <button
              @click="playRecording(recording as GameRecording)"
              class="pixel-button action-button"
            >
              播放
            </button>
            <button
              @click="exportRecording(recording as GameRecording)"
              class="pixel-button action-button"
            >
              导出
            </button>
            <button
              @click="deleteRecording(recording as GameRecording)"
              class="pixel-button action-button delete-button"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { gameRecordingService } from '../services/gameRecordingService';
import { GameRecording } from '../types/GameRecording';

const router = useRouter();
const recordings = ref<GameRecording[]>([]);
const isLoading = ref(true);

// 加载录制列表
const loadRecordings = async () => {
  isLoading.value = true;
  try {
    await gameRecordingService.initialize();
    recordings.value = await gameRecordingService.getAllRecordings();
  } catch (error) {
    console.error('Failed to load recordings:', error);
  } finally {
    isLoading.value = false;
  }
};

// 刷新录制列表
const refreshRecordings = () => {
  loadRecordings();
};

// 播放录制
const playRecording = (recording: GameRecording) => {
  // 将录制ID存储在会话存储中，以便在回放页面使用
  sessionStorage.setItem('currentReplayId', recording.id);
  router.push('/replay');
};

// 导出录制
const exportRecording = async (recording: GameRecording) => {
  try {
    await gameRecordingService.exportRecording(recording.id);
  } catch (error) {
    console.error('Failed to export recording:', error);
  }
};

// 删除录制
const deleteRecording = async (recording: GameRecording) => {
  if (confirm(`确定要删除录制 "${recording.name}" 吗？`)) {
    try {
      await gameRecordingService.deleteRecording(recording.id);
      recordings.value = recordings.value.filter(r => r.id !== recording.id);
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  }
};

// 更新录制名称
const updateRecordingName = async (recording: GameRecording) => {
  try {
    await gameRecordingService.updateRecordingName(recording.id, recording.name);
  } catch (error) {
    console.error('Failed to update recording name:', error);
  }
};

// 导入录制
const handleImport = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    try {
      const recordingId = await gameRecordingService.importRecording(file);
      await loadRecordings();
      
      // 自动播放导入的录制
      const importedRecording = recordings.value.find(r => r.id === recordingId);
      if (importedRecording) {
        playRecording(importedRecording as GameRecording);
      }
    } catch (error) {
      console.error('Failed to import recording:', error);
      alert('导入失败：无效的录制文件');
    }
    
    // 清除输入，以便可以再次选择相同的文件
    input.value = '';
  }
};

// 格式化日期
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

onMounted(() => {
  loadRecordings();
});
</script>

<style scoped>
.recordings-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 60px);
  padding: 20px;
  overflow: hidden;
}

.recordings-card {
  width: 800px;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.recordings-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 24px;
  margin-bottom: 20px;
  text-align: center;
}

.recordings-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.recordings-list {
  overflow-y: auto;
  max-height: 500px;
  margin-bottom: 20px;
}

.recording-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 10px;
  background-color: rgba(0, 0, 0, 0.2);
  gap: 16px;
}

.recording-info {
  flex: 1;
}

.recording-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 16px;
  margin-bottom: 5px;
}

.name-input {
  background: transparent;
  border: none;
  border-bottom: 1px dashed #4ade80;
  color: #fff;
  font-family: 'Press Start 2P', monospace;
  font-size: 16px;
  width: 100%;
  padding: 5px 0;
}

.name-input:focus {
  outline: none;
  border-bottom: 1px solid #4ade80;
}

.recording-date {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 5px;
}

.recording-details {
  font-size: 12px;
  color: #888;
}

.recording-actions {
  display: flex;
  gap: 10px;
}

.action-button {
  padding: 8px 12px;
  font-size: 12px;
}

.delete-button {
  background-color: #ff6b6b;
}

.delete-button:hover {
  background-color: #ff4949;
}

.loading-message,
.empty-message {
  text-align: center;
  padding: 40px;
  color: #aaa;
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
}

.import-button {
  position: relative;
  overflow: hidden;
}

.hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
