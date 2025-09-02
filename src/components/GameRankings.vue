<template>
  <div v-if="show" class="rankings-modal-overlay" @click.self="close">
    <div class="rankings-modal pixel-border">
      <div class="rankings-header">
        <div class="trophy-icon"></div>
        <h2>Game Over</h2>
        <div class="trophy-icon"></div>
      </div>
      <h3 class="rankings-title">Final Rankings</h3>

      <div class="rankings-list">
        <div v-for="(player, index) in scores" :key="index"
             class="ranking-item"
             :class="{'first-place': index === 0, 'second-place': index === 1, 'third-place': index === 2}">
          <div class="ranking-position">
            <div class="position-number">{{ index + 1 }}</div>
            <div v-if="index < 3" class="medal"></div>
          </div>
          <div class="ranking-player">
            <div class="ranking-name">{{ player.name }}</div>
            <div class="ranking-username">{{ player.username }}</div>
          </div>
          <div class="ranking-score"><span class="score-number">{{ player.score }}</span><span class="pts-text">pts</span></div>
          <div class="status-indicator" :class="{ 'status-alive': player.isAlive, 'status-dead': !player.isAlive }"></div>
        </div>
      </div>

      <div class="button-container">
        <button class="pixel-button copy-button" @click="copyResultsAsTable">
          复制表格
        </button>
        <button v-if="showSaveButton" class="pixel-button save-button" @click="saveRecording">
          保存录制
        </button>
        <button class="pixel-button close-button" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, onMounted, onUnmounted } from 'vue';
import { eventBus, GameEventType } from '../core/EventBus';

interface FinalScore {
  name: string;
  username: string;
  score: number;
  isAlive: boolean;
}

const props = defineProps<{
  show: boolean;
  scores: FinalScore[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save-recording'): void;
}>();

// 是否显示保存录制按钮
const showSaveButton = ref(false);

// 关闭排行榜
const close = () => {
  emit('close');
};

// 保存录制
const saveRecording = () => {
  emit('save-recording');
  showSaveButton.value = false; // 保存后隐藏按钮
};

// 复制表格到剪贴板
const copyResultsAsTable = async () => {
  try {
    // 创建表格数据，按照要求格式：学号(username)、得分(score)、排名
    const tableData = props.scores.map((player, index) => [
      player.username,
      player.score.toString(),
      (index + 1).toString()
    ]);

    // 创建 TSV 格式（制表符分隔）
    const tsv = tableData.map(row => row.join('\t')).join('\n');

    // 创建 HTML 表格格式
    const tableHTML = `<table>
${tableData.map(row => 
  `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
).join('\n')}
</table>`;

    // 创建多格式剪贴板数据
    const htmlBlob = new Blob([tableHTML], { type: 'text/html' });
    const textBlob = new Blob([tsv], { type: 'text/plain' });
    const data = new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob
    });

    await navigator.clipboard.write([data]);
    console.log('数据已作为表格成功复制');
    // 这里可以添加UI反馈，比如短暂显示"复制成功"的提示
  } catch (error) {
    console.error('无法复制:', error);
    // 这里可以添加错误提示
  }
};

// 监听录制完成事件
const handleRecordingCompleted = () => {
  showSaveButton.value = true;
};

// 监听录制保存事件
const handleRecordingSaved = () => {
  showSaveButton.value = false;
};

// 设置事件监听
onMounted(() => {
  eventBus.on(GameEventType.GAME_RECORDING_COMPLETED, handleRecordingCompleted);
  eventBus.on(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);
});

// 清理事件监听
onUnmounted(() => {
  eventBus.off(GameEventType.GAME_RECORDING_COMPLETED, handleRecordingCompleted);
  eventBus.off(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);
});
</script>

<style scoped>
.rankings-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.5s ease-out;
}

.rankings-modal {
  background-color: var(--card-bg);
  width: 90%;
  max-width: 600px;
  max-height: 90vh; /* Limit maximum height to 90% of viewport height */
  padding: 30px;
  border: 4px solid var(--border-color);
  box-shadow: 0 0 40px rgba(74, 222, 128, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden; /* Prevent content from overflowing */
  font-family: 'Press Start 2P', monospace;
  image-rendering: pixelated;
}

.rankings-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  width: 100%;
}

.rankings-header h2 {
  color: var(--accent-color);
  font-size: 28px;
  text-transform: uppercase;
  margin: 0 20px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-family: 'Press Start 2P', monospace;
}

.trophy-icon {
  width: 32px;
  height: 32px;
  background-color: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  image-rendering: pixelated;
}

.rankings-title {
  color: #fff;
  font-size: 18px;
  margin-bottom: 20px;
  text-transform: uppercase;
  position: relative;
  font-family: 'Press Start 2P', monospace;
}

.rankings-title::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 2px;
  background-color: var(--accent-color);
}

.rankings-list {
  width: 100%;
  margin-top: 20px;
  margin-bottom: 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px; /* Limit maximum height */
  overflow-y: auto; /* Enable vertical scrolling */
  padding-right: 10px; /* Add space for scrollbar */

  /* Custom scrollbar styles */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: var(--accent-color) rgba(255, 255, 255, 0.1); /* Firefox */
}

/* Custom scrollbar styles (Webkit browsers) */
.rankings-list::-webkit-scrollbar {
  width: 8px;
}

.rankings-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.rankings-list::-webkit-scrollbar-thumb {
  background-color: var(--accent-color);
  border-radius: 4px;
}

.rankings-list::-webkit-scrollbar-thumb:hover {
  background-color: #4ade80;
}

.ranking-item {
  display: grid;
  grid-template-columns: 60px 1fr 90px 30px;
  align-items: center;
  padding: 10px 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  transition: transform 0.2s, background-color 0.2s;
  column-gap: 10px;
  image-rendering: pixelated;
}

.ranking-item:hover {
  transform: translateX(3px);
  background-color: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
}

.first-place {
  background-color: rgba(255, 215, 0, 0.15);
  border: 2px solid #ffd700;
}

.second-place {
  background-color: rgba(192, 192, 192, 0.15);
  border: 2px solid #c0c0c0;
}

.third-place {
  background-color: rgba(205, 127, 50, 0.15);
  border: 2px solid #cd7f32;
}

.ranking-position {
  display: flex;
  align-items: center;
  position: relative;
}

.position-number {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  font-family: 'Press Start 2P', monospace;
}

.medal {
  position: absolute;
  width: 16px;
  height: 16px;
  right: 10px;
  image-rendering: pixelated;
}

.first-place .medal {
  background-color: #ffd700;
  box-shadow: 0 0 4px #ffd700;
}

.second-place .medal {
  background-color: #c0c0c0;
  box-shadow: 0 0 4px #c0c0c0;
}

.third-place .medal {
  background-color: #cd7f32;
  box-shadow: 0 0 4px #cd7f32;
}

.ranking-player {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.ranking-name {
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ranking-username {
  font-size: 10px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.ranking-score {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
  white-space: nowrap;
  text-align: right;
  justify-self: end; /* 确保在网格中右对齐 */
  padding-right: 0;
  min-width: 80px; /* 确保有足够的空间容纳三位数 */
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.score-number {
  display: inline-block;
}

.pts-text {
  font-size: 12px;
  opacity: 0.8;
  margin-left: 2px; /* 减少与分数之间的间距 */
}

.status-indicator {
  width: 16px;
  height: 16px;
  margin-left: auto;
}

.status-alive {
  background-color: #10b981;
  box-shadow: 0 0 4px #10b981;
}

.status-dead {
  opacity: 0.3;
  background-color: #ef4444;
}

.button-container {
  display: flex;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
}

.close-button, .save-button, .copy-button {
  padding: 10px 30px;
  font-size: 14px;
}

.save-button {
  background-color: #10b981;
  border-color: #059669;
}

.save-button:hover {
  background-color: #059669;
}

.copy-button {
  background-color: #3b82f6;
  border-color: #2563eb;
}

.copy-button:hover {
  background-color: #2563eb;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Responsive styles */
@media (max-width: 768px) {
  .rankings-modal {
    width: 95%;
    padding: 20px;
  }

  .rankings-list {
    max-height: 350px; /* Slightly smaller on medium screens */
  }

  .ranking-item {
    grid-template-columns: 40px 1fr 80px 40px;
    padding: 10px;
    column-gap: 8px;
  }

  .rankings-header h2 {
    font-size: 20px;
  }

  .trophy-icon {
    width: 30px;
    height: 30px;
  }
}

@media (max-width: 600px) {
  .rankings-modal {
    padding: 15px;
    max-height: 95vh; /* Allow more height on small screens */
  }

  .rankings-list {
    max-height: 300px; /* Even smaller on small screens */
    padding-right: 5px; /* Less padding for scrollbar */
  }

  .ranking-item {
    grid-template-columns: 30px 1fr 80px 40px;
    gap: 8px;
  }

  .status-indicator {
    width: 30px;
    height: 30px;
  }

  .status-icon {
    width: 12px;
    height: 12px;
  }

  .ranking-score {
    font-size: 14px;
    text-align: right;
    min-width: 70px; /* 小屏幕上减小最小宽度 */
  }

  .pts-text {
    font-size: 10px;
    margin-left: 1px; /* 在小屏幕上进一步减少间距 */
  }

  .position-number {
    font-size: 16px; /* Smaller font size */
  }

  .ranking-name {
    font-size: 12px; /* Smaller font size */
  }

  .ranking-score {
    font-size: 14px; /* Smaller font size */
  }
}
</style>
