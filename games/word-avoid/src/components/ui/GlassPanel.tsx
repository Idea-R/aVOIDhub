import React from 'react';
import { motion } from 'framer-motion';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glow' | 'border';
  animate?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  animate = true 
}) => {
  const baseClasses = 'glass-panel';
  
  const variantClasses = {
    default: '',
    glow: 'shadow-lg shadow-avoid-primary/20',
    border: 'border-avoid-primary/30'
  };

  const Component = animate ? motion.div : 'div';
  
  const animationProps = animate ? {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' }
  } : {};

  return (
    <Component
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...animationProps}
    >
      {children}
    </Component>
  );
};