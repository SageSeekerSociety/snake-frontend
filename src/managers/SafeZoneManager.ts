import { GameConfig, GamePhase } from "../config/GameConfig";
import { Position } from "../types/Position";
import { eventBus, GameEventType } from "../core/EventBus";
import { SerializedSafeZone } from "../types/GameRecording";
import { SafeZoneBounds } from "../types/GameState";

/**
 * Safe zone shrink event information for AI
 */
export interface SafeZoneShrinkEventInfo {
  startTick: number;
  targetBounds: SafeZoneBounds;
}

/**
 * Complete safe zone information for AI algorithms
 */
export interface SafeZoneAlgorithmInfo {
  currentBounds: SafeZoneBounds;
  nextShrinkEvent?: SafeZoneShrinkEventInfo;
  finalShrinkEvent?: SafeZoneShrinkEventInfo;
}

/**
 * Safe zone status for rendering and API
 */
export interface SafeZoneStatus {
  enabled: boolean;
  currentBounds: SafeZoneBounds;
  isWarning: boolean;
  isShrinking: boolean;
  nextShrinkTick?: number;
  targetBounds?: SafeZoneBounds;
}

type ShrinkEvent = {
  START_TICK: number;
  DURATION: number;
  TARGET_SIZE: { WIDTH: number; HEIGHT: number };
};

type StablePhaseConfig = {
  START_TICK: number;
  END_TICK: number;
  SAFE_ZONE_STATE: "STABLE";
};

type ShrinkingPhaseConfig = {
  START_TICK: number;
  END_TICK: number;
  SAFE_ZONE_STATE: "SHRINKING";
  SHRINK_EVENTS: readonly ShrinkEvent[];
};

type AnyPhaseConfig = StablePhaseConfig | ShrinkingPhaseConfig;

function isShrinkingPhase(cfg: AnyPhaseConfig): cfg is ShrinkingPhaseConfig {
  return cfg.SAFE_ZONE_STATE === "SHRINKING";
}

/**
 * Manages the safe zone system - a rectangular area that shrinks over time.
 * Snakes outside the safe zone are instantly killed.
 */
export class SafeZoneManager {
  private enabled: boolean;
  private currentBounds: SafeZoneBounds;
  private isWarning: boolean = false;
  private isShrinking: boolean = false;
  private shrinkStartTick?: number;
  private shrinkDuration?: number;
  private targetBounds?: SafeZoneBounds;
  private initialBoundsForCurrentShrink?: SafeZoneBounds;

  // 圈式收缩相关属性
  private phase1Duration?: number;  // 阶段1持续时间（调平阶段）
  private phase2Duration?: number;  // 阶段2持续时间（圆形收缩阶段）
  private phase1ShrinkAxis?: 'x' | 'y' | 'none';  // 阶段1收缩的轴
  private phase1ShrinkAmount?: number;  // 阶段1每边收缩量
  private phase2ShrinkAmount?: number;  // 阶段2每边收缩量（X和Y相等）

  constructor() {
    this.enabled = GameConfig.SAFE_ZONE.ENABLED;
    this.currentBounds = {
      xMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MIN,
      xMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MAX,
      yMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MIN,
      yMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MAX,
    };
  }

  /**
   * Updates safe zone state for the current tick
   */
  public update(currentTick: number): void {
    if (!this.enabled) return;

    // Check if we need to start a new shrinking event
    this.checkForShrinkEvents(currentTick);

    // Update shrinking animation
    if (this.isShrinking && this.shrinkStartTick && this.shrinkDuration && this.targetBounds) {
      this.updateShrinking(currentTick);
    }

    // Check for warning state
    this.checkForWarnings(currentTick);
  }

  /**
   * Checks if a position is within the current safe zone
   */
  public isPositionSafe(position: Position): boolean {
    if (!this.enabled) return true;

    const gridX = Math.floor(position.x / GameConfig.CANVAS.BOX_SIZE);
    const gridY = Math.floor(position.y / GameConfig.CANVAS.BOX_SIZE);

    return (
      gridX >= this.currentBounds.xMin &&
      gridX <= this.currentBounds.xMax &&
      gridY >= this.currentBounds.yMin &&
      gridY <= this.currentBounds.yMax
    );
  }

  /**
   * Checks if a grid position (in grid coordinates) is within the current safe zone
   */
  public isGridPositionSafe(gridX: number, gridY: number): boolean {
    if (!this.enabled) return true;

    return (
      gridX >= this.currentBounds.xMin &&
      gridX <= this.currentBounds.xMax &&
      gridY >= this.currentBounds.yMin &&
      gridY <= this.currentBounds.yMax
    );
  }

  /**
   * Gets current safe zone bounds in grid coordinates
   */
  public getCurrentBounds(): SafeZoneBounds {
    return { ...this.currentBounds };
  }

  /**
   * Gets current safe zone status for rendering and API
   */
  public getStatus(currentTick?: number): SafeZoneStatus {
    return {
      enabled: this.enabled,
      currentBounds: { ...this.currentBounds },
      isWarning: this.isWarning,
      isShrinking: this.isShrinking,
      nextShrinkTick: currentTick !== undefined ? this.getNextShrinkTickForTick(currentTick) : undefined,
      targetBounds: this.targetBounds ? { ...this.targetBounds } : undefined,
    };
  }

  /**
   * Resets safe zone to initial state
   */
  public reset(): void {
    this.currentBounds = {
      xMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MIN,
      xMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MAX,
      yMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MIN,
      yMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MAX,
    };
    this.isWarning = false;
    this.isShrinking = false;
    this.shrinkStartTick = undefined;
    this.shrinkDuration = undefined;
    this.targetBounds = undefined;
    this.phase1Duration = undefined;
    this.phase2Duration = undefined;
    this.phase1ShrinkAxis = undefined;
    this.phase1ShrinkAmount = undefined;
    this.phase2ShrinkAmount = undefined;
    this.initialBoundsForCurrentShrink = undefined;
  }

  /**
   * Disables safe zone system
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Enables safe zone system
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Checks for shrink events in the current tick
   */
  private checkForShrinkEvents(currentTick: number): void {
    const currentPhase = this.getCurrentPhase(currentTick);
    if (!currentPhase) return;

    const phaseConfig = GameConfig.SAFE_ZONE.PHASES[currentPhase] as AnyPhaseConfig;
    if (!isShrinkingPhase(phaseConfig)) return;

    for (const shrinkEvent of phaseConfig.SHRINK_EVENTS) {
      if (currentTick === shrinkEvent.START_TICK && !this.isShrinking) {
        this.startShrinking(shrinkEvent, currentTick);
        break;
      }
    }
  }


  /**
   * Starts a shrinking event with ring-based shrinking logic
   */
  private startShrinking(shrinkEvent: any, currentTick: number): void {
    this.isShrinking = true;
    this.shrinkStartTick = currentTick;
    this.shrinkDuration = shrinkEvent.DURATION;

    // Store initial bounds for this shrink (current bounds become the starting point)
    this.initialBoundsForCurrentShrink = { ...this.currentBounds };

    // Calculate current size
    const currentWidth = this.currentBounds.xMax - this.currentBounds.xMin + 1;
    const currentHeight = this.currentBounds.yMax - this.currentBounds.yMin + 1;
    const targetWidth = shrinkEvent.TARGET_SIZE.WIDTH;
    const targetHeight = shrinkEvent.TARGET_SIZE.HEIGHT;

    // Calculate total shrink amount per side for each axis
    const totalShrinkX = (currentWidth - targetWidth) / 2;  // 每边需要收缩的X格数
    const totalShrinkY = (currentHeight - targetHeight) / 2;  // 每边需要收缩的Y格数

    // Calculate target bounds
    this.targetBounds = {
      xMin: this.currentBounds.xMin + Math.floor(totalShrinkX),
      xMax: this.currentBounds.xMax - Math.ceil(totalShrinkX),
      yMin: this.currentBounds.yMin + Math.floor(totalShrinkY),
      yMax: this.currentBounds.yMax - Math.ceil(totalShrinkY),
    };

    // 设计圈式收缩：先收缩长边到与短边相等，再同时收缩
    if (totalShrinkX > totalShrinkY) {
      // X轴收缩更多，先收缩X轴
      this.phase1ShrinkAxis = 'x';
      this.phase1ShrinkAmount = totalShrinkX - totalShrinkY;  // 阶段1: X轴多收缩的部分
      this.phase2ShrinkAmount = totalShrinkY;  // 阶段2: 两轴同时收缩的部分
    } else if (totalShrinkY > totalShrinkX) {
      // Y轴收缩更多，先收缩Y轴
      this.phase1ShrinkAxis = 'y';
      this.phase1ShrinkAmount = totalShrinkY - totalShrinkX;  // 阶段1: Y轴多收缩的部分
      this.phase2ShrinkAmount = totalShrinkX;  // 阶段2: 两轴同时收缩的部分
    } else {
      // 两轴收缩相等，直接进入圆形收缩
      this.phase1ShrinkAxis = 'none';
      this.phase1ShrinkAmount = 0;
      this.phase2ShrinkAmount = totalShrinkX;  // 直接同时收缩两轴
    }

    // 时间分配：按收缩步数比例分配时间
    const totalSteps = Math.max(totalShrinkX, totalShrinkY);  // 总收缩步数
    const phase1Steps = this.phase1ShrinkAmount ?? 0;  // 阶段1步数
    const duration = this.shrinkDuration ?? 0;

    if (totalSteps > 0 && duration > 0) {
      this.phase1Duration = Math.round((phase1Steps / totalSteps) * duration);
      this.phase2Duration = duration - this.phase1Duration;
    } else {
      this.phase1Duration = 0;
      this.phase2Duration = 0;
    }

    // Verify the result
    const actualWidth = this.targetBounds.xMax - this.targetBounds.xMin + 1;
    const actualHeight = this.targetBounds.yMax - this.targetBounds.yMin + 1;

    console.log(`[SafeZone] Ring-based shrinking from ${currentWidth}x${currentHeight} to ${targetWidth}x${targetHeight} (actual: ${actualWidth}x${actualHeight})`);
    console.log(`[SafeZone] Phase1: ${this.phase1ShrinkAxis} axis, ${this.phase1ShrinkAmount} steps, ${this.phase1Duration} ticks`);
    console.log(`[SafeZone] Phase2: both axes, ${this.phase2ShrinkAmount} steps, ${this.phase2Duration} ticks`);
    console.log(`[SafeZone] Target bounds: (${this.targetBounds.xMin},${this.targetBounds.yMin}) to (${this.targetBounds.xMax},${this.targetBounds.yMax})`);

    // Emit event for UI notification only
    eventBus.emit(GameEventType.UI_NOTIFICATION, "Safe zone is shrinking!");
  }

  /**
   * Updates ring-based shrinking animation
   */
  private updateShrinking(currentTick: number): void {
    if (!this.shrinkStartTick || !this.shrinkDuration || !this.targetBounds || !this.initialBoundsForCurrentShrink) return;
    if (this.phase1Duration === undefined || this.phase2Duration === undefined) return;
    if (this.phase1ShrinkAxis === undefined || this.phase1ShrinkAmount === undefined || this.phase2ShrinkAmount === undefined) return;

    const elapsed = currentTick - this.shrinkStartTick;
    const totalProgress = Math.min(elapsed / this.shrinkDuration, 1.0);

    if (totalProgress >= 1.0) {
      // Shrinking complete
      this.currentBounds = { ...this.targetBounds };
      this.isShrinking = false;
      this.shrinkStartTick = undefined;
      this.shrinkDuration = undefined;
      this.targetBounds = undefined;
      this.initialBoundsForCurrentShrink = undefined;
      this.phase1Duration = undefined;
      this.phase2Duration = undefined;
      this.phase1ShrinkAxis = undefined;
      this.phase1ShrinkAmount = undefined;
      this.phase2ShrinkAmount = undefined;
      console.log(`[SafeZone] Ring shrinking complete. New bounds: (${this.currentBounds.xMin},${this.currentBounds.yMin}) to (${this.currentBounds.xMax},${this.currentBounds.yMax})`);
      return;
    }

    // 判断当前处于哪个阶段
    const previousBounds = { ...this.currentBounds };
    let currentShrinkX = 0;
    let currentShrinkY = 0;

    if (this.phase1Duration > 0 && elapsed < this.phase1Duration) {
      // 阶段1：只收缩长边
      const phase1Progress = elapsed / this.phase1Duration;
      const phase1ShrinkAmount = Math.round((this.phase1ShrinkAmount ?? 0) * phase1Progress);

      if (this.phase1ShrinkAxis === 'x') {
        currentShrinkX = phase1ShrinkAmount;
        currentShrinkY = 0;
      } else if (this.phase1ShrinkAxis === 'y') {
        currentShrinkX = 0;
        currentShrinkY = phase1ShrinkAmount;
      }
    } else {
      // 阶段2：同时收缩两轴（圆形收缩）
      const phase2Elapsed = elapsed - (this.phase1Duration ?? 0);
      const phase2Progress = (this.phase2Duration ?? 0) > 0 ? Math.min(phase2Elapsed / (this.phase2Duration ?? 0), 1.0) : 1.0;
      const phase2ShrinkAmount = Math.round((this.phase2ShrinkAmount ?? 0) * phase2Progress);

      // 阶段1的收缩量（已完成）
      if (this.phase1ShrinkAxis === 'x') {
        currentShrinkX = (this.phase1ShrinkAmount ?? 0) + phase2ShrinkAmount;
        currentShrinkY = phase2ShrinkAmount;
      } else if (this.phase1ShrinkAxis === 'y') {
        currentShrinkX = phase2ShrinkAmount;
        currentShrinkY = (this.phase1ShrinkAmount ?? 0) + phase2ShrinkAmount;
      } else {
        // phase1ShrinkAxis === 'none'，直接进入圆形收缩
        currentShrinkX = phase2ShrinkAmount;
        currentShrinkY = phase2ShrinkAmount;
      }
    }

    // 应用收缩到边界，保持对称性
    this.currentBounds = {
      xMin: this.initialBoundsForCurrentShrink.xMin + Math.floor(currentShrinkX),
      xMax: this.initialBoundsForCurrentShrink.xMax - Math.ceil(currentShrinkX),
      yMin: this.initialBoundsForCurrentShrink.yMin + Math.floor(currentShrinkY),
      yMax: this.initialBoundsForCurrentShrink.yMax - Math.ceil(currentShrinkY),
    };

    // Emit food cleanup event when bounds actually change
    const boundsChanged = (
      previousBounds.xMin !== this.currentBounds.xMin ||
      previousBounds.xMax !== this.currentBounds.xMax ||
      previousBounds.yMin !== this.currentBounds.yMin ||
      previousBounds.yMax !== this.currentBounds.yMax
    );

    if (boundsChanged) {
      eventBus.emit(GameEventType.SAFE_ZONE_SHRINK_START, {
        previousBounds: previousBounds,
        currentBounds: this.currentBounds
      });
    }
  }

  /**
   * ===== 统一的圈式收缩计划（供预测/AI使用） =====
   */
  private buildRingPlan(
    initialBounds: SafeZoneBounds,
    targetWidth: number,
    targetHeight: number,
    duration: number
  ) {
    const currentWidth = initialBounds.xMax - initialBounds.xMin + 1;
    const currentHeight = initialBounds.yMax - initialBounds.yMin + 1;

    const totalShrinkX = (currentWidth - targetWidth) / 2;
    const totalShrinkY = (currentHeight - targetHeight) / 2;

    const targetBounds: SafeZoneBounds = {
      xMin: initialBounds.xMin + Math.floor(totalShrinkX),
      xMax: initialBounds.xMax - Math.ceil(totalShrinkX),
      yMin: initialBounds.yMin + Math.floor(totalShrinkY),
      yMax: initialBounds.yMax - Math.ceil(totalShrinkY),
    };

    let phase1ShrinkAxis: 'x' | 'y' | 'none';
    let phase1Steps: number;
    let phase2Steps: number;

    if (totalShrinkX > totalShrinkY) {
      phase1ShrinkAxis = 'x';
      phase1Steps = totalShrinkX - totalShrinkY;
      phase2Steps = totalShrinkY;
    } else if (totalShrinkY > totalShrinkX) {
      phase1ShrinkAxis = 'y';
      phase1Steps = totalShrinkY - totalShrinkX;
      phase2Steps = totalShrinkX;
    } else {
      phase1ShrinkAxis = 'none';
      phase1Steps = 0;
      phase2Steps = totalShrinkX;
    }

    const totalSteps = Math.max(totalShrinkX, totalShrinkY);
    const phase1Duration = (totalSteps > 0 && duration > 0)
      ? Math.round((phase1Steps / totalSteps) * duration)
      : 0;
    const phase2Duration = Math.max(duration - phase1Duration, 0);

    const boundsAtElapsed = (elapsed: number): SafeZoneBounds => {
      if (elapsed <= 0) return { ...initialBounds };
      if (elapsed >= duration) return { ...targetBounds };

      let shrinkX = 0;
      let shrinkY = 0;

      if (phase1Duration > 0 && elapsed < phase1Duration) {
        const p1 = elapsed / phase1Duration;
        const a1 = Math.round(phase1Steps * p1);
        if (phase1ShrinkAxis === 'x') {
          shrinkX = a1;
          shrinkY = 0;
        } else if (phase1ShrinkAxis === 'y') {
          shrinkX = 0;
          shrinkY = a1;
        }
      } else {
        const e2 = elapsed - phase1Duration;
        const p2 = phase2Duration > 0 ? Math.min(e2 / phase2Duration, 1.0) : 1.0;
        const a2 = Math.round(phase2Steps * p2);

        if (phase1ShrinkAxis === 'x') {
          shrinkX = phase1Steps + a2;
          shrinkY = a2;
        } else if (phase1ShrinkAxis === 'y') {
          shrinkX = a2;
          shrinkY = phase1Steps + a2;
        } else {
          shrinkX = a2;
          shrinkY = a2;
        }
      }

      return {
        xMin: initialBounds.xMin + Math.floor(shrinkX),
        xMax: initialBounds.xMax - Math.ceil(shrinkX),
        yMin: initialBounds.yMin + Math.floor(shrinkY),
        yMax: initialBounds.yMax - Math.ceil(shrinkY),
      };
    };

    const firstChangeTick = (startTick: number): { tick: number; bounds: SafeZoneBounds } | undefined => {
      const startBounds = boundsAtElapsed(0);
      for (let t = 1; t <= duration; t++) {
        const b = boundsAtElapsed(t);
        if (
          b.xMin !== startBounds.xMin ||
          b.xMax !== startBounds.xMax ||
          b.yMin !== startBounds.yMin ||
          b.yMax !== startBounds.yMax
        ) {
          return { tick: startTick + t, bounds: b };
        }
      }
      // 理论上不会走到这里；兜底返回完成态
      return { tick: startTick + duration, bounds: { ...targetBounds } };
    };

    return {
      targetBounds,
      phase1ShrinkAxis,
      phase1Steps,
      phase2Steps,
      phase1Duration,
      phase2Duration,
      boundsAtElapsed,
      firstChangeTick,
    };
  }

  /**
   * Checks for warning states before shrinking
   */
  private checkForWarnings(currentTick: number): void {
    const nextShrinkTick = this.getNextShrinkTickForTick(currentTick);

    if (nextShrinkTick) {
      const ticksUntilShrink = nextShrinkTick - currentTick;
      this.isWarning = ticksUntilShrink <= GameConfig.SAFE_ZONE.WARNING_TICKS_BEFORE_SHRINK && ticksUntilShrink > 0;
    } else {
      this.isWarning = false;
    }
  }

  /**
   * Gets complete safe zone information for AI algorithms
   * 需要提供：
   * 1) 当前边界
   * 2) 下一次发生“边界变化”的 tick 与边界
   * 3) 当前阶段（若当前阶段不收缩，则下一个收缩阶段）最终收缩完成时的 tick 与边界
   */
  public getAlgorithmInfo(currentTick: number): SafeZoneAlgorithmInfo {
    if (!this.enabled) {
      return {
        currentBounds: this.currentBounds
      };
    }

    const result: SafeZoneAlgorithmInfo = {
      currentBounds: { ...this.currentBounds }
    };

    // 2) 下一次变化
    const nextEvent = this.getNextShrinkEvent(currentTick);
    if (nextEvent) {
      result.nextShrinkEvent = {
        startTick: nextEvent.startTick,
        targetBounds: nextEvent.targetBounds
      };
    }

    // 3) 当前/下一次收缩的最终目标
    const finalEvent = this.getFinalOfCurrentOrNextShrinkEvent(currentTick);
    if (finalEvent) {
      result.finalShrinkEvent = {
        startTick: finalEvent.startTick,
        targetBounds: finalEvent.targetBounds
      };
    }

    return result;
  }

  /**
   * 计算下一次“边界实际发生变化”的事件（tick 与该 tick 的边界）
   * 与动画逻辑完全一致（圈式收缩）
   */
  private getNextShrinkEvent(currentTick: number): { startTick: number, targetBounds: SafeZoneBounds } | undefined {
    const phasesOrdered = [GamePhase.EARLY, GamePhase.MID, GamePhase.LATE];

    // 情况A：当前正处于收缩动画中
    if (this.isShrinking && this.shrinkStartTick !== undefined && this.shrinkDuration !== undefined
      && this.initialBoundsForCurrentShrink && this.targetBounds) {

      const duration = this.shrinkDuration;
      const startTick = this.shrinkStartTick;

      if (currentTick < startTick + duration) {
        const targetW = this.targetBounds.xMax - this.targetBounds.xMin + 1;
        const targetH = this.targetBounds.yMax - this.targetBounds.yMin + 1;

        const plan = this.buildRingPlan(this.initialBoundsForCurrentShrink, targetW, targetH, duration);
        const elapsed = Math.max(0, currentTick - startTick);
        const nowBounds = plan.boundsAtElapsed(elapsed);

        // 向后找第一次变化
        for (let e = elapsed + 1; e <= duration; e++) {
          const b = plan.boundsAtElapsed(e);
          const changed =
            b.xMin !== nowBounds.xMin || b.xMax !== nowBounds.xMax ||
            b.yMin !== nowBounds.yMin || b.yMax !== nowBounds.yMax;
          if (changed) {
            return { startTick: startTick + e, targetBounds: b };
          }
        }
      }
      // 若当前收缩后面没有变化（极端离散化边界），继续找后续事件
    }

    // 情况B：不在收缩中，或当前事件没有进一步可见变化 —— 找未来的第一个收缩事件的第一次变化
    for (const phase of phasesOrdered) {
      const phaseCfg = GameConfig.SAFE_ZONE.PHASES[phase];
      if (phaseCfg.SAFE_ZONE_STATE !== "SHRINKING" || !phaseCfg.SHRINK_EVENTS) continue;

      for (const ev of phaseCfg.SHRINK_EVENTS) {
        const startTick = ev.START_TICK;
        const duration = ev.DURATION;
        const endTick = startTick + duration;

        if (currentTick < startTick) {
          const startBounds = this.calculateBoundsAtTick(startTick);
          const plan = this.buildRingPlan(startBounds, ev.TARGET_SIZE.WIDTH, ev.TARGET_SIZE.HEIGHT, duration);
          const first = plan.firstChangeTick(startTick);
          if (first) return { startTick: first.tick, targetBounds: first.bounds };
        }

        // 容错：如果 currentTick 落在某个事件内部，但 isShrinking=false（例如状态未对齐）
        if (currentTick >= startTick && currentTick < endTick) {
          const startBounds = this.calculateBoundsAtTick(startTick);
          const plan = this.buildRingPlan(startBounds, ev.TARGET_SIZE.WIDTH, ev.TARGET_SIZE.HEIGHT, duration);
          const elapsed = currentTick - startTick;
          const nowBounds = plan.boundsAtElapsed(elapsed);
          for (let e = elapsed + 1; e <= duration; e++) {
            const b = plan.boundsAtElapsed(e);
            const changed =
              b.xMin !== nowBounds.xMin || b.xMax !== nowBounds.xMax ||
              b.yMin !== nowBounds.yMin || b.yMax !== nowBounds.yMax;
            if (changed) {
              return { startTick: startTick + e, targetBounds: b };
            }
          }
          // 否则继续找下一个事件
        }
      }
    }

    return undefined;
  }

  private getFinalOfCurrentOrNextShrinkEvent(
    currentTick: number
  ): { startTick: number; targetBounds: SafeZoneBounds } | undefined {
    const phasesOrdered = [GamePhase.EARLY, GamePhase.MID, GamePhase.LATE];

    for (const phase of phasesOrdered) {
      const phaseCfg = GameConfig.SAFE_ZONE.PHASES[phase] as AnyPhaseConfig;
      if (!isShrinkingPhase(phaseCfg)) continue;

      for (const ev of phaseCfg.SHRINK_EVENTS) {
        const startTick = ev.START_TICK;
        const duration = ev.DURATION;
        const endTick = startTick + duration;

        // “当前/下一次事件”的判定：只要 currentTick 在该事件结束之前，都算当前或下一次
        if (currentTick < endTick) {
          // 该事件开始时的起始边界（前序事件已完成）
          const startBounds = this.calculateBoundsAtTick(startTick);

          // 目标边界与动画一致（圈式收缩）
          const plan = this.buildRingPlan(
            startBounds,
            ev.TARGET_SIZE.WIDTH,
            ev.TARGET_SIZE.HEIGHT,
            duration
          );

          return {
            // 要的就是“该事件完成时刻”
            startTick: endTick,
            // 以及“该事件最终到达的边界”
            targetBounds: { ...plan.targetBounds },
          };
        }
      }
    }
    // 没有后续事件
    return undefined;
  }

  /**
   * Gets the next shrink tick for a given current tick
   */
  private getNextShrinkTickForTick(currentTick: number): number | undefined {
    const nextEvent = this.getNextShrinkEvent(currentTick);
    return nextEvent ? nextEvent.startTick : undefined;
  }

  /**
   * Serialize safe zone state for recording
   */
  public serialize(currentTick?: number): SerializedSafeZone {
    const result: SerializedSafeZone = {
      enabled: this.enabled,
      currentBounds: { ...this.currentBounds },
      isWarning: this.isWarning,
      isShrinking: this.isShrinking,
      nextShrinkTick: currentTick !== undefined ? this.getNextShrinkTickForTick(currentTick) : undefined,
    };

    // 如果提供了当前tick，获取完整的算法信息用于录制
    if (currentTick !== undefined && this.enabled) {
      const algorithmInfo = this.getAlgorithmInfo(currentTick);

      if (algorithmInfo.nextShrinkEvent) {
        result.nextTargetBounds = { ...algorithmInfo.nextShrinkEvent.targetBounds };
      }

      if (algorithmInfo.finalShrinkEvent) {
        result.finalShrinkTick = algorithmInfo.finalShrinkEvent.startTick;
        result.finalTargetBounds = { ...algorithmInfo.finalShrinkEvent.targetBounds };
      }
    }

    return result;
  }

  /**
   * Calculates what the safe zone bounds would be at a specific tick
   * 应用所有“已经完成”的收缩事件（不模拟动画过程）
   */
  private calculateBoundsAtTick(targetTick: number): SafeZoneBounds {
    let bounds: SafeZoneBounds = {
      xMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MIN,
      xMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.X_MAX,
      yMin: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MIN,
      yMax: GameConfig.SAFE_ZONE.INITIAL_BOUNDS.Y_MAX,
    };

    const phases = [GamePhase.EARLY, GamePhase.MID, GamePhase.LATE];

    for (const phase of phases) {
      const phaseConfig = GameConfig.SAFE_ZONE.PHASES[phase] as AnyPhaseConfig;
      if (!isShrinkingPhase(phaseConfig)) continue;

      for (const shrinkEvent of phaseConfig.SHRINK_EVENTS) {
        const shrinkCompleteTick = shrinkEvent.START_TICK + shrinkEvent.DURATION;
        if (shrinkCompleteTick <= targetTick) {
          const currentWidth = bounds.xMax - bounds.xMin + 1;
          const currentHeight = bounds.yMax - bounds.yMin + 1;
          const targetWidth = shrinkEvent.TARGET_SIZE.WIDTH;
          const targetHeight = shrinkEvent.TARGET_SIZE.HEIGHT;

          const totalShrinkX = (currentWidth - targetWidth) / 2;
          const totalShrinkY = (currentHeight - targetHeight) / 2;

          bounds = {
            xMin: bounds.xMin + Math.floor(totalShrinkX),
            xMax: bounds.xMax - Math.ceil(totalShrinkX),
            yMin: bounds.yMin + Math.floor(totalShrinkY),
            yMax: bounds.yMax - Math.ceil(totalShrinkY),
          };
        }
      }
    }

    return bounds;
  }

  /**
   * Gets the current game phase based on tick
   */
  private getCurrentPhase(currentTick: number): GamePhase | null {
    if (currentTick >= GameConfig.SAFE_ZONE.PHASES[GamePhase.LATE].START_TICK) {
      return GamePhase.LATE;
    } else if (currentTick >= GameConfig.SAFE_ZONE.PHASES[GamePhase.MID].START_TICK) {
      return GamePhase.MID;
    } else if (currentTick >= GameConfig.SAFE_ZONE.PHASES[GamePhase.EARLY].START_TICK) {
      return GamePhase.EARLY;
    }
    return null;
  }

  /**
   * Disposes resources
   */
  public dispose(): void {
    // Currently no resources to dispose
  }
}
