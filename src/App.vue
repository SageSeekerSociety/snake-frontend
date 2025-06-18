<template>
  <div class="app-container">
    <TopAppBar />
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import TopAppBar from "./components/TopAppBar.vue";

onMounted(() => {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(fontLink);
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

:root {
  --bg-color: #0f0f1e;
  --border-color: #4a4a5e;
  --accent-color: #4ade80;
  --text-color: #ffffff;
  --error-color: #ef4444;
  --success-color: #10b981;
  --button-color: #4ade80;
  --button-hover: #22c55e;
  --input-bg: #1f1f3d;
  --card-bg: #1a1a2e;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  font-family: 'Press Start 2P', monospace;
  color: var(--text-color);
  overflow: hidden;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-color);
  background-image:
    radial-gradient(rgba(74, 222, 128, 0.1) 2px, transparent 2px),
    radial-gradient(rgba(74, 222, 128, 0.05) 2px, transparent 2px);
  background-size: 50px 50px;
  background-position: 0 0, 25px 25px;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.app-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding-top: 60px; /* Height of the top bar */
  height: calc(100vh - 60px);
  overflow: hidden;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .app-container {
    flex-direction: column;
  }
}
</style>
