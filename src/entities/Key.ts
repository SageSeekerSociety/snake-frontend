import { Entity } from "../core/Entity";
import { Position } from "../types/Position";
import { EntityType } from "../types/EntityType";

export class Key extends Entity {
  private id: string;

  constructor(position: Position, size: number, id?: string) {
    super(position, size);
    this.id = id || `key_${Date.now()}_${Math.random()}`;
  }

  getId(): string {
    return this.id;
  }

  getEntityType(): EntityType {
    return EntityType.KEY;
  }

  getValue(): number {
    return -3; // Fixed value ID for algorithm input
  }

  update(deltaTime: number): void {
    // Keys are static entities, no update logic needed
  }

  serialize(): any {
    return {
      position: this.getPosition(),
      size: this.size,
      id: this.id,
      entityType: this.getEntityType(),
      value: this.getValue(),
    };
  }
}