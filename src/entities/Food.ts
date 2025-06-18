import { Entity } from "../core/Entity";
import { Position } from "../types/Position";
import { FoodType } from "../config/GameConfig";
import { EntityType } from "../types/EntityType";

export class Food extends Entity {
  private value: number | string;
  private color: string;
  private type: FoodType;
  private natural: boolean;
  private ttl?: number;

  constructor(
    position: Position,
    size: number,
    value: number | string,
    color: string,
    type: FoodType = FoodType.NORMAL,
    natural: boolean = true,
    ttl?: number
  ) {
    super(position, size);
    this.value = value;
    this.color = color;
    this.type = type;
    this.natural = natural;
    this.ttl = ttl;
  }

  update(_deltaTime: number): void {
    // Food doesn't need to update
  }

  getColor(): string {
    return this.color;
  }

  getValue(): number | string {
    return this.value;
  }

  getType(): FoodType {
    return this.type;
  }

  isNatural(): boolean {
    return this.natural;
  }

  isActive(): boolean {
    // 自然生成的食物是活跃的，死亡掉落的食物不是活跃的
    return this.natural;
  }

  getEntityType(): EntityType {
    return EntityType.FOOD;
  }

  getTTL(): number | undefined {
    return this.ttl;
  }

  public decrementTTL(): void {
    if (this.ttl !== undefined) {
      this.ttl--;
    }
  }

  // 序列化食物的状态，用于游戏录制
  serialize(): any {
    return {
      position: this.getPosition(),
      size: this.size,
      value: this.value,
      color: this.color,
      type: this.type,
      natural: this.natural,
      ttl: this.ttl,
      entityType: this.getEntityType()
    };
  }
}
