import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Position } from "../types/Position";
import { GameConfig, Direction, FoodType } from "../config/GameConfig";
import { User } from "../types/User";
import {
  AIDecisionStrategy,
  APIDecisionStrategy,
  PlayerDecisionStrategy,
} from "../strategies/SnakeDecisionStrategies";
import { simpleAIAlgorithm, greedyAIAlgorithm } from "../ai/SnakeAI";
import { GameState } from "../types/GameState";
import { ParameterizedAIDecisionStrategy } from "../strategies/ChasingDecisionStrategy";
import { advancedAIAlgorithm } from "../ai/AdvancedSnakeAI";
import { chasingSnakeAI } from "../ai/ChasingSnakeAI";
import { DecisionRequestCoordinator } from "../core/DecisionRequestCoordinator";
import { GameClock } from "../core/GameClock";

/**
 * Factory class responsible for creating game entities.
 */
export class EntityFactory {
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly boxSize: number;
  private readonly playerStrategy: PlayerDecisionStrategy; // Re-use player strategy instance

  constructor() {
    this.boxSize = GameConfig.CANVAS.BOX_SIZE;
    this.centerX = Math.floor(GameConfig.CANVAS.COLUMNS / 2) * this.boxSize;
    this.centerY = Math.floor(GameConfig.CANVAS.ROWS / 2) * this.boxSize;
    this.playerStrategy = new PlayerDecisionStrategy(); // Create player strategy once
  }

  /**
   * Creates the initial set of snakes based on selected users or defaults.
   * @param selectedUsers - Optional array of users to create API-controlled snakes for.
   * @param getRemainingTicks - Function to get the current remaining ticks for API strategy.
   * @returns An array of Snake instances.
   */
  createInitialSnakes(
    selectedUsers: User[] | undefined,
    clock: GameClock,
    coordinator: DecisionRequestCoordinator,
    gameSessionId: string
  ): Snake[] {
    const snakes: Snake[] = [];
    const radius = 10 * this.boxSize; // Example radius

    // Predefined colors - expanded to support up to 20 snakes
    const snakeColors = [
      GameConfig.COLORS.PLAYER,
      "purple",
      "#FF8800",
      "#FF3366",
      "#33CCFF",
      "#FFCC00",
      "#66FF66",
      "#CC66FF",
      "#FF6600",
      "#00CCCC",
      "#9966FF",
      "#FFFF66",
      "#FF99CC",
      "#99CCFF",
      "#FF6633",
      "#00FF99",
      // Additional colors with good contrast
      "#FF5733", // Coral
      "#C70039", // Crimson
      "#900C3F", // Maroon
      "#581845", // Plum
      "#FFC300", // Amber
      "#DAF7A6", // Light Green
      "#FFC0CB", // Pink
      "#7D3C98", // Dark Purple
    ];

    if (selectedUsers && selectedUsers.length > 0) {
      // Create snakes for selected users
      const angleStep = 360 / selectedUsers.length;
      selectedUsers.forEach((user, index) => {
        const angle = index * angleStep;
        const colorIndex = index % snakeColors.length;
        snakes.push(
          this.createApiControlledSnake(
            radius,
            angle,
            snakeColors[colorIndex],
            clock,
            coordinator,
            gameSessionId,
            user,
          )
        );
      });
    } else {
      // Create default snake lineup (example: 1 API, 1 Advanced, 1 Chaser pair, rest simple/greedy)
      const totalSnakeCount = 20; // Support up to 20 snakes
      // We've already defined enough colors, but just in case we need more
      while (snakeColors.length < totalSnakeCount) {
        // Generate a random color with good brightness and saturation
        const h = Math.floor(Math.random() * 360); // Hue (0-360)
        const s = Math.floor(Math.random() * 30) + 70; // Saturation (70-100%)
        const l = Math.floor(Math.random() * 30) + 40; // Lightness (40-70%)
        snakeColors.push(`hsl(${h}, ${s}%, ${l}%)`);
      }

      // 1. Advanced AI
      if (snakes.length < totalSnakeCount) {
        snakes.push(this.createAdvancedAISnake(radius, 60, snakeColors[1]));
      }

      // 2. Chaser Pair (Example)
      if (snakes.length + 1 < totalSnakeCount) {
        const [chaser, target] = this.createBalancedChasingSnakes(
          radius,
          120,
          snakeColors[2],
          snakeColors[3]
        );
        snakes.push(chaser, target);
      }

      // 3. Fill remaining with Simple/Greedy AI
      const aiAlgorithms = [simpleAIAlgorithm, greedyAIAlgorithm];
      const usedAngles = snakes
        .map((_, i) => [0, 60, 120, 180][i] ?? -1)
        .filter((a) => a >= 0); // Rough angles used
      let currentAngle = 210; // Start filling from another angle
      const angleIncrement = 30;

      while (snakes.length < totalSnakeCount) {
        // Basic angle avoidance
        while (usedAngles.some((ua) => Math.abs(ua - currentAngle) < 15)) {
          currentAngle = (currentAngle + angleIncrement) % 360;
        }
        usedAngles.push(currentAngle);

        const colorIndex = snakes.length % snakeColors.length;
        const algorithm = aiAlgorithms[snakes.length % aiAlgorithms.length];
        snakes.push(
          this.createAiControlledSnake(
            radius,
            currentAngle,
            snakeColors[colorIndex],
            algorithm
          )
        );
        currentAngle = (currentAngle + angleIncrement) % 360;
      }
    }
    return snakes;
  }

  /**
   * Creates an API-controlled snake.
   */
  createApiControlledSnake(
    radius: number,
    angle: number,
    color: string,
    clock: GameClock,
    coordinator: DecisionRequestCoordinator,
    gameSessionId: string,
    userData?: User,
  ): Snake {
    const { x, y } = this.calculatePosition(radius, angle);
    const direction = this.getInitialDirection(x, y);
    const snakeUserId = userData?.userId ?? 12345; // Default ID if no user
    const snakeUsername = userData?.username ?? "default_user";
    const snakeNickname = userData?.nickname ?? "API Snake";

    const apiStrategy = new APIDecisionStrategy(
      snakeUserId,
      snakeUsername,
      clock,
      coordinator,
      gameSessionId
    );

    return new Snake({ x, y }, this.boxSize, color, direction, apiStrategy, {
      name: snakeNickname,
      userId: snakeUserId,
      username: snakeUsername,
    });
  }

  /**
   * Creates a player-controlled snake (using keyboard/mouse).
   * Note: In the original code, the API snake often doubles as the player.
   * This method is included for clarity if a distinct player type is needed.
   */
  createPlayerControlledSnake(
    radius: number,
    angle: number,
    color: string
  ): Snake {
    const { x, y } = this.calculatePosition(radius, angle);
    const direction = this.getInitialDirection(x, y);
    // Use the shared playerStrategy instance
    return new Snake(
      { x, y },
      this.boxSize,
      color,
      direction,
      this.playerStrategy,
      { name: "Player Snake" }
    );
  }

  // Expose the player strategy for InputHandler
  getPlayerStrategy(): PlayerDecisionStrategy {
    return this.playerStrategy;
  }

  /**
   * Creates a snake controlled by a standard AI algorithm.
   */
  createAiControlledSnake(
    radius: number,
    angle: number,
    color: string,
    aiAlgorithm: (snake: Snake, gameState: GameState) => void
  ): Snake {
    const { x, y } = this.calculatePosition(radius, angle);
    const direction = this.getInitialDirection(x, y);
    const aiStrategy = new AIDecisionStrategy(aiAlgorithm);
    const name = `AI Snake`;

    return new Snake(
      { x, y },
      this.boxSize,
      color,
      direction,
      aiStrategy,
      { name: name, studentId: `AI_${name.split(" ")[2]}` } // Simple ID
    );
  }

  /**
   * Creates an advanced AI snake.
   */
  createAdvancedAISnake(radius: number, angle: number, color: string): Snake {
    const { x, y } = this.calculatePosition(radius, angle);
    const direction = this.getInitialDirection(x, y);
    const aiStrategy = new AIDecisionStrategy(advancedAIAlgorithm);
    return new Snake({ x, y }, this.boxSize, color, direction, aiStrategy, {
      name: "Advanced AI",
      studentId: "SmartAI",
    });
  }

  /**
   * Creates a chasing snake for testing/demonstration.
   */
  createChasingSnake(
    x: number,
    y: number,
    color: string,
    id: string,
    targetId: string
  ): Snake {
    const chasingStrategy = new ParameterizedAIDecisionStrategy(
      chasingSnakeAI,
      targetId
    );
    const direction = this.getInitialDirection(x, y);
    return new Snake(
      { x, y },
      this.boxSize,
      color,
      direction,
      chasingStrategy,
      { name: `${id} Snake`, studentId: id, targetId: targetId }
    );
  }

  /**
   * Creates a pair of balanced chasing snakes.
   */
  createBalancedChasingSnakes(
    radius: number,
    baseAngle: number,
    chaserColor: string,
    targetColor: string
  ): [Snake, Snake] {
    const chaserPos = this.calculatePosition(radius, baseAngle);
    const targetPos = this.calculatePosition(radius, (baseAngle + 180) % 360);

    const chaser = this.createChasingSnake(
      chaserPos.x,
      chaserPos.y,
      chaserColor,
      "Chaser",
      "Target"
    );
    const target = this.createChasingSnake(
      targetPos.x,
      targetPos.y,
      targetColor,
      "Target",
      "Chaser"
    );
    return [chaser, target];
  }

  /**
   * Generates a circular wall obstacle layout.
   * @param radius - The radius of the wall in grid units.
   * @returns An array of Obstacle instances.
   */
  createCircularWall(radius: number): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const centerX = Math.floor(GameConfig.CANVAS.COLUMNS / 2);
    const centerY = Math.floor(GameConfig.CANVAS.ROWS / 2);

    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const distance = Math.sqrt(x * x + y * y);
        // Create wall segments on the circle's edge, excluding axes for passages
        if (
          distance <= radius &&
          distance > radius - 1 &&
          !(y === 0 || x === 0)
        ) {
          const gridX = centerX + x;
          const gridY = centerY + y;
          if (
            gridX >= 0 &&
            gridX < GameConfig.CANVAS.COLUMNS &&
            gridY >= 0 &&
            gridY < GameConfig.CANVAS.ROWS
          ) {
            obstacles.push(
              new Obstacle(
                { x: gridX * this.boxSize, y: gridY * this.boxSize },
                this.boxSize
              )
            );
          }
        }
      }
    }
    return obstacles;
  }

  /**
   * Creates a single food item.
   */
  createFood(
    position: Position,
    type: FoodType,
    value: number | string,
    color: string,
    ttl?: number,
    natural: boolean = true
  ): Food {
    const defaultTtl = GameConfig.FOOD_ADV.LIFECYCLE[type] ?? 60;
    const finalTtl = ttl ?? defaultTtl;
    return new Food(
      position,
      this.boxSize,
      value,
      color,
      type,
      natural,
      finalTtl
    );
  }

  /**
   * Creates food items from a dead snake's body.
   * @param body - The body segments of the dead snake.
   * @param score - The score of the dead snake.
   * @returns An array of Food instances.
   */
  createDeathFood(body: Position[], score: number): Food[] {
    const deathFoods: Food[] = [];
    let remainingScore = score;
    let i = 0;

    while (remainingScore > 0 && i < body.length) {
      const foodValue = Math.min(remainingScore, 20); // Max 20 points per food item
      const position = body[i];

      // Check if position is valid (not inside an obstacle or wall) - simplified check
      if (
        position.x >= 0 &&
        position.x < GameConfig.CANVAS.COLUMNS * this.boxSize &&
        position.y >= 0 &&
        position.y < GameConfig.CANVAS.ROWS * this.boxSize
      ) {
        deathFoods.push(
          new Food(
            position,
            this.boxSize,
            foodValue,
            GameConfig.COLORS.DEATH,
            FoodType.NORMAL,
            false // Indicate it's from death, maybe different handling
          )
        );
      }
      remainingScore -= foodValue;
      i++;
    }
    return deathFoods;
  }

  private calculatePosition(radius: number, angle: number): Position {
    const radians = (angle * Math.PI) / 180;
    const x =
      Math.round((this.centerX + radius * Math.cos(radians)) / this.boxSize) *
      this.boxSize;
    const y =
      Math.round((this.centerY + radius * Math.sin(radians)) / this.boxSize) *
      this.boxSize;
    // Clamp position to be within bounds (optional, depends on desired start behavior)
    const clampedX = Math.max(
      0,
      Math.min(x, (GameConfig.CANVAS.COLUMNS - 1) * this.boxSize)
    );
    const clampedY = Math.max(
      0,
      Math.min(y, (GameConfig.CANVAS.ROWS - 1) * this.boxSize)
    );
    return { x: clampedX, y: clampedY };
  }

  private getInitialDirection(x: number, y: number): Direction {
    const dx = this.centerX - x;
    const dy = this.centerY - y;
    const angle = Math.atan2(dy, dx);
    const degrees = ((angle * 180) / Math.PI + 360) % 360;

    if (degrees >= 315 || degrees < 45) return Direction.RIGHT;
    if (degrees >= 45 && degrees < 135) return Direction.DOWN;
    if (degrees >= 135 && degrees < 225) return Direction.LEFT;
    return Direction.UP;
  }

  public getFoodColor(type: FoodType, value: number): string {
    try {
      switch (type) {
        case FoodType.NORMAL:
          const valueKey = String(
            value
          ) as keyof typeof GameConfig.COLORS.FOOD_NORMAL;
          return (
            GameConfig.COLORS.FOOD_NORMAL[valueKey] ||
            GameConfig.COLORS.FOOD_NORMAL["1"]
          );
        case FoodType.GROWTH:
          return GameConfig.COLORS.FOOD_GROWTH;
        case FoodType.TRAP:
          return GameConfig.COLORS.FOOD_TRAP;
        default:
          return GameConfig.COLORS.FOOD_NORMAL["1"];
      }
    } catch (e) {
      return "#FFFFFF";
    }
  }

  public getFoodTTL(type: FoodType): number {
    const lifecycleMap = GameConfig.FOOD_ADV.LIFECYCLE as Record<
      FoodType,
      number | undefined
    >;
    return lifecycleMap[type] ?? 60;
  }
}
