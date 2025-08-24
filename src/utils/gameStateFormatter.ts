import { GameRecordingFrame, SerializedFood, SerializedTreasureChest, SerializedKey, SerializedSnake } from "../types/GameRecording";
import { VortexFieldApiData } from "../types/VortexField";
import { FoodType } from "../config/GameConfig";
import { EntityType } from "../types/EntityType";
import { Direction } from "../config/GameConfig";

/**
 * Convert game state to algorithm program input format (same as sandboxService formatGameStateForAPI)
 */
export function formatGameStateForAlgorithm(frame: GameRecordingFrame, vortexData?: VortexFieldApiData): string {
  if (!frame || !frame.gameState) {
    return "无法获取游戏状态";
  }

  const { snakes, foodItems, obstacles, treasureChests = [], keys = [] } = frame.gameState;
  
  // Start with remaining ticks (use current tick for demonstration)
  let input = `${frame.tick}\n`;

  // Special items (food, obstacles, treasure chests, and keys)
  const items = [...foodItems, ...obstacles, ...treasureChests, ...keys];
  input += `${items.length}\n`;

  // Add food, obstacles, treasure chests, and keys
  items.forEach((item) => {
    const pos = item.position;
    const x = Math.floor(pos.x / 20); // Convert to grid coordinates
    const y = Math.floor(pos.y / 20);

    let value: number;
    if (item.entityType === EntityType.FOOD) {
      const food = item as SerializedFood;
      // Convert different food types to API format
      if (food.type === FoodType.GROWTH) {
        value = -1; // Growth bean
      } else if (food.type === FoodType.TRAP) {
        value = -2; // Trap
      } else {
        value = Number(food.value); // Normal food
      }
    } else if (item.entityType === EntityType.KEY) {
      value = -3; // Key (on ground)
    } else if (item.entityType === EntityType.TREASURE_CHEST) {
      value = -5; // Treasure chest
    } else {
      value = -4; // Wall/Obstacle
    }

    // Note: Input format requires y,x order (coordinate system difference)
    input += `${y} ${x} ${value}\n`;
  });

  // Alive players
  const aliveSnakes = snakes.filter((snake) => snake.alive);
  input += `${aliveSnakes.length}\n`;

  // Add each snake's information
  aliveSnakes.forEach((snake: SerializedSnake, index) => {
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
  // const vortexFieldToUse = vortexData || frame.gameState.vortexField;
  // if (vortexFieldToUse) {
  //   input += `${vortexFieldToUse.stateCode} ${vortexFieldToUse.param1} ${vortexFieldToUse.param2} ${vortexFieldToUse.param3} ${vortexFieldToUse.param4} ${vortexFieldToUse.param5}\n`;
  // } else {
  //   // Default inactive state
  //   input += `0 0 0 0 0 0\n`;
  // }

  // Add treasure chest information block at the end
  const openTreasures = treasureChests.filter((treasure: SerializedTreasureChest) => !treasure.isOpened);
  input += `${openTreasures.length}\n`;
  
  // Add each open treasure chest's position and score
  openTreasures.forEach((treasure: SerializedTreasureChest) => {
    const pos = treasure.position;
    const x = Math.floor(pos.x / 20);
    const y = Math.floor(pos.y / 20);
    const score = treasure.score;
    input += `${y} ${x} ${score}\n`;
  });

  // Add key information
  // Calculate total keys (ground + held by snakes)
  const groundKeys = keys;
  const heldKeysData: Array<{x: number, y: number, studentId: string, remainingTime: number}> = [];
  
  // Collect held key information from snakes
  snakes.filter(snake => snake.alive).forEach((snake: SerializedSnake) => {
    if (snake.heldKeyId) {
      const headPos = snake.body[0];
      const x = Math.floor(headPos.x / 20);
      const y = Math.floor(headPos.y / 20);
      const studentId = snake.metadata.username || snake.metadata.studentId || 'unknown';
      const remainingTime = 40 - (snake.keyHoldTime || 0); // Remaining time
      
      heldKeysData.push({ x, y, studentId, remainingTime });
    }
  });

  const totalKeys = groundKeys.length + heldKeysData.length;
  input += `${totalKeys}\n`;
  
  // Add ground keys (no holder)
  groundKeys.forEach((key: SerializedKey) => {
    const pos = key.position;
    const x = Math.floor(pos.x / 20);
    const y = Math.floor(pos.y / 20);
    input += `${y} ${x} -1 0\n`; // -1 means no holder, 0 means no hold time
  });
  
  // Add keys held by snakes
  heldKeysData.forEach((keyData) => {
    input += `${keyData.y} ${keyData.x} ${keyData.studentId} ${keyData.remainingTime}\n`;
  });

  return input;
}

/**
 * Convert game direction to API number format
 */
const getDirectionValue = (direction: Direction | number): number => {
  if (typeof direction === 'number') {
    return direction;
  }
  // Direction enum values: LEFT=0, UP=1, RIGHT=2, DOWN=3
  switch (direction) {
    case Direction.LEFT: return 0;
    case Direction.UP: return 1;
    case Direction.RIGHT: return 2;
    case Direction.DOWN: return 3;
    default: return 0;
  }
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
