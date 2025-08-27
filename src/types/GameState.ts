import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Snake } from "../entities/Snake";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { VortexFieldApiData } from "./VortexField";

// Safe zone bounds for algorithm input
export interface SafeZoneBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// Safe zone algorithm information
export interface SafeZoneAlgorithmInfo {
  currentBounds: SafeZoneBounds;
  nextShrinkEvent?: {
    startTick: number;
    targetBounds: SafeZoneBounds;
  };
  finalShrinkEvent?: {
    startTick: number;
    targetBounds: SafeZoneBounds;
  };
}

// Entity state - only managed by EntityManager
export interface EntityState {
  foodItems: Food[];
  obstacles: Obstacle[];
  snakes: Snake[];
  treasureChests: TreasureChest[];
  keys: Key[];
}

// Complete game state - assembled by GameManager
export interface GameState {
  entities: EntityState;
  vortexField?: VortexFieldApiData;
  safeZone?: SafeZoneAlgorithmInfo;
}
