import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, getBotInputs, stateHash, step } from "@avoid/boomerangavoid-sim";
import { newDraft, parseDraft } from "../src/studio-contract";
import { StudioHistory } from "../src/studio-history";

test("invalid configuration edits preserve the complete draft and redo history", () => {
  const initial = newDraft("moss-court"), history = new StudioHistory(initial);
  const changed = history.read(); changed.label = "Keep my level"; changed.match.seed = 41827;
  history.replace(changed); history.undo();
  for (const edit of [
    (d: typeof initial) => { d.match.seed = -1; },
    (d: typeof initial) => { d.match.wins = 4; },
    (d: typeof initial) => { d.match.enabledUpgrades = ["guard", "guard"]; },
    (d: typeof initial) => { d.seats[1].control = "keyboard1"; d.seats[1].bot = null; },
    (d: typeof initial) => { d.match.mode = "teams"; d.seats.forEach(s => { s.team = 0; }); },
    (d: typeof initial) => { d.arena.width = Infinity; },
  ]) {
    const invalid = history.read(); edit(invalid);
    assert.throws(() => history.replace(invalid));
    assert.deepEqual(history.read(), initial);
    assert.equal(history.canUndo, false); assert.equal(history.canRedo, true);
  }
  assert.deepEqual(history.redo(), changed);
  assert.deepEqual(history.undo(), initial);
});

test("snapshots are detached, no-op edits retain redo, and successful changes branch history", () => {
  const initial = newDraft(), history = new StudioHistory(initial), next = history.read();
  next.match.wins = 7; history.replace(next); next.match.seed = 99;
  assert.equal(history.read().match.seed, initial.match.seed);
  history.undo(); history.replace(history.read());
  assert.equal(history.canRedo, true);
  const branch = history.read(); branch.match.enabledUpgrades = [];
  history.replace(branch); assert.equal(history.canRedo, false);
  assert.deepEqual(history.redo(), branch); assert.deepEqual(history.undo(), initial);
  const read = history.read(); read.seats.length = 0;
  assert.equal(history.read().seats.length, initial.seats.length);
});

test("linked-object deletion fails atomically; complete multi-field replacements undo together", () => {
  const initial = newDraft("tideglass-steps");
  initial.arena.hazards.push({id:"test-shutter", x:5, y:0, w:.5, h:2, kind:"shutter", period:300, active:90, offset:0, angle:0});
  initial.arena.switches = [{id:"test-plate", x:-5, y:0, w:1, h:1, target:"test-shutter", duration:120}];
  const history = new StudioHistory(initial), invalid = history.read();
  invalid.arena.hazards = invalid.arena.hazards.filter(h => h.id !== "test-shutter");
  assert.throws(() => history.replace(invalid), /Switch must target/);
  assert.deepEqual(history.read(), initial); assert.equal(history.canUndo, false);
  invalid.arena.switches = []; history.replace(invalid);
  assert.deepEqual(history.undo(), initial); assert.deepEqual(history.redo(), invalid);
});

test("history keeps forty valid edits and rejects invalid initial documents", () => {
  assert.throws(() => new StudioHistory({}));
  const invalidSeed = newDraft(); invalidSeed.match.seed = -1;
  assert.throws(() => new StudioHistory(invalidSeed), /match.seed: enter a whole number from 0 to 4294967295/);
  const history = new StudioHistory(newDraft());
  for (let i = 0; i < 45; i++) { const next = history.read(); next.match.seed = i; history.replace(next); }
  let count = 0;
  while (history.canUndo) { parseDraft(history.undo()); count++; }
  assert.equal(count, 40); assert.equal(history.read().match.seed, 4);
});

test("accepted configuration survives history/export and drives identical natural seeded matches", () => {
  const history = new StudioHistory(newDraft("moss-court")), next = history.read();
  next.match = {...next.match, seed:41827, wins:3, enabledUpgrades:["guard"], stageIds:["moss-court", "lantern-foundry"]};
  next.seats.forEach((s,i) => {s.control="bot"; s.bot=i===0?"hard":"easy";});
  history.replace(next); history.undo(); history.redo();
  const restored = parseDraft(JSON.parse(JSON.stringify(history.read())));
  const run = () => {
    const state = createMatch({...restored.match, arenaDraft:restored.arena}, restored.seats.map(({control,...seat}) => seat));
    const upgrades = new Set<string>();
    while (state.phase !== "matchResults" && state.tick < 36000) {
      step(state, getBotInputs(state));
      state.events.filter(e => e.type === "pickupSpawn").forEach(e => upgrades.add(e.detail!));
    }
    assert.equal(state.phase, "matchResults");
    assert.equal(Math.max(...state.players.map(p => p.score)), 3);
    assert.ok(upgrades.size > 0); assert.deepEqual([...upgrades], ["guard"]);
    assert.equal(state.players[0].bot, "hard"); assert.equal(state.players[1].bot, "easy");
    return {hash:stateHash(state), tick:state.tick, round:state.round, winners:state.matchWinnerIds, scores:state.players.map(p => p.score)};
  };
  assert.deepEqual(run(), run());
});
