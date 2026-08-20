import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type InputSnapshot,
  type ViewportLayout,
} from "./types";
import { mapClientPointToWorld } from "./Viewport";

type PauseIntent = "manual" | "focus";

export class InputController {
  private readonly keys = new Set<string>();
  private aim = { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT * 0.5 };
  private queuedFirePulls = 0;
  private attached = false;
  private enabled = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getLayout: () => ViewportLayout,
    private readonly onPauseIntent: (intent: PauseIntent) => void,
    private readonly windowTarget: Window = window,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.windowTarget.addEventListener("keydown", this.onKeyDown);
    this.windowTarget.addEventListener("keyup", this.onKeyUp);
    this.windowTarget.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.attached = true;
  }

  destroy(): void {
    if (!this.attached) return;
    this.windowTarget.removeEventListener("keydown", this.onKeyDown);
    this.windowTarget.removeEventListener("keyup", this.onKeyUp);
    this.windowTarget.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.attached = false;
    this.reset();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  snapshot(): InputSnapshot {
    const forward = this.isDown("w", "arrowup") ? 1 : 0;
    const reverse = this.isDown("s", "arrowdown") ? 1 : 0;
    const right = this.isDown("d", "arrowright") ? 1 : 0;
    const left = this.isDown("a", "arrowleft") ? 1 : 0;
    const snapshot = {
      throttle: forward - reverse,
      turn: right - left,
      aim: { ...this.aim },
      fire: this.queuedFirePulls > 0,
    };
    this.queuedFirePulls = Math.max(0, this.queuedFirePulls - 1);
    return snapshot;
  }

  listenerCount(): number {
    return this.attached ? 8 : 0;
  }

  private isDown(primary: string, alternate: string): boolean {
    return this.keys.has(primary) || this.keys.has(alternate);
  }

  private reset(): void {
    this.keys.clear();
    this.queuedFirePulls = 0;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === "escape") {
      if (!event.repeat) this.onPauseIntent("manual");
      return;
    }
    if (
      !this.enabled ||
      ![
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(key)
    )
      return;
    event.preventDefault();
    this.keys.add(key);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!this.keys.has(key)) return;
    event.preventDefault();
    this.keys.delete(key);
  };

  private readonly onBlur = (): void => {
    if (!this.enabled) return;
    this.reset();
    this.onPauseIntent("focus");
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.aim = mapClientPointToWorld(
      event.clientX,
      event.clientY,
      this.canvas.getBoundingClientRect(),
      this.getLayout(),
    );
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.queuedFirePulls = Math.min(4, this.queuedFirePulls + 1);
    this.onPointerMove(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.type !== "pointercancel" && event.button !== 0) return;
    if (this.canvas.hasPointerCapture?.(event.pointerId))
      this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
