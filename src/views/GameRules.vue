<template>
  <div class="rules-container container-base">
    <div class="rules-card pixel-border">
      <div class="rules-header">
        <h1 class="rules-title">规则与算法说明</h1>
        <div class="pixel-snake"></div>
      </div>

      <div class="rules-content">
        <div class="rules-tabs">
          <button class="tab-button" :class="{ active: activeTab === 'rules' }" @click="activeTab = 'rules'">
            游戏规则
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'algorithm' }" @click="activeTab = 'algorithm'">
            算法接口
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'template' }" @click="activeTab = 'template'">
            示例代码
          </button>
        </div>

        <div class="tab-content">
          <div v-if="activeTab === 'rules'" class="rules-section">
            <h2>一、游戏概述</h2>
            <p>
              本平台是一个多人在线对战的贪吃蛇游戏。玩家需编写算法程序，通过接口控制蛇的移动与行为，与其他玩家的程序进行博弈。游戏的核心目标是在有限的回合内，通过获取食物来最大化得分，同时规避各类风险。游戏结束时，得分最高的玩家获胜。
            </p>

            <h2>二、游戏地图</h2>
            <ul>
              <li>地图尺寸：40 × 30 格 (宽 × 高)</li>
              <li>坐标系统：以左上角为原点(0, 0)，x轴向右递增，y轴向下递增。</li>
              <li>格子尺寸：20 × 20 像素</li>
            </ul>

            <h2>三、游戏实体</h2>
            <h3>1. 蛇</h3>
            <ul>
              <li>初始长度：5格</li>
              <li>移动方式：每个游戏刻 (tick) 移动一格。蛇由头部和身体组成，身体会跟随头部已走过的路径移动。</li>
            </ul>

            <h3>2. 场上物品</h3>
            <ul>
              <li><b>普通食物</b>：提供1-5分，不同分值的食物颜色不同。</li>
              <li><b>增长豆</b>：使蛇的长度增加两格，不提供分数，其值为<code>-1</code>。</li>
              <li><b>陷阱</b>：触碰后会扣除一定分数，其值为<code>-2</code>。</li>
            </ul>

            <h2>四、游戏机制</h2>
            <h3>1. 蛇的成长</h3>
            <ul>
              <li>分数增长：蛇的得分每累计达到20的倍数，长度会自动增加一格。</li>
              <li>直接增长：吃到增长豆会使长度立即增加两格。</li>
            </ul>

            <h3>2. 护盾系统</h3>
            <ul>
              <li>蛇在出生时自带一个持续10个游戏刻的初始护盾。</li>
              <li>玩家可以消耗20分主动激活护盾。激活护盾是一个决策动作，该游戏刻蛇将<b>停留在原地</b>。</li>
              <li>护盾激活后持续5个游戏刻，在此期间蛇免疫因碰撞导致的死亡（墙壁除外）。</li>
              <li>主动激活的护盾有30个游戏刻的冷却时间。</li>
            </ul>

            <h3>3. 碰撞规则</h3>
            <ul>
              <li><b>与障碍物碰撞</b>：蛇立即死亡。<b>此规则优先级最高，护盾无效</b></li>
              <li><b>与自己的身体碰撞</b>：无影响，不会死亡</li>
              <li><b>与其他蛇身体碰撞</b>：
                <ul>
                  <li>持有护盾：免疫碰撞，可安全穿过对方蛇的身体</li>
                  <li>未持有护盾：碰撞方立即死亡</li>
                </ul>
              </li>
              <li><b>蛇头与蛇头碰撞</b>：
                <ul>
                  <li>双方均有护盾：双方均不受伤害</li>
                  <li>仅一方有护盾：未持有护盾的一方死亡</li>
                  <li>双方均无护盾：双方同时死亡</li>
                </ul>
              </li>
            </ul>

            <h3>4. 食物生成</h3>
            <ul>
              <li>游戏开始时会生成一批初始食物，之后每3个游戏刻会周期性生成新食物。</li>
              <li><b>生命周期</b>：场上物品若长时间未被拾取将会消失。
                <ul>
                  <li>普通食物：60个游戏刻</li>
                  <li>增长豆/陷阱：80个游戏刻</li>
                </ul>
              </li>
              <li><b>数量限制</b>：场上同时存在的食物总数受限于当前存活的蛇的数量。达到上限后，系统将暂停生成新食物。</li>
              <li><b>死亡转化</b>：蛇死亡后，其身体所在的位置会根据其分数转化为新的食物（每份食物价值最高为20分，直至分数耗尽）。</li>
            </ul>

            <h3>5. 宝箱机制</h3>
            <ul>
              <li><b>宝箱</b>
                <ul>
                  <li>仅在游戏中期和后期刷新，每局游戏最多出现两个。</li>
                  <li>其分数在刷新时根据战局动态计算并固定，旨在为落后玩家提供追赶机会。计算公式为 <code>基础分 + (第一名分数 - 非第一名平均分) * 0.6</code>，最终分数被限制在30到75之间。
                  </li>
                  <li>对于未持有钥匙的蛇，宝箱是一个<b>致命障碍物</b>，触碰即死且护盾无效。</li>
                </ul>
              </li>
              <li><b>钥匙</b>
                <ul>
                  <li>与宝箱同步刷新，数量为 <code>max(2, floor(存活蛇数 / 2))</code>，上限为4把。</li>
                  <li>蛇头触碰地上的钥匙即可拾取。</li>
                  <li><b>掉落规则</b>：
                    <ul>
                      <li>持有者死亡时，钥匙会掉落在其头部位置。</li>
                      <li>连续持有钥匙超过30个游戏刻，钥匙会自动从持有者身上脱落，出现在其头部侧方。</li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li><b>交互规则</b>：蛇头必须在<b>持有钥匙</b>的状态下触碰宝箱，才能成功开启并获得其全部分数。宝箱一旦被开启，场上所有其他的钥匙都会立即消失。</li>
            </ul>

            <h3>6. 安全区机制</h3>
            <p>安全区是游戏中的核心活动区域，所有玩家都应尽量使其头部保持在安全区内。</p>
            <ul>
              <li>蛇的<b>头部</b>一旦处于安全区之外，将<b>立即死亡</b>。蛇的身体部分可以暂时处于区外。</li>
              <li>开启护盾可以暂时免疫安全区外的伤害，但护盾结束后若头部仍在区外则依旧会立即死亡。</li>
              <li>所有新生成的食物都只会在当前安全区内出现。当安全区收缩时，位于新安全区外的存量食物会立即消失。</li>
              <li>安全区会随游戏阶段向地图中心收缩，具体如下：</li>
            </ul>
            <table class="rules-table">
              <thead>
                <tr>
                  <th>游戏阶段</th>
                  <th>游戏刻范围</th>
                  <th>收缩事件</th>
                  <th>最终尺寸</th>
                  <th>最终边界 <code>(x_min,y_min) -> (x_max,y_max)</code></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>早期</td>
                  <td>1 - 80</td>
                  <td>稳定</td>
                  <td>40 × 30</td>
                  <td><code>(0,0) -> (39,29)</code></td>
                </tr>
                <tr>
                  <td rowspan="2">中期</td>
                  <td>81 - 100</td>
                  <td>第一次收缩</td>
                  <td>34 × 26</td>
                  <td><code>(3,2) -> (36,27)</code></td>
                </tr>
                <tr>
                  <td>161 - 180</td>
                  <td>第二次收缩</td>
                  <td>26 × 20</td>
                  <td><code>(7,5) -> (32,24)</code></td>
                </tr>
                <tr>
                  <td rowspan="2">后期</td>
                  <td>221 - 240</td>
                  <td>最终收缩</td>
                  <td rowspan="2">20 × 16</td>
                  <td rowspan="2"><code>(10,7) -> (29,22)</code></td>
                </tr>
                <tr>
                  <td>241 - 256</td>
                  <td>最终形态</td>
                </tr>
              </tbody>
            </table>

            <h3>7. 游戏阶段</h3>
            <p>游戏全程共256个游戏刻，分为三个阶段，不同阶段的场上资源分布有所侧重：</p>
            <ul>
              <li><b>早期阶段</b> (1 - 80 游戏刻)
                <ul>
                  <li>该阶段侧重于初始发育，主要生成低分食物和增长豆。</li>
                  <li>食物权重：普通食物(1-3分) 80%，增长豆 20%。</li>
                </ul>
              </li>
              <li><b>中期阶段</b> (81 - 200 游戏刻)
                <ul>
                  <li>引入高分食物、陷阱，并会刷新第一个<b>宝箱</b>，竞争开始加剧。</li>
                  <li>食物权重：普通食物(1-5分) 78%，增长豆 12%，陷阱 10%。</li>
                </ul>
              </li>
              <li><b>后期阶段</b> (201 - 256 游戏刻)
                <ul>
                  <li>高风险高回报，战局瞬息万变。可能刷新第二个<b>宝箱</b>。</li>
                  <li>食物权重：普通食物(1-5分) 80%，增长豆 5%，陷阱 15%。</li>
                </ul>
              </li>
            </ul>

            <h2>五、游戏结束条件</h2>
            <ul>
              <li>达到256个游戏刻上限。</li>
              <li>场上已无任何蛇存活。</li>
            </ul>
          </div>

          <div v-if="activeTab === 'algorithm'" class="algorithm-section">
            <h2>一、通信协议</h2>
            <p>算法程序在每个游戏刻运行一次，通过标准输入（stdin）读取每 tick 的游戏状态，并通过标准输出（stdout）提交决策。</p>

            <h2>二、输入格式</h2>
            <p>在每个游戏刻开始时，游戏状态信息会以纯文本形式发送到算法程序的标准输入。所有坐标信息均遵循<code>y x</code>的顺序。</p>
            <pre class="code-block">
剩余游戏刻
物品总数
y1 x1 v1 t1
...
蛇总数
id1 len1 score1 dir1 shield_cd1 shield_time1
y1_1 x1_1
...
id2 len2 score2 dir2 shield_cd2 shield_time2
...
宝箱总数
y_chest1 x_chest1 score1
...
钥匙总数
y_key1 x_key1 holder_id1 remaining_time1
...
当前安全区_xmin 当前安全区_ymin 当前安全区_xmax 当前安全区_ymax
下次收缩时刻 下次安全区_xmin 下次安全区_ymin 下次安全区_xmax 下次安全区_ymax
最终收缩时刻 最终安全区_xmin 最终安全区_ymin 最终安全区_xmax 最终安全区_ymax

[可选] 上一回合存储在Memory系统中的数据
</pre>

            <h3>1. 物品信息</h3>
            <p>首先是场上物品总数，随后每一行代表一个物品，格式为 <code>y x v t</code>。</p>
            <ul>
              <li>物品值 <code>v</code> 的含义：
                <ul>
                  <li><code>1</code> 至 <code>5</code>：普通食物，提供对应分数。</li>
                  <li><code>-1</code>：增长豆。</li>
                  <li><code>-2</code>：陷阱。</li>
                  <li><code>-3</code>：钥匙（在地上，可拾取）。</li>
                  <!-- <li><code>-4</code>：障碍物。</li> -->
                  <li><code>-5</code>：宝箱（未持有钥匙时视为障碍物）。</li>
                </ul>
              </li>
            </ul>
            <p>最后一个数字 t 表示物品剩余的存活时间（tick）。如果物品永远不会消失，t 为 -1。</p>

            <h3>2. 玩家信息</h3>
            <p>在物品信息之后，是存活的蛇总数，随后是每一条蛇的具体信息。</p>
            <ul>
              <li>第一行是蛇的综合属性：
                <ul>
                  <li><code>id</code>：玩家ID。</li>
                  <li><code>len</code>：蛇的当前长度。</li>
                  <li><code>score</code>：当前分数。</li>
                  <li><code>dir</code>：当前移动方向 (<code>0</code>-左, <code>1</code>-上, <code>2</code>-右, <code>3</code>-下)。
                  </li>
                  <li><code>shield_cd</code>：护盾冷却时间 (0表示可用)。</li>
                  <li><code>shield_time</code>：护盾剩余有效时间。</li>
                  <li><code>has_key</code>：是否持有钥匙 (<code>1</code>-是, <code>0</code>-否)。</li>
                </ul>
              </li>
              <li>后续 <code>len</code> 行是蛇每一节身体的坐标，从蛇头到蛇尾。</li>
            </ul>

            <h3>3. 宝箱与钥匙附加信息</h3>
            <ul>
              <li>首先是一个数字，代表未开启的宝箱数量（目前只可能是0或1）</li>
              <li>然后是宝箱信息：格式为 <code>y x score</code>，表示宝箱的坐标和开启后可获得的分数。</li>

              <li>然后是一个数字，代表场上所有钥匙的总数（包括地上的和蛇持有的）</li>
              <li>最后是每个钥匙的信息：格式为 <code>y x holder_id remaining_time</code>。
                <ul>
                  <li><code>holder_id</code>：如果为<code>-1</code>，表示钥匙在地上；否则为持有该钥匙的玩家ID。</li>
                  <li><code>remaining_time</code>：若钥匙被持有，此为自动掉落的剩余时间；若在地上，此值为0。</li>
                </ul>
              </li>
            </ul>

            <h3>4. 安全区信息</h3>
            <p>输入信息的最后是三行关于安全区的数据</p>
            <ul>
              <li><strong>第一行：</strong><code>xmin ymin xmax ymax</code>，描述当前安全区的边界。</li>
              <li>
                <strong>第二行：</strong><code>next_tick next_xmin next_ymin next_xmax next_ymax</code>。这里的<code>next_tick</code>表示“下一次边界实际发生变化”的刻（即下一次从当前边界向内收缩的首个刻），并给出该刻对应的目标边界；若未来没有变化，<code>next_tick</code>为<code>-1</code>，边界重复当前值。
              </li>
              <li>
                <strong>第三行：</strong><code>final_tick final_xmin final_ymin final_xmax final_ymax</code>。表示“当前/下一次收缩阶段的完成刻”和到达时的最终边界；若安全区不再收缩，<code>final_tick</code>为<code>-1</code>。
              </li>
            </ul>

            <h2>三、输出格式</h2>
            <p>您的算法程序需要向标准输出（stdout）打印一个整数作为本回合的决策。</p>
            <ul>
              <li><code>0</code>：向左移动</li>
              <li><code>1</code>：向上移动</li>
              <li><code>2</code>：向右移动</li>
              <li><code>3</code>：向下移动</li>
              <li><code>4</code>：激活护盾 (在原地停留一回合)</li>
            </ul>

            <h2>四、持久化存储 (Memory 系统)</h2>
            <p>为了支持需要跨回合记忆状态的复杂算法，平台提供了一个持久化存储（Memory）系统。每个算法实例在单局游戏中都拥有一块独立的、可读写的数据空间。</p>

            <h3>1. 数据写入</h3>
            <p>在您的程序输出决策（0-4的整数）并换行后，可以继续输出任意格式的字符串。这部分字符串将被系统捕获并存入您的专属 Memory
              空间。<strong>请注意：每次写入都会完全覆盖上一次存储的内容。</strong></p>
            <p>例如，输出以下内容：</p>
            <pre class="code-block">2
TARGET:10,20;STATE:ATTACK;PREV_SCORE:150</pre>
            <p>
              系统会将决策<code>2</code>（向右）提交给游戏引擎，并将第二行的字符串<code>TARGET:10,20;STATE:ATTACK;PREV_SCORE:150</code>存入您的Memory中。
            </p>
            <p>请注意，这里只是一个示例，实际可以存储任意文本格式的内容。最大限制为 4KB。</p>

            <h3>2. 数据读取</h3>
            <p>在下一个游戏刻，您上一回合存储的内容将会被原样附加到标准输入的末尾，位于所有常规游戏状态信息（安全区信息等）之后。</p>
            <p>在游戏的第一个游戏刻，由于没有前一回合的存储，Memory 部分将为空（即输入在安全区信息后直接结束）。</p>


            <h2>五、限制与错误处理</h2>
            <h3>1. 资源限制</h3>
            <ul>
              <li>中央处理器时间限制：1秒</li>
              <li>内存限制：1GB</li>
              <li>墙上时钟限制：5秒</li>
            </ul>

            <h3>2. 决策失败</h3>
            <p>如果算法程序出现以下情况，您的蛇将被判定为决策失败并立即死亡：</p>
            <ul>
              <li>程序崩溃或异常退出。</li>
              <li>超出时间或内存限制。</li>
              <li>输出了无效的决策值。</li>
              <li>决策直接导致撞上地图边界或其他致命障碍物。</li>
            </ul>

            <h2>六、运行环境与编译</h2>
            <h3>1. 运行环境</h3>
            <p>
              您的代码将在 <strong>x86-64</strong> 架构的 Linux 服务器上编译和运行。
              我们使用的编译器版本为 <strong>g++ 14.2.0</strong>。
            </p>

            <h3>2. 编译命令</h3>
            <p>平台将使用以下命令来编译您的 <code>.cpp</code> 文件。请确保您的代码能够在此环境与编译选项下正常工作。</p>
            <pre class="code-block">g++ -std=c++23 -O2 -Wall your_file.cpp -o program</pre>
          </div>


          <div v-if="activeTab === 'template'" class="template-section">
            <div class="template-header">
              <h2>C++算法模板</h2>
              <button @click="downloadTemplate" class="pixel-button download-button">
                下载模板
              </button>
            </div>

            <pre class="code-block">{{ templateCode }}</pre>

            <div class="template-notes">
              <h3>使用说明</h3>
              <ol>
                <li>将上面的代码保存为 .cpp 文件</li>
                <li>修改 <code>MY_STUDENT_ID</code> 常量为你的学号</li>
                <li>实现你的算法逻辑，编译并测试，然后提交到平台参与对战</li>
              </ol>

              <h3>编译命令</h3>
              <pre class="code-block">g++ -std=c++23 -O2 -Wall your_file.cpp -o program</pre>
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
  margin: 0 0 15px 0;
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

/* 规则表格样式 */
.rules-table {
  width: 100%;
  border-collapse: collapse;
  margin: 25px 0;
  border: 2px solid var(--border-color);
  font-size: 14px;
  text-align: left;
  image-rendering: pixelated;
  /* 保持像素感 */
}

.rules-table thead {
  background-color: rgba(74, 222, 128, 0.1);
  /* 使用主题色作为背景 */
}

.rules-table th,
.rules-table td {
  padding: 12px 15px;
  border: 1px solid var(--border-color);
}

.rules-table th {
  font-size: 14px;
  color: var(--accent-color);
  font-weight: normal;
  /* 像素字体通常不需要加粗 */
  text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
}

.rules-table tbody tr {
  background-color: transparent;
  transition: background-color 0.2s;
}

.rules-table tbody tr:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.rules-table td code {
  background-color: rgba(0, 0, 0, 0.5);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
