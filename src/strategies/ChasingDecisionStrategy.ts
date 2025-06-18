import { Snake } from "../entities/Snake";
import { GameState } from "../types/GameState";
import { SnakeDecisionStrategy } from "../entities/Snake";
import { Direction } from "../config/GameConfig";

// 带参数的AI决策策略
export class ParameterizedAIDecisionStrategy implements SnakeDecisionStrategy {
  private aiAlgorithm: (snake: Snake, gameState: GameState, ...params: any[]) => void;
  private params: any[];

  constructor(
    aiAlgorithm: (snake: Snake, gameState: GameState, ...params: any[]) => void,
    ...params: any[]
  ) {
    this.aiAlgorithm = aiAlgorithm;
    this.params = params;
  }

  async makeDecision(snake: Snake, gameState: GameState): Promise<void> {
    // 调用AI算法并传递额外参数
    this.aiAlgorithm(snake, gameState, ...this.params);
  }

  // 清理资源
  cleanup(): void {
    // 参数化AI策略不需要特殊清理
  }
}

// 直线相撞决策策略
export class HeadOnCollisionStrategy implements SnakeDecisionStrategy {
  private fixedDirection: Direction;

  constructor(fixedDirection: Direction) {
    this.fixedDirection = fixedDirection;
  }

  async makeDecision(snake: Snake, _gameState: GameState): Promise<void> {
    // 简单地保持固定方向移动
    snake.setDirection(this.fixedDirection);
  }

  // 清理资源
  cleanup(): void {
    // 固定方向策略不需要特殊清理
  }
}