export interface CursorState {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  isAbsorbed: boolean;
  glowIntensity: number;
  absorptionTarget?: HTMLElement;
}

export interface CursorConfig {
  cursorColor: string;
  isVisible: boolean;
}

export class CursorSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cursorState: CursorState;
  private config: CursorConfig;
  private animationFrameId?: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.cursorState = {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      isAbsorbed: false,
      glowIntensity: 0
    };

    this.config = {
      cursorColor: '#06b6d4',
      isVisible: true
    };

    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupEventListeners(): void {
    // Direct cursor tracking for responsive UI interaction
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });
    document.addEventListener('mouseenter', this.handleMouseEnter, { passive: true });
    window.addEventListener('resize', this.handleResize);
    
    // Initialize canvas size
    this.handleResize();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    // Update cursor position directly for responsive tracking
    this.cursorState.x = e.clientX;
    this.cursorState.y = e.clientY;
    
    // Check for hoverable elements with absorption effects
    const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
    const hoverableElement = elementUnderCursor?.closest('[data-cursor-hover]') as HTMLElement;
    
    if (hoverableElement) {
      this.handleHoverTarget(hoverableElement, e.clientX, e.clientY);
    } else {
      this.resetHoverState();
    }
  };

  private handleHoverTarget(element: HTMLElement, mouseX: number, mouseY: number): void {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    const maxDistance = Math.sqrt(Math.pow(rect.width / 2, 2) + Math.pow(rect.height / 2, 2));
    const proximity = Math.max(0, 1 - distance / maxDistance);
    
    this.cursorState.scale = 0.5 + proximity * 0.3; // Shrink when hovering
    this.cursorState.isAbsorbed = proximity > 0.7; // Full absorption when very close
    this.cursorState.glowIntensity = proximity;
    this.cursorState.absorptionTarget = element;
    
    // Apply glow to target element
    element.style.setProperty('--cursor-glow-intensity', proximity.toString());
    element.style.setProperty('--cursor-color', this.config.cursorColor);
    
    if (proximity > 0.5) {
      element.classList.add('cursor-absorbed');
    } else {
      element.classList.remove('cursor-absorbed');
    }
  }

  private resetHoverState(): void {
    this.cursorState.scale = 1;
    this.cursorState.isAbsorbed = false;
    this.cursorState.glowIntensity = 0;
    this.cursorState.absorptionTarget = undefined;
    
    // Clear any existing glow effects
    document.querySelectorAll('[data-cursor-hover]').forEach(el => {
      (el as HTMLElement).style.setProperty('--cursor-glow-intensity', '0');
      el.classList.remove('cursor-absorbed');
    });
  }

  private handleMouseLeave = (): void => {
    this.cursorState.opacity = 0;
  };

  private handleMouseEnter = (): void => {
    this.cursorState.opacity = 1;
  };

  private handleResize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  private startRenderLoop(): void {
    const render = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  private render(): void {
    if (!this.config.isVisible) return;

    // Clear canvas with better performance
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Skip rendering if cursor is not visible
    if (this.cursorState.opacity <= 0) return;

    // Apply cursor transformations
    this.ctx.save();
    this.ctx.globalAlpha = this.cursorState.opacity;
    this.ctx.translate(this.cursorState.x, this.cursorState.y);
    this.ctx.scale(this.cursorState.scale, this.cursorState.scale);

    // Clear any existing shadow to prevent artifacts
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Draw main cursor circle - Pure blue wisp
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
    this.ctx.fillStyle = this.config.cursorColor;
    
    // Enhanced glow effect - No red components
    const glowSize = 20 + this.cursorState.glowIntensity * 15;
    this.ctx.shadowColor = this.config.cursorColor;
    this.ctx.shadowBlur = glowSize;
    this.ctx.fill();

    // Reset shadow for other elements
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Inner highlight - Pure white, no red
    this.ctx.beginPath();
    this.ctx.arc(-2, -2, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fill();

    // Absorption effect rings - Only when needed
    if (this.cursorState.glowIntensity > 0.3) {
      const time = Date.now() * 0.01;
      
      // Outer ring - Pure cursor color
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 15 + this.cursorState.glowIntensity * 10, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.config.cursorColor + '60';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Inner pulsing ring - Pure cursor color
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 10 + Math.sin(time) * 3, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.config.cursorColor + '80';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }

    // Absorption burst effect - Only when absorbed
    if (this.cursorState.isAbsorbed) {
      const time = Date.now() * 0.02;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 12 + Math.sin(time) * 4, 0, Math.PI * 2);
      this.ctx.fillStyle = this.config.cursorColor + '40';
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  public updateConfig(config: Partial<CursorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getCursorState(): CursorState {
    return { ...this.cursorState };
  }

  public destroy(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    document.removeEventListener('mouseenter', this.handleMouseEnter);
    window.removeEventListener('resize', this.handleResize);
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.resetHoverState();
  }
} 