<template>
  <div class="game-container container-base">
    <!-- 用户选择界面 -->
    <div v-if="!gameStarted" class="snake-selection-container">
      <div class="content-card pixel-border selection-card">
        <h2 class="selection-title">选择参赛蛇</h2>
        <div class="selection-description">
          选择你想要加入游戏的参赛者 (最多20条蛇)
        </div>

        <!-- 批量选择输入框 -->
        <div class="batch-selection-container">
          <div class="batch-input-group">
            <input
              type="text"
              class="pixel-input batch-input"
              v-model="batchUsernames"
              placeholder="批量选择：输入用户名，用空格或逗号分隔"
            />
            <button
              @click="selectByUsernames"
              class="pixel-button tool-button"
              :disabled="!batchUsernames.trim()"
            >
              选择
            </button>
          </div>
        </div>

        <!-- 已选择的蛇列表 -->
        <div class="selected-snakes-section" v-if="selectedUsers.length > 0">
          <div class="section-header">
            <div class="section-title">已选择的蛇 ({{ selectedUsers.length }}/20)</div>
            <button
              @click="clearSelectedSnakes"
              class="pixel-button clear-button"
              title="清空选择"
            >
              清空
            </button>
          </div>
          <div class="selected-snakes-list">
            <div
              v-for="user in selectedUsers"
              :key="user.userId"
              class="selected-snake-item"
            >
              <div class="snake-color" :style="{ backgroundColor: getSnakeColor(user.userId) }"></div>
              <div class="snake-info">
                <div class="snake-name">{{ user.nickname }}</div>
                <div class="snake-id">{{ user.username }}</div>
              </div>
              <button
                @click="removeSelectedSnake(user)"
                class="remove-button"
                title="移除"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div class="submitters-list">
          <div v-if="isLoading" class="loading-message">
            <div class="pixel-spinner"></div>
            正在加载参赛者列表...
          </div>

          <div v-else-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div v-else class="snake-options">
            <div
              v-for="user in availableUsers"
              :key="user.userId"
              class="snake-option"
              :class="{ 'snake-selected': isSelected(user.userId) }"
              @click="toggleUserSelection(user)"
            >
              <div class="snake-color" :style="{ backgroundColor: getSnakeColor(user.userId) }"></div>
              <div class="snake-info">
                <div class="snake-name">{{ user.nickname }}</div>
                <div class="snake-id">{{ user.username }}</div>
                <div class="snake-update" v-if="user.lastUpdate">
                  {{ formatLastUpdate(user.lastUpdate) }}
                </div>
              </div>
              <div class="select-checkbox">
                <div class="checkbox-inner" v-if="isSelected(user.userId)"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="selection-footer">
          <div class="footer-left">
            <div class="random-select-group">
              <input
                type="number"
                class="pixel-input"
                v-model="randomSelectCount"
                min="1"
                max="20"
                placeholder="数量"
              />
              <button
                @click="selectRandomSnakes"
                class="pixel-button tool-button"
                :disabled="!randomSelectCount || randomSelectCount <= 0"
              >
                随机选择
              </button>
            </div>
          </div>
          <div class="footer-right">
            <button
              @click="startGameWithSelectedUsers"
              class="pixel-button start-button"
              :disabled="selectedUsers.length === 0"
            >
              开始游戏
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏界面 -->
    <div v-else class="game-ui-container">
      <GameUILeft class="game-ui-left" />
      <div class="game-canvas-container">
        <canvas id="gameCanvas" ref="gameCanvas" class="pixel-border"></canvas>
      </div>
      <GameUIRight class="game-ui-right" />

      <!-- Game control buttons (shown after game over) -->
      <div v-if="isGameOver" class="game-control-buttons">
        <button
          @click="playAgain"
          class="pixel-button play-again-button"
        >
          再来一局
        </button>
        <button
          @click="returnToSelection"
          class="pixel-button return-button"
        >
          返回选择
        </button>
      </div>

      <!-- Game Rankings Modal -->
      <GameRankings
        :show="showFinalRankings"
        :scores="finalScores"
        @close="closeFinalRankings"
        @save-recording="saveGameRecording"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { GameManager } from "../managers/GameManager";
import GameUILeft from "../components/GameUILeft.vue";
import GameUIRight from "../components/GameUIRight.vue";
import GameRankings from "../components/GameRankings.vue";
import { sandboxService } from "../services/api";
import { Player } from "../types/User";
import { eventBus, GameEventType } from "../core/EventBus";

interface FinalScore {
  name: string;
  username: string;
  score: number;
  isAlive: boolean;
}

// 随机选择和批量选择的状态
const randomSelectCount = ref<number>(5);
const batchUsernames = ref<string>("");

// API相关状态
const isLoading = ref(true);
const errorMessage = ref("");
const availableUsers = ref<Player[]>([]);
const selectedUsers = ref<Player[]>([]);
const gameStarted = ref(false);
const gameCanvas = ref<HTMLCanvasElement | null>(null);
const gameManager = ref<GameManager | null>(null);

// 游戏录制相关状态
const enableRecording = ref<boolean>(true); // 默认启用录制

// 最终排名相关状态
const showFinalRankings = ref<boolean>(false);
const finalScores = ref<FinalScore[]>([]);
const isGameOver = ref<boolean>(false);

// 获取所有提交者
const fetchSubmitters = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    availableUsers.value = await sandboxService.getSubmitters();
  } catch (error) {
    errorMessage.value = "获取参赛者数据时出错";
    console.error("获取用户数据出错:", error);
  } finally {
    isLoading.value = false;
  }
};

// 生成蛇的颜色
const snakeColors = [
  "#4ade80", // 主色调 - 亮绿色
  "#ef4444", // 红色
  "#3b82f6", // 蓝色
  "#f59e0b", // 橙色
  "#8b5cf6", // 紫色
  "#10b981", // 绿色
  "#06b6d4", // 青色
  "#f43f5e", // 粉色
  "#f97316", // 橙红色
  "#14b8a6", // 蓝绿色
  "#6366f1"  // 靛蓝色
];

const getSnakeColor = (userId: number) => {
  // 根据用户ID生成一个固定的颜色
  return snakeColors[userId % snakeColors.length];
};

// 切换用户选择状态
const toggleUserSelection = (user: Player) => {
  const index = selectedUsers.value.findIndex(u => u.userId === user.userId);

  if (index === -1) {
    // 如果还没满20个，则添加
    if (selectedUsers.value.length < 20) {
      selectedUsers.value.push(user);
    }
  } else {
    // 移除选中
    selectedUsers.value.splice(index, 1);
  }
};

// 检查用户是否已选择
const isSelected = (userId: number) => {
  return selectedUsers.value.some(user => user.userId === userId);
};

// 移除已选择的蛇
const removeSelectedSnake = (user: Player) => {
  const index = selectedUsers.value.findIndex(u => u.userId === user.userId);
  if (index !== -1) {
    selectedUsers.value.splice(index, 1);
  }
};

// 清空所有选择的蛇
const clearSelectedSnakes = () => {
  selectedUsers.value = [];
};

// 随机选择指定数量的蛇
const selectRandomSnakes = () => {
  // 获取未选择的用户
  const unselectedUsers = availableUsers.value.filter(
    user => !isSelected(user.userId)
  );

  // 计算可以选择的数量（考虑已选择的和最大限制）
  const remainingSlots = 20 - selectedUsers.value.length;
  const availableToSelect = Math.min(
    randomSelectCount.value,
    unselectedUsers.length,
    remainingSlots
  );

  if (availableToSelect <= 0) {
    return; // 没有可选的空间或没有未选择的用户
  }

  // 随机选择用户
  const shuffled = [...unselectedUsers].sort(() => 0.5 - Math.random());
  const randomUsers = shuffled.slice(0, availableToSelect);

  // 添加到选择列表
  randomUsers.forEach(user => {
    selectedUsers.value.push(user);
  });
};

// 根据用户名批量选择蛇
const selectByUsernames = () => {
  if (!batchUsernames.value.trim()) return;

  // 解析用户名（支持空格、逗号、分号分隔）
  const usernameList = batchUsernames.value
    .split(/[,;\s]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if (usernameList.length === 0) return;

  // 查找匹配的用户并添加到选择列表
  let added = 0;
  const notFound: string[] = [];

  usernameList.forEach(username => {
    // 查找匹配的用户
    const user = availableUsers.value.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );

    if (user && !isSelected(user.userId) && selectedUsers.value.length < 20) {
      selectedUsers.value.push(user);
      added++;
    } else if (!user) {
      notFound.push(username);
    }
  });

  // 清空输入框
  batchUsernames.value = "";

  // 如果有未找到的用户名，可以在这里添加提示
  if (notFound.length > 0) {
    console.warn("未找到以下用户名:", notFound);
    // 这里可以添加UI提示，如Toast或Alert
  }
};

// 格式化最后更新时间
const formatLastUpdate = (lastUpdate: string) => {
  if (!lastUpdate) return '';

  try {
    const date = new Date(lastUpdate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天更新';
    } else if (diffDays === 1) {
      return '昨天更新';
    } else if (diffDays < 7) {
      return `${diffDays}天前更新`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日更新`;
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    return '最近更新';
  }
};

// Clean up game resources
const cleanupGame = () => {
  console.log("Cleaning up game resources...");
  if (gameManager.value) {
    gameManager.value.dispose();
    gameManager.value = null;
  }
};

// Return to selection screen
const returnToSelection = () => {
  cleanupGame();
  isGameOver.value = false;
  gameStarted.value = false;
};

// Play again with the same snakes
const playAgain = () => {
  // 先清理之前的游戏资源
  cleanupGame();
  isGameOver.value = false;

  // 重新启动游戏，使用相同的蛇
  console.log(`再次开始游戏，使用相同的 ${selectedUsers.value.length} 个玩家，录制功能: ${enableRecording.value ? '启用' : '禁用'}`);

  // 确保游戏状态为已开始
  gameStarted.value = true;

  // 在下一个事件循环中初始化游戏，确保canvas已经渲染
  setTimeout(() => {
    if (gameCanvas.value) {
      // 创建游戏管理器并传递选中的用户和录制选项
      gameManager.value = new GameManager(
        gameCanvas.value,
        selectedUsers.value,
        { enableRecording: true } // 始终启用录制
      );

      // 监听录制保存事件
      const handleRecordingSaved = (recordingId: string) => {
        console.log("Game recording saved:", recordingId);
        // 可以在这里添加通知或其他UI反馈
      };

      eventBus.on(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);

      // 在游戏结束时移除事件监听
      const originalDispose = gameManager.value.dispose.bind(gameManager.value);
      gameManager.value.dispose = () => {
        eventBus.off(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);
        originalDispose();
      };

      window.addEventListener('beforeunload', () => {
         gameManager.value?.dispose();
      });
    }
  }, 0);
};

// 使用选中的用户启动游戏
const startGameWithSelectedUsers = () => {
  if (selectedUsers.value.length === 0) return;

  // 准备开始游戏
  console.log(`开始游戏，选中了 ${selectedUsers.value.length} 个玩家，录制功能: ${enableRecording.value ? '启用' : '禁用'}`);

  // 先清理之前的游戏资源（如果有）
  cleanupGame();

  // 启动游戏
  gameStarted.value = true;

  // 在下一个事件循环中初始化游戏，确保canvas已经渲染
  setTimeout(() => {
    if (gameCanvas.value) {
      // 创建游戏管理器并传递选中的用户和录制选项
      gameManager.value = new GameManager(
        gameCanvas.value,
        selectedUsers.value,
        { enableRecording: true } // 始终启用录制
      );

      // 监听录制保存事件
      const handleRecordingSaved = (recordingId: string) => {
        console.log("Game recording saved:", recordingId);
        // 可以在这里添加通知或其他UI反馈
      };

      eventBus.on(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);

      // 在游戏结束时移除事件监听
      const originalDispose = gameManager.value.dispose.bind(gameManager.value);
      gameManager.value.dispose = () => {
        eventBus.off(GameEventType.GAME_RECORDING_SAVED, handleRecordingSaved);
        originalDispose();
      };

      window.addEventListener('beforeunload', () => {
         gameManager.value?.dispose();
      });
    }
  }, 0);
};

// 处理最终得分显示
const handleFinalScores = (scores: FinalScore[]) => {
  console.log("Received final scores:", scores);
  finalScores.value = scores;
  showFinalRankings.value = true;
};

// 关闭最终排名弹窗
const closeFinalRankings = () => {
  showFinalRankings.value = false;
};

// 保存游戏录制
const saveGameRecording = async () => {
  if (gameManager.value) {
    await gameManager.value.saveCurrentRecording();
  }
};

// Listen for game over event
const setupGameOverListener = () => {
  const handleGameOver = () => {
    console.log("Game over event received in Game.vue");
    // Set game over state to true after a delay to allow game over animation to show
    setTimeout(() => {
      isGameOver.value = true;
    }, 1000);
  };

  eventBus.on(GameEventType.GAME_OVER, handleGameOver);
  eventBus.on(GameEventType.UI_FINAL_SCORES, handleFinalScores);

  return () => {
    eventBus.off(GameEventType.GAME_OVER, handleGameOver);
    eventBus.off(GameEventType.UI_FINAL_SCORES, handleFinalScores);
  };
};

// Listen for page unload to ensure cleanup
const setupBeforeUnloadListener = () => {
  const handleBeforeUnload = () => {
    cleanupGame();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
};

onMounted(() => {
  fetchSubmitters();
  const removeGameOverListener = setupGameOverListener();
  const removeBeforeUnloadListener = setupBeforeUnloadListener();

  // 返回清理函数
  onUnmounted(() => {
    cleanupGame();
    removeGameOverListener();
    removeBeforeUnloadListener();
  });
});
</script>

<style scoped>
.game-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px); /* Subtract top bar height */
  padding: 20px;
  overflow: hidden;
  width: 100%;
}

/* 选择界面样式 */
.snake-selection-container {
  width: 100%;
  max-width: 800px;
  height: 100%;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.selection-card {
  background-color: var(--card-bg);
  padding: 16px;
  width: 100%;
  height: 100%;
  box-shadow: 0 0 30px rgba(74, 222, 128, 0.15);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.selection-title {
  color: var(--accent-color);
  font-size: 20px;
  text-align: center;
  margin-bottom: 6px;
}

.selection-description {
  color: var(--text-color);
  font-size: 12px;
  text-align: center;
  margin-bottom: 10px;
}

.submitters-list {
  width: 100%;
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.loading-message, .error-message {
  color: var(--text-color);
  font-size: 14px;
  text-align: center;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.error-message {
  color: var(--error-color);
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

.snake-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.snake-option {
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.snake-option:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: var(--border-color);
}

.snake-selected {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
}

.snake-color {
  width: 16px;
  height: 16px;
  margin-right: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.snake-info {
  flex: 1;
}

.snake-name {
  color: var(--text-color);
  font-size: 12px;
  line-height: 1.3;
}

.snake-id {
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
}

.snake-update {
  color: rgba(74, 222, 128, 0.8);
  font-size: 9px;
  margin-top: 2px;
}

.select-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-inner {
  width: 10px;
  height: 10px;
  background-color: var(--accent-color);
}

.batch-selection-container {
  width: 100%;
}

.batch-input-group {
  display: flex;
  gap: 6px;
  width: 100%;
}

.pixel-input {
  background-color: var(--input-bg);
  border: 2px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}

.pixel-input:focus {
  border-color: var(--accent-color);
}

.batch-input {
  flex: 1;
}

.tool-button {
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
}

.random-select-group {
  display: flex;
  gap: 6px;
  align-items: center;
}

.selected-snakes-section {
  border: 2px solid rgba(74, 222, 128, 0.3);
  padding: 8px 10px;
  background-color: rgba(74, 222, 128, 0.05);
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.section-title {
  color: var(--accent-color);
  font-size: 14px;
}

.clear-button {
  font-size: 10px;
  padding: 4px 8px;
  background-color: rgba(239, 68, 68, 0.8);
}

.selected-snakes-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 5px 0;
  white-space: nowrap;
}

.selected-snake-item {
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  gap: 6px;
  height: 36px;
}

.remove-button {
  background: none;
  border: none;
  color: var(--error-color);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
}

.remove-button:hover {
  color: #ff6b6b;
}

.selection-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-right {
  display: flex;
  align-items: center;
}



.start-button {
  font-size: 14px;
  padding: 10px 20px;
}

.pixel-button {
  background-color: var(--button-color);
  color: #000;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  text-transform: uppercase;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
  image-rendering: pixelated;
}

.pixel-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:disabled {
  background-color: #555;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.5;
}

/* 游戏界面样式 */
.game-ui-container {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.game-ui-left {
  flex: 0 0 270px;
  margin-right: 20px;
}

.game-ui-right {
  flex: 0 0 270px;
  margin-left: 20px;
}

.game-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  max-width: calc(100% - 580px);
}

.game-control-buttons {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  gap: 10px;
}

.play-again-button {
  font-size: 12px;
  padding: 8px 16px;
  background-color: rgba(74, 222, 128, 0.8); /* 绿色 */
}

.return-button {
  font-size: 12px;
  padding: 8px 16px;
  background-color: rgba(239, 68, 68, 0.8); /* 红色 */
}

#gameCanvas {
  background-color: #000;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  border: 4px solid var(--border-color);
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.1);
  height: auto;
  max-height: calc(100vh - 80px);
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color);
}

/* 响应式样式 */
@media (max-width: 1200px) {
  .game-ui-container {
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 20px;
  }

  .game-ui-left, .game-ui-right {
    flex: 0 0 auto;
    width: 100%;
    max-width: 600px;
    margin: 0 0 20px 0;
  }

  .game-canvas-container {
    max-width: 100%;
    width: 100%;
    order: -1; /* 让画布在顶部 */
  }

  #gameCanvas {
    margin-bottom: 20px;
    max-width: min(800px, calc(100vw - 40px));
    max-height: calc(100vh - 350px);
  }
}

@media (max-width: 768px) {
  .game-ui-left, .game-ui-right {
    max-width: 100%;
  }

  .snake-options {
    grid-template-columns: 1fr;
  }

  .selection-card {
    padding: 20px;
  }

  #gameCanvas {
    max-height: calc(100vh - 400px);
  }
}
</style>