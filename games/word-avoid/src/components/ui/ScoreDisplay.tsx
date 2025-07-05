import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';

interface ScoreDisplayProps {
  score: number;
  streak: number;
  wpm: number;
  accuracy: number;
  className?: string;
}

interface ScorePopup {
  id: string;
  points: number;
  position: { x: number; y: number };
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  streak,
  wpm,
  accuracy,
  className = ''
}) => {
  const [previousScore, setPreviousScore] = useState(score);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);

  useEffect(() => {
    if (score > previousScore) {
      const points = score - previousScore;
      const popup: ScorePopup = {
        id: `popup-${Date.now()}`,
        points,
        position: { x: Math.random() * 100, y: Math.random() * 50 }
      };
      
      setScorePopups(prev => [...prev, popup]);
      
      // Remove popup after animation
      setTimeout(() => {
        setScorePopups(prev => prev.filter(p => p.id !== popup.id));
      }, 1000);
    }
    setPreviousScore(score);
  }, [score, previousScore]);

  const formatScore = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Score Display */}
      <div className="glass-panel p-6 border-2 border-avoid-primary/30">
        <div className="flex items-center justify-between space-x-6">
          {/* Score */}
          <div className="flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Trophy className="w-6 h-6 text-score" />
            </motion.div>
            <div>
              <div className="text-xs text-text-secondary font-game-ui">Score</div>
              <motion.div
                key={score}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.2 }}
                className="text-2xl font-game-display font-bold text-score neon-text"
              >
                {formatScore(score)}
              </motion.div>
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center space-x-2">
            <motion.div
              animate={streak > 5 ? { 
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0]
              } : {}}
              transition={{ duration: 0.5, repeat: streak > 5 ? Infinity : 0 }}
            >
              <Zap className={`w-6 h-6 ${streak > 0 ? 'text-avoid-primary' : 'text-text-muted'}`} />
            </motion.div>
            <div>
              <div className="text-xs text-text-secondary font-game-ui">Streak</div>
              <motion.div
                key={streak}
                animate={streak > 5 ? { 
                  scale: [1, 1.2, 1],
                  textShadow: ['0 0 5px currentColor', '0 0 15px currentColor', '0 0 5px currentColor']
                } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-xl font-game-display font-bold ${
                  streak > 10 ? 'text-avoid-primary' : 
                  streak > 5 ? 'text-medium' : 
                  'text-text-primary'
                }`}
              >
                {streak}
              </motion.div>
            </div>
          </div>

          {/* WPM */}
          <div>
            <div className="text-xs text-text-secondary font-game-ui">WPM</div>
            <div className="text-xl font-game-mono font-bold text-text-primary">
              {wpm}
            </div>
          </div>

          {/* Accuracy */}
          <div>
            <div className="text-xs text-text-secondary font-game-ui">Accuracy</div>
            <div className={`text-xl font-game-mono font-bold ${
              accuracy >= 95 ? 'text-health-high' :
              accuracy >= 85 ? 'text-medium' :
              'text-extreme'
            }`}>
              {accuracy}%
            </div>
          </div>
        </div>
      </div>

      {/* Score Popups */}
      <AnimatePresence>
        {scorePopups.map(popup => (
          <motion.div
            key={popup.id}
            initial={{ 
              opacity: 1, 
              scale: 1,
              x: popup.position.x,
              y: popup.position.y
            }}
            animate={{ 
              opacity: 0, 
              scale: 1.5,
              y: popup.position.y - 50
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute pointer-events-none z-50"
            style={{
              left: `${popup.position.x}%`,
              top: `${popup.position.y}%`
            }}
          >
            <div className="bg-score/90 text-white px-4 py-2 rounded-full text-lg font-game-display font-bold border-2 border-score shadow-lg shadow-score/50">
              +{formatScore(popup.points)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};