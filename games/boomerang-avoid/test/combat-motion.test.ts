import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createMatch,
  step,
  NEUTRAL,
  RULES,
  type Seat,
  type GameEvent,
} from "@avoid/boomerangavoid-sim";
import {
  CombatMotion,
  CharacterAnimation,
  slashPresentation,
  type MotionFrame,
} from "../src/combat-motion.ts";
const seats: Seat[] = [
  { id: "a", name: "Pip", character: "pip", color: 1, team: 0, bot: null },
  { id: "b", name: "Nori", character: "nori", color: 2, team: 1, bot: null },
];
const match = () =>
  createMatch(
    {
      mode: "ffa",
      wins: 3,
      mapId: "moss-court",
      seed: 18,
      friendlyFire: false,
      upgrades: false,
    },
    seats,
  );
const frame = (
  motion: string,
  key = motion,
  progress = 0,
  loop = false,
): MotionFrame => ({
  motion,
  clip: motion,
  key,
  progress: loop ? undefined : progress,
  loop,
  result: null,
  deathProgress: 0,
  spawnProgress: 1,
});

test("slash cue uses exact authoritative half-open windup, active and recovery intervals", () => {
  const state = match();
  state.phase = "playing";
  state.tick = 200;
  step(state, { a: { ...NEUTRAL, slash: true } });
  const p = state.players[0];
  const original = structuredClone(state);
  const start = p.slashStart - RULES.slashWindup;
  assert.equal(slashPresentation(p, start - 1).stage, "none");
  for (let t = start; t < p.slashStart; t++)
    assert.equal(slashPresentation(p, t).active, false);
  for (let t = p.slashStart; t < p.slashUntil; t++)
    assert.equal(slashPresentation(p, t).active, true);
  for (let t = p.slashUntil; t < p.slashCooldown; t++)
    assert.equal(slashPresentation(p, t).stage, "recovery");
  assert.equal(slashPresentation(p, p.slashCooldown).stage, "none");
  assert.deepEqual(state, original);
  assert.equal(slashPresentation(p, p.slashStart).clipProgress, 0.38);
  assert.equal(slashPresentation(p, p.slashUntil).clipProgress, 0.76);
  assert.equal(
    slashPresentation(p, p.slashStart + RULES.slashActive / 2).angle,
    0,
  );
});

test("held weapon anticipation, sweep and recovery join continuously without a reset at release", () => {
  const p = match().players[0];
  p.slashStart = 203;
  p.slashUntil = 209;
  p.slashCooldown = 221;
  for (const t of [203, 209, 221]) {
    const before = slashPresentation(p, t - 1e-6),
      after = slashPresentation(p, t);
    for (const key of ["angle", "reach", "height"] as const)
      assert.ok(
        Math.abs(before[key] - after[key]) < 0.00001,
        `${key} continuous at ${t}`,
      );
  }
});

test("winners alone celebrate in Relay and round results; result time continues when authority is frozen", () => {
  const state = match();
  state.config.mode = "relay";
  state.phase = "matchResults";
  state.matchWinnerIds = ["a"];
  const a = new CombatMotion(),
    b = new CombatMotion();
  assert.equal(a.sample(state, state.players[0], [], 1).motion, "victory");
  const loser = b.sample(state, state.players[1], [], 1);
  assert.equal(loser.motion, "defeat");
  assert.equal(loser.result, "loser");
  const end = a.sample(state, state.players[0], [], 3.5);
  assert.equal(end.progress, 1);
  assert.equal(end.loop, false);
  state.phase = "roundResults";
  state.winnerIds = ["b"];
  assert.equal(a.sample(state, state.players[0], [], 4).motion, "defeat");
  assert.equal(b.sample(state, state.players[1], [], 4).motion, "victory");
});

test("death completes once, respawn starts a fresh original spawn clip, and round rollback resets lifecycle", () => {
  const state = match(),
    p = state.players[0],
    motion = new CombatMotion();
  state.phase = "playing";
  motion.sample(state, p, [], 1);
  p.alive = false;
  const death = motion.sample(state, p, [], 2);
  assert.equal(death.motion, "elimination");
  assert.equal(death.progress, 0);
  assert.equal(motion.sample(state, p, [], 3).progress, 1);
  p.alive = true;
  const spawn = motion.sample(state, p, [], 4);
  assert.equal(spawn.motion, "spawn");
  assert.equal(spawn.progress, 0);
  state.round++;
  state.tick = 0;
  state.phase = "countdown";
  assert.notEqual(motion.sample(state, p, [], 5).key, spawn.key);
});

test("dash and slash identities retrigger even without an idle frame; repeated snapshots retain identity", () => {
  const s = match(),
    p = s.players[0],
    motion = new CombatMotion();
  s.phase = "playing";
  s.tick = 100;
  p.dashUntil = 110;
  const first = motion.sample(s, p, [], 1),
    same = motion.sample(s, p, [], 1.01);
  assert.equal(first.key, same.key);
  p.dashUntil = 158;
  assert.notEqual(motion.sample(s, p, [], 1.1).key, first.key);
  p.dashUntil = 0;
  p.slashStart = 103;
  p.slashUntil = 109;
  p.slashCooldown = 121;
  const slash = motion.sample(s, p, [], 1.2);
  p.slashStart = 124;
  p.slashUntil = 130;
  p.slashCooldown = 142;
  s.tick = 121;
  assert.notEqual(motion.sample(s, p, [], 1.3).key, slash.key);
});

test("catch reactions distinguish event IDs and expire by authoritative tick rather than frame count", () => {
  const s = match(),
    p = s.players[0],
    motion = new CombatMotion();
  s.phase = "playing";
  s.tick = 100;
  const event = {
    id: "catch-a",
    tick: 100,
    type: "catch",
    actor: "a",
    target: "a",
    x: 0,
    y: 0,
  } as GameEvent;
  const one = motion.sample(s, p, [event], 1);
  assert.equal(one.motion, "catch");
  assert.equal(motion.sample(s, p, [event], 1.1).key, one.key);
  assert.notEqual(
    motion.sample(s, p, [{ ...event, id: "catch-b" }], 1.2).key,
    one.key,
  );
  s.tick = 114;
  assert.equal(motion.sample(s, p, [event], 1.3).motion, "idle");
  const hit = {
    ...event,
    id: "shove-b",
    tick: 114,
    type: "shoveHit",
    actor: "b",
    target: "a",
  } as GameEvent;
  assert.equal(motion.sample(s, p, [hit], 1.4).motion, "hit");
  assert.equal(
    new CombatMotion().sample(s, s.players[1], [hit], 1.4).motion,
    "idle",
  );
});

test("moving to rest uses the authored stop clip and fresh movement interrupts it immediately", () => {
  const s = match(),
    p = s.players[0],
    motion = new CombatMotion();
  s.phase = "playing";
  p.vx = 4;
  assert.equal(motion.sample(s, p, [], 1).motion, "run");
  p.vx = 0;
  assert.equal(motion.sample(s, p, [], 1.1).motion, "stop_turn");
  assert.equal(motion.sample(s, p, [], 1.4).motion, "idle");
  p.vx = 4;
  assert.equal(motion.sample(s, p, [], 1.41).motion, "run");
});

test("Three.js one-shot sampling holds the end, avoids snapshot resets and retriggers identical clips", () => {
  const model = new THREE.Object3D();
  const clip = new THREE.AnimationClip("dash", 1, [
    new THREE.NumberKeyframeTrack(".position[x]", [0, 0.5, 1], [0, 1, 0]),
  ]);
  const animation = new CharacterAnimation(model, [clip]);
  animation.update(frame("dash", "dash:10", 0.5), 1 / 60, false);
  assert.equal(model.position.x, 1);
  assert.equal(animation.actions.dash.loop, THREE.LoopOnce);
  assert.equal(animation.actions.dash.clampWhenFinished, true);
  animation.update(frame("dash", "dash:10", 1), 1 / 60, false);
  for (let i = 0; i < 120; i++)
    animation.update(frame("dash", "dash:10", 1), 1 / 60, false);
  assert.equal(model.position.x, 0);
  assert.equal(animation.transitions, 1);
  animation.update(frame("dash", "dash:20", 0.5), 1 / 60, false);
  assert.equal(model.position.x, 1);
  assert.equal(animation.transitions, 2);
  animation.dispose();
  assert.equal(animation.mixer.stats.actions.inUse, 0);
});

test("crossfades retire outgoing actions; reduced motion keeps combat timing but holds victory and spawn poses", () => {
  const clips = ["idle", "run", "slash", "victory", "spawn"].map(
    (name) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.NumberKeyframeTrack(".position[x]", [0, 1], [0, 1]),
      ]),
  );
  const model = new THREE.Object3D(),
    animation = new CharacterAnimation(model, clips);
  animation.update(frame("run", "run", 0, true), 0.1, false);
  animation.update(frame("slash", "slash", 0.5), 0.1, false);
  animation.update(frame("slash", "slash", 0.6), 0.1, false);
  assert.equal(animation.actions.run.isScheduled(), false);
  assert.equal(animation.mixer.stats.actions.inUse, 1);
  animation.update(frame("victory", "result", 0.9), 0.1, true);
  assert.ok(Math.abs(model.position.x - 0.35) < 1e-6);
  animation.update(frame("spawn", "spawn", 0.1), 0.1, true);
  assert.equal(model.position.x, 1);
  animation.dispose();
});

test("all six actual original GLBs bind and sample every required one-shot with finite bone transforms", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../../../assets-src/boomerangavoid/gamefeel/manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const id of ["pip", "kiln", "volt", "nori", "cairn", "comet"]) {
    const data = await readFile(
      new URL(`../public/models/gamefeel/${id}.glb`, import.meta.url),
    );
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    const animation = new CharacterAnimation(gltf.scene, gltf.animations);
    assert.deepEqual(
      new Set(gltf.animations.map((c) => c.name)),
      new Set(Object.keys(manifest.clip_frames)),
    );
    for (const name of Object.keys(manifest.clip_frames)) {
      const loop = ["idle", "run", "recall_strain"].includes(name);
      animation.update(frame(name, `${name}:1`, 0.5, loop), 0.1, false);
      animation.update(frame(name, `${name}:1`, 1, loop), 0.1, false);
      assert.equal(
        animation.actions[name].loop,
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
      );
    }
    gltf.scene.traverse((object) => {
      for (const n of [
        ...object.position.toArray(),
        ...object.quaternion.toArray(),
        ...object.scale.toArray(),
      ])
        assert.ok(Number.isFinite(n));
    });
    animation.dispose();
    assert.equal(animation.mixer.stats.bindings.inUse, 0);
  }
});
