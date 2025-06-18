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
    const radius = size / 3;
    
    // 脉动效果
    const pulseScale = 1 + Math.sin(this.frameCount * 0.1) * 0.1;
    const adjustedRadius = radius * pulseScale;
    
    // 像素风格的星形
    ctx.fillStyle = color;
    
    // 绘制八个方向的像素点
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = centerX + Math.cos(angle) * adjustedRadius;
      const py = centerY + Math.sin(angle) * adjustedRadius;
      
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    
    // 中心点
    ctx.fillRect(centerX - 3, centerY - 3, 6, 6);
    
    // 添加"G"表示Growth
    ctx.fillStyle = "white";
    ctx.fillRect(centerX - 1, centerY - 2, 2, 1);
    ctx.fillRect(centerX - 1, centerY - 1, 1, 3);
    ctx.fillRect(centerX, centerY + 1, 1, 1);
  }
  
  private renderTrapFood(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    color: string
  ): void {
    // 像素风格的陷阱
    ctx.fillStyle = color;
    
    // 绘制三角形轮廓
    const pad = 3;
    
    // 基础三角形
    const path = new Path2D();
    path.moveTo(x + size / 2, y + pad);
    path.lineTo(x + size - pad, y + size - pad);
    path.lineTo(x + pad, y + size - pad);
    path.closePath();
    
    ctx.fill(path);
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1;
    ctx.stroke(path);
    
    // 像素风格的危险符号
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(x + size / 2 - 1, y + size / 2 - 3, 2, 4);
    ctx.fillRect(x + size / 2 - 1, y + size / 2 + 2, 2, 2);
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
}
