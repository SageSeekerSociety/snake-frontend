import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Snake } from "../entities/Snake";

export interface GameState {
  foodItems: Food[];
  obstacles: Obstacle[];
  snakes: Snake[];
}
