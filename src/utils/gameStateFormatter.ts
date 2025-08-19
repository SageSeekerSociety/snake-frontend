import { GameRecordingFrame } from "../types/GameRecording";
import { VortexFieldApiData } from "../types/VortexField";
import { FoodType } from "../config/GameConfig";
import { EntityType } from "../types/EntityType";

/**
 * Convert game state to algorithm program input format (same as sandboxService formatGameStateForAPI)
 */
export function formatGameStateForAlgorithm(frame: GameRecordingFrame, vortexData?: VortexFieldApiData): string {
  if (!frame || !frame.gameState) {
    return "无法获取游戏状态";
  }

  const { snakes, foodItems, obstacles } = frame.gameState;
  
  // Start with remaining ticks (use current tick for demonstration)
  let input = `${frame.tick}\n`;

  // Special items (food and obstacles)
  const items = [...foodItems, ...obstacles];
  input += `${items.length}\n`;

  // Add food and obstacles
  items.forEach((item) => {
    const pos = item.position;
    const x = Math.floor(pos.x / 20); // Convert to grid coordinates
    const y = Math.floor(pos.y / 20);

    let value;
    if (item.entityType === EntityType.FOOD) {
      const food = item as any;
      // Convert different food types to API format
      if (food.type === FoodType.GROWTH) {
        value = -1; // Growth bean
      } else if (food.type === FoodType.TRAP) {
        value = -2; // Trap
      } else {
        value = Number(food.value); // Normal food
      }
    } else {
      value = -4; // Wall
    }

    // Note: Input format requires y,x order (coordinate system difference)
    input += `${y} ${x} ${value}\n`;
  });

  // Alive players
  const aliveSnakes = snakes.filter((snake) => snake.alive);
  input += `${aliveSnakes.length}\n`;

  // Add each snake's information
  aliveSnakes.forEach((snake, index) => {
    const length = snake.body.length;
    const score = snake.score;
    const dir = getDirectionValue(snake.direction);
    const shieldCooldown = snake.shieldCooldown;
    const shieldDuration = snake.shieldDuration;

    const studentId = snake.metadata.username || snake.metadata.studentId || index;

    input += `${studentId} ${length} ${score} ${dir} ${shieldCooldown} ${shieldDuration}\n`;

    snake.body.forEach((segment) => {
      const x = Math.floor(segment.x / 20);
      const y = Math.floor(segment.y / 20);
      input += `${y} ${x}\n`;
    });
  });

  // Add vortex field information (use recorded data or provided override)
  const vortexFieldToUse = vortexData || frame.gameState.vortexField;
  if (vortexFieldToUse) {
    input += `${vortexFieldToUse.stateCode} ${vortexFieldToUse.param1} ${vortexFieldToUse.param2} ${vortexFieldToUse.param3} ${vortexFieldToUse.param4} ${vortexFieldToUse.param5}\n`;
  } else {
    // Default inactive state
    input += `0 0 0 0 0 0\n`;
  }

  return input;
}

/**
 * Convert game direction to API number format
 */
const getDirectionValue = (direction: any): number => {
  // Direction enum values: LEFT=0, UP=1, RIGHT=2, DOWN=3
  return Number(direction) || 0;
};

/**
 * Copy game state to clipboard
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
