<template>
  <div class="home-container container-base">
    <div class="home-content content-card">
      <div class="game-logo">
        <span class="logo-text">蛇王争霸</span>
        <div class="pixel-snake"></div>
      </div>

      <div class="welcome-message">
        <h2>欢迎回来，{{ nickname }}!</h2>
        <p class="pixel-text">选择你想要进行的操作</p>
      </div>

      <div class="menu-container">
        <router-link to="/game" class="menu-button">
          <div class="pixel-icon game-icon"></div>
          <span>开始对局</span>
        </router-link>

        <router-link to="/submit" class="menu-button">
          <div class="pixel-icon code-icon"></div>
          <span>提交算法</span>
        </router-link>

        <router-link to="/tournament" class="menu-button tournament-button">
          <div class="pixel-icon tournament-icon"></div>
          <span>赛事管理</span>
        </router-link>

        <router-link to="/recordings" class="menu-button">
          <div class="pixel-icon battle-icon"></div>
          <span>查看回放</span>
        </router-link>

        <router-link to="/rules" class="menu-button snake-button">
          <div class="pixel-icon docs-icon"></div>
          <span>查看文档</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuth } from '../stores/auth';

const { state } = useAuth();

const nickname = computed(() => state.user?.nickname || '玩家');
</script>

<style scoped>
.home-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 60px);
  padding: 20px;
  overflow: hidden;
}

.home-content {
  background-color: var(--card-bg);
  border: 4px solid var(--border-color);
  border-radius: 8px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.2);
}

.game-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.logo-text {
  font-size: 32px;
  color: var(--accent-color);
  text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.5);
}

.welcome-message {
  text-align: center;
}

.welcome-message h2 {
  font-size: 18px;
  margin-bottom: 10px;
  color: var(--text-color);
}

.pixel-text {
  font-size: 14px;
  color: var(--accent-color);
}

.menu-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

.menu-button {
  display: flex;
  align-items: center;
  gap: 15px;
  background-color: var(--input-bg);
  border: 3px solid var(--border-color);
  padding: 15px;
  border-radius: 4px;
  text-decoration: none;
  color: var(--text-color);
  font-size: 14px;
  transition: all 0.2s;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
}

.menu-button:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
}

.menu-button.snake-button {
  background-color: rgba(74, 222, 128, 0.1);
  position: relative;
}

.menu-button.snake-button::after {
  content: 'NEW';
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: var(--accent-color);
  color: black;
  font-size: 8px;
  padding: 4px 6px;
  border-radius: 4px;
}

.menu-button.tournament-button {
  background-color: rgba(255, 193, 7, 0.1);
  border-color: rgba(255, 193, 7, 0.3);
  position: relative;
}

.menu-button.tournament-button:hover {
  border-color: #ffc107;
}

.menu-button.tournament-button::after {
  content: '🏆';
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 14px;
}

.pixel-icon {
  width: 24px;
  height: 24px;
  image-rendering: pixelated;
}

/* 开始对局 - 抽象八边形 */
.game-icon {
  background-color: var(--accent-color);
  clip-path: polygon(
    25% 8%, 75% 8%, 92% 25%, 92% 75%,
    75% 92%, 25% 92%, 8% 75%, 8% 25%
  );
}

/* 提交算法 - 抽象箭头方块 */
.code-icon {
  background-color: var(--accent-color);
  clip-path: polygon(
    8% 8%, 70% 8%, 92% 50%, 70% 92%, 8% 92%, 30% 50%
  );
}

/* 查看回放 - 抽象播放形状 */
.battle-icon {
  background-color: var(--accent-color);
  clip-path: polygon(
    15% 8%, 85% 50%, 15% 92%
  );
}

/* 赛事管理 - 抽象奖杯形状 */
.tournament-icon {
  background-color: #ffc107;
  clip-path: polygon(
    25% 8%, 75% 8%, 85% 15%, 85% 30%, 
    75% 35%, 75% 75%, 85% 85%, 
    85% 92%, 15% 92%, 15% 85%, 
    25% 75%, 25% 35%, 15% 30%, 
    15% 15%
  );
}

/* 查看文档 - 抽象折角方块 */
.docs-icon {
  background-color: var(--accent-color);
  clip-path: polygon(
    8% 8%, 70% 8%, 92% 30%, 92% 92%, 8% 92%
  );
}

.logout-icon {
  background-color: var(--error-color);
  clip-path: polygon(
    0% 25%, 75% 25%, 75% 0%, 100% 50%,
    75% 100%, 75% 75%, 0% 75%
  );
}

/* 保留其它图标样式不变 */

/* 响应式布局 */
@media (max-width: 600px) {
  .home-content {
    padding: 30px 20px;
  }

  .logo-text {
    font-size: 24px;
  }

  .pixel-snake {
    width: 150px;
  }
}
</style>
