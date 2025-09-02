<template>
  <div class="game-ui-right">
    <!-- 计分板面板 -->
    <div class="scoreboard-panel">
      <div class="panel-header">
        <div class="panel-title">计分板</div>
      </div>
      <div class="score-list">
        <div v-for="snake in sortedSnakes" :key="snake.snake.getId()"
          class="score-item"
          :class="{ 'player-dead': !snake.snake.isAlive() }">
          <div class="score-color" :style="{ backgroundColor: snake.snake.getColor() }">
            <span class="score-color-number">{{ getMatchNumber(snake.snake, snake.index) }}</span>
          </div>
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
            <div class="score-indicators">
              <div class="key-indicator" :class="{ 'has-key': hasKey(snake.snake) }">
                🗝️
              </div>
              <div class="score-shield">
                <div class="shield-bar cooldown" :style="{
                  width: getShieldCooldownPercent(snake.snake),
                  opacity: snake.snake.getShieldCooldown() > 0 ? 1 : 0.2
                }"></div>
                <div
                  class="shield-bar duration"
                  :class="{ 'initial-shield': isInitialShield(snake.snake) }"
                  :style="{
                    width: getShieldDurationPercent(snake.snake),
                    opacity: snake.snake.getShieldDuration() > 0 ? 1 : 0
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { Snake } from "../entities/Snake";
import { eventBus, GameEventType } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

const snakes = ref<Snake[]>([]);

const sortedSnakes = computed(() => {
  // 返回带有原始索引的蛇数组，按分数排序
  return snakes.value.map((snake, index) => ({
    snake,
    index
  })).sort((a, b) => b.snake.getScore() - a.snake.getScore()) as { snake: Snake; index: number }[];
});

// 获取对局内编号（从1开始，补全两位）
const getMatchNumber = (snake: Snake, fallbackIndex: number): string => {
  try {
    const meta: any = snake.getMetadata?.() || {};
    const n = meta.matchNumber as number | undefined;
    const num = typeof n === 'number' && n > 0 ? n : (fallbackIndex + 1);
    return String(num).padStart(2, '0');
  } catch {
    return String(fallbackIndex + 1).padStart(2, '0');
  }
};

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

// 获取护盾冷却百分比
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

// 获取护盾持续时间百分比
const getShieldDurationPercent = (snake: any): string => {
  try {
    const duration = snake.getShieldDuration();
    // 根据是否是初始护盾选择不同的最大持续时间
    const maxDuration = snake.isInitialShield()
      ? GameConfig.SHIELD.INITIAL_DURATION
      : GameConfig.SHIELD.DURATION;
    const percent = (duration / maxDuration) * 100;
    return `${percent}%`;
  } catch (err) {
    console.error("获取护盾持续时间信息出错:", err);
    return "0%";
  }
};

// 判断是否是初始护盾
const isInitialShield = (snake: any): boolean => {
  try {
    // 直接使用 Snake 类提供的 isInitialShield 方法
    return snake.isInitialShield();
  } catch (err) {
    console.error("判断初始护盾出错:", err);
    return false;
  }
};

// 检查蛇是否持有钥匙
const hasKey = (snake: Snake): boolean => {
    return snake.hasKey();
};

// 更新计分板
const updateScoreboard = (newSnakes: Snake[]) => {
  if (Array.isArray(newSnakes)) {
    snakes.value = [...newSnakes];
  } else {
    console.warn("[GameUIRight] Invalid scoreboard update data:", newSnakes);
  }
};



// 重置组件状态
const resetState = () => {
  snakes.value = [];
};

let updateTimerId: number;

// 设置事件监听
const setupEventListeners = () => {
  eventBus.on(GameEventType.UI_UPDATE_SCOREBOARD, updateScoreboard);

  // 返回清理函数
  return () => {
    eventBus.off(GameEventType.UI_UPDATE_SCOREBOARD, updateScoreboard);
  };
};

onMounted(() => {
  // 初始化状态
  resetState();

  // 设置事件监听
  const removeEventListeners = setupEventListeners();

  // 设置定时器更新蛇状态
  updateTimerId = window.setInterval(() => {
    if (snakes.value.length > 0) {
      snakes.value = [...snakes.value];
    }
  }, 100);

  // 组件卸载清理
  onUnmounted(() => {
    clearInterval(updateTimerId);
    removeEventListeners();
  });
});
</script>

<style scoped>
.game-ui-right {
  display: flex;
  flex-direction: column;
  width: 270px;
  max-height: calc(100vh - 80px);
  font-family: 'Press Start 2P', monospace;
  image-rendering: pixelated;
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
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: calc(100vh - 150px);
}

.panel-title {
  color: #fff;
  text-transform: uppercase;
  text-align: center;
  font-size: 10px;
  letter-spacing: 1px;
}

/* 计分项样式 */
.score-item {
  display: flex;
  padding: 4px;
  background-color: rgba(255, 255, 255, 0.07);
  border: 1px solid transparent;
  align-items: center;
  gap: 8px;
}

.score-item:hover {
  border-color: var(--accent-color);
  background-color: rgba(255, 255, 255, 0.1);
}

.player-dead {
  opacity: 0.5;
}

.score-color {
  position: relative;
  width: 18px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.score-color-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: bold;
  color: #0b0b0b;
  text-shadow: 0 1px 0 rgba(255,255,255,0.5);
}

.score-info {
  flex: 1;
  min-width: 0; /* 确保flex项可以缩小到比内容更小 */
  overflow: hidden;
}

.score-name {
  color: #fff;
  font-size: 9px;
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
  margin-top: 3px;
}

.score-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 60px;
}

.score-value {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 10px;
  white-space: nowrap;
}

/* 指示器容器 */
.score-indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.score-shield {
  height: 6px;
  flex: 1;
  background-color: rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  margin-top: 2px;
}

/* 钥匙指示器 */
.key-indicator {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  opacity: 0.3;
  transition: all 0.3s ease;
  filter: grayscale(1) brightness(0.6);
  flex-shrink: 0;
}

.key-indicator.has-key {
  opacity: 1;
  filter: none;
  animation: keyGlow 2s infinite;
  text-shadow: 0 0 4px #ffd700;
}

@keyframes keyGlow {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
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
  box-shadow: 0 0 4px #3b82f6;
}

.shield-bar.duration {
  background-color: #06b6d4;
  z-index: 2;
  box-shadow: 0 0 4px #06b6d4;
}

.shield-bar.initial-shield {
  background-color: #10b981; /* 绿色，区分于普通护盾的蓝色 */
  box-shadow: 0 0 4px #10b981;
  animation: pulse 1.5s infinite; /* 添加脉冲动画效果 */
}

@keyframes pulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
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
  .game-ui-right {
    width: 100%;
    max-width: 600px;
  }

  .score-list {
    max-height: 300px;
  }
}

@media (max-width: 768px) {
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
