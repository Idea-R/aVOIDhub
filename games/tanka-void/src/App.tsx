import { useEffect, useMemo, useRef, useState } from "react";
import { TouchControls } from "./TouchControls";
import { GameRuntime } from "./game/GameRuntime";
import { TANKAVOID_WAVES } from "./game/content";
import { createRunSeed } from "./game/random";
import { TANKAVOID_COVER } from "./game/TankSimulation";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type RunSnapshot,
  type RuntimeDiagnostics,
} from "./game/types";

const INITIAL_SNAPSHOT: RunSnapshot = {
  phase: "briefing",
  stage: "deploying",
  stageTicksRemaining: 0,
  seed: 1,
  tick: 0,
  elapsedSeconds: 0,
  combatSeconds: 0,
  triggerPulls: 0,
  wave: 1,
  waveCount: TANKAVOID_WAVES.length,
  waveTitle: TANKAVOID_WAVES[0].title,
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
  enemies: [
    {
      id: "wave-1-1-scout",
      archetype: "scout",
      label: "SCOUT",
      x: 925,
      y: WORLD_HEIGHT * 0.5,
      hullAngle: Math.PI,
      turretAngle: Math.PI,
      speed: 0,
      health: 100,
      maxHealth: 100,
      disabled: false,
    },
  ],
  projectiles: [],
  cover: TANKAVOID_COVER.map((cover) => ({ ...cover })),
  impacts: [],
  coverStrikes: [],
  stats: {
    shotsFired: 0,
    hits: 0,
    ricochets: 0,
    damageDealt: 0,
    damageTaken: 0,
    armorRepaired: 0,
    enemiesDisabled: 0,
    wavesCleared: 0,
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
  maximumFrameDeltaMilliseconds: 0,
  maximumStepsPerFrame: 5,
  activeProjectiles: 0,
  projectileCapacity: 32,
  activeEnemies: 1,
  enemyCapacity: 3,
  coverCount: 4,
  coverCapacity: 4,
  impactHistory: 0,
  impactHistoryCapacity: 12,
  coverStrikeHistory: 0,
  coverStrikeHistoryCapacity: 8,
  particleCount: 0,
  particleCapacity: 0,
  drawItems: 0,
  drawItemCapacity: 64,
  audioState: "locked",
  soundMuted: false,
  audioContexts: 0,
  activeAudioVoices: 0,
  audioVoiceCapacity: 8,
  destroyed: false,
};

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof localStorage === "undefined") return fallback;
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

interface SettingsControlsProps {
  soundOn: boolean;
  audioState: RuntimeDiagnostics["audioState"];
  reducedMotion: boolean;
  systemReducedMotion: boolean;
  onToggleSound(): void;
  onToggleMotion(): void;
}

function SettingsControls({
  soundOn,
  audioState,
  reducedMotion,
  systemReducedMotion,
  onToggleSound,
  onToggleMotion,
}: SettingsControlsProps) {
  const soundUnavailable = audioState === "unavailable";
  return (
    <div className="tank-setting-controls" aria-label="Game settings">
      <button
        type="button"
        aria-pressed={soundOn && !soundUnavailable}
        onClick={onToggleSound}
        disabled={soundUnavailable}
      >
        Sound{" "}
        <strong>
          {soundUnavailable ? "unavailable" : soundOn ? "on" : "off"}
        </strong>
      </button>
      <button
        type="button"
        aria-pressed={reducedMotion}
        aria-label={`Motion ${reducedMotion ? "reduced" : "full"}${
          systemReducedMotion ? ". System motion setting honored" : ""
        }`}
        onClick={onToggleMotion}
        disabled={systemReducedMotion}
      >
        Motion <strong>{reducedMotion ? "reduced" : "full"}</strong>
      </button>
      {systemReducedMotion && <span>System motion setting honored</span>}
    </div>
  );
}

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
  if (snapshot.completionReason === "run-cleared")
    return "The whole line broke.";
  if (snapshot.completionReason === "player-disabled") return "Hull disabled.";
  return "Combat systems held.";
}

function App() {
  const mainRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [diagnostics, setDiagnostics] = useState(INITIAL_DIAGNOSTICS);
  const [soundOn, setSoundOn] = useState(() =>
    readStoredBoolean("tankavoid:sound:v1", true),
  );
  const [userReducedMotion, setUserReducedMotion] = useState(() =>
    readStoredBoolean("tankavoid:motion:v1", false),
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(
    () => !readStoredBoolean("tankavoid:tutorial-seen:v1", false),
  );
  const smokeMode = useMemo(
    () =>
      typeof location !== "undefined" &&
      new URLSearchParams(location.search).has("smoke"),
    [],
  );
  const lastImpact = snapshot.impacts[snapshot.impacts.length - 1];
  const activeEnemies = snapshot.enemies.filter((enemy) => !enemy.disabled);
  const leadEnemy = activeEnemies.reduce<(typeof activeEnemies)[number] | null>(
    (current, enemy) =>
      !current || enemy.health > current.health ? enemy : current,
    null,
  );
  const waveDefinition = TANKAVOID_WAVES[snapshot.wave - 1];
  const touchPreview = useMemo(
    () =>
      typeof location !== "undefined" &&
      new URLSearchParams(location.search).has("touch"),
    [],
  );
  const touchMode = coarsePointer || touchPreview;
  const reducedMotion = systemReducedMotion || userReducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const main = mainRef.current;
    if (!canvas || !main) return;
    const runtime = GameRuntime.create(canvas, main, {
      onSnapshot: setSnapshot,
      onDiagnostics: setDiagnostics,
    });
    runtimeRef.current = runtime;
    if (import.meta.env.DEV) {
      window.__TANKAVOID_T5__ = {
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
      if (import.meta.env.DEV) delete window.__TANKAVOID_T5__;
    };
  }, []);

  useEffect(() => {
    const pointerQuery = matchMedia("(pointer: coarse)");
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setCoarsePointer(pointerQuery.matches);
      setSystemReducedMotion(motionQuery.matches);
    };
    update();
    pointerQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);
    return () => {
      pointerQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("tankavoid:sound:v1", String(soundOn));
    runtimeRef.current?.setAudioMuted(!soundOn);
  }, [soundOn]);

  useEffect(() => {
    localStorage.setItem("tankavoid:motion:v1", String(userReducedMotion));
  }, [userReducedMotion]);

  useEffect(() => {
    if (snapshot.phase !== "complete") return;
    localStorage.setItem("tankavoid:tutorial-seen:v1", "true");
    setTipsVisible(false);
  }, [snapshot.phase]);

  useEffect(() => {
    if (snapshot.phase === "paused" || snapshot.phase === "complete")
      dialogRef.current?.focus({ preventScroll: true });
  }, [snapshot.phase]);

  const start = () => {
    if (soundOn) void runtimeRef.current?.unlockAudio();
    runtimeRef.current?.start(createRunSeed());
    requestAnimationFrame(() => canvasRef.current?.focus());
  };
  const restart = () => {
    if (soundOn) void runtimeRef.current?.unlockAudio();
    runtimeRef.current?.restart(createRunSeed());
    requestAnimationFrame(() => canvasRef.current?.focus());
  };
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    runtimeRef.current?.setAudioMuted(!next);
    if (next) void runtimeRef.current?.unlockAudio();
  };
  const toggleMotion = () => {
    if (!systemReducedMotion) setUserReducedMotion((current) => !current);
  };
  const hideTips = () => {
    localStorage.setItem("tankavoid:tutorial-seen:v1", "true");
    setTipsVisible(false);
  };
  const showTips = () => {
    localStorage.setItem("tankavoid:tutorial-seen:v1", "false");
    setTipsVisible(true);
  };

  return (
    <main
      ref={mainRef}
      className="tank-app"
      data-phase={snapshot.phase}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-controls={touchMode ? "touch-candidate" : "keyboard-pointer"}
    >
      <div className="tank-atmosphere" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="tank-canvas"
        tabIndex={0}
        aria-label={
          touchMode
            ? "TankaVOID directional combat proving ground. Drag the left touch control to drive and steer. Drag the right control to aim, then release it to fire. Keep your front armor toward incoming shells."
            : "TankaVOID five-wave directional combat run. Use W A S D or arrow keys to drive, the pointer to aim the turret, and primary click to fire. Keep your front armor toward incoming shells. Escape pauses."
        }
      />
      <p className="tank-status" role="status" aria-live="polite">
        {snapshot.phase === "briefing" && "TankaVOID rebuild briefing."}
        {snapshot.phase === "running" &&
          snapshot.stage === "deploying" &&
          "Tanks deploying."}
        {snapshot.phase === "running" &&
          snapshot.stage === "combat" &&
          `Wave ${snapshot.wave} live. ${activeEnemies.length} hostiles remain.`}
        {snapshot.phase === "running" &&
          snapshot.stage === "wave-clear" &&
          `Wave ${snapshot.wave} clear. Field repair underway.`}
        {snapshot.phase === "running" &&
          snapshot.stage === "resolved" &&
          "Final impact confirmed."}
        {snapshot.phase === "paused" && "Drill paused."}
        {snapshot.phase === "complete" && "Drill complete."}
      </p>

      {snapshot.phase !== "briefing" && (
        <section className="tank-hud" aria-label="Run status">
          <div className="tank-hud__identity">
            <span>
              T5 / WAVE {snapshot.wave} OF {snapshot.waveCount}
            </span>
            <strong>{formatTime(snapshot.combatSeconds)}</strong>
          </div>
          <div className="tank-hud__telemetry">
            <span>
              Hull <strong>{Math.ceil(snapshot.tank.health)}</strong>
            </span>
            <span>
              Hostiles <strong>{activeEnemies.length}</strong>
            </span>
            <span>
              {leadEnemy ? leadEnemy.label : "Line clear"}{" "}
              <strong>
                {leadEnemy
                  ? Math.ceil(leadEnemy.health)
                  : lastImpact
                    ? `${lastImpact.face} ${Math.round(lastImpact.damage)}`
                    : formatSeed(snapshot.seed)}
              </strong>
            </span>
          </div>
          <div className="tank-hud__actions">
            {snapshot.phase === "running" && snapshot.stage === "combat" && (
              <button
                type="button"
                onClick={() => runtimeRef.current?.toggleManualPause()}
              >
                Pause drill
              </button>
            )}
            {snapshot.phase === "running" && (
              <SettingsControls
                soundOn={soundOn}
                audioState={diagnostics.audioState}
                reducedMotion={reducedMotion}
                systemReducedMotion={systemReducedMotion}
                onToggleSound={toggleSound}
                onToggleMotion={toggleMotion}
              />
            )}
            {smokeMode && snapshot.phase === "running" && (
              <button
                type="button"
                onClick={() => runtimeRef.current?.finish()}
              >
                End systems check
              </button>
            )}
          </div>
          <p className="tank-touch-boundary">
            {touchMode
              ? "Touch layout is a release candidate pending physical-device checks."
              : "Keyboard + pointer is the verified control path."}
          </p>
        </section>
      )}

      <TouchControls
        visible={
          touchMode &&
          snapshot.phase === "running" &&
          snapshot.stage === "combat"
        }
      />

      {tipsVisible && snapshot.phase === "running" && (
        <aside className="tank-coach" aria-label="First-run combat tip">
          <p>
            {snapshot.stage === "deploying"
              ? touchMode
                ? "Left thumb drives. Right thumb aims; release to fire."
                : "WASD drives. The pointer aims; click to fire."
              : snapshot.stage === "wave-clear"
                ? "Field repair is automatic. Use the hold to read the next line."
                : (waveDefinition?.cue ??
                  "Barricades stop shells. Break line of sight when you need room.")}
          </p>
          <button type="button" onClick={hideTips}>
            Hide tips
          </button>
        </aside>
      )}

      {snapshot.phase === "briefing" && (
        <section className="tank-briefing" aria-labelledby="tank-title">
          <div className="tank-briefing__copy">
            <p className="tank-kicker">aVOID combat proof / T5</p>
            <h1 id="tank-title">
              Tanka<span>VOID</span>
            </h1>
            <p className="tank-thesis">Direction matters.</p>
            <p className="tank-lede">
              Five waves. Three ways to get flanked. One commander at the end.
              Keep the strong plate toward the shot, use the barricades, and
              break the line before it pulls you apart.
            </p>
            <button className="tank-primary" type="button" onClick={start}>
              <span>Break all five waves</span>
              <small>
                {touchMode
                  ? "Two thumbs / aim / release to fire"
                  : "WASD + pointer + primary fire"}
              </small>
            </button>
            <SettingsControls
              soundOn={soundOn}
              audioState={diagnostics.audioState}
              reducedMotion={reducedMotion}
              systemReducedMotion={systemReducedMotion}
              onToggleSound={toggleSound}
              onToggleMotion={toggleMotion}
            />
            {!tipsVisible && (
              <button
                className="tank-tip-toggle"
                type="button"
                onClick={showTips}
              >
                Show combat tips next run
              </button>
            )}
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
                <small>{touchMode ? "Left thumb" : "WASD / arrows"}</small>
              </li>
              <li>
                <span>02</span>
                <strong>Turret</strong>
                <small>{touchMode ? "Right thumb" : "Pointer aim"}</small>
              </li>
              <li>
                <span>03</span>
                <strong>Five waves</strong>
                <small>Scout / bruiser / hunter / command</small>
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
            ref={dialogRef}
            className="tank-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
            tabIndex={-1}
          >
            <p className="tank-kicker">Systems held at tick {snapshot.tick}</p>
            <h2 id="pause-title">Drill paused.</h2>
            <p>
              The fixed-step clock is stopped. Nothing underneath this panel is
              still simulating.
            </p>
            <div className="tank-dialog__actions">
              <button
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
            <SettingsControls
              soundOn={soundOn}
              audioState={diagnostics.audioState}
              reducedMotion={reducedMotion}
              systemReducedMotion={systemReducedMotion}
              onToggleSound={toggleSound}
              onToggleMotion={toggleMotion}
            />
            {!tipsVisible && (
              <button
                className="tank-tip-toggle"
                type="button"
                onClick={showTips}
              >
                Show combat tips next run
              </button>
            )}
          </section>
        </div>
      )}

      {snapshot.phase === "complete" && (
        <div className="tank-dialog-backdrop">
          <section
            ref={dialogRef}
            className="tank-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-title"
            tabIndex={-1}
          >
            <p className="tank-kicker">T5 five-wave result</p>
            <h2 id="complete-title">{completionTitle(snapshot)}</h2>
            <div className="tank-result-grid">
              <span>
                <small>Waves</small>
                <strong>
                  {snapshot.stats.wavesCleared} / {snapshot.waveCount}
                </strong>
              </span>
              <span>
                <small>Hostiles disabled</small>
                <strong>{snapshot.stats.enemiesDisabled}</strong>
              </span>
              <span>
                <small>Combat time</small>
                <strong>{formatTime(snapshot.combatSeconds)}</strong>
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
              <span>
                <small>Field repair</small>
                <strong>{Math.round(snapshot.stats.armorRepaired)}</strong>
              </span>
            </div>
            <p>
              This remains an engineering result, not a platform score. The
              wave, face, incidence, and damage record is deterministic and
              local.
            </p>
            <div className="tank-dialog__actions">
              <button className="tank-primary" type="button" onClick={restart}>
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
          {diagnostics.projectileCapacity} impacts:{diagnostics.impactHistory}/
          {diagnostics.impactHistoryCapacity} cover:
          {diagnostics.coverCount}/{diagnostics.coverCapacity} strikes:
          {diagnostics.coverStrikeHistory}/
          {diagnostics.coverStrikeHistoryCapacity} enemies:
          {diagnostics.activeEnemies}/{diagnostics.enemyCapacity} draw:
          {diagnostics.drawItems}/{diagnostics.drawItemCapacity} particles:
          {diagnostics.particleCount}/{diagnostics.particleCapacity} maxdt:
          {Math.round(diagnostics.maximumFrameDeltaMilliseconds)}
          audio:{diagnostics.audioState} contexts:{diagnostics.audioContexts}
          voices:{diagnostics.activeAudioVoices}/
          {diagnostics.audioVoiceCapacity} muted:
          {diagnostics.soundMuted ? 1 : 0}
          tank:{Math.round(snapshot.tank.x)},{Math.round(snapshot.tank.y)} wave:
          {snapshot.wave}/{snapshot.waveCount} kills:
          {snapshot.stats.enemiesDisabled} shots:{snapshot.stats.shotsFired}{" "}
          hits:
          {snapshot.stats.hits} lead:
          {leadEnemy
            ? `${leadEnemy.label}@${Math.round(leadEnemy.x)},${Math.round(leadEnemy.y)}`
            : "none"}
        </output>
      )}
    </main>
  );
}

declare global {
  interface Window {
    __TANKAVOID_T5__?: {
      snapshot(): RunSnapshot;
      diagnostics(): RuntimeDiagnostics;
      start(seed?: number): void;
      finish(): void;
      restart(seed?: number): void;
    };
  }
}

export default App;
