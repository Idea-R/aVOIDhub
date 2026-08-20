import { describe, expect, it, vi } from "vitest";
import { GameStateManager } from "./GameState";

describe("GameStateManager", () => {
  it("clamps lethal damage and marks the run over in the same update", () => {
    const state = new GameStateManager();

    state.updateHealth(125);

    expect(state.getState()).toMatchObject({ health: 0, isGameOver: true });
  });

  it("does not advance time after game over", () => {
    const state = new GameStateManager();
    state.updateGameTime(1000);
    state.updateHealth(100);
    state.updateGameTime(1000);

    expect(state.getState().gameTime).toBe(1);
  });

  it("cleans up subscribers and restores a fresh run on reset", () => {
    const state = new GameStateManager();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.updateScore(50);
    unsubscribe();
    state.updateScore(25);
    state.reset();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.getState()).toMatchObject({
      score: 0,
      wave: 1,
      health: 100,
      isGameOver: false,
      isPaused: false,
    });
  });

  it("presents the clock at a bounded rate without slowing simulation time", () => {
    const state = new GameStateManager();
    const listener = vi.fn();
    state.subscribe(listener);

    for (let frame = 0; frame < 60; frame += 1) {
      state.updateGameTime(1000 / 60);
    }

    expect(state.getState().gameTime).toBeCloseTo(1, 5);
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
