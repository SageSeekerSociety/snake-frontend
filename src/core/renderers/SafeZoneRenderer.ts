import { GameConfig } from "../../config/GameConfig";
import { SafeZoneStatus } from "../../managers/SafeZoneManager";

/**
 * Renders the safe zone visualization on the canvas
 */
export class SafeZoneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Cannot get 2D rendering context");
    }
    this.ctx = context;
  }

  /**
   * Renders the safe zone overlay
   */
  public render(safeZoneStatus: SafeZoneStatus): void {
    if (!safeZoneStatus.enabled) return;

    this.renderDangerZones(safeZoneStatus);
    this.renderSafeZoneBorder(safeZoneStatus);
    
    if (safeZoneStatus.isWarning) {
      this.renderWarningEffect(safeZoneStatus);
    }
  }

  /**
   * Renders the danger zones (areas outside safe zone)
   */
  private renderDangerZones(safeZoneStatus: SafeZoneStatus): void {
    const { currentBounds } = safeZoneStatus;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Convert grid coordinates to pixel coordinates
    const safeLeft = currentBounds.xMin * boxSize;
    const safeRight = (currentBounds.xMax + 1) * boxSize;
    const safeTop = currentBounds.yMin * boxSize;
    const safeBottom = (currentBounds.yMax + 1) * boxSize;

    // Set danger zone style
    this.ctx.fillStyle = GameConfig.SAFE_ZONE.DANGER_ZONE_COLOR;
    this.ctx.globalAlpha = GameConfig.SAFE_ZONE.DANGER_ZONE_ALPHA;

    // Render danger zones (top, bottom, left, right)
    
    // Top danger zone
    if (safeTop > 0) {
      this.ctx.fillRect(0, 0, canvasWidth, safeTop);
    }

    // Bottom danger zone
    if (safeBottom < canvasHeight) {
      this.ctx.fillRect(0, safeBottom, canvasWidth, canvasHeight - safeBottom);
    }

    // Left danger zone
    if (safeLeft > 0) {
      this.ctx.fillRect(0, safeTop, safeLeft, safeBottom - safeTop);
    }

    // Right danger zone
    if (safeRight < canvasWidth) {
      this.ctx.fillRect(safeRight, safeTop, canvasWidth - safeRight, safeBottom - safeTop);
    }

    // Reset alpha
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Renders the safe zone border
   */
  private renderSafeZoneBorder(safeZoneStatus: SafeZoneStatus): void {
    const { currentBounds } = safeZoneStatus;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    // Convert grid coordinates to pixel coordinates
    const safeLeft = currentBounds.xMin * boxSize;
    const safeRight = (currentBounds.xMax + 1) * boxSize;
    const safeTop = currentBounds.yMin * boxSize;
    const safeBottom = (currentBounds.yMax + 1) * boxSize;

    // Set border style
    this.ctx.strokeStyle = GameConfig.SAFE_ZONE.BORDER_COLOR;
    this.ctx.lineWidth = GameConfig.SAFE_ZONE.BORDER_WIDTH;

    // Draw border rectangle
    this.ctx.strokeRect(safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);
  }

  /**
   * Renders warning effect when zone is about to shrink
   */
  private renderWarningEffect(safeZoneStatus?: SafeZoneStatus): void {
    const time = Date.now();
    const slowPulse = Math.sin(time / 1000) * 0.3 + 0.7; // 缓慢脉动，0.4到1之间
    
    // 1. 增强安全区边框的警告效果
    if (safeZoneStatus) {
      this.renderEnhancedWarningBorder(slowPulse, safeZoneStatus);
    }
    
    // 2. 四个角落的警告指示器
    this.renderCornerWarningIndicators(slowPulse);
    
    // 3. 顶部简洁警告条
    this.renderTopWarningBar(slowPulse);
  }

  /**
   * 渲染增强的警告边框
   */
  private renderEnhancedWarningBorder(pulseIntensity: number, safeZoneStatus: SafeZoneStatus): void {
    const { currentBounds } = safeZoneStatus;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    // 转换网格坐标为像素坐标
    const safeLeft = currentBounds.xMin * boxSize;
    const safeRight = (currentBounds.xMax + 1) * boxSize;
    const safeTop = currentBounds.yMin * boxSize;
    const safeBottom = (currentBounds.yMax + 1) * boxSize;
    
    // 警告边框样式
    this.ctx.strokeStyle = `rgba(255, 100, 0, ${pulseIntensity})`;
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([12, 6]); // 虚线效果
    
    // 绘制增强的安全区边框
    this.ctx.strokeRect(safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);
    this.ctx.setLineDash([]); // 重置虚线
  }

  /**
   * 渲染角落警告指示器
   */
  private renderCornerWarningIndicators(pulseIntensity: number): void {
    const size = 16;
    const margin = 8;
    const alpha = pulseIntensity;
    
    // 警告三角形的像素图案
    const warningPattern = [
      "    ██    ",
      "   ████   ",
      "  ██████  ", 
      " ████████ ",
      "██████████",
      "██  ██  ██",
      "██████████"
    ];
    
    // 四个角落的位置
    const corners = [
      { x: margin, y: margin },                                    // 左上
      { x: this.canvas.width - margin - size, y: margin },         // 右上
      { x: margin, y: this.canvas.height - margin - size },        // 左下
      { x: this.canvas.width - margin - size, y: this.canvas.height - margin - size } // 右下
    ];
    
    this.ctx.fillStyle = `rgba(255, 150, 0, ${alpha})`;
    
    corners.forEach(corner => {
      warningPattern.forEach((row, rowIndex) => {
        [...row].forEach((pixel, colIndex) => {
          if (pixel === "█") {
            this.ctx.fillRect(
              corner.x + colIndex, 
              corner.y + rowIndex, 
              1, 
              1
            );
          }
        });
      });
    });
  }

  /**
   * 渲染顶部警告条
   */
  private renderTopWarningBar(pulseIntensity: number): void {
    const barHeight = 24;
    const alpha = pulseIntensity * 0.8;
    
    // 半透明背景条
    this.ctx.fillStyle = `rgba(50, 20, 0, ${alpha * 0.6})`;
    this.ctx.fillRect(0, 0, this.canvas.width, barHeight);
    
    // 像素风格的警告文字
    this.ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
    this.drawPixelText("ZONE SHRINKING", this.canvas.width / 2 - 65, 8);
  }

  /**
   * 绘制像素风格文字
   */
  private drawPixelText(text: string, x: number, y: number): void {
    // 简化的像素字体实现
    const charWidth = 10;
    const charHeight = 8;
    
    [...text].forEach((char, index) => {
      const charX = x + index * charWidth;
      this.drawPixelChar(char, charX, y);
    });
  }

  /**
   * 绘制单个像素字符
   */
  private drawPixelChar(char: string, x: number, y: number): void {
    // 简化的字符图案（只实现需要的字符）
    const patterns: Record<string, string[]> = {
      'Z': [
        "██████████",
        "        ██",
        "      ██  ",
        "    ██    ",
        "  ██      ",
        "██        ",
        "██████████"
      ],
      'O': [
        "  ██████  ",
        "██      ██",
        "██      ██",
        "██      ██",
        "██      ██",
        "██      ██",
        "  ██████  "
      ],
      'N': [
        "██      ██",
        "████    ██",
        "██  ██  ██",
        "██    ████",
        "██      ██",
        "██      ██",
        "██      ██"
      ],
      'E': [
        "██████████",
        "██        ",
        "██        ",
        "████████  ",
        "██        ",
        "██        ",
        "██████████"
      ],
      ' ': [
        "          ",
        "          ",
        "          ",
        "          ",
        "          ",
        "          ",
        "          "
      ],
      'S': [
        "  ████████",
        "██        ",
        "██        ",
        "  ██████  ",
        "        ██",
        "        ██",
        "████████  "
      ],
      'H': [
        "██      ██",
        "██      ██",
        "██      ██",
        "██████████",
        "██      ██",
        "██      ██",
        "██      ██"
      ],
      'R': [
        "████████  ",
        "██      ██",
        "██      ██",
        "████████  ",
        "██  ██    ",
        "██    ██  ",
        "██      ██"
      ],
      'I': [
        "██████████",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "██████████"
      ],
      'K': [
        "██      ██",
        "██    ██  ",
        "██  ██    ",
        "████      ",
        "██  ██    ",
        "██    ██  ",
        "██      ██"
      ],
      'G': [
        "  ████████",
        "██        ",
        "██        ",
        "██  ██████",
        "██      ██",
        "██      ██",
        "  ████████"
      ],
      'T': [
        "██████████",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "    ██    ",
        "    ██    "
      ],
      'C': [
        "  ████████",
        "██        ",
        "██        ",
        "██        ",
        "██        ",
        "██        ",
        "  ████████"
      ]
    };
    
    const pattern = patterns[char] || patterns[' '];
    pattern.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel === "█") {
          this.ctx.fillRect(x + colIndex, y + rowIndex, 1, 1);
        }
      });
    });
  }

  /**
   * Renders shrinking animation
   */
  public renderShrinkingAnimation(safeZoneStatus: SafeZoneStatus): void {
    if (!safeZoneStatus.isShrinking || !safeZoneStatus.targetBounds) return;

    const { currentBounds, targetBounds } = safeZoneStatus;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;

    // Draw target zone with dashed line
    const targetLeft = targetBounds.xMin * boxSize;
    const targetRight = (targetBounds.xMax + 1) * boxSize;
    const targetTop = targetBounds.yMin * boxSize;
    const targetBottom = (targetBounds.yMax + 1) * boxSize;

    this.ctx.strokeStyle = "#ffff00";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.strokeRect(
      targetLeft, 
      targetTop, 
      targetRight - targetLeft, 
      targetBottom - targetTop
    );
    
    // Reset line dash
    this.ctx.setLineDash([]);
  }
}