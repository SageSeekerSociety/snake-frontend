import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { Direction, GameConfig } from "../config/GameConfig";
import { GameState } from "../types/GameState";

export function obstacleSeekingAI(snake: Snake, gameState: GameState): void {
  // 查找最近的障碍物
  const nearestObstacle = findNearestObstacle(snake, gameState);
  
  if (nearestObstacle) {
    // 如果找到障碍物，向它移动
    const head = snake.getBody()[0];
    const obstaclePos = nearestObstacle.getPosition();
    const direction = getDirectionTowardsObstacle(head, obstaclePos);
    
    if (direction) {
      snake.setDirection(direction);
    }
  } else {
    // 如果找不到障碍物，随机移动
    moveRandomly(snake);
  }
}

// 找到最近的障碍物
function findNearestObstacle(snake: Snake, gameState: GameState) {
  const head = snake.getBody()[0];
  let nearestDistance = Infinity;
  let nearestObstacle = null;
  
  for (const obstacle of gameState.obstacles) {
    const obstaclePos = obstacle.getPosition();
    // 使用曼哈顿距离
    const distance = 
      Math.abs(head.x - obstaclePos.x) + 
      Math.abs(head.y - obstaclePos.y);
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestObstacle = obstacle;
    }
  }
  
  return nearestObstacle;
}

// 获取朝向障碍物的方向
function getDirectionTowardsObstacle(head: Position, obstaclePos: Position): Direction | null {
  // 优先选择x或y坐标相同的方向，这样可以直线移动
  if (head.x === obstaclePos.x) {
    return head.y < obstaclePos.y ? Direction.DOWN : Direction.UP;
  } else if (head.y === obstaclePos.y) {
    return head.x < obstaclePos.x ? Direction.RIGHT : Direction.LEFT;
  }
  
  // 如果不在同一直线上，可以随机选择x或y方向
  const moveHorizontally = Math.random() > 0.5;
  
  if (moveHorizontally) {
    return head.x < obstaclePos.x ? Direction.RIGHT : Direction.LEFT;
  } else {
    return head.y < obstaclePos.y ? Direction.DOWN : Direction.UP;
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