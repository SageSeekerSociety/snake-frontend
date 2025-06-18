import { GameConfig } from "../config/GameConfig";
import { eventBus, GameEventType } from "./EventBus";

/**
 * Manages the game's timing, tick progression, and main loop execution.
 */
export class GameClock {
  private totalTicks: number;
  private remainingTicks: number;
  private moveInterval: number;
  private isRunning: boolean = false;
  private timeoutId: number | null = null;
  private updateCallback: (() => Promise<void>) | null = null; // Async update function

  constructor(totalTicks: number = GameConfig.TOTAL_TICKS) {
    this.totalTicks = totalTicks;
    this.remainingTicks = totalTicks;
    this.moveInterval = GameConfig.SNAKE.MOVE_INTERVAL;
  }

  /**
   * Starts the game clock and the update loop.
   * @param updateCallback - The asynchronous function to call each tick.
   */
  start(updateCallback: () => Promise<void>): void {
    if (this.isRunning) return;
    console.log("GameClock starting...");
    this.isRunning = true;
    this.updateCallback = updateCallback;
    this.remainingTicks = this.totalTicks; // Reset ticks on start
    eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.remainingTicks);
    this.scheduleNextTick();
  }

  /**
   * Stops the game clock and cancels the next scheduled tick.
   */
  stop(): void {
    if (!this.isRunning) return;
    console.log("GameClock stopping...");
    this.isRunning = false;

    // Clear timer
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Reset callback and state
    this.updateCallback = null;
    this.remainingTicks = this.totalTicks; // Reset remaining ticks
  }

  /**
   * Schedules the execution of the next game tick.
   */
  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    // Clear previous timeout just in case
    if (this.timeoutId !== null) {
       clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(async () => {
        await this.executeTick();
        if (this.isRunning && this.remainingTicks > 0) {
            // Schedule the *next* tick after this one completes
            // (setTimeout is implicitly cleared when a new one is set)
            // Note: The delay calculation is now handled *after* execution
            // this.scheduleNextTick(); // This call is removed, delay calculated in executeTick
        } else if (this.remainingTicks <= 0) {
            this.stop(); // Stop clock if ticks run out
            eventBus.emit(GameEventType.GAME_OVER); // Signal game over due to ticks
        }
    }, 0); // Schedule immediately, delay is calculated inside executeTick
  }

  /**
   * Executes a single game tick.
   */
  private async executeTick(): Promise<void> {
      if (!this.isRunning || !this.updateCallback) return;

      const tickStartTime = performance.now();
      console.log(`GameClock executing Tick: ${this.totalTicks - this.remainingTicks + 1} (${this.remainingTicks} remaining)`);

      try {
          // Execute the main game logic for this tick
          await this.updateCallback();

          // Decrement ticks only after successful execution
          this.remainingTicks--;
          eventBus.emit(GameEventType.UI_UPDATE_TIMER, this.remainingTicks);

      } catch (error) {
          console.error('Error during game tick execution:', error);
          // Decide how to handle errors: stop the clock? try to continue?
          this.stop(); // Stop on error for safety
          eventBus.emit(GameEventType.GAME_OVER); // Signal game over due to error
          return; // Prevent scheduling next tick
      }

      // Calculate time taken and delay for the next tick
      const tickEndTime = performance.now();
      const elapsedTime = tickEndTime - tickStartTime;
      const delay = Math.max(0, this.moveInterval - elapsedTime);

      console.debug(`Tick ${this.totalTicks - this.remainingTicks} processed in ${elapsedTime.toFixed(2)}ms. Next tick in ${delay.toFixed(2)}ms.`);

      // Schedule the next tick if the game is still running
      if (this.isRunning && this.remainingTicks > 0) {
          this.timeoutId = window.setTimeout(async () => {
              await this.executeTick();
          }, delay);
      } else if (this.remainingTicks <= 0) {
          this.stop(); // Stop clock if ticks run out after this tick
          eventBus.emit(GameEventType.GAME_OVER);
      }
  }

  getRemainingTicks(): number {
    return this.remainingTicks;
  }

  getCurrentTick(): number {
    return this.totalTicks - this.remainingTicks;
  }

  getTotalTicks(): number {
      return this.totalTicks;
  }
}
