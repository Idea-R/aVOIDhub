import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ParticleEffect } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import { useMotionPreference } from '../../hooks/useMotionPreference';

interface ParticleSystemProps {
  className?: string;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ className = '' }) => {
  const [particles, setParticles] = useState<ParticleEffect[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const particlesEnabled = useGameStore((state) => state.settings.graphics.particles);
  const shouldReduceMotion = useMotionPreference();
  const ambientParticles = useMemo(() => Array.from({ length: 24 }, (_, index) => ({
    id: index,
    left: (index * 37) % 100,
    top: (index * 61) % 100,
    duration: 4 + (index % 4),
    delay: (index % 5) * 0.35,
  })), []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  }, []);

  // Create explosion particles
  const createExplosion = useCallback((x: number, y: number, wordLength: number = 5, color: string = '#00ff88') => {
    if (!particlesEnabled) return;
    const newParticles: ParticleEffect[] = [];
    
    const particleCount = shouldReduceMotion ? Math.min(4, wordLength) : Math.min(24, wordLength * 4);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const velocity = 100 + Math.random() * 150;
      
      newParticles.push({
        id: `explosion-${Date.now()}-${i}`,
        type: 'explosion',
        position: { x, y },
        velocity: {
          x: Math.cos(angle) * velocity,
          y: Math.sin(angle) * velocity
        },
        color,
        size: 6 + Math.random() * 10,
        life: 1,
        maxLife: 1
      });
    }
    
    setParticles(prev => [...prev.slice(-96), ...newParticles]);
    
    // Remove particles after animation
    schedule(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, shouldReduceMotion ? 250 : 1_500);
  }, [particlesEnabled, schedule, shouldReduceMotion]);

  // Create typing trail
  const createTypingTrail = useCallback((x: number, y: number) => {
    if (!particlesEnabled || shouldReduceMotion) return;
    const trail: ParticleEffect = {
      id: `trail-${Date.now()}`,
      type: 'trail',
      position: { x, y },
      velocity: { x: 0, y: -30 },
      color: '#00ff88',
      size: 12,
      life: 1,
      maxLife: 1
    };
    
    setParticles(prev => [...prev.slice(-96), trail]);
    
    schedule(() => {
      setParticles(prev => prev.filter(p => p.id !== trail.id));
    }, 800);
  }, [particlesEnabled, schedule, shouldReduceMotion]);

  // Expose particle creation functions globally for other components
  useEffect(() => {
    window.createExplosion = createExplosion;
    window.createTypingTrail = createTypingTrail;
    
    return () => {
      delete window.createExplosion;
      delete window.createTypingTrail;
    };
  }, [createExplosion, createTypingTrail]);

  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              backgroundColor: particle.color,
              width: particle.size,
              height: particle.size,
              left: particle.position.x,
              top: particle.position.y,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
            }}
            initial={{
              scale: 1,
              opacity: 1,
              x: 0,
              y: 0
            }}
            animate={shouldReduceMotion ? { opacity: 0 } : {
              scale: particle.type === 'explosion' ? [1, 0.5, 0] : [1, 1.5, 0],
              opacity: [1, 0.8, 0],
              x: particle.velocity.x * (particle.type === 'explosion' ? 1.5 : 1),
              y: particle.velocity.y * (particle.type === 'explosion' ? 1.5 : 1)
            }}
            exit={{
              scale: 0,
              opacity: 0
            }}
            transition={{
              duration: shouldReduceMotion ? 0.1 : particle.type === 'explosion' ? 1.2 : 0.5,
              ease: 'easeOut'
            }}
          />
        ))}
      </AnimatePresence>
      
      {/* Ambient Particles */}
      {particlesEnabled && !shouldReduceMotion && (
      <div className="absolute inset-0" data-motion="decorative">
        {ambientParticles.map((ambient) => (
          <motion.div
            key={`ambient-${ambient.id}`}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ambient.id % 3 === 0 ? '#00ff88' : ambient.id % 3 === 1 ? '#0088ff' : '#ff0066',
              opacity: 0.3,
              left: `${ambient.left}%`,
              top: `${ambient.top}%`
            }}
            animate={{
              y: [-15, 15, -15],
              opacity: [0.2, 0.6, 0.2],
              scale: [0.5, 1.2, 0.5]
            }}
            transition={{
              duration: ambient.duration,
              repeat: Infinity,
              delay: ambient.delay,
              ease: 'easeInOut'
            }}
          />
        ))}
      </div>
      )}
    </div>
  );
};
