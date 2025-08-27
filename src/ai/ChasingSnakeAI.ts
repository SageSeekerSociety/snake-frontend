import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { Direction, GameConfig } from "../config/GameConfig";
import { GameState } from "../types/GameState";

// 追逐蛇AI - 会追逐目标蛇
export function chasingSnakeAI(snake: Snake, gameState: GameState, targetId: string = "target1"): void {
  // 找到要追逐的目标蛇
  const targetSnake = findTargetSnake(gameState.entities.snakes, targetId);
  
  if (targetSnake && targetSnake.isAlive()) {
    // 如果找到目标蛇并且它还活着，向它移动
    const head = snake.getBody()[0];
    const targetHead = targetSnake.getBody()[0];
    const direction = getDirectionTowardsTarget(head, targetHead);
    
    if (direction) {
      snake.setDirection(direction);
    }
  } else {
    // 如果目标蛇不存在或已死亡，随机移动
    moveRandomly(snake);
  }
}

// 寻找目标蛇
function findTargetSnake(snakes: Snake[], targetId: string): Snake | null {
  return snakes.find(snake => 
    snake.getMetadata().targetId === targetId || 
    snake.getMetadata().studentId === targetId
  ) || null;
}

// 获取朝向目标的方向
function getDirectionTowardsTarget(head: Position, targetPos: Position): Direction | null {
  // 为了避免同时在两个轴上移动导致蛇不停地切换方向，
  // 我们优先选择一个轴上的移动
  const dx = targetPos.x - head.x;
  const dy = targetPos.y - head.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // 水平距离更远，优先水平移动
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  } else {
    // 垂直距离更远，优先垂直移动
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }
}

// 随机移动
function moveRandomly(snake: Snake): void {
  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT
  ];
  
  // 随机选择一个方向
  const randomIndex = Math.floor(Math.random() * directions.length);
  snake.setDirection(directions[randomIndex]);
}

// 被追逐的蛇AI - 会反向逃离追逐者
export function escapingSnakeAI(snake: Snake, gameState: GameState, chaserId: string = "chaser1"): void {
  // 找到追逐者
  const chaserSnake = findTargetSnake(gameState.entities.snakes, chaserId);
  
  if (chaserSnake && chaserSnake.isAlive()) {
    // 如果找到追逐者并且它还活着，反向逃离
    const head = snake.getBody()[0];
    const chaserHead = chaserSnake.getBody()[0];
    
    // 获取追逐者的方向，然后选择相反的方向
    const towardsChaser = getDirectionTowardsTarget(head, chaserHead);
    const escapeDirection = getOppositeDirection(towardsChaser);
    
    // 设置逃离方向
    if (escapeDirection) {
      snake.setDirection(escapeDirection);
    }
  } else {
    // 如果追逐者不存在或已死亡，随机移动
    moveRandomly(snake);
  }
}

// 获取相反的方向
function getOppositeDirection(direction: Direction | null): Direction | null {
  if (direction === null) return null;
  
  switch (direction) {
    case Direction.UP: return Direction.DOWN;
    case Direction.DOWN: return Direction.UP;
    case Direction.LEFT: return Direction.RIGHT;
    case Direction.RIGHT: return Direction.LEFT;
  }
}

// 自动相撞AI - 会追逐自己的尾巴，最终导致自杀
export function selfCollidingSnakeAI(snake: Snake, gameState: GameState): void {
  const body = snake.getBody();
  
  if (body.length < 5) {
    // 如果身体太短，先随机移动增长一下
    moveRandomly(snake);
    return;
  }
  
  // 追逐自己的尾巴
  const head = body[0];
  const tail = body[body.length - 1];
  
  // 计算到达尾部的方向
  const direction = getDirectionTowardsTarget(head, tail);
  
  if (direction) {
    snake.setDirection(direction);
  }
}

// 相向而行的蛇AI - 基于游戏开始位置，直线相向而行
export function headOnCollisionSnakeAI(snake: Snake, gameState: GameState, fixedDirection: Direction): void {
  // 简单地保持固定方向移动
  snake.setDirection(fixedDirection);
} 