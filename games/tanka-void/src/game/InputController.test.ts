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
