import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { Direction, FoodType, GameConfig } from "../config/GameConfig";
import { GameState } from "../types/GameState";

// 高级AI算法主入口
export function advancedAIAlgorithm(snake: Snake, gameState: GameState): void {
  // 使用护盾的策略
  if (shouldUseShield(snake, gameState)) {
    snake.activateShield();
  }

  // 获取蛇头位置
  const head = snake.getBody()[0];
  
  // 创建风险地图
  const riskMap = createRiskMap(snake, gameState);
  
  // 获取所有可能的目标及其评分
  const targets = evaluateTargets(snake, gameState, riskMap);
  
  // 如果有可行目标
  if (targets.length > 0) {
    // 按评分排序
    targets.sort((a, b) => b.score - a.score);
    const bestTarget = targets[0];
    
    // 使用A*算法寻找最佳路径
    const path = findPathAStar(snake, bestTarget.position, gameState, riskMap);
    
    if (path && path.length > 0) {
      // 获取下一步的方向
      const nextDirection = getDirection(head, path[0]);
      if (nextDirection) {
        snake.setDirection(nextDirection);
        return;
      }
    }
  }
  
  // 如果没有好的目标或路径，执行防守策略
  defensiveMove(snake, gameState, riskMap);
}

// 创建风险地图
function createRiskMap(snake: Snake, gameState: GameState): Map<string, number> {
  const riskMap = new Map<string, number>();
  const gridWidth = GameConfig.CANVAS.COLUMNS;
  const gridHeight = GameConfig.CANVAS.ROWS;
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  
  // 初始化风险地图
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const pos = { x: x * boxSize, y: y * boxSize };
      const key = `${pos.x},${pos.y}`;
      riskMap.set(key, 0);
    }
  }
  
  // 边界风险最高
  for (let x = 0; x < gridWidth; x++) {
    riskMap.set(`${x * boxSize},0`, 100);
    riskMap.set(`${x * boxSize},${(gridHeight - 1) * boxSize}`, 100);
  }
  for (let y = 0; y < gridHeight; y++) {
    riskMap.set(`0,${y * boxSize}`, 100);
    riskMap.set(`${(gridWidth - 1) * boxSize},${y * boxSize}`, 100);
  }
  
  // 障碍物风险
  for (const obstacle of gameState.entities.obstacles) {
    const pos = obstacle.getPosition();
    riskMap.set(`${pos.x},${pos.y}`, 100);
    
    // 障碍物周围风险也较高
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = pos.x + dx * boxSize;
        const ny = pos.y + dy * boxSize;
        if (nx >= 0 && nx < gridWidth * boxSize && ny >= 0 && ny < gridHeight * boxSize) {
          const key = `${nx},${ny}`;
          riskMap.set(key, Math.max(riskMap.get(key) || 0, 20));
        }
      }
    }
  }
  
  // 陷阱食物风险处理
  for (const food of gameState.entities.foodItems) {
    if (food.getType() === FoodType.TRAP) {
      const pos = food.getPosition();
      const key = `${pos.x},${pos.y}`;
      // 陷阱食物的风险非常高
      riskMap.set(key, 90);
      
      // 陷阱食物周围区域也有较高风险
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = pos.x + dx * boxSize;
          const ny = pos.y + dy * boxSize;
          if (nx >= 0 && nx < gridWidth * boxSize && ny >= 0 && ny < gridHeight * boxSize) {
            const neighborKey = `${nx},${ny}`;
            riskMap.set(neighborKey, Math.max(riskMap.get(neighborKey) || 0, 30));
          }
        }
      }
    }
  }
  
  // 其他蛇身体的风险
  for (const otherSnake of gameState.entities.snakes) {
    if (!otherSnake.isAlive()) continue;
    
    const body = otherSnake.getBody();
    for (let i = 0; i < body.length; i++) {
      const segment = body[i];
      const key = `${segment.x},${segment.y}`;
      
      if (i === 0 && otherSnake !== snake) {
        // 其他蛇的头部及其可能移动的位置风险极高
        riskMap.set(key, 100);
        
        // 预测下一步头部可能的位置
        const possibleMoves = getPossibleMoves(segment, boxSize);
        for (const move of possibleMoves) {
          const moveKey = `${move.x},${move.y}`;
          riskMap.set(moveKey, Math.max(riskMap.get(moveKey) || 0, 50));
        }
      } else {
        // 蛇身体的风险
        riskMap.set(key, 100);
        
        // 如果是自己的尾巴，标记为较低风险（因为会移动）
        if (otherSnake === snake && i === body.length - 1) {
          riskMap.set(key, 10);
        }
      }
    }
  }
  
  return riskMap;
}

// 评估所有可能的目标
function evaluateTargets(snake: Snake, gameState: GameState, riskMap: Map<string, number>): { position: Position; score: number; }[] {
  const targets: { position: Position; score: number; }[] = [];
  const head = snake.getBody()[0];
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  
  // 评估食物
  for (const food of gameState.entities.foodItems) {
    const pos = food.getPosition();
    const key = `${pos.x},${pos.y}`;
    const risk = riskMap.get(key) || 0;
    
    // 跳过高风险区域的食物
    if (risk > 60) continue;
    
    // 跳过陷阱食物
    if (food.getType() === FoodType.TRAP) continue;
    
    // 计算食物得分
    let value = 0;
    switch (food.getType()) {
      case FoodType.NORMAL:
        value = food.getValue() as number;
        break;
      case FoodType.GROWTH:
        // 降低生长豆的价值，使其与普通3分食物相当
        value = 3; 
        
        // 如果蛇长度较短，提高生长豆的价值
        if (snake.getBody().length < 10) {
          value = 10;
        } else {
          // 如果蛇已经很长，进一步降低生长豆的价值
          value = 2;
        }
        break;
    }
    
    // 计算曼哈顿距离
    const distance = Math.abs(head.x - pos.x) + Math.abs(head.y - pos.y);
    
    // 检查路径上是否有陷阱食物
    let trapProximityPenalty = 1.0;
    for (const trapFood of gameState.entities.foodItems) {
      if (trapFood.getType() === FoodType.TRAP) {
        const trapPos = trapFood.getPosition();
        
        // 计算陷阱到目标食物的距离
        const trapToFoodDistance = Math.abs(trapPos.x - pos.x) + Math.abs(trapPos.y - pos.y);
        
        // 计算陷阱到蛇头的距离
        const trapToHeadDistance = Math.abs(trapPos.x - head.x) + Math.abs(trapPos.y - head.y);
        
        // 如果陷阱在蛇头和目标食物之间，则降低该食物的分数
        if (trapToFoodDistance < distance && trapToHeadDistance < distance) {
          const penalty = Math.max(0.5, 1 - (trapToHeadDistance / distance));
          trapProximityPenalty = Math.min(trapProximityPenalty, penalty);
        }
      }
    }
    
    // 分数考虑食物价值、距离、风险和陷阱邻近度
    const score = (value * 100) / (distance + 1) * (1 - risk / 100) * trapProximityPenalty;
    
    targets.push({ position: pos, score });
  }
  
  // 寻找安全空间
  if (targets.length < 2) {
    // 如果食物选择太少，考虑安全的空白区域
    const safeSpaces = findSafeSpaces(snake, gameState, riskMap);
    for (const space of safeSpaces) {
      const distance = Math.abs(head.x - space.x) + Math.abs(head.y - space.y);
      
      // 远离当前头部的安全空间更有价值
      const score = 10 * boxSize / (distance + 1);
      targets.push({ position: space, score });
    }
  }
  
  return targets;
}

// 寻找安全的空白区域
function findSafeSpaces(snake: Snake, gameState: GameState, riskMap: Map<string, number>): Position[] {
  const safeSpaces: Position[] = [];
  const gridWidth = GameConfig.CANVAS.COLUMNS;
  const gridHeight = GameConfig.CANVAS.ROWS;
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  const head = snake.getBody()[0];
  
  // 考虑远离蛇头的区域
  for (let x = 5; x < gridWidth - 5; x++) {
    for (let y = 5; y < gridHeight - 5; y++) {
      const pos = { x: x * boxSize, y: y * boxSize };
      const key = `${pos.x},${pos.y}`;
      const risk = riskMap.get(key) || 0;
      
      // 低风险区域
      if (risk < 10) {
        // 确保与蛇头有一定距离
        const distance = Math.abs(head.x - pos.x) + Math.abs(head.y - pos.y);
        if (distance > 5 * boxSize) {
          safeSpaces.push(pos);
        }
      }
    }
  }
  
  // 随机选择一些安全空间
  return shuffleArray(safeSpaces).slice(0, 5);
}

// 使用A*算法寻找最佳路径
function findPathAStar(
  snake: Snake,
  target: Position,
  gameState: GameState,
  riskMap: Map<string, number>
): Position[] | null {
  const head = snake.getBody()[0];
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  
  // 开放列表和关闭列表
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  
  // 添加起始节点
  openSet.push({
    position: head,
    gScore: 0,
    fScore: heuristic(head, target),
    parent: null
  });
  
  // 节点映射，用于快速查找
  const nodeMap = new Map<string, PathNode>();
  nodeMap.set(`${head.x},${head.y}`, openSet[0]);
  
  while (openSet.length > 0) {
    // 获取f值最小的节点
    openSet.sort((a, b) => a.fScore - b.fScore);
    const current = openSet.shift()!;
    const currentKey = `${current.position.x},${current.position.y}`;
    
    // 到达目标
    if (current.position.x === target.x && current.position.y === target.y) {
      return reconstructPath(current);
    }
    
    // 添加到关闭列表
    closedSet.add(currentKey);
    
    // 获取相邻节点
    const possibleMoves = getPossibleMoves(current.position, boxSize);
    for (const neighbor of possibleMoves) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      
      // 跳过已经在关闭列表中的节点
      if (closedSet.has(neighborKey)) continue;
      
      // 计算风险
      const risk = riskMap.get(neighborKey) || 0;
      
      // 跳过高风险区域
      if (risk >= 70) continue;
      
      // 检查节点是否是陷阱
      let isTrap = false;
      for (const food of gameState.entities.foodItems) {
        if (food.getType() === FoodType.TRAP) {
          const pos = food.getPosition();
          if (pos.x === neighbor.x && pos.y === neighbor.y) {
            isTrap = true;
            break;
          }
        }
      }
      
      // 跳过陷阱
      if (isTrap) continue;
      
      // 检查该位置是否有其他蛇的身体
      let hasSnakeBody = false;
      for (const otherSnake of gameState.entities.snakes) {
        if (!otherSnake.isAlive()) continue;
        
        const body = otherSnake.getBody();
        // 获取蛇尾位置，可能会移动
        const tail = body[body.length - 1];
        const isTail = tail.x === neighbor.x && tail.y === neighbor.y;
        
        for (let i = 0; i < body.length; i++) {
          const segment = body[i];
          if (segment.x === neighbor.x && segment.y === neighbor.y) {
            // 如果是尾巴，且目标还很远，可以假设尾巴会移动
            if (i === body.length - 1 && heuristic(neighbor, target) > 4 * boxSize) {
              continue;
            }
            hasSnakeBody = true;
            break;
          }
        }
        if (hasSnakeBody) break;
      }
      
      // 如果有蛇身体且不是尾巴，跳过
      if (hasSnakeBody) continue;
      
      // 预测其他蛇的移动
      let potentialCollision = false;
      for (const otherSnake of gameState.entities.snakes) {
        if (otherSnake === snake || !otherSnake.isAlive()) continue;
        
        const otherHead = otherSnake.getBody()[0];
        // 如果其他蛇头部与当前节点距离过近
        const distance = Math.abs(otherHead.x - current.position.x) + Math.abs(otherHead.y - current.position.y);
        
        if (distance <= 2 * boxSize) {
          // 如果移动到neighbor可能与其他蛇发生碰撞
          const nextPossiblePositions = getPossibleMoves(otherHead, boxSize);
          for (const nextPos of nextPossiblePositions) {
            if (nextPos.x === neighbor.x && nextPos.y === neighbor.y) {
              // 调高风险，但不一定完全排除(如果有护盾可能会想要碰撞)
              potentialCollision = true;
              break;
            }
          }
        }
      }
      
      // 计算通过当前节点到邻居的代价
      let tentativeGScore = current.gScore + 1;
      
      // 根据风险调整代价
      tentativeGScore += (risk / 20);
      
      // 如果有潜在碰撞风险，大幅增加代价
      if (potentialCollision) {
        tentativeGScore += 10;
      }
      
      // 获取或创建邻居节点
      let neighbor_node = nodeMap.get(neighborKey);
      const isNewNode = !neighbor_node;
      
      // 如果是新节点，创建它
      if (isNewNode) {
        neighbor_node = {
          position: neighbor,
          gScore: Infinity,
          fScore: Infinity,
          parent: null
        };
        nodeMap.set(neighborKey, neighbor_node);
      }
      
      // 确保neighbor_node不是undefined
      if (neighbor_node) {
        // 如果找到更好的路径
        if (tentativeGScore < neighbor_node.gScore) {
          // 更新节点
          neighbor_node.parent = current;
          neighbor_node.gScore = tentativeGScore;
          neighbor_node.fScore = tentativeGScore + heuristic(neighbor, target);
          
          // 如果是新节点，添加到开放列表
          if (isNewNode) {
            openSet.push(neighbor_node);
          }
        }
      }
    }
  }
  
  // 没找到路径
  return null;
}

// 启发式函数（曼哈顿距离）
function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 重建路径
function reconstructPath(node: PathNode): Position[] {
  const path: Position[] = [];
  let current: PathNode | null = node;
  
  // 从目标节点回溯到起始节点
  while (current && current.parent) {
    path.unshift(current.position);
    current = current.parent;
  }
  
  return path;
}

// 防御性移动策略
function defensiveMove(snake: Snake, gameState: GameState, riskMap: Map<string, number>): void {
  const head = snake.getBody()[0];
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  
  // 获取所有可能的移动
  const possibleMoves = getPossibleMoves(head, boxSize);
  
  // 评估每个移动的风险
  const movesWithRisk = possibleMoves.map(move => {
    const key = `${move.x},${move.y}`;
    const risk = riskMap.get(key) || 100;
    
    // 检查是否是自身反向移动
    const direction = getDirection(head, move);
    const isOpposite = direction && isOppositeDirection(direction, snake.getPrevDirection());
    
    // 检查此移动是否会导致立即碰撞
    let willCollide = false;
    
    // 检查是否是陷阱
    let isTrap = false;
    for (const food of gameState.entities.foodItems) {
      if (food.getType() === FoodType.TRAP) {
        const pos = food.getPosition();
        if (pos.x === move.x && pos.y === move.y) {
          isTrap = true;
          break;
        }
      }
    }
    
    // 检查与其他蛇的潜在碰撞
    for (const otherSnake of gameState.entities.snakes) {
      if (otherSnake === snake || !otherSnake.isAlive()) continue;
      
      const otherHead = otherSnake.getBody()[0];
      const otherNextMoves = getPossibleMoves(otherHead, boxSize);
      
      // 如果对方蛇的下一步可能位置与我们的下一步位置相同
      if (otherNextMoves.some(nextMove => 
        nextMove.x === move.x && nextMove.y === move.y)) {
        willCollide = true;
        break;
      }
      
      // 如果对方蛇的头部就是我们的下一步位置
      if (otherHead.x === move.x && otherHead.y === move.y) {
        willCollide = true;
        break;
      }
      
      // 检查对方蛇的身体是否会挡住我们的下一步
      for (const segment of otherSnake.getBody()) {
        if (segment.x === move.x && segment.y === move.y) {
          // 如果是尾巴，可能会移动所以风险较低
          if (segment === otherSnake.getBody()[otherSnake.getBody().length - 1]) {
            continue;
          }
          willCollide = true;
          break;
        }
      }
    }
    
    // 反向移动风险最高，陷阱次之，碰撞第三
    let moveRisk = risk;
    if (isOpposite) moveRisk = 100;
    if (isTrap) moveRisk = 95;
    if (willCollide) moveRisk = 90;
    
    return { move, risk: moveRisk };
  });
  
  // 按风险排序
  movesWithRisk.sort((a, b) => a.risk - b.risk);
  
  // 选择风险最低的移动
  if (movesWithRisk.length > 0 && movesWithRisk[0].risk < 70) {
    const bestMove = movesWithRisk[0].move;
    const direction = getDirection(head, bestMove);
    if (direction) {
      snake.setDirection(direction);
    }
  }
}

// 判断是否应该使用护盾
function shouldUseShield(snake: Snake, gameState: GameState): boolean {
  // 如果护盾在冷却或蛇得分不够，不使用护盾
  if (snake.getShieldCooldown() > 0 || snake.getScore() < GameConfig.SHIELD.COST) {
    return false;
  }
  
  const head = snake.getBody()[0];
  const boxSize = GameConfig.CANVAS.BOX_SIZE;
  
  // 检查是否有蛇在附近
  for (const otherSnake of gameState.entities.snakes) {
    if (otherSnake === snake || !otherSnake.isAlive()) continue;
    
    const otherHead = otherSnake.getBody()[0];
    const distance = Math.abs(head.x - otherHead.x) + Math.abs(head.y - otherHead.y);
    
    // 如果另一条蛇非常近，考虑使用护盾
    if (distance <= 2 * boxSize) {
      return true;
    }
  }
  
  return false;
}

// 获取可能的移动位置
function getPossibleMoves(position: Position, boxSize: number): Position[] {
  return [
    { x: position.x - boxSize, y: position.y },
    { x: position.x + boxSize, y: position.y },
    { x: position.x, y: position.y - boxSize },
    { x: position.x, y: position.y + boxSize },
  ];
}

// 获取从一个位置到另一个位置的方向
function getDirection(from: Position, to: Position): Direction | null {
  if (to.x < from.x) return Direction.LEFT;
  if (to.x > from.x) return Direction.RIGHT;
  if (to.y < from.y) return Direction.UP;
  if (to.y > from.y) return Direction.DOWN;
  return null;
}

// 判断两个方向是否相反
function isOppositeDirection(dir1: Direction, dir2: Direction): boolean {
  return (
    (dir1 === Direction.LEFT && dir2 === Direction.RIGHT) ||
    (dir1 === Direction.RIGHT && dir2 === Direction.LEFT) ||
    (dir1 === Direction.UP && dir2 === Direction.DOWN) ||
    (dir1 === Direction.DOWN && dir2 === Direction.UP)
  );
}

// 随机打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 路径节点接口
interface PathNode {
  position: Position;
  gScore: number;
  fScore: number;
  parent: PathNode | null;
} 