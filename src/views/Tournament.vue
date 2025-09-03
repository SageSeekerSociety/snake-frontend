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
        <!-- 比赛准备阶段：三步向导（选人 / 分组 / 确认） -->
        <div v-if="tournament.status === 'preparation'" class="preparation-stage">
          <!-- 顶部步骤条 -->
          <div class="content-card pixel-border prep-header">
            <div class="prep-steps">
              <button
                class="prep-step"
                :class="{ active: prepStep === 'select', done: participantsReady }"
                @click="goToStep('select')"
              >
                <span class="step-index">1</span>
                <div class="step-text">
                  <div class="step-name">选人</div>
                  <div class="step-desc">导入或选择参赛选手</div>
                </div>
              </button>
              <button
                class="prep-step"
                :disabled="!participantsReady"
                :class="{ active: prepStep === 'group', disabled: !participantsReady, done: groupsReady }"
                @click="participantsReady && goToStep('group')"
              >
                <span class="step-index">2</span>
                <div class="step-text">
                  <div class="step-name">分组</div>
                  <div class="step-desc">设置参数并生成小组</div>
                </div>
              </button>
              <button
                class="prep-step"
                :disabled="!groupsReady"
                :class="{ active: prepStep === 'confirm', disabled: !groupsReady }"
                @click="groupsReady && goToStep('confirm')"
              >
                <span class="step-index">3</span>
                <div class="step-text">
                  <div class="step-name">确认</div>
                  <div class="step-desc">核对分组并开始比赛</div>
                </div>
              </button>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="prep-content">
            <!-- Step 1: 选人 -->
            <ParticipantManagement
              v-if="prepStep === 'select'"
              :participants="tournament.allParticipants"
              @participants-updated="handleParticipantsUpdated"
            />

            <!-- Step 2: 分组（隐藏内部的确认按钮，统一到Step 3） -->
            <GroupingManagement
              v-else-if="prepStep === 'group'"
              :participants="tournament.allParticipants"
              :groups="getCurrentStage()?.groups || []"
              :config="config"
              :hideConfirmButton="true"
              @grouping-completed="handleGroupingCompleted"
            />

            <!-- Step 3: 确认分组 -->
            <div v-else class="confirm-section">
              <div class="content-card pixel-border confirm-card">
                <div class="confirm-header">
                  <h3 class="section-title">确认分组</h3>
                  <div class="summary">
                    <span>参赛选手：{{ tournament.allParticipants.length }} 人</span>
                    <span>小组数：{{ (getCurrentStage()?.groups || []).length }} 个</span>
                  </div>
                </div>

                <div v-if="groupsReady" class="groups-grid confirm-grid">
                  <div
                    v-for="group in getCurrentStage()?.groups || []"
                    :key="group.id"
                    class="group-card"
                  >
                    <div class="group-header">
                      <div class="group-name">{{ group.name }}</div>
                      <div class="group-size">{{ group.participants.length }} 人</div>
                    </div>
                    <div class="group-participants">
                      <div
                        v-for="p in group.participants"
                        :key="p.id"
                        class="participant-item static"
                      >
                        <div class="participant-info">
                          <span class="username">{{ p.username }}</span>
                          <span class="nickname">{{ p.nickname }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="empty-state">
                  还没有生成分组，请先完成分组。
                </div>

                <div class="confirm-actions">
                  <button class="pixel-button" @click="goToStep('group')">返回分组调整</button>
                  <button class="pixel-button start-button" :disabled="!groupsReady" @click="confirmAndStart">
                    确认分组并开始比赛
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部导航按钮 -->
          <div class="prep-actions">
            <button class="pixel-button" :disabled="isFirstStep" @click="prevStep">上一步</button>
            <button
              v-if="prepStep !== 'confirm'"
              class="pixel-button primary"
              :disabled="nextDisabled"
              @click="nextStep"
            >
              下一步
            </button>
          </div>
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
import { ref, onMounted, onUnmounted, computed, watchEffect } from 'vue';
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
const prepStep = ref<'select' | 'group' | 'confirm'>('select');

// 计算属性
const tournamentState = computed(() => tournamentStore.getState());
const tournament = computed(() => tournamentState.value.tournament);
const config = computed(() => tournamentState.value.config);

// 是否已有分组
const hasGroups = computed(() => {
  const currentStageGroups = tournament.value.stages[currentStage.value]?.groups || [];
  return currentStageGroups.length > 0 && currentStageGroups.some(group => group.participants.length > 0);
});

// 准备阶段就绪状态
const participantsReady = computed(() => tournament.value.allParticipants.length > 0);
const groupsReady = computed(() => hasGroups.value);

// 获取当前阶段
const getCurrentStage = () => {
  return tournament.value.stages[currentStage.value];
};

// 获取阶段配置
const getStageConfig = (stageId: string) => {
  return config.value?.stages[stageId];
};

// 步骤切换逻辑
const goToStep = (step: 'select' | 'group' | 'confirm') => {
  prepStep.value = step;
};

const stepOrder: Array<'select' | 'group' | 'confirm'> = ['select', 'group', 'confirm'];
const isFirstStep = computed(() => stepOrder.indexOf(prepStep.value) === 0);
const nextDisabled = computed(() => {
  if (prepStep.value === 'select') return !participantsReady.value;
  if (prepStep.value === 'group') return !groupsReady.value;
  return false;
});

const nextStep = () => {
  const idx = stepOrder.indexOf(prepStep.value);
  if (idx < stepOrder.length - 1) {
    const target = stepOrder[idx + 1];
    if ((target === 'group' && !participantsReady.value) || (target === 'confirm' && !groupsReady.value)) return;
    prepStep.value = target;
  }
};

const prevStep = () => {
  const idx = stepOrder.indexOf(prepStep.value);
  if (idx > 0) prepStep.value = stepOrder[idx - 1];
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

// 确认分组并开始比赛（Step 3）
const confirmAndStart = async () => {
  if (!groupsReady.value) return;
  if (!confirm('确认当前分组并开始比赛吗？比赛开始后无法修改分组。')) return;
  try {
    await tournamentStore.startStage('group_stage');
    tournamentStore.setTournamentStatus('in_progress');
  } catch (err) {
    console.error('开始比赛失败', err);
  }
};

// 在数据变化时自动定位到合适的步骤
watchEffect(() => {
  if (!participantsReady.value) {
    prepStep.value = 'select';
  } else if (!groupsReady.value) {
    // 已选人但未分组
    if (prepStep.value === 'confirm') prepStep.value = 'group';
  }
});

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

/* Preparation: wizard layout */
.preparation-stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prep-header {
  padding: 16px;
}

.prep-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.prep-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border: 2px solid transparent;
  cursor: pointer;
  color: var(--text-color);
}

.prep-step:hover {
  background: rgba(255,255,255,0.08);
  border-color: var(--border-color);
}

.prep-step.active {
  border-color: var(--accent-color);
  background: rgba(74, 222, 128, 0.12);
}

.prep-step.done .step-index {
  background: #10b981;
}

.prep-step.disabled,
.prep-step:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.step-index {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--text-secondary);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
}

.step-text { flex: 1; }
.step-name { font-weight: bold; font-size: 13px; color: var(--text-color); }
.step-desc { font-size: 11px; color: var(--text-secondary); }

.prep-content { display: block; }

.prep-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-card { padding: 16px; }
.confirm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.confirm-header .summary { display: flex; gap: 16px; color: var(--text-secondary); font-size: 12px; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.start-button { background-color: rgba(34, 197, 94, 0.85); color: #fff; }
.primary { background-color: rgba(74, 222, 128, 0.85); }

.confirm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 8px; }
.group-card { background-color: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; }
.group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
.group-name { color: var(--accent-color); font-weight: bold; font-size: 14px; }
.group-size { color: var(--text-secondary); font-size: 12px; background-color: rgba(74, 222, 128, 0.2); padding: 2px 6px; border-radius: 3px; }
.group-participants { max-height: 300px; overflow-y: auto; }
.participant-item.static { padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 4px; }
.participant-item .username { display: block; font-size: 12px; font-weight: bold; color: var(--text-color); }
.participant-item .nickname { display: block; font-size: 10px; color: var(--text-secondary); }
.empty-state { padding: 16px; color: var(--text-secondary); text-align: center; }

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
  .prep-steps { gap: 12px; }
}

@media (max-width: 1024px) {
  .prep-steps { grid-template-columns: 1fr; }
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
