import { Direction, GameConfig } from "../config/GameConfig";
import { GameState } from "../types/GameState";
import { Snake, SnakeDecisionStrategy } from "../entities/Snake";
import {
  formatGameStateForAPI,
  sandboxService,
  getDirectionFromValue,
} from "../services/sandboxService";
import { eventBus, GameEventType } from "../core/EventBus";
import { DecisionRequestCoordinator } from "../core/DecisionRequestCoordinator";
import { BatchExecutionItem } from "../types/Api";
import { GameClock } from "../core/GameClock";

// 1. 玩家控制策略 - 保持当前方向，直到有键盘输入
export class PlayerDecisionStrategy implements SnakeDecisionStrategy {
  private lastInputDirection: Direction | null = null;
  private shieldActivationRequested: boolean = false;

  /**
   * Records the player's intended direction for the next tick.
   * @param direction - The direction input by the player.
   */
  setInputDirection(direction: Direction): void {
    this.lastInputDirection = direction;
    this.shieldActivationRequested = false;
  }

  /**
   * Records the player's intent to activate the shield for the next tick.
   */
  setInputShield(requested: boolean): void {
    // Only store the shield request if true
    if (requested) {
      this.shieldActivationRequested = true;
      // Shield input should cancel a pending direction request for the same tick.
      this.lastInputDirection = null;
    }
  }

  /**
   * Applies the player's recorded input (shield or direction) to the snake.
   * This method is called by the game loop each tick for the player-controlled snake.
   */
  async makeDecision(snake: Snake, _gameState: GameState): Promise<void> {
    try {
      // Prioritize shield activation
      if (this.shieldActivationRequested) {
        console.debug(
          "PlayerDecisionStrategy: Activating shield based on input."
        );
        snake.activateShield(); // Call the snake's method to handle activation logic (cost, cooldown)
        this.shieldActivationRequested = false; // Reset the flag after consuming the input
        // Shield activation typically means the snake does not move in the same tick
        return; // Exit decision making for this tick
      }

      // If no shield requested, apply direction input
      if (this.lastInputDirection !== null) {
        console.debug(
          `PlayerDecisionStrategy: Setting direction to ${this.lastInputDirection} based on input.`
        );
        snake.setDirection(this.lastInputDirection);
        this.lastInputDirection = null; // Reset the flag after consuming the input
      }
      // If neither shield nor direction was input, the snake continues in its current direction (handled by snake.move())
    } catch (error) {
      console.error(`PlayerDecisionStrategy: Error making decision:`, error);
      // For player snakes, we might not want to kill them on error, but we'll follow the same pattern for consistency
      eventBus.emit(GameEventType.SNAKE_KILL_REQUEST, {
        snake,
        reason: "failed to make a decision",
      });
      throw error; // Re-throw to be caught by EntityManager
    }
  }

  // 清理资源
  cleanup(): void {
    this.lastInputDirection = null;
    this.shieldActivationRequested = false;
  }
}

// 2. AI控制策略 - 使用提供的AI算法
export class AIDecisionStrategy implements SnakeDecisionStrategy {
  private algorithm: (
    snake: Snake,
    gameState: GameState
  ) => void | Promise<void>;

  constructor(
    algorithm: (snake: Snake, gameState: GameState) => void | Promise<void>
  ) {
    this.algorithm = algorithm;
  }

  async makeDecision(snake: Snake, gameState: GameState): Promise<void> {
    try {
      await Promise.resolve(this.algorithm(snake, gameState));
    } catch (error) {
      console.error(
        `AIDecisionStrategy: Error executing algorithm for ${
          snake.getMetadata().name || "unnamed snake"
        }:`,
        error
      );
      // Emit event to kill the snake
      eventBus.emit(GameEventType.SNAKE_KILL_REQUEST, {
        snake,
        reason: "failed to make a decision",
      });
      throw error; // Re-throw to be caught by EntityManager
    }
  }

  // 清理资源
  cleanup(): void {
    // AI策略不需要特殊清理
  }
}

/**
 * Implements the SnakeDecisionStrategy using a remote API accessed via
 * a central DecisionRequestCoordinator that handles batching and SSE communication.
 */
export class APIDecisionStrategy implements SnakeDecisionStrategy {
  private userId: number;
  private username: string;
  private gameClock: GameClock;
  private coordinator: DecisionRequestCoordinator; // The coordinator instance
  private gameSessionId: string;

  /**
   * Creates an instance of APIDecisionStrategy.
   * @param userId - The primary user ID associated with this snake/player.
   * @param username - The display name for logging/UI.
   * @param clock - The GameClock instance.
   * @param coordinator - The shared DecisionRequestCoordinator instance.
   */
  constructor(
    userId: number,
    username: string,
    clock: GameClock,
    coordinator: DecisionRequestCoordinator,
    gameSessionId: string
  ) {
    this.userId = userId;
    this.username = username;
    this.gameClock = clock;
    if (!coordinator) {
      throw new Error("DecisionRequestCoordinator instance is required.");
    }
    this.coordinator = coordinator;
    this.gameSessionId = gameSessionId;
  }

  /**
   * Applies the parsed decision value (0-3 for direction, 4 for shield, null for error/no move) to the snake.
   */
  private applyDecision(snake: Snake, decision: number | null): void {
    if (decision === null) {
      console.warn(
        `Tick ${this.gameClock.getRemainingTicks()}: Applying null/invalid decision for ${
          this.username
        }. Snake continues straight.`
      );
      // snake.setDirection(snake.getDirection()); // Optionally maintain current direction
      return;
    }

    if (decision === 4) {
      // Activate shield
      snake.activateShield();
    } else {
      const direction = getDirectionFromValue(decision); // 0-3 map to Direction enum
      if (direction !== undefined && direction !== null) {
        snake.setDirection(direction);
      } else {
        // This case indicates an invalid number was passed (not 0-4)
        console.warn(
          `Tick ${this.gameClock.getRemainingTicks()}: Invalid direction value ${decision} applied for ${
            this.username
          }. Snake continues straight.`
        );
        // snake.setDirection(snake.getDirection());
      }
    }
  }

  /**
   * Asynchronously requests a decision for the snake's next action for the current game tick.
   * It prepares the request, sends it via the DecisionRequestCoordinator, and awaits the result.
   */
  async makeDecision(snake: Snake, gameState: GameState): Promise<void> {
    if (!snake.isAlive()) {
      this.cleanup(snake);
      return;
    }

    const currentTick = this.gameClock.getCurrentTick();
    const remainingTicks = this.gameClock.getRemainingTicks();
    const snakeMetadata = snake.getMetadata();
    // Use studentId from metadata if available, otherwise fallback to the userId passed in constructor
    const effectiveUserId = parseInt(
      snakeMetadata.studentId || this.userId.toString()
    );
    // Generate a unique identifier for this specific request instance within the tick/batch
    const clientRequestId = `${effectiveUserId}-${remainingTicks}`;

    console.debug(
      `Tick ${remainingTicks}: Requesting decision for ${this.username} (UserId: ${effectiveUserId}, ClientReqId: ${clientRequestId}) via Coordinator...`
    );

    try {
      // 1. Prepare input data using the provided utility function
      const gameStateStr = formatGameStateForAPI(
        remainingTicks,
        gameState.entities.foodItems,
        gameState.entities.obstacles,
        gameState.entities.snakes,
        gameState.vortexField,
        gameState.entities.treasureChests || [],
        gameState.entities.keys || [],
        gameState.safeZone
      );

      // 2. Create the execution request item
      const requestItem: BatchExecutionItem = {
        userId: effectiveUserId,
        inputData: gameStateStr,
        cpuTimeLimitSeconds: GameConfig.EXECUTION.CPU_TIME_LIMIT_SECONDS,
        memoryLimitKb: GameConfig.EXECUTION.MEMORY_LIMIT_KB,
        wallTimeLimitSeconds: GameConfig.EXECUTION.WALL_TIME_LIMIT_SECONDS,
        clientRequestId: clientRequestId,
        sessionId: this.gameSessionId,
        tickNumber: currentTick,
      };

      // 3. Request decision from coordinator and await the promise resolution/rejection
      const decisionData = await this.coordinator.requestDecision(requestItem);

      // 4. Process the received decision data
      console.debug(
        `Tick ${remainingTicks}: Received decision data for ${this.username} (ClientReqId: ${clientRequestId}):`,
        decisionData
      );
      snake.setMetadata({ input: gameStateStr, output: decisionData.output, workerNodeId: decisionData.workerNodeId, jobId: decisionData.jobId });
      if (decisionData.stderr) {
        snake.setMetadata({ stderr: decisionData.stderr });
      }
      if (decisionData.newMemoryData) {
        snake.setMetadata({ newMemoryData: decisionData.newMemoryData });
      }
      if (decisionData.success && decisionData.output) {
        const decisionValue = this.parseDecisionOutput(decisionData.output);
        this.applyDecision(snake, decisionValue); // Apply the valid decision
      } else {
        // Handle execution failure or invalid output
        console.warn(
          `Tick ${remainingTicks}: Execution failed or invalid output for ${this.username}. Status: ${decisionData.status}, Error: ${decisionData.error}`
        );

        // Kill the snake with a reason
        eventBus.emit(GameEventType.SNAKE_KILL_REQUEST, {
          snake,
          reason: "failed to make a decision",
        });
      }
    } catch (error: any) {
      // Handle promise rejection (e.g., coordinator error, SSE connection failed)
      console.error(
        `Tick ${remainingTicks}: Failed to get decision for ${this.username} (ClientReqId: ${clientRequestId}) via Coordinator:`,
        error
      );

      // Kill the snake with a reason
      eventBus.emit(GameEventType.SNAKE_KILL_REQUEST, {
        snake,
        reason: "failed to make a decision",
      });
    }
    // No 'finally' block needed for setting flags anymore
  }

  /** Parses the AI's string output into a decision value (0-4) or null */
  private parseDecisionOutput(output: string | null): number | null {
    if (!output) return null;
    const decision = output.trim().toUpperCase();
    switch (decision) {
      case "UP":
        return 0;
      case "DOWN":
        return 1;
      case "LEFT":
        return 2;
      case "RIGHT":
        return 3;
      case "SHIELD":
        return 4;
      default:
        const num = parseInt(decision, 10);
        if (!isNaN(num) && num >= 0 && num <= 4) return num; // Allow numerical input 0-4
        return null; // Invalid output format
    }
  }

  /** Optional cleanup logic */
  cleanup(snake?: Snake): void {
    const name = snake?.getMetadata()?.name || this.username;
    console.debug(`Cleaning up API strategy resources for ${name}`);
    // If coordinator needs explicit cancellation for pending promises associated with this snake,
    // logic would need to be added here (requires passing clientRequestId or similar).
  }
}
