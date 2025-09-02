<template>
  <div class="standings-table">
    <div class="table-header">
      <h4>详细积分榜</h4>
      <div class="table-info">
        共 {{ standings.length }} 人，{{ matches.length }} 轮比赛
      </div>
    </div>

    <div class="table-container">
      <table class="standings-data">
        <thead>
          <tr>
            <th>排名</th>
            <th>选手</th>
            <th>总积分</th>
            <th>总得分</th>
            <th v-for="round in roundCount" :key="`round-${round}`">
              第{{ round }}轮
            </th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="standing in standings"
            :key="standing.participantId"
            class="standing-row"
            :class="{
              advanced: standing.isAdvanced,
              awarded: standing.award,
            }"
          >
            <td class="rank-cell">
              <div class="rank-badge" :class="getRankClass(standing.rank)">
                {{ standing.rank }}
              </div>
            </td>
            <td class="participant-cell">
              <div class="participant-info">
                <div class="username">
                  {{ getParticipant(standing.participantId)?.username }}
                </div>
                <div class="nickname">
                  {{ getParticipant(standing.participantId)?.nickname }}
                </div>
              </div>
            </td>
            <td class="points-cell">
              <div class="total-points">{{ standing.totalPoints }}</div>
            </td>
            <td class="highest-score-cell">
              <div class="highest-score">{{ standing.totalRawScore }}</div>
            </td>
            <td
              v-for="round in roundCount"
              :key="`${standing.participantId}-round-${round}`"
              class="round-cell"
            >
              <div class="round-result">
                <template v-if="getRoundResult(standing, round)">
                  <div class="round-points">
                    {{ getRoundResult(standing, round)?.roundPoints }}分
                  </div>
                  <div class="round-rank">
                    第{{ getRoundResult(standing, round)?.rank }}名
                  </div>
                  <div class="raw-score">
                    ({{ getRoundResult(standing, round)?.rawScore }})
                  </div>
                </template>
                <div v-else class="no-result">-</div>
              </div>
            </td>
            <td class="status-cell">
              <div class="status-info">
                <div v-if="standing.isAdvanced" class="advanced-badge">
                  晋级{{ standing.advancedTo }}
                </div>
                <div v-if="standing.award" class="award-badge">
                  {{ standing.award }}
                </div>
                <div v-if="standing.needsPlayoff" class="playoff-badge">
                  需要加赛
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color advanced"></div>
          <span>晋级选手</span>
        </div>
        <div class="legend-item">
          <div class="legend-color awarded"></div>
          <span>获奖选手</span>
        </div>
        <div class="legend-item">
          <div class="legend-color playoff"></div>
          <span>需要加赛</span>
        </div>
      </div>

      <div class="export-actions">
        <button @click="exportToExcel" class="pixel-button export-excel-button">
          导出表格
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ParticipantStanding,
  Participant,
  MatchRecord,
  MatchResult,
} from "../../types/Tournament";

const props = defineProps<{
  standings: ParticipantStanding[];
  participants: Participant[];
  matches: MatchRecord[];
}>();

// 计算属性
const roundCount = computed(() => {
  return Math.max(...props.matches.map((m) => m.roundNumber), 0);
});

// 获取参赛选手信息
const getParticipant = (participantId: string) => {
  return props.participants.find((p) => p.id === participantId);
};

// 获取某轮比赛结果
const getRoundResult = (
  standing: ParticipantStanding,
  round: number
): MatchResult | null => {
  console.log(
    "Getting round result for",
    standing.participantId,
    "round",
    round
  );
  const match = props.matches.find(
    (match) =>
      match.roundNumber === round &&
      match.results.some((r) => r.participantId === standing.participantId)
  );
  return (
    match?.results.find((r) => r.participantId === standing.participantId) ||
    null
  );
};

// 获取排名样式类
const getRankClass = (rank: number) => {
  if (rank === 1) return "first";
  if (rank === 2) return "second";
  if (rank === 3) return "third";
  if (rank <= 8) return "top";
  return "normal";
};

// 导出为Excel表格
const exportToExcel = () => {
  import("../../services/excelExportService")
    .then(({ ExcelExportService }) => {
      ExcelExportService.exportStandingsTable(
        props.standings,
        props.participants,
        props.matches,
        "积分榜"
      );
    })
    .catch((error) => {
      console.error("Excel导出失败:", error);
      alert("导出失败，请重试");
    });
};
</script>

<style scoped>
.standings-table {
  width: 100%;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-header h4 {
  color: var(--text-color);
  font-size: 16px;
}

.table-info {
  color: var(--text-secondary);
  font-size: 12px;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 15px;
}

.standings-data {
  width: 100%;
  min-width: 800px;
  border-collapse: collapse;
  font-size: 12px;
}

.standings-data th {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-color);
  font-weight: bold;
  padding: 12px 8px;
  text-align: center;
  border-bottom: 1px solid var(--border-color);
}

.standings-data td {
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.standing-row.advanced {
  background-color: rgba(74, 222, 128, 0.1);
}

.standing-row.awarded {
  background-color: rgba(251, 191, 36, 0.1);
}

.rank-cell {
  width: 60px;
}

.rank-badge {
  display: inline-block;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  margin: 0 auto;
}

.rank-badge.first {
  background-color: #ffd700;
  color: #000;
}

.rank-badge.second {
  background-color: #c0c0c0;
  color: #000;
}

.rank-badge.third {
  background-color: #cd7f32;
  color: #fff;
}

.rank-badge.top {
  background-color: rgba(74, 222, 128, 0.3);
  color: var(--accent-color);
}

.rank-badge.normal {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.participant-cell {
  text-align: left;
  min-width: 150px;
}

.participant-info .username {
  color: var(--text-color);
  font-weight: bold;
  margin-bottom: 2px;
}

.participant-info .nickname {
  color: var(--text-secondary);
  font-size: 11px;
}

.points-cell {
  width: 80px;
}

.total-points {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 14px;
}

.highest-score-cell {
  width: 80px;
}

.highest-score {
  color: var(--text-color);
  font-weight: bold;
}

.round-cell {
  width: 100px;
  min-width: 100px;
}

.round-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.round-points {
  color: var(--accent-color);
  font-weight: bold;
}

.round-rank {
  color: var(--text-secondary);
  font-size: 10px;
}

.raw-score {
  color: var(--text-secondary);
  font-size: 10px;
}

.no-result {
  color: var(--text-secondary);
  font-style: italic;
}

.status-cell {
  text-align: left;
  min-width: 120px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.advanced-badge {
  background-color: rgba(74, 222, 128, 0.2);
  color: #10b981;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-align: center;
}

.award-badge {
  background-color: rgba(251, 191, 36, 0.2);
  color: #f59e0b;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-align: center;
}

.playoff-badge {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-align: center;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.advanced {
  background-color: rgba(74, 222, 128, 0.3);
}

.legend-color.awarded {
  background-color: rgba(251, 191, 36, 0.3);
}

.legend-color.playoff {
  background-color: rgba(239, 68, 68, 0.3);
}

.export-actions {
  display: flex;
  gap: 10px;
}

.pixel-button {
  background-color: var(--button-color);
  color: #000;
  border: none;
  padding: 6px 12px;
  cursor: pointer;
  font-family: "Press Start 2P", monospace;
  font-size: 8px;
  text-transform: uppercase;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.pixel-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.pixel-button:active {
  transform: translateY(1px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.export-excel-button {
  background-color: rgba(34, 197, 94, 0.8);
  color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .table-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .legend {
    order: 2;
  }

  .export-actions {
    order: 1;
    align-self: stretch;
    justify-content: center;
  }
}
</style>
