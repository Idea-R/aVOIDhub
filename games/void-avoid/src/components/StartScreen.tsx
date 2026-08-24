import type { SoundStatus } from '../game/presentation/SoundManager';
import type { MotionPreference } from '../game/presentation/preferences';

interface StartScreenProps {
  onStart: () => void;
  soundEnabled: boolean;
  soundStatus: SoundStatus;
  reducedMotion: boolean;
  motionPreference: MotionPreference;
  onToggleSound: () => void;
  onToggleMotion: () => void;
}

export default function StartScreen({
  onStart,
  soundEnabled,
  soundStatus,
  reducedMotion,
  motionPreference,
  onToggleSound,
  onToggleMotion,
}: StartScreenProps) {
  return (
    <section className="void-start" aria-labelledby="void-title">
      <div className="void-start__orbit" aria-hidden="true" />
      <div className="void-start__content">
        <p className="void-kicker">The original aVOID experiment</p>
        <h1 id="void-title" className="void-title">
          <span>a</span>VOID
        </h1>
        <p className="void-start__lede">
          Steer the signal through a meteor storm. Survive longer, break clustered threats with knockback,
          and collect enough fragments to clear the field.
        </p>

        <div className="void-start__rules" aria-label="Controls">
          <div>
            <strong>Move</strong>
            <span>Pointer or one-finger drag</span>
          </div>
          <div>
            <strong>Knockback</strong>
            <span>Double-click or double-tap</span>
          </div>
          <div>
            <strong>Pause</strong>
            <span>Escape or the pause control</span>
          </div>
        </div>

        <button type="button" className="void-launch" onClick={onStart} autoFocus>
          <span>Enter the field</span>
          <span aria-hidden="true">↗</span>
        </button>

        <div className="void-start__preferences" role="group" aria-label="Play preferences">
          <button type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>
            <span>Sound</span>
            <strong>{soundStatus === 'unavailable' ? 'Retry' : soundEnabled ? 'On' : 'Off'}</strong>
          </button>
          <button type="button" aria-pressed={motionPreference === 'reduced'} onClick={onToggleMotion}>
            <span>Motion</span>
            <strong>{reducedMotion ? 'Reduced' : 'System'}</strong>
          </button>
        </div>

        <p className="void-start__note">
          Guest play is immediate. Sound is made locally after you enter the field—there is no track to
          download. Results stay on this device and do not claim a platform placement.
        </p>
        {soundStatus === 'unavailable' && (
          <p className="void-start__notice" role="status">
            This browser did not start audio. The game still works; use Retry when you want another attempt.
          </p>
        )}
      </div>
    </section>
  );
}
