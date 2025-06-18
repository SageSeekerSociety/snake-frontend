<template>
  <div class="not-found-container container-base">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <div class="pixel-snake error-snake"></div>
      <h1 class="error-title">页面未找到</h1>
      <p class="error-message">抱歉，您请求的页面不存在</p>
      <router-link to="/" class="pixel-button">返回首页</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.error-code {
  font-size: 72px;
  font-weight: bold;
  color: var(--error-color);
  text-shadow: 4px 4px 0px rgba(0, 0, 0, 0.5);
}

.error-snake {
  background: linear-gradient(90deg, 
    var(--error-color) 0%, 
    var(--error-color) 100%
  );
}

.error-snake::before {
  background-color: var(--error-color);
}

.error-title {
  font-size: 24px;
  color: var(--text-color);
}

.error-message {
  font-size: 14px;
  color: var(--border-color);
  margin-bottom: 20px;
}

.pixel-button {
  background-color: var(--button-color);
  border: none;
  padding: 12px 20px;
  color: black;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  text-transform: uppercase;
  box-shadow: 0px 4px 0px rgba(0, 0, 0, 0.2);
  text-decoration: none;
  display: inline-block;
}

.pixel-button:hover {
  background-color: var(--button-hover);
  transform: translateY(-2px);
  box-shadow: 0px 6px 0px rgba(0, 0, 0, 0.2);
}

.pixel-button:active {
  transform: translateY(2px);
  box-shadow: 0px 0px 0px rgba(0, 0, 0, 0.2);
}
</style> 