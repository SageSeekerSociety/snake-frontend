<template>
  <div class="game-ui-left">
    <!-- 计时器面板 -->
    <div class="timer-panel">
      <div class="panel-header">
        <div class="panel-title">剩余时间</div>
      </div>
      <div class="timer-display">
        {{ remainingTicks }}
      </div>
    </div>

    <!-- 通知面板 -->
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
              :class="[
                'notification-item',
                notification.includes('replay-game-notification') ? 'replay-game-item' : '',
                notification.includes('replay-system-notification') ? 'replay-system-item' : ''
              ]"
              v-html="notification">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { eventBus, GameEventType } from "../core/EventBus";

const notifications = ref<string[]>([]);
const remainingTicks = ref<number>(256);

// 添加通知
const addNotification = (message: string) => {
  if (typeof message === "string") {
    // 检查是否已经有相同的通知，防止重复
    if (!notifications.value.includes(message)) {
      notifications.value.push(message);
      // 保持最多显示20条通知
      if (notifications.value.length > 20) {
        notifications.value.shift();
      }
    }
  } else {
    console.warn("[GameUILeft] Invalid notification message:", message);
  }
};

// 清空通知
const clearNotifications = () => {
  notifications.value = [];
};

// 更新剩余时间
const updateRemainingTicks = (ticks: number) => {
  remainingTicks.value = ticks;
};

// 游戏开始处理
const handleGameStart = () => {
  clearNotifications();
};

// 重置组件状态
const resetState = () => {
  notifications.value = [];
  remainingTicks.value = 256;
};

// 设置事件监听
const setupEventListeners = () => {
  eventBus.on(GameEventType.UI_NOTIFICATION, addNotification);
  eventBus.on(GameEventType.GAME_START, handleGameStart);
  eventBus.on(GameEventType.UI_UPDATE_TIMER, updateRemainingTicks);
  eventBus.on(GameEventType.GAME_OVER, resetState);

  // 返回清理函数
  return () => {
    eventBus.off(GameEventType.UI_NOTIFICATION, addNotification);
    eventBus.off(GameEventType.GAME_START, handleGameStart);
    eventBus.off(GameEventType.UI_UPDATE_TIMER, updateRemainingTicks);
    eventBus.off(GameEventType.GAME_OVER, resetState);
  };
};

onMounted(() => {
  // 初始化状态
  resetState();

  // 设置事件监听
  const removeEventListeners = setupEventListeners();

  // 组件卸载清理
  onUnmounted(() => {
    removeEventListeners();
  });
});
</script>

<style scoped>
.game-ui-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 270px;
  max-height: calc(100vh - 80px);
  font-family: 'Press Start 2P', monospace;
  image-rendering: pixelated;
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
  font-size: 20px;
  color: var(--accent-color);
  text-align: center;
  font-weight: bold;
  font-family: 'Press Start 2P', monospace;
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
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.07);
  border-left: 3px solid var(--accent-color);
  color: #fff;
  font-size: 8px;
  line-height: 1.5;
  margin-bottom: 6px;
}

/* 系统回放通知样式（如帧数、加载等） */
:deep(.replay-system-notification) {
  color: #888888; /* 灰色，使系统通知不那么显眼 */
  font-size: 0.9em; /* 稍微小一点 */
  opacity: 0.7; /* 半透明 */
}

/* 回放通知项样式 - 使用类名来区分不同类型的通知 */
.notification-item.replay-game-item {
  border-left-color: #a0d8ef; /* 浅蓝色边框 */
  background-color: rgba(160, 216, 239, 0.07); /* 浅蓝色背景 */
}

.notification-item.replay-system-item {
  border-left-color: #888888; /* 灰色边框 */
  background-color: rgba(136, 136, 136, 0.05); /* 灰色背景 */
  opacity: 0.8; /* 半透明 */
}

.notification-empty {
  padding: 10px;
  color: rgba(255, 255, 255, 0.4);
  background-color: rgba(20, 20, 40, 0.5);
  text-align: center;
  font-size: 8px;
  line-height: 1.5;
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
  font-size: 10px;
  letter-spacing: 1px;
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
  .game-ui-left {
    width: 100%;
    max-width: 600px;
  }

  .notifications-list {
    max-height: 300px;
  }
}
</style>
