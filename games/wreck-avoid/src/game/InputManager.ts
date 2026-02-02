import { Vector2 } from '../types/Game';

export class InputManager {
  private keys = new Set<string>();
  private mousePos: Vector2 = { x: 400, y: 300 };
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
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      this.listeners.onKeyDown?.(e.code);
      
      if (e.code === 'Space') {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      this.listeners.onKeyUp?.(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        this.listeners.onMouseMove?.(this.mousePos);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.listeners.onMouseDown?.();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.listeners.onMouseUp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Store cleanup function
    this.cleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
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