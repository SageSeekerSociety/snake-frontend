import { GameState } from "./GameState";

export interface Updatable {
  update(deltaTime: number, gameState: GameState): void | Promise<void>;
}
