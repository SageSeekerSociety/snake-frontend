import { Entity } from "../core/Entity";
import { Position } from "../types/Position";
import { EntityType } from "../types/EntityType";

export class Obstacle extends Entity {
  constructor(position: Position, size: number) {
    super(position, size);
  }

  update(_deltaTime: number): void {
    // Obstacles don't need to update
  }

  getEntityType(): EntityType {
    return EntityType.OBSTACLE;
  }

  // 序列化障碍物的状态，用于游戏录制
  serialize(): any {
    return {
      position: this.getPosition(),
      size: this.size,
      entityType: this.getEntityType()
    };
  }
}
