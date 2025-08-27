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

    this.initialBoundsForCurrentShrink = { ...this.currentBounds };

    const plan = this.buildRingPlan(
      this.initialBoundsForCurrentShrink,
      shrinkEvent.TARGET_SIZE.WIDTH,
      shrinkEvent.TARGET_SIZE.HEIGHT,
      this.shrinkDuration ?? 0
    );

    // 目标边界
    this.targetBounds = { ...plan.targetBounds };

    // 记录统一调度所需的参数（复用你现有字段名以减少改动）
    this.phase1ShrinkAxis = plan.phase1ShrinkAxis; // 仅用于日志
    this.phase1ShrinkAmount = plan.phase1Steps;    // 仅用于日志
    this.phase2ShrinkAmount = plan.phase2Steps;    // 仅用于日志
    this.phase1Duration = plan.phase1Duration;     // 仅用于日志
    this.phase2Duration = plan.phase2Duration;     // 仅用于日志

    // 额外记录：统一调度步数（update 时要用）
    // @ts-ignore: attach transient fields
    (this as any)._unifiedStepsX = plan.stepsX;
    // @ts-ignore
    (this as any)._unifiedStepsY = plan.stepsY;
    // @ts-ignore
    (this as any)._unifiedTotalSteps = plan.totalSteps;

    console.log(`[SafeZone] Shrink planned: totalSteps=${plan.totalSteps}, duration=${this.shrinkDuration}`);
    console.log(`[SafeZone] Phase1(axis=${this.phase1ShrinkAxis}): steps=${this.phase1ShrinkAmount}, ticks≈${this.phase1Duration}`);
    console.log(`[SafeZone] Phase2(both): steps=${this.phase2ShrinkAmount}, ticks≈${this.phase2Duration}`);
    console.log(`[SafeZone] Target bounds: (${this.targetBounds.xMin},${this.targetBounds.yMin})→(${this.targetBounds.xMax},${this.targetBounds.yMax})`);

    eventBus.emit(GameEventType.UI_NOTIFICATION, "Safe zone is shrinking!");
  }

  /**
   * Updates ring-based shrinking animation
   */
  private updateShrinking(currentTick: number): void {
    if (!this.shrinkStartTick || !this.shrinkDuration || !this.targetBounds || !this.initialBoundsForCurrentShrink) return;

    // 统一调度参数
    const stepsX: number = (this as any)._unifiedStepsX ?? 0;
    const stepsY: number = (this as any)._unifiedStepsY ?? 0;
    const totalSteps: number = (this as any)._unifiedTotalSteps ?? Math.max(stepsX, stepsY);

    const startTick = this.shrinkStartTick;
    const duration = this.shrinkDuration;
    const elapsed = currentTick - startTick;

    // 结束帧：必达目标
    if (elapsed >= duration) {
      const prev = { ...this.currentBounds };
      this.currentBounds = { ...this.targetBounds };
      
      // 强制触发一次清理事件，确保收缩完成时清理所有安全区外的食物
      eventBus.emit(GameEventType.SAFE_ZONE_SHRINK_START, {
        previousBounds: prev,
        currentBounds: this.currentBounds
      });
      
      this.isShrinking = false;
      this.shrinkStartTick = undefined;
      this.shrinkDuration = undefined;
      this.targetBounds = undefined;
      this.initialBoundsForCurrentShrink = undefined;

      // 清理临时统一调度参数
      delete (this as any)._unifiedStepsX;
      delete (this as any)._unifiedStepsY;
      delete (this as any)._unifiedTotalSteps;

      // 兼容字段
      this.phase1Duration = undefined;
      this.phase2Duration = undefined;
      this.phase1ShrinkAxis = undefined;
      this.phase1ShrinkAmount = undefined;
      this.phase2ShrinkAmount = undefined;

      console.log(`[SafeZone] Ring shrinking complete. New bounds: (${this.currentBounds.xMin},${this.currentBounds.yMin}) to (${this.currentBounds.xMax},${this.currentBounds.yMax})`);
      return;
    }

    const s = SafeZoneManager.stepsCompleted(elapsed, duration, totalSteps);
    const { sx, sy } = SafeZoneManager.shrinkXYFromSteps(stepsX, stepsY, s);

    const prev = { ...this.currentBounds };
    this.currentBounds = {
      xMin: this.initialBoundsForCurrentShrink.xMin + sx,
      xMax: this.initialBoundsForCurrentShrink.xMax - sx,
      yMin: this.initialBoundsForCurrentShrink.yMin + sy,
      yMax: this.initialBoundsForCurrentShrink.yMax - sy,
    };

    if (
      prev.xMin !== this.currentBounds.xMin ||
      prev.xMax !== this.currentBounds.xMax ||
      prev.yMin !== this.currentBounds.yMin ||
      prev.yMax !== this.currentBounds.yMax
    ) {
      eventBus.emit(GameEventType.SAFE_ZONE_SHRINK_START, {
        previousBounds: prev,
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
    const curW = initialBounds.xMax - initialBounds.xMin + 1;
    const curH = initialBounds.yMax - initialBounds.yMin + 1;

    // 用你原本的 floor/ceil 规则得到**最终目标边界**（与旧逻辑保持一致）
    const shrinkXHalf = (curW - targetWidth) / 2;
    const shrinkYHalf = (curH - targetHeight) / 2;

    const targetBounds: SafeZoneBounds = {
      xMin: initialBounds.xMin + Math.floor(shrinkXHalf),
      xMax: initialBounds.xMax - Math.ceil(shrinkXHalf),
      yMin: initialBounds.yMin + Math.floor(shrinkYHalf),
      yMax: initialBounds.yMax - Math.ceil(shrinkYHalf),
    };

    // 将目标边界换算为**每边的整数步数**
    const stepsX = targetBounds.xMin - initialBounds.xMin; // >= 0
    const stepsY = targetBounds.yMin - initialBounds.yMin; // >= 0
    const totalSteps = Math.max(stepsX, stepsY);           // 统一调度步数

    const boundsAtElapsed = (elapsed: number): SafeZoneBounds => {
      if (elapsed <= 0) return { ...initialBounds };
      if (elapsed >= duration) return { ...targetBounds };

      const s = SafeZoneManager.stepsCompleted(elapsed, duration, totalSteps);
      const { sx, sy } = SafeZoneManager.shrinkXYFromSteps(stepsX, stepsY, s);

      return {
        xMin: initialBounds.xMin + sx,
        xMax: initialBounds.xMax - sx,
        yMin: initialBounds.yMin + sy,
        yMax: initialBounds.yMax - sy,
      };
    };

    const firstChangeTick = (startTick: number): { tick: number; bounds: SafeZoneBounds } | undefined => {
      if (duration <= 0 || totalSteps <= 0) return undefined;
      // 找到最早使 stepsCompleted(e) > 0 的 e
      for (let e = 1; e <= duration; e++) {
        const s = SafeZoneManager.stepsCompleted(e, duration, totalSteps);
        if (s > 0) {
          return { tick: startTick + e, bounds: boundsAtElapsed(e) };
        }
      }
      // 理论兜底（不应触达）
      return { tick: startTick + duration, bounds: { ...targetBounds } };
    };

    // 为了兼容你现有的字段命名（phase1/phase2），我们输出等价信息，但**不再需要**相位时长
    // phase1Steps = |stepsX - stepsY|（领先轴单轴阶段），phase2Steps = min(stepsX, stepsY)（双轴阶段）
    const phase1Steps = Math.abs(stepsX - stepsY);
    const phase2Steps = Math.min(stepsX, stepsY);
    const phase1ShrinkAxis: 'x' | 'y' | 'none' =
      stepsX > stepsY ? 'x' : stepsY > stepsX ? 'y' : 'none';

    // 时长已用统一调度，不再必须；给出仅供日志/兼容参考（按比例切分，保证相加 = duration）
    let phase1Duration = 0, phase2Duration = duration;
    if (totalSteps > 0 && duration > 0) {
      phase1Duration = Math.floor((phase1Steps / totalSteps) * duration);
      phase2Duration = Math.max(duration - phase1Duration, 0);
    }

    return {
      targetBounds,
      // 兼容输出（非必须使用）
      phase1ShrinkAxis,
      phase1Steps,
      phase2Steps,
      phase1Duration,
      phase2Duration,
      // 统一调度的关键输出
      stepsX,
      stepsY,
      totalSteps,
      boundsAtElapsed,
      firstChangeTick,
    };
  }

  /**
   * Checks for warning states before and during shrinking
   */
  private checkForWarnings(currentTick: number): void {
    // 如果当前正在收缩，直接显示警告
    if (this.isShrinking) {
      this.isWarning = true;
      return;
    }

    // 检查是否即将开始收缩
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

  /** 完成的总步数（0..totalSteps），elapsed∈[0..duration]，END_TICK 必达 */
  private static stepsCompleted(elapsed: number, duration: number, totalSteps: number): number {
    if (duration <= 0 || totalSteps <= 0) return 0;
    if (elapsed <= 0) return 0;
    if (elapsed >= duration) return totalSteps;
    return Math.floor((elapsed * totalSteps) / duration);
  }

  /** 由总完成步数 s 映射到每轴的收缩步数 (shrinkX, shrinkY)，采用领先轴优先、随后双轴同步 */
  private static shrinkXYFromSteps(stepsX: number, stepsY: number, s: number): { sx: number; sy: number } {
    const leadX = stepsX >= stepsY;            // 领先轴：步数更多的轴
    const lead = Math.max(stepsX, stepsY);
    const lag = Math.min(stepsX, stepsY);

    const sLead = Math.min(s, lead);           // 领先轴累计步数
    const sLag = Math.max(0, Math.min(lag, s - (lead - lag))); // 落后轴累计步数（只有在双轴阶段才增长）

    if (leadX) return { sx: sLead, sy: sLag };
    return { sx: sLag, sy: sLead };
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
