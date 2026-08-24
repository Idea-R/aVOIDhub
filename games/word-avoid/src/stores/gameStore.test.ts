import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWordAvoidManifest, createWordAvoidPrompt, validateWordAvoidRun } from '@avoid/wordavoid-contract';

vi.mock('../api/platformRuns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/platformRuns')>();
  return {
    ...actual,
    beginPlatformRun: vi.fn(),
    finishPlatformRun: vi.fn().mockResolvedValue({ status: 'local' }),
  };
});

import { finishPlatformRun } from '../api/platformRuns';
import { useGameStore } from './gameStore';

const manifest = createWordAvoidManifest({
  runId: 'test-run',
  seed: 'wordavoid-test-seed-0001',
  mode: 'classic',
});

describe('game store baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({ viewport: { width: 1280, height: 720 } });
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
      position: { x: 640, y: 360 }
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
        sequence: 0,
        promptId: 'test-target',
        level: 1,
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
        spawnActiveMs: 0,
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
        sequence: 0,
        promptId: 'test-miss',
        level: 1,
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
        spawnActiveMs: 0,
      }],
    }));

    useGameStore.getState().missWord('miss');

    expect(useGameStore.getState().player).toMatchObject({ streak: 0, maxStreak: 7 });
  });

  it('ignores non-contract keys instead of poisoning competitive evidence', () => {
    useGameStore.getState().startGame('classic', manifest);
    useGameStore.getState().typeCharacter(' ');

    expect(useGameStore.getState().player.charactersAttempted).toBe(0);
    expect(useGameStore.getState().runEvents).toEqual([]);
  });

  it('spawns the same competitive prompt and angle from the same run seed', () => {
    useGameStore.getState().setViewport({ width: 800, height: 600 });
    useGameStore.getState().startGame('classic', manifest);
    useGameStore.getState().spawnWord();

    const expected = createWordAvoidPrompt(manifest.seed, 0);
    const first = useGameStore.getState().words[0];
    expect(first).toMatchObject({
      sequence: expected.sequence,
      promptId: expected.promptId,
      text: expected.text,
      difficulty: expected.difficulty,
    });
    expect(first.angle).toBe((expected.angleTurn / 65_536) * 2 * Math.PI);
    expect(useGameStore.getState().runEvents[0]).toMatchObject({
      type: 'spawn',
      sequence: 0,
      promptId: expected.promptId,
    });
  });

  it('records pauses without charging their wall time to active WPM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'));
    useGameStore.getState().startGame('classic', manifest);
    vi.advanceTimersByTime(1_000);
    useGameStore.getState().pauseGame();
    vi.advanceTimersByTime(5_000);
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(1_000);
    useGameStore.setState((state) => ({
      player: { ...state.player, charactersCorrect: 10, charactersAttempted: 10 },
    }));
    useGameStore.getState().updateStats();

    expect(useGameStore.getState().runEvents).toEqual([
      { type: 'pause', atMs: 1_000 },
      { type: 'resume', atMs: 6_000 },
    ]);
    expect(useGameStore.getState().player.wpm).toBe(60);
    vi.useRealTimers();
  });

  it('keeps manual and focus pauses independent and records only outer transitions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'));
    useGameStore.getState().startGame('classic', manifest);
    vi.advanceTimersByTime(1_000);
    useGameStore.getState().pauseGame('manual');
    vi.advanceTimersByTime(500);
    useGameStore.getState().pauseGame('focus');
    useGameStore.getState().resumeGame('focus');

    expect(useGameStore.getState()).toMatchObject({
      isPaused: true,
      pauseReasons: ['manual'],
    });

    vi.advanceTimersByTime(500);
    useGameStore.getState().resumeGame('manual');
    expect(useGameStore.getState()).toMatchObject({
      isPaused: false,
      pauseReasons: [],
      totalPausedMs: 1_000,
    });
    expect(useGameStore.getState().runEvents).toEqual([
      { type: 'pause', atMs: 1_000 },
      { type: 'resume', atMs: 2_000 },
    ]);
    vi.useRealTimers();
  });

  it('re-centers live prompts when the owned viewport changes', () => {
    useGameStore.getState().setViewport({ width: 800, height: 600 });
    useGameStore.getState().startGame('classic', manifest);
    useGameStore.getState().spawnWord();
    const before = useGameStore.getState().words[0];

    useGameStore.getState().setViewport({ width: 400, height: 700 });
    const after = useGameStore.getState().words[0];
    expect(useGameStore.getState().player.position).toEqual({ x: 200, y: 350 });
    expect(after.position).toEqual({
      x: 200 + Math.cos(before.angle) * before.distance,
      y: 350 + Math.sin(before.angle) * before.distance,
    });
  });

  it('does not count or submit an abandoned run', async () => {
    useGameStore.getState().startGame('classic', manifest);
    useGameStore.getState().endGame('quit');
    await Promise.resolve();

    expect(useGameStore.getState()).toMatchObject({ terminalReason: 'quit', submissionStatus: 'idle' });
    expect(useGameStore.getState().stats.totalGames).toBe(0);
    expect(finishPlatformRun).not.toHaveBeenCalled();
  });

  it('finishes a health-ending run with evidence the shared validator recomputes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'));
    useGameStore.getState().setViewport({ width: 800, height: 600 });
    useGameStore.getState().startGame('classic', manifest);
    useGameStore.getState().spawnWord();
    const completedPrompt = useGameStore.getState().words[0];
    for (const character of completedPrompt.text) {
      vi.advanceTimersByTime(10);
      useGameStore.getState().typeCharacter(character);
    }
    for (let index = 0; index < 10; index += 1) {
      useGameStore.getState().spawnWord();
      vi.advanceTimersByTime(100);
      useGameStore.getState().missWord(useGameStore.getState().words[0].id);
    }
    await vi.runAllTimersAsync();

    const state = useGameStore.getState();
    const evidence = {
      runId: manifest.runId,
      rulesetVersion: manifest.rulesetVersion,
      dictionaryVersion: manifest.dictionaryVersion,
      dictionaryHash: manifest.dictionaryHash,
      normalizationVersion: manifest.normalizationVersion,
      events: state.runEvents,
    };
    expect(validateWordAvoidRun(manifest, evidence)).toMatchObject({
      ok: true,
      summary: {
        health: 0,
        terminalReason: 'health',
        wordsCompleted: 1,
        wordsMissed: 10,
      },
    });
    expect(finishPlatformRun).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
