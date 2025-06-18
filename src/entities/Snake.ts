import { Entity } from "../core/Entity";
import { Position } from "../types/Position";
import { Direction, GameConfig } from "../config/GameConfig";
import { eventBus, GameEventType } from "../core/EventBus";
import { GameState } from "../types/GameState";
import { EntityType } from "../types/EntityType";

// Snake metadata interface
export interface SnakeMetadata {
  studentId?: string;      // Student ID (for student AI snakes)
  name?: string;           // Snake name
  [key: string]: any;      // Additional metadata
}

// Death data interface
export interface DeathData {
  body: Position[];        // Body positions at time of death
  score: number;           // Final score
  index: number;           // Snake index
}

// Strategy interface for snake decision-making
export interface SnakeDecisionStrategy {
  makeDecision(snake: Snake, gameState: GameState): Promise<void>;
  cleanup?(): void;        // Optional method to release resources
}

export class Snake extends Entity {
  private body: Position[];
  private lastBody: Position[];
  private direction: Direction;
  private prevDirection: Direction;
  private color: string;
  private score: number;
  private shieldActive: boolean;
  private shieldCooldown: number;
  private shieldDuration: number;
  private isInitialShieldActive: boolean; // Flag for initial spawn shield
  private alive: boolean;
  private growthLength: number;
  private metadata: SnakeMetadata;
  private decisionStrategy: SnakeDecisionStrategy;
  // Animation properties
  private moveProgress: number = 1;     // Movement progress (0-1), 1 means complete
  private isMoving: boolean = false;    // Whether snake is moving
  private animationSpeed: number = 0.15; // Animation speed factor
  // Death animation properties
  private isDying: boolean = false;     // Whether death animation is playing
  private deathProgress: number = 0;    // Death animation progress (0-1)
  private deathReason: string = "";     // Cause of death
  private deathAnimationSpeed: number = 0.05; // Death animation speed
  // Death data
  public deathData: DeathData | null = null;

  constructor(
    position: Position,
    size: number,
    color: string,
    direction: Direction,
    decisionStrategy: SnakeDecisionStrategy,
    metadata: SnakeMetadata = {}
  ) {
    super(position, size);
    this.body = this.initializeBody(position, direction);
    this.lastBody = [...this.body];
    this.direction = direction;
    this.prevDirection = direction;
    this.color = color;
    this.score = 0;
    // Initialize spawn shield
    this.shieldActive = true;
    this.isInitialShieldActive = true;
    this.shieldCooldown = 0;
    this.shieldDuration = GameConfig.SHIELD.INITIAL_DURATION;
    this.justActivatedShield = false; // Initial shield doesn't prevent movement
    this.alive = true;
    this.growthLength = 0;
    this.decisionStrategy = decisionStrategy;
    this.metadata = metadata;
  }

  private initializeBody(position: Position, direction: Direction): Position[] {
    const body: Position[] = [];
    const oppositeDirection = this.getOppositeDirection(direction);
    const directionDelta = this.getDirectionDelta(oppositeDirection);

    for (let i = 0; i < GameConfig.SNAKE.INITIAL_LENGTH; i++) {
      body.push({
        x: position.x + directionDelta.x * i * this.size,
        y: position.y + directionDelta.y * i * this.size,
      });
    }

    return body;
  }

  /**
   * Main update method called each game tick
   */
  async update(_deltaTime: number, gameState: GameState): Promise<void> {
    if (!this.alive && !this.isDying) return;

    // Apply decision strategy if snake is alive
    if(this.alive && !this.isDying) {
      await this.decisionStrategy.makeDecision(this, gameState);
    }

    // Update shield status
    this.updateShield();
  }

  // Set decision strategy
  setDecisionStrategy(strategy: SnakeDecisionStrategy): void {
    this.decisionStrategy = strategy;
  }

  // Get current decision strategy
  getDecisionStrategy(): SnakeDecisionStrategy {
    return this.decisionStrategy;
  }

  // Update animation in game loop
  updateAnimation(deltaTime: number): void {
    // Update movement animation
    if (this.isMoving) {
      // Update based on deltaTime for smooth animation
      this.moveProgress += this.animationSpeed * (deltaTime / 16.67); // 16.67ms is frame time at 60fps

      // Reset state when movement completes
      if (this.moveProgress >= 1) {
        this.moveProgress = 1;
        this.isMoving = false;
      }
    }

    // Update death animation
    if (this.isDying) {
      // Update death progress based on deltaTime
      this.deathProgress += this.deathAnimationSpeed * (deltaTime / 16.67);

      // Mark as fully dead when animation completes
      if (this.deathProgress >= 1) {
        this.deathProgress = 1;
        this.isDying = false;
        this.alive = false; // Actually mark as dead only after animation

        // Trigger death completion event
        eventBus.emit(GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE, this);
      }
    }
  }

  // Flag to track if shield was just activated
  private justActivatedShield: boolean = false;

  /**
   * Move the snake based on current direction
   */
  move(): void {
    // Skip movement on first tick after regular shield activation
    if (this.justActivatedShield && !this.isInitialShieldActive) {
      this.justActivatedShield = false;
      this.shieldDuration--;
      return;
    }

    // Save previous body positions
    this.lastBody = JSON.parse(JSON.stringify(this.body));

    // Calculate new head position
    const newHead = this.calculateNewHead();
    this.prevDirection = this.direction;

    // Check if new head position is out of bounds
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const columns = GameConfig.CANVAS.COLUMNS;
    const rows = GameConfig.CANVAS.ROWS;

    if (
      newHead.x < 0 ||
      newHead.x >= columns * boxSize ||
      newHead.y < 0 ||
      newHead.y >= rows * boxSize
    ) {
      // Mark snake as dead if out of bounds
      this.die("hit wall");
      // Notify game manager
      eventBus.emit(GameEventType.SNAKE_KILL_REQUEST, { snake: this, reason: 'hit wall' });
      return;
    }

    // Add new head position
    this.body.unshift(newHead);

    // Adjust snake length based on score and growth
    const expectedLength =
      Math.floor(this.score / 20) +
      GameConfig.SNAKE.INITIAL_LENGTH +
      this.growthLength;

    while (this.body.length > expectedLength) {
      this.body.pop();
    }

    // Reset animation state for new movement
    this.moveProgress = 0;
    this.isMoving = true;
  }

  private calculateNewHead(): Position {
    const head = this.body[0];
    const delta = this.getDirectionDelta(this.direction);
    return {
      x: head.x + delta.x * this.size,
      y: head.y + delta.y * this.size,
    };
  }

  private getDirectionDelta(direction: Direction): Position {
    switch (direction) {
      case Direction.LEFT:
        return { x: -1, y: 0 };
      case Direction.RIGHT:
        return { x: 1, y: 0 };
      case Direction.UP:
        return { x: 0, y: -1 };
      case Direction.DOWN:
        return { x: 0, y: 1 };
    }
  }

  private getOppositeDirection(direction: Direction): Direction {
    switch (direction) {
      case Direction.LEFT:
        return Direction.RIGHT;
      case Direction.RIGHT:
        return Direction.LEFT;
      case Direction.UP:
        return Direction.DOWN;
      case Direction.DOWN:
        return Direction.UP;
    }
  }

  setDirection(direction: Direction): void {
    if (!this.isOppositeDirection(direction, this.prevDirection)) {
      this.direction = direction;
    }
  }

  private isOppositeDirection(dir1: Direction, dir2: Direction): boolean {
    return (
      (dir1 === Direction.LEFT && dir2 === Direction.RIGHT) ||
      (dir1 === Direction.RIGHT && dir2 === Direction.LEFT) ||
      (dir1 === Direction.UP && dir2 === Direction.DOWN) ||
      (dir1 === Direction.DOWN && dir2 === Direction.UP)
    );
  }

  /**
   * Activate shield if conditions are met
   */
  activateShield(): void;
  activateShield(duration: number, cost: number): void;
  activateShield(duration?: number, cost?: number): void {
    const shieldDuration = duration ?? GameConfig.SHIELD.DURATION;
    const shieldCost = cost ?? GameConfig.SHIELD.COST;
    
    // Check if shield can be activated
    if (!this.shieldActive && this.shieldCooldown <= 0 && this.score >= shieldCost) {
      this.score -= shieldCost;
      this.shieldActive = true;
      this.isInitialShieldActive = false; // Regular shield, not initial
      this.shieldCooldown = GameConfig.SHIELD.COOLDOWN;
      this.shieldDuration = shieldDuration;
      this.justActivatedShield = true; // Mark as just activated
      eventBus.emit(GameEventType.SNAKE_ACTIVATE_SHIELD, this);
    }
  }

  /**
   * Update shield status each tick
   */
  updateShield(): void {
    // Update shield duration if active
    if (this.shieldActive) {
      if (this.shieldDuration > 0) {
        this.shieldDuration--;
      } else {
        // Shield duration ended
        this.shieldActive = false;

        // Reset initial shield flag if needed
        if (this.isInitialShieldActive) {
          this.isInitialShieldActive = false;
        }
      }
    }

    // Only decrease cooldown when shield is not active
    if (!this.shieldActive && this.shieldCooldown > 0) {
      this.shieldCooldown--;
    }
  }

  /**
   * Mark snake as dying and start death animation
   */
  die(reason: string): void {
    if (this.alive && !this.isDying) {
      // Start death animation instead of immediate death
      this.isDying = true;
      this.deathProgress = 0;
      this.deathReason = reason;

      // Clean up decision strategy resources
      if (this.decisionStrategy.cleanup) {
        this.decisionStrategy.cleanup();
      }

      // Emit death animation start event
      eventBus.emit(GameEventType.SNAKE_DEATH_ANIMATION_START, this);
    }
  }

  addScore(value: number): void {
    this.score = Math.max(0, this.score + value);
  }

  addGrowth(length: number): void {
    this.growthLength += length;
  }

  /**
   * Get a copy of the snake's body segments
   */
  getBody(): Position[] {
    return [...this.body];
  }

  /**
   * Get current direction
   */
  getDirection(): Direction {
    return this.direction;
  }

  /**
   * Get previous direction
   */
  getPrevDirection(): Direction {
    return this.prevDirection;
  }

  /**
   * Get current score
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Check if shield is active
   */
  isShieldActive(): boolean {
    return this.shieldActive;
  }

  /**
   * Check if current shield is the initial spawn shield
   */
  isInitialShield(): boolean {
    return this.isInitialShieldActive;
  }

  /**
   * Check if snake is alive and not in death animation
   */
  isAlive(): boolean {
    return this.alive && !this.isDying;
  }

  getColor(): string {
    return this.color;
  }

  getShieldCooldown(): number {
    return this.shieldCooldown;
  }

  getShieldDuration(): number {
    return this.shieldDuration;
  }

  getMetadata(): SnakeMetadata {
    return this.metadata;
  }

  setMetadata(metadata: Partial<SnakeMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  getEntityType(): EntityType {
    return EntityType.SNAKE;
  }

  getLastBody(): Position[] {
    return [...this.lastBody];
  }

  // Get current animation progress
  getMoveProgress(): number {
    return this.moveProgress;
  }

  // Check if currently moving
  isInMotion(): boolean {
    return this.isMoving;
  }

  // Get interpolated body positions for smooth rendering
  getInterpolatedBody(): Position[] {
    // Return current body if not moving or animation completed
    if (!this.isMoving || this.moveProgress >= 1) {
      return this.body;
    }

    // Create interpolated body array
    const interpolatedBody: Position[] = [];

    // Ensure we have valid data for interpolation
    if (this.lastBody.length === 0 || this.body.length === 0) {
      return this.body;
    }

    // Interpolate head from previous to current position
    interpolatedBody.push({
      x: this.lastBody[0].x + (this.body[0].x - this.lastBody[0].x) * this.moveProgress,
      y: this.lastBody[0].y + (this.body[0].y - this.lastBody[0].y) * this.moveProgress
    });

    // Interpolate body segments
    for (let i = 1; i < this.body.length; i++) {
      // Interpolate if segment exists in last frame
      if (i < this.lastBody.length) {
        interpolatedBody.push({
          x: this.lastBody[i].x + (this.body[i].x - this.lastBody[i].x) * this.moveProgress,
          y: this.lastBody[i].y + (this.body[i].y - this.lastBody[i].y) * this.moveProgress
        });
      }
      // Use current position for newly grown segments
      else {
        interpolatedBody.push({...this.body[i]});
      }
    }

    // Handle segments that are disappearing (when snake gets shorter)
    if (this.lastBody.length > this.body.length) {
      const lastTail = this.lastBody[this.body.length]; // First segment to disappear

      // Animate tail disappearing by interpolating toward last body segment
      if (this.body.length > 0 && this.moveProgress < 0.95) { // Show disappearing animation until 95% progress
        const disappearPoint = this.body[this.body.length - 1];
        interpolatedBody.push({
          x: lastTail.x + (disappearPoint.x - lastTail.x) * this.moveProgress,
          y: lastTail.y + (disappearPoint.y - lastTail.y) * this.moveProgress
        });
      }
    }

    return interpolatedBody;
  }

  // Check if death animation is in progress
  isDyingAnimation(): boolean {
    return this.isDying;
  }

  // Get death animation progress
  getDeathProgress(): number {
    return this.deathProgress;
  }

  // Get reason for death
  getDeathReason(): string {
    return this.deathReason;
  }

  // Force death animation to complete
  completeDeathAnimation(): void {
    if (this.isDying) {
      this.deathProgress = 1;
      this.isDying = false;
      this.alive = false;
    }
  }

  /**
   * Serialize snake state for game recording
   */
  serialize(): any {
    return {
      position: this.getPosition(),
      size: this.size,
      // Store actual positions, not interpolated ones
      body: [...this.body], // Deep copy to avoid reference issues
      lastBody: [...this.lastBody], // Deep copy to avoid reference issues
      direction: this.direction,
      prevDirection: this.prevDirection,
      color: this.color,
      score: this.score,
      shieldActive: this.shieldActive,
      shieldCooldown: this.shieldCooldown,
      shieldDuration: this.shieldDuration,
      alive: this.alive,
      growthLength: this.growthLength,
      metadata: this.metadata,
      // Reset animation state for replay
      moveProgress: 1, // 1 means animation is complete
      isMoving: false,
      isDying: this.isDying,
      deathProgress: this.deathProgress,
      deathReason: this.deathReason,
      entityType: this.getEntityType(),
      // Shield-related state
      isInitialShieldActive: this.isInitialShieldActive,
      justActivatedShield: this.justActivatedShield
    };
  }
}