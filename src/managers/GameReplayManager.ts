import { CanvasManager } from "./CanvasManager";
import { GameRecording, GameRecordingFrame } from "../types/GameRecording";
import { eventBus, GameEventType } from "../core/EventBus";
import { EntityFactory } from "../factories/EntityFactory";
import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { Direction } from "../config/GameConfig";

/**
 * Manages the playback of recorded game sessions
 */
export class GameReplayManager {
  private canvasManager: CanvasManager;
  private entityFactory: EntityFactory;
  private recording: GameRecording | null = null;
  // -1 表示处于 initialFrame（初始状态）
  private currentFrameIndex: number = -1;
  // 显示是否处于 initialFrame 状态
  private atInitialState: boolean = false;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private playbackSpeed: number = 1;
  private animationId: number = 0;
  private lastRenderTime: number = 0;
  private tickInterval: number = 250; // Default tick interval in ms

  constructor(canvas: HTMLCanvasElement) {
    this.canvasManager = new CanvasManager(canvas);
    this.entityFactory = new EntityFactory();
  }

  /**
   * Loads a game recording for playback
   */
  loadRecording(recording: GameRecording): void {
    this.recording = recording;
    // 进入回放时渲染 initialFrame，索引设为 -1 表示初始状态
    this.currentFrameIndex = -1;
    this.atInitialState = true;
    this.isPlaying = false;
    this.isPaused = false;

    console.log(`Loaded recording with ${recording.frames.length} frames`);

    // 清空之前的通知
    this.clearNotifications();

    // 添加初始通知（系统通知）
    this.sendReplayNotification("回放已加载，准备开始", true);
    this.sendReplayNotification(`总共 ${recording.frames.length} 帧`, true);
    this.sendReplayNotification(`${recording.players.length} 名玩家参与`, true);

    // 渲染初始状态（优先使用 initialFrame，兼容旧数据回退到 frames[0]）
    const initialFrame = recording.initialFrame || recording.frames[0];
    if (initialFrame) {
      this.renderFrame(initialFrame);

      // 更新UI
      eventBus.emit(GameEventType.UI_UPDATE_TIMER, recording.totalTicks);
      eventBus.emit(
        GameEventType.UI_UPDATE_SCOREBOARD,
        this.deserializeSnakes(initialFrame.gameState.entities.snakes)
      );

      // 添加初始状态通知
      this.sendReplayNotification("显示游戏初始状态", true);
    }
  }

  /**
   * Starts playback of the loaded recording
   */
  play(): void {
    if (!this.recording || this.isPlaying) return;

    // 设置播放状态
    this.isPlaying = true;
    this.isPaused = false;

    // 添加播放开始通知（系统通知）
    this.sendReplayNotification("回放开始", true);

    // 重置计时器，确保第一帧立即播放
    this.lastRenderTime = 0;

    // 如果处于初始状态（-1），保持不变，playbackLoop 会推进到第 0 帧；
    // 如果从中间某一帧开始播放，回到前一帧（playbackLoop 会前进到当前帧）
    if (this.currentFrameIndex >= 0) {
      this.currentFrameIndex = Math.max(0, this.currentFrameIndex - 1);
    }

    // 开始播放循环
    cancelAnimationFrame(this.animationId); // 确保没有多个循环同时运行
    this.playbackLoop(performance.now());

    console.log("Started playback");
  }

  /**
   * Pauses playback
   */
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    cancelAnimationFrame(this.animationId);

    // 添加暂停通知（系统通知）
    this.sendReplayNotification("回放暂停", true);

    console.log("Paused playback");
  }

  /**
   * Resumes playback from pause
   */
  resume(): void {
    if (!this.isPlaying || !this.isPaused) return;

    this.isPaused = false;
    this.playbackLoop(performance.now());

    // 添加继续通知（系统通知）
    this.sendReplayNotification("回放继续", true);

    console.log("Resumed playback");
  }

  /**
   * Stops playback and resets to the beginning
   */
  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    // 回到初始状态
    this.currentFrameIndex = -1;
    this.atInitialState = true;
    cancelAnimationFrame(this.animationId);

    // 添加停止通知（系统通知）
    this.sendReplayNotification("回放停止并重置", true);

    // 渲染初始状态（优先 initialFrame）
    if (this.recording) {
      const initialFrame = this.recording.initialFrame || this.recording.frames[0];
      if (initialFrame) {
        this.renderFrame(initialFrame);

        // Update UI
        eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.recording.totalTicks);
        eventBus.emit(
          GameEventType.UI_UPDATE_SCOREBOARD,
          this.deserializeSnakes(initialFrame.gameState.entities.snakes)
        );
      }
    }

    console.log("Stopped playback");
  }

  /**
   * Sets the playback speed
   * @param speed Playback speed multiplier (0.5, 1, 2, etc.)
   */
  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    console.log(`Playback speed set to ${speed}x`);
  }

  /**
   * Jumps to a specific frame in the recording
   * @param frameIndex 帧索引
   */
  jumpToFrame(frameIndex: number): void {
    if (!this.recording) return;

    // 获取当前帧的蛇状态（如果不是初始状态）
    let previousSnakes: any[] = [];
    if (this.currentFrameIndex >= 0 && this.currentFrameIndex < this.recording.frames.length) {
      previousSnakes = this.recording.frames[this.currentFrameIndex].gameState.entities.snakes;
    }

    // 确保帧索引在有效范围内
    const index = Math.max(0, Math.min(frameIndex, this.recording.frames.length - 1));

    // 如果是大幅度跳转（超过10帧），清空通知并重新生成
    const jumpDistance = Math.abs(index - this.currentFrameIndex);
    if (jumpDistance > 10) {
      this.clearNotifications();

      // 添加跳转通知（系统通知）
      this.sendReplayNotification(`跳转到第 ${index + 1} 帧`, true);

      // 如果是向前跳转，重新生成从开始到当前帧的所有重要通知
      if (index > 0 && index > this.currentFrameIndex) {
        // 获取第一帧的蛇状态
        const firstFrameSnakes = this.recording.frames[0].gameState.entities.snakes;
        // 获取目标帧的蛇状态
        const targetFrameSnakes = this.recording.frames[index].gameState.entities.snakes;

        // 检测从第一帧到目标帧的蛇状态变化
        this.detectSnakeStateChanges(firstFrameSnakes, targetFrameSnakes);
      }
    } else if (index > this.currentFrameIndex && previousSnakes.length > 0) {
      // 如果是小幅度向前跳转，只检测相邻帧之间的变化
      const frame = this.recording.frames[index];
      this.detectSnakeStateChanges(previousSnakes, frame.gameState.entities.snakes);
    }

    // 若处于初始显示状态并跳到第 0 帧，退出初始态
    if (this.atInitialState && index === 0) {
      this.atInitialState = false;
    }
    this.currentFrameIndex = index;

    // 获取目标帧
    const frame = this.recording.frames[index];

    // Render the frame
    this.renderFrame(frame);

    // Update UI
    eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.getRemainingTicksForIndex(index));
    eventBus.emit(GameEventType.UI_UPDATE_SCOREBOARD,
      this.deserializeSnakes(frame.gameState.entities.snakes));

    console.log(`Jumped to frame ${index}`);
  }

  /**
   * Jumps to the next frame
   */
  nextFrame(): void {
    if (!this.recording) return;
    
    console.log(`Current frame index before nextFrame: ${this.currentFrameIndex}`);

    // 特殊处理：从初始态前进一步，只应到第 0 帧
    if (this.currentFrameIndex === -1 || this.atInitialState) {
      this.atInitialState = false;
      this.currentFrameIndex = 0;
      const frame0 = this.recording.frames[0];
      this.sendReplayNotification("游戏开始", true);
      this.renderFrame(frame0);
      eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.getRemainingTicksForIndex(0));
      eventBus.emit(
        GameEventType.UI_UPDATE_SCOREBOARD,
        this.deserializeSnakes(frame0.gameState.entities.snakes)
      );
      // this.sendReplayNotification(`当前帧: ${1}/${this.recording.frames.length}`, true);
      return;
    }

    const nextIndex = this.currentFrameIndex + 1;
    if (nextIndex < this.recording.frames.length) {
      // 获取当前帧的蛇状态
      let previousSnakes: any[] = [];
      if (this.currentFrameIndex >= 0 && this.currentFrameIndex < this.recording.frames.length) {
        previousSnakes = this.recording.frames[this.currentFrameIndex].gameState.entities.snakes;
      }

      // 更新当前帧索引
      this.currentFrameIndex = nextIndex;

      // 获取下一帧
      const frame = this.recording.frames[nextIndex];

      // 如果是从初始状态（-1）到第一帧（0），添加特殊通知
      if (nextIndex === 0) {
        this.sendReplayNotification("游戏开始", true);
      } else if (this.currentFrameIndex > 0) {
        // 只有在不是从初始状态到第一帧的情况下才检测状态变化
        this.detectSnakeStateChanges(previousSnakes, frame.gameState.entities.snakes);
      }

      // 渲染帧并更新UI
      this.renderFrame(frame);
      eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.getRemainingTicksForIndex(nextIndex));
      eventBus.emit(GameEventType.UI_UPDATE_SCOREBOARD,
        this.deserializeSnakes(frame.gameState.entities.snakes));

      // 添加帧变化通知（系统通知）
      this.sendReplayNotification(`当前帧: ${nextIndex + 1}/${this.recording.frames.length}`, true);
    }
  }

  /**
   * Jumps to the previous frame
   */
  previousFrame(): void {
    if (!this.recording) return;

    const prevIndex = this.currentFrameIndex - 1;

    // 如果前一帧是有效帧
    if (prevIndex >= 0) {
      // 直接跳转到前一帧，但不生成状态变化通知
      // 因为向后播放时不需要显示死亡通知等
      this.currentFrameIndex = prevIndex;

      // 渲染帧并更新UI
      const frame = this.recording.frames[prevIndex];
      this.renderFrame(frame);
      eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.getRemainingTicksForIndex(prevIndex));
      eventBus.emit(GameEventType.UI_UPDATE_SCOREBOARD,
        this.deserializeSnakes(frame.gameState.entities.snakes));

      // 添加帧变化通知（系统通知）
      this.sendReplayNotification(`当前帧: ${prevIndex + 1}/${this.recording.frames.length}`, true);
    }
  }

  /**
   * The main playback loop
   */
  private playbackLoop(timestamp: number): void {
    if (!this.isPlaying || this.isPaused || !this.recording) return;

    // 计算自上次渲染以来的时间差
    const deltaTime = timestamp - (this.lastRenderTime || timestamp);

    // 计算基于播放速度的帧间隔
    const adjustedInterval = this.tickInterval / this.playbackSpeed;

    // 检查是否应该前进到下一帧
    if (deltaTime >= adjustedInterval || this.lastRenderTime === 0) {
      // 更新上次渲染时间
      this.lastRenderTime = timestamp;

      // 获取当前帧的蛇状态
      let previousSnakes: any[] = [];

      // 获取当前帧的蛇状态
      if (this.currentFrameIndex >= 0 && this.currentFrameIndex < this.recording.frames.length) {
        previousSnakes = this.recording.frames[this.currentFrameIndex].gameState.entities.snakes;
      }

      // 前进到下一帧；若处于初始态，则切换到第 0 帧
      if (this.currentFrameIndex === -1 || this.atInitialState) {
        this.atInitialState = false;
        this.currentFrameIndex = 0;
      } else {
        this.currentFrameIndex++;
      }

      // 检查是否到达录制结束
      if (this.currentFrameIndex >= this.recording.frames.length) {
        // 录制结束，显示最终得分（系统通知）
        this.sendReplayNotification("回放结束", true);
        eventBus.emit(GameEventType.UI_FINAL_SCORES, this.recording.finalScores);
        this.isPlaying = false;
        return;
      }

      // 获取当前帧
      const frame = this.recording.frames[this.currentFrameIndex];

      // 只有在不是从初始状态到第一帧的情况下才检测状态变化
      if (this.currentFrameIndex > 0) {
        this.detectSnakeStateChanges(previousSnakes, frame.gameState.entities.snakes);
      }

      // 渲染当前帧
      this.renderFrame(frame);

      // 更新UI
      eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.getRemainingTicksForIndex(this.currentFrameIndex));
      eventBus.emit(GameEventType.UI_UPDATE_SCOREBOARD,
        this.deserializeSnakes(frame.gameState.entities.snakes));
    }

    // 请求下一帧动画
    this.animationId = requestAnimationFrame(this.playbackLoop.bind(this));
  }

  /**
   * 检测蛇的状态变化并生成通知
   */
  private detectSnakeStateChanges(previousSnakes: any[], currentSnakes: any[]): void {
    // 如果没有前一帧数据，则跳过
    if (!previousSnakes.length) return;

    // 遍历前一帧中的每条蛇
    for (const prevSnake of previousSnakes) {
      // 在当前帧中查找相同的蛇
      const currentSnake = currentSnakes.find(s =>
        s.metadata && prevSnake.metadata &&
        s.metadata.name === prevSnake.metadata.name
      );

      // 如果找到了相同的蛇，检查状态变化
      if (currentSnake) {
        // 检查蛇是否从活着变成死亡状态
        if (prevSnake.alive && !currentSnake.alive) {
          const snakeName = currentSnake.metadata?.name || "未知蛇";
          const deathReason = currentSnake.deathReason || "未知原因";

          // 生成带颜色的死亡通知，添加回放标记
          const snakeColor = currentSnake.color;
          const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;
          this.sendReplayNotification(`${coloredSnakeName} ${deathReason}`);
        }

        // 检查蛇是否激活了护盾
        if (!prevSnake.shieldActive && currentSnake.shieldActive) {
          const snakeName = currentSnake.metadata?.name || "未知蛇";
          const snakeColor = currentSnake.color;
          const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;
          this.sendReplayNotification(`${coloredSnakeName} 激活了护盾`);
        }
      } else {
        // 如果在当前帧中找不到这条蛇，说明它可能完全消失了
        const snakeName = prevSnake.metadata?.name || "未知蛇";
        const snakeColor = prevSnake.color;
        const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;
        this.sendReplayNotification(`${coloredSnakeName} 已离开游戏`);
      }
    }

    // 检查新加入的蛇
    for (const currentSnake of currentSnakes) {
      const prevSnake = previousSnakes.find(s =>
        s.metadata && currentSnake.metadata &&
        s.metadata.name === currentSnake.metadata.name
      );

      if (!prevSnake) {
        const snakeName = currentSnake.metadata?.name || "未知蛇";
        const snakeColor = currentSnake.color;
        const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;
        this.sendReplayNotification(`${coloredSnakeName} 加入了游戏`);
      }
    }
  }

  /**
   * 发送带有回放标记的通知
   * @param message 通知消息
   * @param isSystemNotification 是否是系统通知（非游戏内容通知）
   */
  private sendReplayNotification(message: string, isSystemNotification: boolean = false): void {
    // 根据通知类型添加不同的标记
    let className = isSystemNotification ? "replay-system-notification" : "replay-game-notification";
    const prefix = isSystemNotification ? "[系统] " : "";

    // 添加回放标记，使通知在UI中可区分
    const replayMessage = `<span class="${className}">${prefix}${message}</span>`;
    eventBus.emit(GameEventType.UI_NOTIFICATION, replayMessage);
  }

  /**
   * 清空所有通知并重新开始
   */
  private clearNotifications(): void {
    // 发送游戏开始事件，这会触发GameUILeft组件清空通知
    eventBus.emit(GameEventType.GAME_START);
  }

  /**
   * Renders a single frame of the recording
   */
  private renderFrame(frame: GameRecordingFrame): void {
    console.log(`Rendering frame ${this.currentFrameIndex} at tick ${frame.tick}`, frame);
    // Deserialize entities from the frame
    const snakes = this.deserializeSnakes(frame.gameState.entities.snakes);
    const foodItems = this.deserializeFoodItems(frame.gameState.entities.foodItems);
    const obstacles = this.deserializeObstacles(frame.gameState.entities.obstacles);
    
    // Deserialize treasure chests and keys if available
    const treasureChests = frame.gameState.entities.treasureChests 
      ? this.deserializeTreasureChests(frame.gameState.entities.treasureChests) 
      : [];
    const keys = frame.gameState.entities.keys 
      ? this.deserializeKeys(frame.gameState.entities.keys) 
      : [];

    // Get vortex field data for rendering (stored for future use)
    const vortexFieldData = frame.gameState.vortexField;

    // Render the entities
    const renderables = [...foodItems, ...snakes, ...treasureChests, ...keys];
    this.canvasManager.renderObstacles(obstacles);
    this.canvasManager.render(renderables);

    // Render safe zone if available
    if (frame.gameState.safeZone && frame.gameState.safeZone.enabled) {
      this.canvasManager.renderSafeZoneFromSerialized(
        frame.gameState.safeZone.currentBounds,
        frame.gameState.safeZone.isWarning,
        frame.gameState.safeZone.isShrinking
      );
    }

    // TODO: Render vortex field if active
    // This will need to be implemented in CanvasManager
    if (vortexFieldData && vortexFieldData.stateCode > 0) {
      console.log(`[Replay] Vortex field active: state=${vortexFieldData.stateCode}, center=(${vortexFieldData.param2}, ${vortexFieldData.param3})`);
    }
  }

  /**
   * 根据帧索引计算剩余 Tick：
   * - 初始态（-1）：返回 totalTicks
   * - 第 i 帧（从 0 开始）：视为经过 i+1 个 tick
   */
  private getRemainingTicksForIndex(index: number): number {
    if (!this.recording) return 0;
    if (index < 0) return this.recording.totalTicks;
    const elapsed = index + 1; // 第 0 帧已消耗 1 个 tick
    return Math.max(0, this.recording.totalTicks - elapsed);
  }

  /**
   * Deserializes snake entities from serialized data
   */
  private deserializeSnakes(serializedSnakes: any[]): Snake[] {
    return serializedSnakes.map(data => {
      // Create a dummy decision strategy for replay
      const dummyStrategy = {
        makeDecision: async () => {}, // Empty implementation
        cleanup: () => {} // Empty implementation
      };

      // Create a snake instance with basic properties
      const snake = new Snake(
        data.position,
        data.size,
        data.color,
        data.direction as Direction,
        dummyStrategy,
        data.metadata || {},
        data.id
      );

      // Set additional properties
      snake.setPosition(data.position);

      // Use reflection to set private properties
      Object.keys(data).forEach(key => {
        if (key !== 'entityType' && key !== 'position' && key !== 'size') {
          (snake as any)[key] = data[key];
        }
      });

      return snake;
    });
  }

  /**
   * Deserializes food entities from serialized data
   */
  private deserializeFoodItems(serializedFoodItems: any[]): Food[] {
    return serializedFoodItems.map(data => {
      // Create a food instance with basic properties
      const food = this.entityFactory.createFood(
        data.position,
        data.type,
        data.value,
        data.color,
        data.ttl,
        data.natural
      );

      // Set additional properties
      food.setPosition(data.position);

      // Use reflection to set private properties
      Object.keys(data).forEach(key => {
        if (key !== 'entityType' && key !== 'position' && key !== 'size') {
          (food as any)[key] = data[key];
        }
      });

      return food;
    });
  }

  /**
   * Deserializes obstacle entities from serialized data
   */
  private deserializeObstacles(serializedObstacles: any[]): Obstacle[] {
    return serializedObstacles.map(data => {
      // Create an obstacle instance directly
      const obstacle = new Obstacle(
        data.position,
        data.size
      );

      // Set additional properties
      obstacle.setPosition(data.position);

      return obstacle;
    });
  }

  /**
   * Deserializes treasure chest entities from serialized data
   */
  private deserializeTreasureChests(serializedTreasureChests: any[]): TreasureChest[] {
    return serializedTreasureChests.map(data => {
      // Create a treasure chest instance
      const treasureChest = new TreasureChest(
        data.position,
        data.size,
        data.score
      );

      // Set opened state if it was opened
      if (data.isOpened) {
        treasureChest.open();
      }

      return treasureChest;
    });
  }

  /**
   * Deserializes key entities from serialized data
   */
  private deserializeKeys(serializedKeys: any[]): Key[] {
    return serializedKeys.map(data => {
      // Create a key instance
      const key = new Key(
        data.position,
        data.size,
        data.id
      );

      return key;
    });
  }

  /**
   * Gets the current recording
   */
  getRecording(): GameRecording | null {
    return this.recording;
  }

  /**
   * Gets the current frame index
   */
  getCurrentFrameIndex(): number {
    return this.atInitialState ? -1 : this.currentFrameIndex;
  }

  getPrevFrame(prev: number = 1): GameRecordingFrame | null {
    if (!this.recording) return null;
    if (this.currentFrameIndex < prev || this.currentFrameIndex >= this.recording.frames.length) {
      return null;
    }
    return this.recording.frames[this.currentFrameIndex - prev];
  }

  /**
   * Gets the current frame
   */
  getCurrentFrame(): GameRecordingFrame | null {
    if (!this.recording) return null;
    if (this.currentFrameIndex === -1 || this.atInitialState) {
      // 初始状态返回 initialFrame（兼容旧数据）
      return this.recording.initialFrame || this.recording.frames[0] || null;
    }
    if (this.currentFrameIndex < 0 || this.currentFrameIndex >= this.recording.frames.length) {
      return null;
    }
    return this.recording.frames[this.currentFrameIndex];
  }

  /**
   * Gets the total number of frames in the current recording
   */
  getTotalFrames(): number {
    return this.recording ? this.recording.frames.length : 0;
  }

  /**
   * Checks if playback is currently active
   */
  isPlaybackActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Checks if playback is currently paused
   */
  isPlaybackPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Gets the current playback speed
   */
  getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    this.isPlaying = false;
    this.isPaused = false;
    cancelAnimationFrame(this.animationId);
    this.recording = null;
  }
}
