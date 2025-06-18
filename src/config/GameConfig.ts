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
    GENERATION_PERIOD: 3,   // INCREASED FREQUENCY: Run logic more often
    MAX_BURST_PER_PERIOD: 4, // INCREASED BURST: Allow more items per cycle

    // Dynamic Target Calculation Parameters (SIGNIFICANTLY INCREASED for Density)
    TARGET_NORMAL_BASE: 8,       // INCREASED BASE
    TARGET_NORMAL_PER_SNAKE: 2.5,  // SIGNIFICANTLY INCREASED: More food per snake (12 snakes -> 30, + base 8 = ~38)
    TARGET_GROWTH_BASE: 1,
    TARGET_GROWTH_PER_AVG_LENGTH: 25, // Less impact from length
    TARGET_GROWTH_PER_SNAKE: 0.4,    // INCREASED: More growth per snake (12 snakes -> 4.8, + base 1 = ~6)
    TARGET_TRAP_BASE: 1,
    TARGET_TRAP_PER_TOTAL_SCORE: 180, // Slightly less sensitive to score bursts

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
    MEMORY_LIMIT_KB: 128 * 1024,
    WALL_TIME_LIMIT_SECONDS: 10,
  }

} as const;