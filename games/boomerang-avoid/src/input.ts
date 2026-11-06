import type { Input, CharacterId } from "@avoid/boomerangavoid-sim";
import { PREFERENCE_CHARACTER_IDS } from "@avoid/boomerangavoid-protocol/preferences";
import { connectedPads, padAxes, pressedButtons } from "./gamepad";
import { adjustMenuControl, menuControls } from "./controller-menu";
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
  character: CharacterId;
  touch: boolean;
  quality: "auto" | "high" | "low";
  bindings: Bindings[];
  gamepadButtons: { dash: number; slash: number; throw: number };
  stickDeadzone?:number;
  invertAimY?:boolean;
  haptics?:boolean;
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
export function normalizePreferences(value:unknown,defaults:Preferences):Preferences{
  const saved=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};
  const volume=(value:unknown,fallback:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
  const boolean=(value:unknown,fallback:boolean)=>typeof value==="boolean"?value:fallback;
  const bindings=DEFAULT_BINDINGS.map(base=>({...base}));
  for(let i=0;i<bindings.length;i++)for(const action of Object.keys(bindings[i]) as Action[]){
    const code=saved.bindings?.[i]?.[action];
    if(typeof code!=="string"||!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(code)||code==="Escape")continue;
    const old=bindings[i][action];
    for(const binding of bindings)for(const key of Object.keys(binding) as Action[])if(binding[key]===code)binding[key]=old;
    bindings[i][action]=code;
  }
  const gamepadButtons={...defaults.gamepadButtons};
  for(const action of ["dash","slash","throw"] as const){const n=saved.gamepadButtons?.[action];if(Number.isInteger(n)&&n>=0&&n<=15&&n!==9)gamepadButtons[action]=n;}
  return {music:volume(saved.music,defaults.music),sfx:volume(saved.sfx,defaults.sfx),reducedMotion:boolean(saved.reducedMotion,defaults.reducedMotion),character:PREFERENCE_CHARACTER_IDS.includes(saved.character)?saved.character:defaults.character,touch:boolean(saved.touch,defaults.touch),quality:["auto","high","low"].includes(saved.quality)?saved.quality:defaults.quality,bindings,gamepadButtons,stickDeadzone:typeof saved.stickDeadzone==="number"&&Number.isFinite(saved.stickDeadzone)&&saved.stickDeadzone>=.08&&saved.stickDeadzone<=.35?saved.stickDeadzone:.18,invertAimY:boolean(saved.invertAimY,false),haptics:boolean(saved.haptics,false)};
}
export function loadPreferences(): Preferences {
  const defaults: Preferences = {
    music: 0.28,
    sfx: 0.65,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    character: "pip",
    touch: matchMedia("(pointer: coarse)").matches,
    quality: "auto",
    bindings: DEFAULT_BINDINGS.map((v) => ({ ...v })),
    gamepadButtons: { dash: 0, slash: 2, throw: 1 },
    stickDeadzone:.18,
    invertAimY:false,
    haptics:false,
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("boomerangavoid-settings") || "null",
    );
    return normalizePreferences(saved,defaults);
  } catch {
    /* local storage may be unavailable */
  }
  return defaults;
}
export function savePreferences(preferences: Preferences): boolean {
  try {
    localStorage.setItem(
      "boomerangavoid-settings",
      JSON.stringify(preferences),
    );
    return true;
  } catch {
    /* settings still apply for this session */
    return false;
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
  onMenuBack = () => {};
  onActivity = () => {};
  lastControl:Control="keyboard1";
  remap: ((code: string) => void) | null = null;
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private actionPointers = new Map<number, "dash" | "slash" | "throw">();
  private previousPadButtons = new Map<number, boolean[]>();
  private padIds = new Map<number, string>();
  private blockedPads = new Set<number>();
  private menuRepeatAt = 0;
  private keyPulses = new Set<string>();
  private touchPulses = new Set<"dash" | "slash" | "throw">();
  private padPulses = new Map<number, Set<"dash" | "slash" | "throw">>();
  constructor(public preferences: Preferences) {
    let landscape=globalThis.innerWidth>globalThis.innerHeight;
    addEventListener("resize",()=>{
      const next=globalThis.innerWidth>globalThis.innerHeight;
      if(next!==landscape){landscape=next;this.clear();}
    });
    addEventListener("keydown", (event) => {
      document.body?.classList.remove("using-gamepad");
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
        this.lastControl=this.preferences.bindings[1]&&Object.values(this.preferences.bindings[1]).includes(event.code)?"keyboard2":"keyboard1";
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
    // Returning from blur/pause requires a released pad, including its sticks.
    for (const pad of this.pads()) this.blockedPads.add(pad.index);
    this.touchInput = neutral();
    this.stickPointer = null;
    this.actionPointers.clear();
    document.querySelector("#stick-thumb")?.setAttribute("style", "");
    document
      .querySelectorAll(".touch-action")
      .forEach((el) => el.classList.remove("pressed"));
  }
  controllers() {
    return this.pads()
      .map((pad) => ({ index: pad.index, name: pad.id }));
  }
  private pads() {
    return connectedPads(navigator.getGamepads?.bind(navigator));
  }
  pollGamepads(menu: boolean) {
    const pads = this.pads();
    const present = new Set(pads.map(pad => pad.index));
    for (const index of this.padIds.keys()) if (!present.has(index)) {
      this.padIds.delete(index);
      this.previousPadButtons.delete(index);
      this.padPulses.delete(index);
      this.blockedPads.delete(index);
    }
    for (const pad of pads) {
      if (this.padIds.get(pad.index) !== pad.id) {
        this.padIds.set(pad.index, pad.id);
        this.previousPadButtons.delete(pad.index);
        this.padPulses.delete(pad.index);
        this.blockedPads.add(pad.index);
      }
      const previous = this.previousPadButtons.get(pad.index) || [];
      const pressed = pressedButtons(pad);
      const axes = padAxes(pad,this.preferences.stickDeadzone);
      if (this.blockedPads.has(pad.index)) {
        this.previousPadButtons.set(pad.index, pressed);
        if (!pressed.some(Boolean) && !Object.values(axes).some(Boolean))
          this.blockedPads.delete(pad.index);
        continue;
      }
      if(Object.values(axes).some(value=>Math.abs(value)>.25)||pressed.some((value,i)=>value&&!previous[i]))this.lastControl=`pad${pad.index}`;
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
        if(pressed.some(Boolean)||Math.hypot(axes.mx,axes.my)>.65)document.body?.classList.add("using-gamepad");
        const now = performance.now(),
          direction =
            pressed[13] || axes.my > 0.65
              ? 1
              : pressed[12] || axes.my < -0.65
                ? -1
                : 0;
        const horizontal=pressed[15]||axes.mx>.65?1:pressed[14]||axes.mx<-.65?-1:0;
        if (direction && now > this.menuRepeatAt) {
          const elements = menuControls();
          const index = elements.indexOf(document.activeElement as HTMLElement);
          elements[
            index<0?(direction>0?0:elements.length-1):(index + direction + elements.length) % elements.length
          ]?.focus();
          this.menuRepeatAt = now + 220;
        }else if(horizontal&&now>this.menuRepeatAt){
          adjustMenuControl(horizontal);
          this.menuRepeatAt=now+220;
        }
        if (pressed[0] && !previous[0]) {
          this.onActivity();
          const element = document.activeElement;
          if (element instanceof HTMLElement && (
            element instanceof HTMLButtonElement ||
            element instanceof HTMLAnchorElement ||
            element.tagName==="SUMMARY"
          ))
            element.click();
          else if (
            element instanceof HTMLInputElement &&
            element.type === "checkbox"
          ) {
            element.click();
          }else if(element instanceof HTMLSelectElement){
            adjustMenuControl(1);
          }
        }
        if(pressed[1]&&!previous[1]){this.onActivity();this.onMenuBack();}
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
      const index = Number(control.slice(3));
      const pad = this.pads().find(pad => pad.index === index);
      if (!pad || this.blockedPads.has(index) || this.padIds.get(index) !== pad.id) return result;
      Object.assign(result, padAxes(pad,this.preferences.stickDeadzone));
      if(this.preferences.invertAimY)result.ay=-result.ay;
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
      this.lastControl="keyboard1";
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
