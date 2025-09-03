<template>
  <div class="grouping-management">
    <div class="content-card pixel-border">
      <h3 class="section-title">分组管理</h3>

      <!-- 分组配置 -->
      <div class="grouping-config">
        <div class="config-section">
          <h4>分组配置</h4>
          <div class="config-grid">
            <div class="config-item">
              <label>小组数量</label>
              <input 
                v-model.number="groupingOptions.groupCount" 
                type="number" 
                min="1" 
                max="20"
                class="config-input"
                :disabled="hasExistingGroups"
              >
            </div>
            <div class="config-item">
              <label>分配策略</label>
              <select v-model="autoDistributeMode" class="config-input" :disabled="hasExistingGroups">
                <option value="balanced">仅设组数，自动均分</option>
                <option value="fixed">固定每组人数</option>
              </select>
            </div>
            <div class="config-item">
              <label>每组人数</label>
              <input 
                v-model.number="groupingOptions.groupSize" 
                type="number" 
                min="1" 
                max="50"
                class="config-input"
                :disabled="hasExistingGroups || autoDistributeMode === 'balanced'"
              >
            </div>
            <div class="config-item">
              <label>分组方式</label>
              <select v-model="groupingOptions.method" class="config-input" :disabled="hasExistingGroups">
                <option value="random">随机分组</option>
                <option value="manual" disabled>手动分组</option>
                <option value="balanced" disabled>平衡分组</option>
              </select>
            </div>
            <div class="config-item" v-if="groupingOptions.method === 'random'">
              <label>随机种子</label>
              <input 
                v-model.number="groupingOptions.seed" 
                type="number"
                class="config-input"
                placeholder="留空则使用当前时间"
                :disabled="hasExistingGroups"
              >
            </div>
          </div>
        </div>

        <div class="grouping-info">
          <div class="info-item">
            <span class="info-label">参赛总人数:</span>
            <span class="info-value">{{ participants.length }}</span>
          </div>
          <div class="info-item" v-if="autoDistributeMode === 'fixed'">
            <span class="info-label">需要人数:</span>
            <span class="info-value" :class="{ 'error': !isParticipantCountValid }">{{ requiredParticipants }}</span>
          </div>
          <div class="info-item" v-else>
            <span class="info-label">均分方案:</span>
            <span class="info-value">{{ balancedPlanText }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">状态:</span>
            <span class="info-value" :class="statusClass">{{ statusText }}</span>
          </div>
        </div>

        <div class="grouping-actions">
          <button 
            @click="performGrouping" 
            class="pixel-button grouping-button"
            :disabled="!canPerformGrouping || loading"
          >
            <span v-if="loading">分组中...</span>
            <span v-else>{{ hasExistingGroups ? '重新分组' : '开始分组' }}</span>
          </button>
          
          <button 
            v-if="hasExistingGroups"
            @click="clearGrouping"
            class="pixel-button clear-button"
          >
            清空分组
          </button>
        </div>
      </div>

      <!-- 分组结果显示 -->
      <div v-if="groups.length > 0" class="groups-display">
        <div class="groups-header">
          <h4>分组结果</h4>
          <div class="groups-summary">
            {{ groups.length }} 个小组，共 {{ totalGroupedParticipants }} 人
          </div>
        </div>

        <div class="groups-grid">
          <div 
            v-for="group in groups"
            :key="group.id"
            class="group-card"
          >
            <div class="group-header">
              <div class="group-name">{{ group.name }}</div>
              <div class="group-size">{{ group.participants.length }} 人</div>
            </div>

            <div class="group-participants">
              <div 
                v-for="participant in group.participants"
                :key="participant.id"
                class="participant-item"
                draggable="true"
                @dragstart="onDragStart(participant, group.id)"
                @dragend="onDragEnd"
                @dragover.prevent
                @drop="onDrop($event, group.id)"
              >
                <div class="participant-info">
                  <span class="username">{{ participant.username }}</span>
                  <span class="nickname">{{ participant.nickname }}</span>
                </div>
                <div class="drag-handle">⋮⋮</div>
              </div>
            </div>

            <!-- 拖拽目标区域 -->
            <div 
              class="drop-zone"
              @dragover.prevent
              @dragenter.prevent
              @drop="onDrop($event, group.id)"
              v-show="draggedParticipant && draggedParticipant.sourceGroupId !== group.id"
            >
              拖放选手到此组
            </div>
          </div>
        </div>

        <!-- 手动调整说明 -->
        <div class="adjustment-help">
          <p>💡 可以拖拽选手在不同小组间移动</p>
        </div>

        <!-- 分组操作 -->
        <div class="groups-actions">
          <button @click="exportGrouping" class="pixel-button export-button">
            导出分组
          </button>
          <button v-if="!props.hideConfirmButton" @click="confirmGrouping" class="pixel-button confirm-button">
            确认分组并开始比赛
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { tournamentStore } from '../../stores/tournament';
import { Participant, Group, GroupingOptions } from '../../types/Tournament';
import { TournamentConfig } from '../../services/tournamentConfigLoader';

const props = defineProps<{
  participants: Participant[];
  groups: Group[];
  config: TournamentConfig | null;
  /** 当为 true 时，隐藏底部的“确认分组并开始比赛”按钮，交由外部页面处理确认流程 */
  hideConfirmButton?: boolean;
}>();

const emit = defineEmits<{
  'grouping-completed': [];
}>();

// 状态管理
const loading = ref(false);
const error = ref<string | null>(null);
const autoDistributeMode = ref<'balanced' | 'fixed'>('balanced');

// 分组选项
const groupingOptions = ref<GroupingOptions>({
  method: 'random',
  groupCount: 10,
  groupSize: 20,
  seed: undefined
});

// 拖拽状态
const draggedParticipant = ref<{ participant: Participant, sourceGroupId: string } | null>(null);

// 计算属性
const requiredParticipants = computed(() => {
  return groupingOptions.value.groupCount * (groupingOptions.value.groupSize || 0);
});

const isParticipantCountValid = computed(() => {
  if (autoDistributeMode.value === 'balanced') {
    return props.participants.length > 0 && groupingOptions.value.groupCount > 0;
  }
  return props.participants.length === requiredParticipants.value;
});

const hasExistingGroups = computed(() => {
  return props.groups.length > 0;
});

const totalGroupedParticipants = computed(() => {
  return props.groups.reduce((total, group) => total + group.participants.length, 0);
});

const canPerformGrouping = computed(() => {
  return isParticipantCountValid.value && !loading.value;
});

const balancedPlanText = computed(() => {
  const total = props.participants.length;
  const g = Math.max(1, groupingOptions.value.groupCount || 1);
  if (total === 0) return `等待导入参赛选手`;
  const base = Math.floor(total / g);
  const remainder = total % g;
  if (remainder === 0) return `每组 ${base} 人`;
  return `前 ${remainder} 组 ${base + 1} 人，其余 ${g - remainder} 组 ${base} 人`;
});

const statusText = computed(() => {
  if (props.participants.length === 0) return '无参赛选手';
  if (!isParticipantCountValid.value) {
    if (autoDistributeMode.value === 'balanced') {
      return '可均分，点击开始分组';
    }
    if (props.participants.length < requiredParticipants.value) {
      return `还需 ${requiredParticipants.value - props.participants.length} 人`;
    } else {
      return `多了 ${props.participants.length - requiredParticipants.value} 人`;
    }
  }
  if (hasExistingGroups.value) return '已完成分组';
  return '可以开始分组';
});

const statusClass = computed(() => {
  if (props.participants.length === 0) return 'warning';
  if (!isParticipantCountValid.value) return autoDistributeMode.value === 'balanced' ? 'ready' : 'error';
  if (hasExistingGroups.value) return 'success';
  return 'ready';
});

// 监听配置变化，从tournament配置同步
watch(() => props.config, (newConfig) => {
  if (newConfig?.stages.group_stage.groups) {
    const stageConfig = newConfig.stages.group_stage;
    groupingOptions.value.groupCount = stageConfig.groups.count;
    groupingOptions.value.groupSize = stageConfig.groups.size;
  }
}, { immediate: true });

// 清除错误信息
const clearError = () => {
  error.value = null;
};

// 执行分组
const performGrouping = async () => {
  if (!canPerformGrouping.value) return;

  loading.value = true;
  clearError();

  try {
    const seedToUse = groupingOptions.value.seed ?? Date.now();
    const optionsToSend: GroupingOptions = {
      method: groupingOptions.value.method,
      groupCount: groupingOptions.value.groupCount,
      seed: seedToUse
    };
    if (autoDistributeMode.value === 'fixed') {
      optionsToSend.groupSize = groupingOptions.value.groupSize;
    }

    await tournamentStore.performGrouping(optionsToSend);
    emit('grouping-completed');
    
    console.log('分组完成');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '分组失败';
  } finally {
    loading.value = false;
  }
};

// 清空分组
const clearGrouping = async () => {
  if (!confirm('确定要清空当前分组吗？')) return;

  try {
    tournamentStore.clearGrouping('group_stage');
    console.log('分组已清空');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清空分组失败';
  }
};

// 拖拽开始/结束
const onDragStart = (participant: Participant, sourceGroupId: string) => {
  draggedParticipant.value = { participant, sourceGroupId };
};

const onDragEnd = () => {
  draggedParticipant.value = null;
};

// 拖拽结束
const onDrop = async (event: DragEvent, targetGroupId: string) => {
  event.preventDefault();
  
  if (!draggedParticipant.value) return;
  
  const { participant, sourceGroupId } = draggedParticipant.value;
  
  // 如果是同一个组，不需要操作
  if (sourceGroupId === targetGroupId) {
    draggedParticipant.value = null;
    return;
  }

  try {
    await tournamentStore.adjustGrouping(sourceGroupId, targetGroupId, participant.id);
    console.log(`选手 ${participant.username} 从 ${sourceGroupId} 移动到 ${targetGroupId}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '移动选手失败';
  } finally {
    draggedParticipant.value = null;
  }
};

// 导出分组
const exportGrouping = () => {
  // 动态导入Excel导出服务，导出分组为xlsx（不再提供文本兜底）
  import('../../services/excelExportService')
    .then(({ ExcelExportService }) => {
      const t = tournamentStore.getState().tournament;
      ExcelExportService.exportGrouping(props.groups, t.name || '赛事');
    })
    .catch(error => {
      console.error('Excel导出失败:', error);
      alert('导出失败，请重试');
    });
};

// 确认分组并开始比赛
const confirmGrouping = async () => {
  if (!confirm('确认当前分组并开始比赛吗？比赛开始后无法修改分组。')) return;

  try {
    // 开始小组赛阶段
    await tournamentStore.startStage('group_stage');
    
    // 更新赛事状态为进行中
    tournamentStore.setTournamentStatus('in_progress');
    
    emit('grouping-completed');
    console.log('分组确认完成，比赛开始');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '开始比赛失败';
  }
};
</script>

<style scoped>
.grouping-management {
  margin-bottom: 30px;
}

/* Stretch card to fill available column width in Tournament page */
.grouping-management > .content-card {
  width: 100%;
  align-items: stretch;
}

.section-title {
  color: var(--accent-color);
  font-size: 18px;
  margin-bottom: 20px;
  text-align: center;
}

.grouping-config {
  margin-bottom: 30px;
}

.config-section h4 {
  color: var(--text-color);
  margin-bottom: 15px;
  font-size: 14px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-item label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: bold;
}

.config-input {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-size: 14px;
}

.config-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.grouping-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.info-value {
  color: var(--text-color);
  font-size: 12px;
  font-weight: bold;
}

.info-value.error {
  color: #ef4444;
}

.info-value.warning {
  color: #f59e0b;
}

.info-value.success {
  color: #10b981;
}

.info-value.ready {
  color: var(--accent-color);
}

.grouping-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.groups-display {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid var(--border-color);
}

.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.groups-header h4 {
  color: var(--text-color);
  font-size: 16px;
}

.groups-summary {
  color: var(--text-secondary);
  font-size: 12px;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.group-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 15px;
  position: relative;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.group-name {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 14px;
}

.group-size {
  color: var(--text-secondary);
  font-size: 12px;
  background-color: rgba(74, 222, 128, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
}

.group-participants {
  max-height: 300px;
  overflow-y: auto;
}

.participant-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
}

.participant-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.participant-item:active {
  cursor: grabbing;
}

.participant-info {
  flex: 1;
}

.participant-info .username {
  display: block;
  color: var(--text-color);
  font-size: 12px;
  font-weight: bold;
}

.participant-info .nickname {
  display: block;
  color: var(--text-secondary);
  font-size: 10px;
}

.drag-handle {
  color: var(--text-secondary);
  font-size: 12px;
  cursor: grab;
}

.drop-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(74, 222, 128, 0.2);
  border: 2px dashed var(--accent-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  font-size: 14px;
  font-weight: bold;
  z-index: 10;
}

.adjustment-help {
  text-align: center;
  margin: 20px 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.groups-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 20px;
}

.pixel-button {
  background-color: var(--button-color);
  color: #000;
  border: none;
  padding: 10px 16px;
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

.grouping-button {
  background-color: rgba(74, 222, 128, 0.8);
}

.clear-button {
  background-color: rgba(239, 68, 68, 0.8);
  color: white;
}

.export-button {
  background-color: rgba(168, 85, 247, 0.8);
  color: white;
}

.confirm-button {
  background-color: rgba(34, 197, 94, 0.8);
  color: white;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .grouping-info {
    flex-direction: column;
    gap: 10px;
  }

  .groups-grid {
    grid-template-columns: 1fr;
  }

  .groups-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .grouping-actions,
  .groups-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
