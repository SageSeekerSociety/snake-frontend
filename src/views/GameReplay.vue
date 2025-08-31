<template>
  <div class="replay-container container-base">
    <!-- 回放界面 -->
    <div class="game-ui-container">
      <GameUILeft class="game-ui-left" />

      <div class="center-column">
        <div class="game-canvas-container pixel-border">
          <canvas id="replayCanvas" ref="replayCanvas"></canvas>
        </div>

        <!-- 回放控制面板 -->
        <div class="replay-controls pixel-border">
          <div class="replay-info">
            <div class="replay-name">
              {{ currentRecording?.name || "未知录制" }}
            </div>
            <div class="replay-progress">
              帧 {{ parseInt(currentFrame.toString()) + 1 }} / {{ totalFrames }}
            </div>
          </div>

          <div class="replay-buttons">
            <button @click="previousFrame" class="pixel-button control-button">
              上一帧
            </button>
            <button
              v-if="!isPlaying"
              @click="play"
              class="pixel-button control-button"
            >
              播放
            </button>
            <button
              v-else-if="isPaused"
              @click="resume"
              class="pixel-button control-button"
            >
              继续
            </button>
            <button v-else @click="pause" class="pixel-button control-button">
              暂停
            </button>
            <button @click="nextFrame" class="pixel-button control-button">
              下一帧
            </button>
            <button @click="stop" class="pixel-button control-button">
              停止
            </button>
            <button
              @click="copyCurrentFrameState"
              class="pixel-button control-button copy-button"
              title="复制当前帧状态作为算法输入"
            >
              复制状态
            </button>
            <button
              v-if="currentUserSnakeExists"
              @click="toggleDebugInfo"
              class="pixel-button control-button debug-button"
              title="显示当前用户蛇的调试信息"
            >
              调试信息
            </button>
          </div>

          <div class="replay-speed">
            <span class="speed-label">速度:</span>
            <select
              v-model="playbackSpeed"
              @change="updatePlaybackSpeed"
              class="speed-select"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </div>

          <div class="replay-timeline">
            <input
              type="range"
              min="0"
              :max="totalFrames - 1"
              v-model="currentFrame"
              @input="seekToFrame"
              class="timeline-slider"
            />
          </div>

          <button @click="returnToList" class="pixel-button return-button">
            返回列表
          </button>
        </div>
      </div>

      <GameUIRight class="game-ui-right" />

      <!-- Debug Info Panel for Current User's Snake -->
      <div
        v-if="showDebugInfo"
        ref="debugPanel"
        class="debug-panel pixel-border"
        :style="{
          left: debugPanelPosition.x + 'px',
          top: debugPanelPosition.y + 'px',
        }"
      >
        <div
          class="debug-header draggable-header"
          @mousedown="startDrag"
          @touchstart="startDrag"
        >
          <span class="debug-title">{{ currentUserSnakeName }} 调试信息</span>
          <button @click="showDebugInfo = false" class="close-button">×</button>
        </div>
        <div class="debug-content">
          <div v-if="currentUserSnakeDebug.input" class="debug-section">
            <h4>输入:</h4>
            <pre class="debug-text">{{
              currentUserSnakeDebug.input.trim() +
              "\n" +
              (currentUserSnakeDebug.oldMemoryData ?? "")
            }}</pre>
          </div>
          <div v-if="currentUserSnakeDebug.output" class="debug-section">
            <h4>输出决策:</h4>
            <pre class="debug-text">{{ currentUserSnakeDebug.output }}</pre>
          </div>
          <div v-if="currentUserSnakeDebug.stderr" class="debug-section">
            <h4>stderr 输出:</h4>
            <pre class="debug-text">{{ currentUserSnakeDebug.stderr }}</pre>
          </div>
          <div v-if="currentUserSnakeDebug.newMemoryData" class="debug-section">
            <h4>Memory Data:</h4>
            <pre class="debug-text">{{
              currentUserSnakeDebug.newMemoryData
            }}</pre>
          </div>
          <div
            v-if="
              !currentUserSnakeDebug.input &&
              !currentUserSnakeDebug.output &&
              !currentUserSnakeDebug.stderr &&
              !currentUserSnakeDebug.newMemoryData
            "
            class="debug-section"
          >
            <p class="no-debug-data">当前帧无调试数据</p>
          </div>
          <div class="debug-footer" v-if="(currentUserSnakeDebug.cpuTimeSeconds && currentUserSnakeDebug.memoryUsageKb) || currentUserSnakeDebug.workerNodeId || currentUserSnakeDebug.jobId">
            <div v-if="currentUserSnakeDebug.cpuTimeSeconds && currentUserSnakeDebug.memoryUsageKb">{{ (currentUserSnakeDebug.cpuTimeSeconds * 1000).toFixed(2) }}ms / {{ (currentUserSnakeDebug.memoryUsageKb / 1024).toFixed(2) }}MB</div>
            <div v-if="currentUserSnakeDebug.workerNodeId">Worker Node ID: {{ currentUserSnakeDebug.workerNodeId }}</div>
            <div v-if="currentUserSnakeDebug.jobId">Job ID: {{ currentUserSnakeDebug.jobId }}</div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import GameUILeft from "../components/GameUILeft.vue";
import GameUIRight from "../components/GameUIRight.vue";
import GameRankings from "../components/GameRankings.vue";
import { GameReplayManager } from "../managers/GameReplayManager";
import { gameRecordingService } from "../services/gameRecordingService";
import { GameRecording } from "../types/GameRecording";
import { eventBus, GameEventType } from "../core/EventBus";
import { copyGameStateToClipboard } from "../utils/gameStateFormatter";
import { useAuth } from "../stores/auth";

const router = useRouter();
const replayCanvas = ref<HTMLCanvasElement | null>(null);
const replayManager = ref<GameReplayManager | null>(null);
const { state: authState } = useAuth();

// 回放状态
const currentRecording = ref<GameRecording | null>(null);
const isLoading = ref(true);
const isPlaying = ref(false);
const isPaused = ref(false);
const currentFrame = ref(0);
// 防止初始化或停止时触发的 seek 盖掉 initialFrame 的渲染
const suppressSeek = ref<boolean>(false);
const totalFrames = ref(0);
const playbackSpeed = ref("1");

// 最终排名相关状态
const showFinalRankings = ref<boolean>(false);
const finalScores = ref<any[]>([]);

// 调试信息相关状态
const showDebugInfo = ref<boolean>(false);
const currentUserSnakeExists = ref<boolean>(false);
const currentUserSnakeName = ref<string>("");
const currentUserSnakeDebug = ref<{
  oldMemoryData?: string;
  input?: string;
  output?: string;
  stderr?: string;
  newMemoryData?: string;
  workerNodeId?: string;
  jobId?: string;
  cpuTimeSeconds?: number;
  memoryUsageKb?: number;
}>({});
const debugPanel = ref<HTMLElement | null>(null);

// 拖拽相关状态
const debugPanelPosition = ref<{ x: number; y: number }>({ x: 20, y: 20 });
const isDragging = ref<boolean>(false);
const dragOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 });

// 加载录制
const loadRecording = async (recordingId: string) => {
  isLoading.value = true;
  try {
    await gameRecordingService.initialize();
    const recording = await gameRecordingService.getRecordingById(recordingId);

    if (recording && replayManager.value) {
      currentRecording.value = recording;
      replayManager.value.loadRecording(recording);
      totalFrames.value = recording.frames.length;
      // 不主动设置 currentFrame，避免触发 watcher 跳到第 0 帧覆盖 initialFrame

      // 初始化当前用户蛇的调试信息
      updateCurrentUserSnakeDebug();

      console.log(`Loaded recording: ${recording.name}`);
    } else {
      console.error(
        "Failed to load recording or replay manager not initialized"
      );
      router.push("/recordings");
    }
  } catch (error) {
    console.error("Failed to load recording:", error);
    router.push("/recordings");
  } finally {
    isLoading.value = false;
  }
};

// 播放控制
const play = () => {
  if (replayManager.value) {
    replayManager.value.play();
    isPlaying.value = true;
    isPaused.value = false;
  }
};

const pause = () => {
  if (replayManager.value) {
    replayManager.value.pause();
    isPaused.value = true;
  }
};

const resume = () => {
  if (replayManager.value) {
    replayManager.value.resume();
    isPaused.value = false;
  }
};

const stop = () => {
  if (replayManager.value) {
    suppressSeek.value = true;
    replayManager.value.stop();
    isPlaying.value = false;
    isPaused.value = false;
    currentFrame.value = replayManager.value.getCurrentFrameIndex();
    nextTick(() => {
      suppressSeek.value = false;
    });
  }
};

const nextFrame = () => {
  if (replayManager.value) {
    replayManager.value.nextFrame();
    currentFrame.value = replayManager.value.getCurrentFrameIndex();
    updateCurrentUserSnakeDebug();
  }
};

const previousFrame = () => {
  if (replayManager.value) {
    replayManager.value.previousFrame();
    currentFrame.value = replayManager.value.getCurrentFrameIndex();
    updateCurrentUserSnakeDebug();
  }
};

const seekToFrame = () => {
  if (replayManager.value) {
    replayManager.value.jumpToFrame(currentFrame.value);
    updateCurrentUserSnakeDebug();
  }
};

const updatePlaybackSpeed = () => {
  if (replayManager.value) {
    replayManager.value.setPlaybackSpeed(parseFloat(playbackSpeed.value));
  }
};

// 返回录制列表
const returnToList = () => {
  router.push("/recordings");
};

// 复制当前帧状态作为算法输入
const copyCurrentFrameState = async () => {
  if (!replayManager.value) return;

  const currentFrame = replayManager.value.getCurrentFrame();
  if (!currentFrame) {
    console.error("No current frame available");
    return;
  }

  try {
    // 获取当前用户ID以便附加memory数据
    const currentUserId = authState.user?.username;
    const success = await copyGameStateToClipboard(currentFrame, currentUserId);
    if (success) {
      // 检查是否包含了memory数据
      const hasMemoryData =
        currentUserId &&
        currentFrame.gameState.entities.snakes.some((snake: any) => {
          const snakeStudentId = snake.metadata?.studentId || "";
          const snakeUsername = snake.metadata?.username || "";

          return (
            (snakeStudentId === currentUserId ||
              snakeUsername === currentUserId) &&
            snake.metadata?.newMemoryData
          );
        });

      let message = `已复制第 ${currentFrame.tick} 帧状态到剪贴板`;
      if (hasMemoryData) {
        message += "（包含Memory数据）";
      }

      eventBus.emit(GameEventType.UI_NOTIFICATION, message);
    } else {
      eventBus.emit(GameEventType.UI_NOTIFICATION, "复制失败，请手动复制");
    }
  } catch (error) {
    console.error("Error copying game state:", error);
    eventBus.emit(GameEventType.UI_NOTIFICATION, "复制失败，请手动复制");
  }
};

// 处理最终得分显示
const handleFinalScores = (scores: any[]) => {
  console.log("Received final scores:", scores);
  finalScores.value = scores;
  showFinalRankings.value = true;
};

// 关闭最终排名弹窗
const closeFinalRankings = () => {
  showFinalRankings.value = false;
};

// 切换调试信息面板
const toggleDebugInfo = () => {
  showDebugInfo.value = !showDebugInfo.value;

  // 如果是首次打开，设置默认位置为右上角
  if (
    showDebugInfo.value &&
    debugPanelPosition.value.x === 20 &&
    debugPanelPosition.value.y === 20
  ) {
    const viewportWidth = window.innerWidth;
    debugPanelPosition.value = {
      x: viewportWidth - 370, // 面板宽度350 + 20px边距
      y: 20,
    };
  }
};

// 更新当前用户蛇的调试信息
const updateCurrentUserSnakeDebug = () => {
  if (!replayManager.value || !authState.user) {
    currentUserSnakeExists.value = false;
    return;
  }

  const prevFrame = replayManager.value.getPrevFrame(1);
  const currentFrame = replayManager.value.getCurrentFrame();
  if (!currentFrame) {
    currentUserSnakeDebug.value = {};
    return;
  }

  const currentUserId =
    authState.user.id?.toString();
  const currentUserUsername = authState.user.username;

  const isUserSname = (snake: any) => {
      const snakeUserId = String(snake.metadata?.userId) || "";
      const snakeStudentId = snake.metadata?.studentId || "";
      const snakeUsername = snake.metadata?.username || "";

      return (
        snakeUserId === currentUserId ||
        snakeStudentId === currentUserUsername ||
        snakeUsername === currentUserUsername
      );
    }

  // 查找当前用户的蛇
  const prevFrameUserSnake = prevFrame
    ? prevFrame.gameState.entities.snakes.find(isUserSname)
    : null;
  const currentFrameUserSnake = currentFrame.gameState.entities.snakes.find(isUserSname);

  if (currentFrameUserSnake) {
    currentUserSnakeExists.value = true;
    currentUserSnakeName.value =
      currentFrameUserSnake.metadata?.name || currentUserUsername;

    // 提取调试信息
    const currentMeta = currentFrameUserSnake.metadata || {};
    currentUserSnakeDebug.value = {
      oldMemoryData: prevFrameUserSnake?.metadata.newMemoryData,
      input: currentMeta.input,
      output: currentMeta.output,
      stderr: currentMeta.stderr,
      newMemoryData: currentMeta.newMemoryData,
      workerNodeId: currentMeta.workerNodeId,
      jobId: currentMeta.jobId,
      cpuTimeSeconds: currentMeta.cpuTimeSeconds,
      memoryUsageKb: currentMeta.memoryKb
    };
  } else {
    currentUserSnakeExists.value = false;
    currentUserSnakeName.value = "";
    currentUserSnakeDebug.value = {};
  }
};

// 拖拽相关方法
const startDrag = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  isDragging.value = true;

  const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
  const clientY = "touches" in event ? event.touches[0].clientY : event.clientY;

  dragOffset.value = {
    x: clientX - debugPanelPosition.value.x,
    y: clientY - debugPanelPosition.value.y,
  };

  // 添加全局监听器
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchmove", onDrag);
  document.addEventListener("touchend", stopDrag);
};

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;

  event.preventDefault();

  const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
  const clientY = "touches" in event ? event.touches[0].clientY : event.clientY;

  let newX = clientX - dragOffset.value.x;
  let newY = clientY - dragOffset.value.y;

  // 获取视窗尺寸和面板尺寸进行边界限制
  const panelWidth = 350; // 面板宽度
  const panelHeight = debugPanel.value?.offsetHeight || 400;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 限制在视窗内
  newX = Math.max(0, Math.min(newX, viewportWidth - panelWidth));
  newY = Math.max(0, Math.min(newY, viewportHeight - panelHeight));

  debugPanelPosition.value = { x: newX, y: newY };
};

const stopDrag = () => {
  isDragging.value = false;

  // 移除全局监听器
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("touchmove", onDrag);
  document.removeEventListener("touchend", stopDrag);
};

// 监听回放管理器状态变化
const setupReplayManagerWatcher = () => {
  // 每秒更新当前帧
  const updateInterval = setInterval(() => {
    if (replayManager.value && isPlaying.value && !isPaused.value) {
      currentFrame.value = replayManager.value.getCurrentFrameIndex();
      updateCurrentUserSnakeDebug();
    }
  }, 100);

  return () => {
    clearInterval(updateInterval);
  };
};

// 监听事件总线
const setupEventListeners = () => {
  eventBus.on(GameEventType.UI_FINAL_SCORES, handleFinalScores);

  return () => {
    eventBus.off(GameEventType.UI_FINAL_SCORES, handleFinalScores);
  };
};

// 清理资源
const cleanupReplay = () => {
  console.log("Cleaning up replay resources...");
  if (replayManager.value) {
    replayManager.value.dispose();
    replayManager.value = null;
  }
};

// 监听当前帧变化
watch(currentFrame, (newFrame) => {
  if (suppressSeek.value) return;
  if (replayManager.value && !isPlaying.value) {
    replayManager.value.jumpToFrame(newFrame);
  }
  updateCurrentUserSnakeDebug();
});

onMounted(() => {
  const recordingId = sessionStorage.getItem("currentReplayId");

  if (!recordingId) {
    console.error("No recording ID found in session storage");
    router.push("/recordings");
    return;
  }

  // 初始化回放管理器
  setTimeout(() => {
    if (replayCanvas.value) {
      replayManager.value = new GameReplayManager(replayCanvas.value);
      loadRecording(recordingId);
    }
  }, 0);

  const removeReplayManagerWatcher = setupReplayManagerWatcher();
  const removeEventListeners = setupEventListeners();

  // 返回清理函数
  onUnmounted(() => {
    cleanupReplay();
    removeReplayManagerWatcher();
    removeEventListeners();
    // 清理拖拽监听器
    stopDrag();
  });
});
</script>

<style scoped>
.replay-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px);
  padding: 20px;
  overflow: hidden;
  width: 100%;
}

.game-ui-container {
  display: flex;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.game-ui-left {
  width: 270px;
  margin-right: 10px;
  height: 100%;
  overflow: hidden;
}

.center-column {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: flex-start;
  gap: 15px;
  width: calc(100% - 560px);
  /* 减去左右两侧面板的宽度 */
  min-width: 500px;
  /* 确保最小宽度 */
}

.game-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(20, 20, 40, 0.8);
  padding: 10px;
  flex-grow: 1;
  min-height: 500px;
  /* 确保最小高度 */
  position: relative;
  overflow: hidden;
}

.game-canvas-container canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.game-ui-right {
  width: 270px;
  margin-left: 10px;
  height: 100%;
  overflow: hidden;
}

.replay-controls {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 8px;
  margin-top: 0;
  max-height: 180px;
  /* 限制控制面板的最大高度 */
}

.replay-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.replay-name {
  font-family: "Press Start 2P", monospace;
  font-size: 12px;
  color: #4ade80;
}

.replay-progress {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  color: #aaa;
}

.replay-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
}

.control-button {
  padding: 6px 10px;
  font-size: 10px;
}

.copy-button {
  background-color: #4a6fa5;
}

.copy-button:hover {
  background-color: #5a80b6;
}

.replay-speed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.speed-label {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  color: #aaa;
}

.speed-select {
  background-color: #2a2a3e;
  color: #fff;
  border: 1px solid #4a4a5e;
  padding: 4px;
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
}

.replay-timeline {
  width: 100%;
  margin-bottom: 10px;
}

.timeline-slider {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  height: 8px;
  background: #2a2a3e;
  outline: none;
  border-radius: 4px;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4ade80;
  cursor: pointer;
  border-radius: 50%;
}

.timeline-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4ade80;
  cursor: pointer;
  border-radius: 50%;
}

.return-button {
  align-self: center;
  padding: 6px 12px;
  font-size: 10px;
  margin-top: 4px;
}

.debug-button {
  background-color: #8b5a3c;
}

.debug-button:hover {
  background-color: #9d6647;
}

.debug-panel {
  position: fixed;
  width: 350px;
  max-height: 60vh;
  background-color: rgba(0, 0, 0, 0.9);
  border-radius: 8px;
  overflow: hidden;
  z-index: 1000;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #8b5a3c;
  color: white;
}

.draggable-header {
  cursor: move;
  cursor: grab;
  user-select: none;
}

.draggable-header:active {
  cursor: grabbing;
}

.debug-title {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  font-weight: bold;
}

.debug-footer {
  font-family: monospace;
  font-size: 10px;
  color: #aaa;
  margin: 0;
  opacity: 0.78;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.debug-content {
  padding: 15px;
  max-height: calc(60vh - 60px);
  overflow-y: auto;
}

.debug-section {
  margin-bottom: 15px;
}

.debug-section h4 {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  color: #4ade80;
  margin-bottom: 8px;
  margin-top: 0;
}

.debug-text {
  font-family: "Courier New", monospace;
  font-size: 11px;
  color: #e5e5e5;
  background-color: rgba(20, 20, 40, 0.8);
  padding: 10px;
  border-radius: 4px;
  border-left: 3px solid #8b5a3c;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  max-height: 180px;
  overflow-y: auto;
}

.no-debug-data {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  color: #aaa;
  text-align: center;
  padding: 20px;
  margin: 0;
}
</style>
