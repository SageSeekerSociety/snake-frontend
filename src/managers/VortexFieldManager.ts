import { GameConfig } from "../config/GameConfig";
import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { eventBus, GameEventType } from "../core/EventBus";
import { IEntityQuery, IScoreMultiplierProvider } from "../interfaces/EntityQuery";
import {
  VortexFieldState,
  VortexFieldStatus,
  VortexFieldGeometry,
  VortexFieldApiData,
  VortexZoneType,
  PullVector,
  PositionCandidate,
} from "../types/VortexField";
import { Random } from "../utils/Random";

/**
 * Manages the Vortex Field mechanism including lifecycle, position generation,
 * and pull calculations according to the design specification.
 */
export class VortexFieldManager implements IScoreMultiplierProvider {
  private status: VortexFieldStatus;
  private entityQuery: IEntityQuery | null = null;
  private config = GameConfig.VORTEX_FIELD;
  private boxSize = GameConfig.CANVAS.BOX_SIZE;
  private mapWidth = GameConfig.CANVAS.COLUMNS * this.boxSize;
  private mapHeight = GameConfig.CANVAS.ROWS * this.boxSize;
  private rng: Random;

  constructor(rng: Random) {
    this.status = {
      state: VortexFieldState.INACTIVE,
      ticksRemaining: 0,
      currentTriggerProbability: this.config.INITIAL_TRIGGER_PROBABILITY,
    };
    this.rng = rng;
  }

  /**
   * Sets the entity query provider for dependency injection
   */
  setEntityQuery(entityQuery: IEntityQuery): void {
    this.entityQuery = entityQuery;
  }

  /**
   * Updates the vortex field state and handles transitions
   */
  update(currentTick: number): void {
    // Check if vortex field is disabled in config
    if (!this.config.ENABLED) {
      return;
    }
    
    switch (this.status.state) {
      case VortexFieldState.INACTIVE:
        this.handleInactiveState(currentTick);
        break;
      case VortexFieldState.WARNING:
        this.handleWarningState();
        break;
      case VortexFieldState.ACTIVE:
        this.handleActiveState();
        break;
      case VortexFieldState.COOLDOWN:
        this.handleCooldownState();
        break;
    }
  }

  /**
   * Handles inactive state - attempts to trigger vortex field
   */
  private handleInactiveState(currentTick: number): void {
    if (currentTick < this.config.TRIGGER_START_TICK) {
      return;
    }

    // Attempt to generate vortex field with current probability
    if (this.rng.chance(this.status.currentTriggerProbability)) {
      const geometry = this.generateFairStrategicPosition();
      if (geometry) {
        // Successfully generated vortex field
        this.status.state = VortexFieldState.WARNING;
        this.status.ticksRemaining = this.config.WARNING_DURATION;
        this.status.geometry = geometry;
        this.status.currentTriggerProbability = this.config.INITIAL_TRIGGER_PROBABILITY; // Reset

        console.log(`[VortexField] Warning phase started at (${geometry.centerAnchor.x / this.boxSize}, ${geometry.centerAnchor.y / this.boxSize})`);
        eventBus.emit(GameEventType.VORTEX_FIELD_WARNING, geometry);
      } else {
        // Failed to generate, increase probability for next attempt
        this.status.currentTriggerProbability = Math.min(
          1.0,
          this.status.currentTriggerProbability + this.config.PROBABILITY_INCREMENT
        );
        console.log(`[VortexField] Generation failed, probability increased to ${this.status.currentTriggerProbability.toFixed(3)}`);
      }
    }
  }

  /**
   * Handles warning state - countdown to activation
   */
  private handleWarningState(): void {
    this.status.ticksRemaining--;
    if (this.status.ticksRemaining <= 0) {
      this.status.state = VortexFieldState.ACTIVE;
      this.status.ticksRemaining = this.getRandomActiveDuration();
      
      console.log(`[VortexField] Activated for ${this.status.ticksRemaining} ticks`);
      eventBus.emit(GameEventType.VORTEX_FIELD_ACTIVATED, this.status.geometry);
    }
  }

  /**
   * Handles active state - countdown to deactivation
   */
  private handleActiveState(): void {
    this.status.ticksRemaining--;
    if (this.status.ticksRemaining <= 0) {
      this.status.state = VortexFieldState.COOLDOWN;
      this.status.ticksRemaining = this.config.COOLDOWN_DURATION;
      
      // Apply cooldown shields to snakes that were in the field
      this.applyCooldownShields();
      
      console.log(`[VortexField] Deactivated, cooldown phase started`);
      eventBus.emit(GameEventType.VORTEX_FIELD_DEACTIVATED);
    }
  }

  /**
   * Handles cooldown state - countdown to complete end
   */
  private handleCooldownState(): void {
    this.status.ticksRemaining--;
    if (this.status.ticksRemaining <= 0) {
      this.status.state = VortexFieldState.INACTIVE;
      this.status.geometry = undefined;
      
      console.log(`[VortexField] Cooldown completed`);
      eventBus.emit(GameEventType.VORTEX_FIELD_COOLDOWN_ENDED);
    }
  }

  /**
   * Generates a fair strategic position using the documented algorithm
   */
  private generateFairStrategicPosition(): VortexFieldGeometry | null {
    if (!this.entityQuery) {
      console.warn("[VortexField] EntityQuery not set, cannot generate vortex field");
      return null;
    }

    const liveSnakes = this.entityQuery.getLiveSnakes();
    if (liveSnakes.length === 0) {
      return null;
    }

    const candidates: PositionCandidate[] = [];
    const singularitySize = this.config.LETHAL_SINGULARITY_SIZE;

    // Generate candidate points
    for (let cx = 0; cx < this.mapWidth - singularitySize * this.boxSize; cx += this.boxSize) {
      for (let cy = 0; cy < this.mapHeight - singularitySize * this.boxSize; cy += this.boxSize) {
        const anchor = { x: cx, y: cy };
        
        // Check if 2x2 lethal singularity area is clear
        if (this.isLethalSingularityClear(anchor)) {
          const distances = liveSnakes.map(snake => 
            this.getManhattanDistance(anchor, snake.getBody()[0])
          );
          
          const distanceSum = distances.reduce((sum, d) => sum + d, 0);
          const distanceVariance = this.calculateVariance(distances);
          
          candidates.push({
            anchor,
            distanceSum,
            distanceVariance,
            distances,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Select top 20% by distance sum (remoteness)
    candidates.sort((a, b) => b.distanceSum - a.distanceSum);
    const topCount = Math.max(1, Math.floor(candidates.length * this.config.FAIR_POSITION_TOP_PERCENT));
    const topCandidates = candidates.slice(0, topCount);

    // Select the one with lowest variance (fairness)
    topCandidates.sort((a, b) => a.distanceVariance - b.distanceVariance);
    const selectedCandidate = topCandidates[0];

    return this.createVortexGeometry(selectedCandidate.anchor);
  }

  /**
   * Checks if the 2x2 lethal singularity area is clear of obstacles and snakes
   */
  private isLethalSingularityClear(anchor: Position): boolean {
    const size = this.config.LETHAL_SINGULARITY_SIZE;
    
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        const pos = {
          x: anchor.x + dx * this.boxSize,
          y: anchor.y + dy * this.boxSize,
        };
        
        if (this.entityQuery && this.entityQuery.isPositionOccupied(pos, ["obstacle", "snake"])) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Creates vortex geometry from anchor point
   */
  private createVortexGeometry(anchor: Position): VortexFieldGeometry {
    const lethalSingularity: Position[] = [];
    const size = this.config.LETHAL_SINGULARITY_SIZE;
    
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        lethalSingularity.push({
          x: anchor.x + dx * this.boxSize,
          y: anchor.y + dy * this.boxSize,
        });
      }
    }

    return {
      centerAnchor: anchor,
      lethalSingularity,
      innerRingRadius: this.config.INNER_RING_RADIUS,
      outerRingRadius: this.config.OUTER_RING_RADIUS,
    };
  }

  /**
   * Calculates Manhattan distance between two positions
   */
  private getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Calculates variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Gets random active duration within configured range
   */
  private getRandomActiveDuration(): number {
    const min = this.config.ACTIVE_DURATION_MIN;
    const max = this.config.ACTIVE_DURATION_MAX;
    return this.rng.int(min, max);
  }

  /**
   * Applies cooldown shields to snakes that were in the vortex field
   */
  private applyCooldownShields(): void {
    if (!this.status.geometry || !this.entityQuery) return;

    const liveSnakes = this.entityQuery.getLiveSnakes();
    for (const snake of liveSnakes) {
      const headPos = snake.getBody()[0];
      const zoneType = this.getPositionZoneType(headPos);
      
      if (zoneType !== VortexZoneType.OUTSIDE) {
        // Snake was in the vortex field, apply cooldown shield
        snake.activateShield(this.config.COOLDOWN_SHIELD_DURATION, 0); // Free cooldown shield
        console.log(`[VortexField] Applied cooldown shield to ${snake.getMetadata().name}`);
      }
    }
  }

  /**
   * Calculates vortex pull for a snake head position
   */
  calculateVortexPull(headPosition: Position): PullVector | null {
    if (!this.config.ENABLED || this.status.state !== VortexFieldState.ACTIVE || !this.status.geometry) {
      return null;
    }

    const zoneType = this.getPositionZoneType(headPosition);
    if (zoneType === VortexZoneType.OUTSIDE) {
      return null; // No pull outside the field
    }

    return this.calculateSymmetricalPull(headPosition, this.status.geometry.centerAnchor);
  }

  /**
   * Implements the symmetrical pull algorithm from the specification
   */
  private calculateSymmetricalPull(snakePos: Position, centerAnchor: Position): PullVector {
    const sx = snakePos.x;
    const sy = snakePos.y;
    const cx = centerAnchor.x;
    const cy = centerAnchor.y;

    // Step 1: Determine expected pull directions
    const horizontalPull = sx > cx ? "left" : "right";
    const verticalPull = sy > cy ? "up" : "down";

    // Step 2: Select final direction based on larger deviation
    const dx = Math.abs(sx - cx);
    const dy = Math.abs(sy - cy);

    const direction = dx > dy ? horizontalPull : verticalPull;

    return {
      direction,
      intensity: 1,
    };
  }

  /**
   * Determines what zone a position is in relative to the vortex field
   */
  getPositionZoneType(position: Position): VortexZoneType {
    if (!this.config.ENABLED || this.status.state === VortexFieldState.INACTIVE || !this.status.geometry) {
      return VortexZoneType.OUTSIDE;
    }

    const { centerAnchor, lethalSingularity, innerRingRadius, outerRingRadius } = this.status.geometry;

    // Check lethal singularity (exact position match)
    for (const singularityPos of lethalSingularity) {
      if (position.x === singularityPos.x && position.y === singularityPos.y) {
        return VortexZoneType.LETHAL_SINGULARITY;
      }
    }

    // Check rings using Chebyshev distance (max coordinate difference)
    const dx = Math.abs(position.x - centerAnchor.x) / this.boxSize;
    const dy = Math.abs(position.y - centerAnchor.y) / this.boxSize;
    const distance = Math.max(dx, dy);

    if (distance <= innerRingRadius) {
      return VortexZoneType.INNER_RING;
    } else if (distance <= outerRingRadius) {
      return VortexZoneType.OUTER_RING;
    } else {
      return VortexZoneType.OUTSIDE;
    }
  }

  /**
   * Gets score multiplier for a position
   */
  getScoreMultiplier(position: Position): number {
    const zoneType = this.getPositionZoneType(position);
    
    switch (zoneType) {
      case VortexZoneType.INNER_RING:
        return this.config.INNER_RING_SCORE_MULTIPLIER;
      case VortexZoneType.OUTER_RING:
        return this.config.OUTER_RING_SCORE_MULTIPLIER;
      default:
        return 1.0;
    }
  }

  /**
   * Checks if position is in vortex field (for food generation)
   */
  isPositionInVortexField(position: Position): boolean {
    const zoneType = this.getPositionZoneType(position);
    return zoneType !== VortexZoneType.OUTSIDE;
  }

  /**
   * Gets current status for API data generation
   */
  getStatus(): VortexFieldStatus {
    return { ...this.status };
  }

  /**
   * Generates API data for algorithm input
   */
  getApiData(): VortexFieldApiData {
    // If vortex field is disabled, always return inactive state
    if (!this.config.ENABLED) {
      return {
        stateCode: VortexFieldState.INACTIVE,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        param5: 0,
      };
    }
    
    const { state, ticksRemaining, geometry } = this.status;
    
    if (state === VortexFieldState.INACTIVE) {
      return {
        stateCode: VortexFieldState.INACTIVE,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        param5: 0,
      };
    } else if (state === VortexFieldState.COOLDOWN) {
      return {
        stateCode: VortexFieldState.COOLDOWN,
        param1: ticksRemaining,
        param2: 0,
        param3: 0,
        param4: 0,
        param5: 0,
      };
    } else if (geometry) {
      return {
        stateCode: state,
        param1: ticksRemaining,
        param2: geometry.centerAnchor.x / this.boxSize,
        param3: geometry.centerAnchor.y / this.boxSize,
        param4: geometry.innerRingRadius,
        param5: geometry.outerRingRadius,
      };
    }

    // Fallback
    return {
      stateCode: VortexFieldState.INACTIVE,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      param5: 0,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.status = {
      state: VortexFieldState.INACTIVE,
      ticksRemaining: 0,
      currentTriggerProbability: this.config.INITIAL_TRIGGER_PROBABILITY,
    };
  }
} 
