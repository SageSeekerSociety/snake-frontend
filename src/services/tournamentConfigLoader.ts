import { load as yamlLoad } from 'js-yaml';

// 赛制配置类型定义
export interface ScoringConfig {
  type: 'rank_based';
  top_n: number;
  points: number[];
}

export interface OutcomeConfig {
  ranks: number[];
  destination?: string;
  award?: string;
}

export interface StageConfig {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  groups?: {
    count: number;
    size: number;
  };
  participants_from?: string;
  rounds: number;
  scoring: ScoringConfig;
  outcomes: Record<string, OutcomeConfig>;
  tiebreaker: string[];
}

export interface TournamentConfig {
  tournament: {
    name: string;
    date: string;
    time: string;
  };
  stages: Record<string, StageConfig>;
  display: {
    show_participant_list_before_match: boolean;
    show_realtime_scores: boolean;
    announcement_duration: number;
  };
}

class TournamentConfigLoader {
  private config: TournamentConfig | null = null;
  private loading = false;

  /**
   * 加载并解析赛事配置文件
   */
  async loadConfig(): Promise<TournamentConfig> {
    if (this.config) {
      return this.config;
    }

    if (this.loading) {
      // 等待正在进行的加载
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.config) {
        return this.config;
      }
    }

    this.loading = true;

    try {
      console.log('正在加载赛事配置...');
      const response = await fetch('/tournament-config.yaml');
      
      if (!response.ok) {
        throw new Error(`配置文件加载失败: ${response.status} ${response.statusText}`);
      }

      const yamlText = await response.text();
      const config = yamlLoad(yamlText) as TournamentConfig;

      // 配置验证
      this.validateConfig(config);
      
      this.config = config;
      console.log('赛事配置加载成功:', config.tournament.name);
      
      return config;
    } catch (error) {
      console.error('加载赛事配置时出错:', error);
      // 返回默认配置以防止应用崩溃
      return this.getDefaultConfig();
    } finally {
      this.loading = false;
    }
  }

  /**
   * 验证配置文件的基本结构
   */
  private validateConfig(config: any): void {
    if (!config.tournament) {
      throw new Error('配置文件缺少 tournament 部分');
    }

    if (!config.stages) {
      throw new Error('配置文件缺少 stages 部分');
    }

    const requiredStages = ['group_stage', 'playoffs', 'finals'];
    for (const stage of requiredStages) {
      if (!config.stages[stage]) {
        throw new Error(`配置文件缺少必需的阶段: ${stage}`);
      }

      const stageConfig = config.stages[stage];
      if (!stageConfig.scoring || !stageConfig.outcomes || !stageConfig.rounds) {
        throw new Error(`阶段 ${stage} 配置不完整`);
      }
    }
  }

  /**
   * 获取默认配置（当配置文件加载失败时使用）
   */
  private getDefaultConfig(): TournamentConfig {
    return {
      tournament: {
        name: '蛇王争霸赛（默认配置）',
        date: new Date().toISOString().split('T')[0],
        time: '14:00'
      },
      stages: {
        group_stage: {
          name: '小组赛',
          description: '所有参赛选手随机分为10个小组，每组20人',
          start_time: '14:00',
          end_time: '15:20',
          groups: { count: 10, size: 20 },
          rounds: 2,
          scoring: {
            type: 'rank_based',
            top_n: 8,
            points: [8, 7, 6, 5, 4, 3, 2, 1]
          },
          outcomes: {
            advance_to_finals: { ranks: [1, 2], destination: 'finals' },
            advance_to_playoffs: { ranks: [3], destination: 'playoffs' },
            award_merit: { ranks: [4, 5, 6], award: '优胜奖' }
          },
          tiebreaker: ['total_score', 'highest_raw_score', 'playoff_required']
        },
        playoffs: {
          name: '附加赛',
          description: '小组赛各组第3名组成新的小组进行比赛',
          start_time: '15:20',
          end_time: '15:30',
          participants_from: 'group_stage.advance_to_playoffs',
          rounds: 2,
          scoring: {
            type: 'rank_based',
            top_n: 10,
            points: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
          },
          outcomes: {
            award_third: { ranks: [1, 2, 3, 4], award: '三等奖' },
            award_merit: { ranks: [5, 6, 7, 8, 9, 10], award: '优胜奖' }
          },
          tiebreaker: ['total_score', 'highest_raw_score', 'playoff_required']
        },
        finals: {
          name: '决赛',
          description: '小组赛各组前2名合并为一组进行比赛',
          start_time: '15:30',
          end_time: '16:00',
          participants_from: 'group_stage.advance_to_finals',
          rounds: 3,
          scoring: {
            type: 'rank_based',
            top_n: 20,
            points: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
          },
          outcomes: {
            award_first: { ranks: [1, 2, 3, 4], award: '一等奖' },
            award_second: { ranks: [5, 6, 7, 8, 9, 10, 11, 12], award: '二等奖' },
            award_third: { ranks: [13, 14, 15, 16, 17, 18, 19, 20], award: '三等奖' }
          },
          tiebreaker: ['total_score', 'highest_raw_score', 'playoff_required']
        }
      },
      display: {
        show_participant_list_before_match: true,
        show_realtime_scores: false,
        announcement_duration: 5
      }
    };
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<TournamentConfig> {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * 获取已加载的配置（如果已加载）
   */
  getLoadedConfig(): TournamentConfig | null {
    return this.config;
  }
}

// 导出单例实例
export const tournamentConfigLoader = new TournamentConfigLoader();