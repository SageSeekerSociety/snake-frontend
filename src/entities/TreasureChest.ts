import { Entity } from "../core/Entity";
import { Position } from "../types/Position";
import { EntityType } from "../types/EntityType";

export class TreasureChest extends Entity {
  private score: number;
  private opened: boolean;

  constructor(position: Position, size: number, score: number) {
    super(position, size);
    this.score = score;
    this.opened = false;
  }

  getScore(): number {
    return this.score;
  }

  isOpened(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
  }

  getEntityType(): EntityType {
    return EntityType.TREASURE_CHEST;
  }

  getValue(): number {
    return -5; // Fixed value ID for algorithm input
  }

  update(deltaTime: number): void {
    // Treasure chests are static entities, no update logic needed
  }

  serialize(): any {
    return {
      position: this.getPosition(),
      size: this.size,
      score: this.score,
      isOpened: this.opened,
      entityType: this.getEntityType(),
      value: this.getValue(),
    };
  }
}