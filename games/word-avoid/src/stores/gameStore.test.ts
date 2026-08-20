import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/platformRuns', () => ({
  beginPlatformRun: vi.fn(),
  finishPlatformRun: vi.fn().mockResolvedValue(false),
}));

import { useGameStore } from './gameStore';

describe('game store baseline', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

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
      maxStreak: 0,
      charactersAttempted: 0,
      charactersCorrect: 0,
      position: { x: 400, y: 300 }
    });
  });

  it('starts only Time Attack with a two-minute clock', () => {
    useGameStore.getState().startGame('classic');
    expect(useGameStore.getState().timeRemaining).toBeUndefined();

    useGameStore.getState().startGame('timeAttack');
    expect(useGameStore.getState().timeRemaining).toBe(120_000);
  });

  it('records a wrong active-play key as zero-percent accuracy', () => {
    useGameStore.setState((state) => ({
      isPlaying: true,
      isPaused: false,
      startTime: Date.now() - 1_000,
      words: [{
        id: 'target',
        text: 'a',
        difficulty: 'easy',
        category: 'test',
        position: { x: 100, y: 100 },
        angle: 0,
        speed: 1,
        distance: 100,
        maxDistance: 100,
        isActive: true,
        isTyping: true,
        typedChars: 0,
        spawnTime: Date.now(),
      }],
      player: { ...state.player },
    }));

    useGameStore.getState().typeCharacter('z');

    expect(useGameStore.getState().player).toMatchObject({
      charactersAttempted: 1,
      charactersCorrect: 0,
      accuracy: 0,
    });
  });

  it('keeps the maximum streak after a miss resets the active streak', () => {
    useGameStore.setState((state) => ({
      isPlaying: true,
      player: { ...state.player, streak: 7, maxStreak: 7 },
      words: [{
        id: 'miss',
        text: 'meteor',
        difficulty: 'easy',
        category: 'test',
        position: { x: 100, y: 100 },
        angle: 0,
        speed: 1,
        distance: 50,
        maxDistance: 100,
        isActive: true,
        isTyping: false,
        typedChars: 0,
        spawnTime: Date.now(),
      }],
    }));

    useGameStore.getState().missWord('miss');

    expect(useGameStore.getState().player).toMatchObject({ streak: 0, maxStreak: 7 });
  });
});
