import { EventEmitter } from "./EventEmitter"; // Assuming EventEmitter is in the same directory or adjust path

// 定义游戏中所有可能的事件类型
export enum GameEventType {
  GAME_START = "game:start",
  GAME_OVER = "game:over",
  GAME_PAUSE = "game:pause",
  GAME_RESUME = "game:resume",
  GAME_START_REQUESTED = "game:start_requested",
  CHECK_GAME_OVER = "game:check_over",
  SNAKE_DEATH = "snake:death",
  SNAKE_COLLISION = "snake:collision",
  SNAKE_EAT_FOOD = "snake:eat_food",
  SNAKE_ACTIVATE_SHIELD = "snake:activate_shield",
  SNAKE_DEATH_ANIMATION_START = "snake:death_animation_start",
  SNAKE_DEATH_ANIMATION_COMPLETE = "snake:death_animation_complete",
  SNAKE_KILL_REQUEST = "snake:kill_request",
  FOOD_SPAWN = "food:spawn",
  FOOD_COLLECT = "food:collect",
  UI_UPDATE_SCOREBOARD = "ui:update_scoreboard",
  UI_UPDATE_TIMER = "ui:update_timer",
  UI_NOTIFICATION = "ui:notification",
  UI_FINAL_SCORES = "ui:final_scores",
  // 游戏录制相关事件
  GAME_RECORDING_SAVED = "game:recording_saved",
  GAME_RECORDING_COMPLETED = "game:recording_completed",
  // 涡流场相关事件
  VORTEX_FIELD_WARNING = "vortex:field_warning",
  VORTEX_FIELD_ACTIVATED = "vortex:field_activated",
  VORTEX_FIELD_DEACTIVATED = "vortex:field_deactivated",
  VORTEX_FIELD_COOLDOWN_ENDED = "vortex:field_cooldown_ended",
}

// Callback function type
type EventCallback = (...args: any[]) => void;

// Map to store original callbacks and their wrapped versions for debug mode
type CallbackMap = Map<EventCallback, EventCallback>; // Maps original -> wrapped

// 事件总线单例
class EventBus extends EventEmitter {
  private static instance: EventBus;
  private readonly debug: boolean = false; // Debug switch
  // Store wrapped callbacks per event type only when in debug mode
  private wrappedListeners: Map<GameEventType, CallbackMap> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // 重写 emit 方法
  emit(event: GameEventType, ...args: any[]): void {
    if (this.debug) {
      console.log(`[EventBus] Emitting event: ${event}`, args);
    }
    super.emit(event, ...args); // Call the base class emit
  }

  // 重写 on 方法，处理 Debug 模式下的回调包装和存储
  on(event: GameEventType, originalCallback: EventCallback): void {
    if (this.debug) {
      console.log(`[EventBus] Subscribing to event: ${event}`);

      // Get or create the map for this event type
      if (!this.wrappedListeners.has(event)) {
        this.wrappedListeners.set(event, new Map());
      }
      const eventMap = this.wrappedListeners.get(event)!;

      // Check if this exact callback is already wrapped and registered
      if (eventMap.has(originalCallback)) {
        console.warn(`[EventBus] Callback already subscribed for event: ${event}`);
        return; // Avoid double subscription with the same callback
      }

      // Create the wrapped callback for logging
      const wrappedCallback = (...args: any[]) => {
        console.log(`[EventBus] Handling event: ${event}`, args);
        try {
            originalCallback(...args); // Execute the original callback
        } catch (error) {
            console.error(`[EventBus] Error in event handler for ${event}:`, error);
        }
      };

      // Store the mapping: original -> wrapped
      eventMap.set(originalCallback, wrappedCallback);

      // Register the *wrapped* callback with the underlying EventEmitter
      super.on(event, wrappedCallback);

    } else {
      // Not in debug mode, register the original callback directly
      super.on(event, originalCallback);
    }
  }

  // 重写 off 方法，处理 Debug 模式下的回调查找和移除
  off(event: GameEventType, originalCallback: EventCallback): void {
    if (this.debug) {
      console.log(`[EventBus] Attempting to unsubscribe from event: ${event}`);

      const eventMap = this.wrappedListeners.get(event);
      if (eventMap && eventMap.has(originalCallback)) {
        // Find the wrapped callback using the original callback as the key
        const wrappedCallback = eventMap.get(originalCallback);

        if (wrappedCallback) {
          // Remove the *wrapped* callback from the underlying EventEmitter
          super.off(event, wrappedCallback);
          // Remove the mapping
          eventMap.delete(originalCallback);
          console.log(`[EventBus] Successfully unsubscribed wrapped listener for event: ${event}`);
        } else {
          // This case should theoretically not happen if the map is consistent
          console.warn(`[EventBus] Wrapped callback not found for event: ${event}, though mapping existed.`);
          super.off(event, originalCallback); // Try removing original just in case
        }
      } else {
        // Callback wasn't found in the map (maybe never added in debug, or already removed)
        // Still try to remove the original callback directly from EventEmitter,
        // in case it was added when debug mode was off.
        console.log(`[EventBus] No wrapped listener found for event: ${event}. Trying direct removal.`);
        super.off(event, originalCallback);
      }
    } else {
      // Not in debug mode, remove the original callback directly
      super.off(event, originalCallback);
    }
  }
}

// 导出事件总线实例
export const eventBus = EventBus.getInstance();

// Re-export EventEmitter if needed by other parts of the application
// Assuming EventEmitter is in the same directory or adjust path if needed
export { EventEmitter } from "./EventEmitter";
