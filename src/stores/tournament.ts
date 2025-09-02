import { reactive, readonly } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Player } from '../types/User';
import { 
  TournamentState, 
  PersistedTournamentState,
  Participant, 
  Group, 
  Stage,
  ParticipantStanding,
  MatchRecord,
  MatchResult,
  GroupingOptions,
  ImportedParticipant
} from '../types/Tournament';
import { tournamentConfigLoader, TournamentConfig } from '../services/tournamentConfigLoader';

const STORAGE_KEY = 'tournament-state';
const STATE_VERSION = '1.0.0';

// 创建初始状态
const createInitialState = (): TournamentState => ({
  tournamentId: uuidv4(),
  name: '',
  date: new Date().toISOString().split('T')[0],
  status: 'preparation',
  allParticipants: [],
  currentStage: 'group_stage',
  stages: {},
  createdAt: new Date(),
  updatedAt: new Date()
});

// 响应式状态
const state = reactive<{
  tournament: TournamentState;
  config: TournamentConfig | null;
  loading: boolean;
  error: string | null;
}>({
  tournament: createInitialState(),
  config: null,
  loading: false,
  error: null
});

class TournamentStore {
  /**
   * 初始化赛事系统
   */
  async initialize(): Promise<void> {
    state.loading = true;
    state.error = null;

    try {
      // 1. 加载配置
      state.config = await tournamentConfigLoader.loadConfig();
      
      // 2. 尝试恢复持久化状态
      const restored = this.restoreFromStorage();
      if (restored) {
        console.log('已恢复保存的赛事状态');
      } else {
        // 3. 创建新的赛事状态
        this.createNewTournament();
      }

      // 4. 监听其他页面的状态变化
      this.setupStorageListener();
      
      console.log('赛事系统初始化完成');
    } catch (error) {
      console.error('赛事系统初始化失败:', error);
      state.error = error instanceof Error ? error.message : '初始化失败';
    } finally {
      state.loading = false;
    }
  }

  /**
   * 创建新的赛事
   */
  private createNewTournament(): void {
    if (!state.config) {
      throw new Error('配置文件未加载');
    }

    const newState = createInitialState();
    newState.name = state.config.tournament.name;
    newState.date = state.config.tournament.date;

    // 初始化各阶段
    newState.stages = {};
    Object.keys(state.config.stages).forEach(stageId => {
      const stageConfig = state.config!.stages[stageId];
      newState.stages[stageId] = {
        id: stageId,
        name: stageConfig.name,
        description: stageConfig.description,
        status: 'pending',
        groups: []
      };
    });

    state.tournament = newState;
    this.persistToStorage();
  }

  /**
   * 从localStorage恢复状态
   */
  private restoreFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const persistedData: PersistedTournamentState = JSON.parse(stored);
      
      // 检查版本兼容性
      if (persistedData.version !== STATE_VERSION) {
        console.warn('状态版本不兼容，将创建新状态');
        return false;
      }

      // 检查数据是否过期（超过24小时）
      const now = Date.now();
      const age = now - persistedData.timestamp;
      if (age > 24 * 60 * 60 * 1000) {
        console.warn('状态数据过期，将创建新状态');
        return false;
      }

      // 恢复状态
      state.tournament = {
        ...persistedData.state,
        createdAt: new Date(persistedData.state.createdAt),
        updatedAt: new Date(persistedData.state.updatedAt)
      };

      return true;
    } catch (error) {
      console.error('恢复状态失败:', error);
      return false;
    }
  }

  /**
   * 持久化状态到localStorage
   */
  private persistToStorage(): void {
    try {
      const persistedData: PersistedTournamentState = {
        state: {
          ...state.tournament,
          updatedAt: new Date()
        },
        timestamp: Date.now(),
        version: STATE_VERSION
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedData));
    } catch (error) {
      console.error('状态持久化失败:', error);
    }
  }

  /**
   * 监听localStorage变化（其他页面的更新）
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const persistedData: PersistedTournamentState = JSON.parse(event.newValue);
          
          // 只有当时间戳更新时才同步
          const currentTimestamp = state.tournament.updatedAt.getTime();
          const newTimestamp = new Date(persistedData.state.updatedAt).getTime();
          
          if (newTimestamp > currentTimestamp) {
            console.log('检测到其他页面的状态更新，正在同步...');
            state.tournament = {
              ...persistedData.state,
              createdAt: new Date(persistedData.state.createdAt),
              updatedAt: new Date(persistedData.state.updatedAt)
            };
          }
        } catch (error) {
          console.error('同步其他页面状态失败:', error);
        }
      }
    });
  }

  /**
   * 导入参赛选手
   */
  async importParticipants(participants: ImportedParticipant[]): Promise<void> {
    const newParticipants: Participant[] = participants.map(p => ({
      id: uuidv4(),
      userId: Date.now() + Math.random(), // 临时ID
      username: p.username,
      nickname: p.nickname || p.username,
      email: p.email
    }));

    state.tournament.allParticipants = newParticipants;
    this.persistToStorage();

    console.log(`已导入 ${newParticipants.length} 名参赛选手`);
  }

  /**
   * 从现有用户列表中选择参赛选手
   */
  selectParticipantsFromUsers(users: Player[]): void {
    const participants: Participant[] = users.map(user => ({
      id: uuidv4(),
      userId: user.userId,
      username: user.username,
      nickname: user.nickname,
      email: '', // Player type doesn't have email field
      avatar: user.avatarId?.toString()
    }));

    state.tournament.allParticipants = participants;
    this.persistToStorage();

    console.log(`已选择 ${participants.length} 名参赛选手`);
  }

  /**
   * 自动分组
   */
  performGrouping(options: GroupingOptions): void {
    if (!state.config) {
      throw new Error('配置文件未加载');
    }

    const participants = [...state.tournament.allParticipants];
    
    if (participants.length === 0) {
      throw new Error('没有参赛选手');
    }

    // 检查参赛人数是否符合要求
    const requiredTotal = options.groupCount * options.groupSize;
    if (participants.length !== requiredTotal) {
      throw new Error(`参赛人数(${participants.length})不符合分组要求(${requiredTotal})`);
    }

    // 随机打乱参赛选手
    if (options.method === 'random') {
      this.shuffleArray(participants, options.seed);
    }

    // 分组
    const groups: Group[] = [];
    for (let i = 0; i < options.groupCount; i++) {
      const groupParticipants = participants.slice(
        i * options.groupSize, 
        (i + 1) * options.groupSize
      );

      groups.push({
        id: uuidv4(),
        name: `第${i + 1}组`,
        participants: groupParticipants,
        matches: [],
        standings: [],
        status: 'pending',
        currentRound: 0
      });
    }

    // 更新小组赛阶段
    const groupStage = state.tournament.stages.group_stage;
    if (groupStage) {
      groupStage.groups = groups;
      groupStage.status = 'pending';
    }

    this.persistToStorage();
    console.log(`已完成分组：${options.groupCount}组，每组${options.groupSize}人`);
  }

  /**
   * 数组随机打乱（Fisher-Yates 算法）
   */
  private shuffleArray<T>(array: T[], seed?: number): void {
    // 简单的种子随机数生成器
    let currentSeed = seed;
    let random = seed ? () => {
      currentSeed = (currentSeed! * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    } : Math.random;

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 手动调整分组
   */
  adjustGrouping(sourceGroupId: string, targetGroupId: string, participantId: string): void {
    const sourceGroup = this.findGroup(sourceGroupId);
    const targetGroup = this.findGroup(targetGroupId);

    if (!sourceGroup || !targetGroup) {
      throw new Error('找不到指定的小组');
    }

    const participantIndex = sourceGroup.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) {
      throw new Error('找不到指定的参赛选手');
    }

    // 移动参赛选手
    const [participant] = sourceGroup.participants.splice(participantIndex, 1);
    targetGroup.participants.push(participant);

    this.persistToStorage();
    console.log(`已将选手从${sourceGroup.name}移动到${targetGroup.name}`);
  }

  /**
   * 查找小组
   */
  private findGroup(groupId: string): Group | null {
    for (const stage of Object.values(state.tournament.stages)) {
      const group = stage.groups.find(g => g.id === groupId);
      if (group) return group;
    }
    return null;
  }

  /**
   * 开始某个阶段
   */
  startStage(stageId: string): void {
    const stage = state.tournament.stages[stageId];
    if (!stage) {
      throw new Error(`找不到阶段: ${stageId}`);
    }

    stage.status = 'in_progress';
    stage.startTime = new Date();
    state.tournament.currentStage = stageId;
    
    this.persistToStorage();
    console.log(`已开始阶段: ${stage.name}`);
  }

  /**
   * 完成某个阶段
   */
  completeStage(stageId: string): void {
    const stage = state.tournament.stages[stageId];
    if (!stage) {
      throw new Error(`找不到阶段: ${stageId}`);
    }

    stage.status = 'completed';
    stage.endTime = new Date();
    
    this.persistToStorage();
    console.log(`已完成阶段: ${stage.name}`);
  }

  /**
   * 设置赛事状态
   */
  setTournamentStatus(status: 'preparation' | 'in_progress' | 'completed'): void {
    state.tournament.status = status;
    state.tournament.updatedAt = new Date();
    this.persistToStorage();
    console.log(`赛事状态已更新为: ${status}`);
  }

  /**
   * 处理比赛结果并更新积分
   */
  async processMatchResult(result: {
    status?: string;
    matchId: string;
    groupId: string;
    roundNumber: number;
    playoff?: boolean;
    winnersNeeded?: number;
    scores: Array<{ username: string; rawScore: number; rank: number }>;
  }): Promise<void> {
    try {
      console.log('处理比赛结果:', result);
      
      // 验证必需字段
      if (!result.groupId) {
        console.error('比赛结果中缺少 groupId 字段:', result);
        throw new Error(`比赛结果中缺少 groupId 字段`);
      }
      
      if (!result.matchId) {
        console.error('比赛结果中缺少 matchId 字段:', result);
        throw new Error(`比赛结果中缺少 matchId 字段`);
      }

      const group = this.findGroup(result.groupId);
      if (!group) {
        console.error(`找不到小组: ${result.groupId}, 当前所有阶段:`, Object.keys(state.tournament.stages));
        console.error('当前所有小组:', Object.values(state.tournament.stages).flatMap(s => s.groups.map(g => ({id: g.id, name: g.name}))));
        throw new Error(`找不到小组: ${result.groupId}`);
      }

      // 找到对应的比赛记录
      const match = group.matches.find(m => m.id === result.matchId);
      if (!match) {
        throw new Error(`找不到比赛记录: ${result.matchId}`);
      }

      // 获取阶段配置
      const stageId = this.getStageIdByGroupId(result.groupId);
      const stageConfig = state.config?.stages[stageId];
      if (!stageConfig) {
        throw new Error(`找不到阶段配置: ${stageId}`);
      }

      // 计算积分
      const matchResults: MatchResult[] = result.scores.map(score => {
        const participant = group.participants.find(p => p.username === score.username);
        if (!participant) {
          throw new Error(`找不到参赛选手: ${score.username}`);
        }

        // 根据排名计算积分
        let roundPoints = 0;
        if (!result.playoff) {
          if (score.rank <= stageConfig.scoring.top_n) {
            roundPoints = stageConfig.scoring.points[score.rank - 1] || 0;
          }
        } else {
          // 加赛不累计积分，仅用于打破并列
          roundPoints = 0;
        }

        return {
          participantId: participant.id,
          rawScore: score.rawScore,
          roundPoints,
          rank: score.rank
        };
      });

      // 更新比赛记录
      match.status = 'completed';
      match.endTime = new Date();
      match.results = matchResults;
      if (typeof result.playoff === 'boolean') {
        (match as any).isPlayoff = result.playoff;
      }

      // 更新积分榜
      this.updateStandings(group, stageConfig);

      // 检查是否完成所有轮次
      if (group.currentRound >= stageConfig.rounds) {
        group.status = 'completed';
        
        // 处理晋级和获奖
        this.processStageOutcomes(group, stageConfig, stageId);
        
        // 检查当前阶段是否全部完成，如果是则推进到下一阶段
        this.checkAndAdvanceToNextStage(stageId);
      }

      // 如果是加赛结果，更新一次晋级/奖项（部分并列已被打破）
      if (result.playoff) {
        this.processStageOutcomes(group, stageConfig, stageId);
      }

      this.persistToStorage();
      console.log(`已处理比赛结果: ${result.groupId} 第${result.roundNumber}轮`);

    } catch (error) {
      console.error('处理比赛结果失败:', error);
      throw error;
    }
  }

  /**
   * 更新小组积分榜
   */
  private updateStandings(group: Group, stageConfig: any): void {
    const standingsMap = new Map<string, ParticipantStanding>();

    // 初始化积分榜
    group.participants.forEach(participant => {
      standingsMap.set(participant.id, {
        participantId: participant.id,
        totalPoints: 0,
        totalRawScore: 0, // 这个字段现在存储总的原始分数
        matches: [],
        rank: 0
      });
    });

    // 累计各轮成绩
    group.matches.forEach(match => {
      if (match.status === 'completed') {
        match.results.forEach(result => {
          const standing = standingsMap.get(result.participantId);
          if (standing) {
            standing.totalPoints += result.roundPoints;
            standing.totalRawScore += result.rawScore; // 累计原始分数作为小分
            standing.matches.push(result);
          }
        });
      }
    });

    // 收集所有加赛的最好名次（用于打破总分与小分都相同的并列）
    const playoffBestRank: Record<string, number | undefined> = {};
    group.matches
      .filter(m => (m as any).isPlayoff && m.status === 'completed')
      .forEach(m => {
        m.results.forEach(r => {
          const prev = playoffBestRank[r.participantId];
          if (prev === undefined || r.rank < prev) playoffBestRank[r.participantId] = r.rank;
        });
      });

    // 排序（先大分，后小分，最后用加赛名次打破并列）
    const standings = Array.from(standingsMap.values()).sort((a, b) => {
      // 先比较总积分
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      // 再比较总的原始分数(小分)
      if (a.totalRawScore !== b.totalRawScore) {
        return b.totalRawScore - a.totalRawScore;
      }
      // 使用加赛名次（名次小者优先）
      const aPr = playoffBestRank[a.participantId];
      const bPr = playoffBestRank[b.participantId];
      if (aPr !== undefined && bPr !== undefined && aPr !== bPr) {
        return aPr - bPr;
      }
      if (aPr !== undefined && bPr === undefined) return -1;
      if (aPr === undefined && bPr !== undefined) return 1;
      return 0;
    });

    // 分配排名（处理并列）：
    // 同时保留“竞技排名”规则：并列占据名次，后续名次跳过
    let lastPoints: number | null = null;
    let lastRaw: number | null = null;
    let processed = 0;
    let currentRank = 0;

    standings.forEach((standing) => {
      processed += 1;
      if (lastPoints === null || lastRaw === null || standing.totalPoints !== lastPoints || standing.totalRawScore !== lastRaw) {
        currentRank = processed;
        lastPoints = standing.totalPoints;
        lastRaw = standing.totalRawScore;
      }
      standing.rank = currentRank;
      // 清理上一轮的加赛标记/晋级标记，稍后根据本轮情况重新评估
      standing.needsPlayoff = false;
      standing.isAdvanced = standing.isAdvanced; // 保留可能由上一阶段设置的状态，但不会在本组内改变
    });

    // 如配置要求：当总积分与小分仍完全相同且本组已打满所有轮次，若某个结果区间（晋级或奖项）发生名额溢出，则标记需要加赛
    const requirePlayoff = Array.isArray(stageConfig.tiebreaker) && stageConfig.tiebreaker.includes('playoff_required');
    if (requirePlayoff && group.currentRound >= (stageConfig.rounds || 0)) {
      if (stageConfig.outcomes) {
        Object.values(stageConfig.outcomes).forEach((outcome: any) => {
          const ranksArr = Array.isArray(outcome.ranks) ? outcome.ranks : [outcome.ranks];
          const allowedRanks = Array.from(new Set(ranksArr as number[])).sort((a, b) => a - b);
          if (allowedRanks.length === 0) return;
          let slots = allowedRanks.length; // 可用名额 = 名次数
          for (const r of allowedRanks) {
            const atRank = standings.filter(s => s.rank === r);
            const cnt = atRank.length;
            if (cnt === 0) continue;
            if (cnt <= slots) {
              slots -= cnt;
              continue;
            }
            // 出现溢出：当前rank出现并列且剩余名额不足
            // 标记该rank全部为需要加赛
            atRank.forEach(s => { s.needsPlayoff = true; });
            // 不再继续检查更低优先级的rank
            break;
          }
        });
      }
    }

    group.standings = standings;
  }

  /**
   * 处理阶段结果（晋级、获奖）
   */
  private processStageOutcomes(group: Group, stageConfig: any, stageId: string): void {
    if (!stageConfig.outcomes) return;

    Object.entries(stageConfig.outcomes).forEach(([outcomeType, outcome]: [string, any]) => {
      const ranks = Array.isArray(outcome.ranks) ? outcome.ranks : [outcome.ranks];
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);

      group.standings.forEach(standing => {
        const inRange = standing.rank >= minRank && standing.rank <= maxRank;
        if (!inRange) return;
        // 晋级：若该名次处被标记需要加赛，则暂不授予，待加赛后再定
        if (outcome.destination) {
          if (!standing.needsPlayoff) {
            standing.isAdvanced = true;
            standing.advancedTo = outcome.destination;
          }
        }
        // 奖项：若该名次处被标记需要加赛，则暂不授予，待加赛后再定（不允许超额）
        if (outcome.award) {
          if (!standing.needsPlayoff) {
            standing.award = outcome.award;
          }
        }
      });
    });
  }

  /**
   * 根据小组ID获取阶段ID
   */
  private getStageIdByGroupId(groupId: string): string {
    for (const [stageId, stage] of Object.entries(state.tournament.stages)) {
      if (stage.groups.some(g => g.id === groupId)) {
        return stageId;
      }
    }
    throw new Error(`找不到小组对应的阶段: ${groupId}`);
  }

  /**
   * 添加移除参赛选手的方法
   */
  removeParticipant(participantId: string): void {
    const index = state.tournament.allParticipants.findIndex(p => p.id === participantId);
    if (index > -1) {
      state.tournament.allParticipants.splice(index, 1);
      this.persistToStorage();
      console.log(`已移除参赛选手: ${participantId}`);
    }
  }

  /**
   * 启动比赛执行监听器
   */
  startMatchResultListener(): void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tournament_match_result' && event.newValue) {
        try {
          const result = JSON.parse(event.newValue);
          this.processMatchResult(result);
        } catch (error) {
          console.error('处理比赛结果监听失败:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 存储监听器引用以便清理
    (window as any).tournamentMatchListener = handleStorageChange;
  }

  /**
   * 停止比赛执行监听器
   */
  stopMatchResultListener(): void {
    const listener = (window as any).tournamentMatchListener;
    if (listener) {
      window.removeEventListener('storage', listener);
      delete (window as any).tournamentMatchListener;
    }
  }

  /**
   * 清除所有状态（重新开始）
   */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.createNewTournament();
    console.log('已重置赛事状态');
  }

  /**
   * 获取只读状态
   */
  getState() {
    return readonly(state);
  }

  /**
   * 获取配置
   */
  getConfig(): TournamentConfig | null {
    return state.config;
  }

  /**
   * 检查当前阶段是否完成，如果完成则自动推进到下一阶段
   */
  private checkAndAdvanceToNextStage(currentStageId: string): void {
    const currentStage = state.tournament.stages[currentStageId];
    if (!currentStage) return;

    // 检查当前阶段的所有小组是否都已完成
    const allGroupsCompleted = currentStage.groups.every(group => group.status === 'completed');
    if (!allGroupsCompleted) return;

    // 标记当前阶段为完成
    currentStage.status = 'completed';
    currentStage.endTime = new Date();
    console.log(`阶段 ${currentStage.name} 已全部完成`);

    // 获取所有晋级选手并创建下一阶段
    this.createAdvancedStages(currentStageId);
  }

  /**
   * 创建下一阶段并安排晋级选手
   */
  private createAdvancedStages(sourceStageId: string): void {
    if (!state.config) return;

    const sourceStage = state.tournament.stages[sourceStageId];
    if (!sourceStage) return;

    // 收集所有晋级选手
    const advancedParticipants = new Map<string, Participant[]>(); // destination -> participants

    sourceStage.groups.forEach(group => {
      group.standings.forEach(standing => {
        if (standing.isAdvanced && standing.advancedTo) {
          const destination = standing.advancedTo;
          if (!advancedParticipants.has(destination)) {
            advancedParticipants.set(destination, []);
          }
          
          const participant = state.tournament.allParticipants.find(p => p.id === standing.participantId);
          if (participant) {
            advancedParticipants.get(destination)!.push(participant);
          }
        }
      });
    });

    // 为每个目标阶段创建或填充分组（即使阶段已存在也要填充groups）
    advancedParticipants.forEach((participants, destinationStageId) => {
      const existingStage = state.tournament.stages[destinationStageId];
      if (!existingStage) {
        // 阶段尚未存在，创建并填充
        this.createStageWithParticipants(destinationStageId, participants);
        return;
      }

      // 阶段已存在：若无小组则创建一个小组并填充参赛选手
      if (existingStage.groups.length === 0) {
        const stageConfig = state.config!.stages[destinationStageId];
        const group: Group = {
          id: `group_${destinationStageId}_1`,
          name: stageConfig?.name || destinationStageId,
          participants: participants,
          matches: [],
          standings: [],
          status: 'pending',
          currentRound: 0
        };
        existingStage.groups = [group];
        existingStage.status = 'pending';
        console.log(`已填充阶段 ${existingStage.name}，参赛选手 ${participants.length} 人`);
      } else {
        // 如果已有小组，合并参赛选手（去重）
        const group = existingStage.groups[0];
        const existingIds = new Set(group.participants.map(p => p.id));
        participants.forEach(p => {
          if (!existingIds.has(p.id)) group.participants.push(p);
        });
        console.log(`已更新阶段 ${existingStage.name} 参赛选手，总数 ${group.participants.length} 人`);
      }
    });

    // 检查是否需要更新当前阶段
    this.updateCurrentStage();
  }

  /**
   * 创建指定阶段并分配参赛选手
   */
  private createStageWithParticipants(stageId: string, participants: Participant[]): void {
    if (!state.config) return;

    const stageConfig = state.config.stages[stageId];
    if (!stageConfig) {
      console.error(`找不到阶段配置: ${stageId}`);
      return;
    }

    // 创建阶段
    const stage: Stage = {
      id: stageId,
      name: stageConfig.name,
      description: stageConfig.description,
      status: 'pending',
      groups: []
    };

    // 创建小组并分配参赛选手
    const group: Group = {
      id: `group_${stageId}_1`,
      name: stageConfig.name,
      participants: participants,
      matches: [],
      standings: [],
      status: 'pending',
      currentRound: 0
    };

    stage.groups = [group];
    state.tournament.stages[stageId] = stage;

    console.log(`已创建 ${stage.name}，参赛选手 ${participants.length} 人`);
  }

  /**
   * 对外暴露：确保从指定阶段生成并填充后续阶段（若未填充则填充）
   */
  ensureAdvancedStages(sourceStageId: string): void {
    this.createAdvancedStages(sourceStageId);
    this.persistToStorage();
  }

  /**
   * 更新当前阶段为下一个待开始的阶段
   */
  private updateCurrentStage(): void {
    // 查找第一个未完成的阶段
    const stageOrder = ['group_stage', 'playoffs', 'finals'];
    
    for (const stageId of stageOrder) {
      const stage = state.tournament.stages[stageId];
      if (stage && stage.status !== 'completed') {
        if (state.tournament.currentStage !== stageId) {
          state.tournament.currentStage = stageId;
          console.log(`当前阶段已切换到: ${stage.name}`);
        }
        return;
      }
    }

    // 如果所有阶段都完成了
    state.tournament.status = 'completed';
    console.log('所有阶段已完成！');
  }

  /**
   * 检查是否已准备就绪
   */
  isReady(): boolean {
    return !!state.config && !state.loading && !state.error;
  }
}

// 导出单例实例
export const tournamentStore = new TournamentStore();
