import { Snake } from "../../entities/Snake";
import { EntityRenderer } from "./EntityRenderer";
import { Direction } from "../../config/GameConfig";

export class SnakeRenderer implements EntityRenderer<Snake> {
  private readonly headImages: Record<Direction, HTMLImageElement | null> = {
    [Direction.UP]: null,
    [Direction.DOWN]: null,
    [Direction.LEFT]: null,
    [Direction.RIGHT]: null,
  };

  private bodyImage: HTMLImageElement | null = null;
  private tailImage: HTMLImageElement | null = null;
  private cornerImage: HTMLImageElement | null = null;
  private shieldImage: HTMLImageElement | null = null;

  constructor() {
    // 初始化像素风格图像
    this.initializeImages();
  }

  private initializeImages(): void {
    // 在实际项目中，应该预加载这些图像
    // 这里使用简单的代码演示
  }

  render(ctx: CanvasRenderingContext2D, snake: Snake): void {
    // Only skip rendering if snake is completely dead (not alive AND not in death animation)
    if (!snake.isAlive() && !snake.isDyingAnimation()) return;

    // 使用插值后的身体位置进行渲染，实现平滑动画效果
    const body = snake.getInterpolatedBody();
    const size = snake.getSize();
    
    // 死亡动画
    if (snake.isDyingAnimation()) {
      this.renderDeathAnimation(ctx, snake, body, size);
      return;
    }
    
    // 调整绘制顺序：先绘制蛇尾和身体，最后绘制蛇头，确保蛇头总是显示在最上层
    
    // 1. 先绘制蛇尾
    if (body.length > 1) {
      this.drawSnakeTail(ctx, body, body.length - 1, size, snake);
    }
    
    // 2. 再绘制蛇身体（从尾部开始向头部方向绘制）
    for (let i = body.length - 2; i > 0; i--) {
      this.drawSnakeBody(ctx, body, i, size, snake);
    }
    
    // 3. 最后绘制蛇头，确保它在最上层
    if (body.length > 0) {
      this.drawSnakeHead(ctx, body, 0, size, snake);
    }

    // 4. 如果盾牌激活，绘制盾牌效果，盾牌应当在蛇头之上
    if (snake.isShieldActive()) {
      this.drawShield(ctx, body[0], size);
    }

    // 5. 在蛇头位置绘制对局编号（小型像素风徽标），放在最上层
    this.drawHeadMatchNumber(ctx, body[0], size, snake);
  }

  private drawSnakeHead(
    ctx: CanvasRenderingContext2D, 
    body: { x: number; y: number }[], 
    index: number, 
    size: number, 
    snake: Snake
  ): void {
    if (index >= body.length) return;
    
    const head = body[index];
    const direction = snake.getDirection();
    
    // 获取蛇的动画状态
    const moveProgress = snake.getMoveProgress();
    const isMoving = snake.isInMotion();
    
    // 像素风格的蛇头
    ctx.fillStyle = snake.getColor();
    
    // 绘制头部主体
    // 如果正在移动，可以给头部添加一点变形效果，增强动态感
    if (isMoving) {
      // 根据移动方向和进度，计算头部的轻微变形
      const stretchFactor = 0.15 * Math.sin(moveProgress * Math.PI); // 在中间点变形最大
      
      let headWidth = size;
      let headHeight = size;
      let offsetX = 0;
      let offsetY = 0;
      
      // 根据方向应用变形
      if (direction === Direction.RIGHT) {
        headWidth = size * (1 + stretchFactor);
      } else if (direction === Direction.LEFT) {
        headWidth = size * (1 + stretchFactor);
        offsetX = -stretchFactor * size;
      } else if (direction === Direction.DOWN) {
        headHeight = size * (1 + stretchFactor);
      } else { // UP
        headHeight = size * (1 + stretchFactor);
        offsetY = -stretchFactor * size;
      }
      
      // 绘制变形的头部
      ctx.fillRect(head.x + offsetX, head.y + offsetY, headWidth, headHeight);
    } else {
      // 正常状态下的头部
      ctx.fillRect(head.x, head.y, size, size);
    }
    
    // 画眼睛
    ctx.fillStyle = "white";
    
    // 根据方向绘制眼睛
    const eyeSize = size / 5;
    const eyeOffset = size / 3;
    
    // 眼睛位置调整，根据移动进度微调眼睛位置
    let eyeAdjustX = 0;
    let eyeAdjustY = 0;
    
    if (isMoving) {
      // 计算眼睛的微小移动，增强生动感
      const eyeMoveRange = size / 20; // 眼睛移动的最大范围
      
      // 根据动画进度和方向计算眼睛偏移
      if (direction === Direction.RIGHT) {
        eyeAdjustX = Math.sin(moveProgress * Math.PI) * eyeMoveRange;
      } else if (direction === Direction.LEFT) {
        eyeAdjustX = -Math.sin(moveProgress * Math.PI) * eyeMoveRange;
      } else if (direction === Direction.DOWN) {
        eyeAdjustY = Math.sin(moveProgress * Math.PI) * eyeMoveRange;
      } else {
        eyeAdjustY = -Math.sin(moveProgress * Math.PI) * eyeMoveRange;
      }
    }
    
    if (direction === Direction.RIGHT) {
      ctx.fillRect(head.x + size - eyeOffset + eyeAdjustX, head.y + eyeOffset + eyeAdjustY, eyeSize, eyeSize);
      ctx.fillRect(head.x + size - eyeOffset + eyeAdjustX, head.y + size - eyeOffset - eyeSize + eyeAdjustY, eyeSize, eyeSize);
    } else if (direction === Direction.LEFT) {
      ctx.fillRect(head.x + eyeOffset - eyeSize + eyeAdjustX, head.y + eyeOffset + eyeAdjustY, eyeSize, eyeSize);
      ctx.fillRect(head.x + eyeOffset - eyeSize + eyeAdjustX, head.y + size - eyeOffset - eyeSize + eyeAdjustY, eyeSize, eyeSize);
    } else if (direction === Direction.UP) {
      ctx.fillRect(head.x + eyeOffset + eyeAdjustX, head.y + eyeOffset - eyeSize + eyeAdjustY, eyeSize, eyeSize);
      ctx.fillRect(head.x + size - eyeOffset - eyeSize + eyeAdjustX, head.y + eyeOffset - eyeSize + eyeAdjustY, eyeSize, eyeSize);
    } else {
      ctx.fillRect(head.x + eyeOffset + eyeAdjustX, head.y + size - eyeOffset + eyeAdjustY, eyeSize, eyeSize);
      ctx.fillRect(head.x + size - eyeOffset - eyeSize + eyeAdjustX, head.y + size - eyeOffset + eyeAdjustY, eyeSize, eyeSize);
    }

    // 像素风格的描边
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    this.drawPixelBorder(ctx, head.x, head.y, size);
  }

  // 在蛇头位置绘制对局编号（两位、前导零），保持像素风格且不突兀
  private drawHeadMatchNumber(
    ctx: CanvasRenderingContext2D,
    head: { x: number; y: number },
    size: number,
    snake: Snake
  ): void {
    try {
      const meta: any = snake.getMetadata?.() || {};
      const raw = typeof meta.matchNumber === 'number' && meta.matchNumber > 0
        ? meta.matchNumber
        : null;
      if (!raw) return;

      // 两位字符串
      const label = String(raw).padStart(2, '0');

      // 使用像素点阵 3x5 字体绘制，保持像素风且精确控制位置
      const DIGITS: Record<string, number[]> = {
        '0': [
          0b111,
          0b101,
          0b101,
          0b101,
          0b111,
        ],
        '1': [
          0b010,
          0b110,
          0b010,
          0b010,
          0b111,
        ],
        '2': [
          0b111,
          0b001,
          0b111,
          0b100,
          0b111,
        ],
        '3': [
          0b111,
          0b001,
          0b111,
          0b001,
          0b111,
        ],
        '4': [
          0b101,
          0b101,
          0b111,
          0b001,
          0b001,
        ],
        '5': [
          0b111,
          0b100,
          0b111,
          0b001,
          0b111,
        ],
        '6': [
          0b111,
          0b100,
          0b111,
          0b101,
          0b111,
        ],
        '7': [
          0b111,
          0b001,
          0b010,
          0b010,
          0b010,
        ],
        '8': [
          0b111,
          0b101,
          0b111,
          0b101,
          0b111,
        ],
        '9': [
          0b111,
          0b101,
          0b111,
          0b001,
          0b111,
        ],
      };

      // 基于格子大小计算像素缩放，确保两位数能放在头部右下角
      const scale = Math.max(1, Math.floor(size / 12));
      const digitW = 3 * scale;
      const digitH = 5 * scale;
      const gap = Math.max(1, Math.floor(scale));
      const margin = Math.max(1, Math.floor(size * 0.08));
      const totalW = digitW * 2 + gap;
      const totalH = digitH;

      // 位置：相对于蛇头朝向，始终放在“右下角”
      // 以“眼睛一侧”为上方向：
      // UP -> 屏幕 右下角；RIGHT -> 屏幕 左下角；DOWN -> 屏幕 左上角；LEFT -> 屏幕 右上角
      const dir = snake.getDirection();
      let baseX = head.x;
      let baseY = head.y;
      if (dir === Direction.UP) {
        baseX = head.x + size - totalW - margin;
        baseY = head.y + size - totalH - margin;
      } else if (dir === Direction.RIGHT) {
        baseX = head.x + margin;
        baseY = head.y + size - totalH - margin;
      } else if (dir === Direction.DOWN) {
        baseX = head.x + margin;
        baseY = head.y + margin;
      } else { // LEFT
        baseX = head.x + size - totalW - margin;
        baseY = head.y + margin;
      }

      // 防御性夹紧（理论上不需要，但以防万一）
      if (baseX < head.x + 1) baseX = head.x + 1;
      if (baseY < head.y + 1) baseY = head.y + 1;

      // 根据蛇身颜色选择高对比度前景色（黑/白）
      const fg = this.chooseContrastingColor(snake.getColor());

      // 绘制两位数字（不使用背景块，尽量低侵入）
      const drawDigit = (ch: string, x: number, y: number) => {
        const pattern = DIGITS[ch];
        if (!pattern) return;
        ctx.fillStyle = fg;
        for (let row = 0; row < 5; row++) {
          const bits = pattern[row];
          for (let col = 0; col < 3; col++) {
            if ((bits >> (2 - col)) & 1) {
              ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
            }
          }
        }
      };

      drawDigit(label[0], Math.round(baseX), Math.round(baseY));
      drawDigit(label[1], Math.round(baseX + digitW + gap), Math.round(baseY));
    } catch (_) {
      // 忽略渲染错误
    }
  }

  // 选择与底色对比度较高的颜色（黑/白）
  private chooseContrastingColor(hex: string): string {
    // 尝试解析 #RRGGBB 或 #RGB
    let r = 0, g = 0, b = 0;
    try {
      if (hex.startsWith('#')) {
        if (hex.length === 7) {
          r = parseInt(hex.slice(1, 3), 16);
          g = parseInt(hex.slice(3, 5), 16);
          b = parseInt(hex.slice(5, 7), 16);
        } else if (hex.length === 4) {
          r = parseInt(hex[1] + hex[1], 16);
          g = parseInt(hex[2] + hex[2], 16);
          b = parseInt(hex[3] + hex[3], 16);
        }
      }
    } catch {}
    // 相对亮度（简化）
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? '#111111' : '#FFFFFF';
  }

  private drawSnakeBody(
    ctx: CanvasRenderingContext2D, 
    body: { x: number; y: number }[], 
    index: number, 
    size: number, 
    snake: Snake
  ): void {
    // 确保有效索引
    if (index <= 0 || index >= body.length - 1) return;
    
    const segment = body[index];
    const prev = body[index - 1];
    const next = body[index + 1];
    
    // 获取蛇的动画状态
    const moveProgress = snake.getMoveProgress();
    const isMoving = snake.isInMotion();
    
    // 确定是否是拐角
    const isCorner = (prev.x !== next.x) && (prev.y !== next.y);
    
    // 绘制蛇身
    ctx.fillStyle = snake.getColor();
    
    // 主体部分的基础padding
    const basePadding = 1;
    let padding = basePadding;
    
    // 如果正在移动，为每个段添加微妙的"波浪"效果
    if (isMoving) {
      // 波浪效果：根据段在蛇身体中的位置和动画进度，计算额外的padding变化
      // 这会创建一种从头部向尾部传递的波浪效果
      const segmentPosition = index / (body.length - 1); // 0-1之间的相对位置
      
      // 创建波浪效果 - 波峰在移动方向的前沿
      const wavePhase = (segmentPosition - moveProgress) * Math.PI * 2;
      const waveAmp = 0.5; // 波浪幅度（影响padding变化量）
      
      // 计算波浪影响的padding变化
      const paddingChange = Math.sin(wavePhase) * waveAmp;
      padding = basePadding - paddingChange;
      
      // 确保padding在合理范围内
      padding = Math.max(0.5, Math.min(padding, basePadding * 1.5));
    }
    
    // 绘制主体
    ctx.fillRect(segment.x + padding, segment.y + padding, size - 2 * padding, size - 2 * padding);
    
    // 拐角处理
    if (isCorner) {
      // 在拐角处添加一些装饰
      ctx.fillStyle = this.adjustColor(snake.getColor(), -20);
      
      // 根据前后段的位置确定拐角位置
      if ((prev.x > segment.x && next.y > segment.y) || (prev.y > segment.y && next.x > segment.x)) {
        // 右下拐角
        this.drawPixelCorner(ctx, segment.x, segment.y, size, "topLeft");
      } else if ((prev.x < segment.x && next.y > segment.y) || (prev.y > segment.y && next.x < segment.x)) {
        // 左下拐角
        this.drawPixelCorner(ctx, segment.x, segment.y, size, "topRight");
      } else if ((prev.x > segment.x && next.y < segment.y) || (prev.y < segment.y && next.x > segment.x)) {
        // 右上拐角
        this.drawPixelCorner(ctx, segment.x, segment.y, size, "bottomLeft");
      } else {
        // 左上拐角
        this.drawPixelCorner(ctx, segment.x, segment.y, size, "bottomRight");
      }
    }
    
    // 像素风格描边
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    this.drawPixelBorder(ctx, segment.x, segment.y, size);
  }

  private drawSnakeTail(
    ctx: CanvasRenderingContext2D, 
    body: { x: number; y: number }[], 
    index: number, 
    size: number, 
    snake: Snake
  ): void {
    const tail = body[index];
    // 确保索引有效
    if (!tail || index <= 0 || index >= body.length) return;
    
    const prev = body[index - 1];
    
    // 获取蛇的动画状态
    const moveProgress = snake.getMoveProgress();
    const isMoving = snake.isInMotion();
    
    // 确定尾巴方向
    let direction = Direction.RIGHT;
    if (prev.x > tail.x) direction = Direction.RIGHT;
    else if (prev.x < tail.x) direction = Direction.LEFT;
    else if (prev.y > tail.y) direction = Direction.DOWN;
    else if (prev.y < tail.y) direction = Direction.UP;
    
    // 绘制尾部
    ctx.fillStyle = snake.getColor();
    
    // 调整尾部绘制尺寸，根据动画状态调整尾部外观
    let tailPadding = 3;
    
    // 如果正在移动，根据动画进度调整尾部形状
    if (isMoving) {
      // 在移动开始时尾部更长（更接近前一个节点），在移动结束时尾部更短（更像正常尾部）
      const dynamicPadding = tailPadding * (1 - moveProgress * 0.5); // 随着动画进行，尾部逐渐缩短
      tailPadding = dynamicPadding;
      
      // 根据移动方向轻微拉伸尾部，增强动态效果
      const stretchFactor = 0.7 * (1 - moveProgress); // 随着动画进行，拉伸效果减弱
      
      let tailWidth = size - 2 * tailPadding;
      let tailHeight = size - 2 * tailPadding;
      let offsetX = tailPadding;
      let offsetY = tailPadding;
      
      // 根据方向调整拉伸
      if (direction === Direction.RIGHT) {
        tailWidth *= (1 + stretchFactor);
        offsetX -= tailWidth * stretchFactor;
      } else if (direction === Direction.LEFT) {
        tailWidth *= (1 + stretchFactor);
      } else if (direction === Direction.DOWN) {
        tailHeight *= (1 + stretchFactor);
        offsetY -= tailHeight * stretchFactor;
      } else { // UP
        tailHeight *= (1 + stretchFactor);
      }
      
      // 绘制拉伸的尾部
      ctx.fillRect(
        tail.x + offsetX, 
        tail.y + offsetY, 
        tailWidth, 
        tailHeight
      );
    } else {
      // 正常状态下的尾部绘制
      ctx.fillRect(
        tail.x + tailPadding, 
        tail.y + tailPadding, 
        size - 2 * tailPadding, 
        size - 2 * tailPadding
      );
    }
    
    // 像素风格描边
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    this.drawPixelBorder(ctx, tail.x, tail.y, size);
  }

  private drawShield(ctx: CanvasRenderingContext2D, position: { x: number; y: number }, size: number): void {
    // 绘制盾牌效果
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    
    // 像素风格的盾牌
    const radius = size * 0.8;
    const centerX = position.x + size / 2;
    const centerY = position.y + size / 2;
    
    // 绘制四个像素点作为闪烁的盾牌
    ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
    ctx.fillRect(centerX - radius, centerY, 2, 2);
    ctx.fillRect(centerX + radius - 2, centerY, 2, 2);
    ctx.fillRect(centerX, centerY - radius, 2, 2);
    ctx.fillRect(centerX, centerY + radius - 2, 2, 2);
    
    // 绘制盾牌边缘
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    
    ctx.lineWidth = 1;
  }

  private drawPixelBorder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // 绘制像素风格边框
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.stroke();
  }

  private drawPixelCorner(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
  ): void {
    const cornerSize = size / 4;
    
    switch (position) {
      case "topLeft":
        ctx.fillRect(x, y, cornerSize, cornerSize);
        break;
      case "topRight":
        ctx.fillRect(x + size - cornerSize, y, cornerSize, cornerSize);
        break;
      case "bottomLeft":
        ctx.fillRect(x, y + size - cornerSize, cornerSize, cornerSize);
        break;
      case "bottomRight":
        ctx.fillRect(x + size - cornerSize, y + size - cornerSize, cornerSize, cornerSize);
        break;
    }
  }

  private adjustColor(color: string, amount: number): string {
    // 简单处理常见颜色
    if (color === "green") return amount > 0 ? "#00ff00" : "#006600";
    if (color === "blue") return amount > 0 ? "#0000ff" : "#000066";
    if (color === "red") return amount > 0 ? "#ff0000" : "#660000";
    
    return color;
  }

  // 绘制死亡动画
  private renderDeathAnimation(
    ctx: CanvasRenderingContext2D,
    snake: Snake,
    body: { x: number; y: number }[],
    size: number
  ): void {
    const deathProgress = snake.getDeathProgress();
    const fadeOutAlpha = 1 - deathProgress; // 逐渐消失
    
    // 设置全局透明度
    ctx.globalAlpha = fadeOutAlpha;
    
    // 绘制扭曲和收缩效果
    for (let i = 0; i < body.length; i++) {
      const segment = body[i];
      
      // 计算扭曲和抖动效果
      const oscillation = Math.sin(deathProgress * Math.PI * 10 + i * 0.5) * deathProgress * 5;
      const shrinkFactor = 1 - deathProgress * 0.5;
      
      // 计算新的位置和大小
      const newSize = size * shrinkFactor;
      const offsetX = (size - newSize) / 2 + oscillation;
      const offsetY = (size - newSize) / 2 + oscillation;
      
      // 绘制扭曲的蛇段
      ctx.fillStyle = i === 0 ? 
        this.blendColors(snake.getColor(), "#FF0000", deathProgress) : 
        this.blendColors(snake.getColor(), "#000000", deathProgress);
        
      ctx.fillRect(
        segment.x + offsetX,
        segment.y + offsetY,
        newSize,
        newSize
      );
      
      // 绘制像素化边缘
      ctx.strokeStyle = "rgba(0, 0, 0, " + fadeOutAlpha + ")";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        segment.x + offsetX,
        segment.y + offsetY,
        newSize,
        newSize
      );
    }
    
    // 头部特殊效果 - 死亡表情
    if (body.length > 0) {
      const head = body[0];
      const shrinkFactor = 1 - deathProgress * 0.5;
      const newSize = size * shrinkFactor;
      const offsetX = (size - newSize) / 2;
      const offsetY = (size - newSize) / 2;
      
      // 绘制死亡眼睛 (X形)
      const eyeSize = newSize / 5;
      const eyePadding = newSize / 3;
      
      ctx.strokeStyle = "rgba(255, 0, 0, " + fadeOutAlpha + ")";
      ctx.lineWidth = 2;
      
      // 左眼 X
      const leftEyeX = head.x + offsetX + eyePadding;
      const leftEyeY = head.y + offsetY + eyePadding;
      ctx.beginPath();
      ctx.moveTo(leftEyeX, leftEyeY);
      ctx.lineTo(leftEyeX + eyeSize, leftEyeY + eyeSize);
      ctx.moveTo(leftEyeX + eyeSize, leftEyeY);
      ctx.lineTo(leftEyeX, leftEyeY + eyeSize);
      ctx.stroke();
      
      // 右眼 X
      const rightEyeX = head.x + offsetX + newSize - eyePadding - eyeSize;
      const rightEyeY = head.y + offsetY + eyePadding;
      ctx.beginPath();
      ctx.moveTo(rightEyeX, rightEyeY);
      ctx.lineTo(rightEyeX + eyeSize, rightEyeY + eyeSize);
      ctx.moveTo(rightEyeX + eyeSize, rightEyeY);
      ctx.lineTo(rightEyeX, rightEyeY + eyeSize);
      ctx.stroke();
    }
    
    // 恢复全局透明度
    ctx.globalAlpha = 1.0;
  }

  // 颜色混合函数
  private blendColors(color1: string, color2: string, ratio: number): string {
    // 简化的颜色混合逻辑
    if (color1 === "green") color1 = "#00FF00";
    if (color1 === "blue") color1 = "#0000FF";
    if (color1 === "red") color1 = "#FF0000";
    
    return color2; // 简单情况下直接返回目标颜色
  }
}
