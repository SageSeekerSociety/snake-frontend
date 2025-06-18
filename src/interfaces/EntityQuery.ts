import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";

/**
 * Interface for querying entities in the game world.
 * This abstraction allows VortexFieldManager to query entities
 * without creating a circular dependency with EntityManager.
 */
export interface IEntityQuery {
  /**
   * Gets all currently alive snakes
   */
  getLiveSnakes(): Snake[];

  /**
   * Checks if a specific position is occupied by certain entity types
   */
  isPositionOccupied(position: Position, typesToCheck: string[]): boolean;
}

/**
 * Interface for calculating score multipliers.
 * This allows EntityManager to get score multipliers without
 * directly depending on VortexFieldManager.
 */
export interface IScoreMultiplierProvider {
  /**
   * Gets the score multiplier for a given position
   */
  getScoreMultiplier(position: Position): number;

  /**
   * Checks if a position is within a vortex field
   */
  isPositionInVortexField(position: Position): boolean;
} 