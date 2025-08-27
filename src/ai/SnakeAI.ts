import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { Direction, FoodType, GameConfig } from "../config/GameConfig";
import { Food } from "../entities/Food";
import { GameState } from "../types/GameState";

export function simpleAIAlgorithm(snake: Snake, gameState: GameState): void {
  const nearestFood = findNearestFood(snake, gameState);
  if (nearestFood) {
    const safePath = findSafePath(snake, nearestFood.getPosition(), gameState);
    if (safePath && safePath.length > 0) {
      const nextMove = safePath[0];
      const newDirection = getDirection(snake.getBody()[0], nextMove);
      if (newDirection) {
        snake.setDirection(newDirection);
      }
    } else {
      moveInSafeDirection(snake, gameState);
    }
  } else {
    moveInSafeDirection(snake, gameState);
  }
}

export function greedyAIAlgorithm(snake: Snake, gameState: GameState): void {
  const bestFood = findBestFood(snake, gameState);
  if (bestFood) {
    const safePath = findSafePath(snake, bestFood.getPosition(), gameState);
    if (safePath && safePath.length > 0) {
      const nextMove = safePath[0];
      const newDirection = getDirection(snake.getBody()[0], nextMove);
      if (newDirection) {
        snake.setDirection(newDirection);
      }
    } else {
      moveInSafeDirection(snake, gameState);
    }
  } else {
    moveInSafeDirection(snake, gameState);
  }
}

function findNearestFood(snake: Snake, gameState: GameState): Food | null {
  const head = snake.getBody()[0];
  let minDist = Infinity;
  let nearestFood: Food | null = null;

  for (const food of gameState.entities.foodItems) {
    if (food.getType() === FoodType.TRAP) continue;

    const foodPos = food.getPosition();
    const dist = Math.abs(head.x - foodPos.x) + Math.abs(head.y - foodPos.y);

    if (dist < minDist) {
      const direction = getDirection(head, foodPos);
      if (
        direction &&
        !isOppositeDirection(direction, snake.getPrevDirection())
      ) {
        minDist = dist;
        nearestFood = food;
      }
    }
  }

  return nearestFood;
}

function findBestFood(snake: Snake, gameState: GameState): Food | null {
  const head = snake.getBody()[0];
  let maxScoreRatio = -Infinity;
  let bestFood: Food | null = null;

  for (const food of gameState.entities.foodItems) {
    const foodPos = food.getPosition();
    const dist = Math.abs(head.x - foodPos.x) + Math.abs(head.y - foodPos.y);
    let score: number;

    switch (food.getType()) {
      case FoodType.GROWTH:
        score = 2;
        break;
      case FoodType.TRAP:
        continue;
      default:
        score = food.getValue() as number;
    }

    const scoreRatio = score / (dist || 1);

    if (scoreRatio > maxScoreRatio) {
      const direction = getDirection(head, foodPos);
      if (
        direction &&
        !isOppositeDirection(direction, snake.getPrevDirection())
      ) {
        maxScoreRatio = scoreRatio;
        bestFood = food;
      }
    }
  }

  return bestFood;
}

function findSafePath(
  snake: Snake,
  target: Position,
  gameState: GameState
): Position[] | null {
  interface QueueNode {
    pos: Position;
    path: Position[];
  }

  const head = snake.getBody()[0];
  const queue: QueueNode[] = [{ pos: head, path: [] }];
  const visited = new Set<string>([`${head.x},${head.y}`]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.pos.x === target.x && current.pos.y === target.y) {
      return current.path;
    }

    const possibleMoves = [
      { x: current.pos.x - GameConfig.CANVAS.BOX_SIZE, y: current.pos.y },
      { x: current.pos.x + GameConfig.CANVAS.BOX_SIZE, y: current.pos.y },
      { x: current.pos.x, y: current.pos.y - GameConfig.CANVAS.BOX_SIZE },
      { x: current.pos.x, y: current.pos.y + GameConfig.CANVAS.BOX_SIZE },
    ];

    for (const newPos of possibleMoves) {
      const key = `${newPos.x},${newPos.y}`;
      if (!visited.has(key) && isValidMove(newPos, snake, gameState)) {
        const direction = getDirection(current.pos, newPos);
        if (
          direction &&
          !isOppositeDirection(direction, snake.getPrevDirection())
        ) {
          visited.add(key);
          queue.push({
            pos: newPos,
            path: [...current.path, newPos],
          });
        }
      }
    }
  }

  return null;
}

function moveInSafeDirection(snake: Snake, gameState: GameState): void {
  const head = snake.getBody()[0];
  const possibleMoves = [
    {
      pos: { x: head.x - GameConfig.CANVAS.BOX_SIZE, y: head.y },
      dir: Direction.LEFT,
    },
    {
      pos: { x: head.x + GameConfig.CANVAS.BOX_SIZE, y: head.y },
      dir: Direction.RIGHT,
    },
    {
      pos: { x: head.x, y: head.y - GameConfig.CANVAS.BOX_SIZE },
      dir: Direction.UP,
    },
    {
      pos: { x: head.x, y: head.y + GameConfig.CANVAS.BOX_SIZE },
      dir: Direction.DOWN,
    },
  ];

  // 首先尝试继续当前方向
  const currentDir = snake.getDirection();
  const currentMove = possibleMoves.find((move) => move.dir === currentDir);
  if (currentMove && isValidMove(currentMove.pos, snake, gameState)) {
    snake.setDirection(currentDir);
    return;
  }

  // 随机打乱可能的移动方向
  for (let i = possibleMoves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [possibleMoves[i], possibleMoves[j]] = [possibleMoves[j], possibleMoves[i]];
  }

  // 寻找安全的移动方向
  for (const move of possibleMoves) {
    if (
      isValidMove(move.pos, snake, gameState) &&
      !isOppositeDirection(move.dir, snake.getPrevDirection())
    ) {
      snake.setDirection(move.dir);
      return;
    }
  }
}

function isValidMove(
  pos: Position,
  snake: Snake,
  gameState: GameState
): boolean {
  // 检查是否超出边界
  if (
    pos.x < 0 ||
    pos.x >= GameConfig.CANVAS.COLUMNS * GameConfig.CANVAS.BOX_SIZE ||
    pos.y < 0 ||
    pos.y >= GameConfig.CANVAS.ROWS * GameConfig.CANVAS.BOX_SIZE
  ) {
    return false;
  }

  // 检查是否与障碍物碰撞
  if (
    gameState.entities.obstacles.some(
      (obstacle) =>
        obstacle.getPosition().x === pos.x && obstacle.getPosition().y === pos.y
    )
  ) {
    return false;
  }

  // 检查是否与蛇身碰撞
  for (const otherSnake of gameState.entities.snakes) {
    if (!otherSnake.isAlive()) continue;

    const body = otherSnake.getBody();
    // 如果是自己，跳过头部检查
    const startIndex = otherSnake === snake ? 1 : 0;

    for (let i = startIndex; i < body.length; i++) {
      if (body[i].x === pos.x && body[i].y === pos.y) {
        return false;
      }
    }
  }

  return true;
}

function getDirection(from: Position, to: Position): Direction | null {
  if (to.x < from.x) return Direction.LEFT;
  if (to.x > from.x) return Direction.RIGHT;
  if (to.y < from.y) return Direction.UP;
  if (to.y > from.y) return Direction.DOWN;
  return null;
}

function isOppositeDirection(dir1: Direction, dir2: Direction): boolean {
  return (
    (dir1 === Direction.LEFT && dir2 === Direction.RIGHT) ||
    (dir1 === Direction.RIGHT && dir2 === Direction.LEFT) ||
    (dir1 === Direction.UP && dir2 === Direction.DOWN) ||
    (dir1 === Direction.DOWN && dir2 === Direction.UP)
  );
}
