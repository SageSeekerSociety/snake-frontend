<template>
  <div class="game-ui">
    <!-- 左侧信息面板：剩余时间和通知 -->
    <div class="left-panel">
      <div class="timer-panel">
        <div class="panel-header">
          <div class="panel-title">剩余时间</div>
        </div>
        <div class="timer-display">
          {{ remainingTicks }}
        </div>
      </div>

      <div class="notifications-panel">
        <div class="panel-header">
          <div class="panel-title">游戏通知</div>
        </div>
        <div class="notifications-list">
          <div v-if="notifications.length === 0" class="notification-empty">
            游戏开始后将显示通知...
          </div>
          <div v-else class="notification-items">
            <div v-for="(notification, index) in notifications" :key="index"
                class="notification-item"
                v-html="notification">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧信息面板：计分板（合并了参赛者和得分榜） -->
    <div class="right-panel">
      <div class="scoreboard-panel">
        <div class="panel-header">
          <div class="panel-title">计分板</div>
        </div>
        <div class="score-list">
          <div v-for="snake in sortedSnakes" :key="snake.snake.getId()"
            class="score-item"
            :class="{ 'player-dead': !snake.snake.isAlive() }">
            <div class="score-color" :style="{ backgroundColor: snake.snake.getColor() }"></div>
            <div class="score-info">
              <div class="score-name">
                {{ getSnakeName(snake) }}
              </div>
              <div class="score-username">
                {{ getSnakeUsername(snake) }}
              </div>
            </div>
            <div class="score-status">
              <div class="score-value">{{ snake.snake.getScore() }}分</div>
              <div class="score-shield">
                <div class="shield-bar cooldown" :style="{
                  width: getShieldCooldownPercent(snake.snake),
                  opacity: snake.snake.getShieldCooldown() > 0 ? 1 : 0.2
                }"></div>
                <div class="shield-bar duration" :style="{
                  width: getShieldDurationPercent(snake.snake),
                  opacity: snake.snake.getShieldDuration() > 0 ? 1 : 0
                }"></div>
              </div>
              <div class="snake-status">
                {{ snake.snake.isAlive() ? '存活' : '已败' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Game Rankings Modal -->
    <GameRankings
      :show="showFinalRankings"
      :scores="finalScores"
      @close="closeFinalRankings"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, defineProps } from "vue";
import { Snake } from "../entities/Snake";
import { eventBus, GameEventType } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { User } from "../types/User";
import GameRankings from "./GameRankings.vue";

interface FinalScore {
  name: string;
  username: string;
  score: number;
  isAlive: boolean;
}

// 定义组件属性
const props = defineProps({
  selectedUsers: {
    type: Array as () => User[],
    default: () => []
  }
});

const snakes = ref<Snake[]>([]);
const notifications = ref<string[]>([]);
const remainingTicks = ref<number>(256);
const gameStarted = ref<boolean>(false);
const showFinalRankings = ref<boolean>(false);
const finalScores = ref<FinalScore[]>([]);

const sortedSnakes = computed(() => {
  // 返回带有原始索引的蛇数组，按分数排序
  return snakes.value.map((snake, index) => ({
    snake,
    index
  })).sort((a, b) => b.snake.getScore() - a.snake.getScore());
});

// 不再需要头像颜色生成函数，因为我们使用了真实的头像图片

// 获取蛇的显示名称
const getSnakeName = (snakeData: any) => {
  if (!snakeData || !snakeData.snake) return "未知";

  try {
    const metadata = snakeData.snake.getMetadata();
    if (metadata && metadata.name) {
      // 裁剪名称长度以适应UI
      const name = metadata.name.length > 12
        ? metadata.name.substring(0, 10) + '...'
        : metadata.name;
      return name;
    }
  } catch (err) {
    console.error("获取蛇名称出错:", err);
  }

  return `蛇 ${snakeData.index + 1}`;
};

// 获取蛇的用户名
const getSnakeUsername = (snakeData: any) => {
  if (!snakeData || !snakeData.snake) return "";

  try {
    const metadata = snakeData.snake.getMetadata();
    if (metadata && metadata.username) {
      return metadata.username;
    }
  } catch (err) {
    console.error("获取蛇用户名出错:", err);
  }

  return "";
};

const updateScoreboard = (newSnakes: Snake[]) => {
  if (Array.isArray(newSnakes)) {
    snakes.value = [...newSnakes];
  } else {
    console.warn("[GameUI] Invalid scoreboard update data:", newSnakes);
  }
};

const addNotification = (message: string) => {
  if (typeof message === "string") {
    // 检查是否已经有相同的通知，防止重复
    if (!notifications.value.includes(message)) {
      notifications.value.push(message);
      // 保持最多显示8条通知
      if (notifications.value.length > 8) {
        notifications.value.shift();
      }
    }
  } else {
    console.warn("[GameUI] Invalid notification message:", message);
  }
};

const clearNotifications = () => {
  notifications.value = [];
};

const getShieldCooldownPercent = (snake: any): string => {
  try {
    const cooldown = snake.getShieldCooldown();
    const maxCooldown = GameConfig.SHIELD.COOLDOWN;
    const percent = ((maxCooldown - cooldown) / maxCooldown) * 100;
    return `${percent}%`;
  } catch (err) {
    console.error("获取护盾冷却信息出错:", err);
    return "0%";
  }
};

const getShieldDurationPercent = (snake: any): string => {
  try {
    const duration = snake.getShieldDuration();
    const maxDuration = GameConfig.SHIELD.DURATION;
    const percent = (duration / maxDuration) * 100;
    return `${percent}%`;
  } catch (err) {
    console.error("获取护盾持续时间信息出错:", err);
    return "0%";
  }
};

const updateRemainingTicks = (ticks: number) => {
  remainingTicks.value = ticks;
};

const handleGameStart = () => {
  gameStarted.value = true;
  clearNotifications();
};

let updateTimerId: number;

// Reset component state
const resetState = () => {
  snakes.value = [];
  notifications.value = [];
  remainingTicks.value = 256;
  gameStarted.value = false;
  // Don't reset finalScores here as we want to keep them for display
};

// Handle final scores display
const handleFinalScores = (scores: FinalScore[]) => {
  console.log("Received final scores:", scores);
  finalScores.value = scores;
  showFinalRankings.value = true;
};

// Close final rankings modal
const closeFinalRankings = () => {
  showFinalRankings.value = false;
};

// Setup event listeners
const setupEventListeners = () => {
  // Bind event handlers
  eventBus.on(GameEventType.UI_UPDATE_SCOREBOARD, updateScoreboard);
  eventBus.on(GameEventType.UI_NOTIFICATION, addNotification);
  eventBus.on(GameEventType.GAME_START, handleGameStart);
  eventBus.on(GameEventType.UI_UPDATE_TIMER, updateRemainingTicks);
  eventBus.on(GameEventType.UI_FINAL_SCORES, handleFinalScores);
  eventBus.on(GameEventType.GAME_OVER, resetState);

  // Return cleanup function
  return () => {
    eventBus.off(GameEventType.UI_UPDATE_SCOREBOARD, updateScoreboard);
    eventBus.off(GameEventType.UI_NOTIFICATION, addNotification);
    eventBus.off(GameEventType.GAME_START, handleGameStart);
    eventBus.off(GameEventType.UI_UPDATE_TIMER, updateRemainingTicks);
    eventBus.off(GameEventType.UI_FINAL_SCORES, handleFinalScores);
    eventBus.off(GameEventType.GAME_OVER, resetState);
  };
};

onMounted(() => {
  // Initialize state
  resetState();

  // Setup event listeners
  const removeEventListeners = setupEventListeners();

  // Setup timer to update snake state
  updateTimerId = window.setInterval(() => {
    if (snakes.value.length > 0) {
      snakes.value = [...snakes.value];
    }
  }, 100);

  // Component unmount cleanup
  onUnmounted(() => {
    clearInterval(updateTimerId);
    removeEventListeners();
    resetState();
  });
});
</script>

<style scoped>
.game-ui {
  position: relative;
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  gap: 20px;
}

/* 左侧面板样式 */
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 270px;
  max-height: calc(100vh - 80px);
}

/* 右侧面板样式 */
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 270px;
  max-height: calc(100vh - 80px);
}

/* 计分板样式 */
.scoreboard-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: rgba(20, 20, 40, 0.8);
  border: 4px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.1);
  overflow: hidden;
}

.score-list {
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 150px);
}

/* 计时器面板样式 */
.timer-panel {
  background-color: rgba(20, 20, 40, 0.8);
  border: 4px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.1);
  overflow: hidden;
}

.timer-display {
  padding: 12px;
  font-size: 24px;
  color: var(--accent-color);
  text-align: center;
  font-weight: bold;
}

/* 通知面板样式 */
.notifications-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: rgba(20, 20, 40, 0.8);
  border: 4px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.1);
  overflow: hidden;
}

.notifications-list {
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
}

.notification-items {
  display: flex;
  flex-direction: column-reverse; /* 最新的通知在最上面 */
  gap: 8px;
}

.notification-item {
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.07);
  border-left: 3px solid var(--accent-color);
  color: #fff;
  font-size: 9px;
  line-height: 1.4;
  border-radius: 4px;
}

.notification-empty {
  padding: 10px;
  color: rgba(255, 255, 255, 0.4);
  background-color: rgba(20, 20, 40, 0.5);
  border-radius: 4px;
  text-align: center;
  font-style: italic;
  font-size: 9px;
}

.panel-header {
  background-color: var(--border-color);
  padding: 8px;
  display: flex;
  justify-content: center;
  position: relative;
}

.panel-title {
  color: #fff;
  text-transform: uppercase;
  text-align: center;
  font-size: 12px;
  letter-spacing: 1px;
}

/* 计分项样式 */
.score-item {
  display: flex;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.07);
  border-radius: 3px;
  align-items: center;
  gap: 10px;
}

.player-dead {
  opacity: 0.6;
}

.score-color {
  width: 12px;
  height: 40px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.score-info {
  flex: 1;
  min-width: 0; /* 确保flex项可以缩小到比内容更小 */
  overflow: hidden;
}

.score-name {
  color: #fff;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-username {
  color: rgba(255, 255, 255, 0.6);
  font-size: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 70px;
}

.score-value {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 10px;
  white-space: nowrap;
}

.snake-status {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.7);
  padding: 2px 4px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.score-shield {
  height: 6px;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.shield-bar {
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: width 0.3s;
}

.shield-bar.cooldown {
  background-color: #3b82f6;
  z-index: 1;
}

.shield-bar.duration {
  background-color: #06b6d4;
  z-index: 2;
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
@media (max-width: 1400px) {
  .game-ui {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .left-panel, .right-panel {
    width: 100%;
    max-width: 600px;
  }

  .score-list, .notifications-list {
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .left-panel, .right-panel {
    max-width: 100%;
  }

  .score-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .score-color {
    width: 100%;
    height: 8px;
  }

  .score-status {
    width: 100%;
    align-items: flex-start;
  }
}
</style>
