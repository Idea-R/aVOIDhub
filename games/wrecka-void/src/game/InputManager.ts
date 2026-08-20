import { Vector2 } from "../types/Game";

interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function mapClientPointToCanvas(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
  canvasWidth: number,
  canvasHeight: number,
): Vector2 {
  const scaleX = rect.width > 0 ? canvasWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? canvasHeight / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export class InputManager {
  private keys = new Set<string>();
  private mousePos: Vector2;
  private mouseDown = false;
  private canvas: HTMLCanvasElement | null = null;
  private listeners: {
    onKeyDown?: (key: string) => void;
    onKeyUp?: (key: string) => void;
    onMouseMove?: (pos: Vector2) => void;
    onMouseDown?: () => void;
    onMouseUp?: () => void;
  } = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      this.listeners.onKeyDown?.(e.code);

      if (e.code === "Space") {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      this.listeners.onKeyUp?.(e.code);
    };

    const updatePointerPosition = (e: PointerEvent) => {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = mapClientPointToCanvas(
          e.clientX,
          e.clientY,
          rect,
          this.canvas.width,
          this.canvas.height,
        );
        this.listeners.onMouseMove?.(this.mousePos);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerPosition(e);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.isPrimary && e.button === 0) {
        updatePointerPosition(e);
        this.mouseDown = true;
        this.canvas?.setPointerCapture?.(e.pointerId);
        this.listeners.onMouseDown?.();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.isPrimary) {
        this.mouseDown = false;
        this.listeners.onMouseUp?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    this.canvas?.addEventListener("pointermove", handlePointerMove);
    this.canvas?.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    // Store cleanup function
    this.cleanup = () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      this.canvas?.removeEventListener("pointermove", handlePointerMove);
      this.canvas?.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }

  private cleanup: (() => void) | null = null;

  setListeners(listeners: typeof this.listeners): void {
    this.listeners = listeners;
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key);
  }

  getMousePosition(): Vector2 {
    return { ...this.mousePos };
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  destroy(): void {
    this.cleanup?.();
  }
}
