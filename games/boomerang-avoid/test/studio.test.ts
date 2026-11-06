import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARENAS,
  createMatch,
  getArena,
  UPGRADES,
} from "@avoid/boomerangavoid-sim";
import { parseConfig } from "@avoid/boomerangavoid-protocol";
import { newDraft, parseDraft, agentBrief } from "../src/studio-contract";

test("every canonical stage round trips as detached bounded ADS data", () => {
  for (const arena of ARENAS) {
    const draft = newDraft(arena.id),
      parsed = parseDraft(JSON.parse(JSON.stringify(draft)));
    parsed.arena.spawns[0].x += 0.1;
    assert.notEqual(parsed.arena.spawns[0].x, arena.spawns[0].x);
    assert.equal(draft.arena.spawns[0].x, arena.spawns[0].x);
  }
});
test("edited biome and stage geometry reach actual simulation without changing the registry", () => {
  const draft = newDraft("moss-court");
  draft.arena.name = "Moon orchard";
  draft.arena.ground = 0x85869f;
  draft.match.enabledUpgrades = ["tailwind"];
  draft.match.stageIds = ["moss-court", "lantern-foundry"];
  const safe = parseDraft(draft),
    state = createMatch({ ...safe.match, arenaDraft: safe.arena }, safe.seats);
  assert.equal(getArena(state).name, "Moon orchard");
  assert.notEqual(ARENAS[0].name, "Moon orchard");
  assert.deepEqual(state.config.enabledUpgrades, ["tailwind"]);
  state.round = 2;
  assert.equal(getArena(state).id, "lantern-foundry");
});
test("imports reject non-finite geometry, huge counts, invalid fields and unsafe spawn overlap", () => {
  const bad = [
    (d: any) => (d.arena.width = Infinity),
    (d: any) => (d.arena.obstacles = Array(49).fill(d.arena.obstacles[0])),
    (d: any) => (d.arena.obstacles[0].script = "bad"),
    (d: any) => (d.arena.spawns[0] = { ...d.arena.spawns[1] }),
    (d: any) =>
      (d.arena.platforms = [
        {
          id: "p",
          x: 0,
          y: 0,
          w: 2,
          h: 2,
          to: { x: NaN, y: 0 },
          period: 120,
          offset: 0,
        },
      ]),
  ];
  for (const mutate of bad) {
    const d = newDraft("moss-court");
    mutate(d);
    assert.throws(() => parseDraft(d));
  }
});
test("bad switch links, power pools, seats and stage sequences are rejected", () => {
  for (const mutate of [
    (d: any) =>
      (d.arena.switches = [
        { id: "s", x: 0, y: 0, w: 1, h: 1, target: "missing", duration: 120 },
      ]),
    (d: any) => (d.match.enabledUpgrades = ["guard", "guard"]),
    (d: any) => (d.match.stageIds = ["missing"]),
    (d: any) => (d.seats[1].control = "keyboard1"),
    (d: any) => (d.seats[0].name = "<b>".repeat(12)),
  ]) {
    const d = newDraft();
    mutate(d);
    assert.throws(() => parseDraft(d));
  }
});
test("online protocol refuses studio geometry and stage overrides, accepts bounded power selection", () => {
  const d = newDraft("moss-court"),
    { stageIds: _stage, ...match } = d.match;
  assert.equal(parseConfig({ ...match, arenaDraft: d.arena }), null);
  assert.equal(parseConfig(d.match), null);
  assert.deepEqual(
    parseConfig({ ...match, enabledUpgrades: ["guard", "twin"] })
      ?.enabledUpgrades,
    ["guard", "twin"],
  );
  assert.equal(parseConfig({ ...match, enabledUpgrades: ["unknown"] }), null);
});
test("agent exchange contains complete schema, explicit bounded workflow and legal power IDs", () => {
  const d = newDraft();
  assert.match(agentBrief(d), /boomerangavoid-ads/);
  assert.match(agentBrief(d), /real playtest/);
  assert.deepEqual(
    d.match.enabledUpgrades,
    UPGRADES.map((u) => u.id),
  );
});
test("reserved dictionary IDs and periodic pits cannot pass the draft boundary", () => {
  for (const id of [
    "__proto__",
    "constructor",
    "prototype",
    "hasOwnProperty",
  ]) {
    const d = newDraft();
    d.seats[0].id = id;
    assert.throws(() => parseDraft(d));
    const o = newDraft("moss-court");
    o.arena.obstacles[0].id = id;
    assert.throws(() => parseDraft(o));
  }
  const d = newDraft();
  d.arena.hazards.find((h) => h.kind === "gap")!.active = 0;
  assert.throws(() => parseDraft(d), /permanent/);
});
