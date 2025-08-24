import { Key } from "../../entities/Key";
import { EntityRenderer } from "./EntityRenderer";

export class KeyRenderer implements EntityRenderer<Key> {
  private frameCount: number = 0;

  render(ctx: CanvasRenderingContext2D, key: Key): void {
    const position = key.getPosition();
    const size = key.getSize();
    
    // 帧计数器，用于动画效果
    this.frameCount = (this.frameCount + 1) % 60;
    
    this.renderKey(ctx, position.x, position.y, size);
  }
  
  private renderKey(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number
  ): void {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    // 旋转动画效果
    const rotation = Math.sin(this.frameCount * 0.05) * 0.2;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    
    // 钥匙主体颜色 (金色)
    ctx.fillStyle = "#FFD700";
    
    // 钥匙柄 (圆形部分)
    const handleRadius = size / 4;
    const handleCenterX = -size / 4;
    const handleCenterY = 0;
    
    // 绘制圆形钥匙柄 (像素风格)
    this.drawPixelCircle(ctx, handleCenterX, handleCenterY, handleRadius);
    
    // 钥匙柄中心的孔
    ctx.fillStyle = "#000000";
    this.drawPixelCircle(ctx, handleCenterX, handleCenterY, 2);
    
    // 钥匙杆
    ctx.fillStyle = "#FFD700";
    const shaftWidth = 2;
    const shaftLength = size / 2;
    ctx.fillRect(-shaftWidth / 2, -shaftWidth / 2, shaftLength, shaftWidth);
    
    // 钥匙齿 (像素风格)
    ctx.fillStyle = "#FFD700";
    const toothX = shaftLength / 2;
    
    // 第一个齿
    ctx.fillRect(toothX - 2, shaftWidth / 2, 2, 3);
    // 第二个齿
    ctx.fillRect(toothX, shaftWidth / 2, 2, 2);
    
    // 钥匙高光
    ctx.fillStyle = "#FFFF99";
    ctx.fillRect(handleCenterX - 1, handleCenterY - 2, 2, 1);
    ctx.fillRect(-1, -1, shaftLength / 2, 1);
    
    // 钥匙阴影/边框
    ctx.strokeStyle = "#DAA520";
    ctx.lineWidth = 1;
    
    // 描边钥匙柄
    this.strokePixelCircle(ctx, handleCenterX, handleCenterY, handleRadius);
    
    // 描边钥匙杆
    ctx.strokeRect(-shaftWidth / 2, -shaftWidth / 2, shaftLength, shaftWidth);
    
    ctx.restore();
    
    // 发光效果
    const glowAlpha = 0.2 + Math.sin(this.frameCount * 0.1) * 0.1;
    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    
    // 在钥匙周围绘制发光像素点
    const sparkleOffsets = [
      { x: -3, y: -3 }, { x: 3, y: -3 }, 
      { x: -3, y: 3 }, { x: 3, y: 3 },
      { x: 0, y: -4 }, { x: 0, y: 4 },
      { x: -4, y: 0 }, { x: 4, y: 0 }
    ];
    
    sparkleOffsets.forEach((offset, index) => {
      if (this.frameCount % 15 === index * 2) {
        ctx.fillRect(centerX + offset.x, centerY + offset.y, 1, 1);
      }
    });
  }
  
  private drawPixelCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
    // 绘制像素风格的圆形
    const pixelSize = 1;
    
    for (let x = -radius; x <= radius; x += pixelSize) {
      for (let y = -radius; y <= radius; y += pixelSize) {
        const distance = Math.sqrt(x * x + y * y);
        if (distance <= radius && distance > radius - 2) {
          ctx.fillRect(centerX + x, centerY + y, pixelSize, pixelSize);
        }
      }
    }
    
    // 填充内部
    for (let x = -radius + 2; x <= radius - 2; x += pixelSize) {
      for (let y = -radius + 2; y <= radius - 2; y += pixelSize) {
        const distance = Math.sqrt(x * x + y * y);
        if (distance <= radius - 2) {
          ctx.fillRect(centerX + x, centerY + y, pixelSize, pixelSize);
        }
      }
    }
  }
  
  private strokePixelCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
    // 绘制像素风格圆形的描边
    const pixelSize = 1;
    
    for (let x = -radius; x <= radius; x += pixelSize) {
      for (let y = -radius; y <= radius; y += pixelSize) {
        const distance = Math.sqrt(x * x + y * y);
        if (distance <= radius && distance > radius - 1) {
          ctx.strokeRect(centerX + x, centerY + y, pixelSize, pixelSize);
        }
      }
    }
  }
}