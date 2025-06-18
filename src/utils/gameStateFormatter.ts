import { GameRecordingFrame } from "../types/GameRecording";
import { Position } from "../types/Position";
import { VortexFieldApiData } from "../types/VortexField";

/**
 * 将游戏状态格式化为算法程序的输入格式
 */
export function formatGameStateForAlgorithm(frame: GameRecordingFrame, vortexData?: VortexFieldApiData): string {
  if (!frame || !frame.gameState) {
    return "无法获取游戏状态";
  }

  const { snakes, foodItems, obstacles } = frame.gameState;
  
  // 格式化蛇的位置
  const snakesData = snakes.map((snake, index) => {
    // 只取蛇的身体位置，不包括其他属性
    const body = snake.getBody() || [];
    const isAlive = snake.isAlive(); // 默认为活着
    
    return {
      index,
      body: body.map((pos: Position) => ({ x: pos.x, y: pos.y })),
      isAlive
    };
  });
  
  // 格式化食物位置
  const foodData = foodItems.map(food => {
    return {
      position: { x: food.getPosition().x, y: food.getPosition().y },
      value: food.getValue() || 1
    };
  });
  
  // 格式化障碍物位置
  const obstacleData = obstacles.map(obstacle => {
    return {
      position: { x: obstacle.getPosition().x, y: obstacle.getPosition().y }
    };
  });
  
  // 创建最终的输入对象
  const inputData = {
    tick: frame.tick,
    snakes: snakesData,
    food: foodData,
    obstacles: obstacleData,
    vortexField: vortexData || {
      stateCode: 0,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      param5: 0
    }
  };
  
  // 转换为JSON字符串并格式化
  return JSON.stringify(inputData, null, 2);
}

/**
 * 将游戏状态复制到剪贴板
 */
export async function copyGameStateToClipboard(frame: GameRecordingFrame): Promise<boolean> {
  try {
    const formattedState = formatGameStateForAlgorithm(frame);
    await navigator.clipboard.writeText(formattedState);
    return true;
  } catch (error) {
    console.error("Failed to copy game state to clipboard:", error);
    return false;
  }
}
