import { useEffect, useRef, useState } from 'react';
import type { ComboInfo, ScoreBreakdown } from '../game/systems/ScoreSystem';
import type { RunEvidenceSummary } from '../game/run/runEvidence';
import GameDialog from './GameDialog';
import type { FinishRunResult } from '../api/platformRuns';

interface GameOverScreenProps {
  score: number;
  localBest: number;
  scoreBreakdown: ScoreBreakdown;
  comboInfo: ComboInfo;
  run: RunEvidenceSummary;
  finishResult: FinishRunResult | null;
  onPlayAgain: () => void | Promise<void>;
  onExit: () => void;
}

export default function GameOverScreen({
  score,
  localBest,
  scoreBreakdown,
  comboInfo,
  run,
  finishResult,
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
    <GameDialog labelledBy="void-result-title" describedBy="void-result-truth" className="void-result">
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

        <p id="void-result-truth" className="void-result__truth" data-run-status={run.status}>
          {run.status !== 'replayable-local'
            ? <>Run evidence did not pass its replay check. No placement was claimed.</>
            : finishResult?.status === 'saved'
              ? <>Run <strong>{run.code}</strong> was replayed by the platform and placed provisionally.</>
              : finishResult?.status === 'rejected'
                ? <>The platform rejected run <strong>{run.code}</strong>. No placement was claimed.</>
                : finishResult?.status === 'error'
                  ? <>Run <strong>{run.code}</strong> is safe locally, but the platform could not save it yet.</>
                  : finishResult?.status === 'local'
                    ? <>Local run <strong>{run.code}</strong> replayed cleanly. Sign in on aVOIDgame.io to place future runs.</>
                    : <>Run <strong>{run.code}</strong> replayed locally. Checking your platform placement.</>}
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
          {finishResult?.status === 'saved' && finishResult.receiptUrl && (
            <a href={finishResult.receiptUrl}>View receipt</a>
          )}
          <a href="/leaderboards/?game=voidavoid">Leaderboard</a>
        </div>
        <p className="void-result__copy" role="status">
          {copyStatus}
        </p>
    </GameDialog>
  );
}
