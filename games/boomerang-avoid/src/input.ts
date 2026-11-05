import type { Input } from "@avoid/boomerangavoid-sim";
export type Control = "keyboard1" | "keyboard2" | `pad${number}` | "bot";
export type Action =
  | "up"
  | "down"
  | "left"
  | "right"
  | "dash"
  | "slash"
  | "throw";
export type Bindings = Record<Action, string>;
export interface Preferences {
  music: number;
  sfx: number;
  reducedMotion: boolean;
  touch: boolean;
  quality: "auto" | "high" | "low";
  bindings: Bindings[];
  gamepadButtons: { dash: number; slash: number; throw: number };
}
export const DEFAULT_BINDINGS: Bindings[] = [
  {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    dash: "Space",
    slash: "KeyJ",
    throw: "KeyK",
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    dash: "Enter",
    slash: "Numpad1",
    throw: "Numpad2",
  },
];
export function loadPreferences(): Preferences {
  const defaults: Preferences = {
    music: 0.28,
    sfx: 0.65,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    touch: matchMedia("(pointer: coarse)").matches,
    quality: "auto",
    bindings: DEFAULT_BINDINGS.map((v) => ({ ...v })),
    gamepadButtons: { dash: 0, slash: 2, throw: 1 },
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("boomerangavoid-settings") || "null",
    );
    if (saved)
      return {
        ...defaults,
        ...saved,
        bindings: [
          { ...DEFAULT_BINDINGS[0], ...saved.bindings?.[0] },
          { ...DEFAULT_BINDINGS[1], ...saved.bindings?.[1] },
        ],
        gamepadButtons: { ...defaults.gamepadButtons, ...saved.gamepadButtons },
      };
  } catch {
    /* local storage may be unavailable */
  }
  return defaults;
}
export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(
      "boomerangavoid-settings",
      JSON.stringify(preferences),
    );
  } catch {
    /* settings still apply for this session */
  }
}
export const keyLabel = (code: string) =>
  code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace("Arrow", "")
    .replace("Numpad", "Num ")
    .replace("Space", "Space");
const neutral = (): Input => ({
  mx: 0,
  my: 0,
  ax: 0,
  ay: 0,
  dash: false,
  slash: false,
  throw: false,
});
export class Inputs {
  keys = new Set<string>();
  touchInput = neutral();
  active = false;
  onPause = () => {};
  onActivity = () => {};
  remap: ((code: string) => void) | null = null;
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private actionPointers = new Map<number, "dash" | "slash" | "throw">();
  private previousPadButtons = new Map<number, boolean[]>();
  private menuRepeatAt = 0;
  private keyPulses = new Set<string>();
  private touchPulses = new Set<"dash" | "slash" | "throw">();
  private padPulses = new Map<number, Set<"dash" | "slash" | "throw">>();
  constructor(public preferences: Preferences) {
    addEventListener("keydown", (event) => {
      if (this.remap) {
        event.preventDefault();
        const fn = this.remap;
        this.remap = null;
        fn(event.code);
        return;
      }
      if (event.code === "Escape" && !event.repeat) {
        this.onPause();
        return;
      }
      if (
        !this.active ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (
        this.preferences.bindings.some((b) =>
          Object.values(b).includes(event.code),
        )
      ) {
        event.preventDefault();
        if (event.repeat && !this.keys.has(event.code)) return;
        this.keys.add(event.code);
        if (!event.repeat) this.keyPulses.add(event.code);
        this.onActivity();
      }
    });
    addEventListener("keyup", (event) => this.keys.delete(event.code));
    addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
    addEventListener("gamepaddisconnected", () => this.clear());
  }
  clear() {
    this.keys.clear();
    this.keyPulses.clear();
    this.touchPulses.clear();
    this.padPulses.clear();
    this.touchInput = neutral();
    this.stickPointer = null;
    this.actionPointers.clear();
    document.querySelector("#stick-thumb")?.setAttribute("style", "");
    document
      .querySelectorAll(".touch-action")
      .forEach((el) => el.classList.remove("pressed"));
  }
  controllers() {
    return Array.from(navigator.getGamepads?.() || [])
      .filter((pad): pad is Gamepad => !!pad)
      .map((pad) => ({ index: pad.index, name: pad.id }));
  }
  pollGamepads(menu: boolean) {
    for (const pad of Array.from(navigator.getGamepads?.() || [])) {
      if (!pad) continue;
      const previous = this.previousPadButtons.get(pad.index) || [];
      const pressed = pad.buttons.map((b) => b.pressed);
      if (this.active) {
        const pulses =
          this.padPulses.get(pad.index) ||
          new Set<"dash" | "slash" | "throw">();
        for (const action of ["dash", "slash", "throw"] as const) {
          const index = this.preferences.gamepadButtons[action];
          if (pressed[index] && !previous[index]) pulses.add(action);
        }
        this.padPulses.set(pad.index, pulses);
      }
      if (pressed[9] && !previous[9]) {
        this.onActivity();
        this.onPause();
      }
      if (menu) {
        const now = performance.now(),
          direction =
            pressed[13] || pad.axes[1] > 0.65
              ? 1
              : pressed[12] || pad.axes[1] < -0.65
                ? -1
                : 0;
        if (direction && now > this.menuRepeatAt) {
          const elements = Array.from(
            document.querySelectorAll<HTMLElement>(
              "#app button:not(:disabled),#app input,#app select,#app a",
            ),
          ).filter((el) => !!el.offsetParent);
          const index = elements.indexOf(document.activeElement as HTMLElement);
          elements[
            (index + direction + elements.length) % elements.length
          ]?.focus();
          this.menuRepeatAt = now + 220;
        }
        if (pressed[0] && !previous[0]) {
          this.onActivity();
          const element = document.activeElement;
          if (
            element instanceof HTMLButtonElement ||
            element instanceof HTMLAnchorElement
          )
            element.click();
          else if (
            element instanceof HTMLInputElement &&
            element.type === "checkbox"
          ) {
            element.click();
          }
        }
      }
      this.previousPadButtons.set(pad.index, pressed);
    }
  }
  read(control: Control): Input {
    const result = neutral();
    if (!this.active) return result;
    if (control.startsWith("keyboard")) {
      const b = this.preferences.bindings[control === "keyboard1" ? 0 : 1];
      result.mx =
        Number(this.keys.has(b.right)) - Number(this.keys.has(b.left));
      result.my = Number(this.keys.has(b.down)) - Number(this.keys.has(b.up));
      result.dash = this.keyPulses.delete(b.dash);
      result.slash = this.keyPulses.delete(b.slash);
      result.throw = this.keyPulses.delete(b.throw);
      if (control === "keyboard1") {
        result.mx += this.touchInput.mx;
        result.my += this.touchInput.my;
        for (const action of ["dash", "slash", "throw"] as const) {
          const touched = this.touchPulses.delete(action);
          result[action] ||= touched;
        }
      }
    } else if (control.startsWith("pad")) {
      const pad = navigator.getGamepads?.()[Number(control.slice(3))];
      if (!pad) return result;
      const axis = (value: number) =>
        Math.abs(value) > 0.18
          ? ((Math.abs(value) - 0.18) / 0.82) * Math.sign(value)
          : 0;
      result.mx = axis(pad.axes[0] || 0);
      result.my = axis(pad.axes[1] || 0);
      result.ax = axis(pad.axes[2] || 0);
      result.ay = axis(pad.axes[3] || 0);
      const pulses = this.padPulses.get(pad.index);
      result.dash = !!pulses?.delete("dash");
      result.slash = !!pulses?.delete("slash");
      result.throw = !!pulses?.delete("throw");
    }
    const length = Math.hypot(result.mx, result.my);
    if (length > 1) {
      result.mx /= length;
      result.my /= length;
    }
    return result;
  }
  bindTouch(root: HTMLElement) {
    const stick = root.querySelector<HTMLElement>("#touch-stick");
    if (!stick) return;
    const thumb = root.querySelector<HTMLElement>("#stick-thumb");
    stick.addEventListener("pointerdown", (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.onActivity();
      this.stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      const r = stick.getBoundingClientRect();
      this.stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      move(event);
    });
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.stickPointer) return;
      const dx = event.clientX - this.stickOrigin.x,
        dy = event.clientY - this.stickOrigin.y;
      const length = Math.hypot(dx, dy),
        radius = 43;
      const amount = Math.min(1, length / radius);
      this.touchInput.mx = length ? (dx / length) * amount : 0;
      this.touchInput.my = length ? (dy / length) * amount : 0;
      if (thumb)
        thumb.style.transform = `translate(${this.touchInput.mx * 33}px,${this.touchInput.my * 33}px)`;
    };
    stick.addEventListener("pointermove", move);
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.touchInput.mx = 0;
      this.touchInput.my = 0;
      if (thumb) thumb.style.transform = "";
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
    stick.addEventListener("lostpointercapture", release);
    root.querySelectorAll<HTMLElement>("[data-touch]").forEach((button) => {
      const action = button.dataset.touch as "dash" | "slash" | "throw";
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.onActivity();
        button.setPointerCapture(event.pointerId);
        this.actionPointers.set(event.pointerId, action);
        this.touchInput[action] = true;
        this.touchPulses.add(action);
        button.classList.add("pressed");
      });
      const releaseAction = (event: PointerEvent) => {
        this.actionPointers.delete(event.pointerId);
        this.touchInput[action] = Array.from(
          this.actionPointers.values(),
        ).includes(action);
        button.classList.toggle("pressed", this.touchInput[action]);
      };
      button.addEventListener("pointerup", releaseAction);
      button.addEventListener("pointercancel", releaseAction);
      button.addEventListener("lostpointercapture", releaseAction);
    });
  }
}
