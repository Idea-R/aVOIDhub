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
  private touchThrottle = 0;
  private touchTurn = 0;
  private drivePointerId: number | null = null;
  private aimPointerId: number | null = null;
  private aimTouchArmed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getLayout: () => ViewportLayout,
    private readonly onPauseIntent: (intent: PauseIntent) => void,
    private readonly windowTarget: Window = window,
    private readonly touchSurface?: HTMLElement,
    private readonly getPlayerPosition: () => {
      x: number;
      y: number;
    } = () => ({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    }),
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
    this.touchSurface?.addEventListener("pointerdown", this.onTouchPointerDown);
    this.touchSurface?.addEventListener("pointermove", this.onTouchPointerMove);
    this.touchSurface?.addEventListener("pointerup", this.onTouchPointerUp);
    this.touchSurface?.addEventListener("pointercancel", this.onTouchPointerUp);
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
    this.touchSurface?.removeEventListener(
      "pointerdown",
      this.onTouchPointerDown,
    );
    this.touchSurface?.removeEventListener(
      "pointermove",
      this.onTouchPointerMove,
    );
    this.touchSurface?.removeEventListener("pointerup", this.onTouchPointerUp);
    this.touchSurface?.removeEventListener(
      "pointercancel",
      this.onTouchPointerUp,
    );
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
      throttle: clamp(forward - reverse + this.touchThrottle, -1, 1),
      turn: clamp(right - left + this.touchTurn, -1, 1),
      aim: { ...this.aim },
      fire: this.queuedFirePulls > 0,
    };
    this.queuedFirePulls = Math.max(0, this.queuedFirePulls - 1);
    return snapshot;
  }

  listenerCount(): number {
    return this.attached ? 8 + (this.touchSurface ? 4 : 0) : 0;
  }

  private isDown(primary: string, alternate: string): boolean {
    return this.keys.has(primary) || this.keys.has(alternate);
  }

  private reset(): void {
    this.keys.clear();
    this.queuedFirePulls = 0;
    this.touchThrottle = 0;
    this.touchTurn = 0;
    this.drivePointerId = null;
    this.aimPointerId = null;
    this.aimTouchArmed = false;
    for (const pad of this.touchSurface?.querySelectorAll<HTMLElement>(
      "[data-touch-stick]",
    ) ?? [])
      this.resetTouchPad(pad);
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

  private touchPad(event: PointerEvent): HTMLElement | null {
    const target = event.target as
      | (EventTarget & { closest?: (selector: string) => Element | null })
      | null;
    return (
      (target?.closest?.("[data-touch-stick]") as HTMLElement | null) ?? null
    );
  }

  private updateTouchVector(event: PointerEvent, pad: HTMLElement): number {
    const rect = pad.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const x = clamp(
      (event.clientX - (rect.left + rect.width / 2)) / radius,
      -1,
      1,
    );
    const y = clamp(
      (event.clientY - (rect.top + rect.height / 2)) / radius,
      -1,
      1,
    );
    const magnitude = Math.min(1, Math.hypot(x, y));
    pad.style.setProperty("--stick-x", `${x * 34}%`);
    pad.style.setProperty("--stick-y", `${y * 34}%`);
    if (pad.dataset.touchStick === "drive") {
      this.touchTurn = Math.abs(x) < 0.12 ? 0 : x;
      this.touchThrottle = Math.abs(y) < 0.12 ? 0 : -y;
    } else if (magnitude >= 0.18) {
      const player = this.getPlayerPosition();
      this.aim = {
        x: player.x + (x / magnitude) * 1000,
        y: player.y + (y / magnitude) * 1000,
      };
      this.aimTouchArmed = true;
    }
    return magnitude;
  }

  private readonly onTouchPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    const pad = this.touchPad(event);
    if (!pad) return;
    event.preventDefault();
    const kind = pad.dataset.touchStick;
    if (kind === "drive" && this.drivePointerId === null)
      this.drivePointerId = event.pointerId;
    else if (kind === "aim" && this.aimPointerId === null) {
      this.aimPointerId = event.pointerId;
      this.aimTouchArmed = false;
    } else return;
    pad.setPointerCapture?.(event.pointerId);
    this.updateTouchVector(event, pad);
  };

  private readonly onTouchPointerMove = (event: PointerEvent): void => {
    if (!this.enabled) return;
    const pad = this.touchPad(event);
    if (!pad) return;
    if (
      event.pointerId !== this.drivePointerId &&
      event.pointerId !== this.aimPointerId
    )
      return;
    event.preventDefault();
    this.updateTouchVector(event, pad);
  };

  private readonly onTouchPointerUp = (event: PointerEvent): void => {
    const pad = this.touchPad(event);
    if (!pad) return;
    if (event.pointerId === this.drivePointerId) {
      this.drivePointerId = null;
      this.touchThrottle = 0;
      this.touchTurn = 0;
      this.resetTouchPad(pad);
    }
    if (event.pointerId === this.aimPointerId) {
      this.aimPointerId = null;
      if (this.enabled && this.aimTouchArmed)
        this.queuedFirePulls = Math.min(4, this.queuedFirePulls + 1);
      this.aimTouchArmed = false;
      this.resetTouchPad(pad);
    }
    if (pad.hasPointerCapture?.(event.pointerId))
      pad.releasePointerCapture?.(event.pointerId);
  };

  private resetTouchPad(pad: HTMLElement): void {
    pad.style.setProperty("--stick-x", "0%");
    pad.style.setProperty("--stick-y", "0%");
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
