/** RAILaVOID boot: wires sim, render, ui, audio, persistence and the dev API. */
import { bus } from './core/events';
import { createSettingsStore } from './core/storage';
import { createSim } from './sim/sim';
import { createGame } from './render';
import { createUI } from './ui';
import { createAudio } from './audio';
import { installDevApi } from './debug/devApi';
import { createAutopilot } from './debug/autopilot';
import type { AppContext } from './app';
import type { SimApi } from './sim/api';
import { TEST_SEED, REGION_NAMES } from './core/config';
import { gsap } from 'gsap';

const settings = createSettingsStore();
const audio = createAudio(settings, bus);

// A demo simulation runs behind the title screen so the world is alive from the first frame.
const DEMO_SEED = 777;
let demoMode = true;

const ctx: AppContext = {
  sim: createSim(DEMO_SEED, bus),
  bus,
  settings,
  view: null,
  audio,
  newRun(seed?: number) {
    const s = seed ?? ((Math.random() * 0xffffffff) >>> 0);
    const sim = createSim(s, bus);
    demoMode = false;
    autopilot.setEnabled(false);
    ctx.replaceSim(sim);
    settings.setMeta({ runs: settings.meta().runs + 1, lastSeed: s });
    settings.clearSave();
    bus.emit('run:start', { seed: s });
    bus.emit('phase:change', { phase: 'running' });
  },
  continueRun(): boolean {
    const json = settings.readSave();
    if (!json) return false;
    let seed = TEST_SEED;
    try { seed = JSON.parse(json).state.seed; } catch { return false; }
    const sim = createSim(seed, bus);
    // Restore data before listeners can read ctx.sim; otherwise they briefly read
    // (and may autosave) the title demo or previous run instead of the saved run.
    const wasMuted = bus.muted;
    let restored = false;
    try { bus.muted = true; restored = sim.restore(json); } finally { bus.muted = wasMuted; }
    if (!restored) return false;
    demoMode = false;
    autopilot.setEnabled(false);
    ctx.replaceSim(sim);
    bus.emit('run:start', { seed });
    bus.emit('phase:change', { phase: sim.state.phase });
    return true;
  },
  quitToTitle() {
    if (!demoMode && !['title', 'victory', 'defeat'].includes(ctx.sim.state.phase)) {
      settings.writeSave(ctx.sim.serialize());
    }
    demoMode = true;
    ctx.replaceSim(createSim(DEMO_SEED + ((Date.now() / 60000) | 0), bus));
    autopilot.setEnabled(true);
    bus.emit('phase:change', { phase: 'title' });
    ui.showTitle();
  },
  replaceSim(sim: SimApi) {
    ctx.sim = sim;
  },
};

const autopilot = createAutopilot(ctx);
autopilot.setEnabled(true); // drives the title demo

const game = createGame(ctx, document.getElementById('game') as HTMLElement);
const ui = createUI(ctx);
installDevApi(ctx, autopilot);

// ---- persistence hooks
bus.on('settlement:reached', () => { if (!demoMode) settings.writeSave(ctx.sim.serialize()); });
bus.on('phase:change', ({ phase }) => { if (!demoMode && phase === 'paused') settings.writeSave(ctx.sim.serialize()); });
// Choices and their rewards are durable checkpoints, not just settlement arrivals.
const checkpoint = () => { if (!demoMode && !['title', 'victory', 'defeat'].includes(ctx.sim.state.phase)) settings.writeSave(ctx.sim.serialize()); };
bus.on('event:show', checkpoint);
bus.on('expedition:prepare', checkpoint);
bus.on('expedition:stage', checkpoint);
bus.on('expedition:stageCleared', checkpoint);
bus.on('expedition:end', checkpoint);
bus.on('relic:offer', checkpoint);
bus.on('relic:taken', checkpoint);
bus.on('phase:change', ({ phase }) => { if (phase === 'running') checkpoint(); });
const finishRun = (victory: boolean) => {
  if (demoMode) return;
  const s = ctx.sim.state;
  const meta = settings.meta();
  let kills = 0; for (const k of Object.keys(s.stats.kills)) kills += s.stats.kills[k];
  settings.setMeta({
    victories: meta.victories + (victory ? 1 : 0),
    bestScore: Math.max(meta.bestScore, s.stats.score),
    bestRegion: Math.max(meta.bestRegion, s.region + 1),
    totalKills: meta.totalKills + kills,
  });
  settings.clearSave();
};
bus.on('run:victory', () => finishRun(true));
bus.on('run:defeat', () => finishRun(false));

// ---- audio unlock on first gesture
const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// ---- cinematics: the sim is frozen while a camera sequence plays (skippable via the UI)
let cinematicActive = false;
function cinematic(name: 'opening' | 'run_intro' | 'region_enter' | 'boss_intro' | 'victory' | 'defeat', data?: { title?: string; subtitle?: string; x?: number; y?: number }): void {
  if (demoMode || !ctx.view || settings.get().reducedMotion) return;
  // Deferred flyovers must not cover a decision or steal its confirmation key.
  if (name !== 'victory' && name !== 'defeat' && ctx.sim.state.phase !== 'running' && ctx.sim.state.phase !== 'paused') return;
  if (cinematicActive) return;
  cinematicActive = true;
  let done = false;
  const finish = () => { if (!done) { done = true; cinematicActive = false; } };
  ctx.view.playCinematic(name, data).then(finish, finish);
  window.setTimeout(finish, name === 'opening' ? 40000 : 9000); // hard safety cap
}
bus.on('run:start', ({ seed }) => {
  const startedState = ctx.sim.state;
  const region = ctx.sim.state.region;
  // the first run of a profile gets the full scripted opening; later runs the short run intro (the title menu can replay the opening)
  const first = !settings.meta().introSeen && !(window as any).__RAIL_SKIP_OPENING;
  if (first) settings.setMeta({ introSeen: true });
  window.setTimeout(() => { if (ctx.sim.state === startedState) cinematic(first ? 'opening' : 'run_intro', { title: 'RAILaVOID', subtitle: `${REGION_NAMES[region]} · Seed ${seed}` }); }, 60);
});
bus.on('phase:change', ({ phase }) => {
  if (['event', 'shop', 'relic', 'expedition'].includes(phase) && ctx.view?.isCinematicPlaying()) ctx.view.skipCinematic();
});
// UI can request the opening on demand (title menu "Watch intro") — it plays on the live run
(window as any).__RAIL_PLAY_OPENING = () => { const s = ctx.sim.state; if (!demoMode && (s.phase === 'running' || s.phase === 'paused')) cinematic('opening', { title: 'RAILaVOID' }); };
bus.on('region:enter', ({ name, region }) => { if (region > 0) cinematic('region_enter', { title: name.toUpperCase(), subtitle: `Region ${region + 1} of 4` }); });
bus.on('boss:spawn', ({ type, name }) => {
  const e = ctx.sim.state.enemies.find(en => en.type === type);
  cinematic('boss_intro', { title: name.toUpperCase(), subtitle: 'BOSS', x: e?.x, y: e?.y });
});
bus.on('run:victory', () => cinematic('victory', { title: 'THE GATE IS OPEN', subtitle: 'The last train crosses into the dawn' }));
bus.on('run:defeat', ({ reason }) => cinematic('defeat', { title: 'DERAILED', subtitle: reason }));

// ---- frame loop (sim + ui + autopilot); Phaser renders on its own loop
let last = performance.now();
let lastRaf = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    if (!cinematicActive || demoMode) ctx.sim.update(dt);
    autopilot.update(dt);
    ui.update(dt);
  } catch (e) {
    console.error('[frame]', e);
  }
}
function rafLoop(now: number): void {
  lastRaf = now;
  frame(now);
  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);
// Watchdog: some embedded/background browsers stall requestAnimationFrame entirely. Keep the game
// (and GSAP, which also rides rAF) alive from a timer while that happens.
window.setInterval(() => {
  const now = performance.now();
  if (now - lastRaf < 200) return;
  frame(now);
  try { (gsap.ticker as unknown as { tick: () => void }).tick(); } catch { /* ignore */ }
}, 50);

// pause when the tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !demoMode && ctx.sim.state.phase === 'running') ctx.sim.pause();
  else if (document.hidden) checkpoint();
});
window.addEventListener('pagehide', checkpoint);

window.addEventListener('resize', () => ctx.view?.resize());

ui.showTitle();
void game;
