import { describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

describe('game store reset', () => {
  it('restores the player and centers the fallback viewport position', () => {
    useGameStore.setState((state) => ({
      player: {
        ...state.player,
        health: 12,
        score: 9001,
        position: { x: 999, y: 777 }
      }
    }));

    useGameStore.getState().resetGame();

    expect(useGameStore.getState().player).toMatchObject({
      health: 100,
      score: 0,
      position: { x: 400, y: 300 }
    });
  });
});
