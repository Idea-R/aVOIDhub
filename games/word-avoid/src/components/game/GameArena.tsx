import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerAvatar } from './PlayerAvatar';
import { IncomingWord } from './IncomingWord';
import { DigitCharacter } from './DigitCharacter';
import { GeometricChallenge } from './GeometricChallenge';
import { ParticleSystem } from './ParticleSystem';
import { useGameStore } from '../../stores/gameStore';
import { useAudioStore } from '../../stores/audioStore';
import { useMotionPreference } from '../../hooks/useMotionPreference';

interface GameArenaProps {
  className?: string;
  onRequestTypingFocus?: () => void;
}

export const GameArena: React.FC<GameArenaProps> = ({ className = '', onRequestTypingFocus }) => {
  const {
    player,
    words,
    digitChars,
    geometricChallenges,
    mode,
    isPlaying,
    isPaused,
    updateWords,
    updateDigitChars,
    updateGeometricChallenges,
    spawnWord,
    spawnDigitChar,
    spawnGeometricChallenge,
    spawnRate,
    level,
    viewport,
    setViewport,
    settings,
  } = useGameStore();
  
  const { updateMusicIntensity } = useAudioStore();
  const lastSpawnTime = useRef(0);
  const animationFrame = useRef<number>();
  const lastTime = useRef(Date.now());
  const arenaRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useMotionPreference();
  const wordCount = words?.length || 0;
  const playerHealth = player?.health || 0;

  useLayoutEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const measure = () => {
      const rect = arena.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(arena);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [setViewport]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || isPaused) return;
    lastTime.current = Date.now();
    if (lastSpawnTime.current === 0) lastSpawnTime.current = lastTime.current;

    const gameLoop = () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime.current;
      lastTime.current = currentTime;

      // Update words
      updateWords(deltaTime);
      
      // Update digit characters for digit assault mode
      if (mode === 'digitAssault') {
        updateDigitChars(deltaTime);
      } else if (mode === 'geometricTyping') {
        updateGeometricChallenges(deltaTime);
      }

      // Spawn new words
      if (currentTime - lastSpawnTime.current > spawnRate) {
        if (mode === 'digitAssault') {
          spawnDigitChar();
        } else if (mode === 'geometricTyping') {
          spawnGeometricChallenge();
        } else {
          spawnWord();
        }
        lastSpawnTime.current = currentTime;
      }

      // Update music intensity based on game state
      const intensity = Math.min(1, wordCount / 10 + (100 - playerHealth) / 100);
      updateMusicIntensity(intensity);

      animationFrame.current = requestAnimationFrame(gameLoop);
    };

    if (isPlaying && !isPaused) {
      animationFrame.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isPlaying, isPaused, updateWords, updateDigitChars, updateGeometricChallenges, spawnWord, spawnDigitChar, spawnGeometricChallenge, spawnRate, wordCount, playerHealth, updateMusicIntensity, mode]);

  useEffect(() => {
    if (!isPlaying) lastSpawnTime.current = 0;
  }, [isPlaying]);

  // Calculate arena center
  const arenaCenter = { x: viewport.width / 2, y: viewport.height / 2 };

  return (
    <div
      ref={arenaRef}
      className={`relative w-full h-full overflow-hidden game-arena ${className}`}
      onClick={onRequestTypingFocus}
      aria-hidden="true"
    >
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="url(#gridGradient)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3"/>
              <stop offset="50%" stopColor="#0088ff" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#ff0066" stopOpacity="0.1"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating Background Shapes */}
      {settings.graphics.backgroundAnimation && (
      <div className="floating-shapes absolute inset-0 overflow-hidden" data-motion="decorative">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="floating-shape absolute border rounded-lg"
            style={{
              width: `${60 + i * 10}px`,
              height: `${60 + i * 10}px`,
              borderColor: i % 3 === 0 ? '#00ff88' : i % 3 === 1 ? '#0088ff' : '#ff0066',
              borderWidth: '2px',
              left: `${20 + (i * 15)}%`,
              top: `${30 + (i % 3) * 20}%`
            }}
            animate={shouldReduceMotion ? undefined : {
              y: [-30, 30, -30],
              rotate: [0, 360],
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: shouldReduceMotion ? 0 : Infinity,
              ease: 'easeInOut',
              delay: i * 0.5
            }}
          />
        ))}
      </div>
      )}

      {/* Level Indicator Rings */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(Math.min(level, 5))].map((_, i) => (
          <motion.div
            key={i}
            className="absolute border-2 rounded-full"
            style={{
              left: arenaCenter.x - (100 + i * 30),
              top: arenaCenter.y - (100 + i * 30),
              width: (200 + i * 60),
              height: (200 + i * 60),
              borderColor: `rgba(0, 255, 136, ${0.1 + i * 0.05})`
            }}
            animate={shouldReduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 20 + i * 5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'linear' }}
          />
        ))}
      </div>

      {/* Center Crosshair */}
      <div 
        className="absolute w-12 h-12 border-2 border-avoid-primary/70 rounded-full"
        style={{
          left: arenaCenter.x - 24,
          top: arenaCenter.y - 24
        }}
      >
        <motion.div 
          className="absolute inset-2 border border-avoid-primary/50 rounded-full"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: shouldReduceMotion ? 0 : Infinity }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-avoid-primary rounded-full"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: shouldReduceMotion ? 0 : Infinity }}
        />
      </div>

      {/* Player Avatar */}
      <div
        className="absolute"
        style={{
          left: arenaCenter.x - 32,
          top: arenaCenter.y - 32
        }}
      >
        <PlayerAvatar 
          player={player} 
          isGameActive={isPlaying && !isPaused}
        />
      </div>

      {/* Incoming Words */}
      <AnimatePresence>
        {mode !== 'digitAssault' && mode !== 'geometricTyping' && words?.map(word => (
          <IncomingWord
            key={word.id}
            word={word}
          />
        ))}
        
        {/* Digit Characters for Digit Assault */}
        {mode === 'digitAssault' && digitChars?.map(char => (
          <DigitCharacter
            key={char.id}
            char={char}
          />
        ))}
        
        {/* Geometric Challenges */}
        {mode === 'geometricTyping' && geometricChallenges?.map(challenge => (
          <GeometricChallenge
            key={challenge.id}
            challenge={challenge}
          />
        ))}
      </AnimatePresence>

      {/* Particle System */}
      <ParticleSystem />

      {/* Danger Zone Indicator */}
      <motion.div
        className="absolute border-2 border-extreme/30 rounded-full pointer-events-none"
        style={{
          left: arenaCenter.x - 75,
          top: arenaCenter.y - 75,
          width: 150,
          height: 150
        }}
        animate={shouldReduceMotion ? {
          opacity: words?.some(w => w.distance < 100) ? 0.35 : 0.1,
          scale: 1,
        } : {
          opacity: words?.some(w => w.distance < 100) ? [0.3, 0.7, 0.3] : 0.1,
          scale: words?.some(w => w.distance < 100) ? [1, 1.05, 1] : 1
        }}
        transition={{
          duration: 0.5,
          repeat: !shouldReduceMotion && words?.some(w => w.distance < 100) ? Infinity : 0
        }}
      />
    </div>
  );
};
