import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { Snake } from "../entities/Snake";
import { Position } from "../types/Position";
import { GameConfig, Direction } from "../config/GameConfig";
import { eventBus, GameEventType } from "../core/EventBus";
import { IEntityQuery } from "../interfaces/EntityQuery";
import { SafeZoneManager } from "./SafeZoneManager";
import { createSnakePlaceholder } from "../utils/snakeDisplayUtils";

/** 距离度量模式 */
enum DistanceMode {
  MANHATTAN = "MANHATTAN",
  SHORTEST_PATH = "SHORTEST_PATH",
}

export interface TreasureSystemConfig {
  enabled: boolean;
  firstTreasureWindow: { start: number; end: number; expectedTick: number };
  secondTreasureWindow: { start: number; end: number; expectedTick: number };
  baseScore: number;
  scoreMultiplier: number;
  minScore: number;
  maxScore: number;
  keyHoldTimeLimit: number;
  minTreasureDistanceFromEdge: number;
  minDistanceFromSnakeHead: number;
  keyDistanceRing: { min: number; max: number };
  minKeySpacing: number;
  maxFairnessGap: number;
  minKeysPerTreasure: number;
  maxKeysPerTreasure: number;
  keysPerSnakeDivisor: number;
  maxPositionAttempts: number;
  maxFairnessAttempts: number;

  /** 距离模式（公平与打分），默认使用曼哈顿；若 entityQuery 支持最短路会自动启用 */
  distanceModeFairness?: DistanceMode;
  distanceModeScoring?: DistanceMode;

  /** 宝箱打分权重：w1-最小到各蛇距离、w2-反领先、w3-居中偏置 */
  scoringWeights?: { w1: number; w2: number; w3: number };
  /** 打分时保留前K名候选再随机挑1个，避免过于僵化 */
  topKChestCandidates?: number;

  /** 第二窗口替换的可达性判定参数 */
  replacementTimeHorizon?: number; // 未来若干tick视窗（仅用于启发）
  replacementPathTicksLimit?: number; // 认为“可达”的最大路径时间（格数）

  /** 死亡掉落搜索半径（找最近可放格） */
  maxDropSearchRadius?: number;

  /** 是否启用相对公平阈值（默认false，保持旧语义） */
  useRelativeFairnessGap?: boolean;
  /** 相对阈值系数（宽+高-2 的比例），仅当 useRelativeFairnessGap=true 生效 */
  fairnessGapRatio?: number;
}

interface PseudoRandomState {
  isInWindow: boolean;
  windowStart: number;
  windowEnd: number;
  expectedTick: number;
  treasureIndex: number;
}

export class TreasureSystem {
  private config: TreasureSystemConfig;
  private entityQuery: IEntityQuery;
  private safeZoneManager: SafeZoneManager;
  private currentTreasure: TreasureChest | null = null;
  private treasureSpawnCount: number = 0;
  private pseudoRandomState: PseudoRandomState | null = null;
  private keysFrozenThisTick = false;

  constructor(
    entityQuery: IEntityQuery,
    safeZoneManager: SafeZoneManager,
    config?: Partial<TreasureSystemConfig>
  ) {
    this.entityQuery = entityQuery;
    this.safeZoneManager = safeZoneManager;
    this.config = {
      enabled: config?.enabled ?? GameConfig.TREASURE_SYSTEM.ENABLED,
      firstTreasureWindow: config?.firstTreasureWindow ?? {
        start: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK - 10,
        end: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK + 30,
        expectedTick: GameConfig.TREASURE_SYSTEM.FIRST_TREASURE_TICK,
      },
      secondTreasureWindow: config?.secondTreasureWindow ?? {
        start: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK - 15,
        end: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK + 35,
        expectedTick: GameConfig.TREASURE_SYSTEM.SECOND_TREASURE_TICK,
      },
      baseScore: config?.baseScore ?? GameConfig.TREASURE_SYSTEM.BASE_SCORE,
      scoreMultiplier:
        config?.scoreMultiplier ?? GameConfig.TREASURE_SYSTEM.SCORE_MULTIPLIER,
      minScore: config?.minScore ?? GameConfig.TREASURE_SYSTEM.MIN_SCORE,
      maxScore: config?.maxScore ?? GameConfig.TREASURE_SYSTEM.MAX_SCORE,
      keyHoldTimeLimit:
        config?.keyHoldTimeLimit ??
        GameConfig.TREASURE_SYSTEM.KEY_HOLD_TIME_LIMIT,
      minTreasureDistanceFromEdge: config?.minTreasureDistanceFromEdge ?? 5,
      minDistanceFromSnakeHead:
        config?.minDistanceFromSnakeHead ??
        GameConfig.TREASURE_SYSTEM.MIN_DISTANCE_FROM_SNAKE_HEAD,
      keyDistanceRing: config?.keyDistanceRing ?? { min: 12, max: 25 },
      minKeySpacing: config?.minKeySpacing ?? 6,
      maxFairnessGap: config?.maxFairnessGap ?? 8,
      minKeysPerTreasure:
        config?.minKeysPerTreasure ??
        GameConfig.TREASURE_SYSTEM.MIN_KEYS_PER_TREASURE,
      maxKeysPerTreasure:
        config?.maxKeysPerTreasure ??
        GameConfig.TREASURE_SYSTEM.MAX_KEYS_PER_TREASURE,
      keysPerSnakeDivisor:
        config?.keysPerSnakeDivisor ??
        GameConfig.TREASURE_SYSTEM.KEYS_PER_SNAKE_DIVISOR,
      maxPositionAttempts: config?.maxPositionAttempts ?? 100,
      maxFairnessAttempts: config?.maxFairnessAttempts ?? 10,

      distanceModeFairness:
        config?.distanceModeFairness ?? DistanceMode.MANHATTAN,
      distanceModeScoring:
        config?.distanceModeScoring ?? DistanceMode.MANHATTAN,
      scoringWeights: config?.scoringWeights ?? { w1: 1.0, w2: 0.15, w3: 0.05 },
      topKChestCandidates: config?.topKChestCandidates ?? 5,
      replacementTimeHorizon: config?.replacementTimeHorizon ?? 10,
      replacementPathTicksLimit: config?.replacementPathTicksLimit ?? 12,
      maxDropSearchRadius: config?.maxDropSearchRadius ?? 3,
      useRelativeFairnessGap: config?.useRelativeFairnessGap ?? false,
      fairnessGapRatio: config?.fairnessGapRatio ?? 0.2,
    };
  }

  update(currentTick: number): void {
    if (!this.config.enabled) return;
    this.keysFrozenThisTick = false;

    this.updatePseudoRandomState(currentTick);
    if (this.shouldSpawnTreasure(currentTick)) {
      console.log("Try to spawn treasure at tick", currentTick);
      this.spawnTreasureAndKeys(currentTick);
    }

    this.updateKeyHoldTimes();
  }

  get currentKeys(): Key[] {
    return this.entityQuery.getAllKeys();
  }

  private updatePseudoRandomState(currentTick: number): void {
    if (this.pseudoRandomState) return;

    if (
      this.treasureSpawnCount === 0 &&
      currentTick >= this.config.firstTreasureWindow.start &&
      currentTick <= this.config.firstTreasureWindow.end
    ) {
      this.pseudoRandomState = {
        isInWindow: true,
        windowStart: this.config.firstTreasureWindow.start,
        windowEnd: this.config.firstTreasureWindow.end,
        expectedTick: this.config.firstTreasureWindow.expectedTick,
        treasureIndex: 0,
      };
    } else if (
      this.treasureSpawnCount === 1 &&
      currentTick >= this.config.secondTreasureWindow.start &&
      currentTick <= this.config.secondTreasureWindow.end
    ) {
      this.pseudoRandomState = {
        isInWindow: true,
        windowStart: this.config.secondTreasureWindow.start,
        windowEnd: this.config.secondTreasureWindow.end,
        expectedTick: this.config.secondTreasureWindow.expectedTick,
        treasureIndex: 1,
      };
    }
  }

  private shouldSpawnTreasure(currentTick: number): boolean {
    if (!this.pseudoRandomState?.isInWindow) return false;

    if (currentTick > this.pseudoRandomState.windowEnd) {
      this.pseudoRandomState = null;
      return false;
    }

    const windowCenter = this.pseudoRandomState.expectedTick;
    const windowHalfSize =
      (this.pseudoRandomState.windowEnd - this.pseudoRandomState.windowStart) /
      2;
    const normalizedPosition = (currentTick - windowCenter) / windowHalfSize;

    const gaussianValue = Math.exp(-Math.pow(normalizedPosition, 2) * 3);
    const spawnProbability = 0.02 + 0.13 * gaussianValue;

    const shouldSpawn = Math.random() < spawnProbability;

    if (shouldSpawn) {
      this.pseudoRandomState = null;
      return true;
    }
    return false;
  }

  private spawnTreasureAndKeys(currentTick: number): void {
    const liveSnakes = this.entityQuery
      .getAllSnakes()
      .filter((snake) => snake.isAlive());
    if (liveSnakes.length === 0) return;

    // ===== 第二窗口：有效不可达时的替换逻辑升级 =====
    if (
      this.treasureSpawnCount === 1 &&
      this.currentTreasure &&
      !this.currentTreasure.isOpened()
    ) {
      const isSecondWindow =
        currentTick >= this.config.secondTreasureWindow.start &&
        currentTick <= this.config.secondTreasureWindow.end;

      if (isSecondWindow && this.shouldReplaceForSecondWindow(liveSnakes)) {
        const keyCount = this.calculateKeyCount(liveSnakes.length);
        const replacement = this.tryGenerateTreasureAndKeys(
          liveSnakes,
          keyCount
        );
        if (!replacement) return;
        const { position, score, keys } = replacement;
        const newTreasure = new TreasureChest(
          position,
          GameConfig.CANVAS.BOX_SIZE,
          score
        );
        const oldTreasure = this.currentTreasure;
        this.keysFrozenThisTick = true;
        this.clearAllKeys();

        this.currentTreasure = newTreasure;
        this.treasureSpawnCount++;

        eventBus.emit(GameEventType.TREASURE_REPLACED, {
          oldTreasure,
          oldKeys: [],
          treasure: newTreasure,
          keys,
        });
        return;
      } else {
        return; // 不满足替换条件则不做任何事（继续等待）
      }
    }

    // ===== 正常刷宝箱路径 =====
    const treasureScore = this.calculateTreasureScore(liveSnakes);
    const treasurePosition = this.findTreasurePositionScored(liveSnakes);
    if (!treasurePosition) {
      console.warn("Failed to find position for treasure.");
      return;
    }
    console.log(
      "Spawning treasure at",
      treasurePosition,
      "with score",
      treasureScore
    );

    this.currentTreasure = new TreasureChest(
      treasurePosition,
      GameConfig.CANVAS.BOX_SIZE,
      treasureScore
    );
    this.treasureSpawnCount++;

    const keyCount = this.calculateKeyCount(liveSnakes.length);
    const keys = this.spawnKeys(keyCount, treasurePosition, liveSnakes);

    eventBus.emit(GameEventType.TREASURE_SPAWNED, {
      treasure: this.currentTreasure,
      keys: keys,
    });

    eventBus.emit(
      GameEventType.UI_NOTIFICATION,
      `💎 Treasure spawned! Worth ${treasureScore} points.`
    );
  }

  private shouldReplaceForSecondWindow(liveSnakes: Snake[]): boolean {
    if (!this.currentKeys || this.currentKeys.length === 0) return false;

    const allEffectivelyDead = this.currentKeys.every((key) => {
      const pos = key.getPosition();
      const safeNow = this.safeZoneManager.isPositionSafe(pos);
      if (!safeNow) return true;

      // 只要存在一条蛇可在限定步数内抵达，就不算“死局”
      return !this.hasAnySnakeSafePathWithin(
        pos,
        liveSnakes,
        this.config.replacementPathTicksLimit!
      );
    });

    return allEffectivelyDead;
  }

  private tryGenerateTreasureAndKeys(
    liveSnakes: Snake[],
    keyCount: number
  ): { position: Position; score: number; keys: Key[] } | null {
    const treasureScore = this.calculateTreasureScore(liveSnakes);
    const treasurePosition = this.findTreasurePositionScored(liveSnakes);
    if (!treasurePosition) return null;

    const keyPositions = this.generateKeyPositions(
      keyCount,
      treasurePosition,
      liveSnakes
    );
    if (keyPositions.length < keyCount) return null;

    const keys = keyPositions.map(
      (pos) => new Key(pos, GameConfig.CANVAS.BOX_SIZE)
    );
    return { position: treasurePosition, score: treasureScore, keys };
  }

  private calculateTreasureScore(liveSnakes: Snake[]): number {
    if (liveSnakes.length === 0) return this.config.minScore;

    const sortedSnakes = [...liveSnakes].sort(
      (a, b) => b.getScore() - a.getScore()
    );
    const firstPlaceScore = sortedSnakes[0].getScore();

    const nonFirstPlaceSnakes = sortedSnakes.slice(1);
    const averageNonFirstScore =
      nonFirstPlaceSnakes.length > 0
        ? nonFirstPlaceSnakes.reduce((sum, s) => sum + s.getScore(), 0) /
          nonFirstPlaceSnakes.length
        : firstPlaceScore;

    const calculatedScore =
      this.config.baseScore +
      (firstPlaceScore - averageNonFirstScore) * this.config.scoreMultiplier;

    return Math.max(
      this.config.minScore,
      Math.min(this.config.maxScore, Math.floor(calculatedScore))
    );
  }

  private calculateKeyCount(aliveSnakeCount: number): number {
    const calculatedCount = Math.floor(
      aliveSnakeCount / this.config.keysPerSnakeDivisor
    );
    return Math.max(
      this.config.minKeysPerTreasure,
      Math.min(this.config.maxKeysPerTreasure, calculatedCount)
    );
  }

  private findTreasurePositionScored(liveSnakes: Snake[]): Position | null {
    const safeZone = this.safeZoneManager.getCurrentBounds();
    const box = GameConfig.CANVAS.BOX_SIZE;

    // 计算领先者
    const leader =
      liveSnakes.length > 0
        ? [...liveSnakes].sort((a, b) => b.getScore() - a.getScore())[0]
        : null;

    // 安全区几何中心（格坐标）
    const centerX = Math.floor((safeZone.xMin + safeZone.xMax) / 2);
    const centerY = Math.floor((safeZone.yMin + safeZone.yMax) / 2);

    const w = this.config.scoringWeights!;
    const topK = this.config.topKChestCandidates!;
    const mode = this.autoDistanceMode(this.config.distanceModeScoring!);

    type Candidate = { pos: Position; score: number };
    const cands: Candidate[] = [];

    for (let x = safeZone.xMin; x <= safeZone.xMax; x++) {
      for (let y = safeZone.yMin; y <= safeZone.yMax; y++) {
        const distEdge = Math.min(
          x - safeZone.xMin,
          safeZone.xMax - x,
          y - safeZone.yMin,
          safeZone.yMax - y
        );
        if (distEdge < this.config.minTreasureDistanceFromEdge) {
          console.log("Skip position near edge:", x, y, "distEdge:", distEdge);
          continue;
        }

        const pos: Position = { x: x * box, y: y * box };
        if (
          liveSnakes.every(
            (s) =>
              this.gridManhattan(s.getBody()[0], pos) >=
              this.config.minDistanceFromSnakeHead
          ) &&
          !this.isPositionOccupied(pos)
        ) {
          // 评分项：
          const headCells = liveSnakes.map((s) => this.toCell(s.getBody()[0]));
          const toHeads = headCells.map((cell) =>
            this.getDistanceCells({ x, y }, cell, mode)
          );
          const minAll = toHeads.length > 0 ? Math.min(...toHeads) : 0;
          const dLeader =
            leader != null
              ? this.getDistanceCells(
                  { x, y },
                  this.toCell(leader.getBody()[0]),
                  mode
                )
              : 0;
          const dCenter = Math.abs(x - centerX) + Math.abs(y - centerY);

          const score = w.w1 * minAll - w.w2 * dLeader - w.w3 * dCenter;
          cands.push({ pos, score });
        } else {
          console.log("Skip occupied or too close to snake:", x, y);
        }
      }
    }

    if (cands.length === 0) return null;

    console.log("Treasure candidates found:", cands);

    // 取分最高的前 K 个候选中随机
    cands.sort((a, b) => b.score - a.score);
    const take = Math.min(topK, cands.length);
    const picked = cands[Math.floor(Math.random() * take)];
    return picked.pos;
  }

  private spawnKeys(
    keyCount: number,
    treasurePosition: Position,
    liveSnakes: Snake[]
  ): Key[] {
    const keyPositions = this.generateKeyPositions(
      keyCount,
      treasurePosition,
      liveSnakes
    );
    return keyPositions.map((pos) => new Key(pos, GameConfig.CANVAS.BOX_SIZE));
  }

  private generateKeyPositions(
    keyCount: number,
    treasurePosition: Position,
    liveSnakes: Snake[]
  ): Position[] {
    for (
      let attempt = 0;
      attempt < this.config.maxFairnessAttempts;
      attempt++
    ) {
      const positions = this.selectKeyPositions(
        keyCount,
        treasurePosition,
        liveSnakes
      );
      if (this.isFairByMatching(positions, liveSnakes)) {
        return positions;
      }
    }
    return this.selectKeyPositions(keyCount, treasurePosition, liveSnakes);
  }

  private selectKeyPositions(
    keyCount: number,
    treasurePosition: Position,
    liveSnakes: Snake[]
  ): Position[] {
    const candidates = this.getValidKeyCandidates(treasurePosition, liveSnakes);
    const shuffled = this.shuffleArray(candidates);
    const selected: Position[] = [];

    for (const c of shuffled) {
      if (
        selected.every(
          (p) => this.gridManhattan(c, p) >= this.config.minKeySpacing
        )
      ) {
        selected.push(c);
        if (selected.length >= keyCount) break;
      }
    }
    return selected;
  }

  private getValidKeyCandidates(
    treasurePosition: Position,
    liveSnakes: Snake[]
  ): Position[] {
    const safeZone = this.safeZoneManager.getCurrentBounds();
    const box = GameConfig.CANVAS.BOX_SIZE;
    const out: Position[] = [];

    for (let x = safeZone.xMin; x <= safeZone.xMax; x++) {
      for (let y = safeZone.yMin; y <= safeZone.yMax; y++) {
        const pos = { x: x * box, y: y * box };
        if (this.isValidKeyPosition(pos, treasurePosition, liveSnakes)) {
          out.push(pos);
        }
      }
    }
    return out;
  }

  private isValidKeyPosition(
    pos: Position,
    treasurePos: Position,
    snakes: Snake[]
  ): boolean {
    // 钥匙环半径用网格曼哈顿衡量即可（生成约束）
    const tDist = this.gridManhattan(pos, treasurePos);
    if (
      tDist < this.config.keyDistanceRing.min ||
      tDist > this.config.keyDistanceRing.max
    ) {
      return false;
    }

    return (
      snakes.every((s) => this.gridManhattan(pos, s.getBody()[0]) >= 5) &&
      !this.isPositionOccupied(pos) // 包含 treasure/key
    );
  }

  /** 使用匹配来评估“每条蛇都有不同钥匙可抢且距离差不过分大” */
  private isFairByMatching(
    keyPositions: Position[],
    liveSnakes: Snake[]
  ): boolean {
    if (liveSnakes.length === 0 || keyPositions.length === 0) return true;

    const mode = this.autoDistanceMode(this.config.distanceModeFairness!);
    const snakeHeads = liveSnakes.map((s) => this.toCell(s.getBody()[0]));
    const keys = keyPositions.map((p) => this.toCell(p));

    // 构建距离矩阵（格数）
    const dist: number[][] = snakeHeads.map((sh) =>
      keys.map((kp) => this.getDistanceCells(sh, kp, mode))
    );

    // 钥匙数可能少于蛇数，要求至少能匹配 min(#keys, #snakes) 对
    const need = Math.min(keys.length, snakeHeads.length);
    if (need === 0) return true;

    // 二分最小最大距离 D*，并取一组可行匹配
    const uniqueD = Array.from(
      new Set(dist.flat().filter((d) => Number.isFinite(d)))
    ).sort((a, b) => a - b);
    if (uniqueD.length === 0) return false;

    let lo = 0,
      hi = uniqueD.length - 1;
    let bestD = uniqueD[hi];
    let bestMatch: number[] | null = null;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const D = uniqueD[mid];
      const match = this.maximumMatchingWithin(dist, D); // 返回 keysIndex -> snakeIndex 的匹配（或反之）
      if (match.matchedCount >= need) {
        bestD = D;
        bestMatch = match.snakeOfKey;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    if (!bestMatch) return false;

    // 计算匹配到的蛇的距离分布，约束极差
    const assignedDistances: number[] = [];
    for (let k = 0; k < keys.length; k++) {
      const sIdx = bestMatch[k];
      if (sIdx !== -1) {
        assignedDistances.push(dist[sIdx][k]);
      }
    }
    if (assignedDistances.length < need) return false;

    const maxD = Math.max(...assignedDistances);
    const minD = Math.min(...assignedDistances);
    const gap = maxD - minD;

    const threshold = this.getFairnessGapThreshold();
    return gap <= threshold;
  }

  /** Kuhn 匹配：限制边为 dist<=D 的情况下最大匹配；返回 keys -> snake 的匹配 */
  private maximumMatchingWithin(
    dist: number[][],
    D: number
  ): { snakeOfKey: number[]; matchedCount: number } {
    const nSnakes = dist.length;
    const nKeys = dist[0]?.length ?? 0;
    const snakeOfKey = Array(nKeys).fill(-1); // key -> snake
    let matched = 0;

    const tryKuhn = (s: number, vis: boolean[]): boolean => {
      for (let k = 0; k < nKeys; k++) {
        if (dist[s][k] <= D && !vis[k]) {
          vis[k] = true;
          if (snakeOfKey[k] === -1 || tryKuhn(snakeOfKey[k], vis)) {
            snakeOfKey[k] = s;
            return true;
          }
        }
      }
      return false;
    };

    for (let s = 0; s < nSnakes; s++) {
      const vis = Array(nKeys).fill(false);
      if (tryKuhn(s, vis)) matched++;
    }
    return { snakeOfKey, matchedCount: matched };
  }

  private hasAnySnakeSafePathWithin(
    targetPos: Position,
    snakes: Snake[],
    ticksLimit: number
  ): boolean {
    const mode = this.autoDistanceMode(this.config.distanceModeFairness!);
    const tCell = this.toCell(targetPos);
    return snakes.some((s) => {
      const d = this.getDistanceCells(this.toCell(s.getBody()[0]), tCell, mode);
      return Number.isFinite(d) && d <= ticksLimit;
    });
  }

  handleSnakeDeath(snake: Snake): void {
    if (!snake.hasKey()) return;
    const droppedKeyId = snake.dropKey();
    if (!droppedKeyId) return;
    if (
      this.keysFrozenThisTick ||
      !this.currentTreasure ||
      this.currentTreasure.isOpened()
    ) {
      return;
    }
    const headPos = snake.getBody()[0];
    const dropPos =
      this.findAdjacentDropPosition(snake) ??
      this.findNearestFreeDropPosition(
        headPos,
        this.config.maxDropSearchRadius!
      );
    const finalPos = dropPos ?? headPos; // 实在找不到就原地
    const droppedKey = new Key(
      finalPos,
      GameConfig.CANVAS.BOX_SIZE,
      droppedKeyId
    );
    eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
  }

  private findNearestFreeDropPosition(
    origin: Position,
    radius: number
  ): Position | null {
    const box = GameConfig.CANVAS.BOX_SIZE;
    const originCell = this.toCell(origin);
    const inBounds = (x: number, y: number) =>
      x >= 0 &&
      x < GameConfig.CANVAS.COLUMNS &&
      y >= 0 &&
      y < GameConfig.CANVAS.ROWS;

    // 简单 BFS（4邻域），限制半径
    const q: { x: number; y: number }[] = [];
    const vis = new Set<string>();
    q.push(originCell);
    vis.add(`${originCell.x},${originCell.y}`);

    let steps = 0;
    while (q.length > 0 && steps <= radius) {
      const size = q.length;
      for (let i = 0; i < size; i++) {
        const cur = q.shift()!;
        const pos: Position = { x: cur.x * box, y: cur.y * box };
        if (
          this.safeZoneManager.isPositionSafe(pos) &&
          !this.isPositionOccupied(pos)
        ) {
          if (!(cur.x === originCell.x && cur.y === originCell.y)) {
            return pos;
          }
        }
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [dx, dy] of dirs) {
          const nx = cur.x + dx,
            ny = cur.y + dy;
          if (!inBounds(nx, ny)) continue;
          const key = `${nx},${ny}`;
          if (!vis.has(key)) {
            vis.add(key);
            q.push({ x: nx, y: ny });
          }
        }
      }
      steps++;
    }
    return null;
  }

  private updateKeyHoldTimes(): void {
    const liveSnakes = this.entityQuery
      .getAllSnakes()
      .filter((snake) => snake.isAlive());

    for (const snake of liveSnakes) {
      if (snake.hasKey()) {
        snake.incrementKeyHoldTime();

        if (snake.getKeyHoldTime() >= this.config.keyHoldTimeLimit) {
          this.handleKeyTimeout(snake);
        }
      }
    }
  }

  private handleKeyTimeout(snake: Snake): void {
    const droppedKeyId = snake.dropKey();
    if (!droppedKeyId) return;
    if (
      this.keysFrozenThisTick ||
      !this.currentTreasure ||
      this.currentTreasure.isOpened()
    ) {
      return;
    }

    const dropPosition =
      this.findAdjacentDropPosition(snake) ??
      this.findNearestFreeDropPosition(
        snake.getBody()[0],
        this.config.maxDropSearchRadius!
      );
    if (dropPosition) {
      const droppedKey = new Key(
        dropPosition,
        GameConfig.CANVAS.BOX_SIZE,
        droppedKeyId
      );
      eventBus.emit(GameEventType.KEY_DROPPED, { key: droppedKey, snake });
    }
  }

  private findAdjacentDropPosition(snake: Snake): Position | null {
    const headPos = snake.getBody()[0];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const direction = snake.getDirection();

    const adjacentOffsets = this.getAdjacentOffsets(direction);

    for (const offset of adjacentOffsets) {
      const dropPos = {
        x: headPos.x + offset.x * boxSize,
        y: headPos.y + offset.y * boxSize,
      };

      if (
        dropPos.x >= 0 &&
        dropPos.x < GameConfig.CANVAS.COLUMNS * boxSize &&
        dropPos.y >= 0 &&
        dropPos.y < GameConfig.CANVAS.ROWS * boxSize &&
        this.safeZoneManager.isPositionSafe(dropPos) &&
        !this.isPositionOccupied(dropPos)
      ) {
        return dropPos;
      }
    }
    return null;
  }

  private getAdjacentOffsets(direction: Direction): Position[] {
    switch (direction) {
      case Direction.UP:
      case Direction.DOWN:
        return [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ];
      case Direction.LEFT:
      case Direction.RIGHT:
        return [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
        ];
      default:
        return [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ];
    }
  }

  handleTreasureOpening(snake: Snake, treasure: TreasureChest): boolean {
    if (
      !snake.hasKey() ||
      treasure.isOpened() ||
      treasure !== this.currentTreasure
    ) {
      return false;
    }

    this.keysFrozenThisTick = true;

    treasure.open();
    snake.addScore(treasure.getScore());
    snake.dropKey();

    this.clearAllKeys();

    eventBus.emit(GameEventType.TREASURE_OPENED, {
      snake,
      treasure,
      score: treasure.getScore(),
    });

    const snakePlaceholder = createSnakePlaceholder(snake);
    eventBus.emit(
      GameEventType.UI_NOTIFICATION,
      `🏆 ${snakePlaceholder} opened the treasure! +${treasure.getScore()} points`
    );

    return true;
  }

  handleKeyPickup(snake: Snake, key: Key): boolean {
    if (snake.hasKey()) {
      return false;
    }

    try {
      snake.holdKey(key.getId());
      eventBus.emit(GameEventType.KEY_PICKED_UP, { snake, key });
      return true;
    } catch (error) {
      console.error("[TreasureSystem] Error picking up key:", error);
      return false;
    }
  }

  private clearAllKeys(): void {
    const allSnakes = this.entityQuery.getAllSnakes();
    allSnakes.forEach((snake) => {
      if (snake.hasKey()) {
        snake.dropKey();
      }
    });

    const groundKeys = this.entityQuery.getAllKeys();
    for (const k of groundKeys) {
      eventBus.emit(GameEventType.KEY_REMOVED, { key: k });
    }
  }

  private isPositionOccupied(position: Position): boolean {
    return this.entityQuery.isPositionOccupied(position, [
      "obstacle",
      "snake",
      "food",
      "treasure",
      "key",
    ]);
  }

  private toCell(p: Position): { x: number; y: number } {
    const box = GameConfig.CANVAS.BOX_SIZE;
    return { x: Math.floor(p.x / box), y: Math.floor(p.y / box) };
  }

  private gridManhattan(a: Position, b: Position): number {
    const box = GameConfig.CANVAS.BOX_SIZE;
    return Math.abs(a.x - b.x) / box + Math.abs(a.y - b.y) / box;
  }

  private autoDistanceMode(pref: DistanceMode): DistanceMode {
    // 若 entityQuery 提供最短路能力则启用，否则回退
    const anyEQ: any = this.entityQuery;
    if (
      pref === DistanceMode.SHORTEST_PATH &&
      typeof anyEQ?.getShortestPathDistance === "function"
    ) {
      return DistanceMode.SHORTEST_PATH;
    }
    return DistanceMode.MANHATTAN;
  }

  private getDistanceCells(
    fromCell: { x: number; y: number },
    toCell: { x: number; y: number },
    mode: DistanceMode
  ): number {
    if (mode === DistanceMode.MANHATTAN) {
      return Math.abs(fromCell.x - toCell.x) + Math.abs(fromCell.y - toCell.y);
    }
    // SHORTEST_PATH：委托给 entityQuery（若未实现，会在 autoDistanceMode 中被回退）
    const anyEQ: any = this.entityQuery;
    try {
      const bounds = this.safeZoneManager.getCurrentBounds();
      const d = anyEQ.getShortestPathDistance?.(fromCell, toCell, bounds);
      if (typeof d === "number" && Number.isFinite(d)) return d;
    } catch (e) {
      // 回退
    }
    return Math.abs(fromCell.x - toCell.x) + Math.abs(fromCell.y - toCell.y);
  }

  /** 公平阈值：默认用常量；若开启 useRelativeFairnessGap，则按安全区尺寸缩放 */
  private getFairnessGapThreshold(): number {
    if (!this.config.useRelativeFairnessGap) return this.config.maxFairnessGap;
    const b = this.safeZoneManager.getCurrentBounds();
    const w = b.xMax - b.xMin + 1;
    const h = b.yMax - b.yMin + 1;
    return Math.ceil((w + h - 2) * (this.config.fairnessGapRatio ?? 0.2));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  getCurrentTreasure(): TreasureChest | null {
    return this.currentTreasure;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): TreasureSystemConfig {
    return { ...this.config };
  }

  reset(): void {
    this.currentTreasure = null;
    this.treasureSpawnCount = 0;
    this.pseudoRandomState = null;
    this.keysFrozenThisTick = false;
  }

  dispose(): void {
    this.reset();
  }
}
