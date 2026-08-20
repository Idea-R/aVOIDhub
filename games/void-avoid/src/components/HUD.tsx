interface HUDProps {
  score: number;
  time: number;
  powerUpCharges: number;
  maxPowerUpCharges: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onShowHelp: () => void;
  onExit: () => void;
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes.toString().padStart(2, '0')}:${(safeSeconds % 60).toString().padStart(2, '0')}`;
}

export default function HUD({
  score,
  time,
  powerUpCharges,
  maxPowerUpCharges,
  isPaused,
  onTogglePause,
  onShowHelp,
  onExit,
}: HUDProps) {
  return (
    <div className="void-hud" aria-label="Game status and controls">
      <div className="void-hud__score" aria-live="polite">
        <span>Score</span>
        <strong>{score.toLocaleString()}</strong>
      </div>

      <div className="void-hud__status">
        <div>
          <span>Time</span>
          <strong>{formatTime(time)}</strong>
        </div>
        <div>
          <span>Pulse</span>
          <strong>
            {powerUpCharges}/{maxPowerUpCharges}
          </strong>
        </div>
      </div>

      <div className="void-hud__controls">
        <button type="button" onClick={onTogglePause} aria-label={isPaused ? 'Resume game' : 'Pause game'}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={onShowHelp}>
          Controls
        </button>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
