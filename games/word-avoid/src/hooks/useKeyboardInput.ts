import { useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioStore } from '../stores/audioStore';

export const useKeyboardInput = () => {
  const { 
    isPlaying, 
    isPaused, 
    typeCharacter, 
    pauseGame, 
    resumeGame 
  } = useGameStore();
  
  const { playKeyPress } = useAudioStore();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Prevent default browser behavior for game keys
    if (isPlaying && !isPaused) {
      event.preventDefault();
    }

    // Handle pause/resume
    if (event.key === 'Escape') {
      if (isPlaying) {
        if (isPaused) {
          resumeGame();
        } else {
          pauseGame();
        }
      }
      return;
    }

    // Only process typing when game is active
    if (!isPlaying || isPaused) return;

    // Handle letter input
    if (event.key.length === 1) {
      playKeyPress(event.key);
      typeCharacter(event.key);
    }
  }, [isPlaying, isPaused, typeCharacter, pauseGame, resumeGame, playKeyPress]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return {
    isListening: isPlaying && !isPaused
  };
};