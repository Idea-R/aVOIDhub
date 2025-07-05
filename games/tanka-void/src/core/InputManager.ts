import { Vector2 } from '../utils/Vector2.js';

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mousePosition: Vector2 = new Vector2();
  private mouseButtons: Map<number, boolean> = new Map();
  private canvas: HTMLCanvasElement;
  private canvasRect: DOMRect;

  // Mobile touch controls
  private virtualJoystick: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private fireButton: HTMLElement | null = null;
  private isJoystickActive = false;
  private joystickInput = new Vector2();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvasRect = canvas.getBoundingClientRect();
    this.setupEventListeners();
    this.setupMobileControls();
  }

  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    // Mouse events
    this.canvas.addEventListener('mousemove', (e) => {
      this.updateMousePosition(e);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons.set(e.button, true);
      e.preventDefault();
    });

    this.canvas.addEventListener('mouseup', (e) => {
      this.mouseButtons.set(e.button, false);
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Update canvas rect on resize
    window.addEventListener('resize', () => {
      this.canvasRect = this.canvas.getBoundingClientRect();
    });
  }

  private setupMobileControls(): void {
    this.virtualJoystick = document.querySelector('.virtual-joystick');
    this.joystickKnob = document.querySelector('.joystick-knob');
    this.fireButton = document.querySelector('.fire-button');

    if (this.virtualJoystick && this.joystickKnob) {
      this.virtualJoystick.addEventListener('touchstart', (e) => {
        this.isJoystickActive = true;
        this.updateJoystickPosition(e.touches[0]);
        e.preventDefault();
      });

      this.virtualJoystick.addEventListener('touchmove', (e) => {
        if (this.isJoystickActive) {
          this.updateJoystickPosition(e.touches[0]);
        }
        e.preventDefault();
      });

      this.virtualJoystick.addEventListener('touchend', () => {
        this.isJoystickActive = false;
        this.joystickInput.set(0, 0);
        if (this.joystickKnob) {
          this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
      });
    }

    if (this.fireButton) {
      this.fireButton.addEventListener('touchstart', () => {
        this.mouseButtons.set(0, true);
      });

      this.fireButton.addEventListener('touchend', () => {
        this.mouseButtons.set(0, false);
      });
    }
  }

  private updateJoystickPosition(touch: Touch): void {
    if (!this.virtualJoystick || !this.joystickKnob) return;

    const rect = this.virtualJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    const maxDistance = 40;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }

    this.joystickInput.set(deltaX / maxDistance, deltaY / maxDistance);
    this.joystickKnob.style.transform = `translate(${-50 + deltaX}%, ${-50 + deltaY}%)`;
  }

  private updateMousePosition(e: MouseEvent): void {
    const scaleX = this.canvas.width / this.canvasRect.width;
    const scaleY = this.canvas.height / this.canvasRect.height;

    this.mousePosition.x = (e.clientX - this.canvasRect.left) * scaleX;
    this.mousePosition.y = (e.clientY - this.canvasRect.top) * scaleY;
  }

  isKeyPressed(key: string): boolean {
    return this.keys.get(key) || false;
  }

  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.get(button) || false;
  }

  getMousePosition(): Vector2 {
    return this.mousePosition.clone();
  }

  getMovementInput(): Vector2 {
    const input = new Vector2();

    // Keyboard input
    if (this.isKeyPressed('KeyW') || this.isKeyPressed('ArrowUp')) input.y -= 1;
    if (this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown')) input.y += 1;
    if (this.isKeyPressed('KeyA') || this.isKeyPressed('ArrowLeft')) input.x -= 1;
    if (this.isKeyPressed('KeyD') || this.isKeyPressed('ArrowRight')) input.x += 1;

    // Mobile joystick input
    if (this.isJoystickActive) {
      input.x = this.joystickInput.x;
      input.y = this.joystickInput.y;
    }

    return input;
  }

  getTargetAngle(tankX: number, tankY: number): number {
    const dx = this.mousePosition.x - tankX;
    const dy = this.mousePosition.y - tankY;
    return Math.atan2(dy, dx);
  }
}