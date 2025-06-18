<template>
  <div class="rules-container container-base">
    <div class="rules-card pixel-border">
      <div class="rules-header">
        <h1 class="rules-title">规则与算法说明</h1>
        <div class="pixel-snake"></div>
      </div>

      <div class="rules-content">
        <div class="rules-tabs">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            游戏规则
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'algorithm' }"
            @click="activeTab = 'algorithm'"
          >
            算法接口
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'template' }"
            @click="activeTab = 'template'"
          >
            示例代码
          </button>
        </div>

        <div class="tab-content">
          <!-- 游戏规则标签页 -->
          <div v-if="activeTab === 'rules'" class="rules-section">
            <h2>一、游戏概述</h2>
            <p>本平台是一个多人贪吃蛇对战游戏，玩家可以通过编写算法程序控制蛇的行为，与其他玩家的蛇进行竞争。游戏的目标是通过吃食物获取分数，同时避免碰撞墙壁、障碍物或其他蛇。游戏结束时，得分最高的蛇获胜。</p>

            <h2>二、游戏地图</h2>
            <ul>
              <li>地图大小：40×30格（宽×高）</li>
              <li>坐标系统：以左上角为原点(0,0)，向右为x轴正方向，向下为y轴正方向</li>
              <li>每个格子大小：20×20像素</li>
            </ul>

            <h2>三、游戏实体</h2>
            <h3>1. 蛇</h3>
            <ul>
              <li>初始长度：5格</li>
              <li>移动方式：每个游戏刻(tick)移动一格，方向为上、下、左、右四个方向之一</li>
              <li>蛇的组成：由头部和身体段组成，身体跟随头部移动</li>
              <li>蛇的属性：
                <ul>
                  <li>学号/ID：唯一标识符</li>
                  <li>长度：蛇的当前长度</li>
                  <li>分数：当前累积的分数</li>
                  <li>方向：当前移动方向（0-左，1-上，2-右，3-下）</li>
                  <li>护盾冷却时间：使用护盾后的冷却时间</li>
                  <li>护盾剩余时间：当前护盾的剩余有效时间</li>
                </ul>
              </li>
            </ul>

            <h3>2. 食物</h3>
            <ul>
              <li>普通食物：提供1-5分的分数，不同分值的食物颜色不同</li>
              <li>增长豆（Growth Bean）：使蛇增长但不增加分数，值为-1</li>
              <li>陷阱（Trap）：减少分数，值为-2</li>
            </ul>

            <h3>3. 障碍物</h3>
            <ul>
              <li>墙壁：固定障碍物，值为-4</li>
              <li>碰撞墙壁会导致蛇死亡</li>
            </ul>

            <h2>四、游戏机制</h2>
            <h3>1. 蛇的成长</h3>
            <ul>
              <li>蛇每获得20分会自动增长一格</li>
              <li>吃到增长豆会直接增长长度</li>
            </ul>

            <h3>2. 护盾系统</h3>
            <ul>
              <li>初始护盾：蛇出生时有一个持续10个tick的初始护盾</li>
              <li>护盾激活：玩家可以主动激活护盾（决策值为4）</li>
              <li>护盾效果：激活护盾时蛇不移动，并且在护盾持续期间免疫碰撞伤害</li>
              <li>护盾持续时间：5个tick</li>
              <li>护盾冷却时间：30个tick</li>
              <li>护盾激活消耗：20分</li>
            </ul>

            <h3>3. 碰撞规则</h3>
            <ul>
              <li>蛇与墙壁碰撞：蛇死亡（护盾无效）</li>
              <li>蛇与障碍物碰撞：蛇死亡（护盾无效）</li>
              <li>蛇与蛇身体碰撞：
                <ul>
                  <li>如果有护盾：免疫碰撞，可以穿过蛇身体</li>
                  <li>如果没有护盾：碰撞的蛇死亡</li>
                </ul>
              </li>
              <li>蛇头与蛇头碰撞：
                <ul>
                  <li>两条蛇都有护盾：两条蛇都不死亡，都免疫碰撞</li>
                  <li>只有一条蛇有护盾：没有护盾的蛇死亡</li>
                  <li>两条蛇都没有护盾：两条蛇都死亡</li>
                </ul>
              </li>
            </ul>

            <h3>4. 食物生成</h3>
            <ul>
              <li>游戏开始时生成初始食物（约10个）</li>
              <li>游戏过程中每3个tick周期性生成新食物（每次最多4个）</li>
              <li>食物有生命周期，一段时间后会消失：
                <ul>
                  <li>普通食物：60个tick</li>
                  <li>增长豆：80个tick</li>
                  <li>陷阱：80个tick</li>
                </ul>
              </li>
              <li>食物生成位置会避开蛇头和障碍物</li>
              <li>蛇死亡时会根据其分数在其身体位置生成食物（每个食物最多20分，直到分数用完）</li>
            </ul>

            <h3>5. 游戏阶段</h3>
            <p>游戏分为三个阶段，不同阶段食物生成的类型和数量有所不同：</p>
            <ul>
              <li>早期阶段（EARLY）：1-80 tick
                <ul>
                  <li>主要生成普通食物（1分为主）和增长豆</li>
                  <li>食物权重分布：普通食物(1分)55%，普通食物(2分)20%，普通食物(3分)5%，增长豆20%</li>
                </ul>
              </li>
              <li>中期阶段（MID）：81-200 tick
                <ul>
                  <li>引入更多高分值食物和少量陷阱</li>
                  <li>食物权重分布：普通食物(1-5分)78%，增长豆12%，陷阱10%</li>
                </ul>
              </li>
              <li>后期阶段（LATE）：201-256 tick
                <ul>
                  <li>高风险高回报，更多高分值食物和陷阱</li>
                  <li>食物权重分布：普通食物(1-5分)80%，增长豆5%，陷阱15%</li>
                </ul>
              </li>
            </ul>

            <h2>五、游戏结束条件</h2>
            <ul>
              <li>游戏时间结束（总共256个tick）</li>
              <li>场上只剩一条或没有蛇存活</li>
            </ul>
          </div>

          <!-- 算法接口标签页 -->
          <div v-if="activeTab === 'algorithm'" class="algorithm-section">
            <h2>一、输入格式</h2>
            <p>算法程序通过标准输入（stdin）接收游戏状态信息，格式如下：</p>
            <pre class="code-block">
t                   // 距离游戏结束的剩余时间（tick数）
k                   // 场上特殊物品数量（食物和墙）
x1 y1 v1            // 第1个物品的坐标和值
x2 y2 v2            // 第2个物品的坐标和值
...
xk yk vk            // 第k个物品的坐标和值
n                   // 场上存活的玩家数量
id1 len1 score1 dir1 shield_cd1 shield_time1  // 第1个玩家的信息
x1_1 y1_1           // 第1个玩家蛇头的坐标
x1_2 y1_2           // 第1个玩家蛇身第1段的坐标
...
x1_len1 y1_len1     // 第1个玩家蛇尾的坐标
id2 len2 score2 dir2 shield_cd2 shield_time2  // 第2个玩家的信息
...</pre>

            <p>其中：</p>
            <ul>
              <li>物品值v的含义：
                <ul>
                  <li>正整数：普通食物，提供对应分数</li>
                  <li>-1：增长豆</li>
                  <li>-2：陷阱</li>
                  <li>-4：墙</li>
                </ul>
              </li>
              <li>玩家信息包括：
                <ul>
                  <li>id：玩家学号/ID</li>
                  <li>len：蛇的长度</li>
                  <li>score：当前分数</li>
                  <li>dir：当前方向（0-左，1-上，2-右，3-下）</li>
                  <li>shield_cd：护盾冷却时间</li>
                  <li>shield_time：护盾剩余有效时间</li>
                </ul>
              </li>
            </ul>

            <h2>二、输出格式</h2>
            <p>算法程序通过标准输出（stdout）输出决策，格式为一个整数：</p>
            <ul>
              <li>0：向左移动</li>
              <li>1：向上移动</li>
              <li>2：向右移动</li>
              <li>3：向下移动</li>
              <li>4：激活护盾</li>
            </ul>

            <h2>三、决策限制</h2>
            <ul>
              <li>CPU时间限制：1秒</li>
              <li>内存限制：128MB</li>
              <li>墙时间限制：10秒</li>
            </ul>

            <h2>四、错误处理</h2>
            <p>如果算法程序出现以下情况，蛇将被判定为"failed to make a decision"并死亡：</p>
            <ul>
              <li>程序崩溃或异常退出</li>
              <li>超出时间或内存限制</li>
              <li>输出无效的决策值</li>
              <li>决策导致蛇撞墙或其他非法移动</li>
            </ul>

            <h2>五、算法编写建议</h2>
            <h3>1. 基本策略</h3>
            <ul>
              <li>避免碰撞：优先避开墙壁、障碍物和其他蛇</li>
              <li>食物追踪：寻找并移动到最有价值的食物</li>
              <li>空间利用：避免将自己困在狭小空间内</li>
              <li>护盾使用：在危险情况下合理使用护盾</li>
            </ul>

            <h3>2. 进阶策略</h3>
            <ul>
              <li>路径规划：使用A*等算法寻找最优路径</li>
              <li>风险评估：评估每个移动方向的风险</li>
              <li>对手预测：预测其他蛇的移动路径</li>
              <li>区域控制：控制有利的游戏区域</li>
              <li>攻击策略：在合适时机尝试围堵或攻击其他蛇</li>
            </ul>
          </div>

          <!-- 示例代码标签页 -->
          <div v-if="activeTab === 'template'" class="template-section">
            <div class="template-header">
              <h2>C++算法模板</h2>
              <button @click="downloadTemplate" class="pixel-button download-button">
                下载模板
              </button>
            </div>

            <p>以下是一个使用现代C++特性的算法框架，包含完整的输入解析和随机决策逻辑：</p>

            <pre class="code-block">{{ templateCode }}</pre>

            <div class="template-notes">
              <h3>使用说明</h3>
              <ol>
                <li>将上面的代码保存为 .cpp 文件</li>
                <li>修改 <code>MY_STUDENT_ID</code> 常量为你的学号</li>
                <li>在 <code>makeDecision</code> 方法中实现你的算法逻辑</li>
                <li>编译并测试你的代码</li>
                <li>提交到平台参与对战</li>
              </ol>

              <h3>编译命令</h3>
              <pre class="code-block">g++ -std=c++17 -O2 -Wall your_file.cpp -o snake_algorithm</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 当前激活的标签页
const activeTab = ref('rules');

// 示例代码模板
const templateCode = ref('');

// 从文件加载模板代码
const loadTemplateCode = async () => {
  try {
    const response = await fetch('/snake_algorithm_template.cpp');
    templateCode.value = await response.text();
  } catch (error) {
    console.error('加载模板代码失败:', error);
    templateCode.value = '加载模板代码失败，请刷新页面重试。';
  }
};

// 下载模板代码
const downloadTemplate = () => {
  const element = document.createElement('a');
  const file = new Blob([templateCode.value], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = 'snake_algorithm_template.cpp';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

onMounted(() => {
  loadTemplateCode();
});
</script>

<style scoped>
.rules-container {
  overflow-y: auto;
}

.rules-card {
  width: 100%;
  max-width: 1000px;
  background-color: var(--card-bg);
  padding: 16px;
  margin: 0 auto;
}

.rules-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
  text-align: center;
}

.rules-title {
  font-size: 24px;
  color: var(--accent-color);
  margin-bottom: 15px;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.rules-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rules-tabs {
  display: flex;
  gap: 10px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 10px;
}

.tab-button {
  background: none;
  border: none;
  padding: 8px 16px;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: all 0.2s;
}

.tab-button:hover {
  background-color: rgba(74, 222, 128, 0.1);
}

.tab-button.active {
  color: var(--accent-color);
  border-bottom: 2px solid var(--accent-color);
}

.tab-content {
  padding: 20px 0;
  overflow-y: auto;
  max-height: calc(100vh - 300px);

  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--card-bg);
}

/* Webkit浏览器的滚动条样式 */
.tab-content::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.tab-content::-webkit-scrollbar-track {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border: 2px solid var(--card-bg);
  border-radius: 4px;
  image-rendering: pixelated;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: var(--button-hover);
}

/* 游戏规则样式 */
.rules-section h2,
.algorithm-section h2,
.template-section h2 {
  font-size: 18px;
  color: var(--accent-color);
  margin: 25px 0 15px 0;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.rules-section h3,
.algorithm-section h3,
.template-section h3 {
  font-size: 16px;
  color: var(--text-color);
  margin: 20px 0 10px 0;
}

.rules-section p,
.algorithm-section p,
.template-section p {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 15px;
}

.rules-section ul,
.algorithm-section ul,
.template-section ul,
.template-section ol {
  padding-left: 20px;
  margin-bottom: 15px;
}

.rules-section li,
.algorithm-section li,
.template-section li {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}

.rules-section ul ul,
.algorithm-section ul ul,
.template-section ul ul {
  margin-top: 8px;
  margin-bottom: 0;
}

/* 代码块样式 */
.code-block {
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 15px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  margin: 15px 0;
  color: #e0e0e0;
}

/* 模板部分样式 */
.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.download-button {
  font-size: 10px;
  padding: 8px 12px;
}

.template-notes {
  margin-top: 30px;
  padding: 15px;
  background-color: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 4px;
}

code {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 2px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 14px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .rules-card {
    padding: 20px;
  }

  .rules-title {
    font-size: 20px;
  }

  .tab-button {
    font-size: 10px;
    padding: 6px 10px;
  }

  .template-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>
