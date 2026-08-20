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
    x: WORLD_WIDTH * 0.26,
    y: WORLD_HEIGHT * 0.5,
    hullAngle: 0,
    turretAngle: 0,
    speed: 0,
    health: 140,
    maxHealth: 140,
    disabled: false,
  },
  enemy: {
    x: WORLD_WIDTH * 0.76,
    y: WORLD_HEIGHT * 0.5,
    hullAngle: Math.PI,
    turretAngle: Math.PI,
    speed: 0,
    health: 120,
    maxHealth: 120,
    disabled: false,
  },
  projectiles: [],
  impacts: [],
  stats: {
    shotsFired: 0,
    hits: 0,
    ricochets: 0,
    damageDealt: 0,
    damageTaken: 0,
  },
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
  activeProjectiles: 0,
  projectileCapacity: 32,
  impactHistory: 0,
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

function completionTitle(snapshot: RunSnapshot): string {
  if (snapshot.completionReason === "enemy-disabled")
    return "Armor line broken.";
  if (snapshot.completionReason === "player-disabled") return "Hull disabled.";
  return "Combat systems held.";
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
  const lastImpact = snapshot.impacts[snapshot.impacts.length - 1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = GameRuntime.create(canvas, {
      onSnapshot: setSnapshot,
      onDiagnostics: setDiagnostics,
    });
    runtimeRef.current = runtime;
    if (import.meta.env.DEV) {
      window.__TANKAVOID_T2__ = {
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
      if (import.meta.env.DEV) delete window.__TANKAVOID_T2__;
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
        aria-label="TankaVOID directional combat proving ground. Use W A S D or arrow keys to drive, the pointer to aim the turret, and primary click to fire. Keep your front armor toward incoming shells. Escape pauses."
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
            <span>T2 / DIRECTIONAL COMBAT</span>
            <strong>{formatTime(snapshot.elapsedSeconds)}</strong>
          </div>
          <div className="tank-hud__telemetry">
            <span>
              Hull <strong>{Math.ceil(snapshot.tank.health)}</strong>
            </span>
            <span>
              Target <strong>{Math.ceil(snapshot.enemy.health)}</strong>
            </span>
            <span>
              {lastImpact ? lastImpact.outcome : "No impact"}{" "}
              <strong>
                {lastImpact
                  ? `${lastImpact.face} ${Math.round(lastImpact.damage)}`
                  : formatSeed(snapshot.seed)}
              </strong>
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
          <p className="tank-touch-boundary">
            Keyboard + pointer combat build. Touch driving arrives in T4.
          </p>
        </section>
      )}

      {snapshot.phase === "briefing" && (
        <section className="tank-briefing" aria-labelledby="tank-title">
          <div className="tank-briefing__copy">
            <p className="tank-kicker">aVOID combat proof / T2</p>
            <h1 id="tank-title">
              Tanka<span>VOID</span>
            </h1>
            <p className="tank-thesis">Direction matters.</p>
            <p className="tank-lede">
              The front plate can take a punch. The rear cannot. Turn the hull,
              aim the turret independently, and break one bruiser before it
              finds your weak side.
            </p>
            <button className="tank-primary" type="button" onClick={start}>
              <span>Test the armor</span>
              <small>WASD + pointer + primary fire</small>
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
                <small>Front .55 / side .90 / rear 1.35</small>
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
            <p className="tank-kicker">T2 combat result</p>
            <h2 id="complete-title">{completionTitle(snapshot)}</h2>
            <div className="tank-result-grid">
              <span>
                <small>Duration</small>
                <strong>{formatTime(snapshot.elapsedSeconds)}</strong>
              </span>
              <span>
                <small>Damage dealt</small>
                <strong>{Math.round(snapshot.stats.damageDealt)}</strong>
              </span>
              <span>
                <small>Hits / shots</small>
                <strong>
                  {snapshot.stats.hits} / {snapshot.stats.shotsFired}
                </strong>
              </span>
            </div>
            <p>
              This remains an engineering result, not a platform score. The
              face, incidence, and damage record is deterministic and local.
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
          projectiles:{diagnostics.activeProjectiles}/
          {diagnostics.projectileCapacity} impacts:{diagnostics.impactHistory}
          tank:{Math.round(snapshot.tank.x)},{Math.round(snapshot.tank.y)}{" "}
          shots:
          {snapshot.stats.shotsFired} hits:{snapshot.stats.hits}
        </output>
      )}
    </main>
  );
}

declare global {
  interface Window {
    __TANKAVOID_T2__?: {
      snapshot(): RunSnapshot;
      diagnostics(): RuntimeDiagnostics;
      start(seed?: number): void;
      finish(): void;
      restart(seed?: number): void;
    };
  }
}

export default App;
