<template>
  <div class="tournament-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="content-card pixel-border">
        <div class="loading-message">
          <div class="pixel-spinner"></div>
          正在初始化赛事系统...
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <div class="content-card pixel-border">
        <div class="error-message">
          <h3>系统初始化失败</h3>
          <p>{{ error }}</p>
          <button @click="retryInitialization" class="pixel-button">重试</button>
        </div>
      </div>
    </div>

    <!-- 主界面 -->
    <div v-else class="tournament-main">
      <!-- 左侧侧栏：赛事信息 + 阶段导航 -->
      <aside class="tournament-sidebar">
        <!-- 顶部信息栏（侧栏内） -->
        <div class="tournament-header">
          <div class="content-card pixel-border header-card">
            <div class="tournament-info">
              <h1 class="tournament-title">{{ tournament.name }}</h1>
              <div class="tournament-meta">
                <span class="tournament-date">{{ formatDate(tournament.date) }}</span>
                <span class="tournament-status" :class="tournament.status">
                  {{ getStatusText(tournament.status) }}
                </span>
                <span class="participants-count">
                  {{ tournament.allParticipants.length }} 名参赛选手
                </span>
              </div>
            </div>
            <div class="header-actions">
              <button @click="openDisplayWindow" class="pixel-button display-button">
                打开大屏
              </button>
              <button @click="resetTournament" class="pixel-button reset-button">
                重置赛事
              </button>
            </div>
          </div>
        </div>

        <!-- 阶段导航（纵向） -->
        <div class="stage-navigation">
          <div class="content-card pixel-border nav-card">
            <div class="stage-tabs vertical">
              <button 
                v-for="(stage, stageId) in tournament.stages" 
                :key="stageId"
                @click="currentStage = stageId"
                class="stage-tab"
                :class="{
                  'active': currentStage === stageId,
                  'completed': stage.status === 'completed',
                  'in-progress': stage.status === 'in_progress'
                }"
              >
                <div class="tab-icon">
                  <span v-if="stage.status === 'completed'">✓</span>
                  <span v-else-if="stage.status === 'in_progress'">▶</span>
                  <span v-else>○</span>
                </div>
                <div class="tab-content">
                  <div class="tab-name">{{ stage.name }}</div>
                  <div class="tab-description">{{ stage.description }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧主内容区 -->
      <div class="main-content">
        <!-- 比赛准备阶段 -->
        <div v-if="tournament.status === 'preparation'" class="preparation-stage">
          <!-- 选手导入阶段 -->
          <ParticipantManagement 
            v-if="!hasGroups"
            :participants="tournament.allParticipants"
            @participants-updated="handleParticipantsUpdated"
          />
          
          <!-- 分组管理阶段 -->
          <GroupingManagement
            v-if="tournament.allParticipants.length > 0"
            :participants="tournament.allParticipants"
            :groups="getCurrentStage()?.groups || []"
            :config="config"
            @grouping-completed="handleGroupingCompleted"
          />
        </div>

        <!-- 比赛进行阶段 -->
        <div v-else-if="tournament.status === 'in_progress'" class="competition-stage">
          <StageView 
            :stage="getCurrentStage()"
            :config="getStageConfig(currentStage)"
            @stage-completed="handleStageCompleted"
          />
        </div>

        <!-- 比赛完成阶段 -->
        <div v-else class="completion-stage">
          <TournamentResults :tournament="tournament" :config="config" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { tournamentStore } from '../stores/tournament';
import { Participant } from '../types/Tournament';
import ParticipantManagement from '../components/tournament/ParticipantManagement.vue';
import GroupingManagement from '../components/tournament/GroupingManagement.vue';
import StageView from '../components/tournament/StageView.vue';
import TournamentResults from '../components/tournament/TournamentResults.vue';

// 响应式数据
const loading = ref(true);
const error = ref<string | null>(null);
const currentStage = ref('group_stage');

// 计算属性
const tournamentState = computed(() => tournamentStore.getState());
const tournament = computed(() => tournamentState.value.tournament);
const config = computed(() => tournamentState.value.config);

// 是否已有分组
const hasGroups = computed(() => {
  const currentStageGroups = tournament.value.stages[currentStage.value]?.groups || [];
  return currentStageGroups.length > 0 && currentStageGroups.some(group => group.participants.length > 0);
});

// 获取当前阶段
const getCurrentStage = () => {
  return tournament.value.stages[currentStage.value];
};

// 获取阶段配置
const getStageConfig = (stageId: string) => {
  return config.value?.stages[stageId];
};

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    preparation: '准备中',
    in_progress: '进行中',
    completed: '已完成'
  };
  return statusMap[status] || status;
};

// 初始化系统
const initializeSystem = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    await tournamentStore.initialize();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '初始化失败';
  } finally {
    loading.value = false;
  }
};

// 重试初始化
const retryInitialization = () => {
  initializeSystem();
};

// 打开大屏窗口
const openDisplayWindow = () => {
  const displayUrl = `${window.location.origin}/tournament/display`;
  window.open(displayUrl, '_blank', 'width=1920,height=1080,fullscreen=yes');
};

// 重置赛事
const resetTournament = () => {
  if (confirm('确定要重置整个赛事吗？这将清除所有数据！')) {
    tournamentStore.reset();
  }
};

// 参赛选手更新
const handleParticipantsUpdated = (participants: Participant[]) => {
  // 更新逻辑将由store处理
  console.log('参赛选手已更新:', participants.length);
};

// 分组完成
const handleGroupingCompleted = () => {
  console.log('分组已完成');
};

// 阶段完成
const handleStageCompleted = (stageId: string) => {
  console.log('阶段完成:', stageId);
  tournamentStore.completeStage(stageId);
  // 补充：在切到下一阶段前，确保生成并填充后续阶段的分组与选手
  tournamentStore.ensureAdvancedStages(stageId);
  
  // 自动切换到下一个阶段
  const stageIds = Object.keys(tournament.value.stages);
  const currentIndex = stageIds.indexOf(stageId);
  if (currentIndex < stageIds.length - 1) {
    const nextStageId = stageIds[currentIndex + 1];
    tournamentStore.startStage(nextStageId);
    currentStage.value = nextStageId;
  } else {
    // 所有阶段完成
    tournamentStore.setTournamentStatus('completed');
  }
};

// 页面加载
onMounted(() => {
  initializeSystem();
  
  // 启动比赛结果监听器
  tournamentStore.startMatchResultListener();
});

// 页面卸载
onUnmounted(() => {
  // 停止比赛结果监听器
  tournamentStore.stopMatchResultListener();
});
</script>

<style scoped>
.tournament-container {
  display: block;
  padding: 20px;
  width: 100%;
  max-width: min(1600px, 92vw);
  margin: 0 auto;
  height: calc(100vh - 60px);
  overflow: auto; /* 单一滚动容器，避免双滚动条 */
}

.loading-container,
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.loading-message,
.error-message {
  text-align: center;
  color: var(--text-color);
  padding: 40px;
}

.loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.error-message h3 {
  color: var(--error-color);
  margin-bottom: 10px;
}

.pixel-spinner {
  width: 32px;
  height: 32px;
  background-color: var(--accent-color);
  animation: pixel-spin 1s steps(8) infinite;
}

@keyframes pixel-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tournament-main {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}

.tournament-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 0px;
  align-self: start;
  height: fit-content;
}

.tournament-header {
  flex: 0 0 auto;
}

.header-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: var(--card-bg);
  width: auto;
}

.tournament-info {
  flex: 1;
}

.tournament-title {
  color: var(--accent-color);
  font-size: 24px;
  margin-bottom: 8px;
}

.tournament-meta {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.tournament-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.tournament-status.preparation {
  background-color: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.tournament-status.in_progress {
  background-color: rgba(40, 167, 69, 0.2);
  color: #28a745;
}

.tournament-status.completed {
  background-color: rgba(108, 117, 125, 0.2);
  color: #6c757d;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.display-button {
  background-color: rgba(74, 222, 128, 0.8);
}

.reset-button {
  background-color: rgba(239, 68, 68, 0.8);
}

.stage-navigation {
  flex: 0 0 auto;
}

.nav-card {
  padding: 15px;
  background-color: var(--card-bg);
  width: auto;
}

.stage-tabs {
  display: flex;
  gap: 10px;
  overflow: auto;
}

.stage-tabs.vertical {
  flex-direction: column;
  max-height: 50vh;
}

.stage-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 180px;
  color: var(--text-color); /* ensure readable on dark bg */
}

.stage-tab:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: var(--border-color);
}

.stage-tab.active {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
}

.stage-tab.completed {
  border-color: rgba(40, 167, 69, 0.5);
  background-color: rgba(40, 167, 69, 0.1);
}

.stage-tab.in-progress {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.15);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.tab-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.tab-content {
  flex: 1;
}

.tab-name {
  color: var(--text-color);
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 2px;
}

.tab-description {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.2;
}

/* Contrast states for dark theme */
.stage-tab.active {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.12);
}

.stage-tab.completed {
  border-color: rgba(40, 167, 69, 0.5);
  background-color: rgba(40, 167, 69, 0.08);
}

.stage-tab.in-progress {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.18);
}

.stage-tab.active .tab-icon,
.stage-tab.in-progress .tab-icon {
  color: var(--accent-color);
}

.stage-tab.completed .tab-icon {
  color: #28a745;
}

.main-content {
  min-height: 0;
  overflow: visible; /* 使用外层容器滚动，避免双滚动 */
}

/* 取消本页面内卡片的全局滚动限制，避免双滚动条 */
:deep(.content-card) {
  max-height: none !important;
  overflow: visible !important;
}

/* Preparation stage uses two-column layout on wide screens */
.preparation-stage {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-content: start;
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

.pixel-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.content-card {
  background-color: var(--card-bg);
  box-shadow: 0 0 30px rgba(74, 222, 128, 0.15);
  width: 100%;
}

/* 响应式设计 */
@media (min-width: 1440px) {
  .preparation-stage {
    grid-template-columns: 1.2fr 1.8fr; /* wider second column for grouping */
  }
}

@media (max-width: 1024px) {
  .preparation-stage {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .header-card {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .tournament-meta {
    flex-direction: column;
    gap: 5px;
  }

  .stage-tab {
    min-width: auto;
  }

  .tournament-main {
    grid-template-columns: 1fr;
  }
}
</style>
