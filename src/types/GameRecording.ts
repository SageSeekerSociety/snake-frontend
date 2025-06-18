import { User } from "./User";
import { GameState } from "./GameState";

/**
 * Represents a single frame (tick) in a game recording
 */
export interface GameRecordingFrame {
  tick: number;
  gameState: GameState;
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
