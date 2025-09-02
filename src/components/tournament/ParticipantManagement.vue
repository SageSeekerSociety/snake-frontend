<template>
  <div class="participant-management">
    <div class="content-card pixel-border">
      <h3 class="section-title">参赛选手管理</h3>
      
      <!-- 导入方式选择 -->
      <div class="import-tabs">
        <button 
          v-for="tab in importTabs"
          :key="tab.id"
          @click="currentImportTab = tab.id"
          class="tab-button"
          :class="{ active: currentImportTab === tab.id }"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 从学号列表导入 -->
      <div v-if="currentImportTab === 'username_list'" class="import-section">
        <div class="upload-area">
          <div class="upload-instruction">
            <p>请输入参赛选手的学号，每行一个：</p>
          </div>
          
          <textarea
            v-model="usernameListInput"
            class="username-textarea"
            placeholder="202101001&#10;202101002&#10;202101003&#10;..."
            rows="10"
          ></textarea>
          
          <div class="upload-actions">
            <button @click="importFromUsernameList" class="pixel-button import-button" :disabled="loading || !usernameListInput.trim()">
              <span v-if="loading">导入中...</span>
              <span v-else>导入选手 ({{ parsedUsernames.length }})</span>
            </button>
            <button @click="clearUsernameList" class="pixel-button clear-button">
              清空
            </button>
          </div>
        </div>
      </div>

      <!-- 从活跃用户选择 -->
      <div v-if="currentImportTab === 'active_users'" class="import-section">
        <div class="active-users-section">
          <div class="section-header">
            <button @click="loadActiveUsers" class="pixel-button load-button" :disabled="loadingUsers">
              <span v-if="loadingUsers">加载中...</span>
              <span v-else>加载活跃用户</span>
            </button>
            <div v-if="availableUsers.length > 0" class="selection-controls">
              <button @click="selectAllUsers" class="pixel-button select-all">全选</button>
              <button @click="clearSelection" class="pixel-button clear-selection">清空选择</button>
            </div>
          </div>

          <div v-if="availableUsers.length > 0" class="users-grid">
            <div 
              v-for="user in availableUsers"
              :key="user.userId"
              @click="toggleUserSelection(user)"
              class="user-card"
              :class="{ selected: selectedUserIds.has(user.userId) }"
            >
              <div class="user-info">
                <div class="username">{{ user.username }}</div>
                <div class="nickname">{{ user.nickname }}</div>
              </div>
              <div class="selection-indicator">
                <span v-if="selectedUserIds.has(user.userId)">✓</span>
              </div>
            </div>
          </div>

          <div v-if="availableUsers.length > 0" class="import-actions">
            <button 
              @click="importSelectedUsers" 
              class="pixel-button import-button"
              :disabled="selectedUserIds.size === 0"
            >
              导入选中用户 ({{ selectedUserIds.size }})
            </button>
          </div>
        </div>
      </div>

      <!-- 当前参赛选手列表 -->
      <div v-if="participants.length > 0" class="participants-list">
        <div class="list-header">
          <h4>当前参赛选手 ({{ participants.length }})</h4>
          <button @click="clearAllParticipants" class="pixel-button clear-all-button">
            清空所有
          </button>
        </div>
        
        <div class="participants-grid">
          <div 
            v-for="participant in participants"
            :key="participant.id"
            class="participant-card"
          >
            <div class="participant-info">
              <div class="username">{{ participant.username }}</div>
              <div class="nickname">{{ participant.nickname }}</div>
            </div>
            <button 
              @click="removeParticipant(participant.id)"
              class="remove-button"
              title="移除"
            >
              ×
            </button>
          </div>
        </div>

        <div class="list-actions">
          <button @click="exportParticipantsList" class="pixel-button export-button">
            导出名单
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
import { ref, computed, onMounted } from 'vue';
import { sandboxService } from '../../services/sandboxService';
import { tournamentStore } from '../../stores/tournament';
import { Participant } from '../../types/Tournament';
import { Player } from '../../types/User';

const props = defineProps<{
  participants: Participant[];
}>();

const emit = defineEmits<{
  'participants-updated': [participants: Participant[]];
}>();

// 导入方式
const importTabs = [
  { id: 'username_list', label: '学号列表' },
  { id: 'active_users', label: '活跃用户' }
];

// 状态管理
const currentImportTab = ref('username_list');
const loading = ref(false);
const loadingUsers = ref(false);
const error = ref<string | null>(null);

// 学号列表导入
const usernameListInput = ref('');
const parsedUsernames = computed(() => {
  return usernameListInput.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
});

// 活跃用户选择
const availableUsers = ref<Player[]>([]);
const selectedUserIds = ref(new Set<number>());

// 清除错误信息
const clearError = () => {
  error.value = null;
};

// 从学号列表导入
const importFromUsernameList = async () => {
  if (parsedUsernames.value.length === 0) {
    error.value = '请输入至少一个学号';
    return;
  }

  loading.value = true;
  clearError();

  try {
    // 先获取活跃用户列表，匹配学号
    const activeUsers = await sandboxService.getSubmitters();
    const activeUserMap = new Map(activeUsers.map(user => [user.username, user]));
    
    const importedParticipants: Participant[] = [];
    const notFoundUsernames: string[] = [];

    parsedUsernames.value.forEach(username => {
      const user = activeUserMap.get(username);
      if (user) {
        // 检查是否已存在
        const exists = props.participants.some(p => p.username === username);
        if (!exists) {
          importedParticipants.push({
            id: `participant_${Date.now()}_${Math.random()}`,
            userId: user.userId,
            username: user.username,
            nickname: user.nickname,
            email: undefined
          });
        }
      } else {
        notFoundUsernames.push(username);
      }
    });

    if (importedParticipants.length > 0) {
      await tournamentStore.selectParticipantsFromUsers(
        importedParticipants.map(p => ({
          userId: p.userId,
          username: p.username,
          nickname: p.nickname
        }))
      );
    }

    // 显示导入结果
    let message = `成功导入 ${importedParticipants.length} 名选手`;
    if (notFoundUsernames.length > 0) {
      message += `，未找到 ${notFoundUsernames.length} 名选手：${notFoundUsernames.slice(0, 5).join(', ')}${notFoundUsernames.length > 5 ? '...' : ''}`;
    }
    
    console.log(message);
    usernameListInput.value = ''; // 清空输入
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导入失败';
  } finally {
    loading.value = false;
  }
};

// 清空学号列表
const clearUsernameList = () => {
  usernameListInput.value = '';
  clearError();
};

// 加载活跃用户
const loadActiveUsers = async () => {
  loadingUsers.value = true;
  clearError();

  try {
    availableUsers.value = await sandboxService.getSubmitters();
    selectedUserIds.value.clear();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载活跃用户失败';
  } finally {
    loadingUsers.value = false;
  }
};

// 切换用户选择
const toggleUserSelection = (user: Player) => {
  if (selectedUserIds.value.has(user.userId)) {
    selectedUserIds.value.delete(user.userId);
  } else {
    selectedUserIds.value.add(user.userId);
  }
};

// 全选用户
const selectAllUsers = () => {
  availableUsers.value.forEach(user => {
    selectedUserIds.value.add(user.userId);
  });
};

// 清空选择
const clearSelection = () => {
  selectedUserIds.value.clear();
};

// 导入选中用户
const importSelectedUsers = async () => {
  if (selectedUserIds.value.size === 0) {
    error.value = '请至少选择一个用户';
    return;
  }

  loading.value = true;
  clearError();

  try {
    const selectedUsers = availableUsers.value.filter(user => 
      selectedUserIds.value.has(user.userId)
    );

    await tournamentStore.selectParticipantsFromUsers(selectedUsers);
    selectedUserIds.value.clear();
    
    console.log(`成功导入 ${selectedUsers.length} 名选手`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导入失败';
  } finally {
    loading.value = false;
  }
};

// 移除参赛选手
const removeParticipant = (participantId: string) => {
  // 通过store更新（简化实现，实际需要store提供removeParticipant方法）
  console.log('移除参赛选手:', participantId);
};

// 清空所有参赛选手
const clearAllParticipants = () => {
  if (confirm('确定要清空所有参赛选手吗？')) {
    tournamentStore.selectParticipantsFromUsers([]);
  }
};

// 导出参赛选手名单
const exportParticipantsList = () => {
  // 动态导入Excel导出服务
  import('../../services/excelExportService').then(({ ExcelExportService }) => {
    ExcelExportService.exportParticipantsList(props.participants, '蛇王争霸赛');
  }).catch(error => {
    console.error('导出失败:', error);
    // 备用方案：导出文本文件
    const content = props.participants
      .map(p => `${p.username}\t${p.nickname}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '参赛选手名单.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
};

// 组件挂载时加载活跃用户
onMounted(() => {
  loadActiveUsers();
});
</script>

<style scoped>
.participant-management {
  margin-bottom: 30px;
}

/* Stretch card to fill available column width in Tournament page */
.participant-management > .content-card {
  width: 100%;
  align-items: stretch;
}

.section-title {
  color: var(--accent-color);
  font-size: 18px;
  margin-bottom: 20px;
  text-align: center;
}

.import-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--border-color);
}

.tab-button {
  background: transparent;
  border: none;
  padding: 10px 16px;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: var(--text-color);
}

.tab-button.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.import-section {
  margin-bottom: 30px;
}

.upload-area {
  padding: 20px;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
}

.upload-instruction {
  margin-bottom: 15px;
  color: var(--text-secondary);
}

.username-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-family: monospace;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 15px;
}

.upload-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.active-users-section {
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.selection-controls {
  display: flex;
  gap: 8px;
}

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-card:hover {
  border-color: var(--border-color);
  background-color: rgba(255, 255, 255, 0.08);
}

.user-card.selected {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
}

.user-info .username {
  font-weight: bold;
  color: var(--text-color);
  margin-bottom: 2px;
}

.user-info .nickname {
  font-size: 12px;
  color: var(--text-secondary);
}

.selection-indicator {
  color: var(--accent-color);
  font-size: 16px;
  font-weight: bold;
}

.import-actions {
  display: flex;
  justify-content: flex-end;
}

.participants-list {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid var(--border-color);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.list-header h4 {
  color: var(--text-color);
  font-size: 16px;
}

.participants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.participant-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 4px;
}

.participant-info .username {
  font-weight: bold;
  color: var(--text-color);
  margin-bottom: 2px;
}

.participant-info .nickname {
  font-size: 12px;
  color: var(--text-secondary);
}

.remove-button {
  background-color: rgba(239, 68, 68, 0.8);
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.list-actions {
  display: flex;
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

.import-button {
  background-color: rgba(74, 222, 128, 0.8);
}

.clear-button,
.clear-all-button {
  background-color: rgba(239, 68, 68, 0.8);
  color: white;
}

.load-button {
  background-color: rgba(59, 130, 246, 0.8);
  color: white;
}

.select-all,
.clear-selection {
  background-color: rgba(156, 163, 175, 0.8);
  color: white;
  font-size: 8px;
}

.export-button {
  background-color: rgba(168, 85, 247, 0.8);
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
  .users-grid,
  .participants-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .import-tabs {
    flex-direction: column;
  }

  .upload-actions,
  .import-actions,
  .list-actions {
    justify-content: center;
  }
}
</style>
