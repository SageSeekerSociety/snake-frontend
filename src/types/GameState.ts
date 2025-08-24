import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Snake } from "../entities/Snake";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";

export interface GameState {
  foodItems: Food[];
  obstacles: Obstacle[];
  snakes: Snake[];
  treasureChests: TreasureChest[];
  keys: Key[];
}
