// Assuming necessary imports like FoodType if defined elsewhere
export enum FoodType {
  NORMAL = "normal",
  GROWTH = "growth",
  TRAP = "trap",
}

export enum GamePhase {
  EARLY = "EARLY",
  MID = "MID",
  LATE = "LATE",
}

export enum Direction {
  LEFT = "LEFT",
  UP = "UP",
  RIGHT = "RIGHT",
  DOWN = "DOWN",
}

export interface Vec2 { x: number; y: number; }

export const GameConfig = {
  TOTAL_TICKS: 256,

  MAX_PLAYERS: 30,

  CANVAS: {
    BOX_SIZE: 20,
    ROWS: 30,
    COLUMNS: 40,
  },

  SHIELD: { // Example values
    COST: 20,
    DURATION: 5,
    COOLDOWN: 30,
    INITIAL_DURATION: 10, // 出生时的初始护盾持续时间
  },

  SNAKE: { // Example values
    INITIAL_LENGTH: 5,
    MOVE_INTERVAL: 500,
  },

  // Vortex Field configuration
  VORTEX_FIELD: {
    // Feature toggle - set to false to disable vortex field entirely
    ENABLED: false,
    
    // Trigger settings
    TRIGGER_START_TICK: 80,
    INITIAL_TRIGGER_PROBABILITY: 0.1,
    PROBABILITY_INCREMENT: 0.05,
    
    // Duration settings
    WARNING_DURATION: 5,
    ACTIVE_DURATION_MIN: 25,
    ACTIVE_DURATION_MAX: 30,
    COOLDOWN_DURATION: 4,
    
    // Spatial settings
    LETHAL_SINGULARITY_SIZE: 2, // 2x2
    INNER_RING_RADIUS: 4,
    OUTER_RING_RADIUS: 7,
    
    // Reward settings
    OUTER_RING_SCORE_MULTIPLIER: 1.5,
    INNER_RING_SCORE_MULTIPLIER: 2.5,
    FOOD_SPAWN_RATE_MULTIPLIER: 3.0,
    
    // Risk settings
    COOLDOWN_SHIELD_DURATION: 4,
    
    // Fair position algorithm settings
    FAIR_POSITION_TOP_PERCENT: 0.2, // Top 20% by distance sum
    MIN_DISTANCE_FROM_SNAKES: 3,    // Minimum distance from any snake
  },

  // NEW Advanced Food Generation Configuration
  FOOD_ADV: {
    // Phasing (Ticks)
    MID_PHASE_START_TICK: 81,
    LATE_PHASE_START_TICK: 201,

    // Generation Timing
    GENERATION_PERIOD: 3,
    MAX_BURST_PER_PERIOD: 5,

    // Dynamic Target Calculation Parameters (SIGNIFICANTLY INCREASED for Density)
    TARGET_NORMAL_BASE: 20,       // INCREASED BASE
    TARGET_NORMAL_PER_SNAKE: 3,  // SIGNIFICANTLY INCREASED: More food per snake (12 snakes -> 30, + base 8 = ~38)
    TARGET_GROWTH_BASE: 2,
    TARGET_GROWTH_PER_AVG_LENGTH: 25, // Less impact from length
    TARGET_GROWTH_PER_SNAKE: 1,    // INCREASED: More growth per snake (12 snakes -> 4.8, + base 1 = ~6)
    TARGET_TRAP_BASE: 1,
    TARGET_TRAP_PER_TOTAL_SCORE: 150, // Slightly less sensitive to score bursts

    // Upper Caps (SIGNIFICANTLY INCREASED)
    TARGET_NORMAL_MAX_CAP: 70, // Much higher cap for normal food
    TARGET_GROWTH_MAX_CAP: 15, // Higher cap for growth food
    TARGET_TRAP_MAX_CAP: 8,  // Slightly higher cap for traps

    // Spatial Distribution (Poisson Disk)
    MIN_DISTANCE: 2.0,
    POISSON_K: 30,
    PLACEMENT_ATTEMPTS_FROM_POOL: 5,

    // Hazard Avoidance
    MIN_DISTANCE_FROM_HEAD: 1, // Keep this tight
    TRAP_DOWNGRADE_RANGE: 4,

    // Food Lifecycles (Ticks)
    LIFECYCLE: {
      [FoodType.NORMAL]: 60, // Slightly increased lifespan
      [FoodType.GROWTH]: 80, // Slightly increased lifespan
      [FoodType.TRAP]: 80,
    },

    // Phase-specific Weights
    WEIGHTS: {
      [GamePhase.EARLY]: [ // Focus on growth and basic food
        { type: FoodType.NORMAL, value: 1, weight: 55 },
        { type: FoodType.NORMAL, value: 2, weight: 20 },
        { type: FoodType.NORMAL, value: 3, weight: 5 },
        { type: FoodType.GROWTH, value: 2, weight: 20 },
      ],
      [GamePhase.MID]: [ // Introduce variety and moderate risk/reward
        { type: FoodType.NORMAL, value: 1, weight: 30 },
        { type: FoodType.NORMAL, value: 2, weight: 25 },
        { type: FoodType.NORMAL, value: 3, weight: 15 },
        { type: FoodType.NORMAL, value: 5, weight: 8 },
        { type: FoodType.GROWTH, value: 2, weight: 12 },
        { type: FoodType.TRAP, value: -10, weight: 10 },
      ],
      [GamePhase.LATE]: [ // High stakes, more high-value food and traps
        { type: FoodType.NORMAL, value: 1, weight: 20 },
        { type: FoodType.NORMAL, value: 2, weight: 20 },
        { type: FoodType.NORMAL, value: 3, weight: 25 },
        { type: FoodType.NORMAL, value: 5, weight: 15 },
        { type: FoodType.GROWTH, value: 2, weight: 5 },
        { type: FoodType.TRAP, value: -10, weight: 15 },
      ]
    },
  },

  // COLORS
  COLORS: {
    PLAYER: "green",
    AI_1: "blue",
    AI_2: "red",
    FOOD_NORMAL: {
      "1": "red",
      "2": "blue",
      "3": "orange",
      "5": "green",
    },
    FOOD_GROWTH: "purple",
    FOOD_TRAP: "black",
    DEATH: "gray",
  },

  EXECUTION: {
    CPU_TIME_LIMIT_SECONDS: 1,
    MEMORY_LIMIT_KB: 1024 * 1024, // 1GB
    WALL_TIME_LIMIT_SECONDS: 5,
  },

  // Treasure & Key System Configuration
  TREASURE_SYSTEM: {
    // Feature toggle - set to false to disable entirely
    ENABLED: true,
    
    // Spawn timing (ticks)
    FIRST_TREASURE_TICK: 120,
    SECOND_TREASURE_TICK: 220,
    
    // Treasure scoring
    BASE_SCORE: 20,
    SCORE_MULTIPLIER: 0.5,
    MIN_SCORE: 20,
    MAX_SCORE: 40,
    
    // Key mechanics
    KEY_HOLD_TIME_LIMIT: 30, // ticks before auto-drop
    MIN_TREASURE_DISTANCE: 12, // Manhattan distance between keys and treasure
    
    // Spatial constraints
    MIN_DISTANCE_FROM_SNAKE_HEAD: 3, // Minimum distance when spawning
    
    // Key quantity calculation: max(2, floor(alive_snakes / 2))
    MIN_KEYS_PER_TREASURE: 2,
    MAX_KEYS_PER_TREASURE: 5,
    KEYS_PER_SNAKE_DIVISOR: 2,
  },

  // Safe Zone System Configuration
  SAFE_ZONE: {
    // Feature toggle - set to false to disable entirely
    ENABLED: true,
    
    // Game phase definitions (in ticks)
    PHASES: {
      [GamePhase.EARLY]: {
        START_TICK: 1,
        END_TICK: 80,
        SAFE_ZONE_STATE: "STABLE" // No shrinking
      },
      [GamePhase.MID]: {
        START_TICK: 81,
        END_TICK: 200,
        SAFE_ZONE_STATE: "SHRINKING", // Two shrinking periods (gradual)
        SHRINK_EVENTS: [
          // First shrink: 81-100 -> 34 x 26 (bounds (3,2)->(36,27))
          { START_TICK: 81, DURATION: 20, TARGET_SIZE: { WIDTH: 34, HEIGHT: 26 } },
          // Second shrink: 161-180 -> 26 x 20 (bounds (7,5)->(32,24))
          { START_TICK: 161, DURATION: 20, TARGET_SIZE: { WIDTH: 26, HEIGHT: 20 } }
        ]
      },
      [GamePhase.LATE]: {
        START_TICK: 201,
        END_TICK: 256,
        SAFE_ZONE_STATE: "SHRINKING", // Final shrinking (gradual)
        SHRINK_EVENTS: [
          // Final shrink: 221-240 -> 20 x 16 (bounds (10,7)->(29,22))
          { START_TICK: 221, DURATION: 20, TARGET_SIZE: { WIDTH: 20, HEIGHT: 16 } }
        ]
      }
    },
    
    // Initial safe zone (full map)
    INITIAL_BOUNDS: {
      X_MIN: 0,
      Y_MIN: 0, 
      X_MAX: 39, // CANVAS.COLUMNS - 1
      Y_MAX: 29  // CANVAS.ROWS - 1
    },
    
    // Visual settings
    DANGER_ZONE_COLOR: "#ff0000",
    DANGER_ZONE_ALPHA: 0.3,
    BORDER_COLOR: "#ff0000",
    BORDER_WIDTH: 2,
    
    // Warning system
    WARNING_TICKS_BEFORE_SHRINK: 10 // Show warning 10 ticks before shrinking
  }

} as const;
