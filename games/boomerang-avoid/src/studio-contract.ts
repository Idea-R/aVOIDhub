import {
  ARENAS,
  CHARACTERS,
  UPGRADES,
  type Arena,
  type MatchConfig,
  type Seat,
} from "@avoid/boomerangavoid-sim";
import type { Control } from "./input";

export const STUDIO_SCHEMA = "boomerangavoid-ads";
export const BIOMES = {
  garden: {
    name: "Moss & honey",
    ground: 0xa8b58a,
    sky: 0x15383c,
    color: 0x9bc97d,
  },
  dusk: {
    name: "Violet dusk",
    ground: 0x85869f,
    sky: 0x292c49,
    color: 0xd3a4ec,
  },
  tide: { name: "Tideglass", ground: 0x8bb8ae, sky: 0x173f52, color: 0x87dcd5 },
  ember: {
    name: "Ember orchard",
    ground: 0xb48a73,
    sky: 0x392d39,
    color: 0xf3b57c,
  },
} as const;
export interface StudioDraft {
  schema: typeof STUDIO_SCHEMA;
  version: 1;
  label: string;
  biome: keyof typeof BIOMES;
  arena: Arena;
  match: MatchConfig;
  seats: (Seat & { control: Control })[];
}
export const copy = <T>(value: T): T => structuredClone(value);
export function newDraft(mapId = "tideglass-steps"): StudioDraft {
  const arena = copy(ARENAS.find((a) => a.id === mapId) || ARENAS[0]);
  return {
    schema: STUDIO_SCHEMA,
    version: 1,
    label: arena.name + " draft",
    biome: "garden",
    arena,
    match: {
      mode: "ffa",
      wins: 3,
      mapId: arena.id,
      seed: 1337,
      friendlyFire: false,
      upgrades: true,
      enabledUpgrades: UPGRADES.map((u) => u.id),
      stageIds: [arena.id],
    },
    seats: CHARACTERS.slice(0, 4).map((c, i) => ({
      id: `studio-${i}`,
      name: i ? `Bot ${i}` : "You",
      character: c.id,
      color: c.color,
      team: i % 2,
      bot: i ? "normal" : null,
      control: i ? "bot" : "keyboard1",
    })),
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max = 80): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const identifier = (v: unknown): v is string =>
  text(v, 40) &&
  /^[a-zA-Z0-9_-]+$/.test(v) &&
  !Object.hasOwn(Object.prototype, v) &&
  v !== "prototype";
const keys = (v: object, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
/** Strict local draft boundary. Imported JSON never mutates canonical maps or enters a room. */
export function parseDraft(value: unknown): StudioDraft {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (
    !record(value) ||
    !keys(value, [
      "schema",
      "version",
      "label",
      "biome",
      "arena",
      "match",
      "seats",
    ]) ||
    value.schema !== STUDIO_SCHEMA ||
    value.version !== 1 ||
    !text(value.label) ||
    !Object.hasOwn(BIOMES, String(value.biome))
  )
    fail("Unsupported studio document.");
  const v = value as unknown as StudioDraft,
    a = v.arena;
  if (
    !record(a) ||
    !keys(a, [
      "id",
      "name",
      "subtitle",
      "color",
      "ground",
      "sky",
      "width",
      "height",
      "spawns",
      "obstacles",
      "hazards",
      "targets",
      "platforms",
      "switches",
    ]) ||
    !ARENAS.some((template) => template.id === a.id) ||
    !text(a.name) ||
    !text(a.subtitle, 160) ||
    !finite(a.width, 12, 30) ||
    !finite(a.height, 10, 24) ||
    ![a.color, a.ground, a.sky].every(
      (n) => finite(n, 0, 0xffffff) && Number.isInteger(n),
    )
  )
    fail("Invalid arena identity, size or palette.");
  const ids = new Set<string>();
  const point = (p: unknown): p is { x: number; y: number } =>
    record(p) &&
    finite(p.x, -a.width / 2 + 0.5, a.width / 2 - 0.5) &&
    finite(p.y, -a.height / 2 + 0.5, a.height / 2 - 0.5);
  for (const [field, min, max] of [
    ["spawns", 6, 6],
    ["targets", 2, 2],
    ["obstacles", 0, 48],
    ["hazards", 0, 24],
    ["platforms", 0, 8],
    ["switches", 0, 8],
  ] as const) {
    const list = a[field] || [];
    if (!Array.isArray(list) || list.length < min || list.length > max)
      fail(`Invalid ${field} count.`);
    for (const p of list) {
      if (!point(p)) fail(`${field}: position must fit inside the arena.`);
      if (field === "spawns" || field === "targets") {
        if (!keys(p, ["x", "y"])) fail("Unknown position field.");
        continue;
      }
      const o = p as unknown as Record<string, unknown>;
      const allowed =
        field === "obstacles"
          ? ["id", "x", "y", "w", "h", "height", "kind"]
          : field === "hazards"
            ? [
                "id",
                "x",
                "y",
                "w",
                "h",
                "kind",
                "angle",
                "period",
                "active",
                "offset",
                "pair",
              ]
            : field === "platforms"
              ? ["id", "x", "y", "w", "h", "to", "period", "offset"]
              : ["id", "x", "y", "w", "h", "target", "duration"];
      if (
        !keys(o, allowed) ||
        !identifier(o.id) ||
        ids.has(o.id) ||
        !finite(o.w, 0.25, a.width) ||
        !finite(o.h, 0.25, a.height)
      )
        fail(`${field}: invalid shape or duplicate ID.`);
      ids.add(o.id as string);
      if (
        Math.abs(p.x) + (o.w as number) / 2 > a.width / 2 ||
        Math.abs(p.y) + (o.h as number) / 2 > a.height / 2
      )
        fail("Object extends beyond the arena.");
      if (
        field === "obstacles" &&
        (!finite(o.height, 0.1, 3) ||
          !["stone", "hedge", "kiln", "pillar", "shutter"].includes(
            String(o.kind),
          ))
      )
        fail("Invalid obstacle.");
      if (
        field === "hazards" &&
        (!["vent", "gap", "wind", "gate", "conveyor", "shutter"].includes(
          String(o.kind),
        ) ||
          !finite(o.angle, -Math.PI * 2, Math.PI * 2) ||
          !finite(o.period, 1, 3600) ||
          !Number.isInteger(o.period) ||
          !finite(o.active, 0, o.period as number) ||
          !finite(o.offset, 0, 3600) ||
          (o.pair !== undefined && !text(o.pair, 40)))
      )
        fail("Invalid hazard timing or type.");
      if (
        field === "hazards" &&
        o.kind === "gap" &&
        (o.period !== 1 || o.active !== 1 || o.offset !== 0)
      )
        fail("Pits must be permanent gaps: period 1, active 1, offset 0.");
      if (
        field === "platforms" &&
        (!point(o.to) ||
          !keys(o.to, ["x", "y"]) ||
          !finite(o.period, 60, 3600) ||
          !Number.isInteger(o.period) ||
          !finite(o.offset, 0, 3600) ||
          Math.abs(o.to.x) + (o.w as number) / 2 > a.width / 2 ||
          Math.abs(o.to.y) + (o.h as number) / 2 > a.height / 2)
      )
        fail("Invalid platform path.");
      if (
        field === "switches" &&
        (!text(o.target, 40) || !finite(o.duration, 30, 900))
      )
        fail("Invalid switch target or duration.");
    }
  }
  for (const h of a.hazards)
    if (
      h.kind === "gate" &&
      !a.hazards.some(
        (other) =>
          other.id === h.pair && other.kind === "gate" && other.pair === h.id,
      )
    )
      fail("Gates need reciprocal pairs.");
  for (const sw of a.switches || [])
    if (!a.hazards.some((h) => h.id === sw.target && h.kind === "shutter"))
      fail("Switch must target an existing shutter.");
  const blocked = (p: { x: number; y: number }) =>
    [...a.obstacles, ...a.hazards.filter((h) => h.kind === "gap")].some(
      (o) =>
        Math.abs(p.x - o.x) < o.w / 2 + 0.4 &&
        Math.abs(p.y - o.y) < o.h / 2 + 0.4,
    );
  if (
    a.spawns.some(blocked) ||
    a.spawns.some((p, i) =>
      a.spawns.some((q, j) => i < j && Math.hypot(p.x - q.x, p.y - q.y) < 1),
    )
  )
    fail("Spawns overlap a pit, obstacle or each other.");
  if (
    !record(v.match) ||
    !keys(v.match, [
      "mode",
      "wins",
      "mapId",
      "seed",
      "friendlyFire",
      "upgrades",
      "enabledUpgrades",
      "stageIds",
    ]) ||
    !["ffa", "teams", "relay"].includes(v.match.mode) ||
    ![3, 5, 7].includes(v.match.wins) ||
    v.match.mapId !== a.id ||
    typeof v.match.friendlyFire !== "boolean" ||
    typeof v.match.upgrades !== "boolean"
  )
    fail("Invalid match rules.");
  if (!finite(v.match.seed, 0, 0xffffffff) || !Number.isInteger(v.match.seed))
    fail("match.seed: enter a whole number from 0 to 4294967295.");
  if (
    v.match.stageIds !== undefined &&
    (!Array.isArray(v.match.stageIds) ||
      !v.match.stageIds.length ||
      v.match.stageIds.length > 6 ||
      v.match.stageIds.some((id) => !ARENAS.some((a) => a.id === id)))
  )
    fail("Choose one to six known stages.");
  if (
    v.match.enabledUpgrades !== undefined &&
    (!Array.isArray(v.match.enabledUpgrades) ||
      new Set(v.match.enabledUpgrades).size !==
        v.match.enabledUpgrades.length ||
      v.match.enabledUpgrades.some((id) => !UPGRADES.some((u) => u.id === id)))
  )
    fail("Invalid power-up pool.");
  if (
    !Array.isArray(v.seats) ||
    v.seats.length < 2 ||
    v.seats.length > 6 ||
    new Set(v.seats.map((s) => s.id)).size !== v.seats.length
  )
    fail("Choose two to six unique seats.");
  for (const s of v.seats)
    if (
      !record(s) ||
      !keys(s, [
        "id",
        "name",
        "character",
        "color",
        "team",
        "bot",
        "control",
      ]) ||
      !identifier(s.id) ||
      !text(s.name, 18) ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !finite(s.color, 0, 0xffffff) ||
      !Number.isInteger(s.color) ||
      ![0, 1].includes(s.team) ||
      ![null, "easy", "normal", "hard"].includes(s.bot) ||
      !/^(keyboard[12]|pad[0-5]|bot)$/.test(s.control) ||
      (s.control === "bot") !== (s.bot !== null)
    )
      fail("Invalid player or bot seat.");
  const humans = v.seats.filter((s) => s.control !== "bot");
  if (
    new Set(humans.map((s) => s.control)).size !== humans.length ||
    (v.match.mode !== "ffa" && new Set(v.seats.map((s) => s.team)).size !== 2)
  )
    fail("Inputs must be unique; team modes need both teams.");
  return copy(v);
}

export function agentBrief(draft: StudioDraft): string {
  return `Design an original BoomerangaVOID arena as JSON using schema ${STUDIO_SCHEMA} version 1. Start from the attached complete draft. Preserve its schema and IDs, six safe spawns, two targets, finite bounded shapes and reciprocal gates. Tune cover, readable dash gaps, moving-floor endpoints and pressure switches linked to shutters. Keep two to six human/bot seats and legal rules. Return only a complete JSON document; no code or external URLs. The local ADS validator and real playtest must pass before repository promotion. No online publication or account access.\n\n${JSON.stringify(draft, null, 2)}`;
}
