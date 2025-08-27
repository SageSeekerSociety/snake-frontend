import { Food } from "../../entities/Food";
import { EntityRenderer } from "./EntityRenderer";
import { FoodType } from "../../config/GameConfig";

export class FoodRenderer implements EntityRenderer<Food> {
  private normalFoodImages: Record<string, HTMLImageElement | null> = {};
  private growthFoodImage: HTMLImageElement | null = null;
  private trapFoodImage: HTMLImageElement | null = null;
  private sparkleFrames: HTMLImageElement[] = [];
  private frameCount: number = 0;

  constructor() {
    // 初始化像素风格图像
    this.initializeImages();
  }

  private initializeImages(): void {
    // 在实际项目中，这些图像应该被预加载
    // 这里使用简单的绘制代替
  }

  render(ctx: CanvasRenderingContext2D, food: Food): void {
    const position = food.getPosition();
    const size = food.getSize();
    const type = food.getType();
    const value = food.getValue();
    
    // 帧计数器，用于动画效果
    this.frameCount = (this.frameCount + 1) % 60;
    
    switch(type) {
      case FoodType.NORMAL:
        this.renderNormalFood(ctx, position.x, position.y, size, food.getColor(), value);
        break;
      case FoodType.GROWTH:
        this.renderGrowthFood(ctx, position.x, position.y, size, food.getColor());
        break;
      case FoodType.TRAP:
        this.renderTrapFood(ctx, position.x, position.y, size, food.getColor());
        break;
      default:
        this.renderNormalFood(ctx, position.x, position.y, size, food.getColor(), value);
    }
    
    // 如果食物是活跃的（不是死亡掉落的），添加闪烁效果
    if (food.isActive() && this.frameCount % 20 < 10) {
      this.renderSparkle(ctx, position.x, position.y, size);
    }
  }
  
  private renderNormalFood(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    color: string,
    value: number | string
  ): void {
    // 像素风格的食物
    ctx.fillStyle = color;
    
    // 绘制像素风格的圆形
    const pad = 2; // 像素间隙
    const innerSize = size - pad * 2;
    
    // 主体
    ctx.fillRect(x + pad, y + pad, innerSize, innerSize);
    
    // 高光点
    ctx.fillStyle = this.lightenColor(color, 30);
    ctx.fillRect(x + pad + 2, y + pad + 2, 2, 2);
    
    // 添加显示分数的像素数字
    ctx.fillStyle = "white";
    this.drawPixelNumber(ctx, x + size / 2, y + size / 2, String(value));
    
    // 边框
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad, y + pad, innerSize, innerSize);
  }
  
  private renderGrowthFood(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    color: string
  ): void {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    // 学习钥匙的简洁动画风格 - 只要一个缓慢的脉动
    const gentlePulse = 1 + Math.sin(this.frameCount * 0.05) * 0.06; // 类似钥匙的旋转频率
    const glowAlpha = 0.4 + Math.sin(this.frameCount * 0.08) * 0.2; // 温和的发光变化
    
    // 胶囊主体尺寸 (去掉Math.floor，让动画更平滑)
    const capsuleWidth = (size - 4) * gentlePulse;
    const capsuleHeight = (size - 6) * gentlePulse;
    const cornerRadius = Math.min(capsuleHeight / 2, 4);
    
    // 绘制胶囊形状背景 (深绿色基底)
    ctx.fillStyle = "#003322";
    this.drawRoundedRect(ctx, 
      centerX - capsuleWidth / 2, 
      centerY - capsuleHeight / 2, 
      capsuleWidth, 
      capsuleHeight, 
      cornerRadius
    );
    
    // 主胶囊体 (柔和绿色渐变效果)
    const gradient = ctx.createLinearGradient(
      centerX - capsuleWidth / 2, centerY - capsuleHeight / 2,
      centerX + capsuleWidth / 2, centerY + capsuleHeight / 2
    );
    gradient.addColorStop(0, "#00cc77");
    gradient.addColorStop(0.5, "#00aa55");
    gradient.addColorStop(1, "#008844");
    
    ctx.fillStyle = gradient;
    const innerWidth = capsuleWidth - 2;
    const innerHeight = capsuleHeight - 2;
    this.drawRoundedRect(ctx, 
      centerX - innerWidth / 2, 
      centerY - innerHeight / 2, 
      innerWidth, 
      innerHeight, 
      cornerRadius - 1
    );
    
    // 简单的高光效果，不再变化
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    const highlightWidth = innerWidth - 4;
    const highlightHeight = 2;
    this.drawRoundedRect(ctx,
      centerX - highlightWidth / 2,
      centerY - innerHeight / 2 + 2,
      highlightWidth,
      highlightHeight,
      1
    );
    
    // 绘制围绕的能量粒子轨道 (非常缓慢的旋转)
    // this.drawEnergyOrbit(ctx, centerX, centerY, size / 2 + 3, this.frameCount * 0.1);
    
    // 固定的"+"符号，不再闪烁
    ctx.fillStyle = "#ffffff";
    const crossSize = 4;
    const crossThickness = 1;
    
    // 水平线
    ctx.fillRect(
      centerX - crossSize / 2, 
      centerY - crossThickness / 2, 
      crossSize, 
      crossThickness
    );
    // 垂直线
    ctx.fillRect(
      centerX - crossThickness / 2, 
      centerY - crossSize / 2, 
      crossThickness, 
      crossSize
    );
    
    // 学习钥匙的发光点效果 - 简单的角落闪烁
    ctx.fillStyle = `rgba(0, 255, 136, ${glowAlpha})`;
    
    // 四个角落的简单发光点，按顺序闪烁
    const sparkleOffsets = [
      { x: -size/2 + 2, y: -size/2 + 2 }, 
      { x: size/2 - 2, y: -size/2 + 2 },
      { x: size/2 - 2, y: size/2 - 2 }, 
      { x: -size/2 + 2, y: size/2 - 2 }
    ];
    
    sparkleOffsets.forEach((offset, index) => {
      if (this.frameCount % 40 === index * 10) { // 更慢的闪烁节奏
        ctx.fillRect(centerX + offset.x, centerY + offset.y, 2, 2);
      }
    });
  }
  
  private renderTrapFood(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    color: string
  ): void {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const pad = 2;
    const innerSize = size - pad * 2;
    
    // 脉动效果让陷阱更危险
    const pulseScale = 1 + Math.sin(this.frameCount * 0.15) * 0.08;
    const effectiveSize = innerSize * pulseScale;
    const offset = (innerSize - effectiveSize) / 2;
    
    // 基础暗色背景
    ctx.fillStyle = "#2a1a1a";
    ctx.fillRect(x + pad + offset, y + pad + offset, effectiveSize, effectiveSize);
    
    // 现代像素风格的危险图案 - 骷髅头
    ctx.fillStyle = "#ff4444";
    const skullX = centerX - 4;
    const skullY = centerY - 4;
    
    // 骷髅头轮廓 (8x8 像素)
    const skullPattern = [
      "  ████  ",
      " ██████ ",
      "████████",
      "██ ██ ██",
      "████████",
      "██ ██ ██",
      " █ ██ █ ",
      "  ████  "
    ];
    
    skullPattern.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel === "█") {
          ctx.fillRect(skullX + colIndex, skullY + rowIndex, 1, 1);
        }
      });
    });
    
    // 添加红色发光边框
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad + offset, y + pad + offset, effectiveSize, effectiveSize);
    
    // 外层警告边框
    ctx.strokeStyle = "#ffaa00";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(x, y, size, size);
    ctx.setLineDash([]);
    
    // 危险警告点在四个角落
    if (this.frameCount % 30 < 15) {
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + size - 3, y + 1, 2, 2);
      ctx.fillRect(x + 1, y + size - 3, 2, 2);
      ctx.fillRect(x + size - 3, y + size - 3, 2, 2);
    }
  }
  
  private renderSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // 像素风格的闪光效果
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    // 绘制小型闪光点
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    
    // 随机偏移
    const offsetX = Math.sin(this.frameCount * 0.2) * size / 4;
    const offsetY = Math.cos(this.frameCount * 0.2) * size / 4;
    
    ctx.fillRect(centerX + offsetX - 1, centerY + offsetY - 1, 2, 2);
  }
  
  private drawPixelNumber(ctx: CanvasRenderingContext2D, x: number, y: number, number: string): void {
    // 简单的像素数字实现
    const digits = String(number).split('');
    const digitWidth = 3;
    const digitHeight = 5;
    const spacing = 1;
    
    let totalWidth = digits.length * (digitWidth + spacing) - spacing;
    let startX = x - totalWidth / 2;
    
    digits.forEach((digit, index) => {
      const dx = startX + index * (digitWidth + spacing);
      this.drawDigit(ctx, dx, y - digitHeight / 2, digit);
    });
  }
  
  private drawDigit(ctx: CanvasRenderingContext2D, x: number, y: number, digit: string): void {
    // 简化的像素数字表示
    switch(digit) {
      case '1':
        ctx.fillRect(x + 1, y, 1, 5);
        break;
      case '2':
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x + 2, y + 1, 1, 1);
        ctx.fillRect(x, y + 2, 3, 1);
        ctx.fillRect(x, y + 3, 1, 1);
        ctx.fillRect(x, y + 4, 3, 1);
        break;
      case '3':
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x + 2, y + 1, 1, 1);
        ctx.fillRect(x, y + 2, 3, 1);
        ctx.fillRect(x + 2, y + 3, 1, 1);
        ctx.fillRect(x, y + 4, 3, 1);
        break;
      case '5':
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillRect(x, y + 2, 3, 1);
        ctx.fillRect(x + 2, y + 3, 1, 1);
        ctx.fillRect(x, y + 4, 3, 1);
        break;
      case '0':
      default:
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x, y + 1, 1, 3);
        ctx.fillRect(x + 2, y + 1, 1, 3);
        ctx.fillRect(x, y + 4, 3, 1);
        break;
    }
  }
  
  private lightenColor(color: string, amount: number): string {
    // 简单处理几种常见颜色
    if (color === "red") return "#ff6666";
    if (color === "green") return "#66ff66";
    if (color === "blue") return "#6666ff";
    if (color === "purple") return "#cc66cc";
    if (color === "yellow") return "#ffff66";
    if (color === "black") return "#666666";
    
    return color;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    radius: number
  ): void {
    // 像素风格的圆角矩形实现
    if (radius <= 0) {
      ctx.fillRect(x, y, width, height);
      return;
    }
    
    // 限制圆角半径
    radius = Math.min(radius, Math.min(width, height) / 2);
    
    // 使用像素化的圆角效果
    // 主体矩形
    ctx.fillRect(x + radius, y, width - 2 * radius, height);
    ctx.fillRect(x, y + radius, width, height - 2 * radius);
    
    // 四个角落的圆角效果 (简化为45度切角)
    if (radius >= 2) {
      // 左上角
      ctx.fillRect(x + 1, y + 1, radius - 1, radius - 1);
      // 右上角  
      ctx.fillRect(x + width - radius, y + 1, radius - 1, radius - 1);
      // 左下角
      ctx.fillRect(x + 1, y + height - radius, radius - 1, radius - 1);
      // 右下角
      ctx.fillRect(x + width - radius, y + height - radius, radius - 1, radius - 1);
    }
  }

  private drawEnergyOrbit(
    ctx: CanvasRenderingContext2D, 
    centerX: number, 
    centerY: number, 
    radius: number, 
    angle: number
  ): void {
    // 绘制3个围绕的能量粒子
    const particleCount = 3;
    const particleSize = 2;
    
    for (let i = 0; i < particleCount; i++) {
      const particleAngle = angle + (i * Math.PI * 2 / particleCount);
      const px = centerX + Math.cos(particleAngle) * radius;
      const py = centerY + Math.sin(particleAngle) * radius;
      
      // 粒子柔和发光效果 (非常缓慢的闪烁)
      const alpha = 0.5 + Math.sin(angle * 0.5 + i) * 0.1;
      ctx.fillStyle = `rgba(0, 204, 119, ${alpha})`;
      ctx.fillRect(px - particleSize / 2, py - particleSize / 2, particleSize, particleSize);
      
      // 粒子核心
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
    }
  }
}
