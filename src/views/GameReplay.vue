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
            <div class="replay-name">{{ currentRecording?.name || '未知录制' }}</div>
            <div class="replay-progress">
              帧 {{ currentFrame }} / {{ totalFrames - 1 }}
            </div>
          </div>

          <div class="replay-buttons">
            <button @click="previousFrame" class="pixel-button control-button">
              上一帧
            </button>
            <button v-if="!isPlaying" @click="play" class="pixel-button control-button">
              播放
            </button>
            <button v-else-if="isPaused" @click="resume" class="pixel-button control-button">
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
            <button @click="copyCurrentFrameState" class="pixel-button control-button copy-button" title="复制当前帧状态作为算法输入">
              复制状态
            </button>
          </div>

          <div class="replay-speed">
            <span class="speed-label">速度:</span>
            <select v-model="playbackSpeed" @change="updatePlaybackSpeed" class="speed-select">
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
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import GameUILeft from "../components/GameUILeft.vue";
import GameUIRight from "../components/GameUIRight.vue";
import GameRankings from "../components/GameRankings.vue";
import { GameReplayManager } from "../managers/GameReplayManager";
import { gameRecordingService } from "../services/gameRecordingService";
import { GameRecording } from "../types/GameRecording";
import { eventBus, GameEventType } from "../core/EventBus";
import { copyGameStateToClipboard } from "../utils/gameStateFormatter";

const router = useRouter();
const replayCanvas = ref<HTMLCanvasElement | null>(null);
const replayManager = ref<GameReplayManager | null>(null);

// 回放状态
const currentRecording = ref<GameRecording | null>(null);
const isLoading = ref(true);
const isPlaying = ref(false);
const isPaused = ref(false);
const currentFrame = ref(0);
const totalFrames = ref(0);
const playbackSpeed = ref("1");

// 最终排名相关状态
const showFinalRankings = ref<boolean>(false);
const finalScores = ref<any[]>([]);

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
      currentFrame.value = 0;

      console.log(`Loaded recording: ${recording.name}`);
    } else {
      console.error("Failed to load recording or replay manager not initialized");
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
    replayManager.value.stop();
    isPlaying.value = false;
    isPaused.value = false;
    currentFrame.value = 0;
  }
};

const nextFrame = () => {
  if (replayManager.value) {
    replayManager.value.nextFrame();
    currentFrame.value = replayManager.value.getCurrentFrameIndex();
  }
};

const previousFrame = () => {
  if (replayManager.value) {
    replayManager.value.previousFrame();
    currentFrame.value = replayManager.value.getCurrentFrameIndex();
  }
};

const seekToFrame = () => {
  if (replayManager.value) {
    replayManager.value.jumpToFrame(currentFrame.value);
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
    const success = await copyGameStateToClipboard(currentFrame);
    if (success) {
      // 发送通知而不是弹出警告框
      eventBus.emit(GameEventType.UI_NOTIFICATION, `已复制第 ${currentFrame.tick} 帧状态到剪贴板`);
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

// 监听回放管理器状态变化
const setupReplayManagerWatcher = () => {
  // 每秒更新当前帧
  const updateInterval = setInterval(() => {
    if (replayManager.value && isPlaying.value && !isPaused.value) {
      currentFrame.value = replayManager.value.getCurrentFrameIndex();
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
  if (replayManager.value && !isPlaying.value) {
    replayManager.value.jumpToFrame(newFrame);
  }
});

onMounted(() => {
  // 从会话存储中获取当前回放ID
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
  width: calc(100% - 560px); /* 减去左右两侧面板的宽度 */
  min-width: 500px; /* 确保最小宽度 */
}

.game-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(20, 20, 40, 0.8);
  padding: 10px;
  flex-grow: 1;
  min-height: 500px; /* 确保最小高度 */
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
  max-height: 180px; /* 限制控制面板的最大高度 */
}

.replay-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.replay-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #4ade80;
}

.replay-progress {
  font-family: 'Press Start 2P', monospace;
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
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #aaa;
}

.speed-select {
  background-color: #2a2a3e;
  color: #fff;
  border: 1px solid #4a4a5e;
  padding: 4px;
  font-family: 'Press Start 2P', monospace;
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
</style>
