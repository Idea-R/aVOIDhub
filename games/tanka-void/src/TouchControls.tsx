interface TouchControlsProps {
  visible: boolean;
}

export function TouchControls({ visible }: TouchControlsProps) {
  if (!visible) return null;

  return (
    <section
      className="tank-touch-controls"
      aria-label="Touch controls"
      aria-describedby="touch-control-help"
    >
      <p id="touch-control-help" className="tank-status">
        Drag the left control to drive and steer. Drag the right control to aim,
        then release it to fire one shell.
      </p>
      <div
        className="tank-touch-stick tank-touch-stick--drive"
        data-touch-stick="drive"
        role="group"
        aria-label="Drive and steer control"
      >
        <span>DRIVE</span>
        <i aria-hidden="true" />
        <small>drag</small>
      </div>
      <div
        className="tank-touch-stick tank-touch-stick--aim"
        data-touch-stick="aim"
        role="group"
        aria-label="Aim and release to fire control"
      >
        <span>AIM</span>
        <i aria-hidden="true" />
        <small>release / fire</small>
      </div>
    </section>
  );
}
