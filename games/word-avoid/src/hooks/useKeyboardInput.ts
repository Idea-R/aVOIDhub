import { useCallback, useEffect, useRef } from 'react';
import type { ClipboardEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { normalizeWordAvoidInput } from '@avoid/wordavoid-contract';
import { useGameStore } from '../stores/gameStore';
import { useAudioStore } from '../stores/audioStore';

type KeyboardEventLike = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'repeat' | 'shiftKey'>;

export function isCompetitiveKeyboardEvent(event: KeyboardEventLike): boolean {
  return event.key.length === 1
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.isComposing
    && !event.repeat
    && Boolean(normalizeWordAvoidInput(event.key));
}

export function competitiveInputCharacter(data: string | null, value: string, isComposing: boolean): string | null {
  if (isComposing) return null;
  const candidate = data ?? value;
  if (candidate.length !== 1) return null;
  return normalizeWordAvoidInput(candidate);
}

export const useKeyboardInput = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const compositionRef = useRef(false);
  const {
    isPlaying,
    isPaused,
    pauseReasons,
    typeCharacter,
    pauseGame,
    resumeGame,
  } = useGameStore();
  const playKeyPress = useAudioStore((state) => state.playKeyPress);

  const submitCharacter = useCallback((character: string) => {
    const normalized = normalizeWordAvoidInput(character);
    if (!normalized || !isPlaying || isPaused) return;
    playKeyPress(normalized);
    typeCharacter(normalized);
  }, [isPaused, isPlaying, playKeyPress, typeCharacter]);

  const toggleManualPause = useCallback(() => {
    if (!isPlaying) return;
    if (pauseReasons.includes('manual')) resumeGame('manual');
    else pauseGame('manual');
  }, [isPlaying, pauseGame, pauseReasons, resumeGame]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      toggleManualPause();
      return;
    }
    if (!isCompetitiveKeyboardEvent(event.nativeEvent) || !isPlaying || isPaused) return;
    event.preventDefault();
    submitCharacter(event.key);
  }, [isPaused, isPlaying, submitCharacter, toggleManualPause]);

  const handleInput = useCallback((event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const nativeEvent = event.nativeEvent as InputEvent;
    const inserted = competitiveInputCharacter(nativeEvent.data, input.value, compositionRef.current || nativeEvent.isComposing);
    input.value = '';
    if (!inserted) return;
    submitCharacter(inserted);
  }, [submitCharacter]);

  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape' || !isPlaying) return;
      event.preventDefault();
      toggleManualPause();
    };
    window.addEventListener('keydown', handleGlobalEscape);
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [isPlaying, toggleManualPause]);

  useEffect(() => {
    if (!isPlaying || isPaused) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [isPaused, isPlaying]);

  return {
    inputRef,
    isListening: isPlaying && !isPaused,
    handleKeyDown,
    handleInput,
    handleCompositionStart: () => {
      compositionRef.current = true;
    },
    handleCompositionEnd: (event: FormEvent<HTMLInputElement>) => {
      compositionRef.current = false;
      event.currentTarget.value = '';
    },
    handlePaste: (event: ClipboardEvent<HTMLInputElement>) => event.preventDefault(),
    focusInput: () => inputRef.current?.focus({ preventScroll: true }),
  };
};
