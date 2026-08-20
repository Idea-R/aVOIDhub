import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useGameStore } from '../stores/gameStore';

export function useGameFocus(inputRef: RefObject<HTMLInputElement | null>): void {
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isPaused = useGameStore((state) => state.isPaused);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);

  useEffect(() => {
    if (!isPlaying) return;

    const pauseForFocusLoss = () => pauseGame('focus');
    const resumeFromFocusLoss = () => {
      if (document.visibilityState === 'hidden') return;
      resumeGame('focus');
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') pauseForFocusLoss();
      else resumeFromFocusLoss();
    };

    window.addEventListener('blur', pauseForFocusLoss);
    window.addEventListener('focus', resumeFromFocusLoss);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', pauseForFocusLoss);
      window.removeEventListener('focus', resumeFromFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPlaying, pauseGame, resumeGame]);

  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [inputRef, isPaused, isPlaying]);
}
