import { TreasureChest } from "../../entities/TreasureChest";
import { EntityRenderer } from "./EntityRenderer";

export class TreasureChestRenderer implements EntityRenderer<TreasureChest> {
  private frameCount: number = 0;

  render(ctx: CanvasRenderingContext2D, treasureChest: TreasureChest): void {
    const position = treasureChest.getPosition();
    const size = treasureChest.getSize();
    
    // 帧计数器，用于动画效果
    this.frameCount = (this.frameCount + 1) % 60;
    
    if (treasureChest.isOpened()) {
      this.renderOpenedTreasureChest(ctx, position.x, position.y, size);
    } else {
      this.renderClosedTreasureChest(ctx, position.x, position.y, size, treasureChest.getScore());
    }
  }
  
  private renderClosedTreasureChest(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number,
    score: number
  ): void {
    const pad = 2;
    const chestWidth = size - pad * 2;
    const chestHeight = size - pad * 2;
    
    // 宝箱主体 (棕色)
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(x + pad, y + pad + 3, chestWidth, chestHeight - 3);
    
    // 宝箱盖子 (深棕色)
    ctx.fillStyle = "#654321";
    ctx.fillRect(x + pad, y + pad, chestWidth, 6);
    
    // 宝箱锁 (金色)
    ctx.fillStyle = "#FFD700";
    const lockSize = 4;
    const lockX = x + size / 2 - lockSize / 2;
    const lockY = y + pad + 2;
    ctx.fillRect(lockX, lockY, lockSize, lockSize);
    
    // 锁孔 (黑色像素点)
    ctx.fillStyle = "#000000";
    ctx.fillRect(lockX + 1, lockY + 1, 2, 1);
    ctx.fillRect(lockX + 1, lockY + 2, 1, 1);
    
    // 边角装饰 (金色)
    ctx.fillStyle = "#FFD700";
    // 左上角
    ctx.fillRect(x + pad, y + pad, 2, 2);
    // 右上角
    ctx.fillRect(x + pad + chestWidth - 2, y + pad, 2, 2);
    // 左下角
    ctx.fillRect(x + pad, y + pad + chestHeight - 2, 2, 2);
    // 右下角
    ctx.fillRect(x + pad + chestWidth - 2, y + pad + chestHeight - 2, 2, 2);
    
    // 宝箱边框
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad, y + pad, chestWidth, chestHeight);
    
    // 发光效果 (如果分数很高)
    if (score >= 50) {
      const glowAlpha = 0.3 + Math.sin(this.frameCount * 0.15) * 0.2;
      ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha})`;
      ctx.fillRect(x + pad - 1, y + pad - 1, chestWidth + 2, chestHeight + 2);
    }
    
    // 显示分数
    this.drawPixelNumber(ctx, x + size / 2, y + size - 4, String(score));
  }
  
  private renderOpenedTreasureChest(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number
  ): void {
    const pad = 2;
    const chestWidth = size - pad * 2;
    const chestHeight = size - pad * 2;
    
    // 宝箱主体 (棕色，稍暗)
    ctx.fillStyle = "#654321";
    ctx.fillRect(x + pad, y + pad + 6, chestWidth, chestHeight - 6);
    
    // 打开的盖子 (深棕色，向后倾斜效果)
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(x + pad + 2, y + pad, chestWidth - 4, 3);
    
    // 宝箱内部 (深色)
    ctx.fillStyle = "#2F1B14";
    ctx.fillRect(x + pad + 1, y + pad + 7, chestWidth - 2, chestHeight - 8);
    
    // 残留的金光效果
    const sparkleAlpha = 0.4 + Math.sin(this.frameCount * 0.2) * 0.3;
    ctx.fillStyle = `rgba(255, 215, 0, ${sparkleAlpha})`;
    
    // 几个闪光点
    ctx.fillRect(x + pad + 3, y + pad + 8, 2, 2);
    ctx.fillRect(x + pad + chestWidth - 5, y + pad + 10, 2, 2);
    ctx.fillRect(x + pad + chestWidth / 2, y + pad + 12, 2, 2);
    
    // 边框
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad, y + pad + 6, chestWidth, chestHeight - 6);
  }
  
  private drawPixelNumber(ctx: CanvasRenderingContext2D, x: number, y: number, number: string): void {
    ctx.fillStyle = "white";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(number, x, y);
    
    // 添加黑色描边提高可读性
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeText(number, x, y);
  }
}