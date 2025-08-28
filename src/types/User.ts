import { ApiResponse } from "./Api";

/**
 * 用户信息接口
 */
export interface User {
  id: number;
  username: string;
  nickname: string;
  avatarId?: number;
  intro?: string;
}

/**
 * 用户信息接口
 */
export interface Player {
  userId: number;
  username: string;
  nickname: string;
  avatarId?: number;
  intro?: string;
  lastUpdate?: string;
}

/**
 * 获取玩家列表接口响应
 */
export type PlayersResponse = ApiResponse<Player[]>;