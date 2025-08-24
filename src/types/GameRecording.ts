import { User } from "./User";
import { Position } from "./Position";
import { FoodType } from "../config/GameConfig";
import { EntityType } from "./EntityType";
import { VortexFieldApiData } from "./VortexField";

// 序列化后的蛇数据结构（对应Snake.serialize()的返回值）
export interface SerializedSnake {
  position: Position;
  size: number;
  body: Position[];
  direction: number;
  score: number;
  alive: boolean;
  color: string;
  shieldActive: boolean;
  shieldCooldown: number;
  shieldDuration: number;
  metadata: {
    studentId?: string;
    name?: string;
    username?: string;
    [key: string]: any;
  };
  entityType: EntityType;
  // 宝箱钥匙系统相关属性
  heldKeyId?: string | null;
  keyHoldTime?: number;
}

// 序列化后的食物数据结构（对应Food.serialize()的返回值）
export interface SerializedFood {
  position: Position;
  size: number;
  value: number | string;
  color: string;
  type: FoodType;
  natural: boolean;
  ttl?: number;
  entityType: EntityType;
}

// 序列化后的障碍物数据结构（对应Obstacle.serialize()的返回值）
export interface SerializedObstacle {
  position: Position;
  size: number;
  entityType: EntityType;
}

// 序列化的宝箱
export interface SerializedTreasureChest {
  position: { x: number; y: number };
  size: number;
  score: number;
  isOpened: boolean;
  entityType: EntityType;
}

// 序列化的钥匙
export interface SerializedKey {
  position: { x: number; y: number };
  size: number;
  id: string;
  entityType: EntityType;
}

// 录制帧中的游戏状态（序列化后的数据）
export interface RecordingGameState {
  foodItems: SerializedFood[];
  obstacles: SerializedObstacle[];
  snakes: SerializedSnake[];
  vortexField: VortexFieldApiData;
  treasureChests?: SerializedTreasureChest[];
  keys?: SerializedKey[];
}

/**
 * Represents a single frame (tick) in a game recording
 */
export interface GameRecordingFrame {
  tick: number;
  gameState: RecordingGameState;
}

/**
 * Represents a complete game recording
 */
export interface GameRecording {
  id: string;
  timestamp: number;
  name: string;
  players: User[];
  frames: GameRecordingFrame[];
  totalTicks: number;
  finalScores: {
    name: string;
    username: string;
    score: number;
    isAlive: boolean;
  }[];
}
