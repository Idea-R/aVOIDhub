import { describe, expect, it } from "vitest";
import { InputController } from "./InputController";
import { computeViewport } from "./Viewport";

function pointerDown(x = 900, y = 360): Event {
  const event = new Event("pointerdown");
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: 1 },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
}

function pointerEvent(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  pointerId: number,
): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: pointerId },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
}

describe("InputController trigger queue", () => {
  it("preserves a complete click until the fixed-step simulation consumes it", () => {
    const canvasTarget = new EventTarget();
    const canvas = Object.assign(canvasTarget, {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1200,
        height: 720,
        right: 1200,
        bottom: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      setPointerCapture: () => undefined,
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
    }) as unknown as HTMLCanvasElement;
    const windowTarget = new EventTarget() as unknown as Window;
    const controller = new InputController(
      canvas,
      () => computeViewport(1200, 720, 1),
      () => undefined,
      windowTarget,
    );
    controller.attach();
    controller.setEnabled(true);

    canvas.dispatchEvent(pointerDown());
    expect(controller.snapshot().fire).toBe(true);
    expect(controller.snapshot().fire).toBe(false);

    canvas.dispatchEvent(pointerDown());
    canvas.dispatchEvent(pointerDown());
    expect(controller.snapshot().fire).toBe(true);
    expect(controller.snapshot().fire).toBe(true);
    expect(controller.snapshot().fire).toBe(false);
    controller.destroy();
  });
});

describe("InputController touch actions", () => {
  it("maps two independent touch pads into drive, aim, and one release shot", () => {
    const canvas = Object.assign(new EventTarget(), {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1200,
        height: 720,
        right: 1200,
        bottom: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      setPointerCapture: () => undefined,
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
    }) as unknown as HTMLCanvasElement;
    const styleValues = new Map<string, string>();
    const touchSurface = Object.assign(new EventTarget(), {
      dataset: { touchStick: "drive" },
      closest: () => touchSurface,
      querySelectorAll: () => [touchSurface],
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      setPointerCapture: () => undefined,
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      style: {
        setProperty: (name: string, value: string) =>
          styleValues.set(name, value),
      },
    }) as unknown as HTMLElement;
    const controller = new InputController(
      canvas,
      () => computeViewport(1200, 720, 1),
      () => undefined,
      new EventTarget() as unknown as Window,
      touchSurface,
      () => ({ x: 300, y: 360 }),
    );
    controller.attach();
    controller.setEnabled(true);
    expect(controller.listenerCount()).toBe(12);

    touchSurface.dispatchEvent(pointerEvent("pointerdown", 100, 0, 11));
    expect(controller.snapshot()).toMatchObject({ throttle: 1, turn: 0 });
    touchSurface.dispatchEvent(pointerEvent("pointerup", 100, 0, 11));
    expect(controller.snapshot()).toMatchObject({ throttle: 0, turn: 0 });

    touchSurface.dataset.touchStick = "aim";
    touchSurface.dispatchEvent(pointerEvent("pointerdown", 200, 100, 22));
    const aimed = controller.snapshot();
    expect(aimed.aim.x).toBeCloseTo(1300);
    expect(aimed.aim.y).toBeCloseTo(360);
    expect(aimed.fire).toBe(false);
    touchSurface.dispatchEvent(pointerEvent("pointerup", 200, 100, 22));
    expect(controller.snapshot().fire).toBe(true);
    expect(controller.snapshot().fire).toBe(false);
    expect(styleValues.get("--stick-x")).toBe("0%");

    controller.destroy();
    expect(controller.listenerCount()).toBe(0);
  });

  it("clears an armed touch shot when input is disabled", () => {
    const canvas = Object.assign(new EventTarget(), {
      addEventListener: EventTarget.prototype.addEventListener,
      removeEventListener: EventTarget.prototype.removeEventListener,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1200,
        height: 720,
      }),
    }) as unknown as HTMLCanvasElement;
    const touchSurface = Object.assign(new EventTarget(), {
      dataset: { touchStick: "aim" },
      closest: () => touchSurface,
      querySelectorAll: () => [touchSurface],
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
      }),
      setPointerCapture: () => undefined,
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      style: { setProperty: () => undefined },
    }) as unknown as HTMLElement;
    const controller = new InputController(
      canvas,
      () => computeViewport(1200, 720, 1),
      () => undefined,
      new EventTarget() as unknown as Window,
      touchSurface,
      () => ({ x: 300, y: 360 }),
    );
    controller.attach();
    controller.setEnabled(true);
    touchSurface.dispatchEvent(pointerEvent("pointerdown", 200, 100, 3));
    controller.setEnabled(false);
    touchSurface.dispatchEvent(pointerEvent("pointerup", 200, 100, 3));
    expect(controller.snapshot().fire).toBe(false);
    controller.destroy();
  });
});
