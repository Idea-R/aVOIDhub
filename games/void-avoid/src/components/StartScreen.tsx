interface StartScreenProps {
  onStart: () => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
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

        <p className="void-start__note">
          Guest play is immediate. This repair build keeps results on this device and does not claim a
          platform placement.
        </p>
      </div>
    </section>
  );
}
