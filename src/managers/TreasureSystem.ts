import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { GameConfig, Direction } from "../config/GameConfig";
import { eventBus, GameEventType } from "../core/EventBus";
import { IEntityQuery } from "../interfaces/EntityQuery";
import { SafeZoneManager } from "./SafeZoneManager";

export interface TreasureSystemConfig {
  enabled: boolean;
  firstTreasureWindow: { start: number; end: number; expectedTick: number };
  secondTreasureWindow: { start: number; end: number; expectedTick: number };
  baseScore: number;
  scoreMultiplier: number;
  minScore: number;
  maxScore: number;
  keyHoldTimeLimit: number;
  minTreasureDistanceFromEdge: number;
  minDistanceFromSnakeHead: number;
  keyDistanceRing: { min: number; max: number };
  minKeySpacing: number;
  maxFairnessGap: number;
  minKeysPerTreasure: number;
  maxKeysPerTreasure: number;
  keysPerSnakeDivisor: number;
  maxPositionAttempts: number;
  maxFairnessAttempts: number;
}

interface PseudoRandomState {
  isInWindow: boolean;
  windowStart: number;
  windowEnd: number;
  expectedTick: number;
  treasureIndex: number;
}

export class TreasureSystem {
  private config: TreasureSystemConfig;
  private entityQuery: IEntityQuery;
  private safeZoneManager: SafeZoneManager;
  private currentTreasure: TreasureChest | null = null;
  private currentKeys: Key[] = [];
  private treasureSpawnCount: number = 0;
  private pseudoRandomState: PseudoRandomState | null = null;
  
  constructor(entityQuery: IEntityQuery, safeZoneManager: SafeZoneManager, config?: Partial<TreasureSystemConfig>) {
    this.entityQuery = entityQuery;
    this.safeZoneManager = safeZoneManager;
    this.config = {
      enabled: config?.enabled ?? GameConfig.TREASURE_SYSTEM.ENABLED,
      firstTreasureWindow: config?.firstTreasureWindow ?? {
        start: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK - 10,
        end: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK + 30,
        expectedTick: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK
      },
      secondTreasureWindow: config?.secondTreasureWindow ?? {
        start: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK - 15,
        end: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK + 35,
        expectedTick: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK
      },
      baseScore: config?.baseScore ?? GameConfig.TREASURE_SYSTEM.BASE_SCORE,
      scoreMultiplier: config?.scoreMultiplier ?? GameConfig.TREASURE_SYSTEM.SCORE_MULTIPLIER,
      minScore: config?.minScore ?? GameConfig.TREASURE_SYSTEM.MIN_SCORE,
      maxScore: config?.maxScore ?? GameConfig.TREASURE_SYSTEM.MAX_SCORE,
      keyHoldTimeLimit: config?.keyHoldTimeLimit ?? GameConfig.TREASURE_SYSTEM.KEY_HOLD_TIME_LIMIT,
      minTreasureDistanceFromEdge: config?.minTreasureDistanceFromEdge ?? 5,
      minDistanceFromSnakeHead: config?.minDistanceFromSnakeHead ?? GameConfig.TREASURE_SYSTEM.MIN_DISTANCE_FROM_SNAKE_HEAD,
      keyDistanceRing: config?.keyDistanceRing ?? { min: 12, max: 25 },
      minKeySpacing: config?.minKeySpacing ?? 6,
      maxFairnessGap: config?.maxFairnessGap ?? 8,
      minKeysPerTreasure: config?.minKeysPerTreasure ?? GameConfig.TREASURE_SYSTEM.MIN_KEYS_PER_TREASURE,
      maxKeysPerTreasure: config?.maxKeysPerTreasure ?? GameConfig.TREASURE_SYSTEM.MAX_KEYS_PER_TREASURE,
      keysPerSnakeDivisor: config?.keysPerSnakeDivisor ?? GameConfig.TREASURE_SYSTEM.KEYS_PER_SNAKE_DIVISOR,
      maxPositionAttempts: config?.maxPositionAttempts ?? 100,
      maxFairnessAttempts: config?.maxFairnessAttempts ?? 10
    };
  }

  update(currentTick: number): void {
    if (!this.config.enabled) return;

    this.updatePseudoRandomState(currentTick);
    if (this.shouldSpawnTreasure(currentTick)) {
      this.spawnTreasureAndKeys(currentTick);
    }

    this.updateKeyHoldTimes();
  }

  private updatePseudoRandomState(currentTick: number): void {
    if (this.pseudoRandomState) return;

    if (this.treasureSpawnCount === 0 && 
        currentTick >= this.config.firstTreasureWindow.start && 
        currentTick <= this.config.firstTreasureWindow.end) {
      this.pseudoRandomState = {
        isInWindow: true,
        windowStart: this.config.firstTreasureWindow.start,
        windowEnd: this.config.firstTreasureWindow.end,
        expectedTick: this.config.firstTreasureWindow.expectedTick,
        treasureIndex: 0
      };
    } else if (this.treasureSpawnCount === 1 &&
        currentTick >= this.config.secondTreasureWindow.start && 
        currentTick <= this.config.secondTreasureWindow.end) {
      this.pseudoRandomState = {
        isInWindow: true,
        windowStart: this.config.secondTreasureWindow.start,
        windowEnd: this.config.secondTreasureWindow.end,
        expectedTick: this.config.secondTreasureWindow.expectedTick,
        treasureIndex: 1
      };
    }
  }

  private shouldSpawnTreasure(currentTick: number): boolean {
    if (!this.pseudoRandomState?.isInWindow) return false;

    if (currentTick > this.pseudoRandomState.windowEnd) {
      this.pseudoRandomState = null;
      return false;
    }

    const windowCenter = this.pseudoRandomState.expectedTick;
    const windowHalfSize = (this.pseudoRandomState.windowEnd - this.pseudoRandomState.windowStart) / 2;
    const normalizedPosition = (currentTick - windowCenter) / windowHalfSize;
    
    const gaussianValue = Math.exp(-Math.pow(normalizedPosition, 2) * 3);
    const spawnProbability = 0.02 + 0.13 * gaussianValue;
    
    const shouldSpawn = Math.random() < spawnProbability;
    
    if (shouldSpawn) {
      this.pseudoRandomState = null;
      return true;
    }
    
    return false;
  }

  private spawnTreasureAndKeys(currentTick: number): void {
    const liveSnakes = this.entityQuery.getAllSnakes().filter(snake => snake.isAlive());
    if (liveSnakes.length === 0) return;

    // Special handling for second spawn window: if previous treasure still exists and not opened,
    // and all its keys are outside the safe zone, attempt replacement.
    if (this.treasureSpawnCount === 1 && this.currentTreasure && !this.currentTreasure.isOpened()) {
      const isSecondWindow = currentTick >= this.config.secondTreasureWindow.start && currentTick <= this.config.secondTreasureWindow.end;
      if (isSecondWindow && this.areAllCurrentKeysOutsideSafeZone()) {
        const keyCount = this.calculateKeyCount(liveSnakes.length);
        const replacement = this.tryGenerateTreasureAndKeys(liveSnakes, keyCount);
        if (replacement) {
          const { position, score, keys } = replacement;
          const newTreasure = new TreasureChest(position, GameConfig.CANVAS.BOX_SIZE, score);
          const oldTreasure = this.currentTreasure;
          const oldKeys = [...this.currentKeys];
          // Update internal state first
          this.currentTreasure = newTreasure;
          this.currentKeys = keys;
          this.treasureSpawnCount++;
          // Emit replacement event so GameManager can remove old and add new entities atomically
          eventBus.emit(GameEventType.TREASURE_REPLACED, {
            oldTreasure,
            oldKeys,
            treasure: newTreasure,
            keys
          });
          return;
        } else {
          // Could not generate valid replacement: keep the old treasure unchanged
          return;
        }
      } else {
        // Not eligible for replacement: keep as is
        return;
      }
    }

    // Normal spawn path
    const treasureScore = this.calculateTreasureScore(liveSnakes);
    const treasurePosition = this.findTreasurePosition(liveSnakes);
    if (!treasurePosition) return;

    this.currentTreasure = new TreasureChest(treasurePosition, GameConfig.CANVAS.BOX_SIZE, treasureScore);
    this.treasureSpawnCount++;

    const keyCount = this.calculateKeyCount(liveSnakes.length);
    this.currentKeys = this.spawnKeys(keyCount, treasurePosition, liveSnakes);
    
    eventBus.emit(GameEventType.TREASURE_SPAWNED, { treasure: this.currentTreasure, keys: this.currentKeys });
  }

  private areAllCurrentKeysOutsideSafeZone(): boolean {
    if (!this.currentKeys || this.currentKeys.length === 0) return false;
    return this.currentKeys.every(key => !this.safeZoneManager.isPositionSafe(key.getPosition()));
  }

  private tryGenerateTreasureAndKeys(liveSnakes: Snake[], keyCount: number): { position: Position, score: number, keys: Key[] } | null {
    const treasureScore = this.calculateTreasureScore(liveSnakes);
    const treasurePosition = this.findTreasurePosition(liveSnakes);
    if (!treasurePosition) return null;

    const keyPositions = this.generateKeyPositions(keyCount, treasurePosition, liveSnakes);
    if (keyPositions.length < keyCount) return null; // Must be able to place all keys
    const keys = keyPositions.map(pos => new Key(pos, GameConfig.CANVAS.BOX_SIZE));
    return { position: treasurePosition, score: treasureScore, keys };
  }

  private calculateTreasureScore(liveSnakes: Snake[]): number {
    if (liveSnakes.length === 0) return this.config.minScore;

    const sortedSnakes = [...liveSnakes].sort((a, b) => b.getScore() - a.getScore());
    const firstPlaceScore = sortedSnakes[0].getScore();
    
    const nonFirstPlaceSnakes = sortedSnakes.slice(1);
    const averageNonFirstScore = nonFirstPlaceSnakes.length > 0 
      ? nonFirstPlaceSnakes.reduce((sum, snake) => sum + snake.getScore(), 0) / nonFirstPlaceSnakes.length
      : firstPlaceScore;

    const calculatedScore = this.config.baseScore + 
      (firstPlaceScore - averageNonFirstScore) * this.config.scoreMultiplier;

    return Math.max(this.config.minScore, Math.min(this.config.maxScore, Math.floor(calculatedScore)));
  }

  private calculateKeyCount(aliveSnakeCount: number): number {
    const calculatedCount = Math.floor(aliveSnakeCount / this.config.keysPerSnakeDivisor);
    return Math.max(this.config.minKeysPerTreasure, 
                   Math.min(this.config.maxKeysPerTreasure, calculatedCount));
  }

  private findTreasurePosition(liveSnakes: Snake[]): Position | null {
    const safeZone = this.safeZoneManager.getCurrentBounds();
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const positions: Position[] = [];
    
    for (let x = safeZone.xMin; x <= safeZone.xMax; x++) {
      for (let y = safeZone.yMin; y <= safeZone.yMax; y++) {
        const distanceFromEdge = Math.min(x - safeZone.xMin, safeZone.xMax - x, y - safeZone.yMin, safeZone.yMax - y);
        if (distanceFromEdge < this.config.minTreasureDistanceFromEdge) continue;
        
        const pos = { x: x * boxSize, y: y * boxSize };
        if (liveSnakes.every(snake => this.calculateManhattanDistance(snake.getBody()[0], pos) >= this.config.minDistanceFromSnakeHead) 
            && !this.isPositionOccupied(pos)) {
          positions.push(pos);
        }
      }
    }
    
    return positions.length > 0 ? positions[Math.floor(Math.random() * positions.length)] : null;
  }

  private spawnKeys(keyCount: number, treasurePosition: Position, liveSnakes: Snake[]): Key[] {
    const keyPositions = this.generateKeyPositions(keyCount, treasurePosition, liveSnakes);
    return keyPositions.map(pos => new Key(pos, GameConfig.CANVAS.BOX_SIZE));
  }

  private generateKeyPositions(keyCount: number, treasurePosition: Position, liveSnakes: Snake[]): Position[] {
    for (let attempt = 0; attempt < this.config.maxFairnessAttempts; attempt++) {
      const positions = this.selectKeyPositions(keyCount, treasurePosition, liveSnakes);
      if (this.isFair(positions, liveSnakes)) {
        return positions;
      }
    }
    return this.selectKeyPositions(keyCount, treasurePosition, liveSnakes);
  }

  private selectKeyPositions(keyCount: number, treasurePosition: Position, liveSnakes: Snake[]): Position[] {
    const candidates = this.getValidKeyCandidates(treasurePosition, liveSnakes);
    const shuffled = this.shuffleArray(candidates);
    const selected: Position[] = [];
    
    for (const candidate of shuffled) {
      if (selected.every(pos => this.calculateManhattanDistance(candidate, pos) >= this.config.minKeySpacing)) {
        selected.push(candidate);
        if (selected.length >= keyCount) break;
      }
    }
    return selected;
  }

  private getValidKeyCandidates(treasurePosition: Position, liveSnakes: Snake[]): Position[] {
    const safeZone = this.safeZoneManager.getCurrentBounds();
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const candidates: Position[] = [];
    
    for (let x = safeZone.xMin; x <= safeZone.xMax; x++) {
      for (let y = safeZone.yMin; y <= safeZone.yMax; y++) {
        const pos = { x: x * boxSize, y: y * boxSize };
        if (this.isValidKeyPosition(pos, treasurePosition, liveSnakes)) {
          candidates.push(pos);
        }
      }
    }
    return candidates;
  }

  private isValidKeyPosition(pos: Position, treasurePos: Position, snakes: Snake[]): boolean {
    const treasureDist = this.calculateManhattanDistance(pos, treasurePos);
    if (treasureDist < this.config.keyDistanceRing.min || treasureDist > this.config.keyDistanceRing.max) {
      return false;
    }
    
    return snakes.every(snake => 
      this.calculateManhattanDistance(pos, snake.getBody()[0]) >= 5
    ) && !this.isPositionOccupied(pos);
  }

  private isFair(keyPositions: Position[], liveSnakes: Snake[]): boolean {
    if (liveSnakes.length === 0 || keyPositions.length === 0) return true;
    
    const distances = liveSnakes.map(snake => {
      const headPos = snake.getBody()[0];
      return Math.min(...keyPositions.map(keyPos => 
        this.calculateManhattanDistance(headPos, keyPos)
      ));
    });
    
    return Math.max(...distances) - Math.min(...distances) <= this.config.maxFairnessGap;
  }

  private calculateManhattanDistance(pos1: Position, pos2: Position): number {
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    return Math.abs(pos1.x - pos2.x) / boxSize + Math.abs(pos1.y - pos2.y) / boxSize;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private isPositionOccupied(position: Position): boolean {
    return this.entityQuery.isPositionOccupied(position, ['obstacle', 'snake', 'food']);
  }

  private updateKeyHoldTimes(): void {
    const liveSnakes = this.entityQuery.getAllSnakes().filter(snake => snake.isAlive());
    
    for (const snake of liveSnakes) {
      if (snake.hasKey()) {
        snake.incrementKeyHoldTime();
        
        if (snake.getKeyHoldTime() >= this.config.keyHoldTimeLimit) {
          this.handleKeyTimeout(snake);
        }
      }
    }
  }

  private handleKeyTimeout(snake: Snake): void {
    const droppedKeyId = snake.dropKey();
    if (droppedKeyId) {
      const dropPosition = this.findAdjacentDropPosition(snake);
      if (dropPosition) {
        const droppedKey = new Key(dropPosition, GameConfig.CANVAS.BOX_SIZE, droppedKeyId);
        eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
      }
    }
  }

  private findAdjacentDropPosition(snake: Snake): Position | null {
    const headPos = snake.getBody()[0];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const direction = snake.getDirection();
    
    const adjacentOffsets = this.getAdjacentOffsets(direction);
    
    for (const offset of adjacentOffsets) {
      const dropPos = {
        x: headPos.x + offset.x * boxSize,
        y: headPos.y + offset.y * boxSize
      };
      
      if (dropPos.x >= 0 && dropPos.x < GameConfig.CANVAS.COLUMNS * boxSize &&
          dropPos.y >= 0 && dropPos.y < GameConfig.CANVAS.ROWS * boxSize &&
          !this.isPositionOccupied(dropPos)) {
        return dropPos;
      }
    }
    
    return headPos;
  }

  private getAdjacentOffsets(direction: Direction): Position[] {
    switch (direction) {
      case Direction.UP:
      case Direction.DOWN:
        return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
      case Direction.LEFT:
      case Direction.RIGHT:
        return [{ x: 0, y: -1 }, { x: 0, y: 1 }];
      default:
        return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    }
  }

  handleTreasureOpening(snake: Snake, treasure: TreasureChest): boolean {
    if (!snake.hasKey() || treasure.isOpened() || treasure !== this.currentTreasure) {
      return false;
    }

    treasure.open();
    snake.addScore(treasure.getScore());
    snake.dropKey();
    
    this.clearAllKeys();
    
    eventBus.emit(GameEventType.TREASURE_OPENED, { snake, treasure, score: treasure.getScore() });
    
    return true;
  }

  handleKeyPickup(snake: Snake, key: Key): boolean {
    if (snake.hasKey()) {
      return false;
    }

    try {
      snake.holdKey(key.getId());
      this.currentKeys = this.currentKeys.filter(k => k.getId() !== key.getId());
      eventBus.emit(GameEventType.KEY_PICKED_UP, { snake, key });
      return true;
    } catch (error) {
      console.error("[TreasureSystem] Error picking up key:", error);
      return false;
    }
  }

  handleSnakeDeath(snake: Snake): void {
    if (snake.hasKey()) {
      const droppedKeyId = snake.dropKey();
      if (droppedKeyId) {
        const headPos = snake.getBody()[0];
        const droppedKey = new Key(headPos, GameConfig.CANVAS.BOX_SIZE, droppedKeyId);
        eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
      }
    }
  }

  private clearAllKeys(): void {
    const allSnakes = this.entityQuery.getAllSnakes();
    allSnakes.forEach(snake => {
      if (snake.hasKey()) {
        snake.dropKey();
      }
    });

    this.currentKeys.forEach(key => {
      eventBus.emit(GameEventType.KEY_REMOVED, { key });
    });
    this.currentKeys = [];
  }

  private isTreasureOpened(): boolean {
    return this.currentTreasure?.isOpened() ?? true;
  }

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

  reset(): void {
    this.currentTreasure = null;
    this.currentKeys = [];
    this.treasureSpawnCount = 0;
    this.pseudoRandomState = null;
  }

  dispose(): void {
    this.reset();
  }
}
