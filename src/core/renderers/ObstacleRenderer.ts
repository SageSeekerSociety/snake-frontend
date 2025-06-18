import { Obstacle } from "../../entities/Obstacle";
import { EntityRenderer } from "./EntityRenderer";

export class ObstacleRenderer implements EntityRenderer<Obstacle> {
  private obstacleImage: HTMLImageElement | null = null;
  private texturePatterns: Record<string, CanvasPattern | null> = {};

  constructor() {
    // 初始化像素风格图像和纹理
    this.initializeTextures();
  }

  private initializeTextures(): void {
    // 实际项目中应预加载图像和创建纹理
    // 这里使用简单的渲染代替
  }

  render(ctx: CanvasRenderingContext2D, obstacle: Obstacle): void {
    const x = obstacle.getPosition().x;
    const y = obstacle.getPosition().y;
    const size = obstacle.getSize();

    // 绘制像素风格的障碍物
    this.renderPixelObstacle(ctx, x, y, size);
  }

  private renderPixelObstacle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // 基础砖块颜色
    ctx.fillStyle = "#555555";
    ctx.fillRect(x, y, size, size);

    // 计算砖块尺寸并确保它们适合障碍物大小
    const brickWidth = Math.floor(size / 2);
    const brickHeight = Math.floor(size / 4);
    const mortar = 1; // 砖块间隙宽度

    // 确定行偏移，使障碍物的模式保持一致
    // 使用障碍物位置来确定偏移以保持一致性
    const rowOffset = Math.floor(y / size) % 2;

    // 砖块图案
    for (let row = 0; row < 4; row++) {
      // 调整布局以使偶数行和奇数行交错
      const isOffsetRow = (row + rowOffset) % 2 === 1;
      const bricksInRow = isOffsetRow ? 1 : 2;
      const offsetX = isOffsetRow ? brickWidth / 2 : 0;

      for (let col = 0; col < bricksInRow; col++) {
        const brickX = x + offsetX + col * brickWidth;
        const brickY = y + row * brickHeight;

        // 确保砖块在障碍物范围内
        if (brickX < x + size && brickY < y + size) {
          // 砖块主体
          ctx.fillStyle = "#777777";
          ctx.fillRect(
            brickX + mortar,
            brickY + mortar,
            brickWidth - mortar * 2,
            brickHeight - mortar * 2
          );

          // 砖块高光
          ctx.fillStyle = "#999999";
          ctx.fillRect(
            brickX + mortar,
            brickY + mortar,
            brickWidth - mortar * 2,
            Math.max(1, Math.floor(brickHeight / 3))
          );

          // 砖块阴影
          ctx.fillStyle = "#666666";
          ctx.fillRect(
            brickX + mortar,
            brickY + brickHeight - mortar - Math.max(1, Math.floor(brickHeight / 3)),
            brickWidth - mortar * 2,
            Math.max(1, Math.floor(brickHeight / 3))
          );
        }
      }
    }

    // 像素风格边框
    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);

    // 随机添加一些裂缝或细节
    this.addRandomCracks(ctx, x, y, size);
  }

  private addRandomCracks(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // 使用障碍物的位置作为随机种子，保证相同位置的障碍物有相同的裂缝
    const seed = Math.floor(x * 1000 + y);
    const rng = this.seededRandom(seed);

    // 只有部分障碍物有裂缝
    if (rng() > 0.7) {
      const crackX = x + Math.floor(rng() * size);
      const crackY = y + Math.floor(rng() * size);
      const crackLength = 2 + Math.floor(rng() * 3);
      const angle = rng() * Math.PI * 2;

      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(crackX, crackY);
      ctx.lineTo(
        crackX + Math.floor(Math.cos(angle) * crackLength),
        crackY + Math.floor(Math.sin(angle) * crackLength)
      );
      ctx.stroke();
    }

    // 添加一些小石块或砂砾
    const debrisCount = Math.floor(rng() * 3);
    ctx.fillStyle = "#444444";

    for (let i = 0; i < debrisCount; i++) {
      const debrisX = x + Math.floor(rng() * size);
      const debrisY = y + Math.floor(rng() * size);
      const debrisSize = 1 + Math.floor(rng() * 2);

      ctx.fillRect(debrisX, debrisY, debrisSize, debrisSize);
    }
  }

  // 使用位置作为种子生成伪随机数
  private seededRandom(seed: number): () => number {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
}
