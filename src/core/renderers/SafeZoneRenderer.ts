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
      this.renderWarningEffect();
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
  private renderWarningEffect(): void {
    // Create pulsing border effect
    const time = Date.now();
    const pulseIntensity = Math.sin(time / 200) * 0.5 + 0.5; // 0 to 1
    
    // Draw pulsing overlay
    this.ctx.fillStyle = `rgba(255, 255, 0, ${pulseIntensity * 0.1})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw warning text
    this.ctx.fillStyle = `rgba(255, 255, 0, ${pulseIntensity})`;
    this.ctx.font = "bold 24px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "ZONE SHRINKING!", 
      this.canvas.width / 2, 
      50
    );
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