import React from 'react';
import { motion } from 'framer-motion';

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  glowIntensity?: 'low' | 'medium' | 'high';
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  glowIntensity = 'medium'
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-avoid-primary to-avoid-accent text-bg-primary',
    secondary: 'bg-gradient-to-r from-avoid-secondary to-avoid-primary text-white',
    accent: 'bg-gradient-to-r from-avoid-accent to-avoid-primary text-white',
    danger: 'bg-gradient-to-r from-extreme to-avoid-secondary text-white'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const glowIntensities = {
    low: 'shadow-sm shadow-current/20',
    medium: 'shadow-md shadow-current/30',
    high: 'shadow-lg shadow-current/40'
  };

  return (
    <motion.button
      className={`
        neon-button
        ${variants[variant]}
        ${sizes[size]}
        ${glowIntensities[glowIntensity]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.span
        className="relative z-10 font-game-display font-bold"
        initial={false}
        animate={{ 
          textShadow: disabled ? 'none' : '0 0 10px currentColor' 
        }}
      >
        {children}
      </motion.span>
      
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 rounded-lg opacity-50"
        style={{
          background: 'linear-gradient(135deg, var(--avoid-primary), var(--avoid-accent))',
          filter: 'blur(8px)'
        }}
        animate={{
          scale: disabled ? 1 : [1, 1.1, 1],
          opacity: disabled ? 0.3 : [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
    </motion.button>
  );
};