import { useEffect, useRef, useState } from 'react';
import type { ComboInfo, ScoreBreakdown } from '../game/systems/ScoreSystem';
import type { RunEvidenceSummary } from '../game/run/runEvidence';

interface GameOverScreenProps {
  score: number;
  localBest: number;
  scoreBreakdown: ScoreBreakdown;
  comboInfo: ComboInfo;
  run: RunEvidenceSummary;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function GameOverScreen({
  score,
  localBest,
  scoreBreakdown,
  comboInfo,
  run,
  onPlayAgain,
  onExit,
}: GameOverScreenProps) {
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    playAgainRef.current?.focus({ preventScroll: true });
  }, []);

  const copyResult = async () => {
    const result = `I scored ${score.toLocaleString()} in VOIDaVOID. Local run ${run.code}.`;
    try {
      await navigator.clipboard.writeText(`${result} ${window.location.href}`);
      setCopyStatus('Result copied.');
    } catch {
      setCopyStatus('Copy is unavailable in this browser.');
    }
  };

  return (
    <div className="void-dialog-backdrop">
      <section className="void-result" role="dialog" aria-modal="true" aria-labelledby="void-result-title">
        <p className="void-kicker">Signal lost</p>
        <h2 id="void-result-title">The field got you.</h2>
        <div className="void-result__total">
          <span>Final score</span>
          <strong>{score.toLocaleString()}</strong>
          <small>Local best {localBest.toLocaleString()}</small>
        </div>

        <dl className="void-result__breakdown">
          <div>
            <dt>Survival</dt>
            <dd>{scoreBreakdown.survival.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Meteors</dt>
            <dd>{scoreBreakdown.meteors.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Combos</dt>
            <dd>{scoreBreakdown.combos.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Best chain</dt>
            <dd>{comboInfo.highestCombo.toLocaleString()}</dd>
          </div>
        </dl>

        <p className="void-result__truth" data-run-status={run.status}>
          {run.status === 'replayable-local'
            ? <>Local run <strong>{run.code}</strong> replayed its score evidence cleanly. It is still unranked.</>
            : <>Local run evidence did not pass its replay check. No placement was claimed.</>}
        </p>

        <div className="void-result__actions">
          <button ref={playAgainRef} type="button" className="void-launch" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" onClick={copyResult}>
            Copy result
          </button>
          <button type="button" onClick={onExit}>
            Main menu
          </button>
        </div>
        <p className="void-result__copy" role="status">
          {copyStatus}
        </p>
      </section>
    </div>
  );
}
