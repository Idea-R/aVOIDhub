import { useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export function useMotionPreference(): boolean {
  const systemReducedMotion = useReducedMotion();
  const savedReducedMotion = useGameStore((state) => state.settings.graphics.reducedMotion);
  return Boolean(systemReducedMotion || savedReducedMotion);
}
