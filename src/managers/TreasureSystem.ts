import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { GameConfig, Direction } from "../config/GameConfig";
import { eventBus, GameEventType } from "../core/EventBus";
import { IEntityQuery } from "../interfaces/EntityQuery";

export interface TreasureSystemConfig {
  enabled: boolean;
  firstTreasureTick: number;
  secondTreasureTick: number;
  baseScore: number;
  scoreMultiplier: number;
  minScore: number;
  maxScore: number;
  keyHoldTimeLimit: number;
  minTreasureDistance: number;
  minDistanceFromSnakeHead: number;
  minKeysPerTreasure: number;
  maxKeysPerTreasure: number;
  keysPerSnakeDivisor: number;
}

export class TreasureSystem {
  private config: TreasureSystemConfig;
  private entityQuery: IEntityQuery;
  private currentTreasure: TreasureChest | null = null;
  private currentKeys: Key[] = [];
  private treasureSpawnCount: number = 0;
  
  constructor(entityQuery: IEntityQuery, config?: Partial<TreasureSystemConfig>) {
    this.entityQuery = entityQuery;
    this.config = {
      enabled: config?.enabled ?? GameConfig.TREASURE_SYSTEM.ENABLED,
      firstTreasureTick: config?.firstTreasureTick ?? GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK,
      secondTreasureTick: config?.secondTreasureTick ?? GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK,
      baseScore: config?.baseScore ?? GameConfig.TREASURE_SYSTEM.BASE_SCORE,
      scoreMultiplier: config?.scoreMultiplier ?? GameConfig.TREASURE_SYSTEM.SCORE_MULTIPLIER,
      minScore: config?.minScore ?? GameConfig.TREASURE_SYSTEM.MIN_SCORE,
      maxScore: config?.maxScore ?? GameConfig.TREASURE_SYSTEM.MAX_SCORE,
      keyHoldTimeLimit: config?.keyHoldTimeLimit ?? GameConfig.TREASURE_SYSTEM.KEY_HOLD_TIME_LIMIT,
      minTreasureDistance: config?.minTreasureDistance ?? GameConfig.TREASURE_SYSTEM.MIN_TREASURE_DISTANCE,
      minDistanceFromSnakeHead: config?.minDistanceFromSnakeHead ?? GameConfig.TREASURE_SYSTEM.MIN_DISTANCE_FROM_SNAKE_HEAD,
      minKeysPerTreasure: config?.minKeysPerTreasure ?? GameConfig.TREASURE_SYSTEM.MIN_KEYS_PER_TREASURE,
      maxKeysPerTreasure: config?.maxKeysPerTreasure ?? GameConfig.TREASURE_SYSTEM.MAX_KEYS_PER_TREASURE,
      keysPerSnakeDivisor: config?.keysPerSnakeDivisor ?? GameConfig.TREASURE_SYSTEM.KEYS_PER_SNAKE_DIVISOR,
    };
  }

  update(currentTick: number): void {
    if (!this.config.enabled) return;

    // Check for treasure spawn timing
    if (currentTick === this.config.firstTreasureTick || 
        (currentTick === this.config.secondTreasureTick && this.treasureSpawnCount === 1 && this.isTreasureOpened())) {
      this.spawnTreasureAndKeys(currentTick);
    }

    // Update key hold times and handle timeouts
    this.updateKeyHoldTimes();
  }

  private spawnTreasureAndKeys(currentTick: number): void {
    const liveSnakes = this.entityQuery.getAllSnakes().filter(snake => snake.isAlive());
    
    if (liveSnakes.length === 0) return;

    // Calculate treasure score
    const treasureScore = this.calculateTreasureScore(liveSnakes);
    
    // Find safe position for treasure
    const treasurePosition = this.findSafePosition(liveSnakes);
    if (!treasurePosition) {
      console.warn("[TreasureSystem] Could not find safe position for treasure");
      return;
    }

    // Create treasure
    this.currentTreasure = new TreasureChest(treasurePosition, GameConfig.CANVAS.BOX_SIZE, treasureScore);
    this.treasureSpawnCount++;

    // Calculate number of keys
    const keyCount = this.calculateKeyCount(liveSnakes.length);
    
    // Spawn keys
    this.currentKeys = this.spawnKeys(keyCount, treasurePosition, liveSnakes);
    
    console.log(`[TreasureSystem] Spawned treasure (${treasureScore} points) and ${keyCount} keys at tick ${currentTick}`);
    
    // Emit events for entity manager to add them
    eventBus.emit(GameEventType.TREASURE_SPAWNED, { treasure: this.currentTreasure, keys: this.currentKeys });
  }

  private calculateTreasureScore(liveSnakes: Snake[]): number {
    if (liveSnakes.length === 0) return this.config.minScore;

    // Sort snakes by score to find first place
    const sortedSnakes = [...liveSnakes].sort((a, b) => b.getScore() - a.getScore());
    const firstPlaceScore = sortedSnakes[0].getScore();
    
    // Calculate average of non-first-place players
    const nonFirstPlaceSnakes = sortedSnakes.slice(1);
    const averageNonFirstScore = nonFirstPlaceSnakes.length > 0 
      ? nonFirstPlaceSnakes.reduce((sum, snake) => sum + snake.getScore(), 0) / nonFirstPlaceSnakes.length
      : firstPlaceScore; // If only one snake, use their score

    // Apply formula: baseScore + (firstScore - avgNonFirstScore) * multiplier
    const calculatedScore = this.config.baseScore + 
      (firstPlaceScore - averageNonFirstScore) * this.config.scoreMultiplier;

    // Apply bounds
    return Math.max(this.config.minScore, Math.min(this.config.maxScore, Math.floor(calculatedScore)));
  }

  private calculateKeyCount(aliveSnakeCount: number): number {
    const calculatedCount = Math.floor(aliveSnakeCount / this.config.keysPerSnakeDivisor);
    return Math.max(this.config.minKeysPerTreasure, 
                   Math.min(this.config.maxKeysPerTreasure, calculatedCount));
  }

  private findSafePosition(liveSnakes: Snake[]): Position | null {
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Try random positions
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Math.floor(Math.random() * GameConfig.CANVAS.COLUMNS) * boxSize;
      const y = Math.floor(Math.random() * GameConfig.CANVAS.ROWS) * boxSize;
      const position = { x, y };

      // Check minimum distance from all snake heads
      const isSafe = liveSnakes.every(snake => {
        const headPos = snake.getBody()[0];
        const distance = Math.abs(headPos.x - x) / boxSize + Math.abs(headPos.y - y) / boxSize;
        return distance >= this.config.minDistanceFromSnakeHead;
      });

      // Check if position is not occupied by obstacles or other entities
      if (isSafe && !this.isPositionOccupied(position)) {
        return position;
      }
    }

    return null;
  }

  private spawnKeys(keyCount: number, treasurePosition: Position, liveSnakes: Snake[]): Key[] {
    const keys: Key[] = [];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    for (let i = 0; i < keyCount; i++) {
      let keyPosition = this.findSafeKeyPosition(treasurePosition, liveSnakes, keys);
      
      if (keyPosition) {
        keys.push(new Key(keyPosition, boxSize));
      }
    }

    return keys;
  }

  private findSafeKeyPosition(treasurePosition: Position, liveSnakes: Snake[], existingKeys: Key[]): Position | null {
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Math.floor(Math.random() * GameConfig.CANVAS.COLUMNS) * boxSize;
      const y = Math.floor(Math.random() * GameConfig.CANVAS.ROWS) * boxSize;
      const position = { x, y };

      // Check minimum distance from treasure
      const treasureDistance = Math.abs(treasurePosition.x - x) / boxSize + Math.abs(treasurePosition.y - y) / boxSize;
      if (treasureDistance < this.config.minTreasureDistance) continue;

      // Check distance from snake heads
      const isSafeFromSnakes = liveSnakes.every(snake => {
        const headPos = snake.getBody()[0];
        const distance = Math.abs(headPos.x - x) / boxSize + Math.abs(headPos.y - y) / boxSize;
        return distance >= this.config.minDistanceFromSnakeHead;
      });

      // Check distance from other keys
      const isSafeFromKeys = existingKeys.every(key => {
        const keyPos = key.getPosition();
        const distance = Math.abs(keyPos.x - x) / boxSize + Math.abs(keyPos.y - y) / boxSize;
        return distance >= 2; // Minimum distance between keys
      });

      if (isSafeFromSnakes && isSafeFromKeys && !this.isPositionOccupied(position)) {
        return position;
      }
    }

    return null;
  }

  private isPositionOccupied(position: Position): boolean {
    return this.entityQuery.isPositionOccupied(position, ['obstacle', 'snake', 'food']);
  }

  private updateKeyHoldTimes(): void {
    const liveSnakes = this.entityQuery.getAllSnakes().filter(snake => snake.isAlive());
    
    for (const snake of liveSnakes) {
      if (snake.hasKey()) {
        snake.incrementKeyHoldTime();
        
        // Check for timeout
        if (snake.getKeyHoldTime() >= this.config.keyHoldTimeLimit) {
          this.handleKeyTimeout(snake);
        }
      }
    }
  }

  private handleKeyTimeout(snake: Snake): void {
    const droppedKeyId = snake.dropKey();
    if (droppedKeyId) {
      // Find adjacent position to drop the key
      const dropPosition = this.findAdjacentDropPosition(snake);
      if (dropPosition) {
        const droppedKey = new Key(dropPosition, GameConfig.CANVAS.BOX_SIZE, droppedKeyId);
        eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
        console.log(`[TreasureSystem] ${snake.getMetadata()?.name} dropped key due to timeout`);
      }
    }
  }

  private findAdjacentDropPosition(snake: Snake): Position | null {
    const headPos = snake.getBody()[0];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const direction = snake.getDirection();
    
    // Try left and right relative to movement direction
    const adjacentOffsets = this.getAdjacentOffsets(direction);
    
    for (const offset of adjacentOffsets) {
      const dropPos = {
        x: headPos.x + offset.x * boxSize,
        y: headPos.y + offset.y * boxSize
      };
      
      // Check bounds
      if (dropPos.x >= 0 && dropPos.x < GameConfig.CANVAS.COLUMNS * boxSize &&
          dropPos.y >= 0 && dropPos.y < GameConfig.CANVAS.ROWS * boxSize &&
          !this.isPositionOccupied(dropPos)) {
        return dropPos;
      }
    }
    
    // Fallback to current position if no adjacent position is available
    return headPos;
  }

  private getAdjacentOffsets(direction: Direction): Position[] {
    switch (direction) {
      case Direction.UP:
        return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
      case Direction.DOWN:
        return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
      case Direction.LEFT:
        return [{ x: 0, y: -1 }, { x: 0, y: 1 }];
      case Direction.RIGHT:
        return [{ x: 0, y: -1 }, { x: 0, y: 1 }];
      default:
        return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    }
  }

  // Handle treasure opening
  handleTreasureOpening(snake: Snake, treasure: TreasureChest): boolean {
    if (!snake.hasKey() || treasure.isOpened() || treasure !== this.currentTreasure) {
      return false;
    }

    // Open the treasure
    treasure.open();
    snake.addScore(treasure.getScore());
    snake.dropKey(); // Remove key from snake
    
    // Clear all keys from the game
    this.clearAllKeys();
    
    console.log(`[TreasureSystem] ${snake.getMetadata()?.name} opened treasure for ${treasure.getScore()} points`);
    eventBus.emit(GameEventType.TREASURE_OPENED, { snake, treasure, score: treasure.getScore() });
    
    return true;
  }

  // Handle key pickup
  handleKeyPickup(snake: Snake, key: Key): boolean {
    if (snake.hasKey()) {
      return false; // Snake already has a key
    }

    try {
      snake.holdKey(key.getId());
      // Remove key from current keys list
      this.currentKeys = this.currentKeys.filter(k => k.getId() !== key.getId());
      eventBus.emit(GameEventType.KEY_PICKED_UP, { snake, key });
      console.log(`[TreasureSystem] ${snake.getMetadata()?.name} picked up key`);
      return true;
    } catch (error) {
      console.error("[TreasureSystem] Error picking up key:", error);
      return false;
    }
  }

  // Handle snake death - drop held keys
  handleSnakeDeath(snake: Snake): void {
    if (snake.hasKey()) {
      const droppedKeyId = snake.dropKey();
      if (droppedKeyId) {
        const headPos = snake.getBody()[0];
        const droppedKey = new Key(headPos, GameConfig.CANVAS.BOX_SIZE, droppedKeyId);
        eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
        console.log(`[TreasureSystem] ${snake.getMetadata()?.name} dropped key on death`);
      }
    }
  }

  private clearAllKeys(): void {
    // Clear keys held by snakes
    const allSnakes = this.entityQuery.getAllSnakes();
    allSnakes.forEach(snake => {
      if (snake.hasKey()) {
        snake.dropKey();
      }
    });

    // Clear keys from the game
    this.currentKeys.forEach(key => {
      eventBus.emit(GameEventType.KEY_REMOVED, { key });
    });
    this.currentKeys = [];
  }

  private isTreasureOpened(): boolean {
    return this.currentTreasure?.isOpened() ?? true;
  }

  // Getters for external access
  getCurrentTreasure(): TreasureChest | null {
    return this.currentTreasure;
  }

  getCurrentKeys(): Key[] {
    return [...this.currentKeys];
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): TreasureSystemConfig {
    return { ...this.config };
  }

  // Reset for new game
  reset(): void {
    this.currentTreasure = null;
    this.currentKeys = [];
    this.treasureSpawnCount = 0;
  }

  // Disposal
  dispose(): void {
    this.reset();
  }
}