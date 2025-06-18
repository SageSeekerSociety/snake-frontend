import { Position } from "./Position";
import { Snake } from "../entities/Snake";

/**
 * Vortex field states
 */
export enum VortexFieldState {
  INACTIVE = 0,     // No vortex field activity
  WARNING = 1,      // Pre-activation warning phase
  ACTIVE = 2,       // Active vortex field
  COOLDOWN = 3      // Post-deactivation cooldown
}

/**
 * Vortex field configuration
 */
export interface VortexFieldConfig {
  // Trigger settings
  triggerStartTick: number;
  initialTriggerProbability: number;
  probabilityIncrement: number;
  
  // Duration settings
  warningDuration: number;
  activeDuration: number;
  cooldownDuration: number;
  
  // Spatial settings
  lethalSingularitySize: number; // 2x2
  innerRingRadius: number;
  outerRingRadius: number;
  
  // Reward settings
  outerRingScoreMultiplier: number;
  innerRingScoreMultiplier: number;
  foodSpawnRateMultiplier: number;
  
  // Risk settings
  cooldownShieldDuration: number;
}

/**
 * Vortex field position and geometry
 */
export interface VortexFieldGeometry {
  centerAnchor: Position;        // Anchor point (cx, cy)
  lethalSingularity: Position[]; // 2x2 lethal zone positions
  innerRingRadius: number;
  outerRingRadius: number;
}

/**
 * Current vortex field status
 */
export interface VortexFieldStatus {
  state: VortexFieldState;
  ticksRemaining: number;
  geometry?: VortexFieldGeometry;
  currentTriggerProbability: number;
}

/**
 * API data format for algorithm input
 */
export interface VortexFieldApiData {
  stateCode: VortexFieldState;
  param1: number; // ticksRemaining or 0
  param2: number; // cx or 0
  param3: number; // cy or 0
  param4: number; // innerRadius or 0
  param5: number; // outerRadius or 0
}

/**
 * Zone type for position classification
 */
export enum VortexZoneType {
  OUTSIDE = "outside",
  OUTER_RING = "outer_ring",
  INNER_RING = "inner_ring",
  LETHAL_SINGULARITY = "lethal_singularity"
}

/**
 * Movement phase for two-stage resolution
 */
export enum MovementPhase {
  PLAYER_DECISION = "player_decision",
  VORTEX_PULL = "vortex_pull"
}

/**
 * Pull direction for vortex attraction
 */
export interface PullVector {
  direction: "up" | "down" | "left" | "right";
  intensity: number; // Always 1 for this implementation
}

/**
 * Fair position candidate for vortex generation
 */
export interface PositionCandidate {
  anchor: Position;
  distanceSum: number;      // Sum of distances to all snake heads
  distanceVariance: number; // Variance of distances (fairness metric)
  distances: number[];      // Individual distances to each snake
} 