<template>
  <div class="stage-view">
    <div class="content-card pixel-border">
      <!-- 阶段标题和状态 -->
      <div class="stage-header">
        <div class="stage-title">
          <h3>{{ stage?.name || '未知阶段' }}</h3>
          <div class="stage-description">{{ stage?.description }}</div>
        </div>
        <div class="stage-status">
          <span class="status-badge" :class="stage?.status">
            {{ getStatusText(stage?.status) }}
          </span>
          <div v-if="stage?.startTime" class="stage-time">
            开始时间: {{ formatTime(stage.startTime) }}
          </div>
        </div>
      </div>

      <!-- 阶段配置信息 -->
      <div v-if="config" class="stage-config">
        <div class="config-item">
          <span class="config-label">比赛轮数:</span>
          <span class="config-value">{{ config.rounds }}</span>
        </div>
        <div class="config-item">
          <span class="config-label">积分规则:</span>
          <span class="config-value">前{{ config.scoring.top_n }}名得分</span>
        </div>
        <div class="config-item">
          <span class="config-label">时间:</span>
          <span class="config-value">{{ config.start_time }} - {{ config.end_time }}</span>
        </div>
      </div>

      <!-- 小组列表 -->
      <div v-if="stage?.groups && stage.groups.length > 0" class="groups-section">
        <div class="section-header">
          <h4>小组比赛</h4>
          <div class="groups-progress">
            {{ completedGroups }}/{{ stage.groups.length }} 组完成
          </div>
        </div>

        <div class="groups-grid">
          <div 
            v-for="group in stage.groups"
            :key="group.id"
            class="group-card"
            :class="{ 
              'completed': group.status === 'completed',
              'in-progress': group.status === 'in_progress'
            }"
          >
            <!-- 小组标题 -->
            <div class="group-header">
              <div class="group-info">
                <div class="group-name">{{ group.name }}</div>
                <div class="group-meta">
                  {{ group.participants.length }} 人 | 第 {{ group.currentRound }}/{{ config?.rounds || 0 }} 轮
                </div>
              </div>
              <div class="group-status">
                <span class="status-indicator" :class="group.status"></span>
                {{ getGroupStatusText(group.status) }}
              </div>
            </div>

            <!-- 比赛控制 -->
            <div class="match-controls">
              <button 
                v-if="group.status === 'pending'"
                @click="startGroupMatch(group)"
                class="pixel-button start-button"
                :disabled="loading"
              >
                开始比赛
              </button>
              
              <button 
                v-else-if="group.status === 'in_progress' && group.currentRound < (config?.rounds || 0)"
                @click="startNextRound(group)"
                class="pixel-button next-round-button"
                :disabled="loading"
              >
                下一轮
              </button>
              
              <button 
                v-if="group.status === 'in_progress'"
                @click="openDisplayForGroup(group)"
                class="pixel-button display-button"
              >
                大屏显示
              </button>

              <div v-if="group.status === 'completed'" class="completion-info">
                ✓ 已完成所有轮次
              </div>

              <!-- 加赛：当出现需要加赛的并列时，提供一键加赛按钮 -->
              <button 
                v-if="hasPlayoffTie(group)"
                @click="startPlayoff(group)"
                class="pixel-button playoff-button"
                :disabled="loading"
              >
                一键加赛（打破并列）
              </button>
            </div>

            <!-- 当前积分榜 -->
            <div v-if="group.standings.length > 0" class="standings-preview">
              <div class="standings-header">
                <span>积分榜</span>
                <button @click="showFullStandings(group)" class="view-full-button">
                  查看详情
                </button>
              </div>
              <div class="standings-list">
                <div 
                  v-for="(standing, index) in group.standings.slice(0, 5)"
                  :key="standing.participantId"
                  class="standing-item"
                  :class="{ 'highlight': index < 3 }"
                >
                  <span class="rank">{{ standing.rank }}</span>
                  <span class="participant">
                    {{ getParticipantName(standing.participantId) }}
                  </span>
                  <span class="points">{{ standing.totalPoints }}分</span>
                  <span v-if="standing.award" class="award">{{ standing.award }}</span>
                </div>
                <div v-if="group.standings.length > 5" class="more-standings">
                  还有 {{ group.standings.length - 5 }} 人...
                </div>
              </div>
            </div>

            <!-- 比赛历史 -->
            <div v-if="group.matches.length > 0" class="matches-history">
              <div class="matches-header">
                比赛记录 ({{ group.matches.length }})
              </div>
              <div class="matches-list">
                <div 
                  v-for="match in group.matches.slice(-3)"
                  :key="match.id"
                  class="match-item"
                >
                  <span class="match-round">第{{ match.roundNumber }}轮</span>
                  <span class="match-status" :class="match.status">
                    {{ getMatchStatusText(match.status) }}
                  </span>
                  <span v-if="match.endTime" class="match-time">
                    {{ formatTime(match.endTime) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 阶段总结 -->
      <div v-if="stage?.status === 'completed'" class="stage-summary">
        <h4>阶段总结</h4>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">总参赛人数:</span>
            <span class="stat-value">{{ getTotalParticipants() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">完成比赛:</span>
            <span class="stat-value">{{ getTotalMatches() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">晋级人数:</span>
            <span class="stat-value">{{ getAdvancedCount() }}</span>
          </div>
        </div>
        
        <div class="stage-actions">
          <button @click="exportStageResults" class="pixel-button export-button">
            导出结果
          </button>
          <button @click="proceedToNextStage" class="pixel-button next-stage-button">
            进入下一阶段
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <!-- 详细积分榜弹窗 -->
    <div v-if="showStandingsModal" class="modal-overlay" @click="closeStandingsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ selectedGroup?.name }} - 详细积分榜</h4>
          <button @click="closeStandingsModal" class="close-button">×</button>
        </div>
        <div class="modal-body">
          <StandingsTable 
            v-if="selectedGroup" 
            :standings="selectedGroup.standings"
            :participants="selectedGroup.participants"
            :matches="selectedGroup.matches"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Stage, Group, MatchRecord } from '../../types/Tournament';
import { StageConfig } from '../../services/tournamentConfigLoader';
import { tournamentStore } from '../../stores/tournament';
import StandingsTable from './StandingsTable.vue';

const props = defineProps<{
  stage: Stage | undefined;
  config: StageConfig | undefined;
}>();

const emit = defineEmits<{
  'stage-completed': [stageId: string];
}>();

// 状态管理
const loading = ref(false);
const error = ref<string | null>(null);

// 弹窗状态
const showStandingsModal = ref(false);
const selectedGroup = ref<Group | null>(null);

// 比赛执行状态
const activeMatches = ref(new Map<string, any>()); // groupId -> match execution info

// 计算属性
const completedGroups = computed(() => {
  return props.stage?.groups.filter(g => g.status === 'completed').length || 0;
});

// 获取状态文本
const getStatusText = (status: string | undefined) => {
  const statusMap: Record<string, string> = {
    pending: '等待开始',
    in_progress: '进行中',
    completed: '已完成'
  };
  return statusMap[status || ''] || status;
};

const getGroupStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '待开始',
    in_progress: '比赛中',
    completed: '已完成'
  };
  return statusMap[status] || status;
};

const getMatchStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '进行中',
    completed: '已完成'
  };
  return statusMap[status] || status;
};

// 格式化时间
const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 获取参赛选手姓名
const getParticipantName = (participantId: string) => {
  if (!props.stage) return '未知';
  
  for (const group of props.stage.groups) {
    const participant = group.participants.find(p => p.id === participantId);
    if (participant) {
      return `${participant.username} (${participant.nickname})`;
    }
  }
  return '未知选手';
};

// 开始小组比赛
const startGroupMatch = async (group: Group) => {
  if (group.currentRound >= (props.config?.rounds || 0)) {
    error.value = '已完成所有轮次';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // 更新小组状态
    group.status = 'in_progress';
    group.currentRound = 1;

    // 创建比赛记录
    const match: MatchRecord = {
      id: `match_${group.id}_${Date.now()}`,
      roundNumber: group.currentRound,
      status: 'running',
      startTime: new Date(),
      results: []
    };
    
    group.matches.push(match);
    activeMatches.value.set(group.id, { match, group });

    // 向大屏发送开始比赛指令
    const matchCommand = {
      action: 'START_MATCH',
      matchId: match.id,
      groupId: group.id,
      groupName: group.name,
      roundNumber: group.currentRound,
      players: group.participants.map(p => ({
        userId: p.userId,
        username: p.username,
        nickname: p.nickname
      }))
    };

    localStorage.setItem('tournament_match_command', JSON.stringify(matchCommand));
    console.log(`开始 ${group.name} 第${group.currentRound}轮比赛`);

    // 开始监听比赛结果
    startListeningForResults(group.id);
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '开始比赛失败';
    group.status = 'pending';
  } finally {
    loading.value = false;
  }
};

// 开始下一轮比赛
const startNextRound = async (group: Group) => {
  if (group.currentRound >= (props.config?.rounds || 0)) {
    error.value = '已完成所有轮次';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    group.currentRound += 1;

    // 创建新的比赛记录
    const match: MatchRecord = {
      id: `match_${group.id}_${Date.now()}`,
      roundNumber: group.currentRound,
      status: 'running',
      startTime: new Date(),
      results: []
    };
    
    group.matches.push(match);
    activeMatches.value.set(group.id, { match, group });

    // 向大屏发送开始比赛指令
    const matchCommand = {
      action: 'START_MATCH',
      matchId: match.id,
      groupId: group.id,
      groupName: group.name,
      roundNumber: group.currentRound,
      players: group.participants.map(p => ({
        userId: p.userId,
        username: p.username,
        nickname: p.nickname
      }))
    };

    localStorage.setItem('tournament_match_command', JSON.stringify(matchCommand));
    console.log(`开始 ${group.name} 第${group.currentRound}轮比赛`);
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '开始下一轮失败';
  } finally {
    loading.value = false;
  }
};

// 判断是否存在需要加赛的并列
const hasPlayoffTie = (group: Group) => {
  return (group.standings || []).some(s => s.needsPlayoff);
};

// 计算本并列块需要取几人（根据配置的目的地晋级名额，至少1人）
const computeWinnersNeeded = (rank: number, blockSize: number) => {
  if (!props.config) return 1;
  const outcomes = props.config.outcomes || {};
  let needed = 0;
  const start = rank;
  const end = rank + blockSize - 1;
  Object.values(outcomes).forEach((outcome: any) => {
    if (!outcome.destination) return; // 仅统计晋级目的地
    const ranks = Array.isArray(outcome.ranks) ? outcome.ranks : [outcome.ranks];
    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    const intersectStart = Math.max(start, min);
    const intersectEnd = Math.min(end, max);
    const count = Math.max(0, intersectEnd - intersectStart + 1);
    needed += count;
  });
  return Math.max(1, needed);
};

// 开始加赛（仅包含并列的选手）
const startPlayoff = async (group: Group) => {
  if (!props.config) return;
  const standings = group.standings || [];
  const ties = standings.filter(s => s.needsPlayoff);
  if (ties.length === 0) return;

  // 取第一段并列块（相同rank连续项）
  ties.sort((a, b) => a.rank - b.rank);
  const targetRank = ties[0].rank;
  const tieBlock = standings.filter(s => s.rank === targetRank);
  const blockSize = tieBlock.length;
  const winnersNeeded = computeWinnersNeeded(targetRank, blockSize);

  // 参赛选手列表（并列块中的选手）
  const players = tieBlock
    .map(s => group.participants.find(p => p.id === s.participantId))
    .filter(Boolean)
    .map(p => ({ userId: (p as any).userId, username: (p as any).username, nickname: (p as any).nickname }));

  if (players.length < 2) return; // 无需加赛

  loading.value = true;
  error.value = null;
  try {
    // 即使组已完成，也允许进入加赛状态
    group.status = 'in_progress';

    const match: MatchRecord = {
      id: `playoff_${group.id}_${Date.now()}`,
      roundNumber: Math.max(group.currentRound, 0) + 1,
      status: 'running',
      startTime: new Date(),
      results: [],
      isPlayoff: true
    };
    group.matches.push(match);
    activeMatches.value.set(group.id, { match, group });

    const matchCommand = {
      action: 'START_MATCH',
      matchId: match.id,
      groupId: group.id,
      groupName: `${group.name} 加赛` ,
      roundNumber: match.roundNumber,
      playoff: true,
      winnersNeeded,
      players
    } as any;

    localStorage.setItem('tournament_match_command', JSON.stringify(matchCommand));
    console.log(`开始 ${group.name} 加赛，rank=${targetRank}，人数=${players.length}，取${winnersNeeded}人`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '开始加赛失败';
  } finally {
    loading.value = false;
  }
};

// 监听比赛结果
const startListeningForResults = (groupId: string) => {
  // 这个函数将在跨页面通信机制实现后完善
  console.log(`开始监听小组 ${groupId} 的比赛结果`);
};

// 打开大屏显示
const openDisplayForGroup = (group: Group) => {
  const displayUrl = `${window.location.origin}/tournament/display?group=${group.id}`;
  window.open(displayUrl, '_blank', 'width=1920,height=1080,fullscreen=yes');
};

// 显示完整积分榜
const showFullStandings = (group: Group) => {
  selectedGroup.value = group;
  showStandingsModal.value = true;
};

// 关闭积分榜弹窗
const closeStandingsModal = () => {
  showStandingsModal.value = false;
  selectedGroup.value = null;
};

// 统计函数
const getTotalParticipants = () => {
  return props.stage?.groups.reduce((total, group) => total + group.participants.length, 0) || 0;
};

const getTotalMatches = () => {
  return props.stage?.groups.reduce((total, group) => total + group.matches.length, 0) || 0;
};

const getAdvancedCount = () => {
  return props.stage?.groups.reduce((total, group) => {
    return total + group.standings.filter(s => s.isAdvanced).length;
  }, 0) || 0;
};

// 导出阶段结果
const exportStageResults = () => {
  if (!props.stage) return;

  let content = `${props.stage.name} - 比赛结果\n`;
  content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  props.stage.groups.forEach((group, index) => {
    content += `=== ${group.name} ===\n`;
    content += `状态: ${getGroupStatusText(group.status)}\n`;
    content += `轮次: ${group.currentRound}/${props.config?.rounds || 0}\n\n`;
    
    if (group.standings.length > 0) {
      content += '积分榜:\n';
      group.standings.forEach((standing, rank) => {
        const participant = group.participants.find(p => p.id === standing.participantId);
        content += `${standing.rank}. ${participant?.username || '未知'} (${participant?.nickname || ''}) - ${standing.totalPoints}分`;
        if (standing.award) content += ` [${standing.award}]`;
        if (standing.isAdvanced) content += ` [晋级]`;
        content += '\n';
      });
    }
    content += '\n';
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.stage.name}-结果.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// 进入下一阶段
const proceedToNextStage = () => {
  if (!props.stage) return;

  if (confirm('确定要进入下一阶段吗？')) {
    emit('stage-completed', props.stage.id);
  }
};

// 注意：比赛结果的处理由tournament store统一处理，这里不需要重复监听

// 生命周期
onMounted(() => {
  // Tournament store会统一处理比赛结果监听
});

onUnmounted(() => {
  // 清理工作在这里进行
});
</script>

<style scoped>
.stage-view {
  height: auto;
  overflow: visible; /* 由外层页面容器滚动 */
}

/* Make the stage card fill full width within Tournament page */
.stage-view > .content-card {
  width: 100%;
  align-items: stretch;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.stage-title h3 {
  color: var(--accent-color);
  font-size: 20px;
  margin-bottom: 5px;
}

.stage-description {
  color: var(--text-secondary);
  font-size: 14px;
}

.stage-status {
  text-align: right;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.pending {
  background-color: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-badge.in_progress {
  background-color: rgba(40, 167, 69, 0.2);
  color: #28a745;
}

.status-badge.completed {
  background-color: rgba(108, 117, 125, 0.2);
  color: #6c757d;
}

.stage-time {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 5px;
}

.stage-config {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 8px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.config-item {
  display: flex;
  gap: 8px;
}

.config-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.config-value {
  color: var(--text-color);
  font-size: 12px;
  font-weight: bold;
}

.groups-section {
  margin-bottom: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h4 {
  color: var(--text-color);
  font-size: 16px;
}

.groups-progress {
  color: var(--text-secondary);
  font-size: 12px;
  background-color: rgba(74, 222, 128, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.group-card {
  background-color: rgba(255, 255, 255, 0.02);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.group-card.in-progress {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.05);
}

.group-card.completed {
  border-color: rgba(40, 167, 69, 0.5);
  background-color: rgba(40, 167, 69, 0.05);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.group-name {
  color: var(--accent-color);
  font-size: 16px;
  font-weight: bold;
}

.group-meta {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 2px;
}

.group-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.pending {
  background-color: #ffc107;
}

.status-indicator.in_progress {
  background-color: var(--accent-color);
  animation: pulse 1.5s infinite;
}

.status-indicator.completed {
  background-color: #28a745;
}

.match-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.completion-info {
  display: flex;
  align-items: center;
  color: #28a745;
  font-size: 12px;
  font-weight: bold;
}

.standings-preview {
  margin-bottom: 15px;
}

.standings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: bold;
  color: var(--text-color);
}

.view-full-button {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--accent-color);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.standings-list {
  max-height: 150px;
  overflow-y: auto;
}

.standing-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  padding: 4px;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.standing-item.highlight {
  background-color: rgba(74, 222, 128, 0.1);
  border-radius: 3px;
}

.rank {
  font-weight: bold;
  color: var(--accent-color);
}

.participant {
  color: var(--text-color);
}

.points {
  color: var(--text-color);
  font-weight: bold;
}

.award {
  color: #f59e0b;
  font-size: 10px;
}

.more-standings {
  text-align: center;
  color: var(--text-secondary);
  font-size: 10px;
  padding: 5px;
}

.matches-history {
  border-top: 1px solid var(--border-color);
  padding-top: 15px;
}

.matches-header {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.match-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.match-status.running {
  color: var(--accent-color);
  font-weight: bold;
}

.match-status.completed {
  color: #28a745;
}

.stage-summary {
  margin-top: 30px;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.stage-summary h4 {
  color: var(--text-color);
  margin-bottom: 15px;
}

.summary-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  gap: 8px;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.stat-value {
  color: var(--text-color);
  font-size: 12px;
  font-weight: bold;
}

.stage-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
}

.pixel-button {
  background-color: var(--button-color);
  color: #000;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  text-transform: uppercase;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.pixel-button:hover:not(:disabled) {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-button,
.next-round-button {
  background-color: rgba(74, 222, 128, 0.8);
}

.display-button {
  background-color: rgba(59, 130, 246, 0.8);
  color: white;
}

.export-button {
  background-color: rgba(168, 85, 247, 0.8);
  color: white;
}

.next-stage-button {
  background-color: rgba(34, 197, 94, 0.8);
  color: white;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h4 {
  color: var(--text-color);
  font-size: 16px;
}

.close-button {
  background: none;
  border: none;
  color: var(--text-color);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  text-align: center;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stage-header {
    flex-direction: column;
    gap: 15px;
  }

  .stage-config {
    flex-direction: column;
    gap: 10px;
  }

  .groups-grid {
    grid-template-columns: 1fr;
  }

  .group-header {
    flex-direction: column;
    gap: 10px;
  }

  .match-controls,
  .stage-actions {
    justify-content: center;
  }

  .summary-stats {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
