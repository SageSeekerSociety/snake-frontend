import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Position } from "../types/Position";
import { GameConfig } from "../config/GameConfig";
import { User } from "../types/User";
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
import { gameRecordingService } from "../services/gameRecordingService";
import { v4 as uuidv4 } from 'uuid';

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

  private gameInitialized: boolean = false;
  private gameRunning: boolean = false; // Use gameClock.isRunning maybe?
  private selectedUsers: User[]; // Store selected users for game setup
  private animationId: number = 0; // For rendering loop
  private gameSessionId: string = uuidv4();

  // 游戏录制相关属性
  private isRecording: boolean = false;
  private recordingEnabled: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    selectedUsers: User[] = [], // Pass selected users during construction
    options: { enableRecording?: boolean } = {}
  ) {
    this.selectedUsers = selectedUsers;
    this.recordingEnabled = options.enableRecording || false;

    // Initialize core components
    this.canvasManager = new CanvasManager(canvas);
    this.spatialGrid = new SpatialHashGrid(GameConfig.CANVAS.BOX_SIZE * 2); // Example cell size
    this.entityFactory = new EntityFactory();
    
    // Initialize vortex field manager first
    this.vortexFieldManager = new VortexFieldManager();
    
    this.entityManager = new EntityManager(
      this.spatialGrid,
      this.entityFactory,
      this.vortexFieldManager
    );
    
    // Set EntityManager reference in VortexFieldManager after EntityManager is created
    this.vortexFieldManager.setEntityQuery(this.entityManager);
    
    this.foodGenerator = new FoodGenerator(
      this.entityManager,
      this.entityFactory,
      this.vortexFieldManager
    );
    this.collisionDetector = new CollisionDetector(this.vortexFieldManager);
    this.gameClock = new GameClock(GameConfig.TOTAL_TICKS); // Get total ticks from config
    this.inputHandler = new InputHandler(canvas);
    this.decisionCoordinator = new DecisionRequestCoordinator();

    // Initialize recording service if enabled
    if (this.recordingEnabled) {
      gameRecordingService.initialize().catch(error => {
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

  /**
   * Sets up listeners for events that GameManager needs to react to directly.
   */
  private setupGlobalEventListeners(): void {
    // Bind event handlers and store references for later cleanup
    this.boundStartGame = this.startGame.bind(this);
    this.boundHandleGameOver = this.handleGameOver.bind(this);
    this.boundCheckGameOverCondition = this.checkGameOverCondition.bind(this);
    eventBus.on(GameEventType.GAME_START_REQUESTED, this.boundStartGame);
    eventBus.on(GameEventType.GAME_OVER, this.boundHandleGameOver);
    // Listen for cleanup completion to check game over condition again
    eventBus.on(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundCheckGameOverCondition
    );
  }

  /**
   * Prepares the game state for a new round. Clears old entities,
   * creates new ones, and resets the clock. Does not start the game loop.
   */
  prepareGame(): void {
    console.log("Preparing new game...");
    this.gameClock.stop(); // Ensure clock is stopped
    this.entityManager.clear(); // Clear entities and spatial grid
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
    const initialObstacles = this.entityFactory.createCircularWall(6); // Example wall

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
      // 获取当前游戏状态作为初始状态（第0帧）
      const initialGameState = this.entityManager.getGameState();

      gameRecordingService.startRecording(
        this.selectedUsers,
        this.gameClock.getTotalTicks(),
        initialGameState // 传递初始游戏状态
      );
      this.isRecording = true;
      console.log("Game recording started with initial state");
    } catch (error) {
      console.error("Failed to start game recording:", error);
      this.isRecording = false;
    }
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

    const gameState = this.entityManager.getGameState(); // Get current state for decisions

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

    // 4. Handle Phase 1 Collision Results
    this.handleCollisions(collisionResults);

    // 5. Phase 2: Apply Vortex Pull (if active)
    this.applyVortexPull();

    // 6. Phase 2 Collision Detection
    liveSnakes = this.entityManager.getLiveSnakes();
    allSnakes = this.entityManager.getAllSnakes();
    const phase2CollisionResults = this.collisionDetector.detectCollisions(
      liveSnakes,
      allSnakes,
      this.entityManager
    );

    // 7. Handle Phase 2 Collision Results
    this.handleCollisions(phase2CollisionResults);

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
  }

  /**
   * Records the current game state frame
   */
  private recordFrame(tick: number): void {
    if (!this.isRecording) return;

    try {
      const gameState = this.entityManager.getGameState();
      gameRecordingService.recordFrame(tick, gameState);
    } catch (error) {
      console.error("Failed to record game frame:", error);
    }
  }

  /**
   * Applies vortex pull to snakes in the vortex field (Phase 2 movement)
   */
  private applyVortexPull(): void {
    const liveSnakes = this.entityManager.getLiveSnakes();
    
    for (const snake of liveSnakes) {
      const headPosition = snake.getBody()[0];
      const pullVector = this.vortexFieldManager.calculateVortexPull(headPosition);
      
      if (pullVector) {
        // Apply vortex pull movement
        this.applyVortexPullToSnake(snake, pullVector);
        console.log(`[VortexField] Pulled ${snake.getMetadata().name} ${pullVector.direction}`);
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
   * Processes the collision results detected for the current tick.
   */
  private handleCollisions(results: CollisionResult[]): void {
    const foodCollisions = new Map<Snake, Food>(); // Track food eaten per snake per tick

    for (const result of results) {
      switch (result.type) {
        case "wall":
          this.entityManager.killSnake(result.snake, `hit wall`);
          break;
        case "obstacle":
          this.entityManager.killSnake(result.snake, `hit obstacle`);
          break;
        case "snake":
          // 蛇碰撞（头部或身体）
          if (result.collidedWith instanceof Snake) {
            const collidedSnake = result.collidedWith as Snake;
            const collidedSnakeColor = collidedSnake.getColor();
            const collidedSnakeName =
              collidedSnake.getMetadata()?.name ||
              `Snake ${
                this.entityManager.getAllSnakes().indexOf(collidedSnake) + 1
              }`;
            const coloredCollidedSnakeName = `<span style="color: ${collidedSnakeColor}">${collidedSnakeName}</span>`;

            // 检查是否是蛇头对蛇头碰撞
            const isHeadCollision =
              collidedSnake.getBody()[0]?.x === result.position.x &&
              collidedSnake.getBody()[0]?.y === result.position.y;

            if (isHeadCollision) {
              // 蛇头对蛇头碰撞，考虑护盾
              const snakeHasShield = result.snake.isShieldActive();
              const collidedSnakeHasShield = collidedSnake.isShieldActive();
              
              if (snakeHasShield && collidedSnakeHasShield) {
                // 两条蛇都有护盾 -> 都免疫死亡
                console.log(`[SHIELD] Both snakes have shields, both immune to head collision death`);
                // 不杀死任何一条蛇
              } else if (snakeHasShield && !collidedSnakeHasShield) {
                // 只有result.snake有护盾 -> 杀死collidedSnake
                const snakeName =
                  result.snake.getMetadata()?.name ||
                  `Snake ${
                    this.entityManager.getAllSnakes().indexOf(result.snake) + 1
                  }`;
                const snakeColor = result.snake.getColor();
                const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;
                this.entityManager.killSnake(
                  collidedSnake,
                  `hit by shielded ${coloredSnakeName}`
                );
              } else if (!snakeHasShield && collidedSnakeHasShield) {
                // 只有collidedSnake有护盾 -> 杀死result.snake
                this.entityManager.killSnake(
                  result.snake,
                  `hit ${coloredCollidedSnakeName}`
                );
              } else {
                // 两条蛇都没有护盾 -> 两条蛇都死亡
                const snakeName =
                  result.snake.getMetadata()?.name ||
                  `Snake ${
                    this.entityManager.getAllSnakes().indexOf(result.snake) + 1
                  }`;
                const snakeColor = result.snake.getColor();
                const coloredSnakeName = `<span style="color: ${snakeColor}">${snakeName}</span>`;

                this.entityManager.killSnake(
                  result.snake,
                  `hit ${coloredCollidedSnakeName}`
                );
                this.entityManager.killSnake(
                  collidedSnake,
                  `hit ${coloredSnakeName}`
                );
              }
            } else {
              // 蛇头撞到蛇身体，已经在 CollisionDetector 中处理了护盾逻辑
              this.entityManager.killSnake(
                result.snake,
                `hit ${coloredCollidedSnakeName}`
              );
            }
          } else {
            // 如果 collidedWith 不是 Snake 对象，使用通用消息
            this.entityManager.killSnake(result.snake, `hit snake`);
          }
          break;
        case "food":
          // Find the actual food object based on position
          // This is inefficient, ideally CollisionDetector provides the Food object
          const foodPos = result.collidedWith as Position;
          const eatenFood = this.entityManager
            .getAllFoodItems()
            .find(
              (f) =>
                f.getPosition().x === foodPos.x &&
                f.getPosition().y === foodPos.y
            );
          if (eatenFood) {
            // Avoid processing the same food collision multiple times if somehow detected twice
            if (!foodCollisions.has(result.snake)) {
              foodCollisions.set(result.snake, eatenFood);
              this.entityManager.handleFoodEaten(result.snake, eatenFood);
            }
          }
          break;
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
      .map((snake, index) => ({
        name: snake.getMetadata().name || `Snake ${index + 1}`,
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
        outerRadius: 0
      };
    }

    const geometry = status.geometry;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    return {
      status: status.state,
      ticksRemaining: status.ticksRemaining,
      center: {
        x: geometry.centerAnchor.x / boxSize,
        y: geometry.centerAnchor.y / boxSize
      },
      innerRadius: geometry.innerRadius / boxSize,
      outerRadius: geometry.outerRadius / boxSize
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
      ...this.entityManager.getAllSnakes(),
      // Obstacles are pre-rendered, but could be included if dynamic
    ];
    
    // Get current vortex field state for rendering
    const vortexStatus = this.vortexFieldManager.getStatus();
    const vortexState = this.createVortexRenderState(vortexStatus);
    
    this.canvasManager.render(renderables, vortexState, timestamp); // Pass vortex state and timestamp

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

    // Unsubscribe from EventBus listeners
    eventBus.off(GameEventType.GAME_START_REQUESTED, this.boundStartGame);
    eventBus.off(GameEventType.GAME_OVER, this.boundHandleGameOver);
    eventBus.off(
      GameEventType.SNAKE_DEATH_ANIMATION_COMPLETE,
      this.boundCheckGameOverCondition
    );

    // Reset state
    this.gameInitialized = false;
    this.gameRunning = false;
    this.lastRenderTime = 0;
    this.isRecording = false;
  }
}
