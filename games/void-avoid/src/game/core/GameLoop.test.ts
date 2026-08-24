import { describe, expect, it } from 'vitest';
import { GameLoop, type GameLoopEnvironment } from './GameLoop';

function createHarness() {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  const callbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let now = 0;
  let hidden = false;
  const environment: GameLoopEnvironment = {
    requestFrame: (callback) => {
      frameId += 1;
      callbacks.set(frameId, callback);
      return frameId;
    },
    cancelFrame: (id) => { callbacks.delete(id); },
    now: () => now,
    windowTarget: windowTarget as GameLoopEnvironment['windowTarget'],
    documentTarget: documentTarget as GameLoopEnvironment['documentTarget'],
    isDocumentHidden: () => hidden,
  };
  return {
    environment,
    windowTarget,
    documentTarget,
    pending: () => callbacks.size,
    advance: (milliseconds: number) => {
      now += milliseconds;
      const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!next) return;
      callbacks.delete(next[0]);
      next[1](now);
    },
    setHidden: (value: boolean) => { hidden = value; },
  };
}

describe('GameLoop', () => {
  it('keeps exactly one pending frame through start and fixed-step updates', () => {
    const harness = createHarness();
    const loop = new GameLoop(harness.environment);
    let updates = 0;
    loop.setCallbacks(() => { updates += 1; }, () => {}, () => {});
    loop.start();
    loop.start();
    expect(harness.pending()).toBe(1);
    harness.advance(17);
    expect(updates).toBe(1);
    expect(harness.pending()).toBe(1);
    loop.cleanup();
    expect(harness.pending()).toBe(0);
  });

  it('composes manual, focus, and visibility pause reasons', () => {
    const harness = createHarness();
    const loop = new GameLoop(harness.environment);
    loop.start();
    loop.pause('manual');
    harness.windowTarget.dispatchEvent(new Event('blur'));
    harness.setHidden(true);
    harness.documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(loop.getDiagnostics().pauseReasons.sort()).toEqual(['focus', 'manual', 'visibility']);

    harness.setHidden(false);
    harness.documentTarget.dispatchEvent(new Event('visibilitychange'));
    harness.windowTarget.dispatchEvent(new Event('focus'));
    expect(loop.isPausedState()).toBe(true);
    expect(loop.getDiagnostics().pauseReasons).toEqual(['manual']);
    loop.resume('manual');
    expect(loop.isPausedState()).toBe(false);
    expect(harness.pending()).toBe(1);
    loop.cleanup();
  });

  it('stops and cleans up idempotently even while paused', () => {
    const harness = createHarness();
    const loop = new GameLoop(harness.environment);
    loop.start();
    loop.pause('manual');
    loop.cleanup();
    loop.cleanup();
    expect(loop.getDiagnostics()).toMatchObject({ started: false, paused: false, framePending: false });
  });
});
