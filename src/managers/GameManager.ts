import { Snake } from "../entities/Snake";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { Position } from "../types/Position";
import { GameConfig } from "../config/GameConfig";
import { Player } from "../types/User";
import { GameState } from "../types/GameState";
import { eventBus, GameEventType } from "../core/EventBus";
import { CanvasManager } from "./CanvasManager";
import { SpatialHashGrid } from "../core/SpatialHashGrid";
import { EntityManager } from "./EntityManager";
import { EntityFactory } from "../factories/EntityFactory";
import { FoodGenerator } from "../services/FoodGenerator";
import { GameClock } from "../core/GameClock";
import { CollisionDetector, CollisionResult } from "../core/CollisionDetector";
import { InputHandler } from "./InputHandler";
import { DecisionRequestCoordinator } from "../core/DecisionRequestCoordinator";
import { VortexFieldManager } from "./VortexFieldManager";
import { TreasureSystem } from "./TreasureSystem";
import { SafeZoneManager } from "./SafeZoneManager";
import { gameRecordingService } from "../services/gameRecordingService";
import { v4 as uuidv4 } from "uuid";
import { Obstacle } from "../entities/Obstacle";
import {
  createSnakePlaceholder,
  getSnakeDisplayName,
} from "../utils/snakeDisplayUtils";
import { Random } from "../utils/Random";

/**
 * Orchestrates the overall game flow, managing different subsystems.
 */
export class GameManager {
  private canvasManager: CanvasManager;
  private spatialGrid: SpatialHashGrid;
  private entityManager: EntityManager;
  private entityFactory: EntityFactory;
  private foodGenerator: FoodGenerator;
  private gameClock: GameClock;
  private collisionDetector: CollisionDetector;
  private inputHandler: InputHandler;
  private decisionCoordinator: DecisionRequestCoordinator;
  private vortexFieldManager: VortexFieldManager;
  private treasureSystem: TreasureSystem;
  private safeZoneManager: SafeZoneManager;

  private gameInitialized: boolean = false;
  private gameRunning: boolean = false; // Use gameClock.isRunning maybe?
  private selectedUsers: Player[]; // Store selected users for game setup
  private animationId: number = 0; // For rendering loop
  private gameSessionId: string = uuidv4();

  // 游戏录制相关属性
  private isRecording: boolean = false;
  private recordingEnabled: boolean = false;
  private rng: Random;
  private gameSeed: string;
  private recordingName?: string;

  constructor(
    canvas: HTMLCanvasElement,
    selectedUsers: Player[] = [], // Pass selected users during construction
    options: { enableRecording?: boolean; seed?: number | string; streamId?: number; recordingName?: string } = {}
  ) {
    this.selectedUsers = selectedUsers;
    this.recordingEnabled = options.enableRecording || false;
    const seedInput = options.seed ?? 42;
    this.rng = new Random(seedInput, options.streamId ?? 54);
    this.gameSeed = typeof seedInput === 'string' ? seedInput : String(seedInput);
    this.recordingName = options.recordingName;

    // Initialize core components
    this.canvasManager = new CanvasManager(canvas);
    this.spatialGrid = new SpatialHashGrid(GameConfig.CANVAS.BOX_SIZE * 2); // Example cell size
    this.entityFactory = new EntityFactory();

    // Initialize vortex field manager first
    this.vortexFieldManager = new VortexFieldManager(this.rng);

    this.entityManager = new EntityManager(
      this.spatialGrid,
      this.entityFactory,
      this.vortexFieldManager
    );

    // Set EntityManager reference in VortexFieldManager after EntityManager is created
    this.vortexFieldManager.setEntityQuery(this.entityManager);

    this.safeZoneManager = new SafeZoneManager();
    this.foodGenerator = new FoodGenerator(
      this.entityManager,
      this.entityFactory,
      this.vortexFieldManager,
      this.safeZoneManager,
      this.rng
    );
    this.collisionDetector = new CollisionDetector(this.vortexFieldManager);
    this.gameClock = new GameClock(GameConfig.TOTAL_TICKS); // Get total ticks from config
    this.inputHandler = new InputHandler(canvas);
    this.decisionCoordinator = new DecisionRequestCoordinator();
    this.treasureSystem = new TreasureSystem(
      this.entityManager,
      this.safeZoneManager,
      undefined,
      this.rng
    );

    // Initialize recording service if enabled
    if (this.recordingEnabled) {
      gameRecordingService.initialize().catch((error) => {
        console.error("Failed to initialize game recording service:", error);
        this.recordingEnabled = false;
      });
    }

    this.setupGlobalEventListeners();

    // Prepare initial game state (but don't start clock yet)
    this.prepareGame();

    // Start the rendering loop immediately to show the initial state
    this.renderLoop(performance.now());
  }

  // Bound event handlers for proper cleanup
  private boundStartGame!: () => void;
  private boundHandleGameOver!: () => void;
  private boundCheckGameOverCondition!: (snake: Snake) => void;
  private boundHandleTreasureSpawned!: (data: {
    treasure: TreasureChest;
    keys: Key[];
  }) => void;
  private boundHandleTreasureReplaced!: (data: {
    oldTreasure?: TreasureChest;
    oldKeys?: Key[];
    treasure: TreasureChest;
    keys: Key[];
  }) => void;
  private boundHandleKeyDropped!: (data: { key: Key; snake: Snake }) => void;
  private boundHandleKeyRemoved!: (data: { key: Key }) => void;

  /**
   * Sets up listeners for events that GameManager needs to react to directly.
   */
  private setupGlobalEventListeners(): void {
    // Bind event handlers and store references for later cleanup
    this.boundStartGame = this.startGame.bind(this);
    this.boundHandleGameOver = this.handleGameOver.bind(this);
    this.boundCheckGameOverCondition = this.checkGameOverCondition.bind(this);
    this.boundHandleTreasureSpawned = this.handleTreasureSpawned.bind(this);
    this.boundHandleTreasureReplaced = this.handleTreasureReplaced.bind(this);
    this.boundHandleKeyDropped = this.handleKeyDropped.bind(this);
    this.boundHandleKeyRemoved = this.handleKeyRemoved.bind(this);

    eventBus.on(GameEventType.GAME_START_REQUESTED, this.boundStartGame);
    eventBus.on(GameEventType.GAME_OVER, this.boundHandleGameOver);
    // Listen for cleanup completion to check game over condition again
    eventBus.on(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundCheckGameOverCondition
    );

    // Treasure system event handlers
    eventBus.on(
      GameEventType.TREASURE_SPAWNED,
      this.boundHandleTreasureSpawned
    );
    eventBus.on(
      GameEventType.TREASURE_REPLACED,
      this.boundHandleTreasureReplaced
    );
    eventBus.on(GameEventType.KEY_DROPPED, this.boundHandleKeyDropped);
    eventBus.on(GameEventType.KEY_REMOVED, this.boundHandleKeyRemoved);
  }

  /**
   * Prepares the game state for a new round. Clears old entities,
   * creates new ones, and resets the clock. Does not start the game loop.
   */
  prepareGame(): void {
    console.log("Preparing new game...");
    this.gameClock.stop(); // Ensure clock is stopped
    this.entityManager.clear(); // Clear entities and spatial grid
    this.treasureSystem.reset(); // Reset treasure system state
    this.safeZoneManager.reset(); // Reset safe zone to initial state
    this.gameSessionId = uuidv4();
    console.log(`New game session started with ID: ${this.gameSessionId}`);

    // Create initial entities using the factory
    // Pass the clock's getRemainingTicks method to the factory for API strategy
    const initialSnakes = this.entityFactory.createInitialSnakes(
      this.selectedUsers,
      this.gameClock,
      this.decisionCoordinator,
      this.gameSessionId
    );
    // const initialObstacles = this.entityFactory.createCircularWall(6); // Example wall
    const initialObstacles: Obstacle[] = []; // Example wall

    // First add obstacles to the entity manager so food generation can check for them
    this.entityManager.initializeEntities([], initialObstacles, []);

    // Now generate food, which will check for obstacle positions
    const initialFood = this.foodGenerator.generateInitialFood(10); // Example initial food count

    // Update the entity manager with all entities
    this.entityManager.clear(); // Clear the temporary state
    this.entityManager.initializeEntities(
      initialSnakes,
      initialObstacles,
      initialFood
    );

    // If there's a designated player snake, set its strategy in InputHandler
    // Assuming the first snake is API/Player controlled
    const playerSnake = initialSnakes.length > 0 ? initialSnakes[0] : null;
    if (playerSnake) {
      const playerStrategy = this.entityFactory.getPlayerStrategy(); // Get the shared strategy instance
      // Ensure the first snake actually USES the player strategy if needed
      // playerSnake.setDecisionStrategy(playerStrategy); // Might need this adjustment in Snake or Factory
      this.inputHandler.setPlayerStrategy(playerStrategy);
    }

    // Pre-render static obstacles for performance
    this.canvasManager.renderObstacles(initialObstacles);

    this.gameInitialized = true;
    this.gameRunning = false;

    // Update UI for the initial state
    eventBus.emit(
      GameEventType.UI_UPDATE_SCOREBOARD,
      this.entityManager.getAllSnakes()
    );
    eventBus.emit(
      GameEventType.UI_UPDATE_TIMER,
      this.gameClock.getTotalTicks()
    ); // Show total ticks initially

    console.log("Game prepared. Ready to start.");
  }

  /**
   * Starts the game clock, which drives the game ticks.
   */
  startGame(): void {
    if (this.gameRunning) return; // Already running
    if (!this.gameInitialized) {
      console.warn("Game not initialized, preparing first...");
      this.prepareGame();
    }

    console.log("Starting game...");
    this.gameRunning = true;

    // Start recording if enabled
    if (this.recordingEnabled) {
      this.startRecording();
    }

    this.gameClock.start(this.updateTick.bind(this)); // Start the clock with the update function
    eventBus.emit(GameEventType.GAME_START);
  }

  /**
   * Starts recording the game session
   */
  private startRecording(): void {
    if (!this.recordingEnabled) return;

    try {
      // 组装完整的初始游戏状态（第0帧）
      const initialGameState = this.assembleGameStateForRecording();

      // Initial treasure data is handled by treasure system internally

      gameRecordingService.startRecording(
        this.selectedUsers,
        this.gameClock.getTotalTicks(),
        initialGameState,
        { seed: this.gameSeed, name: this.recordingName }
      );
      this.isRecording = true;
    } catch (error) {
      console.error("Failed to start game recording:", error);
      this.isRecording = false;
    }
  }

  /**
   * Assembles complete GameState from subsystems
   */
  private assembleGameState(): GameState {
    const entityState = this.entityManager.getEntityState();
    const vortexFieldData = this.vortexFieldManager.getApiData();
    const currentTick = this.gameClock.getCurrentTick();

    return {
      entities: entityState,
      vortexField: vortexFieldData,
      safeZone: this.safeZoneManager.getAlgorithmInfo(currentTick),
    };
  }

  /**
   * Assembles complete GameState from subsystems
   */
  private assembleGameStateForRecording(): GameState {
    const entityState = this.entityManager.getEntityState();
    const vortexFieldData = this.vortexFieldManager.getApiData();
    const currentTick = this.gameClock.getCurrentTick();

    return {
      entities: entityState,
      vortexField: vortexFieldData,
      safeZone: this.safeZoneManager.serialize(currentTick),
    };
  }

  /**
   * The main game logic function called each tick by the GameClock.
   */
  private async updateTick(): Promise<void> {
    if (!this.gameRunning) return; // Should not happen if clock is running, but safety check

    const currentTick =
      this.gameClock.getTotalTicks() - this.gameClock.getRemainingTicks();

    // 0. Update Vortex Field State
    this.vortexFieldManager.update(currentTick);

    // 0.25. Update Safe Zone System
    this.safeZoneManager.update(currentTick);

    // 0.5. Update Treasure System
    this.treasureSystem.update(currentTick);

    // Assemble complete game state with all system information
    const gameState = this.assembleGameState();

    // 1. Gather Decisions (Asynchronous)
    await this.entityManager.getAllSnakeDecisions(gameState);

    // 2. Phase 1: Apply Player Decisions & Move Entities
    this.entityManager.applyDecisionsAndMoveSnakes();

    // 3. Phase 1 Collision Detection
    let liveSnakes = this.entityManager.getLiveSnakes();
    let allSnakes = this.entityManager.getAllSnakes();
    let collisionResults = this.collisionDetector.detectCollisions(
      liveSnakes,
      allSnakes,
      this.entityManager
    );

    // 4. Handle Phase 1 Collision Results - but allow visual collision first
    this.handleCollisionsWithDelay(collisionResults);

    // 5. Phase 2: Apply Vortex Pull (if active) - only to snakes not in death animation
    this.applyVortexPull();

    // 6. Phase 2 Collision Detection - only for snakes not dying
    liveSnakes = this.entityManager
      .getLiveSnakes()
      .filter((snake) => !snake.isDyingAnimation());
    allSnakes = this.entityManager.getAllSnakes();
    const phase2CollisionResults = this.collisionDetector.detectCollisions(
      liveSnakes,
      allSnakes,
      this.entityManager
    );

    // 7. Handle Phase 2 Collision Results
    this.handleCollisionsWithDelay(phase2CollisionResults);

    // 7.5. Check Safe Zone Violations
    this.checkSafeZoneViolations();

    // 8. Generate Periodic Food (with vortex field priority)
    const newFood = this.foodGenerator.generatePeriodicFood(currentTick);
    newFood.forEach((food) => this.entityManager.addFood(food));

    // 9. Update Food Lifecycles
    this.entityManager.updateFoodLifecycles();

    // 10. Record the current frame if recording is enabled
    if (this.isRecording) {
      this.recordFrame(currentTick);
    }

    // Note: Rendering happens in a separate loop (renderLoop)
    // Game over condition is checked by GameClock (ticks run out)
    // or after snake death cleanup
    // Treasure system interactions are handled via collision detection
  }

  /**
   * Records the current game state frame
   */
  private recordFrame(tick: number): void {
    if (!this.isRecording) return;

    try {
      // Assemble complete game state
      const gameState = this.assembleGameStateForRecording();

      console.log(`Recording frame at tick ${tick}`);

      gameRecordingService.recordFrame(
        tick,
        gameState,
        this.safeZoneManager.serialize(this.gameClock.getCurrentTick())
      );
    } catch (error) {
      console.error("Failed to record game frame:", error);
    }
  }

  /**
   * Checks if any snakes are outside the safe zone and kills them
   */
  private checkSafeZoneViolations(): void {
    const liveSnakes = this.entityManager
      .getLiveSnakes()
      .filter((snake) => !snake.isDyingAnimation());

    for (const snake of liveSnakes) {
      const headPosition = snake.getBody()[0];

      if (!this.safeZoneManager.isPositionSafe(headPosition)) {
        // Allow snake to remain outside the safe zone while shield is active
        if (snake.isShieldActive()) {
          continue;
        }

        const snakeName = getSnakeDisplayName(
          snake,
          this.entityManager.getAllSnakes()
        );
        console.log(
          `[SafeZone] ${snakeName} violated safe zone at (${Math.floor(
            headPosition.x / 20
          )}, ${Math.floor(headPosition.y / 20)})`
        );
        // Handle treasure drop and delegate death handling to EntityManager
        this.treasureSystem.handleSnakeDeath(snake);
        this.entityManager.killSnake(snake, "left the safe zone");
      }
    }
  }

  /**
   * Applies vortex pull to snakes in the vortex field (Phase 2 movement)
   */
  private applyVortexPull(): void {
    // Only apply vortex pull to snakes that are alive and not in death animation
    const liveSnakes = this.entityManager
      .getLiveSnakes()
      .filter((snake) => !snake.isDyingAnimation());

    for (const snake of liveSnakes) {
      const headPosition = snake.getBody()[0];
      const pullVector =
        this.vortexFieldManager.calculateVortexPull(headPosition);

      if (pullVector) {
        // Apply vortex pull movement
        this.applyVortexPullToSnake(snake, pullVector);
        const displayName = getSnakeDisplayName(
          snake,
          this.entityManager.getAllSnakes()
        );
        console.log(
          `[VortexField] Pulled ${displayName} ${pullVector.direction}`
        );
      }
    }
  }

  /**
   * Applies vortex pull movement to a single snake
   */
  private applyVortexPullToSnake(snake: Snake, pullVector: any): void {
    const currentBody = [...snake.getBody()];
    const head = currentBody[0];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    // Calculate new head position based on pull direction
    let newHead: Position;
    switch (pullVector.direction) {
      case "left":
        newHead = { x: head.x - boxSize, y: head.y };
        break;
      case "right":
        newHead = { x: head.x + boxSize, y: head.y };
        break;
      case "up":
        newHead = { x: head.x, y: head.y - boxSize };
        break;
      case "down":
        newHead = { x: head.x, y: head.y + boxSize };
        break;
      default:
        return; // Invalid direction
    }

    // Create new body with pulled head
    const newBody = [newHead, ...currentBody];

    // Remove tail (no growth from vortex pull)
    newBody.pop();

    // Update snake's body through reflection (accessing private property)
    // This is needed because Snake doesn't expose a direct method to set body
    (snake as any).body = newBody;

    // Update spatial grid for the moved segments
    // This would need to be handled by EntityManager, but for now we'll let
    // the next regular movement update handle it
  }

  /**
   * Processes collision results with visual delay for better user experience.
   * Allows players to see the collision moment before death animation starts.
   */
  private handleCollisionsWithDelay(results: CollisionResult[]): void {
    // For fatal collisions, start death animation immediately (but keep snake alive during animation)
    // For non-fatal collisions (food, key, treasure), handle immediately
    for (const result of results) {
      if (
        result.type === "food" ||
        result.type === "key" ||
        result.type === "treasure_chest"
      ) {
        // Handle non-fatal collisions immediately - no delay needed
        this.handleSingleCollision(result);
      } else {
        // For fatal collisions, start death animation immediately
        // This allows the visual collision to be seen before the snake disappears
        this.handleFatalCollisionWithAnimation(result);
      }
    }
  }

  /**
   * Handles a fatal collision by delegating to EntityManager
   */
  private handleFatalCollisionWithAnimation(result: CollisionResult): void {
    // Don't kill snakes that are already dying
    if (!result.snake.isAlive() || result.snake.isDyingAnimation()) {
      return;
    }

    let deathReason = "";

    switch (result.type) {
      case "wall":
        deathReason = "hit wall";
        break;
      case "obstacle":
        deathReason = "hit obstacle";
        break;
      case "treasure_fatal":
        deathReason = "hit treasure without key";
        break;
      case "snake":
        if (result.collidedWith instanceof Snake) {
          const collidedSnake = result.collidedWith as Snake;
          const collidedSnakePlaceholder =
            createSnakePlaceholder(collidedSnake);

          // Check for head-to-head collision
          const isHeadCollision =
            collidedSnake.getBody()[0]?.x === result.position.x &&
            collidedSnake.getBody()[0]?.y === result.position.y;

          if (isHeadCollision) {
            // Handle shield logic for head-to-head collisions
            const snakeHasShield = result.snake.isShieldActive();
            const collidedSnakeHasShield = collidedSnake.isShieldActive();

            if (snakeHasShield && collidedSnakeHasShield) {
              // Both have shields, no death
              return;
            } else if (snakeHasShield && !collidedSnakeHasShield) {
              // Only result.snake has shield, kill the other snake
              const currentSnakePlaceholder = createSnakePlaceholder(
                result.snake
              );
              const otherReason = `hit by shielded ${currentSnakePlaceholder}`;
              // Handle treasure drop before killing
              this.treasureSystem.handleSnakeDeath(collidedSnake);
              this.entityManager.killSnake(collidedSnake, otherReason);
              return;
            } else if (!snakeHasShield && collidedSnakeHasShield) {
              // Only collidedSnake has shield, kill result.snake
              deathReason = `hit ${collidedSnakePlaceholder}`;
            } else {
              // Neither has shields, both die
              deathReason = `hit ${collidedSnakePlaceholder}`;
              const currentSnakePlaceholder = createSnakePlaceholder(
                result.snake
              );
              const otherReason = `hit ${currentSnakePlaceholder}`;
              // Handle treasure drop for both snakes
              this.treasureSystem.handleSnakeDeath(collidedSnake);
              this.entityManager.killSnake(collidedSnake, otherReason);
            }
          } else {
            deathReason = `hit ${collidedSnakePlaceholder}`;
          }
        } else {
          deathReason = "hit snake";
        }
        break;
      default:
        deathReason = "unknown collision";
    }

    // Handle treasure drop and delegate death handling to EntityManager
    this.treasureSystem.handleSnakeDeath(result.snake);
    this.entityManager.killSnake(result.snake, deathReason);
  }

  /**
   * Handles a single collision (food, key, treasure)
   */
  private handleSingleCollision(result: CollisionResult): void {
    if (result.type === "food") {
      // Find the actual food object based on position
      const foodPos = result.collidedWith as Position;
      const eatenFood = this.entityManager
        .getAllFoodItems()
        .find(
          (f) =>
            f.getPosition().x === foodPos.x && f.getPosition().y === foodPos.y
        );
      if (eatenFood) {
        this.entityManager.handleFoodEaten(result.snake, eatenFood);
      }
    } else if (result.type === "key") {
      // Handle key pickup
      const keyPos = result.collidedWith as Position;
      const key = this.entityManager
        .getAllKeys()
        .find(
          (k) =>
            k.getPosition().x === keyPos.x && k.getPosition().y === keyPos.y
        );
      if (key && this.treasureSystem.handleKeyPickup(result.snake, key)) {
        this.entityManager.removeKey(key);
      }
    } else if (result.type === "treasure_chest") {
      // Handle treasure opening attempt
      const treasurePos = result.collidedWith as Position;
      const treasure = this.entityManager
        .getAllTreasureChests()
        .find(
          (t) =>
            t.getPosition().x === treasurePos.x &&
            t.getPosition().y === treasurePos.y
        );
      if (
        treasure &&
        this.treasureSystem.handleTreasureOpening(result.snake, treasure)
      ) {
        // Treasure was successfully opened - remove it immediately to prevent double collision
        this.entityManager.removeTreasureChest(treasure);
      }
    }
  }

  /**
   * Checks if the game should end based on remaining live snakes.
   */
  private checkGameOverCondition(): void {
    // Check after a snake's death animation/cleanup is complete
    if (this.gameRunning && this.entityManager.getLiveSnakes().length <= 0) {
      // Game ends if 1 or 0 snakes remain (adjust based on rules)
      console.log("Game Over: No snakes remaining.");
      this.gameClock.stop(); // Stop the clock

      // 清理所有蛇的决策策略资源
      const allSnakes = this.entityManager.getAllSnakes();
      for (const snake of allSnakes) {
        if (snake.isAlive()) {
          const strategy = snake.getDecisionStrategy();
          if (strategy && typeof strategy.cleanup === "function") {
            strategy.cleanup();
          }
        }
      }

      eventBus.emit(GameEventType.GAME_OVER); // Trigger game over sequence
    }
  }

  /**
   * Handles the game over event triggered by the clock or other conditions.
   */
  private handleGameOver(): void {
    if (!this.gameRunning && !this.gameInitialized) return; // Avoid duplicate calls

    console.log("Game Over sequence initiated.");
    this.gameRunning = false;
    this.gameInitialized = false; // Requires prepareGame before next start

    // Stop the game clock explicitly if it wasn't already stopped
    this.gameClock.stop();

    // Cancel the rendering loop
    cancelAnimationFrame(this.animationId);

    // Calculate and display final scores
    const finalScores = this.entityManager
      .getAllSnakes()
      .map((snake) => ({
        name: getSnakeDisplayName(snake, this.entityManager.getAllSnakes()),
        username: snake.getMetadata().username || ``,
        score: snake.getScore(),
        isAlive: snake.isAlive(), // Check final status
      }))
      .sort((a, b) => b.score - a.score); // Sort descending by score

    console.log("Final Scores:", finalScores);
    eventBus.emit(GameEventType.UI_FINAL_SCORES, finalScores); // Use a specific event for final scores

    // 如果正在录制，设置最终得分但不自动保存
    if (this.isRecording) {
      this.setRecordingFinalScores(finalScores);
    }

    // Optionally dispose resources like input handler if GameManager itself is destroyed
    // this.inputHandler.dispose();
  }

  /**
   * 设置录制的最终得分，但不保存
   */
  private setRecordingFinalScores(finalScores: any[]): void {
    if (!this.isRecording) return;

    try {
      // 将最终得分设置到录制服务中
      gameRecordingService.setFinalScores(finalScores);

      // 发出事件通知UI录制已完成但未保存
      eventBus.emit(GameEventType.GAME_RECORDING_COMPLETED);
    } catch (error) {
      console.error("Failed to set final scores for recording:", error);
    }
  }

  /**
   * 保存当前录制
   */
  public async saveCurrentRecording(): Promise<void> {
    if (!this.isRecording) return;

    try {
      const recordingId = await gameRecordingService.saveCurrentRecording();
      this.isRecording = false;

      if (recordingId) {
        console.log("Game recording saved successfully:", recordingId);
        // Emit event to notify UI that a recording is available
        eventBus.emit(GameEventType.GAME_RECORDING_SAVED, recordingId);
      }
    } catch (error) {
      console.error("Failed to save recording:", error);
    }
  }

  /**
   * 停止录制并丢弃
   */
  public discardCurrentRecording(): void {
    if (!this.isRecording) return;

    gameRecordingService.discardCurrentRecording();
    this.isRecording = false;
    console.log("Game recording discarded");
  }

  /**
   * Creates a vortex field render state from the manager status
   */
  private createVortexRenderState(status: any): any {
    if (!status.geometry) {
      return {
        status: status.state,
        ticksRemaining: status.ticksRemaining,
        center: null,
        innerRadius: 0,
        outerRadius: 0,
      };
    }

    const geometry = status.geometry;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    return {
      status: status.state,
      ticksRemaining: status.ticksRemaining,
      center: {
        x: geometry.centerAnchor.x / boxSize,
        y: geometry.centerAnchor.y / boxSize,
      },
      innerRadius: geometry.innerRingRadius, // These are already in grid units!
      outerRadius: geometry.outerRingRadius, // These are already in grid units!
    };
  }

  /**
   * The main rendering loop, independent of the game logic ticks.
   */
  private renderLoop(timestamp: number): void {
    const deltaTime = timestamp - (this.lastRenderTime || timestamp);
    this.lastRenderTime = timestamp;

    // Update animations based on delta time
    if (this.gameRunning || this.gameInitialized) {
      // Update animations even if paused/preparing
      this.entityManager.updateAnimations(deltaTime);
    }

    // Render the current state
    const renderables = [
      ...this.entityManager.getAllFoodItems(),
      ...this.entityManager.getAllTreasureChests(),
      ...this.entityManager.getAllKeys(),
      ...this.entityManager.getAllSnakes(),
      // Obstacles are pre-rendered, but could be included if dynamic
    ];

    // Get current vortex field state for rendering
    const vortexStatus = this.vortexFieldManager.getStatus();
    const vortexState = this.createVortexRenderState(vortexStatus);

    // Get current safe zone state for rendering
    const safeZoneStatus = this.safeZoneManager.getStatus(
      this.gameClock.getCurrentTick()
    );

    this.canvasManager.render(
      renderables,
      vortexState,
      timestamp,
      safeZoneStatus
    ); // Pass both states

    // Display appropriate overlays
    if (!this.gameRunning && this.gameInitialized) {
      this.canvasManager.drawStartScreen(); // Or "Paused" screen
    } else if (!this.gameRunning && !this.gameInitialized) {
      this.canvasManager.drawGameOverScreen();
    }

    // Request next frame
    this.animationId = requestAnimationFrame(this.renderLoop.bind(this));
  }
  private lastRenderTime: number = 0; // Helper for renderLoop deltaTime

  // --- Treasure System Event Handlers ---

  /**
   * Handles treasure and keys being spawned by the treasure system
   */
  private handleTreasureSpawned(data: {
    treasure: TreasureChest;
    keys: Key[];
  }): void {
    // Add treasure to entity manager
    if (data.treasure) {
      this.entityManager.addTreasureChest(data.treasure);
    }

    // Add keys to entity manager
    if (data.keys && Array.isArray(data.keys)) {
      data.keys.forEach((key) => {
        this.entityManager.addKey(key);
      });
    }

    console.log(
      `[GameManager] Added treasure and ${data.keys?.length || 0} keys to game`
    );
  }

  /**
   * Handles replacing an existing treasure and its keys with a new set
   */
  private handleTreasureReplaced(data: {
    oldTreasure?: TreasureChest;
    oldKeys?: Key[];
    treasure: TreasureChest;
    keys: Key[];
  }): void {
    // Remove old entities if provided
    if (data.oldTreasure) {
      this.entityManager.removeTreasureChest(data.oldTreasure);
    }
    if (data.oldKeys && Array.isArray(data.oldKeys)) {
      data.oldKeys.forEach((k) => this.entityManager.removeKey(k));
    }

    // Add new ones
    if (data.treasure) {
      this.entityManager.addTreasureChest(data.treasure);
    }
    if (data.keys && Array.isArray(data.keys)) {
      data.keys.forEach((k) => this.entityManager.addKey(k));
    }

    console.log(
      `[GameManager] Replaced treasure and keys (added ${
        data.keys?.length || 0
      } keys)`
    );
  }

  /**
   * Handles a key being dropped (either by timeout or death)
   */
  private handleKeyDropped(data: { key: Key; snake: Snake }): void {
    if (data.key) {
      this.entityManager.addKey(data.key);
      console.log(
        `[GameManager] Key dropped by ${
          data.snake?.getMetadata()?.name || "unknown snake"
        }`
      );
    }
  }

  /**
   * Handles a key being removed from the game
   */
  private handleKeyRemoved(data: { key: Key }): void {
    if (data.key) {
      this.entityManager.removeKey(data.key);
      console.log(`[GameManager] Key removed from game`);
    }
  }

  // --- Cleanup ---
  dispose(): void {
    console.log("Disposing GameManager...");

    // Stop game clock and rendering loop
    this.gameClock.stop();
    cancelAnimationFrame(this.animationId);

    // 如果正在录制，丢弃录制
    if (this.isRecording) {
      this.discardCurrentRecording();
    }

    // Clean up components
    this.inputHandler.dispose();
    this.entityManager.dispose();
    this.decisionCoordinator.cleanup();
    this.vortexFieldManager.dispose();
    this.treasureSystem.dispose();
    this.safeZoneManager.dispose();

    // Unsubscribe from EventBus listeners
    eventBus.off(GameEventType.GAME_START_REQUESTED, this.boundStartGame);
    eventBus.off(GameEventType.GAME_OVER, this.boundHandleGameOver);
    eventBus.off(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundCheckGameOverCondition
    );

    // Treasure system event cleanup
    eventBus.off(
      GameEventType.TREASURE_SPAWNED,
      this.boundHandleTreasureSpawned
    );
    eventBus.off(GameEventType.KEY_DROPPED, this.boundHandleKeyDropped);
    eventBus.off(GameEventType.KEY_REMOVED, this.boundHandleKeyRemoved);

    // Reset state
    this.gameInitialized = false;
    this.gameRunning = false;
    this.lastRenderTime = 0;
    this.isRecording = false;
  }
}
