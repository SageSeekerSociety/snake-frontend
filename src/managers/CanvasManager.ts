import { GameConfig } from "../config/GameConfig";
import { Entity, isFood, isSnake, isTreasureChest, isKey } from "../core/Entity";
import { SnakeRenderer } from "../core/renderers/SnakeRenderer";
import { FoodRenderer } from "../core/renderers/FoodRenderer";
import { ObstacleRenderer } from "../core/renderers/ObstacleRenderer";
import { VortexFieldRenderer } from "../core/renderers/VortexFieldRenderer";
import { TreasureChestRenderer } from "../core/renderers/TreasureChestRenderer";
import { KeyRenderer } from "../core/renderers/KeyRenderer";
import { SafeZoneRenderer } from "../core/renderers/SafeZoneRenderer";
import { SafeZoneStatus } from "./SafeZoneManager";
import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { EntityType } from "../types/EntityType";
// VortexFieldRenderer has its own render state interface

export class CanvasManager {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private obstacleCanvas: HTMLCanvasElement;
  private obstacleCtx: CanvasRenderingContext2D;
  private backgroundCanvas: HTMLCanvasElement;
  private backgroundCtx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private snakeRenderer: SnakeRenderer;
  private foodRenderer: FoodRenderer;
  private obstacleRenderer: ObstacleRenderer;
  private vortexFieldRenderer: VortexFieldRenderer;
  private treasureChestRenderer: TreasureChestRenderer;
  private keyRenderer: KeyRenderer;
  private safeZoneRenderer: SafeZoneRenderer;
  
  private frameCount: number = 0;
  private backgroundPattern: CanvasPattern | null = null;
  private lastRenderTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.mainCanvas = canvas;
    this.mainCtx = canvas.getContext("2d", {
      alpha: false,
    }) as CanvasRenderingContext2D;

    this.obstacleCanvas = document.createElement("canvas");
    this.obstacleCtx = this.obstacleCanvas.getContext("2d", {
      alpha: true,
    }) as CanvasRenderingContext2D;
    
    this.backgroundCanvas = document.createElement("canvas");
    this.backgroundCtx = this.backgroundCanvas.getContext("2d", {
      alpha: false,
    }) as CanvasRenderingContext2D;

    this.width = GameConfig.CANVAS.COLUMNS * GameConfig.CANVAS.BOX_SIZE;
    this.height = GameConfig.CANVAS.ROWS * GameConfig.CANVAS.BOX_SIZE;

    // 初始化渲染器
    this.snakeRenderer = new SnakeRenderer();
    this.foodRenderer = new FoodRenderer();
    this.obstacleRenderer = new ObstacleRenderer();
    this.vortexFieldRenderer = new VortexFieldRenderer();
    this.treasureChestRenderer = new TreasureChestRenderer();
    this.keyRenderer = new KeyRenderer();
    this.safeZoneRenderer = new SafeZoneRenderer(canvas);

    this.setupCanvas();
    this.createBackgroundPattern();
  }

  private setupCanvas(): void {
    // 设置画布尺寸，使用物理像素大小
    this.mainCanvas.width = this.width;
    this.mainCanvas.height = this.height;
    this.obstacleCanvas.width = this.width;
    this.obstacleCanvas.height = this.height;
    this.backgroundCanvas.width = this.width;
    this.backgroundCanvas.height = this.height;
    
    // 禁用图像平滑，以便像素风格更清晰
    this.mainCtx.imageSmoothingEnabled = false;
    this.obstacleCtx.imageSmoothingEnabled = false;
    this.backgroundCtx.imageSmoothingEnabled = false;
  }
  
  private createBackgroundPattern(): void {
    // 创建像素风格的背景图案
    const patternCanvas = document.createElement("canvas");
    const patternCtx = patternCanvas.getContext("2d") as CanvasRenderingContext2D;
    const patternSize = 40; // 图案尺寸
    
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    
    // 填充深色背景
    patternCtx.fillStyle = "#1a1a2e";
    patternCtx.fillRect(0, 0, patternSize, patternSize);
    
    // 添加网格线
    patternCtx.strokeStyle = "#2a2a3e";
    patternCtx.lineWidth = 1;
    
    // 垂直线
    patternCtx.beginPath();
    for (let x = 0; x <= patternSize; x += GameConfig.CANVAS.BOX_SIZE) {
      patternCtx.moveTo(x, 0);
      patternCtx.lineTo(x, patternSize);
    }
    
    // 水平线
    for (let y = 0; y <= patternSize; y += GameConfig.CANVAS.BOX_SIZE) {
      patternCtx.moveTo(0, y);
      patternCtx.lineTo(patternSize, y);
    }
    patternCtx.stroke();
    
    // 随机添加一些像素点增加纹理
    patternCtx.fillStyle = "#3a3a4e";
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * patternSize);
      const y = Math.floor(Math.random() * patternSize);
      patternCtx.fillRect(x, y, 1, 1);
    }
    
    // 创建并存储图案
    this.backgroundPattern = this.backgroundCtx.createPattern(patternCanvas, "repeat");
    
    // 立即绘制背景
    this.renderBackground();
  }
  
  private renderBackground(): void {
    if (this.backgroundPattern) {
      this.backgroundCtx.fillStyle = this.backgroundPattern;
      this.backgroundCtx.fillRect(0, 0, this.width, this.height);
      
      // 添加边框
      this.backgroundCtx.strokeStyle = "#4a4a5e";
      this.backgroundCtx.lineWidth = 2;
      this.backgroundCtx.strokeRect(1, 1, this.width - 2, this.height - 2);
      
      // 添加像素风格的角落装饰
      this.backgroundCtx.fillStyle = "#4a4a5e";
      const cornerSize = 6;
      
      // 左上角
      this.backgroundCtx.fillRect(0, 0, cornerSize, cornerSize);
      // 右上角
      this.backgroundCtx.fillRect(this.width - cornerSize, 0, cornerSize, cornerSize);
      // 左下角
      this.backgroundCtx.fillRect(0, this.height - cornerSize, cornerSize, cornerSize);
      // 右下角
      this.backgroundCtx.fillRect(this.width - cornerSize, this.height - cornerSize, cornerSize, cornerSize);
    }
  }

  getMainCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  renderObstacles(obstacles: Obstacle[]): void {
    // 清除整个障碍物画布
    this.obstacleCtx.clearRect(0, 0, this.width, this.height);
    
    // 渲染障碍物
    for (const obstacle of obstacles) {
      this.obstacleRenderer.render(this.obstacleCtx, obstacle);
    }
  }

  clear(): void {
    // 不再使用纯黑色背景，而是绘制预渲染的像素风格背景
    this.mainCtx.clearRect(0, 0, this.width, this.height);
    this.mainCtx.drawImage(this.backgroundCanvas, 0, 0);
  }

  render(renderables: Entity[], vortexState?: any, timestamp: number = performance.now(), safeZoneStatus?: SafeZoneStatus): void {
    // 计算帧间隔时间，限制最大值避免大延迟后的动画跳跃
    const deltaTime = this.lastRenderTime 
      ? Math.min(timestamp - this.lastRenderTime, 100) 
      : 16.67;  // 默认为约60fps的间隔
    this.lastRenderTime = timestamp;
    
    this.frameCount = (this.frameCount + 1) % 60;
    
    this.clear();
    
    // 绘制障碍物
    this.mainCtx.drawImage(this.obstacleCanvas, 0, 0);

    const foodItems: Food[] = [];
    const snakes: Snake[] = [];
    const treasureChests: TreasureChest[] = [];
    const keys: Key[] = [];

    // 分类可渲染实体
    for (const renderable of renderables) {
      if (isFood(renderable)) {
        foodItems.push(renderable as Food);
      } else if (isSnake(renderable)) {
        snakes.push(renderable as Snake);
      } else if (isTreasureChest(renderable)) {
        treasureChests.push(renderable as TreasureChest);
      } else if (isKey(renderable)) {
        keys.push(renderable as Key);
      }
    }

    // 更新蛇的动画状态 - 即使在游戏暂停或结束状态也继续更新动画
    for (const snake of snakes) {
      // 仅为活着的蛇或刚死亡但动画尚未完成的蛇更新动画
      if (snake.isAlive() || snake.isInMotion()) {
        snake.updateAnimation(deltaTime);
      }
    }

    // Render safe zone first (as background overlay)
    if (safeZoneStatus) {
      this.safeZoneRenderer.render(safeZoneStatus);
      this.safeZoneRenderer.renderShrinkingAnimation(safeZoneStatus);
    }

    // Render in layering order: food -> keys -> treasure chests -> vortex field -> snakes
    this.renderFoodItems(foodItems);
    this.renderKeys(keys);
    this.renderTreasureChests(treasureChests);
    
    // Render vortex field (rendered before snakes to appear as background effect)
    if (vortexState) {
      this.vortexFieldRenderer.render(this.mainCtx, vortexState, timestamp);
    }
    
    this.renderSnakes(snakes);
  }

  private renderFoodItems(foodItems: Food[]): void {
    for (const food of foodItems) {
      this.foodRenderer.render(this.mainCtx, food);
    }
  }

  private renderSnakes(snakes: Snake[]): void {
    for (const snake of snakes) {
      // Render snakes that are alive OR in death animation
      if (snake.isAlive() || snake.isDyingAnimation()) {
        this.snakeRenderer.render(this.mainCtx, snake);
      }
    }
  }

  private renderTreasureChests(treasureChests: TreasureChest[]): void {
    for (const treasureChest of treasureChests) {
      this.treasureChestRenderer.render(this.mainCtx, treasureChest);
    }
  }

  private renderKeys(keys: Key[]): void {
    for (const key of keys) {
      this.keyRenderer.render(this.mainCtx, key);
    }
  }

  /**
   * Renders safe zone from serialized data (for replay system)
   */
  renderSafeZoneFromSerialized(bounds: any, isWarning: boolean, isShrinking: boolean): void {
    const safeZoneStatus: SafeZoneStatus = {
      enabled: true,
      currentBounds: bounds,
      isWarning,
      isShrinking
    };
    
    this.safeZoneRenderer.render(safeZoneStatus);
    if (isShrinking) {
      this.safeZoneRenderer.renderShrinkingAnimation(safeZoneStatus);
    }
  }

  drawStartScreen(): void {
    // 半透明遮罩
    this.mainCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
    this.mainCtx.fillRect(0, 0, this.width, this.height);
    
    // 像素风格的标题
    this.drawPixelText("SNAKE GAME", this.width / 2, this.height / 3, 24, "#4ade80");
    
    // 闪烁的开始提示
    if (this.frameCount % 40 < 20) {
      this.drawPixelText("CLICK TO START", this.width / 2, this.height / 2, 16, "#ffffff");
    }
    
    // 像素风格的蛇图标
    this.drawSnakeIcon(this.width / 2, this.height * 0.7);
  }

  drawGameOverScreen(): void {
    // 半透明黑色遮罩
    this.mainCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.mainCtx.fillRect(0, 0, this.width, this.height);
    
    // 像素风格的游戏结束文本
    this.drawPixelText("GAME OVER", this.width / 2, this.height / 3, 24, "#ff6b6b");
    
    // 闪烁的重新开始提示
    if (this.frameCount % 40 < 20) {
      this.drawPixelText("CLICK TO RESTART", this.width / 2, this.height / 2, 16, "#ffffff");
    }
  }
  
  private drawPixelText(text: string, x: number, y: number, fontSize: number, color: string): void {
    // 设置像素风格的字体
    this.mainCtx.font = `${fontSize}px 'Press Start 2P', monospace`;
    this.mainCtx.textAlign = "center";
    this.mainCtx.textBaseline = "middle";
    
    // 添加描边以增强像素风格
    this.mainCtx.strokeStyle = "black";
    this.mainCtx.lineWidth = 3;
    this.mainCtx.strokeText(text, x, y);
    
    // 填充文本
    this.mainCtx.fillStyle = color;
    this.mainCtx.fillText(text, x, y);
  }
  
  private drawSnakeIcon(x: number, y: number): void {
    const segmentSize = 10;
    const snakeLength = 5;
    
    // 绘制蛇身体
    this.mainCtx.fillStyle = "#4ade80";
    
    for (let i = 0; i < snakeLength; i++) {
      this.mainCtx.fillRect(
        x - (i * segmentSize) - segmentSize / 2, 
        y - segmentSize / 2, 
        segmentSize - 1, 
        segmentSize - 1
      );
    }
    
    // 绘制蛇头
    this.mainCtx.fillRect(
      x + segmentSize / 2, 
      y - segmentSize / 2, 
      segmentSize, 
      segmentSize
    );
    
    // 绘制眼睛
    this.mainCtx.fillStyle = "white";
    this.mainCtx.fillRect(
      x + segmentSize - 2, 
      y - segmentSize / 4, 
      2, 
      2
    );
  }
}
