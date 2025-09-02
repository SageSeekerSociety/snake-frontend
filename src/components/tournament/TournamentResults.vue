<template>
  <div class="tournament-results">
    <div class="content-card pixel-border">
      <!-- 比赛总结标题 -->
      <div class="results-header">
        <h3 class="results-title">{{ tournament.name }} - 比赛结果</h3>
        <div class="results-meta">
          <span class="completion-time">完成时间: {{ formatCompletionTime() }}</span>
          <span class="total-participants">总参赛人数: {{ tournament.allParticipants.length }}</span>
        </div>
      </div>

      <!-- 获奖统计 -->
      <div class="awards-summary">
        <h4>获奖统计</h4>
        <div class="awards-grid">
          <div 
            v-for="(count, award) in awardsSummary"
            :key="award"
            class="award-summary-item"
            :class="getAwardClass(award)"
          >
            <div class="award-icon">{{ getAwardIcon(award) }}</div>
            <div class="award-info">
              <div class="award-name">{{ award }}</div>
              <div class="award-count">{{ count }} 人</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 各阶段结果 -->
      <div class="stages-results">
        <h4>各阶段详情</h4>
        
        <!-- 决赛结果 -->
        <div v-if="finalsResults.length > 0" class="stage-results finals-results">
          <div class="stage-results-header">
            <h5>🏆 决赛结果</h5>
            <span class="stage-participant-count">{{ finalsResults.length }} 人</span>
          </div>
          <div class="winners-podium">
            <!-- 前三名特殊展示 -->
            <div class="podium-container">
              <div v-if="finalsResults[1]" class="podium-place second-place">
                <div class="place-rank">2</div>
                <div class="place-participant">
                  <div class="participant-username">{{ finalsResults[1].participant?.username }}</div>
                  <div class="participant-nickname">{{ finalsResults[1].participant?.nickname }}</div>
                </div>
                <div class="place-points">{{ finalsResults[1].totalPoints }}分</div>
                <div class="place-medal silver">🥈</div>
              </div>
              
              <div v-if="finalsResults[0]" class="podium-place first-place">
                <div class="place-rank">1</div>
                <div class="place-participant">
                  <div class="participant-username">{{ finalsResults[0].participant?.username }}</div>
                  <div class="participant-nickname">{{ finalsResults[0].participant?.nickname }}</div>
                </div>
                <div class="place-points">{{ finalsResults[0].totalPoints }}分</div>
                <div class="place-medal gold">🥇</div>
              </div>
              
              <div v-if="finalsResults[2]" class="podium-place third-place">
                <div class="place-rank">3</div>
                <div class="place-participant">
                  <div class="participant-username">{{ finalsResults[2].participant?.username }}</div>
                  <div class="participant-nickname">{{ finalsResults[2].participant?.nickname }}</div>
                </div>
                <div class="place-points">{{ finalsResults[2].totalPoints }}分</div>
                <div class="place-medal bronze">🥉</div>
              </div>
            </div>
          </div>
          
          <!-- 决赛完整排名 -->
          <div class="full-rankings">
            <h6>完整排名</h6>
            <div class="rankings-list">
              <div 
                v-for="result in finalsResults"
                :key="result.participantId"
                class="ranking-item"
                :class="{ 'top-three': result.rank <= 3 }"
              >
                <span class="rank">{{ result.rank }}</span>
                <span class="participant">
                  {{ result.participant?.username }} ({{ result.participant?.nickname }})
                </span>
                <span class="points">{{ result.totalPoints }}分</span>
                <span class="award">{{ result.award }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 附加赛结果 -->
        <div v-if="playoffResults.length > 0" class="stage-results playoffs-results">
          <div class="stage-results-header">
            <h5>⚔️ 附加赛结果</h5>
            <span class="stage-participant-count">{{ playoffResults.length }} 人</span>
          </div>
          <div class="results-table">
            <div 
              v-for="result in playoffResults"
              :key="result.participantId"
              class="result-row"
            >
              <span class="rank">{{ result.rank }}</span>
              <span class="participant">
                {{ result.participant?.username }} ({{ result.participant?.nickname }})
              </span>
              <span class="points">{{ result.totalPoints }}分</span>
              <span class="award">{{ result.award }}</span>
            </div>
          </div>
        </div>

        <!-- 小组赛结果汇总 -->
        <div v-if="groupStageResults.length > 0" class="stage-results group-results">
          <div class="stage-results-header">
            <h5>👥 小组赛结果</h5>
            <span class="stage-participant-count">{{ groupStageResults.length }} 人</span>
          </div>
          
          <!-- 按小组展示 -->
          <div class="groups-summary">
            <div 
              v-for="group in getGroupsSummary()"
              :key="group.id"
              class="group-summary"
            >
              <div class="group-summary-header">
                <h6>{{ group.name }}</h6>
                <span>{{ group.results.length }} 人</span>
              </div>
              <div class="group-results-list">
                <div 
                  v-for="result in group.results.slice(0, 6)"
                  :key="result.participantId"
                  class="group-result-item"
                  :class="{ 
                    'advanced': result.isAdvanced,
                    'awarded': result.award 
                  }"
                >
                  <span class="rank">{{ result.rank }}</span>
                  <span class="participant">{{ result.participant?.username }}</span>
                  <span class="points">{{ result.totalPoints }}分</span>
                  <span class="status">
                    <template v-if="result.isAdvanced">晋级</template>
                    <template v-else-if="result.award">{{ result.award }}</template>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="results-actions">
        <button @click="exportCompleteResults" class="pixel-button export-button">
          导出完整结果
        </button>
        <button @click="exportAwardsList" class="pixel-button awards-button">
          导出获奖名单
        </button>
        <button @click="generateCertificates" class="pixel-button certificates-button">
          生成获奖证书
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TournamentState, ParticipantStanding, Participant } from '../../types/Tournament';
import { TournamentConfig } from '../../services/tournamentConfigLoader';

const props = defineProps<{
  tournament: TournamentState;
  config: TournamentConfig | null;
}>();

// 扩展结果接口，包含参赛选手信息
interface EnrichedStanding extends ParticipantStanding {
  participant?: Participant;
}

// 获取所有结果并丰富参赛选手信息
const enrichStanding = (standing: ParticipantStanding): EnrichedStanding => {
  const participant = props.tournament.allParticipants.find(p => p.id === standing.participantId);
  return { ...standing, participant };
};

// 决赛结果
const finalsResults = computed(() => {
  const finalsStage = props.tournament.stages.finals;
  if (!finalsStage || finalsStage.groups.length === 0) return [];
  
  return finalsStage.groups[0]?.standings
    .map(enrichStanding)
    .sort((a, b) => a.rank - b.rank) || [];
});

// 附加赛结果
const playoffResults = computed(() => {
  const playoffsStage = props.tournament.stages.playoffs;
  if (!playoffsStage || playoffsStage.groups.length === 0) return [];
  
  return playoffsStage.groups[0]?.standings
    .map(enrichStanding)
    .sort((a, b) => a.rank - b.rank) || [];
});

// 小组赛结果
const groupStageResults = computed(() => {
  const groupStage = props.tournament.stages.group_stage;
  if (!groupStage) return [];
  
  const allStandings: EnrichedStanding[] = [];
  groupStage.groups.forEach(group => {
    group.standings.forEach(standing => {
      allStandings.push(enrichStanding(standing));
    });
  });
  
  return allStandings;
});

// 获奖统计
const awardsSummary = computed(() => {
  const awards: Record<string, number> = {};
  
  const allResults = [
    ...finalsResults.value,
    ...playoffResults.value,
    ...groupStageResults.value
  ];
  
  allResults.forEach(result => {
    if (result.award) {
      awards[result.award] = (awards[result.award] || 0) + 1;
    }
  });
  
  return awards;
});

// 获取小组汇总
const getGroupsSummary = () => {
  const groupStage = props.tournament.stages.group_stage;
  if (!groupStage) return [];
  
  return groupStage.groups.map(group => ({
    id: group.id,
    name: group.name,
    results: group.standings
      .map(enrichStanding)
      .sort((a, b) => a.rank - b.rank)
  }));
};

// 格式化完成时间
const formatCompletionTime = () => {
  const finalsStage = props.tournament.stages.finals;
  if (finalsStage?.endTime) {
    return new Date(finalsStage.endTime).toLocaleString('zh-CN');
  }
  return new Date().toLocaleString('zh-CN');
};

// 获取奖项样式类
const getAwardClass = (award: string) => {
  if (award.includes('一等奖')) return 'first-prize';
  if (award.includes('二等奖')) return 'second-prize';
  if (award.includes('三等奖')) return 'third-prize';
  if (award.includes('优胜奖')) return 'merit-prize';
  return 'other-prize';
};

// 获取奖项图标
const getAwardIcon = (award: string) => {
  if (award.includes('一等奖')) return '🥇';
  if (award.includes('二等奖')) return '🥈';
  if (award.includes('三等奖')) return '🥉';
  if (award.includes('优胜奖')) return '🏅';
  return '🏆';
};

// 导出完整结果
const exportCompleteResults = () => {
  // 动态导入Excel导出服务
  import('../../services/excelExportService').then(({ ExcelExportService }) => {
    ExcelExportService.exportTournamentResults(props.tournament, props.config);
  }).catch(error => {
    console.error('Excel导出失败:', error);
    // 备用方案：导出文本文件
    let content = `${props.tournament.name} - 完整比赛结果\n`;
    content += `完成时间: ${formatCompletionTime()}\n`;
    content += `总参赛人数: ${props.tournament.allParticipants.length}\n`;
    content += '='.repeat(60) + '\n\n';

    // 决赛结果
    if (finalsResults.value.length > 0) {
      content += '🏆 决赛结果\n';
      content += '-'.repeat(40) + '\n';
      finalsResults.value.forEach(result => {
        content += `${result.rank}. ${result.participant?.username} (${result.participant?.nickname}) - ${result.totalPoints}分`;
        if (result.award) content += ` [${result.award}]`;
        content += '\n';
      });
      content += '\n';
    }

    // 附加赛结果
    if (playoffResults.value.length > 0) {
      content += '⚔️ 附加赛结果\n';
      content += '-'.repeat(40) + '\n';
      playoffResults.value.forEach(result => {
        content += `${result.rank}. ${result.participant?.username} (${result.participant?.nickname}) - ${result.totalPoints}分`;
        if (result.award) content += ` [${result.award}]`;
        content += '\n';
      });
      content += '\n';
    }

    // 小组赛结果
    if (groupStageResults.value.length > 0) {
      content += '👥 小组赛结果\n';
      content += '-'.repeat(40) + '\n';
      getGroupsSummary().forEach(group => {
        content += `${group.name}:\n`;
        group.results.forEach(result => {
          content += `  ${result.rank}. ${result.participant?.username} - ${result.totalPoints}分`;
          if (result.award) content += ` [${result.award}]`;
          if (result.isAdvanced) content += ` [晋级${result.advancedTo}]`;
          content += '\n';
        });
        content += '\n';
      });
    }

    // 获奖统计
    content += '📊 获奖统计\n';
    content += '-'.repeat(40) + '\n';
    Object.entries(awardsSummary.value).forEach(([award, count]) => {
      content += `${award}: ${count} 人\n`;
    });

    // 下载文件
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.tournament.name}-完整结果.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// 导出获奖名单
const exportAwardsList = () => {
  // 动态导入Excel导出服务
  import('../../services/excelExportService').then(({ ExcelExportService }) => {
    ExcelExportService.exportAwardsList(props.tournament);
  }).catch(error => {
    console.error('Excel导出失败:', error);
    // 备用方案：导出文本文件
    let content = `${props.tournament.name} - 获奖名单\n`;
    content += `完成时间: ${formatCompletionTime()}\n`;
    content += '='.repeat(50) + '\n\n';

    // 按奖项分类
    const awardsByType: Record<string, EnrichedStanding[]> = {};
    const allResults = [
      ...finalsResults.value,
      ...playoffResults.value,
      ...groupStageResults.value
    ];

    allResults.forEach(result => {
      if (result.award) {
        if (!awardsByType[result.award]) {
          awardsByType[result.award] = [];
        }
        awardsByType[result.award].push(result);
      }
    });

    // 按奖项等级排序
    const awardOrder = ['一等奖', '二等奖', '三等奖', '优胜奖'];
    awardOrder.forEach(awardType => {
      Object.keys(awardsByType).forEach(award => {
        if (award.includes(awardType)) {
          content += `${getAwardIcon(award)} ${award} (${awardsByType[award].length}人)\n`;
          content += '-'.repeat(30) + '\n';
          
          awardsByType[award]
            .sort((a, b) => a.rank - b.rank)
            .forEach((result, index) => {
              content += `${index + 1}. ${result.participant?.username} (${result.participant?.nickname})\n`;
            });
          content += '\n';
        }
      });
    });

    // 下载文件
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.tournament.name}-获奖名单.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// 生成获奖证书（暂时只是导出名单格式）
const generateCertificates = () => {
  let content = `${props.tournament.name} - 获奖证书信息\n`;
  content += '='.repeat(60) + '\n\n';

  const allResults = [
    ...finalsResults.value,
    ...playoffResults.value,
    ...groupStageResults.value
  ];

  allResults
    .filter(result => result.award)
    .sort((a, b) => {
      // 按奖项等级和排名排序
      const awardOrder: Record<string, number> = { '一等奖': 1, '二等奖': 2, '三等奖': 3, '优胜奖': 4 };
      const aLevel = Math.min(...Object.entries(awardOrder).filter(([key]) => a.award!.includes(key)).map(([, value]) => value));
      const bLevel = Math.min(...Object.entries(awardOrder).filter(([key]) => b.award!.includes(key)).map(([, value]) => value));
      if (aLevel !== bLevel) return aLevel - bLevel;
      return a.rank - b.rank;
    })
    .forEach(result => {
      content += `证书编号: ${props.tournament.tournamentId.slice(0, 8).toUpperCase()}-${result.participantId.slice(-4).toUpperCase()}\n`;
      content += `获奖人员: ${result.participant?.username} (${result.participant?.nickname})\n`;
      content += `获得奖项: ${result.award}\n`;
      content += `总积分: ${result.totalPoints}分\n`;
      content += `比赛名称: ${props.tournament.name}\n`;
      content += `颁发日期: ${formatCompletionTime()}\n`;
      content += '-'.repeat(60) + '\n\n';
    });

  // 下载文件
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.tournament.name}-获奖证书信息.txt`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.tournament-results {
  height: auto;
  overflow: visible; /* 由外层页面容器滚动 */
}

/* Stretch card to fill full width within Tournament page */
.tournament-results > .content-card {
  width: 100%;
  align-items: stretch;
}

.results-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--border-color);
}

.results-title {
  color: var(--accent-color);
  font-size: 24px;
  margin-bottom: 10px;
}

.results-meta {
  display: flex;
  justify-content: center;
  gap: 30px;
  color: var(--text-secondary);
  font-size: 14px;
}

.awards-summary {
  margin-bottom: 40px;
}

.awards-summary h4 {
  color: var(--text-color);
  font-size: 18px;
  margin-bottom: 20px;
  text-align: center;
}

.awards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.award-summary-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border-radius: 8px;
  border: 2px solid transparent;
}

.award-summary-item.first-prize {
  background-color: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
}

.award-summary-item.second-prize {
  background-color: rgba(192, 192, 192, 0.1);
  border-color: rgba(192, 192, 192, 0.3);
}

.award-summary-item.third-prize {
  background-color: rgba(205, 127, 50, 0.1);
  border-color: rgba(205, 127, 50, 0.3);
}

.award-summary-item.merit-prize {
  background-color: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.3);
}

.award-icon {
  font-size: 24px;
}

.award-info {
  flex: 1;
}

.award-name {
  color: var(--text-color);
  font-weight: bold;
  margin-bottom: 2px;
}

.award-count {
  color: var(--text-secondary);
  font-size: 12px;
}

.stages-results {
  margin-bottom: 40px;
}

.stages-results h4 {
  color: var(--text-color);
  font-size: 18px;
  margin-bottom: 25px;
  text-align: center;
}

.stage-results {
  margin-bottom: 35px;
  padding: 25px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.stage-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stage-results-header h5 {
  color: var(--accent-color);
  font-size: 16px;
}

.stage-participant-count {
  color: var(--text-secondary);
  font-size: 12px;
  background-color: rgba(74, 222, 128, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 领奖台样式 */
.winners-podium {
  margin-bottom: 30px;
}

.podium-container {
  display: flex;
  justify-content: center;
  align-items: end;
  gap: 20px;
  margin-bottom: 30px;
}

.podium-place {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid;
  min-width: 150px;
  position: relative;
}

.first-place {
  border-color: #ffd700;
  background-color: rgba(255, 215, 0, 0.1);
  height: 200px;
}

.second-place {
  border-color: #c0c0c0;
  background-color: rgba(192, 192, 192, 0.1);
  height: 170px;
}

.third-place {
  border-color: #cd7f32;
  background-color: rgba(205, 127, 50, 0.1);
  height: 140px;
}

.place-rank {
  position: absolute;
  top: -15px;
  background-color: var(--card-bg);
  border: 2px solid;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: var(--text-color);
}

.first-place .place-rank { border-color: #ffd700; }
.second-place .place-rank { border-color: #c0c0c0; }
.third-place .place-rank { border-color: #cd7f32; }

.place-participant {
  text-align: center;
  margin: 15px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.participant-username {
  color: var(--text-color);
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 3px;
}

.participant-nickname {
  color: var(--text-secondary);
  font-size: 12px;
}

.place-points {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 10px;
}

.place-medal {
  font-size: 32px;
}

/* 完整排名表格 */
.full-rankings h6 {
  color: var(--text-color);
  font-size: 14px;
  margin-bottom: 15px;
  text-align: center;
}

.rankings-list,
.results-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-item,
.result-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 15px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  align-items: center;
}

.ranking-item.top-three {
  background-color: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.rank {
  font-weight: bold;
  color: var(--accent-color);
  width: 30px;
  text-align: center;
}

.participant {
  color: var(--text-color);
  font-size: 14px;
}

.points {
  color: var(--accent-color);
  font-weight: bold;
}

.award,
.status {
  color: #f59e0b;
  font-size: 12px;
  text-align: right;
}

/* 小组结果 */
.groups-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.group-summary {
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 15px;
}

.group-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.group-summary-header h6 {
  color: var(--accent-color);
  font-size: 14px;
}

.group-results-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-result-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 4px;
  align-items: center;
}

.group-result-item.advanced {
  background-color: rgba(74, 222, 128, 0.1);
}

.group-result-item.awarded {
  background-color: rgba(251, 191, 36, 0.1);
}

/* 操作按钮 */
.results-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 40px;
  padding-top: 30px;
  border-top: 2px solid var(--border-color);
}

.pixel-button {
  background-color: var(--button-color);
  color: #000;
  border: none;
  padding: 12px 20px;
  cursor: pointer;
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  text-transform: uppercase;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.pixel-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.export-button {
  background-color: rgba(168, 85, 247, 0.8);
  color: white;
}

.awards-button {
  background-color: rgba(251, 191, 36, 0.8);
  color: white;
}

.certificates-button {
  background-color: rgba(34, 197, 94, 0.8);
  color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .results-meta {
    flex-direction: column;
    gap: 10px;
  }

  .awards-grid {
    grid-template-columns: 1fr;
  }

  .podium-container {
    flex-direction: column;
    align-items: center;
  }

  .first-place,
  .second-place,
  .third-place {
    height: auto;
    width: 100%;
    max-width: 300px;
  }

  .groups-summary {
    grid-template-columns: 1fr;
  }

  .results-actions {
    flex-direction: column;
    align-items: center;
  }

  .ranking-item,
  .result-row {
    grid-template-columns: auto 1fr auto;
    gap: 10px;
  }

  .ranking-item .award,
  .result-row .status {
    grid-column: 2 / -1;
    text-align: left;
    margin-top: 5px;
  }
}
</style>
