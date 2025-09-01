import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Position } from "../types/Position";
import { GameConfig, Direction, FoodType } from "../config/GameConfig";
import { Player } from "../types/User";
import {
  AIDecisionStrategy,
  APIDecisionStrategy,
  PlayerDecisionStrategy,
} from "../strategies/SnakeDecisionStrategies";
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
    selectedUsers: Player[] | undefined,
    clock: GameClock,
    coordinator: DecisionRequestCoordinator,
    gameSessionId: string
  ): Snake[] {
    const snakes: Snake[] = [];
    const radius = 10 * this.boxSize; // Example radius

    // Predefined high-contrast palette: 24+ distinct colors
    // First color is reserved for the primary/player snake
    const snakeColors = [
      GameConfig.COLORS.PLAYER,
      "#e6194B",
      "#3cb44b",
      "#4363d8",
      "#f58231",
      "#911eb4",
      "#46f0f0",
      "#f032e6",
      "#bcf60c",
      "#fabebe",
      "#008080",
      "#e6beff",
      "#9A6324",
      "#fffac8",
      "#800000",
      "#aaffc3",
      "#808000",
      "#ffd8b1",
      "#000075",
      "#808080",
      "#ffe119",
      "#469990",
      "#dcbeff",
      "#a9a9a9",
      "#66c2a5",
      "#ff7f00",
      "#6a3d9a",
      "#b15928",
      "#17becf",
      "#8da0cb",
    ];

    if (!selectedUsers || selectedUsers.length === 0) {
      throw new Error("No users selected");
    }

    // Create snakes for selected users
    const angleStep = 360 / selectedUsers.length;
    selectedUsers.forEach((user, index) => {
      const angle = index * angleStep;
      const colorIndex = index % snakeColors.length;
      const snake = this.createApiControlledSnake(
        radius,
        angle,
        snakeColors[colorIndex],
        clock,
        coordinator,
        gameSessionId,
        user
      );
      // 为本局分配从1开始的编号，存入元数据
      snake.setMetadata({ matchNumber: index + 1 });
      snakes.push(snake);
    });

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
    userData?: Player
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
