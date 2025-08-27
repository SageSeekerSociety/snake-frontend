import { Snake, DeathData } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { GridItem, SpatialHashGrid } from "../core/SpatialHashGrid";
import { Position } from "../types/Position";
import { EntityState, GameState } from "../types/GameState";
import { eventBus, GameEventType } from "../core/EventBus";
import { EntityFactory } from "../factories/EntityFactory"; // Import EntityFactory
import { FoodType, GameConfig } from "../config/GameConfig";
import { IEntityQuery, IScoreMultiplierProvider } from "../interfaces/EntityQuery";
import { SafeZoneBounds } from "../types/GameState";
import { createSnakePlaceholder, getSnakeDisplayName } from "../utils/snakeDisplayUtils";

type EntityMapKey = Snake | Food | Obstacle | TreasureChest | Key | Position; // Position used for snake segments

/**
 * Manages all game entities (Snakes, Food, Obstacles)
 * and their representation in the SpatialHashGrid.
 */
export class EntityManager implements IEntityQuery {
  private snakes: Snake[] = [];
  private foodItems: Food[] = [];
  private obstacles: Obstacle[] = [];
  private treasureChests: TreasureChest[] = [];
  private keys: Key[] = [];
  private entityIds: Map<EntityMapKey, number> = new Map(); // Map entities/segments to grid IDs
  private spatialGrid: SpatialHashGrid;
  private entityFactory: EntityFactory; // Add reference to EntityFactory
  private scoreMultiplierProvider?: IScoreMultiplierProvider; // Optional score multiplier provider

  // Bound event handlers for proper cleanup
  private boundHandleSnakeDeathCleanup: (snake: Snake) => void;
  private boundHandleSnakeKillRequest: (data: {
    snake: Snake;
    reason: string;
  }) => void;
  private boundHandleSafeZoneShrink: (data: {
    previousBounds: SafeZoneBounds;
    currentBounds: SafeZoneBounds;
  }) => void;

  constructor(spatialGrid: SpatialHashGrid, entityFactory: EntityFactory, scoreMultiplierProvider?: IScoreMultiplierProvider) {
    this.spatialGrid = spatialGrid;
    this.entityFactory = entityFactory; // Store EntityFactory instance
    this.scoreMultiplierProvider = scoreMultiplierProvider;

    // Bind event handlers and store references for later cleanup
    this.boundHandleSnakeDeathCleanup = this.handleSnakeDeathCleanup.bind(this);
    this.boundHandleSnakeKillRequest = this.handleSnakeKillRequest.bind(this);
    this.boundHandleSafeZoneShrink = this.handleSafeZoneShrink.bind(this);

    // Listen for snake death animation completion to handle final cleanup
    eventBus.on(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundHandleSnakeDeathCleanup
    );

    // Listen for snake kill requests (e.g., from decision failures)
    eventBus.on(
      GameEventType.SNAKE_KILL_REQUEST,
      this.boundHandleSnakeKillRequest
    );

    // Listen for safe zone shrink events to clean up food outside safe zone
    eventBus.on(
      GameEventType.SAFE_ZONE_SHRINK_START,
      this.boundHandleSafeZoneShrink
    );
  }

  /**
   * Handles requests to kill a snake, typically from decision failures.
   */
  private handleSnakeKillRequest(data: { snake: Snake; reason: string }): void {
    if (data && data.snake && data.reason) {
      this.killSnake(data.snake, data.reason);
    }
  }

  /**
   * Handles safe zone shrink events by cleaning up food outside the current safe zone.
   * This is called when the safe zone bounds actually change during shrinking.
   */
  private handleSafeZoneShrink(data: { previousBounds: SafeZoneBounds; currentBounds: SafeZoneBounds }): void {
    if (!data || !data.currentBounds) {
      console.warn('[EntityManager] Invalid safe zone shrink data');
      return;
    }

    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    let cleanedUpCount = 0;

    // Create a temporary array to avoid modification during iteration
    const foodToCleanup: Food[] = [];

    // Check each food item and mark for removal if outside current safe zone
    for (const food of this.foodItems) {
      const position = food.getPosition();
      const gridX = Math.floor(position.x / boxSize);
      const gridY = Math.floor(position.y / boxSize);

      // Check if food is outside the current safe zone bounds
      const isOutsideCurrentZone = (
        gridX < data.currentBounds.xMin ||
        gridX > data.currentBounds.xMax ||
        gridY < data.currentBounds.yMin ||
        gridY > data.currentBounds.yMax
      );

      if (isOutsideCurrentZone) {
        foodToCleanup.push(food);
        console.log(`[EntityManager] Marking ${food.getType()} food for cleanup at (${gridX}, ${gridY}) - outside current bounds`);
      }
    }

    // Remove all marked food items
    for (const food of foodToCleanup) {
      console.log(`[EntityManager] Removing food at (${Math.floor(food.getPosition().x / boxSize)}, ${Math.floor(food.getPosition().y / boxSize)})`);
      this.removeFood(food);
      cleanedUpCount++;
    }

    if (cleanedUpCount > 0) {
      console.log(`[EntityManager] Successfully cleaned up ${cleanedUpCount} food items outside current safe zone`);
      console.log(`[EntityManager] Current safe zone bounds: (${data.currentBounds.xMin}, ${data.currentBounds.yMin}) to (${data.currentBounds.xMax}, ${data.currentBounds.yMax})`);
    }
  }

  // --- Accessors ---

  getAllSnakes(): Snake[] {
    return this.snakes;
  }

  getLiveSnakes(): Snake[] {
    return this.snakes.filter((snake) => snake.isAlive());
  }

  getAllFoodItems(): Food[] {
    return this.foodItems;
  }

  getAllObstacles(): Obstacle[] {
    return this.obstacles;
  }

  getAllTreasureChests(): TreasureChest[] {
    return this.treasureChests;
  }

  getAllKeys(): Key[] {
    return this.keys;
  }

  getEntityState(): EntityState {
    // Return copies to prevent external modification
    return {
      snakes: [...this.snakes],
      foodItems: [...this.foodItems],
      obstacles: [...this.obstacles],
      treasureChests: [...this.treasureChests],
      keys: [...this.keys],
    };
  }

  // --- Entity Management ---

  initializeEntities(
    snakes: Snake[],
    obstacles: Obstacle[],
    initialFood: Food[]
  ): void {
    this.clear(); // Clear previous state first

    obstacles.forEach((obstacle) => this.addObstacle(obstacle));
    initialFood.forEach((food) => this.addFood(food));
    snakes.forEach((snake) => this.addSnake(snake));

    console.log(
      `EntityManager initialized with ${snakes.length} snakes, ${obstacles.length} obstacles, ${initialFood.length} food items.`
    );
  }

  addSnake(snake: Snake): void {
    this.snakes.push(snake);
    // Add all snake segments to the grid
    snake.getBody().forEach((segment) => {
      const gridId = this.spatialGrid.insert(segment, "snake");
      this.entityIds.set(segment, gridId);
    });
  }

  addFood(food: Food): void {
    this.foodItems.push(food);
    const gridId = this.spatialGrid.insert(food.getPosition(), "food");
    this.entityIds.set(food, gridId);
  }

  addObstacle(obstacle: Obstacle): void {
    this.obstacles.push(obstacle);
    const gridId = this.spatialGrid.insert(obstacle.getPosition(), "obstacle");
    this.entityIds.set(obstacle, gridId);
  }

  addTreasureChest(treasureChest: TreasureChest): void {
    this.treasureChests.push(treasureChest);
    const gridId = this.spatialGrid.insert(treasureChest.getPosition(), "treasure_chest");
    this.entityIds.set(treasureChest, gridId);
  }

  addKey(key: Key): void {
    this.keys.push(key);
    const gridId = this.spatialGrid.insert(key.getPosition(), "key");
    this.entityIds.set(key, gridId);
  }

  removeTreasureChest(treasureChestToRemove: TreasureChest): void {
    this.treasureChests = this.treasureChests.filter(chest => chest !== treasureChestToRemove);
    const gridId = this.entityIds.get(treasureChestToRemove);
    if (gridId !== undefined) {
      this.spatialGrid.remove(gridId);
      this.entityIds.delete(treasureChestToRemove);
    }
  }

  removeKey(keyToRemove: Key): void {
    this.keys = this.keys.filter(key => key !== keyToRemove);
    const gridId = this.entityIds.get(keyToRemove);
    if (gridId !== undefined) {
      this.spatialGrid.remove(gridId);
      this.entityIds.delete(keyToRemove);
    }
  }

  removeFood(foodToRemove: Food): void {
    this.foodItems = this.foodItems.filter((food) => food !== foodToRemove);
    const gridId = this.entityIds.get(foodToRemove);
    if (gridId !== undefined) {
      this.spatialGrid.remove(gridId);
      this.entityIds.delete(foodToRemove);
    }
  }

  /**
   * Handles the consequences of a snake eating food.
   */
  handleFoodEaten(snake: Snake, food: Food): void {
    const headPosition = snake.getBody()[0];
    const vortexMultiplier = this.scoreMultiplierProvider?.getScoreMultiplier(headPosition) || 1.0;
    
    switch (food.getType()) {
      case FoodType.GROWTH:
        snake.addGrowth(2);
        break;
      case FoodType.TRAP:
        const trapScore = -10 * vortexMultiplier; // Apply multiplier to trap penalty
        snake.addScore(trapScore);
        if (vortexMultiplier > 1.0) {
          console.log(`[VortexField] Applied ${vortexMultiplier}x multiplier to trap penalty: ${trapScore}`);
        }
        break;
      default: // Normal food
        const baseScore = food.getValue() as number;
        const finalScore = baseScore * vortexMultiplier;
        snake.addScore(finalScore);
        if (vortexMultiplier > 1.0) {
          console.log(`[VortexField] Applied ${vortexMultiplier}x multiplier to food score: ${baseScore} -> ${finalScore}`);
        }
    }
    this.removeFood(food);
    // Optionally emit event
    eventBus.emit(GameEventType.SNAKE_EAT_FOOD, { snake, food });
    eventBus.emit(GameEventType.UI_UPDATE_SCOREBOARD, this.snakes); // Update UI
  }

  /**
   * Marks a snake as dead and starts the death process.
   * Actual removal happens after animation.
   */
  killSnake(snake: Snake, reason: string): void {
    if (!snake.isAlive() || snake.isDyingAnimation()) return; // Already dead or dying

    const snakeIndex = this.snakes.indexOf(snake) + 1;
    const head = snake.getBody()[0];
    const snakeName = getSnakeDisplayName(snake, this.snakes);

    console.log(
      `[DEATH] ${snakeName} died: ${reason} at position (${head.x / 20}, ${
        head.y / 20
      })`
    );

    // Store necessary data before modifying the snake state
    const deathData: DeathData = {
      body: snake.getLastBody(), // Get body before potential changes
      score: snake.getScore(),
      index: snakeIndex,
    };
    snake.deathData = deathData; // Attach data for later use

    // Start the dying process (e.g., animation)
    snake.die(reason);

    // Emit notification with placeholder
    const snakePlaceholder = createSnakePlaceholder(snake);
    eventBus.emit(
      GameEventType.UI_NOTIFICATION,
      `${snakePlaceholder} ${reason}`
    );
  }

  /**
   * Cleans up a snake's resources after its death animation is complete.
   * Generates death food.
   */
  private handleSnakeDeathCleanup(snake: Snake): void {
    const snakeName = getSnakeDisplayName(snake, this.snakes);
    console.log(`[Cleanup] Cleaning up resources for ${snakeName}`);

    // 1. Remove all segments from the spatial grid
    const bodyToRemove = snake.getBody(); // Get the body segments used during animation
    bodyToRemove.forEach((segment) => {
      const gridId = this.entityIds.get(segment);
      if (gridId !== undefined) {
        this.spatialGrid.remove(gridId);
        this.entityIds.delete(segment);
      }
    });

    // 2. Generate death food using stored data
    if (snake.deathData) {
      const deathFoods = this.entityFactory.createDeathFood(
        snake.deathData.body,
        snake.deathData.score
      );
      deathFoods.forEach((food) => this.addFood(food)); // Add death food to the game
      console.log(
        `[Cleanup] Generated ${deathFoods.length} food items from ${snakeName}`
      );
      snake.deathData = null; // Clear death data
    }

    // Check if the game should end now (no more active snakes)
    // This check might be better placed in GameManager after receiving the cleanup event
    // eventBus.emit(GameEventType.CHECK_GAME_OVER); // Example event
  }

  // --- Update Logic ---

  /**
   * Gathers decisions from all living snakes.
   * Handles potential async operations like API calls.
   * @param gameState - The complete game state.
   * @returns A promise that resolves when all decisions are made.
   */
  async getAllSnakeDecisions(gameState: GameState): Promise<void> {
    // 先处理所有蛇的决策请求
    const decisionPromises = this.getLiveSnakes().map((snake) => {
      // Wrap decision logic in a promise that resolves even on error
      return new Promise<void>(async (resolve) => {
        try {
          // snake.update calls the appropriate decision strategy
          await snake.update(0, gameState); // deltaTime is not directly used here
        } catch (error) {
          const snakeName = getSnakeDisplayName(snake, this.snakes);
          console.error(`Error getting decision for ${snakeName}:`, error);
          // Kill the snake when a decision error occurs
          this.killSnake(snake, "failed to make a decision");
        }
        resolve();
      });
    });

    // 等待所有蛇的决策请求处理完成
    await Promise.allSettled(decisionPromises);

    console.debug("All snake decisions gathered (or timed out/errored).");
  }

  /**
   * Applies the decisions made and moves the snakes, updating the spatial grid.
   */
  applyDecisionsAndMoveSnakes(): void {
    for (const snake of this.getLiveSnakes()) {
      const oldBody = [...snake.getBody()]; // Important: Copy body *before* moving

      // Apply decision and move the snake
      // The decision (direction/shield) should have been stored within the snake object
      // by its update/strategy method in the previous step.
      snake.move(); // Snake.move() should handle shield activation (not moving) internally

      const newBody = snake.getBody();

      // Update spatial grid based on body changes
      // Iterate through the maximum possible length
      for (let i = 0; i < Math.max(oldBody.length, newBody.length); i++) {
        const oldSegment = oldBody[i];
        const newSegment = newBody[i];

        if (oldSegment && !newSegment) {
          // Segment removed (tail)
          const gridId = this.entityIds.get(oldSegment);
          if (gridId !== undefined) {
            this.spatialGrid.remove(gridId);
            this.entityIds.delete(oldSegment);
          }
        } else if (newSegment) {
          // Segment exists (or added)
          const oldGridId = oldSegment
            ? this.entityIds.get(oldSegment)
            : undefined;

          if (oldGridId !== undefined) {
            // Segment moved
            this.spatialGrid.update(oldGridId, newSegment);
            // Update the map key if the segment object itself changed
            if (oldSegment !== newSegment) {
              this.entityIds.set(newSegment, oldGridId);
              this.entityIds.delete(oldSegment);
            }
          } else {
            // New segment added (head)
            const newGridId = this.spatialGrid.insert(newSegment, "snake");
            this.entityIds.set(newSegment, newGridId);
          }
        }
      }
    }
  }

  /**
   * Updates animations for entities that require it.
   * @param deltaTime - Time elapsed since the last frame.
   */
  updateAnimations(deltaTime: number): void {
    this.snakes.forEach((snake) => {
      // Only update animation for snakes that are alive or in death animation
      const isAlive = snake.isAlive();
      const isDying = snake.isDyingAnimation();
      if (isAlive || isDying) {
        // console.log(`[ANIMATION UPDATE] ${snake.getMetadata()?.name}: isAlive=${isAlive}, isDying=${isDying}, deltaTime=${deltaTime.toFixed(1)}`);
        snake.updateAnimation(deltaTime);
      }
    });
    // Add other entities needing animation updates here (e.g., Food animations)
  }

  /**
   * Clears all entities and resets the manager state.
   */
  clear(): void {
    // Clean up all snake resources
    for (const snake of this.snakes) {
      // Clean up snake decision strategies
      const strategy = snake.getDecisionStrategy();
      if (strategy && typeof strategy.cleanup === "function") {
        try {
          strategy.cleanup();
        } catch (e) {
          console.error(`Error cleaning up strategy for snake:`, e);
        }
      }
    }

    // Clear entity lists
    this.snakes = [];
    this.foodItems = [];
    this.obstacles = [];
    this.treasureChests = [];
    this.keys = [];

    // Clear spatial grid and entity ID mappings
    this.entityIds.clear();
    this.spatialGrid.clear();
  }

  /**
   * Completely dispose all resources including event listeners
   */
  dispose(): void {
    // First clear entities
    this.clear();

    // Unsubscribe from event listeners
    eventBus.off(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundHandleSnakeDeathCleanup
    );
    eventBus.off(
      GameEventType.SNAKE_KILL_REQUEST,
      this.boundHandleSnakeKillRequest
    );

    console.log("EntityManager fully disposed");
  }

  /**
   * Finds items in the spatial grid near a given position.
   * Delegates the query to the internal spatialGrid.
   * @param position - The center position to search around.
   * @param size - The size of the area to search (usually entity size).
   * @param type - Optional filter for the type of entity to find.
   * @returns An array of GridItem objects found nearby.
   */
  findNearbyGridItems(
    position: Position,
    size: number,
    type?: string
  ): GridItem[] {
    // Delegate the call to the private spatialGrid instance
    return this.spatialGrid.findNearby(position, size, type);
  }

  /**
   * Checks if a specific grid position is occupied by certain entity types.
   * @param position - The exact position to check.
   * @param typesToCheck - An array of entity types (e.g., ['obstacle', 'snake']).
   * @returns True if the position is occupied by any of the specified types, false otherwise.
   */
  isPositionOccupied(position: Position, typesToCheck: string[]): boolean {
    const nearby = this.spatialGrid.findNearby(position, 1); // Check the exact cell
    for (const item of nearby) {
      if (item.position.x === position.x && item.position.y === position.y) {
        if (typesToCheck.includes(item.type)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Updates the TTL for all food items and handles expiration.
   */
  updateFoodLifecycles(): void {
    const foodToRemove: Food[] = [];
    const foodToAdd: Food[] = []; // For transformed growth food

    for (const food of this.foodItems) {
      let currentTtl = food.getTTL(); // Use the getter

      // Only process food items that have a TTL defined
      if (currentTtl !== undefined) {
        currentTtl--; // Decrement TTL

        // Directly update the TTL via a setter or by modifying the property if accessible
        // This depends on your Food class implementation. Let's assume direct access or a setter.
        // If Food class is immutable, you'd need to replace the food instance.
        // For simplicity, let's assume we can modify it (adjust if needed).
        (food as any).ttl = currentTtl; // Or use a setter: food.setTTL(currentTtl);

        if (currentTtl <= 0) {
          // Food has expired
          foodToRemove.push(food); // Mark for removal

          // Handle Growth food transformation as per config
          if (food.getType() === FoodType.GROWTH) {
            const newValue = 1;
            const newType = FoodType.NORMAL;
            // Get color and TTL using the factory's helper methods or config directly
            // This assumes EntityFactory has methods or direct access is okay.
            // We might need to expose helper methods in EntityFactory or duplicate logic.
            // Let's assume EntityFactory has helpers for now:
            const newColor = this.entityFactory.getFoodColor(newType, newValue); // Need getFoodColor helper
            const newTtl = this.entityFactory.getFoodTTL(newType); // Need getFoodTTL helper

            // Create the replacement normal food
            const replacementFood = this.entityFactory.createFood(
              food.getPosition(), // Reuse position
              newType,
              newValue,
              newColor,
              newTtl
            );
            if (replacementFood) {
              foodToAdd.push(replacementFood);
            }
          }
        }
      }
    }

    // Perform removals and additions after iterating to avoid modifying the array during loop
    foodToRemove.forEach((food) => this.removeFood(food)); // Use existing removeFood
    foodToAdd.forEach((food) => this.addFood(food)); // Use existing addFood
  }
}
