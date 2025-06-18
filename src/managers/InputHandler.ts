import { Direction } from "../config/GameConfig";
import { PlayerDecisionStrategy } from "../strategies/SnakeDecisionStrategies"; // Adjust path
import { eventBus, GameEventType } from "../core/EventBus";

/**
 * Handles user input (keyboard, mouse clicks) and translates it into game actions.
 */
export class InputHandler {
  private playerStrategy: PlayerDecisionStrategy | null = null;
  private canvasElement: HTMLCanvasElement;
  private gameIsRunning: boolean = false; // Track game state locally
  private boundHandleGameStart: () => void;
  private boundHandleGameOver: () => void;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvasElement = canvasElement;
    this.setupEventListeners();

    this.boundHandleGameStart = this.handleGameStart.bind(this);
    this.boundHandleGameOver = this.handleGameOver.bind(this);
    // Listen to game state changes from EventBus
    eventBus.on(GameEventType.GAME_START, this.boundHandleGameStart);
    eventBus.on(GameEventType.GAME_OVER, this.boundHandleGameOver);
    // Add listeners for PAUSE/RESUME if needed
  }

  private handleGameStart(): void {
    this.gameIsRunning = true;
  }

  private handleGameOver(): void {
    this.gameIsRunning = false;
  }

  /**
   * Sets the PlayerDecisionStrategy instance to control.
   * This is needed if a specific snake instance is designated as the player.
   */
  setPlayerStrategy(strategy: PlayerDecisionStrategy): void {
    this.playerStrategy = strategy;
  }

  // Bound event handlers for proper cleanup
  private boundHandleKeyDown!: (event: KeyboardEvent) => void;
  private boundHandleCanvasClick!: () => void;

  private setupEventListeners(): void {
    // Bind event handlers and store references for later cleanup
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleCanvasClick = this.handleCanvasClick.bind(this);
    document.addEventListener("keydown", this.boundHandleKeyDown);
    this.canvasElement.addEventListener("click", this.boundHandleCanvasClick);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.gameIsRunning || !this.playerStrategy) return;

    let direction: Direction | null = null;
    let activateShield = false;

    switch (event.keyCode) {
      case 37: direction = Direction.LEFT; break; // Left Arrow
      case 38: direction = Direction.UP; break;   // Up Arrow
      case 39: direction = Direction.RIGHT; break; // Right Arrow
      case 40: direction = Direction.DOWN; break;  // Down Arrow
      case 32: activateShield = true; break;       // Spacebar
      // Add other keybinds if needed (e.g., for other skills)
    }

    if (direction !== null) {
      // Set direction intent in the player strategy
      this.playerStrategy.setInputDirection(direction);
      console.log(`InputHandler: Direction set to ${direction}`);
    } else if (activateShield) {
      // Set shield activation intent in the player strategy
      this.playerStrategy.setInputShield(true);
      console.log("InputHandler: Shield activation requested");
    }
  }

  private handleCanvasClick(): void {
    // Simple click handler: If game is not running, emit a start request.
    // If game is over, emit a restart request.
    if (!this.gameIsRunning) {
       console.log("InputHandler: Canvas clicked, requesting game start/restart.");
       // GameManager should listen for this event to start/prepare the game
       eventBus.emit(GameEventType.GAME_START_REQUESTED); // Use a specific event
    }
  }

  dispose(): void {
    // Remove event listeners
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    this.canvasElement.removeEventListener("click", this.boundHandleCanvasClick);

    // Unsubscribe from EventBus events
    eventBus.off(GameEventType.GAME_START, this.boundHandleGameStart);
    eventBus.off(GameEventType.GAME_OVER, this.boundHandleGameOver);

    // Reset state
    this.playerStrategy = null;
    this.gameIsRunning = false;

    console.log("InputHandler disposed.");
  }
}