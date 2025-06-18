import { Position } from "../types/Position";
import { GameConfig } from "../config/GameConfig";

export interface GridItem {
  id: number;
  position: Position;
  type: string;
}

export class SpatialHashGrid {
  private cells: Map<string, Set<GridItem>>;
  private cellSize: number;
  private items: Map<number, GridItem>;
  private nextId: number;

  constructor(cellSize: number = GameConfig.CANVAS.BOX_SIZE * 2) {
    this.cells = new Map();
    this.items = new Map();
    this.cellSize = cellSize;
    this.nextId = 0;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForArea(position: Position, size: number): string[] {
    const startX = Math.floor(position.x / this.cellSize);
    const startY = Math.floor(position.y / this.cellSize);
    const endX = Math.floor((position.x + size) / this.cellSize);
    const endY = Math.floor((position.y + size) / this.cellSize);

    const cells: string[] = [];
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    return cells;
  }

  insert(position: Position, type: string): number {
    const id = this.nextId++;
    const item: GridItem = { id, position, type };
    this.items.set(id, item);

    const key = this.getCellKey(position.x, position.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(item);

    return id;
  }

  update(id: number, newPosition: Position): void {
    const item = this.items.get(id);
    if (!item) return;

    const oldKey = this.getCellKey(item.position.x, item.position.y);
    const newKey = this.getCellKey(newPosition.x, newPosition.y);

    if (oldKey !== newKey) {
      this.cells.get(oldKey)?.delete(item);
      if (!this.cells.has(newKey)) {
        this.cells.set(newKey, new Set());
      }
      this.cells.get(newKey)!.add(item);
    }

    item.position = newPosition;
  }

  remove(id: number): void {
    const item = this.items.get(id);
    if (!item) return;

    const key = this.getCellKey(item.position.x, item.position.y);
    this.cells.get(key)?.delete(item);
    this.items.delete(id);
  }

  findNearby(position: Position, size: number, type?: string): GridItem[] {
    const cells = this.getCellsForArea(position, size);
    const nearby = new Set<GridItem>();

    for (const cell of cells) {
      const items = this.cells.get(cell);
      if (!items) continue;

      for (const item of items) {
        if (!type || item.type === type) {
          nearby.add(item);
        }
      }
    }

    return Array.from(nearby);
  }

  clear(): void {
    this.cells.clear();
    this.items.clear();
    this.nextId = 0;
  }
}
