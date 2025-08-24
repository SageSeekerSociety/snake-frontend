import { Food } from "../entities/Food"; // Adjust path as needed
import { Position } from "../types/Position"; // Adjust path as needed
import { GameConfig, FoodType, GamePhase, Vec2 } from "../config/GameConfig"; // Adjust path as needed
import { EntityManager } from "../managers/EntityManager"; // Adjust path as needed
import { EntityFactory } from "../factories/EntityFactory"; // Adjust path as needed
import { Snake } from "../entities/Snake"; // Adjust path as needed
import { VortexFieldManager } from "../managers/VortexFieldManager";
import { SafeZoneManager } from "../managers/SafeZoneManager";

/**
 * Service responsible for generating food items using a phased, dynamic approach
 * and Poisson Disk Sampling for spatial distribution.
 * Ensures food is placed respecting minimum distances and dynamic game state.
 */
export class FoodGenerator {
  private entityManager: EntityManager;
  private entityFactory: EntityFactory;
  private vortexFieldManager?: VortexFieldManager;
  private safeZoneManager?: SafeZoneManager;

  // Cached dimensions and config values for performance
  private readonly boxSize = GameConfig.CANVAS.BOX_SIZE;
  private readonly columns = GameConfig.CANVAS.COLUMNS;
  private readonly rows = GameConfig.CANVAS.ROWS;
  private readonly mapWidth = this.columns * this.boxSize;
  private readonly mapHeight = this.rows * this.boxSize;

  // Poisson Disk Sampling parameters (in pixels unless noted)
  private readonly minDistance = GameConfig.FOOD_ADV.MIN_DISTANCE * this.boxSize;
  private readonly minDistanceSq = this.minDistance * this.minDistance;
  private readonly poissonK = GameConfig.FOOD_ADV.POISSON_K;
  private readonly poissonCellSize = this.minDistance / Math.SQRT2;
  private readonly poissonGridWidth = Math.ceil(this.mapWidth / this.poissonCellSize);
  private readonly poissonGridHeight = Math.ceil(this.mapHeight / this.poissonCellSize);

  constructor(entityManager: EntityManager, entityFactory: EntityFactory, vortexFieldManager?: VortexFieldManager, safeZoneManager?: SafeZoneManager) {
    this.entityManager = entityManager;
    this.entityFactory = entityFactory;
    this.vortexFieldManager = vortexFieldManager;
    this.safeZoneManager = safeZoneManager;
  }

  /**
   * Generates initial food items at the start of the game.
   * Uses early game settings and Poisson Disk Sampling for good distribution.
   * API remains the same.
   * @param count - Desired number of initial food items.
   */
  generateInitialFood(count: number): Food[] {
      const initialFood: Food[] = [];
      const phase = GamePhase.EARLY;

      // Generate a pool of potential locations using Poisson Disk
      const potentialPositions = this._runPoissonDiskSampling(this.minDistance, this.poissonK);
      this._shuffleArray(potentialPositions); // Ensure random order

      let foodPlaced = 0;
      let poolIndex = 0;

      // Place food from the pool until count is reached or pool is exhausted
      while (foodPlaced < count && poolIndex < potentialPositions.length) {
          const position = potentialPositions[poolIndex++];
          const typeToGen = this.getRandomFoodType(phase);
          const value = this.getFoodValue(typeToGen, phase);
          const color = this.getFoodColor(typeToGen, value);
          const ttl = this.getFoodTTL(typeToGen);

          // Basic bounds check and safe zone check
          if (position.x >= 0 && position.x < this.mapWidth && position.y >= 0 && position.y < this.mapHeight) {
              // Check if the position is occupied by obstacles and in safe zone
              if (!this.entityManager.isPositionOccupied(position, ['obstacle']) && this.isPositionInSafeZone(position)) {
                  const food = this.entityFactory.createFood(position, typeToGen, value, color, ttl);
                  if (food) {
                      initialFood.push(food);
                      foodPlaced++;
                  }
              }
          }
      }
      return initialFood;
  }


  /**
   * Periodically attempts to generate new food items based on game phase,
   * dynamic targets, using Poisson Disk Sampling for candidates and dynamic checks.
   * API remains the same.
   * @param currentTick - The current game tick count.
   * @returns An array of newly generated food items (can be empty).
   */
  generatePeriodicFood(currentTick: number): Food[] {
    const newFood: Food[] = [];

    // Only run generation logic periodically
    if ((currentTick % GameConfig.FOOD_ADV.GENERATION_PERIOD) !== 0) {
      return newFood;
    }

    const phase = this.getGamePhase(currentTick);
    const liveSnakes = this.entityManager.getLiveSnakes();
    const currentFood = this.entityManager.getAllFoodItems(); // Get current food state

    const targets = this.calculateDynamicTargets(phase, liveSnakes);
    const currentCounts = this.getCurrentFoodCounts(currentFood);

    // Calculate how many of each type are needed
    const needed: Record<FoodType, number> = {
        [FoodType.NORMAL]: Math.max(0, targets[FoodType.NORMAL] - currentCounts[FoodType.NORMAL]),
        [FoodType.GROWTH]: Math.max(0, targets[FoodType.GROWTH] - currentCounts[FoodType.GROWTH]),
        [FoodType.TRAP]: Math.max(0, targets[FoodType.TRAP] - currentCounts[FoodType.TRAP]),
    };
    let totalNeeded = needed[FoodType.NORMAL] + needed[FoodType.GROWTH] + needed[FoodType.TRAP];

    if (totalNeeded === 0) {
        return newFood; // No food needed currently
    }

    const maxBurst = GameConfig.FOOD_ADV.MAX_BURST_PER_PERIOD;
    let generatedCountThisPeriod = 0;

    // Generate candidate positions - slightly more than potentially needed
    const numCandidatesToGenerate = maxBurst * GameConfig.FOOD_ADV.PLACEMENT_ATTEMPTS_FROM_POOL + 5;
    const potentialPositions = this._runPoissonDiskSampling(this.minDistance, this.poissonK, numCandidatesToGenerate);
    this._shuffleArray(potentialPositions); // Randomize order

    let potentialPositionIndex = 0;

    // Apply vortex field food generation multiplier if active
    const isVortexActive = this.vortexFieldManager?.getStatus().state === 2; // VortexFieldState.ACTIVE
    const vortexMultiplier = isVortexActive ? GameConfig.VORTEX_FIELD.FOOD_SPAWN_RATE_MULTIPLIER : 1.0;
    const adjustedMaxBurst = Math.floor(maxBurst * vortexMultiplier);

    // Separate positions into vortex field and outside positions for priority placement
    const vortexPositions: Vec2[] = [];
    const outsidePositions: Vec2[] = [];
    
    if (isVortexActive && this.vortexFieldManager) {
      for (const pos of potentialPositions) {
        if (this.vortexFieldManager.isPositionInVortexField(pos)) {
          vortexPositions.push(pos);
        } else {
          outsidePositions.push(pos);
        }
      }
    }

    // Use prioritized positions if vortex is active, otherwise use normal positions
    const prioritizedPositions = isVortexActive ? [...vortexPositions, ...outsidePositions] : potentialPositions;

    // Attempt to place needed food items, respecting the adjusted burst limit
    while (generatedCountThisPeriod < adjustedMaxBurst && totalNeeded > 0 && potentialPositionIndex < prioritizedPositions.length) {
        // Select the type of food to attempt placing, weighted by need and config
        const typeToTry = this._getNeededFoodTypeWeighted(phase, needed);
        if (!typeToTry) break; // No more types needed

        const value = this.getFoodValue(typeToTry, phase);
        const color = this.getFoodColor(typeToTry, value);
        const ttl = this.getFoodTTL(typeToTry);

        let placed = false;
        let attemptsForThisItem = 0;

        // Try multiple positions from the prioritized pool for this one food item
        while (attemptsForThisItem < GameConfig.FOOD_ADV.PLACEMENT_ATTEMPTS_FROM_POOL &&
               potentialPositionIndex < prioritizedPositions.length &&
               !placed)
        {
            const candidatePos = prioritizedPositions[potentialPositionIndex++];
            attemptsForThisItem++;

            // Perform dynamic checks (collision with snakes, proximity to heads)
            if (this._isValidPlacementDynamicCheck(candidatePos, liveSnakes)) {
                // Apply trap downgrade logic if necessary after confirming basic safety
                let finalType = typeToTry;
                let finalValue = value;
                let finalColor = color;
                let finalTtl = ttl;

                if (typeToTry === FoodType.TRAP && this.isTooCloseToAnyHead(candidatePos, liveSnakes, GameConfig.FOOD_ADV.TRAP_DOWNGRADE_RANGE)) {
                    finalType = FoodType.NORMAL;
                    finalValue = 1;
                    finalColor = this.getFoodColor(finalType, finalValue);
                    finalTtl = this.getFoodTTL(finalType);
                }

                // Create the food entity via the factory
                const food = this.entityFactory.createFood(candidatePos, finalType, finalValue, finalColor, finalTtl);
                if (food) {
                    newFood.push(food);
                    needed[typeToTry]--; // Update local needed count
                    totalNeeded--;
                    generatedCountThisPeriod++;
                    placed = true; // Success, move to next food item
                    
                    // Log vortex field food generation
                    if (isVortexActive && this.vortexFieldManager?.isPositionInVortexField(candidatePos)) {
                      console.log(`[VortexField] Generated ${finalType} food in vortex field at (${candidatePos.x / this.boxSize}, ${candidatePos.y / this.boxSize})`);
                    }
                }
            }
        }
        // If placement failed after trying several pool locations, just move on.
    }

    return newFood;
  }


  // --- Private Helper Methods ---

  /**
   * Generates a set of points using Poisson Disk Sampling (Bridson's Algorithm).
   * Ensures points are at least `minDistance` apart.
   */
  private _runPoissonDiskSampling(minDistance: number, k: number, maxSamples: number = Infinity): Vec2[] {
      const samples: Vec2[] = [];
      const activeList: number[] = []; // Stores indices into the samples array
      const grid: (number | undefined)[] = new Array(this.poissonGridWidth * this.poissonGridHeight).fill(undefined);
      const cellSize = this.poissonCellSize;
      const minDistanceSq = minDistance * minDistance;

      // Start with a random point
      if (samples.length === 0 && maxSamples > 0) {
          const initialX = Math.random() * this.mapWidth;
          const initialY = Math.random() * this.mapHeight;
          const initialSample = { x: initialX, y: initialY };
          const initialIndex = 0;
          samples.push(initialSample);
          activeList.push(initialIndex);
          const gridX = Math.floor(initialX / cellSize);
          const gridY = Math.floor(initialY / cellSize);
          grid[gridX + gridY * this.poissonGridWidth] = initialIndex;
      }

      // Process the active list
      while (activeList.length > 0 && samples.length < maxSamples) {
          const randomIndex = Math.floor(Math.random() * activeList.length);
          const activeSampleIndex = activeList[randomIndex];
          const activeSample = samples[activeSampleIndex];
          let foundCandidate = false;

          // Generate k candidate points around the active sample
          for (let i = 0; i < k; i++) {
              const angle = Math.random() * Math.PI * 2;
              const radius = minDistance + Math.random() * minDistance; // Range [d, 2d]
              const candidateX = activeSample.x + Math.cos(angle) * radius;
              const candidateY = activeSample.y + Math.sin(angle) * radius;
              const candidate: Vec2 = { x: candidateX, y: candidateY };

              // Check if candidate is within map bounds
              if (candidateX >= 0 && candidateX < this.mapWidth && candidateY >= 0 && candidateY < this.mapHeight) {
                  const candidateGridX = Math.floor(candidateX / cellSize);
                  const candidateGridY = Math.floor(candidateY / cellSize);
                  let isFarEnough = true;

                  // Check against neighbors in the grid (within 2 cells radius)
                  const searchStartX = Math.max(0, candidateGridX - 2);
                  const searchEndX = Math.min(this.poissonGridWidth - 1, candidateGridX + 2);
                  const searchStartY = Math.max(0, candidateGridY - 2);
                  const searchEndY = Math.min(this.poissonGridHeight - 1, candidateGridY + 2);

                  for (let y = searchStartY; y <= searchEndY; y++) {
                      for (let x = searchStartX; x <= searchEndX; x++) {
                          const neighborIndex = grid[x + y * this.poissonGridWidth];
                          if (neighborIndex !== undefined) { // If a sample exists in this grid cell
                              const neighborSample = samples[neighborIndex];
                              const dx = candidateX - neighborSample.x;
                              const dy = candidateY - neighborSample.y;
                              if (dx * dx + dy * dy < minDistanceSq) {
                                  isFarEnough = false;
                                  break; // Candidate is too close
                              }
                          }
                      }
                      if (!isFarEnough) break;
                  }

                  // If the candidate is valid, add it
                  if (isFarEnough) {
                      const newSampleIndex = samples.length;
                      samples.push(candidate);
                      activeList.push(newSampleIndex);
                      grid[candidateGridX + candidateGridY * this.poissonGridWidth] = newSampleIndex;
                      foundCandidate = true;
                      if (samples.length >= maxSamples) break; // Stop if limit reached
                  }
              }
               if (samples.length >= maxSamples) break;
          } // End of k attempts loop

          // If no valid candidate was found around this active point, remove it
          if (!foundCandidate) {
              activeList.splice(randomIndex, 1);
          }
          if (samples.length >= maxSamples) break;
      } // End while active list not empty

      // Round positions to align with the game grid for the factory
       return samples.map(pos => ({
           x: Math.floor(pos.x / this.boxSize) * this.boxSize,
           y: Math.floor(pos.y / this.boxSize) * this.boxSize
       }));
  }

  /** Determines the current game phase based on the tick count. */
  private getGamePhase(currentTick: number): GamePhase {
    if (currentTick >= GameConfig.FOOD_ADV.LATE_PHASE_START_TICK) {
      return GamePhase.LATE;
    } else if (currentTick >= GameConfig.FOOD_ADV.MID_PHASE_START_TICK) {
      return GamePhase.MID;
    } else {
      return GamePhase.EARLY;
    }
  }

  /** Calculates dynamic target food counts based on game state. */
  private calculateDynamicTargets(phase: GamePhase, liveSnakes: Snake[]): Record<FoodType, number> {
    const snakeCount = liveSnakes.length;
    if (snakeCount === 0) {
        return {
            [FoodType.NORMAL]: GameConfig.FOOD_ADV.TARGET_NORMAL_BASE,
            [FoodType.GROWTH]: GameConfig.FOOD_ADV.TARGET_GROWTH_BASE,
            [FoodType.TRAP]: 0,
        };
    }

    let totalScore = 0;
    let totalLength = 0;
    liveSnakes.forEach(snake => {
        totalScore += snake.getScore(); // Assumes snake.getScore() exists
        totalLength += snake.getBody().length; // Assumes snake.getBody() exists
    });
    // Avoid division by zero if snakeCount is somehow zero here
    const avgLength = snakeCount > 0 ? totalLength / snakeCount : 0;

    const targets: Record<FoodType, number> = {
      [FoodType.NORMAL]: Math.ceil(
          GameConfig.FOOD_ADV.TARGET_NORMAL_BASE +
          GameConfig.FOOD_ADV.TARGET_NORMAL_PER_SNAKE * snakeCount
      ),
      [FoodType.GROWTH]: Math.ceil(
          GameConfig.FOOD_ADV.TARGET_GROWTH_BASE +
          (GameConfig.FOOD_ADV.TARGET_GROWTH_PER_AVG_LENGTH > 0 ? Math.floor(avgLength / GameConfig.FOOD_ADV.TARGET_GROWTH_PER_AVG_LENGTH) : 0) +
          GameConfig.FOOD_ADV.TARGET_GROWTH_PER_SNAKE * snakeCount
      ),
      [FoodType.TRAP]: 0,
    };

    if (phase === GamePhase.MID || phase === GamePhase.LATE) {
      targets[FoodType.TRAP] = Math.ceil(
          GameConfig.FOOD_ADV.TARGET_TRAP_BASE +
          (GameConfig.FOOD_ADV.TARGET_TRAP_PER_TOTAL_SCORE > 0 ? Math.floor(totalScore / GameConfig.FOOD_ADV.TARGET_TRAP_PER_TOTAL_SCORE) : 0)
      );
    }

    // Apply minimums and maximum caps
    targets[FoodType.GROWTH] = Math.max(1, targets[FoodType.GROWTH]);
    targets[FoodType.NORMAL] = Math.min(targets[FoodType.NORMAL], GameConfig.FOOD_ADV.TARGET_NORMAL_MAX_CAP);
    targets[FoodType.GROWTH] = Math.min(targets[FoodType.GROWTH], GameConfig.FOOD_ADV.TARGET_GROWTH_MAX_CAP);
    targets[FoodType.TRAP] = Math.min(targets[FoodType.TRAP], GameConfig.FOOD_ADV.TARGET_TRAP_MAX_CAP);

    return targets;
  }

  /** Counts the current number of each food type on the map. */
  private getCurrentFoodCounts(allFood: Food[]): Record<FoodType, number> {
      const counts: Record<FoodType, number> = {
          [FoodType.NORMAL]: 0,
          [FoodType.GROWTH]: 0,
          [FoodType.TRAP]: 0,
      };
      allFood.forEach(food => {
          // Check if type exists in counts to handle potential other food types (e.g., Death food)
          if (counts.hasOwnProperty(food.getType())) {
             counts[food.getType()]++;
          }
      });
      return counts;
  }

  /** Selects a random food type based on configured weights for the current phase. */
  private getRandomFoodType(phase: GamePhase): FoodType {
      const phaseWeights = GameConfig.FOOD_ADV.WEIGHTS[phase]; // Direct indexing with string enum
      const totalWeight = phaseWeights.reduce((sum, food) => sum + food.weight, 0);
      if (totalWeight <= 0) return FoodType.NORMAL; // Safety fallback

      const randomNum = Math.random() * totalWeight;
      let weightSum = 0;
      for (const food of phaseWeights) {
          weightSum += food.weight;
          if (randomNum <= weightSum) {
              return food.type;
          }
      }
      return phaseWeights[phaseWeights.length - 1]?.type || FoodType.NORMAL; // Fallback
  }

   /** Gets the appropriate value for a given food type based on phase weights. */
   private getFoodValue(type: FoodType, phase: GamePhase): number {
        const phaseWeights = GameConfig.FOOD_ADV.WEIGHTS[phase]; // Direct indexing

        if (type === FoodType.NORMAL) {
            // Weighted random selection among NORMAL types for this phase
            const normalFoods = phaseWeights.filter(f => f.type === FoodType.NORMAL && typeof f.value === 'number');
            if (normalFoods.length === 0) return 1;
            const totalNormalWeight = normalFoods.reduce((sum, food) => sum + food.weight, 0);
             if (totalNormalWeight <= 0) return normalFoods[0].value; // Fallback

            const random = Math.random() * totalNormalWeight;
            let weightSum = 0;
            for (const food of normalFoods) {
                weightSum += food.weight;
                if (random <= weightSum) {
                    return food.value;
                }
            }
            return normalFoods[normalFoods.length - 1].value; // Fallback
        } else {
            // Find the first matching non-NORMAL type for value (e.g., Growth, Trap)
            const specificFood = phaseWeights.find(f => f.type === type);
            if (specificFood && typeof specificFood.value === 'number') return specificFood.value;
            // Default values if not found in config for the phase
            return type === FoodType.GROWTH ? 2 : type === FoodType.TRAP ? -10 : 1;
        }
   }

  /** Gets the display color for a food item based on type and value. */
  private getFoodColor(type: FoodType, value: number): string {
      try {
          switch (type) {
              case FoodType.NORMAL:
                  const valueKey = String(value) as keyof typeof GameConfig.COLORS.FOOD_NORMAL;
                  return GameConfig.COLORS.FOOD_NORMAL[valueKey] || GameConfig.COLORS.FOOD_NORMAL["1"];
              case FoodType.GROWTH: return GameConfig.COLORS.FOOD_GROWTH;
              case FoodType.TRAP: return GameConfig.COLORS.FOOD_TRAP;
              default: return GameConfig.COLORS.FOOD_NORMAL["1"]; // Default fallback
          }
      } catch (e) {
          return GameConfig.COLORS.FOOD_NORMAL["1"]; // Safety fallback on error
      }
  }

  /** Gets the Time-To-Live (TTL) for a specific food type from config. */
  private getFoodTTL(type: FoodType): number {
      const lifecycleMap = GameConfig.FOOD_ADV.LIFECYCLE as Record<FoodType, number | undefined>;
      return lifecycleMap[type] ?? 60; // Default TTL if type not specified
  }

  /** Checks if a potential position is too close to any live snake head. */
  private isTooCloseToAnyHead(position: Position, liveSnakes: Snake[], safeRangeGrid: number): boolean {
        for (const snake of liveSnakes) {
            if (!snake.isAlive()) continue; // Skip dead snakes
            const head = snake.getBody()[0];
            // Use Chebyshev distance (max coordinate difference) in grid units
            const dxGrid = Math.abs(head.x - position.x) / this.boxSize;
            const dyGrid = Math.abs(head.y - position.y) / this.boxSize;
             if (Math.max(dxGrid, dyGrid) <= safeRangeGrid) {
                return true; // Too close
             }
        }
        return false; // Far enough from all heads
   }

  /**
   * Performs dynamic checks for a placement position against live snakes.
   * Checks for occupation by body/head, proximity to heads, and safe zone constraints.
   */
  private _isValidPlacementDynamicCheck(position: Position, liveSnakes: Snake[]): boolean {
     // Check if the exact cell is occupied by a snake part or obstacle
     const itemsInCell = this.entityManager.findNearbyGridItems(position, 0);
      for (const item of itemsInCell) {
          if (item.position.x === position.x && item.position.y === position.y) {
              if (item.type === "snake" || item.type === "obstacle") {
                 return false; // Blocked
              }
          }
      }

      // Check proximity to snake heads using the specific safe range
      if (this.isTooCloseToAnyHead(position, liveSnakes, GameConfig.FOOD_ADV.MIN_DISTANCE_FROM_HEAD)) {
          return false; // Too close to a head
      }

      // Check if position is within safe zone
      if (!this.isPositionInSafeZone(position)) {
          return false; // Outside safe zone
      }

      return true; // Position is valid dynamically
  }

  /** Fisher-Yates (aka Knuth) shuffle algorithm. */
  private _shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }

   /** Selects a food type to generate based on current need and phase weights. */
   private _getNeededFoodTypeWeighted(phase: GamePhase, needed: Record<FoodType, number>): FoodType | null {
       const phaseWeights = GameConfig.FOOD_ADV.WEIGHTS[phase];
       let totalWeightedNeed = 0;
       const weightedNeeds: { type: FoodType, weight: number }[] = [];

       // Create a list of needed types with their corresponding weights from config
       for (const type of Object.keys(needed) as FoodType[]) {
           if (needed[type] > 0) { // Only consider types that are actually needed
               const config = phaseWeights.find(w => w.type === type);
               if (config && config.weight > 0) { // Use the weight from the config
                   const weight = config.weight;
                   weightedNeeds.push({ type, weight });
                   totalWeightedNeed += weight;
               }
           }
       }

       if (totalWeightedNeed <= 0) {
           return null; // Nothing needed or no types with positive weight found
       }

       // Perform weighted random selection
       const randomNum = Math.random() * totalWeightedNeed;
       let weightSum = 0;
       for (const item of weightedNeeds) {
           weightSum += item.weight;
           if (randomNum <= weightSum) {
               return item.type;
           }
       }

       // Fallback: return the last needed type in the weighted list (should rarely happen)
       return weightedNeeds.length > 0 ? weightedNeeds[weightedNeeds.length - 1].type : null;
   }

   /**
    * Checks if a position is within the current safe zone
    */
   private isPositionInSafeZone(position: Position): boolean {
       if (!this.safeZoneManager) {
           return true; // If no safe zone manager, consider all positions safe
       }
       
       return this.safeZoneManager.isPositionSafe(position);
   }

} // End of FoodGenerator class