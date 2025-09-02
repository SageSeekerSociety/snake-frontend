import * as XLSX from 'xlsx';
import { TournamentState, ParticipantStanding, Participant } from '../types/Tournament';
import { TournamentConfig } from './tournamentConfigLoader';

export class ExcelExportService {
  /**
   * 导出完整赛事结果到Excel
   */
  static exportTournamentResults(tournament: TournamentState, config: TournamentConfig | null): void {
    const wb = XLSX.utils.book_new();

    // 1. 总览工作表
    const overviewData = this.createOverviewData(tournament, config);
    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, '总览');

    // 2. 决赛结果工作表
    const finalsStage = tournament.stages.finals;
    if (finalsStage && finalsStage.groups.length > 0) {
      const finalsData = this.createStageResultData(finalsStage.groups[0], '决赛', tournament.allParticipants);
      const finalsWs = XLSX.utils.aoa_to_sheet(finalsData);
      XLSX.utils.book_append_sheet(wb, finalsWs, '决赛结果');
    }

    // 3. 附加赛结果工作表
    const playoffsStage = tournament.stages.playoffs;
    if (playoffsStage && playoffsStage.groups.length > 0) {
      const playoffsData = this.createStageResultData(playoffsStage.groups[0], '附加赛', tournament.allParticipants);
      const playoffsWs = XLSX.utils.aoa_to_sheet(playoffsData);
      XLSX.utils.book_append_sheet(wb, playoffsWs, '附加赛结果');
    }

    // 4. 小组赛结果工作表
    const groupStage = tournament.stages.group_stage;
    if (groupStage && groupStage.groups.length > 0) {
      groupStage.groups.forEach((group, index) => {
        const groupData = this.createStageResultData(group, group.name, tournament.allParticipants);
        const groupWs = XLSX.utils.aoa_to_sheet(groupData);
        XLSX.utils.book_append_sheet(wb, groupWs, `${group.name}`);
      });
    }

    // 5. 获奖名单工作表
    const awardsData = this.createAwardsData(tournament);
    const awardsWs = XLSX.utils.aoa_to_sheet(awardsData);
    XLSX.utils.book_append_sheet(wb, awardsWs, '获奖名单');

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tournament.name}-完整结果-${timestamp}.xlsx`;

    // 下载文件
    XLSX.writeFile(wb, filename);
  }

  /**
   * 导出获奖名单到Excel
   */
  static exportAwardsList(tournament: TournamentState): void {
    const wb = XLSX.utils.book_new();

    // 按奖项分类整理数据
    const awardsByType = this.groupParticipantsByAward(tournament);

    // 为每个奖项创建工作表
    Object.entries(awardsByType).forEach(([awardType, participants]) => {
      const data = [
        [`${awardType} 获奖名单`],
        [],
        ['排名', '学号', '姓名', '总积分', '最高分', '来源阶段']
      ];

      participants.forEach((participant, index) => {
        data.push([
          index + 1,
          participant.username,
          participant.nickname,
          participant.totalPoints,
          participant.totalRawScore,
          participant.sourceStage || '未知'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // 设置列宽
      ws['!cols'] = [
        { width: 8 },   // 排名
        { width: 15 },  // 学号
        { width: 20 },  // 姓名
        { width: 12 },  // 总积分
        { width: 12 },  // 最高分
        { width: 15 }   // 来源阶段
      ];

      // 使用安全的工作表名称
      const sheetName = awardType.replace(/[*?:\/\\[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tournament.name}-获奖名单-${timestamp}.xlsx`;

    // 下载文件
    XLSX.writeFile(wb, filename);
  }

  /**
   * 导出参赛选手名单到Excel
   */
  static exportParticipantsList(participants: Participant[], tournamentName: string): void {
    const wb = XLSX.utils.book_new();

    const data = [
      ['参赛选手名单'],
      [],
      ['序号', '学号', '姓名', '邮箱']
    ];

    participants.forEach((participant, index) => {
      data.push([
        (index + 1).toString(),
        participant.username,
        participant.nickname,
        participant.email || ''
      ]);
    });

    data.push([]);
    data.push([`总计: ${participants.length} 人`]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    ws['!cols'] = [
      { width: 8 },   // 序号
      { width: 15 },  // 学号
      { width: 20 },  // 姓名
      { width: 25 }   // 邮箱
    ];

    XLSX.utils.book_append_sheet(wb, ws, '参赛选手名单');

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tournamentName}-参赛选手名单-${timestamp}.xlsx`;

    // 下载文件
    XLSX.writeFile(wb, filename);
  }

  /**
   * 创建总览数据
   */
  private static createOverviewData(tournament: TournamentState, config: TournamentConfig | null): any[][] {
    const data = [
      [tournament.name],
      [],
      ['比赛信息'],
      ['比赛日期', tournament.date],
      ['参赛人数', tournament.allParticipants.length],
      ['比赛状态', this.getStatusText(tournament.status)],
      []
    ];

    // 各阶段统计
    data.push(['各阶段统计']);
    Object.entries(tournament.stages).forEach(([stageId, stage]) => {
      const totalParticipants = stage.groups.reduce((sum, group) => sum + group.participants.length, 0);
      const completedMatches = stage.groups.reduce((sum, group) => sum + group.matches.length, 0);
      
      data.push([
        stage.name,
        this.getStatusText(stage.status),
        `${totalParticipants}人参赛`,
        `${completedMatches}场比赛`
      ]);
    });

    data.push([]);

    // 获奖统计
    const awardsSummary = this.getAwardsSummary(tournament);
    if (Object.keys(awardsSummary).length > 0) {
      data.push(['获奖统计']);
      Object.entries(awardsSummary).forEach(([award, count]) => {
        data.push([award, `${count}人`]);
      });
    }

    return data;
  }

  /**
   * 创建阶段结果数据
   */
  private static createStageResultData(group: any, stageName: string, allParticipants: Participant[]): any[][] {
    const data = [
      [`${stageName} - ${group.name || ''}结果`],
      [],
      ['排名', '学号', '姓名', '总积分', '最高分', '状态', '奖项']
    ];

    group.standings.forEach((standing: ParticipantStanding) => {
      const participant = allParticipants.find(p => p.id === standing.participantId);
      
      let status = '';
      if (standing.isAdvanced) {
        status = `晋级${standing.advancedTo}`;
      }
      if (standing.needsPlayoff) {
        status += (status ? ', ' : '') + '需要加赛';
      }

      data.push([
        standing.rank.toString(),
        participant?.username || '未知',
        participant?.nickname || '未知',
        standing.totalPoints.toString(),
        standing.totalRawScore.toString(),
        status,
        standing.award || ''
      ]);
    });

    // 添加各轮详细成绩
    if (group.matches && group.matches.length > 0) {
      data.push([]);
      data.push(['各轮详细成绩']);
      
      // 创建轮次标题
      const roundHeaders = ['学号', '姓名'];
      const maxRounds = Math.max(...group.matches.map((m: any) => m.roundNumber));
      for (let i = 1; i <= maxRounds; i++) {
        roundHeaders.push(`第${i}轮积分`, `第${i}轮排名`, `第${i}轮原始分`);
      }
      data.push(roundHeaders);

      // 为每个参赛选手创建详细成绩行
      group.participants.forEach((participant: Participant) => {
        const row = [participant.username, participant.nickname];
        
        for (let round = 1; round <= maxRounds; round++) {
          const match = group.matches.find((m: any) => m.roundNumber === round);
          if (match) {
            const result = match.results.find((r: any) => r.participantId === participant.id);
            if (result) {
              row.push(result.roundPoints, result.rank, result.rawScore);
            } else {
              row.push('', '', '');
            }
          } else {
            row.push('', '', '');
          }
        }
        
        data.push(row);
      });
    }

    return data;
  }

  /**
   * 创建获奖名单数据
   */
  private static createAwardsData(tournament: TournamentState): any[][] {
    const data = [
      ['获奖名单汇总'],
      [],
      ['奖项', '学号', '姓名', '总积分', '最高分', '来源阶段']
    ];

    const allAwardedParticipants = this.getAllAwardedParticipants(tournament);
    
    // 按奖项排序
    const awardOrder = ['一等奖', '二等奖', '三等奖', '优胜奖'];
    allAwardedParticipants.sort((a, b) => {
      const aLevel = awardOrder.findIndex(award => a.award!.includes(award));
      const bLevel = awardOrder.findIndex(award => b.award!.includes(award));
      
      if (aLevel !== bLevel) {
        return aLevel - bLevel;
      }
      
      return a.rank - b.rank;
    });

    allAwardedParticipants.forEach(participant => {
      data.push([
        participant.award,
        participant.username,
        participant.nickname,
        participant.totalPoints,
        participant.totalRawScore,
        participant.sourceStage
      ]);
    });

    return data;
  }

  /**
   * 按奖项分组参赛选手
   */
  private static groupParticipantsByAward(tournament: TournamentState): Record<string, any[]> {
    const awardsByType: Record<string, any[]> = {};
    
    const allAwardedParticipants = this.getAllAwardedParticipants(tournament);
    
    allAwardedParticipants.forEach(participant => {
      if (!awardsByType[participant.award!]) {
        awardsByType[participant.award!] = [];
      }
      awardsByType[participant.award!].push(participant);
    });

    return awardsByType;
  }

  /**
   * 获取所有获奖参赛选手
   */
  private static getAllAwardedParticipants(tournament: TournamentState): any[] {
    const awardedParticipants: any[] = [];

    Object.entries(tournament.stages).forEach(([stageId, stage]) => {
      stage.groups.forEach(group => {
        group.standings.forEach(standing => {
          if (standing.award) {
            const participant = tournament.allParticipants.find(p => p.id === standing.participantId);
            if (participant) {
              awardedParticipants.push({
                ...standing,
                username: participant.username,
                nickname: participant.nickname,
                sourceStage: stage.name,
                award: standing.award
              });
            }
          }
        });
      });
    });

    return awardedParticipants;
  }

  /**
   * 获取获奖统计
   */
  private static getAwardsSummary(tournament: TournamentState): Record<string, number> {
    const summary: Record<string, number> = {};

    Object.entries(tournament.stages).forEach(([stageId, stage]) => {
      stage.groups.forEach(group => {
        group.standings.forEach(standing => {
          if (standing.award) {
            summary[standing.award] = (summary[standing.award] || 0) + 1;
          }
        });
      });
    });

    return summary;
  }

  /**
   * 获取状态文本
   */
  private static getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      preparation: '准备中',
      in_progress: '进行中',
      completed: '已完成',
      pending: '等待中'
    };
    return statusMap[status] || status;
  }
}