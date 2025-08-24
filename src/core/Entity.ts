import { Position } from "../types/Position";
import { Updatable } from "../types/Updatable";
import { EntityType } from "../types/EntityType";
import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { GameState } from "../types/GameState";

export abstract class Entity implements Updatable {
  protected position: Position;
  protected size: number;

  constructor(position: Position, size: number) {
    this.position = position;
    this.size = size;
  }

  abstract update(deltaTime: number, gameState: GameState): void | Promise<void>;
  abstract getEntityType(): EntityType;

  // Add serialization method for game recording
  abstract serialize(): any;

  getPosition(): Position {
    return { ...this.position };
  }

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  getSize(): number {
    return this.size;
  }
}

// 类型守卫函数
export function isSnake(entity: Entity): entity is Snake {
  return entity.getEntityType() === EntityType.SNAKE;
}

export function isFood(entity: Entity): entity is Food {
  return entity.getEntityType() === EntityType.FOOD;
}

export function isObstacle(entity: Entity): entity is Obstacle {
  return entity.getEntityType() === EntityType.OBSTACLE;
}

export function isTreasureChest(entity: Entity): entity is TreasureChest {
  return entity.getEntityType() === EntityType.TREASURE_CHEST;
}

export function isKey(entity: Entity): entity is Key {
  return entity.getEntityType() === EntityType.KEY;
}
