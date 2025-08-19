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
   * Renders the warning phase with subtle pulsing preview
   */
  private renderWarningPhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Gentle pulsing effect for warning (0.2 to 0.4 alpha)
    const pulseAlpha = 0.2 + 0.2 * Math.sin(this.animationFrame * 0.15);
    
    // Draw warning overlay for outer zone - subtle yellow
    ctx.save();
    ctx.globalAlpha = pulseAlpha;
    this.drawCircularRegion(ctx, cx, cy, vortexState.outerRadius, "#ffeb3b", boxSize, true);
    ctx.restore();
    
    // Draw warning overlay for inner zone - subtle orange
    ctx.save();
    ctx.globalAlpha = pulseAlpha * 0.7;
    this.drawCircularRegion(ctx, cx, cy, vortexState.innerRadius, "#ff9800", boxSize, true);
    ctx.restore();
    
    // Draw lethal singularity warning - more visible
    this.drawLethalSingularity(ctx, cx, cy, boxSize, true, this.animationFrame);
    
    // Draw subtle warning indicators
    this.drawWarningIndicators(ctx, cx, cy, vortexState.outerRadius, boxSize, this.animationFrame);
  }
  
  /**
   * Renders the active vortex field with moderate effects
   */
  private renderActivePhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Moderate animated intensity
    const intensity = 0.3 + 0.2 * Math.sin(this.animationFrame * 0.1);
    
    // Draw outer zone with green tint
    ctx.save();
    ctx.globalAlpha = intensity * 0.6;
    this.drawCircularRegion(ctx, cx, cy, vortexState.outerRadius, "#4caf50", boxSize, false);
    ctx.restore();
    
    // Draw inner zone with cyan tint
    ctx.save(); 
    ctx.globalAlpha = intensity * 0.7;
    this.drawCircularRegion(ctx, cx, cy, vortexState.innerRadius, "#00bcd4", boxSize, false);
    ctx.restore();
    
    // Draw active lethal singularity
    this.drawLethalSingularity(ctx, cx, cy, boxSize, false, this.animationFrame);
    
    // Draw subtle energy particles
    this.drawEnergyParticles(ctx, cx, cy, vortexState.outerRadius, boxSize, this.animationFrame);
  }
  
  /**
   * Renders the cooldown phase with fading shield effect
   */
  private renderCooldownPhase(ctx: CanvasRenderingContext2D, vortexState: VortexRenderState, timestamp: number): void {
    if (!vortexState.center) return;
    
    const { x: cx, y: cy } = vortexState.center;
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    
    // Gentle fading shield effect
    const fadeAlpha = Math.max(0.1, vortexState.ticksRemaining / 15);
    
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    
    // Draw fading protective aura with blue tint
    this.drawCircularRegion(ctx, cx, cy, vortexState.outerRadius, "#2196f3", boxSize, true);
    
    ctx.restore();
    
    // Fading singularity
    this.drawLethalSingularity(ctx, cx, cy, boxSize, true, this.animationFrame, fadeAlpha);
  }
  
  /**
   * Draws a circular region approximated on the pixel grid
   */
  private drawCircularRegion(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, color: string, boxSize: number, dashed: boolean = false): void {
    // Calculate center in pixel coordinates - ensure proper alignment
    const pixelCenterX = centerX * boxSize + boxSize;
    const pixelCenterY = centerY * boxSize + boxSize;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2 : 1;
    
    if (dashed) {
      ctx.setLineDash([6, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    // Draw circular region by checking each grid cell
    const gridRadius = radius + 0.5; // Slightly larger for better coverage
    
    for (let gx = centerX - radius - 1; gx <= centerX + radius + 1; gx++) {
      for (let gy = centerY - radius - 1; gy <= centerY + radius + 1; gy++) {
        // Calculate distance from center using Euclidean distance
        const dx = gx - centerX;
        const dy = gy - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= gridRadius) {
          const pixelX = gx * boxSize;
          const pixelY = gy * boxSize;
          
          // Draw with subtle checkerboard pattern
          if ((gx + gy) % 2 === 0) {
            ctx.fillRect(pixelX, pixelY, boxSize, boxSize);
          }
        }
      }
    }
    
    // Draw border outline using approximate circle
    this.drawCircularBorder(ctx, pixelCenterX, pixelCenterY, radius * boxSize, color, dashed);
  }
  
  /**
   * Draws circular border using line segments
   */
  private drawCircularBorder(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radiusPixels: number, color: string, dashed: boolean): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 3 : 2;
    
    if (dashed) {
      ctx.setLineDash([8, 4]);
    } else {
      ctx.setLineDash([]);
    }
    
    // Draw approximate circle using line segments
    ctx.beginPath();
    const segments = 32; // Number of line segments
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radiusPixels;
      const y = centerY + Math.sin(angle) * radiusPixels;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  
  /**
   * Draws the 2x2 lethal singularity with pixel art style
   */
  private drawLethalSingularity(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, boxSize: number, isWarning: boolean, frame: number, fadeAlpha: number = 1): void {
    // Center the 2x2 singularity properly
    const pixelX = centerX * boxSize;
    const pixelY = centerY * boxSize;
    const size = boxSize * 2; // 2x2 size
    
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    
    // Base color depends on state
    const baseColor = isWarning ? "#f44336" : "#d32f2f";
    const accentColor = isWarning ? "#ffeb3b" : "#ff5722";
    
    // Gentle pulsing intensity
    const pulseIntensity = 0.6 + 0.2 * Math.sin(frame * 0.2);
    
    // Draw the 2x2 singularity blocks
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = pulseIntensity * fadeAlpha * 0.8;
    ctx.fillRect(pixelX, pixelY, size, size);
    
    // Add subtle cross pattern in center
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = (0.6 + 0.2 * Math.sin(frame * 0.3)) * fadeAlpha;
    
    const centerPx = pixelX + size / 2;
    const centerPy = pixelY + size / 2;
    const crossSize = 4;
    
    // Horizontal line
    ctx.fillRect(centerPx - crossSize, centerPy - 1, crossSize * 2, 2);
    // Vertical line  
    ctx.fillRect(centerPx - 1, centerPy - crossSize, 2, crossSize * 2);
    
    // Add corner accent pixels - more subtle
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = pulseIntensity * 0.5 * fadeAlpha;
    const cornerSize = 3;
    
    // Four corners of the 2x2 area
    ctx.fillRect(pixelX, pixelY, cornerSize, cornerSize);
    ctx.fillRect(pixelX + size - cornerSize, pixelY, cornerSize, cornerSize);
    ctx.fillRect(pixelX, pixelY + size - cornerSize, cornerSize, cornerSize);
    ctx.fillRect(pixelX + size - cornerSize, pixelY + size - cornerSize, cornerSize, cornerSize);
    
    // Subtle outer border
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = (0.4 + 0.2 * Math.sin(frame * 0.25)) * fadeAlpha;
    ctx.strokeRect(pixelX - 1, pixelY - 1, size + 2, size + 2);
    
    ctx.restore();
  }
  
  /**
   * Draws subtle warning indicators around the field
   */
  private drawWarningIndicators(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, boxSize: number, frame: number): void {
    const pixelCenterX = centerX * boxSize + boxSize;
    const pixelCenterY = centerY * boxSize + boxSize;
    const distance = (radius + 1.5) * boxSize;
    
    ctx.save();
    ctx.fillStyle = "#ff9800";
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Gentle flashing warning symbols at cardinal directions
    const flashAlpha = 0.3 + 0.3 * Math.sin(frame * 0.2);
    ctx.globalAlpha = flashAlpha;
    
    const directions = [
      { x: pixelCenterX, y: pixelCenterY - distance, symbol: "!" },
      { x: pixelCenterX + distance, y: pixelCenterY, symbol: "!" },
      { x: pixelCenterX, y: pixelCenterY + distance, symbol: "!" },
      { x: pixelCenterX - distance, y: pixelCenterY, symbol: "!" }
    ];
    
    for (const dir of directions) {
      // Shadow for better visibility
      ctx.fillStyle = "black";
      ctx.fillText(dir.symbol, dir.x + 1, dir.y + 1);
      // Main text
      ctx.fillStyle = "#ff9800";
      ctx.fillText(dir.symbol, dir.x, dir.y);
    }
    
    ctx.restore();
  }
  
  /**
   * Draws subtle energy particles
   */
  private drawEnergyParticles(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, boxSize: number, frame: number): void {
    const pixelCenterX = centerX * boxSize + boxSize;
    const pixelCenterY = centerY * boxSize + boxSize;
    
    ctx.save();
    ctx.fillStyle = "#64ffda";
    
    // Draw fewer, smaller orbiting particles
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + frame * 0.03;
      const orbitRadius = radius * boxSize * 0.6 + 6 * Math.sin(frame * 0.05 + i);
      const x = pixelCenterX + Math.cos(angle) * orbitRadius;
      const y = pixelCenterY + Math.sin(angle) * orbitRadius;
      
      const particleAlpha = 0.3 + 0.3 * Math.sin(frame * 0.2 + i);
      ctx.globalAlpha = particleAlpha;
      
      // Small square particles
      const particleSize = 2;
      ctx.fillRect(x - particleSize / 2, y - particleSize / 2, particleSize, particleSize);
    }
    
    ctx.restore();
  }
}