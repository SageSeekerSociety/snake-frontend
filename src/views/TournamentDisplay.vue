<template>
  <div class="tournament-display">
    <!-- 比赛准备状态 -->
    <div v-if="displayState === 'waiting'" class="waiting-state">
      <!-- 顶部标题栏 -->
      <div class="waiting-header">
        <div class="tournament-title">
          <div class="logo-icon">🐍</div>
          <h1>{{ tournament?.name || "蛇王争霸赛" }}</h1>
        </div>
        <div class="header-info">
          <div class="date-info">{{ formatDate(tournament?.date) }}</div>
          <div class="time-info">{{ currentTime }}</div>
        </div>
      </div>

      <!-- 如果赛事已完成，展示终极结果页 -->
      <div v-if="tournament?.status === 'completed'" class="finale-container">
        <div class="finale-header">
          <h2 class="finale-title">比赛圆满结束</h2>
          <div class="finale-subtitle">最终排名与获奖情况</div>
        </div>

        <!-- 领奖台：显示决赛前三名 -->
        <div class="results-podium">
          <div v-if="finalsResults.length >= 2" class="podium-place second-place">
            <div class="place-rank">2</div>
            <div class="place-info">
              <div class="place-username">{{ finalsResults[1]?.participant?.username }}</div>
              <div class="place-score">{{ finalsResults[1]?.totalPoints }}分</div>
            </div>
          </div>

          <div v-if="finalsResults.length >= 1" class="podium-place first-place">
            <div class="place-rank">1</div>
            <div class="place-info">
              <div class="place-username">{{ finalsResults[0]?.participant?.username }}</div>
              <div class="place-score">{{ finalsResults[0]?.totalPoints }}分</div>
            </div>
            <div class="winner-crown">👑</div>
          </div>

          <div v-if="finalsResults.length >= 3" class="podium-place third-place">
            <div class="place-rank">3</div>
            <div class="place-info">
              <div class="place-username">{{ finalsResults[2]?.participant?.username }}</div>
              <div class="place-score">{{ finalsResults[2]?.totalPoints }}分</div>
            </div>
          </div>
        </div>

        <!-- 决赛完整排名 -->
        <div class="full-results">
          <h3>决赛完整排名</h3>
          <div class="results-columns">
            <div
              v-for="result in finalsResults"
              :key="result.participantId"
              class="result-card"
              :class="{ 'top-three': result.rank <= 3 }"
            >
              <div class="result-rank">{{ result.rank }}</div>
              <div class="result-info">
                <div class="result-username">{{ result.participant?.username }}</div>
                <div class="result-nickname">{{ result.participant?.nickname }}</div>
                <div class="result-score">{{ result.totalPoints }}分</div>
              </div>
              <div v-if="result.rank <= 3" class="rank-badge">
                <span v-if="result.rank === 1">👑</span>
                <span v-else-if="result.rank === 2">🥈</span>
                <span v-else-if="result.rank === 3">🥉</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 否则展示默认等待页内容 -->
      <template v-else>
        <!-- 主要内容区 -->
        <div class="waiting-main">
          <!-- 左侧：当前阶段信息和参赛选手 -->
          <div class="left-sidebar">
            <div class="stage-info">
              <h2>当前阶段</h2>
              <div class="stage-card">
                <div class="stage-name">{{ getCurrentStageInfo().name }}</div>
                <div class="stage-status">{{ getCurrentStageInfo().status }}</div>
                <div class="stage-progress">
                  <div class="progress-text">
                    {{ getCurrentStageInfo().progress }}
                  </div>
                </div>
                <!-- 等待状态动画 -->
                <div
                  v-if="displayState === 'waiting'"
                  class="waiting-indicator-inline"
                >
                  <div class="loading-animation">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 参赛选手预览 -->
            <div
              class="participants-compact"
              v-if="getCurrentStageParticipants().length > 0"
            >
              <h3>{{ getCurrentGroupName() }}参赛选手</h3>
              <div class="participants-list">
                <div
                  v-for="(
                    participant, index
                  ) in getCurrentStageParticipants().slice(0, 8)"
                  :key="participant.id"
                  class="participant-item"
                >
                  <span class="participant-num">{{ index + 1 }}.</span>
                  <span class="participant-name">{{ participant.nickname }}</span>
                </div>
                <div
                  v-if="getCurrentStageParticipants().length > 8"
                  class="more-participants"
                >
                  +{{ getCurrentStageParticipants().length - 8 }}人
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：当前积分榜 -->
          <div class="right-main">
            <div
              class="current-standings"
              v-if="getCurrentStandings().length > 0"
            >
              <h2>{{ getCurrentGroupName() }}积分榜</h2>
              <div class="standings-table">
                <div
                  v-for="(standing, index) in getCurrentStandings().slice(0, 10)"
                  :key="standing.participantId"
                  class="standing-row"
                  :class="{ 'top-three': index < 3 }"
                >
                  <div class="standing-rank">{{ standing.rank }}</div>
                  <div class="standing-player">
                    {{ getParticipantName(standing.participantId) }}
                  </div>
                  <div class="standing-points">{{ standing.totalPoints }}分</div>
                  <div class="standing-score">{{ standing.totalRawScore }}</div>
                </div>
                <div
                  v-if="getCurrentStandings().length > 10"
                  class="more-standings"
                >
                  还有{{ getCurrentStandings().length - 10 }}名参赛选手...
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 比赛准备阶段 - 显示参赛名单 -->
    <div v-else-if="displayState === 'preparing'" class="preparing-state">
      <div class="match-header">
        <h2 class="match-title">
          {{ currentMatch?.groupName }} - 第{{ currentMatch?.roundNumber }}轮
        </h2>
      </div>

      <div class="participants-display">
        <h3>{{ currentMatch?.players.length }} 名选手参赛</h3>
        <div class="participants-grid">
          <div
            v-for="(player, index) in selectedUsers"
            :key="player.userId"
            class="participant-card"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <div class="participant-number">{{ index + 1 }}</div>
            <div class="participant-info">
              <div class="participant-username">{{ player.username }}</div>
              <div class="participant-nickname">{{ player.nickname }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="countdown-container">
        <div class="countdown-text">比赛将在</div>
        <div class="countdown-timer">{{ countdown }}</div>
        <div class="countdown-text">秒后开始</div>
      </div>
    </div>

    <!-- 比赛进行中 - 显示游戏 -->
    <div v-else-if="displayState === 'gaming'" class="gaming-state">
      <!-- 比赛头部信息 -->
      <div class="game-header">
        <div class="match-info">
          <span class="group-name">{{ currentMatch?.groupName }}</span>
          <span class="round-info">第{{ currentMatch?.roundNumber }}轮</span>
        </div>
        <div class="game-time">比赛时间: {{ gameTime }}</div>
      </div>

      <!-- 游戏组件容器 -->
      <div class="game-container">
        <Game
          ref="gameComponent"
          :tournament-mode="true"
          :selected-users="selectedUsers"
          @game-ended="handleGameEnded"
        />
      </div>
    </div>

    <!-- 比赛结果展示 -->
    <div v-else-if="displayState === 'results'" class="results-state">
      <div class="results-header">
        <h2 class="results-title">
          {{ currentMatch?.groupName }} - 第{{
            currentMatch?.roundNumber
          }}轮结果
        </h2>
        <div class="results-info">完成时间: {{ formatTime(new Date()) }}</div>
      </div>

      <div class="results-podium">
        <!-- 前三名特殊展示 -->
        <div v-if="gameResults.length >= 2" class="podium-place second-place">
          <div class="place-rank">2</div>
          <div class="place-info">
            <div class="place-username">{{ gameResults[1]?.username }}</div>
            <div class="place-score">{{ gameResults[1]?.score }}分</div>
          </div>
        </div>

        <div v-if="gameResults.length >= 1" class="podium-place first-place">
          <div class="place-rank">1</div>
          <div class="place-info">
            <div class="place-username">{{ gameResults[0]?.username }}</div>
            <div class="place-score">{{ gameResults[0]?.score }}分</div>
          </div>
          <div class="winner-crown">👑</div>
        </div>

        <div v-if="gameResults.length >= 3" class="podium-place third-place">
          <div class="place-rank">3</div>
          <div class="place-info">
            <div class="place-username">{{ gameResults[2]?.username }}</div>
            <div class="place-score">{{ gameResults[2]?.score }}分</div>
          </div>
        </div>
      </div>

      <!-- 完整排名 -->
      <div class="full-results">
        <h3>完整排名</h3>
        <div class="results-columns">
          <div
            v-for="(result, index) in gameResults"
            :key="result.username"
            class="result-card"
            :class="{
              'top-three': index < 3,
              first: index === 0,
              second: index === 1,
              third: index === 2,
            }"
          >
            <div class="result-rank">{{ index + 1 }}</div>
            <div class="result-info">
              <div class="result-username">{{ result.username }}</div>
              <div class="result-nickname">{{ result.nickname }}</div>
              <div class="result-score">{{ result.score }}分</div>
            </div>
            <div v-if="index < 3" class="rank-badge">
              <span v-if="index === 0">👑</span>
              <span v-else-if="index === 1">🥈</span>
              <span v-else-if="index === 2">🥉</span>
            </div>
          </div>
        </div>
      </div>

      <div class="results-actions">
        <div class="next-info">等待下一轮比赛...</div>
      </div>
    </div>

    <!-- 连接状态指示器 -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <div class="status-dot"></div>
      <span>{{ isConnected ? "已连接" : "未连接" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
import Game from "./Game.vue";
import { tournamentStore } from "../stores/tournament";

// 显示状态类型
type DisplayState = "waiting" | "preparing" | "gaming" | "results";

// 状态管理
const displayState = ref<DisplayState>("waiting");
const isConnected = ref(false);
const currentTime = ref("");
const countdown = ref(5);
const gameTime = ref("");

// 比赛相关数据
const currentMatch = ref<{
  matchId: string;
  groupId: string;
  groupName: string;
  roundNumber: number;
  players: Array<{ userId: number; username: string; nickname: string }>;
  playoff?: boolean;
  winnersNeeded?: number;
} | null>(null);

const gameResults = ref<
  Array<{
    username: string;
    nickname: string;
    score: number;
  }>
>([]);

// Game组件引用
const gameComponent = ref<InstanceType<typeof Game> | null>(null);

// 计算属性
const tournament = computed(() => tournamentStore.getState().tournament);

// 决赛结果（丰富参赛者信息）
const finalsResults = computed(() => {
  const t = tournament.value;
  if (!t) return [] as Array<any>;
  const finals = t.stages?.finals;
  if (!finals || finals.groups.length === 0) return [] as Array<any>;
  const standings = finals.groups[0]?.standings || [];
  return standings
    .slice()
    .sort((a: any, b: any) => a.rank - b.rank)
    .map((s: any) => ({
      ...s,
      participant: t.allParticipants.find((p) => p.id === s.participantId),
    }));
});

// 是否显示终极结果页（等待态 + 已完成）
const isFinaleVisible = computed(
  () => displayState.value === 'waiting' && tournament.value?.status === 'completed'
);

// 只播放一次礼花动画
const hasPlayedFinaleConfetti = ref(false);

// 监听终极结果页的出现，触发礼花动画
watch(isFinaleVisible, (visible, prev) => {
  if (visible && !prev && !hasPlayedFinaleConfetti.value) {
    launchConfetti();
    hasPlayedFinaleConfetti.value = true;
  }
});

// 简易礼花动画（无第三方依赖）
let confettiRaf: number | null = null;
const launchConfetti = () => {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  document.body.appendChild(canvas);

  const colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4ade80', '#22c55e', '#60a5fa', '#f59e0b', '#ef4444'];
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  const particleCount = Math.min(180, Math.floor((canvas.width * canvas.height) / 40000));
  const gravity = 0.15;
  const drag = 0.005;
  const terminalVel = 4.5;

  const particles = Array.from({ length: particleCount }).map(() => ({
    x: rand(0, canvas.width),
    y: rand(-canvas.height * 0.3, -10),
    w: rand(6, 10),
    h: rand(8, 14),
    vx: rand(-2.5, 2.5),
    vy: rand(0, 2),
    color: colors[Math.floor(Math.random() * colors.length)],
    angle: rand(0, Math.PI * 2),
    spin: rand(-0.15, 0.15),
    alpha: 1,
  }));

  const start = performance.now();
  const duration = 5500; // ms

  const tick = (t: number) => {
    if (!ctx) return;
    const elapsed = t - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      // physics
      p.vx *= (1 - drag);
      p.vy = Math.min(p.vy + gravity, terminalVel);
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;

      // wrap on sides
      if (p.x < -20) p.x = canvas.width + 20;
      if (p.x > canvas.width + 20) p.x = -20;

      // fade near end
      if (elapsed > duration * 0.7) {
        p.alpha = Math.max(0, 1 - (elapsed - duration * 0.7) / (duration * 0.3));
      }

      // draw
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (elapsed < duration) {
      confettiRaf = requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  };

  const cleanup = () => {
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    confettiRaf = null;
    window.removeEventListener('resize', resize);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };

  confettiRaf = requestAnimationFrame(tick);
};

// 存储打乱后的参赛选手列表
const shuffledUsers = ref<
  Array<{ userId: number; username: string; nickname: string }>
>([]);

// 记录最近一次比赛所属的小组，用于比赛完成后在等待页继续展示该组的最终积分榜
const lastGroupId = ref<string | null>(null);

const selectedUsers = computed(() => shuffledUsers.value);

// 工具函数：随机打乱数组
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array]; // 创建副本，避免修改原数组
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 时间更新器
const updateCurrentTime = () => {
  currentTime.value = new Date().toLocaleString("zh-CN");
};

const updateGameTime = () => {
  const now = new Date();
  gameTime.value = now.toLocaleTimeString("zh-CN");
};

// 格式化函数
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("zh-CN");
};

// 获取当前阶段信息
const getCurrentStageInfo = () => {
  const tournamentData = tournament.value;
  if (!tournamentData) {
    return { name: "未开始", status: "等待中", progress: "准备阶段" };
  }

  // 找到当前进行的阶段
  const stageEntries = Object.entries(tournamentData.stages);
  const currentStage =
    stageEntries.find(([, stage]) => stage.status === "in_progress") ||
    stageEntries.find(([, stage]) => stage.status === "pending") ||
    stageEntries[0];

  if (!currentStage) {
    return { name: "未开始", status: "等待中", progress: "准备阶段" };
  }

  const [, stage] = currentStage;
  const statusMap = {
    pending: "准备中",
    in_progress: "进行中",
    completed: "已完成",
  };

  // 计算进度：显示小组轮次进度或整体轮次进度（排除加赛）
  let progress = "等待开始";
  const stageConfig = tournamentStore.getConfig()?.stages[tournamentData.currentStage];
  const totalRoundsPerGroup = stageConfig?.rounds || 0;
  if (stage.groups && stage.groups.length > 0 && totalRoundsPerGroup > 0) {
    // 如果存在最近比赛的小组，则显示该组的轮次进度
    if (lastGroupId.value) {
      const g = (stage.groups as any[]).find((gg) => gg.id === lastGroupId.value) || stage.groups[0];
      const cr = Math.min(g.currentRound || 0, totalRoundsPerGroup);
      const statusText = g.status === 'completed' ? '已完成' : (g.status === 'in_progress' ? '进行中' : '准备中');
      progress = `${statusText} (${cr}/${totalRoundsPerGroup} 轮)`;
    } else {
      // 聚合所有小组的轮次进度
      const sumRounds = (stage.groups as any[]).reduce((sum, g) => sum + Math.min(g.currentRound || 0, totalRoundsPerGroup), 0);
      const total = stage.groups.length * totalRoundsPerGroup;
      const anyRunning = (stage.groups as any[]).some((g) => g.status === 'in_progress');
      progress = `${anyRunning ? '进行中' : '进度'} (${sumRounds}/${total} 轮)`;
    }
  }

  return {
    name: stage.name,
    status: statusMap[stage.status] || stage.status,
    progress: progress,
  };
};

// 获取当前组参赛选手
const getCurrentStageParticipants = () => {
  const tournamentData = tournament.value;
  if (!tournamentData) return [];

  // 如果有当前比赛，显示当前比赛组的参赛选手
  if (currentMatch.value) {
    return currentMatch.value.players.map((player) => ({
      id: `player-${player.userId}`,
      nickname: player.nickname,
      username: player.username,
    }));
  }

  // 若有最近比赛的小组，优先返回该组
  if (lastGroupId.value) {
    for (const [, stage] of Object.entries(tournamentData.stages) as any) {
      const g = stage.groups?.find((gg: any) => gg.id === lastGroupId.value);
      if (g) return g.participants || [];
    }
  }

  // 找到当前活跃的组
  const activeGroup = findActiveGroup(tournamentData);
  if (activeGroup) {
    return activeGroup.participants || [];
  }

  return [];
};

// 获取当前组积分榜
const getCurrentStandings = () => {
  const tournamentData = tournament.value;
  if (!tournamentData) return [];

  // 如果有当前比赛，显示对应组的积分榜
  if (currentMatch.value) {
    // 找到当前阶段
    const stageEntries = Object.entries(tournamentData.stages);
    const currentStage =
      stageEntries.find(([, stage]) => stage.status === "in_progress") ||
      stageEntries.find(([, stage]) => stage.status === "pending") ||
      stageEntries[0];

    if (currentStage && currentStage[1].groups) {
      const currentGroup = currentStage[1].groups.find(
        (g) => g.id === currentMatch.value?.groupId
      );
      if (currentGroup && currentGroup.standings) {
        return [...currentGroup.standings].sort((a, b) => a.rank - b.rank);
      }
    }
  }

  // 若有最近的小组，优先显示该组的积分榜（比赛结束返回等待页后也能看到最终榜单）
  if (lastGroupId.value) {
    const stageEntries = Object.entries(tournamentData.stages);
    for (const [, stage] of stageEntries as any) {
      const g = stage.groups?.find((gg: any) => gg.id === lastGroupId.value);
      if (g && g.standings) {
        return [...g.standings].sort((a, b) => a.rank - b.rank);
      }
    }
  }

  // 找到当前活跃的组
  const activeGroup = findActiveGroup(tournamentData);
  if (activeGroup && activeGroup.standings) {
    return [...activeGroup.standings].sort((a, b) => a.rank - b.rank);
  }

  return [];
};

// 获取当前组名称
const getCurrentGroupName = () => {
  // 如果有当前比赛，显示当前比赛组名
  if (currentMatch.value) {
    return currentMatch.value.groupName;
  }

  // 否则显示最近的小组或当前活跃组的名称
  const tournamentData = tournament.value;
  if (!tournamentData) return "当前组";

  if (lastGroupId.value) {
    const stageEntries = Object.entries(tournamentData.stages);
    for (const [, stage] of stageEntries as any) {
      const g = stage.groups?.find((gg: any) => gg.id === lastGroupId.value);
      if (g) return g.name || "当前组";
    }
  }

  const activeGroup = findActiveGroup(tournamentData);
  if (activeGroup) {
    return activeGroup.name || "当前组";
  }

  return "当前组";
};

// 找到当前活跃的组（正在进行或下一个要进行的组）
const findActiveGroup = (tournamentData: any) => {
  if (!tournamentData || !tournamentData.stages) return null;

  // 找到当前阶段
  const stageEntries = Object.entries(tournamentData.stages);
  const currentStage =
    stageEntries.find(
      ([, stage]: [string, any]) => stage.status === "in_progress"
    ) ||
    stageEntries.find(
      ([, stage]: [string, any]) => stage.status === "pending"
    ) ||
    stageEntries[0];

  if (
    !currentStage ||
    !(currentStage[1] as any).groups ||
    (currentStage[1] as any).groups.length === 0
  ) {
    return null;
  }

  const stage = currentStage[1] as any;

  // 优先级1: 找到正在进行的组（有正在运行的比赛）
  for (const group of stage.groups) {
    if (group.status === "in_progress") {
      return group;
    }
  }

  // 优先级2: 找到还未开始但有待进行比赛的组
  for (const group of stage.groups) {
    if (group.status === "pending" && group.matches) {
      // 检查是否有未完成的比赛
      const hasIncompleteMatches = group.matches.some(
        (match: any) => match.status === "pending" || match.status === "running"
      );
      if (hasIncompleteMatches) {
        return group;
      }
    }
  }

  // 优先级3: 找到第一个未完成的组
  for (const group of stage.groups) {
    if (group.status !== "completed") {
      return group;
    }
  }

  // 如果所有组都完成了，返回第一个组
  return stage.groups[0] || null;
};

// 根据参赛选手ID获取姓名
const getParticipantName = (participantId: string) => {
  const tournamentData = tournament.value;
  if (!tournamentData) return "未知";

  const participant = tournamentData.allParticipants.find(
    (p) => p.id === participantId
  );
  return participant ? participant.nickname : "未知";
};

// 监听localStorage变化，接收主控台指令
const handleStorageChange = (event: StorageEvent) => {
  if (event.key === "tournament_match_command" && event.newValue) {
    try {
      const command = JSON.parse(event.newValue);
      handleMatchCommand(command);
    } catch (err) {
      console.error("解析比赛指令失败:", err);
    }
  }
};

// 处理比赛指令
const handleMatchCommand = (command: any) => {
  console.log("收到比赛指令:", command);

  if (command.action === "START_MATCH") {
    // 记录当前小组
    lastGroupId.value = command.groupId || null;
    currentMatch.value = {
      matchId: command.matchId,
      groupId: command.groupId,
      groupName: command.groupName || `小组${command.groupId}`,
      roundNumber: command.roundNumber,
      players: command.players,
      playoff: !!command.playoff,
      winnersNeeded: command.winnersNeeded,
    };

    // 打乱参赛选手顺序并存储
    const originalPlayers = command.players.map((p: any) => ({
      userId: p.userId,
      username: p.username,
      nickname: p.nickname,
    }));

    shuffledUsers.value = shuffleArray(originalPlayers);

    // 打印原始顺序和打乱后的顺序
    console.log(
      "原始参赛选手顺序:",
      originalPlayers.map((p: any) => p.username)
    );
    console.log(
      "打乱后参赛选手顺序:",
      shuffledUsers.value.map((p) => p.username)
    );

    startMatchSequence();
  }
};

// 开始比赛序列
const startMatchSequence = async () => {
  if (!currentMatch.value) return;

  // 1. 进入准备阶段，显示参赛名单
  displayState.value = "preparing";
  isConnected.value = true;

  // 2. 倒计时
  countdown.value = 5;
  const countdownInterval = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(countdownInterval);
      startGame();
    }
  }, 1000);
};

// 开始游戏
const startGame = async () => {
  displayState.value = "gaming";

  // 等待DOM更新
  await nextTick();

  // 启动游戏时间更新
  const gameTimeInterval = setInterval(updateGameTime, 1000);

  // 存储interval以便清理
  (window as any).gameTimeInterval = gameTimeInterval;
};

// 处理游戏结束
const handleGameEnded = (finalScores: any[]) => {
  console.log("游戏结束，最终得分:", finalScores);

  // 清理游戏时间更新
  if ((window as any).gameTimeInterval) {
    clearInterval((window as any).gameTimeInterval);
    delete (window as any).gameTimeInterval;
  }

  // 处理游戏结果
  gameResults.value = finalScores
    .map((score) => ({
      username: score.username,
      nickname: score.nickname || score.username,
      score: score.score,
    }))
    .sort((a, b) => b.score - a.score); // 按分数降序排列

  // 向主控台报告结果 - 确保currentMatch存在
  if (currentMatch.value) {
    // 计算并列排名（同一局内小分相同者并列，同积分档位）
    // 使用“竞技排名”规则：并列占据名次，下一名次跳过相应人数。
    // 例如分数 [100, 100, 95] -> 排名 [1, 1, 3]
    let processed = 0;
    let lastScore: number | null = null;
    let currentRank = 0;

    const scoresWithRank = gameResults.value.map((result) => {
      processed += 1;
      if (lastScore === null || result.score !== lastScore) {
        currentRank = processed; // 新分数档的起始名次
        lastScore = result.score;
      }
      return {
        username: result.username,
        rawScore: result.score,
        rank: currentRank,
      };
    });

    const matchResult = {
      status: "completed",
      matchId: currentMatch.value.matchId,
      groupId: currentMatch.value.groupId,
      roundNumber: currentMatch.value.roundNumber,
      playoff: !!currentMatch.value.playoff,
      winnersNeeded: currentMatch.value.winnersNeeded,
      scores: scoresWithRank,
    };

    console.log("发送比赛结果到主控台:", matchResult);
    localStorage.setItem(
      "tournament_match_result",
      JSON.stringify(matchResult)
    );
  } else {
    console.error("无法发送比赛结果：当前比赛信息为空");
  }

  // 显示结果
  displayState.value = "results";

  // 5秒后返回等待状态
  setTimeout(() => {
    displayState.value = "waiting";
    currentMatch.value = null;
    gameResults.value = [];
    shuffledUsers.value = []; // 清理打乱后的用户列表
    isConnected.value = false;
  }, 10000);
};

// 生命周期
onMounted(async () => {
  // 初始化赛事系统
  try {
    await tournamentStore.initialize();
  } catch (err) {
    console.error("赛事系统初始化失败:", err);
  }

  // 开始监听指令
  window.addEventListener("storage", handleStorageChange);

  // 启动时间更新
  updateCurrentTime();
  const timeInterval = setInterval(updateCurrentTime, 1000);
  (window as any).timeInterval = timeInterval;

  // 检查URL参数，看是否指定了特定小组
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get("group");
  if (groupId) {
    console.log("显示指定小组:", groupId);
    // 可以在这里设置特定小组的显示逻辑
  }
});

onUnmounted(() => {
  window.removeEventListener("storage", handleStorageChange);

  // 清理定时器
  if ((window as any).timeInterval) {
    clearInterval((window as any).timeInterval);
    delete (window as any).timeInterval;
  }

  if ((window as any).gameTimeInterval) {
    clearInterval((window as any).gameTimeInterval);
    delete (window as any).gameTimeInterval;
  }
});
</script>

<style scoped>
.tournament-display {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-color);
  background-image: radial-gradient(
      rgba(74, 222, 128, 0.1) 2px,
      transparent 2px
    ),
    radial-gradient(rgba(74, 222, 128, 0.05) 2px, transparent 2px);
  background-size: 50px 50px;
  background-position: 0 0, 25px 25px;
  color: var(--text-color);
  overflow: hidden;
  font-family: "Press Start 2P", monospace;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.confetti-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

/* 等待状态 */
.waiting-state {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(
    circle at center,
    rgba(74, 222, 128, 0.15) 0%,
    transparent 70%
  );
}

.waiting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background-color: var(--card-bg);
  border-bottom: 4px solid var(--accent-color);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.tournament-title {
  display: flex;
  align-items: center;
  gap: 15px;
}

.tournament-title .logo-icon {
  font-size: 40px;
  animation: pulse 2s infinite;
}

.tournament-title h1 {
  font-size: 24px;
  color: var(--accent-color);
  margin: 0;
  text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
}

.header-info {
  display: flex;
  flex-direction: column;
  align-items: end;
  gap: 5px;
}

.date-info,
.time-info {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
}

.date-info {
  color: var(--accent-color);
}

.waiting-main {
  flex: 1;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 30px;
  padding: 40px;
}

/* 终极结果页样式 */
.finale-container {
  padding: 30px 40px;
}

.finale-header {
  text-align: center;
  margin: 20px 0 10px;
}

.finale-title {
  color: var(--accent-color);
  font-size: 24px;
  margin-bottom: 8px;
}

.finale-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.left-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.right-main {
  background-color: var(--card-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  padding: 25px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.stage-info h2,
.participants-compact h3,
.current-standings h2 {
  font-size: 18px;
  color: var(--accent-color);
  margin-bottom: 16px;
  text-transform: uppercase;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.stage-card {
  background-color: var(--card-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  padding: 25px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.stage-name {
  font-size: 20px;
  color: var(--accent-color);
  margin-bottom: 10px;
  text-transform: uppercase;
}

.stage-status {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 15px;
}

.stage-progress {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.8;
}

.waiting-indicator-inline {
  display: flex;
  justify-content: center;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}

.participants-compact {
  background-color: var(--card-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  padding: 20px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.participant-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background-color: var(--input-bg);
  border: 2px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
}

.participant-num {
  color: var(--accent-color);
  font-weight: bold;
  margin-right: 8px;
  min-width: 20px;
}

.participant-name {
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.waiting-indicator .status-text {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 15px;
  text-transform: uppercase;
}

.loading-animation {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  background-color: var(--accent-color);
  border-radius: 50%;
  animation: loading 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}
.dot:nth-child(2) {
  animation-delay: -0.16s;
}

.more-participants {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-color);
  opacity: 0.7;
  text-transform: uppercase;
}

.standings-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.standing-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 80px;
  gap: 15px;
  padding: 12px 15px;
  background-color: var(--input-bg);
  border: 2px solid var(--border-color);
  border-radius: 4px;
  align-items: center;
}

.standing-row.top-three {
  border-color: var(--accent-color);
  background-color: rgba(74, 222, 128, 0.1);
}

.standing-rank {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
  text-align: center;
}

.standing-player {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.standing-points {
  font-size: 12px;
  color: var(--accent-color);
  font-weight: bold;
  text-align: right;
}

.standing-score {
  font-size: 11px;
  color: var(--text-color);
  text-align: right;
  opacity: 0.8;
}

.more-standings {
  text-align: center;
  font-size: 10px;
  color: var(--text-color);
  opacity: 0.7;
  padding: 10px;
}

/* 准备状态 */
.preparing-state {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 40px;
}

.match-header {
  text-align: center;
  margin-bottom: 40px;
}

.match-title {
  font-size: 24px;
  color: var(--accent-color);
  margin-bottom: 10px;
  text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
}

.match-info {
  font-size: 14px;
  color: var(--text-color);
}

.participants-display {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.participants-display h3 {
  font-size: 18px;
  text-align: center;
  margin-bottom: 30px;
  color: var(--text-color);
  text-transform: uppercase;
}

.participants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 20px;
}

.participant-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background-color: var(--card-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  animation: fadeInUp 0.5s ease-out forwards;
  transform: translateY(30px);
  opacity: 0;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.participant-number {
  width: 50px;
  height: 50px;
  background-color: var(--accent-color);
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.participant-info {
  flex: 1;
}

.participant-username {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.participant-nickname {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.7;
}

.countdown-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-top: 40px;
}

.countdown-text {
  font-size: 18px;
  color: var(--text-color);
  text-transform: uppercase;
}

.countdown-timer {
  font-size: 32px;
  color: var(--accent-color);
  text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
  animation: pixelPulse 1s infinite;
}

@keyframes pixelPulse {
  0%,
  100% {
    transform: scale(1);
    text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
  }
  50% {
    transform: scale(1.1);
    text-shadow: 4px 4px 0px rgba(0, 0, 0, 0.5), 0 0 20px var(--accent-color);
  }
}

/* 游戏状态 */
.gaming-state {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 30px;
  background-color: var(--card-bg);
  border-bottom: 4px solid var(--accent-color);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.match-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.group-name {
  font-size: 14px;
  color: var(--accent-color);
  text-transform: uppercase;
}

.round-info {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
}

.game-time {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
}

.game-container {
  flex: 1;
  position: relative;
}

/* 结果状态 */
.results-state {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 40px;
  text-align: center;
}

.results-header {
  margin-bottom: 40px;
}

.results-title {
  font-size: 24px;
  color: var(--accent-color);
  margin-bottom: 10px;
  text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
}

.results-info {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
}

.results-podium {
  display: flex;
  justify-content: center;
  align-items: end;
  gap: 30px;
  margin-bottom: 50px;
  height: 200px;
}

.podium-place {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 4px solid;
  border-radius: 4px;
  min-width: 180px;
  position: relative;
  animation: slideUp 0.8s ease-out;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.first-place {
  border-color: #ffd700;
  background: linear-gradient(
    135deg,
    rgba(255, 215, 0, 0.2) 0%,
    rgba(255, 215, 0, 0.05) 100%
  );
  height: 160px;
}

.second-place {
  border-color: #c0c0c0;
  background: linear-gradient(
    135deg,
    rgba(192, 192, 192, 0.2) 0%,
    rgba(192, 192, 192, 0.05) 100%
  );
  height: 130px;
}

.third-place {
  border-color: #cd7f32;
  background: linear-gradient(
    135deg,
    rgba(205, 127, 50, 0.2) 0%,
    rgba(205, 127, 50, 0.05) 100%
  );
  height: 100px;
}

.place-rank {
  position: absolute;
  top: -20px;
  width: 40px;
  height: 40px;
  background-color: var(--card-bg);
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-color);
  text-transform: uppercase;
}

.first-place .place-rank {
  border-color: #ffd700;
}
.second-place .place-rank {
  border-color: #c0c0c0;
}
.third-place .place-rank {
  border-color: #cd7f32;
}

.place-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 20px;
}

.place-username {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 10px;
  text-transform: uppercase;
}

.place-score {
  font-size: 18px;
  color: var(--accent-color);
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.winner-crown {
  font-size: 32px;
  position: absolute;
  top: -40px;
  animation: bounce 2s infinite;
}

.full-results {
  width: 100%;
  margin: 0 auto;
}

.full-results h3 {
  font-size: 18px;
  margin-bottom: 30px;
  color: var(--text-color);
  text-transform: uppercase;
  text-align: center;
}

.results-columns {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  align-items: start;
}

.result-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 15px;
  background-color: var(--input-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
  position: relative;
}

.result-card.top-three {
  background-color: var(--card-bg);
  border-color: var(--accent-color);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}

.result-card.first {
  border-color: #ffd700;
  background: linear-gradient(
    135deg,
    rgba(255, 215, 0, 0.15) 0%,
    var(--card-bg) 100%
  );
}

.result-card.second {
  border-color: #c0c0c0;
  background: linear-gradient(
    135deg,
    rgba(192, 192, 192, 0.15) 0%,
    var(--card-bg) 100%
  );
}

.result-card.third {
  border-color: #cd7f32;
  background: linear-gradient(
    135deg,
    rgba(205, 127, 50, 0.15) 0%,
    var(--card-bg) 100%
  );
}

.result-rank {
  width: 40px;
  height: 40px;
  background-color: var(--accent-color);
  color: #000;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-transform: uppercase;
  flex-shrink: 0;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.result-card.first .result-rank {
  background-color: #ffd700;
}

.result-card.second .result-rank {
  background-color: #c0c0c0;
}

.result-card.third .result-rank {
  background-color: #cd7f32;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-username {
  font-size: 12px;
  color: var(--text-color);
  text-transform: uppercase;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-nickname {
  font-size: 10px;
  color: var(--text-color);
  opacity: 0.7;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-score {
  font-size: 12px;
  color: var(--accent-color);
  text-transform: uppercase;
  text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
}

.rank-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
  background-color: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-actions {
  margin-top: 30px;
}

.next-info {
  font-size: 14px;
  color: var(--text-color);
  text-transform: uppercase;
  animation: pixelPulse 2s infinite;
}

/* 连接状态指示器 */
.connection-status {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--card-bg);
  border: 3px solid var(--border-color);
  border-radius: 4px;
  font-size: 10px;
  z-index: 1000;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: var(--error-color);
  image-rendering: pixelated;
}

.connection-status.connected .status-dot {
  background-color: var(--accent-color);
  animation: pixelPulse 2s infinite;
}

/* 动画 */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pixel-spinner {
  width: 32px;
  height: 32px;
  background-color: var(--accent-color);
  animation: pixel-spin 1s steps(8) infinite;
  image-rendering: pixelated;
}

@keyframes pixel-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes loading {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .waiting-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .tournament-title h1 {
    font-size: 18px;
  }

  .waiting-main {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }

  .left-sidebar {
    order: 2;
  }

  .right-main {
    order: 1;
  }

  .match-title {
    font-size: 18px;
  }

  .participants-grid {
    grid-template-columns: 1fr;
    padding: 10px;
  }

  .results-podium {
    flex-direction: column;
    height: auto;
    gap: 15px;
  }

  .first-place,
  .second-place,
  .third-place {
    height: 120px;
    width: 100%;
    max-width: 300px;
  }

  .game-header {
    flex-direction: column;
    gap: 10px;
  }

  .results-columns {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .result-card {
    padding: 10px 12px;
    gap: 12px;
  }

  .result-rank {
    width: 35px;
    height: 35px;
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .tournament-display {
    font-size: 12px;
  }

  .tournament-title h1 {
    font-size: 14px;
  }

  .tournament-title .logo-icon {
    font-size: 30px;
  }

  .waiting-main {
    padding: 15px;
  }

  .match-title {
    font-size: 14px;
  }

  .countdown-timer {
    font-size: 24px;
  }

  .results-columns {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .result-card {
    padding: 8px 10px;
    gap: 10px;
  }

  .result-rank {
    width: 30px;
    height: 30px;
    font-size: 8px;
  }

  .result-username {
    font-size: 10px;
  }

  .result-nickname {
    font-size: 8px;
  }

  .result-score {
    font-size: 10px;
  }

  .rank-badge {
    width: 20px;
    height: 20px;
    font-size: 12px;
    top: -6px;
    right: -6px;
  }
}
</style>
