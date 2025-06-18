import { GameConfig } from "../../config/GameConfig";
import { VortexFieldState, VortexFieldStatus } from "../../types/VortexField";

/**
 * Render state interface for vortex field visualization
 */
interface VortexRenderState {
  status: VortexFieldState;
  ticksRemaining: number;
  center: { x: number; y: number } | null;
  innerRadius: number;
  outerRadius: number;
}

/**
 * Handles rendering of the vortex field with pixel art style
 */
export class VortexFieldRenderer {
  private animationFrame: number = 0;
  
  /**
   * Main render method for vortex field
   */
  render(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number = performance.now()): void {
    this.animationFrame = (this.animationFrame + 1) % 120; // 2 seconds at 60fps
    
    switch (vortexState.status) {
      case VortexFieldState.WARNING:
        this.renderWarningPhase(ctx, vortexState, timestamp);
        break;
      case VortexFieldState.ACTIVE:
        this.renderActivePhase(ctx, vortexState, timestamp);
        break;
      case VortexFieldState.COOLDOWN:
        this.renderCooldownPhase(ctx, vortexState, timestamp);
        break;
      case VortexFieldState.INACTIVE:
      default:
        // Do nothing for inactive state
        break;
    }
  }
  
  /**
   * Renders the warning phase with pulsing preview
   */
  private renderWarningPhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Pulsing effect for warning (0.5 to 1.0 alpha)
    const pulseAlpha = 0.5 + 0.5 * Math.sin(this.animationFrame * 0.2);
    
    // Draw warning overlay for entire vortex area
    ctx.save();
    ctx.globalAlpha = pulseAlpha * 0.3;
    
    // Outer ring preview - yellow warning
    this.drawRing(ctx, cx, cy, vortexState.outerRadius, "#ffeb3b", boxSize, true);
    
    // Inner ring preview - orange warning  
    this.drawRing(ctx, cx, cy, vortexState.innerRadius, "#ff9800", boxSize, true);
    
    // Lethal singularity preview - red warning
    this.drawSingularity(ctx, cx, cy, "#ef4444", boxSize, true);
    
    ctx.restore();
    
    // Warning text at center
    this.drawWarningText(ctx, cx, cy, vortexState.ticksRemaining, boxSize);
  }
  
  /**
   * Renders the active vortex field with swirling effects
   */
  private renderActivePhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Swirling animation
    const swirl = this.animationFrame * 0.1;
    
    ctx.save();
    
    // Outer ring - green tint (food multiplier zone)
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(swirl);
    this.drawRing(ctx, cx, cy, vortexState.outerRadius, "#4ade80", boxSize, false);
    
    // Inner ring - blue tint (higher multiplier zone)
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(swirl + 1);
    this.drawRing(ctx, cx, cy, vortexState.innerRadius, "#3b82f6", boxSize, false);
    
    // Lethal singularity - red danger zone
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(swirl + 2);
    this.drawSingularity(ctx, cx, cy, "#ef4444", boxSize, false);
    
    ctx.restore();
    
    // Draw swirling particles
    this.drawSwirlParticles(ctx, cx, cy, vortexState.outerRadius, boxSize, swirl);
    
    // Draw pull direction indicators
    this.drawPullIndicators(ctx, cx, cy, vortexState.outerRadius, boxSize, swirl);
  }
  
  /**
   * Renders the cooldown phase with fading shield effect
   */
  private renderCooldownPhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Fading shield effect
    const fadeAlpha = Math.max(0.1, vortexState.ticksRemaining / 5); // Assuming 5 tick cooldown
    
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.3;
    
    // Draw fading protective aura
    this.drawRing(ctx, cx, cy, vortexState.outerRadius, "#10b981", boxSize, true);
    
    ctx.restore();
  }
  
  /**
   * Draws a ring around the vortex center
   */
  private drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, boxSize: number, dashed: boolean = false): void {
    const pixelCx = cx * boxSize + boxSize / 2;
    const pixelCy = cy * boxSize + boxSize / 2;
    const pixelRadius = radius * boxSize;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2 : 3;
    
    if (dashed) {
      ctx.setLineDash([8, 4]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.arc(pixelCx, pixelCy, pixelRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Fill with semi-transparent color
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.1;
    ctx.fill();
  }
  
  /**
   * Draws the lethal singularity (2x2 center)
   */
  private drawSingularity(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, boxSize: number, dashed: boolean = false): void {
    const pixelX = cx * boxSize;
    const pixelY = cy * boxSize;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2 : 3;
    
    if (dashed) {
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(pixelX, pixelY, boxSize * 2, boxSize * 2);
    } else {
      ctx.setLineDash([]);
      ctx.fillRect(pixelX, pixelY, boxSize * 2, boxSize * 2);
      
      // Add pulsing border effect
      ctx.strokeRect(pixelX - 2, pixelY - 2, boxSize * 2 + 4, boxSize * 2 + 4);
    }
  }
  
  /**
   * Draws warning text during warning phase
   */
  private drawWarningText(ctx: CanvasRenderingContext2D, cx: number, cy: number, ticksRemaining: number, boxSize: number): void {
    const pixelCx = cx * boxSize + boxSize;
    const pixelCy = cy * boxSize - 20;
    
    ctx.save();
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Pulsing warning text
    const pulse = 0.7 + 0.3 * Math.sin(this.animationFrame * 0.3);
    ctx.globalAlpha = pulse;
    
    // Text shadow for better visibility
    ctx.fillStyle = "black";
    ctx.fillText(`VORTEX IN ${ticksRemaining}`, pixelCx + 1, pixelCy + 1);
    
    ctx.fillStyle = "#ffeb3b";
    ctx.fillText(`VORTEX IN ${ticksRemaining}`, pixelCx, pixelCy);
    
    ctx.restore();
  }
  
  /**
   * Draws swirling particles around the vortex
   */
  private drawSwirlParticles(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, boxSize: number, swirl: number): void {
    const pixelCx = cx * boxSize + boxSize;
    const pixelCy = cy * boxSize + boxSize;
    const pixelRadius = radius * boxSize;
    
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    
    // Draw 8 particles in a spiral
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + swirl;
      const distance = pixelRadius * 0.7 + 10 * Math.sin(swirl + i);
      const x = pixelCx + Math.cos(angle) * distance;
      const y = pixelCy + Math.sin(angle) * distance;
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  /**
   * Draws pull direction indicators
   */
  private drawPullIndicators(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, boxSize: number, swirl: number): void {
    const pixelCx = cx * boxSize + boxSize;
    const pixelCy = cy * boxSize + boxSize;
    const pixelRadius = radius * boxSize;
    
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    
    // Draw 4 arrows pointing inward
    const directions = [
      { angle: 0, label: "←" },      // Right to left
      { angle: Math.PI / 2, label: "↑" },  // Bottom to top
      { angle: Math.PI, label: "→" },      // Left to right  
      { angle: 3 * Math.PI / 2, label: "↓" } // Top to bottom
    ];
    
    for (const dir of directions) {
      const distance = pixelRadius + 15;
      const x = pixelCx + Math.cos(dir.angle) * distance;
      const y = pixelCy + Math.sin(dir.angle) * distance;
      
      // Pulsing arrows
      const pulse = 0.5 + 0.5 * Math.sin(swirl * 2 + dir.angle);
      ctx.globalAlpha = pulse * 0.8;
      
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(dir.label, x, y);
    }
    
    ctx.restore();
  }
}