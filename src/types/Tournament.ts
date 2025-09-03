import { Player } from './User';

// 参赛选手信息
export interface Participant {
  id: string;
  userId: number;
  username: string;
  nickname: string;
  email?: string;
  avatar?: string;
}

// 比赛结果
export interface MatchResult {
  participantId: string;
  rawScore: number;  // 游戏原始得分
  roundPoints: number;  // 本轮获得积分
  rank: number;  // 本轮排名
}

// 单轮比赛记录
export interface MatchRecord {
  id: string;
  roundNumber: number;
  status: 'pending' | 'running' | 'completed';
  isPlayoff?: boolean; // 是否为加赛
  startTime?: Date;
  endTime?: Date;
  results: MatchResult[];
  gameSessionId?: string;  // 关联的游戏会话ID
}

// 参赛选手的总积分记录
export interface ParticipantStanding {
  participantId: string;
  totalPoints: number;
  totalRawScore: number;  // 累计原始分数(小分)
  matches: MatchResult[];  // 各轮成绩
  rank: number;
  needsPlayoff?: boolean;  // 是否需要加赛
  award?: string;  // 获得的奖项
  isAdvanced?: boolean;  // 是否晋级下一阶段
  advancedTo?: string;  // 晋级到哪个阶段
}

// 小组/阶段信息
export interface Group {
  id: string;
  name: string;
  participants: Participant[];
  matches: MatchRecord[];
  standings: ParticipantStanding[];
  status: 'pending' | 'in_progress' | 'completed';
  currentRound: number;
}

// 赛事阶段状态
export interface Stage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  groups: Group[];
  startTime?: Date;
  endTime?: Date;
}

// 完整的赛事状态
export interface TournamentState {
  // 基础信息
  tournamentId: string;
  name: string;
  date: string;
  status: 'preparation' | 'in_progress' | 'completed';
  
  // 参赛选手
  allParticipants: Participant[];
  
  // 当前阶段
  currentStage: string;
  
  // 各阶段状态
  stages: Record<string, Stage>;
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

// 存储在localStorage中的状态结构
export interface PersistedTournamentState {
  state: TournamentState;
  timestamp: number;
  version: string;
}

// 导入选手时的数据格式
export interface ImportedParticipant {
  username: string;
  nickname?: string;
  email?: string;
}

// 分组选项
export interface GroupingOptions {
  method: 'random' | 'manual' | 'balanced';
  groupCount: number;
  /**
   * 固定每组人数（可选）。
   * 如果未提供，则按照 groupCount 对总人数进行均匀分配：
   * 前 remainder 组为 base+1 人，其余为 base 人。
   */
  groupSize?: number;
  seed?: number;  // 随机种子
}

// 比赛执行状态
export interface MatchExecutionState {
  groupId: string;
  roundNumber: number;
  participants: Participant[];
  status: 'preparing' | 'running' | 'completed';
  gameManager?: any;  // GameManager实例的引用
}

// 平分处理结果
export interface TiebreakerResult {
  participantIds: string[];
  reason: string;
  needsPlayoff: boolean;
}

// 晋级处理结果
export interface AdvancementResult {
  participantId: string;
  sourceStage: string;
  destinationStage: string;
  reason: string;
  award?: string;
}

// 统计数据
export interface TournamentStatistics {
  totalParticipants: number;
  completedMatches: number;
  totalMatches: number;
  averageScore: number;
  highestScore: number;
  playoffCount: number;
  stageProgress: Record<string, {
    completed: number;
    total: number;
    percentage: number;
  }>;
}
