import { useEffect, useMemo, useRef, useState } from "react";
import { GameRuntime } from "./game/GameRuntime";
import { createRunSeed } from "./game/random";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type RunSnapshot,
  type RuntimeDiagnostics,
} from "./game/types";

const INITIAL_SNAPSHOT: RunSnapshot = {
  phase: "briefing",
  seed: 1,
  tick: 0,
  elapsedSeconds: 0,
  triggerPulls: 0,
  tank: {
    x: WORLD_WIDTH * 0.3,
    y: WORLD_HEIGHT * 0.5,
    hullAngle: 0,
    turretAngle: 0,
    speed: 0,
  },
  beacon: { x: WORLD_WIDTH * 0.75, y: WORLD_HEIGHT * 0.35 },
};

const INITIAL_DIAGNOSTICS: RuntimeDiagnostics = {
  starts: 0,
  finishes: 0,
  resets: 0,
  inputListeners: 0,
  resizeObservers: 0,
  framePending: false,
  simulationSteps: 0,
  droppedMilliseconds: 0,
  destroyed: false,
};

function formatTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${(wholeSeconds % 60).toString().padStart(2, "0")}`;
}

function formatSeed(seed: number): string {
  return seed.toString(16).toUpperCase().padStart(8, "0");
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const primaryDialogActionRef = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [diagnostics, setDiagnostics] = useState(INITIAL_DIAGNOSTICS);
  const smokeMode = useMemo(
    () =>
      typeof location !== "undefined" &&
      new URLSearchParams(location.search).has("smoke"),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = GameRuntime.create(canvas, {
      onSnapshot: setSnapshot,
      onDiagnostics: setDiagnostics,
    });
    runtimeRef.current = runtime;
    if (import.meta.env.DEV) {
      window.__TANKAVOID_T1__ = {
        snapshot: () => runtime.snapshot(),
        diagnostics: () => runtime.diagnostics(),
        start: (seed = createRunSeed()) => runtime.start(seed),
        finish: () => runtime.finish(),
        restart: (seed = createRunSeed()) => runtime.restart(seed),
      };
    }
    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      if (import.meta.env.DEV) delete window.__TANKAVOID_T1__;
    };
  }, []);

  useEffect(() => {
    if (snapshot.phase === "paused" || snapshot.phase === "complete")
      primaryDialogActionRef.current?.focus();
  }, [snapshot.phase]);

  const start = () => {
    runtimeRef.current?.start(createRunSeed());
    requestAnimationFrame(() => canvasRef.current?.focus());
  };
  const restart = () => {
    runtimeRef.current?.restart(createRunSeed());
    requestAnimationFrame(() => canvasRef.current?.focus());
  };

  return (
    <main className="tank-app" data-phase={snapshot.phase}>
      <div className="tank-atmosphere" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="tank-canvas"
        tabIndex={0}
        aria-label="TankaVOID proving ground. Use W A S D or arrow keys to drive and the pointer to aim the turret. Escape pauses. Firing records a trigger pull; combat arrives in the next sprint."
      />
      <p className="tank-status" role="status" aria-live="polite">
        {snapshot.phase === "briefing" && "TankaVOID rebuild briefing."}
        {snapshot.phase === "running" && "Proving-ground drill running."}
        {snapshot.phase === "paused" && "Drill paused."}
        {snapshot.phase === "complete" && "Drill complete."}
      </p>

      {snapshot.phase !== "briefing" && (
        <section className="tank-hud" aria-label="Run status">
          <div className="tank-hud__identity">
            <span>T1 / PROVING GROUND</span>
            <strong>{formatTime(snapshot.elapsedSeconds)}</strong>
          </div>
          <div className="tank-hud__telemetry">
            <span>
              Speed <strong>{Math.round(Math.abs(snapshot.tank.speed))}</strong>
            </span>
            <span>
              Trigger <strong>{snapshot.triggerPulls}</strong>
            </span>
            <span>
              Seed <strong>{formatSeed(snapshot.seed)}</strong>
            </span>
          </div>
          <div className="tank-hud__actions">
            <button
              type="button"
              onClick={() => runtimeRef.current?.toggleManualPause()}
            >
              {snapshot.phase === "paused" ? "Resume drill" : "Pause drill"}
            </button>
            {smokeMode && snapshot.phase !== "complete" && (
              <button
                type="button"
                onClick={() => runtimeRef.current?.finish()}
              >
                End systems check
              </button>
            )}
          </div>
        </section>
      )}

      {snapshot.phase === "briefing" && (
        <section className="tank-briefing" aria-labelledby="tank-title">
          <div className="tank-briefing__copy">
            <p className="tank-kicker">aVOID prototype recovery / T1</p>
            <h1 id="tank-title">
              Tanka<span>VOID</span>
            </h1>
            <p className="tank-thesis">Direction matters.</p>
            <p className="tank-lede">
              The old game tried to be an army. This rebuild begins with one
              dependable machine: one loop, one arena, and a tank that goes
              exactly where the simulation says it went.
            </p>
            <button className="tank-primary" type="button" onClick={start}>
              <span>Enter the proving ground</span>
              <small>Keyboard + pointer foundation</small>
            </button>
            <p className="tank-boundary">
              Local engineering build. No account, leaderboard, purchases, or
              public Play route.
            </p>
          </div>
          <div className="tank-briefing__plate" aria-label="Rebuild status">
            <div className="tank-stamp">
              <span>PROTOTYPES</span>
              <strong>PRESERVED</strong>
            </div>
            <ol>
              <li>
                <span>01</span>
                <strong>Hull</strong>
                <small>WASD / arrows</small>
              </li>
              <li>
                <span>02</span>
                <strong>Turret</strong>
                <small>Pointer aim</small>
              </li>
              <li>
                <span>03</span>
                <strong>Armor</strong>
                <small>Directional model / T2</small>
              </li>
            </ol>
            <div className="tank-briefing__readout">
              <span>Runtime</span>
              <strong>
                {diagnostics.inputListeners || 8} inputs /{" "}
                {diagnostics.resizeObservers || 1} viewport
              </strong>
            </div>
          </div>
        </section>
      )}

      {snapshot.phase === "paused" && (
        <div className="tank-dialog-backdrop">
          <section
            className="tank-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
          >
            <p className="tank-kicker">Systems held at tick {snapshot.tick}</p>
            <h2 id="pause-title">Drill paused.</h2>
            <p>
              The fixed-step clock is stopped. Nothing underneath this panel is
              still simulating.
            </p>
            <div className="tank-dialog__actions">
              <button
                ref={primaryDialogActionRef}
                className="tank-primary"
                type="button"
                onClick={() => runtimeRef.current?.resume()}
              >
                Continue drill
              </button>
              <button
                type="button"
                onClick={() => runtimeRef.current?.returnToBriefing()}
              >
                Return to briefing
              </button>
            </div>
          </section>
        </div>
      )}

      {snapshot.phase === "complete" && (
        <div className="tank-dialog-backdrop">
          <section
            className="tank-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-title"
          >
            <p className="tank-kicker">T1 runtime result</p>
            <h2 id="complete-title">The machine held.</h2>
            <div className="tank-result-grid">
              <span>
                <small>Duration</small>
                <strong>{formatTime(snapshot.elapsedSeconds)}</strong>
              </span>
              <span>
                <small>Simulation ticks</small>
                <strong>{snapshot.tick}</strong>
              </span>
              <span>
                <small>Trigger pulls</small>
                <strong>{snapshot.triggerPulls}</strong>
              </span>
            </div>
            <p>
              This is not a score. T2 earns the right to add shells, impact
              angles, armor faces, and damage.
            </p>
            <div className="tank-dialog__actions">
              <button
                ref={primaryDialogActionRef}
                className="tank-primary"
                type="button"
                onClick={restart}
              >
                Run it again
              </button>
              <button
                type="button"
                onClick={() => runtimeRef.current?.returnToBriefing()}
              >
                Return to briefing
              </button>
            </div>
          </section>
        </div>
      )}

      {smokeMode && (
        <output
          className="tank-diagnostics"
          aria-label="Development runtime diagnostics"
        >
          starts:{diagnostics.starts} finishes:{diagnostics.finishes} resets:
          {diagnostics.resets} listeners:{diagnostics.inputListeners} resize:
          {diagnostics.resizeObservers} frame:{diagnostics.framePending ? 1 : 0}
        </output>
      )}
    </main>
  );
}

declare global {
  interface Window {
    __TANKAVOID_T1__?: {
      snapshot(): RunSnapshot;
      diagnostics(): RuntimeDiagnostics;
      start(seed?: number): void;
      finish(): void;
      restart(seed?: number): void;
    };
  }
}

export default App;
