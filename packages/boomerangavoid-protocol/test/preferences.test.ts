import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseGamePreferences,
  parsePreferencesResponse,
  parsePreferencesWrite,
  preferenceValuesEqual,
  PREFERENCE_CHARACTER_IDS,
  type GamePreferences,
} from "../src/preferences.js";
import {
  AccountPreferencesBridge,
  AccountHistoryBridge,
  parseAccountHistory,
  type PreferenceClock,
} from "../../../games/boomerang-avoid/src/account.js";

const A = "123e4567-e89b-42d3-a456-426614174000",
  B = "223e4567-e89b-42d3-a456-426614174000";
const defaults = (): GamePreferences => ({
  music: 0.28,
  sfx: 0.65,
  reducedMotion: false,
  character: "pip",
});
const wire = (
  preferences: GamePreferences | null = defaults(),
  revision = 1,
  accountId = A,
) => ({ accountId, preferences, revision });
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
class Clock implements PreferenceClock {
  now = 0;
  next = 1;
  timers = new Map<number, { at: number; callback: () => void }>();
  setTimeout(callback: () => void, delay: number) {
    const id = this.next++;
    this.timers.set(id, { at: this.now + delay, callback });
    return id;
  }
  clearTimeout(handle: unknown) {
    this.timers.delete(handle as number);
  }
  advance(ms: number) {
    this.now += ms;
    for (let i = 0; i < 100; i++) {
      const due = [...this.timers.entries()]
        .filter(([, t]) => t.at <= this.now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) return;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    throw Error("Unexpected timer loop");
  }
}
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function harness() {
  const clock = new Clock();
  let local = defaults(),
    safe = true;
  const applied: GamePreferences[] = [];
  const requests: {
    url: string;
    init: RequestInit;
    resolve: (r: Response) => void;
    reject: (error: Error) => void;
  }[] = [];
  const bridge = new AccountPreferencesBridge({
    clock,
    read: () => ({ ...local }),
    apply: (value) => {
      local = { ...value };
      applied.push(value);
    },
    canApply: () => safe,
    fetch: (url, init) =>
      new Promise((resolve, reject) =>
        requests.push({ url, init, resolve, reject }),
      ),
  });
  return {
    bridge,
    clock,
    requests,
    applied,
    get local() {
      return local;
    },
    edit: (patch: Partial<GamePreferences>) => {
      local = { ...local, ...patch };
      bridge.changed();
    },
    safe: (value: boolean) => {
      safe = value;
    },
  };
}
async function initialized(
  h: ReturnType<typeof harness>,
  revision = 1,
  accountId = A,
) {
  const work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(response(wire(defaults(), revision, accountId)));
  await work;
}

test("preferences contract accepts only exact, bounded browser-safe values and copies input", () => {
  for (const character of PREFERENCE_CHARACTER_IDS) {
    const value = { music: 0, sfx: 1, reducedMotion: true, character };
    const parsed = parseGamePreferences(value)!;
    assert.deepEqual(parsed, value);
    assert.notEqual(parsed, value);
  }
  for (const bad of [
    null,
    [],
    {},
    { ...defaults(), music: -0.01 },
    { ...defaults(), music: 1.01 },
    { ...defaults(), music: NaN },
    { ...defaults(), music: Infinity },
    { ...defaults(), music: "0.5" },
    { ...defaults(), sfx: -1 },
    { ...defaults(), sfx: 2 },
    { ...defaults(), reducedMotion: 1 },
    { ...defaults(), character: "unknown" },
    { ...defaults(), touch: true },
    { ...defaults(), [Symbol("extra")]: 1 },
  ])
    assert.equal(parseGamePreferences(bad), null);
  assert.ok(preferenceValuesEqual(defaults(), defaults()));
  assert.equal(
    preferenceValuesEqual(defaults(), { ...defaults(), character: "comet" }),
    false,
  );
});
test("response and write contracts reject extra keys, malformed identity and unsafe revisions", () => {
  assert.deepEqual(parsePreferencesResponse(wire(null, 0)), wire(null, 0));
  assert.equal(
    parsePreferencesResponse(wire(defaults(), 0, A.toUpperCase()))!.accountId,
    A,
  );
  for (const revision of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "0",
  ])
    assert.equal(parsePreferencesResponse({ ...wire(), revision }), null);
  for (const bad of [
    { ...wire(), accountId: "not-an-account" },
    { ...wire(), extra: 1 },
    { ...wire(), preferences: { ...defaults(), bindings: {} } },
    { ...wire(), preferences: undefined },
  ])
    assert.equal(parsePreferencesResponse(bad), null);
  const write = { accountId: A, preferences: defaults(), expectedRevision: 0 };
  assert.deepEqual(parsePreferencesWrite(write), write);
  for (const bad of [
    { ...write, preferences: null },
    { ...write, expectedRevision: -1 },
    { ...write, expectedRevision: 1.1 },
    { ...write, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...write, revision: 0 },
    { ...write, accountId: "x" },
    { ...write, preferences: { ...defaults(), quality: "high" } },
  ])
    assert.equal(parsePreferencesWrite(bad), null);
});
test("a GET racing a local edit neither applies stale settings nor silently writes over the account", async () => {
  const h = harness(),
    work = h.bridge.refresh();
  await settle();
  h.edit({ music: 0.9 });
  h.requests[0].resolve(response(wire({ ...defaults(), music: 0.1 }, 4)));
  await work;
  h.clock.advance(1000);
  await settle();
  assert.equal(h.local.music, 0.9);
  assert.equal(h.applied.length, 0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.bridge.status.kind, "conflict");
  h.bridge.useAccount();
  assert.equal(h.local.music, 0.1);
  assert.equal(h.bridge.status.kind, "synced");
  assert.equal(h.requests.length, 1);
  h.bridge.dispose();
});
test("cloud settings wait for a safe menu point and never change active combat", async () => {
  const h = harness();
  h.safe(false);
  const work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(
    response(wire({ ...defaults(), character: "comet", music: 0.8 })),
  );
  await work;
  assert.equal(h.local.character, "pip");
  assert.equal(h.applied.length, 0);
  h.bridge.safePoint();
  assert.equal(h.applied.length, 0);
  h.safe(true);
  h.bridge.safePoint();
  assert.equal(h.local.character, "comet");
  assert.equal(h.local.music, 0.8);
  assert.equal(h.applied.length, 1);
  h.bridge.dispose();
});
test("500ms debounce serializes PUTs and preserves newer local edits while one save is in flight", async () => {
  const h = harness();
  await initialized(h, 2);
  h.edit({ music: 0.4 });
  h.clock.advance(499);
  await settle();
  assert.equal(h.requests.length, 1);
  h.clock.advance(1);
  await settle();
  assert.equal(h.requests.length, 2);
  const first = JSON.parse(h.requests[1].init.body as string);
  assert.deepEqual(first, {
    accountId: A,
    preferences: { ...defaults(), music: 0.4 },
    expectedRevision: 2,
  });
  assert.equal(h.requests[1].url, "/api/v1/boomerangavoid/preferences/");
  assert.equal(h.requests[1].init.credentials, "same-origin");
  assert.equal(h.requests[1].init.mode, "same-origin");
  h.edit({ sfx: 0.1 });
  h.clock.advance(1000);
  await settle();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(response(wire(first.preferences, 3)));
  await settle();
  assert.equal(h.local.sfx, 0.1);
  h.clock.advance(499);
  await settle();
  assert.equal(h.requests.length, 2);
  h.clock.advance(1);
  await settle();
  assert.equal(h.requests.length, 3);
  const second = JSON.parse(h.requests[2].init.body as string);
  assert.equal(second.expectedRevision, 3);
  assert.equal(second.preferences.sfx, 0.1);
  h.requests[2].resolve(response(wire(second.preferences, 4)));
  await settle();
  assert.equal(h.bridge.status.kind, "synced");
  assert.equal(h.applied.length, 0);
  h.bridge.dispose();
});
test("401,503 and offline failures retain immediately changed device settings without a login block", async () => {
  const h = harness();
  let work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(response({}, 401));
  await work;
  h.edit({ music: 0.7 });
  h.clock.advance(1000);
  await settle();
  assert.equal(h.local.music, 0.7);
  assert.equal(h.requests.length, 1);
  work = h.bridge.refresh();
  await settle();
  h.requests[1].resolve(response({}, 503));
  await work;
  assert.equal(h.bridge.status.kind, "device");
  assert.equal(h.local.music, 0.7);
  work = h.bridge.refresh();
  await settle();
  h.requests[2].reject(new Error("offline"));
  await work;
  assert.equal(h.local.music, 0.7);
  assert.equal(h.bridge.status.canSaveDevice, false);
  h.bridge.dispose();
});
test("a request aborts at 8 seconds even if the transport ignores its AbortSignal", async () => {
  const h = harness(),
    work = h.bridge.refresh();
  await settle();
  h.clock.advance(7999);
  await settle();
  assert.equal(h.requests[0].init.signal!.aborted, false);
  h.clock.advance(1);
  await work;
  assert.equal(h.requests[0].init.signal!.aborted, true);
  assert.equal(h.bridge.status.kind, "device");
  assert.equal(h.applied.length, 0);
  h.bridge.dispose();
});
test("409 refetches the latest revision and requires an explicit choice before another write", async () => {
  const h = harness();
  await initialized(h, 2);
  h.edit({ music: 0.5 });
  h.clock.advance(500);
  await settle();
  h.requests[1].resolve(response({}, 409));
  await settle();
  assert.equal(h.requests[2].init.method, "GET");
  h.requests[2].resolve(response(wire({ ...defaults(), music: 0.15 }, 3)));
  await settle();
  h.clock.advance(2000);
  await settle();
  assert.equal(h.requests.length, 3);
  assert.equal(h.local.music, 0.5);
  h.bridge.saveDevice();
  await settle();
  const body = JSON.parse(h.requests[3].init.body as string);
  assert.equal(body.expectedRevision, 3);
  assert.equal(body.preferences.music, 0.5);
  h.requests[3].resolve(response(wire(body.preferences, 4)));
  await settle();
  assert.equal(h.bridge.status.kind, "synced");
  h.bridge.dispose();
});
test("a cross-account conflict never carries queued edits into the new account automatically", async () => {
  const h = harness();
  await initialized(h, 1, A);
  h.edit({ music: 0.9 });
  h.clock.advance(500);
  await settle();
  assert.equal(JSON.parse(h.requests[1].init.body as string).accountId, A);
  h.requests[1].resolve(response({}, 409));
  await settle();
  h.requests[2].resolve(
    response(wire({ ...defaults(), character: "kiln", music: 0.2 }, 10, B)),
  );
  await settle();
  h.clock.advance(2000);
  await settle();
  assert.equal(h.requests.length, 3);
  assert.equal(h.local.music, 0.9);
  assert.equal(h.bridge.status.kind, "conflict");
  h.bridge.useAccount();
  assert.equal(h.local.music, 0.2);
  assert.equal(h.local.character, "kiln");
  assert.equal(h.requests.length, 3);
  h.edit({ sfx: 0.25 });
  h.clock.advance(500);
  await settle();
  const body = JSON.parse(h.requests[3].init.body as string);
  assert.equal(body.accountId, B);
  assert.equal(body.expectedRevision, 10);
  assert.equal(body.preferences.music, 0.2);
  h.requests[3].resolve(response(wire(body.preferences, 11, B)));
  await settle();
  h.bridge.dispose();
});
test("null account preferences stay local until the user chooses to initialize them", async () => {
  const h = harness(),
    work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(response(wire(null, 0)));
  await work;
  h.clock.advance(1000);
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.bridge.status.canSaveDevice, true);
  h.bridge.saveDevice();
  await settle();
  const body = JSON.parse(h.requests[1].init.body as string);
  assert.equal(body.expectedRevision, 0);
  h.requests[1].resolve(response(wire(body.preferences, 1)));
  await settle();
  assert.equal(h.bridge.status.kind, "synced");
  h.bridge.dispose();
});
test("an unavailable session clears a deferred cloud snapshot before returning to the menu", async () => {
  const h = harness();
  h.safe(false);
  let work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(response(wire({ ...defaults(), character: "comet" })));
  await work;
  work = h.bridge.refresh();
  await settle();
  h.requests[1].resolve(response({}, 401));
  await work;
  h.safe(true);
  h.bridge.safePoint();
  assert.equal(h.local.character, "pip");
  assert.equal(h.applied.length, 0);
  assert.equal(h.bridge.status.canSaveDevice, false);
  h.bridge.dispose();
});
test("a newer GET replaces a deferred snapshot rather than applying stale preferences later", async () => {
  const h = harness();
  h.safe(false);
  let work = h.bridge.refresh();
  await settle();
  h.requests[0].resolve(
    response(wire({ ...defaults(), character: "comet" }, 1)),
  );
  await work;
  work = h.bridge.refresh();
  await settle();
  h.requests[1].resolve(response(wire(defaults(), 2)));
  await work;
  h.safe(true);
  h.bridge.safePoint();
  assert.equal(h.local.character, "pip");
  assert.equal(h.applied.length, 0);
  h.bridge.dispose();
});

const historyRow = (id = A, character = "pip") => ({
  match_id: id,
  team: 0,
  score: 2,
  character,
  winner: false,
  ended_at: "2026-11-04T12:01:00Z",
  boomerangavoid_matches: {
    mode: "ffa",
    map_id: "moss-court",
    wins: 3,
    ruleset: "boomerangavoid-v1-rc.1",
    content_hash: "abcdef12",
    started_at: "2026-11-04T12:00:00Z",
    ended_at: "2026-11-04T12:01:00Z",
  },
});
function historyHarness(initial: string | null = A) {
  let accountId = initial,
    identityLost = 0;
  const clock = new Clock();
  const requests: {
    url: string;
    init: RequestInit;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
  }[] = [];
  const history = new AccountHistoryBridge({
    accountId: () => accountId,
    clock,
    now: () => clock.now,
    onIdentityLost: () => {
      identityLost++;
    },
    fetch: (url, init) =>
      new Promise((resolve, reject) =>
        requests.push({ url, init, resolve, reject }),
      ),
  });
  return {
    history,
    clock,
    requests,
    setAccount: (id: string | null) => {
      accountId = id;
      history.syncIdentity();
    },
    get identityLost() {
      return identityLost;
    },
  };
}
test("history accepts only a bounded, complete account result projection", () => {
  const row = historyRow();
  const parsed = parseAccountHistory({ matches: [row] })!;
  assert.equal(parsed[0].matchId, A);
  assert.equal(parsed[0].score, 2);
  assert.equal(parsed[0].match.mapId, "moss-court");
  assert.notEqual(parsed[0], row);
  for (const value of [
    null,
    [],
    { matches: [], accountId: A },
    { matches: Array.from({ length: 21 }, () => row) },
    { matches: [row, row] },
    { matches: [{ ...row, team: 2 }] },
    { matches: [{ ...row, score: 4 }] },
    { matches: [{ ...row, winner: 1 }] },
    { matches: [{ ...row, character: "<script>" }] },
    { matches: [{ ...row, account_id: A }] },
    { matches: [{ ...row, ended_at: "invalid" }] },
    { matches: [{ ...row, boomerangavoid_matches: null }] },
    {
      matches: [
        {
          ...row,
          boomerangavoid_matches: {
            ...row.boomerangavoid_matches,
            map_id: "<img src=x onerror=alert(1)>",
          },
        },
      ],
    },
    {
      matches: [
        {
          ...row,
          boomerangavoid_matches: {
            ...row.boomerangavoid_matches,
            ended_at: "2026-11-03T12:00:00Z",
          },
        },
      ],
    },
  ])
    assert.equal(parseAccountHistory(value), null);
});
test("history requires an established account, sends its same-origin identity guard, and caches a single flight", async () => {
  const h = historyHarness(null);
  await h.history.refresh();
  assert.equal(h.requests.length, 0);
  assert.equal(h.history.status.authenticated, false);
  h.setAccount(A);
  const first = h.history.refresh();
  void h.history.refresh();
  void h.history.refresh();
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "/api/v1/boomerangavoid/history/");
  assert.equal(h.requests[0].init.credentials, "same-origin");
  assert.equal(h.requests[0].init.mode, "same-origin");
  assert.equal(
    (h.requests[0].init.headers as Record<string, string>)[
      "X-Boomerangavoid-Account"
    ],
    A,
  );
  h.requests[0].resolve(response({ matches: [historyRow()] }));
  await first;
  assert.equal(h.history.status.matches.length, 1);
  await h.history.refresh();
  assert.equal(h.requests.length, 1);
  h.clock.advance(30001);
  const next = h.history.refresh();
  await settle();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(response({ matches: [] }));
  await next;
  assert.equal(h.history.status.kind, "ready");
  assert.equal(h.history.status.matches.length, 0);
  h.history.dispose();
});
test("history discards another account in-flight result and refreshes only for the current account", async () => {
  const h = historyHarness(A),
    first = h.history.refresh();
  await settle();
  h.setAccount(B);
  assert.equal(h.history.status.matches.length, 0);
  assert.equal(h.requests[0].init.signal!.aborted, true);
  h.requests[0].resolve(response({ matches: [historyRow(A)] }));
  await first;
  await settle();
  assert.equal(h.history.status.matches.length, 0);
  assert.equal(h.requests.length, 2);
  assert.equal(
    (h.requests[1].init.headers as Record<string, string>)[
      "X-Boomerangavoid-Account"
    ],
    B,
  );
  h.requests[1].resolve(response({ matches: [historyRow(B, "comet")] }));
  await settle();
  assert.deepEqual(
    h.history.status.matches.map((m) => m.matchId),
    [B],
  );
  assert.equal(h.history.status.matches[0].character, "comet");
  h.history.dispose();
});
test("a history identity conflict clears previous results and signals re-verification without fake records", async () => {
  const h = historyHarness(),
    first = h.history.refresh();
  await settle();
  h.requests[0].resolve(response({ matches: [historyRow()] }));
  await first;
  h.history.suspend();
  assert.equal(h.history.status.matches.length, 0);
  const next = h.history.refresh(true);
  await settle();
  h.requests[1].resolve(response({}, 409));
  await next;
  assert.equal(h.identityLost, 1);
  assert.equal(h.history.status.kind, "unavailable");
  assert.equal(h.history.status.matches.length, 0);
  h.setAccount(null);
  assert.equal(h.history.status.authenticated, false);
  h.history.dispose();
});
test("history times out after eight seconds and handles unavailable service safely", async () => {
  const h = historyHarness(),
    first = h.history.refresh();
  await settle();
  h.clock.advance(8000);
  await first;
  assert.equal(h.requests[0].init.signal!.aborted, true);
  assert.equal(h.history.status.kind, "unavailable");
  assert.deepEqual(h.history.status.matches, []);
  const second = h.history.refresh(true);
  await settle();
  h.requests[1].resolve(response({}, 503));
  await second;
  assert.equal(h.history.status.kind, "unavailable");
  assert.equal(h.identityLost, 0);
  assert.deepEqual(h.history.status.matches, []);
  h.history.dispose();
});
