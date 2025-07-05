import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ParticleEffect } from '../../types/game';

interface ParticleSystemProps {
  className?: string;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ className = '' }) => {
  const [particles, setParticles] = useState<ParticleEffect[]>([]);

  // Create explosion particles
  const createExplosion = (x: number, y: number, wordLength: number = 5, color: string = '#00ff88') => {
    const newParticles: ParticleEffect[] = [];
    
    const particleCount = Math.min(30, wordLength * 5); // More particles for longer words
    
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
    
    setParticles(prev => [...prev, ...newParticles]);
    
    // Remove particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 2500);
  };

  // Create typing trail
  const createTypingTrail = (x: number, y: number) => {
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
    
    setParticles(prev => [...prev, trail]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== trail.id));
    }, 800);
  };

  // Expose particle creation functions globally for other components
  useEffect(() => {
    (window as any).createExplosion = createExplosion;
    (window as any).createTypingTrail = createTypingTrail;
    
    return () => {
      delete (window as any).createExplosion;
      delete (window as any).createTypingTrail;
    };
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
            animate={{
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
              duration: particle.type === 'explosion' ? 1.2 : 0.5,
              ease: 'easeOut'
            }}
          />
        ))}
      </AnimatePresence>
      
      {/* Ambient Particles */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`ambient-${i}`}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: i % 3 === 0 ? '#00ff88' : i % 3 === 1 ? '#0088ff' : '#ff0066',
              opacity: 0.3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }}
            animate={{
              y: [-15, 15, -15],
              opacity: [0.2, 0.6, 0.2],
              scale: [0.5, 1.2, 0.5]
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut'
            }}
          />
        ))}
      </div>
    </div>
  );
};