import { Snake } from '../entities/Snake';

/**
 * 蛇显示相关的工具函数
 */

/**
 * 生成蛇的占位符标记
 * @param snake 蛇实例
 * @returns 占位符字符串，格式: {SNAKE:id}
 */
export function createSnakePlaceholder(snake: Snake): string {
  return `{SNAKE:${snake.getId()}}`;
}

/**
 * 解析蛇占位符为HTML
 * @param text 包含占位符的文本
 * @param allSnakes 所有蛇的数组（用于根据ID查找蛇信息）
 * @returns 解析后的HTML字符串
 */
export function parseSnakePlaceholders(text: string, allSnakes: Snake[]): string {
  // 匹配格式：{SNAKE:id}
  const snakeRegex = /\{SNAKE:(\d+)\}/g;
  
  return text.replace(snakeRegex, (_, snakeId) => {
    const snake = allSnakes.find(s => s.getId() === parseInt(snakeId));
    if (!snake) {
      return `[Snake ${snakeId}]`; // 找不到蛇时的兜底显示
    }
    
    const snakeIndex = allSnakes.indexOf(snake) + 1;
    const name = snake.getMetadata()?.name || `Snake ${snakeIndex}`;
    const color = snake.getColor();
    const displayName = `#${snakeIndex} ${name}`;
    
    return `<span style="color: ${color}; font-weight: bold;">${displayName}</span>`;
  });
}

/**
 * 获取蛇的简单显示名称（不带HTML标签，用于日志等）
 * @param snake 蛇实例
 * @param allSnakes 所有蛇的数组
 * @returns 简单格式的名称
 */
export function getSnakeDisplayName(snake: Snake, allSnakes: Snake[]): string {
  const snakeIndex = snake.getMetadata()?.matchNumber ?? (allSnakes.indexOf(snake) + 1);
  const baseName = snake.getMetadata()?.name || `Snake ${snakeIndex}`;
  return `#${snakeIndex} ${baseName}`;
}