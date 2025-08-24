import { GameConfig, GamePhase } from "../config/GameConfig";
import { Position } from "../types/Position";
import { eventBus, GameEventType } from "../core/EventBus";

/**
 * Safe zone boundary definition
 */
export interface SafeZoneBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
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
  private shrinkAmountX?: number;
  private shrinkAmountY?: number;

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
  public getStatus(): SafeZoneStatus {
    return {
      enabled: this.enabled,
      currentBounds: { ...this.currentBounds },
      isWarning: this.isWarning,
      isShrinking: this.isShrinking,
      nextShrinkTick: this.getNextShrinkTick(),
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

    const phaseConfig = GameConfig.SAFE_ZONE.PHASES[currentPhase];
    if (phaseConfig.SAFE_ZONE_STATE !== "SHRINKING" || !phaseConfig.SHRINK_EVENTS) {
      return;
    }

    // Check each shrink event
    for (const shrinkEvent of phaseConfig.SHRINK_EVENTS) {
      if (currentTick === shrinkEvent.START_TICK && !this.isShrinking) {
        this.startShrinking(shrinkEvent, currentTick);
        break;
      }
    }
  }

  /**
   * Starts a shrinking event
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

    // Calculate how much to shrink on each side
    const totalShrinkX = currentWidth - targetWidth;
    const totalShrinkY = currentHeight - targetHeight;

    // Ensure RELATIVE symmetry: left=right, top=bottom
    // Split evenly, but handle odd numbers by giving extra to one side consistently

    // For X-axis (left-right symmetry)
    const shrinkLeft = Math.floor(totalShrinkX / 2);
    const shrinkRight = totalShrinkX - shrinkLeft; // This ensures left + right = totalShrinkX exactly

    // For Y-axis (top-bottom symmetry)  
    const shrinkTop = Math.floor(totalShrinkY / 2);
    const shrinkBottom = totalShrinkY - shrinkTop; // This ensures top + bottom = totalShrinkY exactly

    const shrinkXPerSide = totalShrinkX / 2;
    const shrinkYPerSide = totalShrinkY / 2;

    // Apply shrinking with relative symmetry
    this.targetBounds = {
      xMin: this.currentBounds.xMin + shrinkLeft,
      xMax: this.currentBounds.xMax - shrinkRight,
      yMin: this.currentBounds.yMin + shrinkTop,
      yMax: this.currentBounds.yMax - shrinkBottom,
    };

    this.shrinkAmountX = shrinkXPerSide;
    this.shrinkAmountY = shrinkYPerSide;

    // Verify the result has the expected size
    const actualWidth = this.targetBounds.xMax - this.targetBounds.xMin + 1;
    const actualHeight = this.targetBounds.yMax - this.targetBounds.yMin + 1;

    console.log(`[SafeZone] Started shrinking from ${currentWidth}x${currentHeight} to ${targetWidth}x${targetHeight} (actual: ${actualWidth}x${actualHeight})`);
    console.log(`[SafeZone] Perfect ring shrinking: L=${shrinkLeft}, R=${shrinkRight}, T=${shrinkTop}, B=${shrinkBottom}`);
    console.log(`[SafeZone] Target bounds: (${this.targetBounds.xMin},${this.targetBounds.yMin}) to (${this.targetBounds.xMax},${this.targetBounds.yMax})`);

    // Emit event for UI notification
    eventBus.emit(GameEventType.UI_NOTIFICATION, "Safe zone is shrinking!");
  }

  /**
   * Updates shrinking animation
   */
  private updateShrinking(currentTick: number): void {
    if (!this.shrinkStartTick || !this.shrinkDuration || !this.targetBounds || !this.initialBoundsForCurrentShrink || this.shrinkAmountX === undefined || this.shrinkAmountY === undefined) return;

    const elapsed = currentTick - this.shrinkStartTick;
    const progress = Math.min(elapsed / this.shrinkDuration, 1.0);

    if (progress >= 1.0) {
      // Shrinking complete
      this.currentBounds = { ...this.targetBounds };
      this.isShrinking = false;
      this.shrinkStartTick = undefined;
      this.shrinkDuration = undefined;
      this.targetBounds = undefined;
      this.initialBoundsForCurrentShrink = undefined;
      console.log(`[SafeZone] Shrinking complete. New bounds: (${this.currentBounds.xMin},${this.currentBounds.yMin}) to (${this.currentBounds.xMax},${this.currentBounds.yMax})`);
    } else {
      // Interpolate bounds from initial bounds of this shrink to target bounds
      // 1. 根据进度计算当前应该收缩多少（可以是小数）
      const currentShrinkX = this.shrinkAmountX * progress;
      const currentShrinkY = this.shrinkAmountY * progress;

      // 2. 将要收缩的量取整。用 round 更平滑，也可以用 floor。
      // 这确保了在任何一帧，左右两边增加/减少的整数格数完全一样。
      const integerShrinkX = Math.round(currentShrinkX);
      const integerShrinkY = Math.round(currentShrinkY);

      // 3. 将整数收缩量应用到【本次收缩的初始边界】上，而不是上一帧的边界
      this.currentBounds = {
        xMin: this.initialBoundsForCurrentShrink.xMin + integerShrinkX,
        xMax: this.initialBoundsForCurrentShrink.xMax - integerShrinkX,
        yMin: this.initialBoundsForCurrentShrink.yMin + integerShrinkY,
        yMax: this.initialBoundsForCurrentShrink.yMax - integerShrinkY,
      };
    }
  }


  /**
   * Checks for warning states before shrinking
   */
  private checkForWarnings(currentTick: number): void {
    const nextShrinkTick = this.getNextShrinkTick();

    if (nextShrinkTick) {
      const ticksUntilShrink = nextShrinkTick - currentTick;
      this.isWarning = ticksUntilShrink <= GameConfig.SAFE_ZONE.WARNING_TICKS_BEFORE_SHRINK && ticksUntilShrink > 0;
    } else {
      this.isWarning = false;
    }
  }

  /**
   * Gets the next shrink tick
   */
  private getNextShrinkTick(): number | undefined {
    const currentPhase = this.getCurrentPhase(Date.now()); // This needs the current tick, not Date.now()
    // For now, return undefined - this would need proper tick tracking
    return undefined;
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