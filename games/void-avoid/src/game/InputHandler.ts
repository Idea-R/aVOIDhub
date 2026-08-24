import { CanvasManager } from './core/CanvasManager';

export interface KnockbackHandler { (): void }

export interface TapGesture {
  duration: number;
  distance: number;
  elapsedSincePreviousTap: number;
}

export function isDoubleTapGesture(gesture: TapGesture): boolean {
  return gesture.duration <= 220
    && gesture.distance <= 48
    && gesture.elapsedSincePreviousTap <= 320;
}

export interface InputDiagnostics {
  attached: boolean;
  listenerCount: number;
  activePointerId: number | null;
  pointerType: string;
}

export class InputHandler {
  private canvasManager: CanvasManager | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private activePointerId: number | null = null;
  private pointerType = 'mouse';
  private pointerStartTime = 0;
  private pointerStartPosition = { x: 0, y: 0 };
  private previousTapTime = Number.NEGATIVE_INFINITY;
  private attached = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onKnockback: KnockbackHandler,
  ) {
    this.attach();
  }

  setCanvasManager(canvasManager: CanvasManager): void {
    this.canvasManager = canvasManager;
    this.centerPointer();
  }

  private attach(): void {
    if (this.attached) return;
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.attached = true;
  }

  private mapPosition(clientX: number, clientY: number): { x: number; y: number } {
    if (this.canvasManager) return this.canvasManager.screenToCanvas(clientX, clientY);
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    return {
      x: Math.max(0, Math.min(this.canvas.width, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(this.canvas.height, (clientY - rect.top) * scaleY)),
    };
  }

  private updatePosition(event: PointerEvent): void {
    const position = this.mapPosition(event.clientX, event.clientY);
    this.mouseX = position.x;
    this.mouseY = position.y;
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    this.pointerType = event.pointerType || 'mouse';
    this.updatePosition(event);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.pointerType = event.pointerType || 'mouse';
    this.pointerStartTime = performance.now();
    this.updatePosition(event);
    this.pointerStartPosition = { x: this.mouseX, y: this.mouseY };
    try { this.canvas.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.updatePosition(event);
    if (this.pointerType === 'touch' || this.pointerType === 'pen') {
      const now = performance.now();
      const distance = Math.hypot(
        this.mouseX - this.pointerStartPosition.x,
        this.mouseY - this.pointerStartPosition.y,
      );
      if (isDoubleTapGesture({
        duration: now - this.pointerStartTime,
        distance,
        elapsedSincePreviousTap: now - this.previousTapTime,
      })) {
        this.previousTapTime = Number.NEGATIVE_INFINITY;
        this.onKnockback();
        if ('vibrate' in navigator) navigator.vibrate?.(25);
      } else if (now - this.pointerStartTime <= 220 && distance <= 48) {
        this.previousTapTime = now;
      }
    }
    this.releasePointer(event.pointerId);
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) this.releasePointer(event.pointerId);
  };

  private handleDoubleClick = (event: MouseEvent): void => {
    if (this.pointerType === 'touch' || this.pointerType === 'pen') return;
    event.preventDefault();
    this.onKnockback();
  };

  private releasePointer(pointerId: number): void {
    try {
      if (this.canvas.hasPointerCapture?.(pointerId)) this.canvas.releasePointerCapture(pointerId);
    } catch { /* the browser may already have released it */ }
    this.activePointerId = null;
  }

  private centerPointer(): void {
    const state = this.canvasManager?.getState();
    this.mouseX = (state?.displayWidth || this.canvas.width) / 2;
    this.mouseY = (state?.displayHeight || this.canvas.height) / 2;
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  getIsTouchDevice(): boolean {
    return this.pointerType === 'touch' || this.pointerType === 'pen';
  }

  reset(): void {
    this.activePointerId = null;
    this.previousTapTime = Number.NEGATIVE_INFINITY;
    this.centerPointer();
  }

  getDiagnostics(): InputDiagnostics {
    return {
      attached: this.attached,
      listenerCount: this.attached ? 5 : 0,
      activePointerId: this.activePointerId,
      pointerType: this.pointerType,
    };
  }

  cleanup(): void {
    if (!this.attached) return;
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.attached = false;
    this.activePointerId = null;
  }
}
