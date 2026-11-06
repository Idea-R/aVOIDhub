import {
  parseGamePreferences,
  parsePreferencesResponse,
  preferenceValuesEqual,
  type GamePreferences,
  type PreferencesResponse,
} from "@avoid/boomerangavoid-protocol/preferences";

const ENDPOINT = "/api/v1/boomerangavoid/preferences/";
export interface AccountPreferencesStatus {
  kind: "device" | "loading" | "saving" | "synced" | "conflict";
  message: string;
  canUseAccount: boolean;
  canSaveDevice: boolean;
}
export interface PreferenceClock {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}
export interface AccountPreferencesOptions {
  read: () => GamePreferences;
  apply: (preferences: GamePreferences) => void;
  canApply: () => boolean;
  onStatus?: () => void;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  clock?: PreferenceClock;
}
/** Optimistic revision sync. Local edits are never rolled back by a network failure. */
export class AccountPreferencesBridge {
  private snapshot: PreferencesResponse | null = null;
  private lastAccountId: string | null = null;
  private edits = 0;
  private dirty = false;
  private blocked = false;
  private pendingApply: {
    snapshot: PreferencesResponse;
    edits: number;
  } | null = null;
  private putInFlight = false;
  private getInFlight: Promise<void> | null = null;
  private debounce: unknown;
  private disposed = false;
  private controllers = new Set<AbortController>();
  private state: Pick<AccountPreferencesStatus, "kind" | "message"> = {
    kind: "device",
    message: "Saved to this device.",
  };
  private lastStatus = "";
  private clock: PreferenceClock;
  private request: (url: string, init: RequestInit) => Promise<Response>;
  constructor(private options: AccountPreferencesOptions) {
    this.clock = options.clock || {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (handle) =>
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.request = options.fetch || ((url, init) => fetch(url, init));
  }
  get authenticatedAccountId() {
    return this.disposed ? null : this.snapshot?.accountId || null;
  }
  invalidateAccount() {
    this.snapshot = null;
    this.pendingApply = null;
    this.blocked = true;
    this.cancelDebounce();
    this.notify("device", "Saved to this device.");
  }
  get status(): AccountPreferencesStatus {
    const idle = !this.putInFlight && !this.getInFlight;
    return {
      ...this.state,
      canUseAccount:
        idle &&
        !!this.snapshot?.preferences &&
        this.options.canApply() &&
        (this.blocked || !!this.pendingApply),
      canSaveDevice:
        idle &&
        !!this.snapshot &&
        (this.blocked || this.dirty || this.snapshot.preferences === null),
    };
  }
  private notify(kind = this.state.kind, message = this.state.message) {
    if (this.disposed) return;
    this.state = { kind, message };
    const key = JSON.stringify(this.status);
    if (key !== this.lastStatus) {
      this.lastStatus = key;
      this.options.onStatus?.();
    }
  }
  private cancelDebounce() {
    if (this.debounce !== undefined) this.clock.clearTimeout(this.debounce);
    this.debounce = undefined;
  }
  private schedule() {
    this.cancelDebounce();
    if (
      this.disposed ||
      !this.snapshot ||
      this.blocked ||
      this.getInFlight ||
      this.putInFlight ||
      !this.dirty
    )
      return;
    this.debounce = this.clock.setTimeout(() => {
      this.debounce = undefined;
      void this.flush();
    }, 500);
  }
  changed() {
    if (this.disposed) return;
    this.edits++;
    this.dirty = true;
    if (this.pendingApply) {
      this.pendingApply = null;
      this.blocked = true;
    }
    if (this.blocked)
      this.notify(
        "conflict",
        "Saved to device. Choose which account settings to keep.",
      );
    else if (this.snapshot)
      this.notify("saving", "Saved to device. Saving to account...");
    else this.notify("device", "Saved to this device.");
    this.schedule();
  }
  private async call(init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    this.controllers.add(controller);
    let timeout: unknown;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = this.clock.setTimeout(() => {
        controller.abort();
        reject(new Error("Preference request timed out"));
      }, 8000);
    });
    try {
      return await Promise.race([
        this.request(ENDPOINT, {
          ...init,
          credentials: "same-origin",
          mode: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        }),
        deadline,
      ]);
    } finally {
      this.clock.clearTimeout(timeout);
      this.controllers.delete(controller);
    }
  }
  async refresh(): Promise<void> {
    if (this.disposed) return;
    if (this.getInFlight) return this.getInFlight;
    if (this.putInFlight) return;
    if (this.dirty && this.snapshot && !this.blocked) {
      this.schedule();
      return;
    }
    const atStart = this.edits;
    this.cancelDebounce();
    // The microtask ensures getInFlight is established before status callbacks run.
    const work = Promise.resolve().then(async () => {
      this.notify("loading", "Saved to device. Checking account settings...");
      try {
        const response = await this.call({
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (this.disposed) return;
        if (!response.ok) {
          this.snapshot = null;
          this.pendingApply = null;
          this.notify("device", "Saved to this device.");
          return;
        }
        const snapshot = parsePreferencesResponse(await response.json());
        if (this.disposed) return;
        if (!snapshot) throw new Error("Invalid preference response");
        const changedAccount =
          this.lastAccountId !== null &&
          this.lastAccountId !== snapshot.accountId;
        this.snapshot = snapshot;
        this.lastAccountId = snapshot.accountId;
        this.pendingApply = null;
        if (changedAccount) {
          this.pendingApply = null;
          this.blocked = true;
          this.cancelDebounce();
          this.notify(
            "conflict",
            "Account changed. Choose which settings to keep.",
          );
          return;
        }
        if (this.blocked || this.edits !== atStart || this.dirty) {
          this.pendingApply = null;
          this.blocked = true;
          this.notify(
            "conflict",
            "Saved to device. Account settings changed; choose which to keep.",
          );
          return;
        }
        if (snapshot.preferences === null) {
          this.notify(
            "device",
            "Saved to device. You can also save to your account.",
          );
          return;
        }
        if (preferenceValuesEqual(this.options.read(), snapshot.preferences)) {
          this.dirty = false;
          this.notify("synced", "Saved to device and account.");
          return;
        }
        this.pendingApply = { snapshot, edits: this.edits };
        this.safePoint();
        if (this.pendingApply)
          this.notify(
            "device",
            "Saved to device. Account settings will load in the menu.",
          );
      } catch {
        this.pendingApply = null;
        if (!this.disposed)
          this.notify(
            "device",
            "Saved to device. Account sync is unavailable.",
          );
      }
    });
    this.getInFlight = work;
    try {
      await work;
    } finally {
      if (this.getInFlight === work) this.getInFlight = null;
      this.notify();
    }
  }
  safePoint() {
    const pending = this.pendingApply;
    if (
      this.disposed ||
      !pending ||
      this.blocked ||
      this.dirty ||
      pending.edits !== this.edits ||
      !this.options.canApply()
    )
      return;
    this.pendingApply = null;
    if (pending.snapshot.preferences)
      this.options.apply({ ...pending.snapshot.preferences });
    this.notify("synced", "Saved to device and account.");
  }
  useAccount() {
    if (!this.status.canUseAccount) return;
    const preferences = this.snapshot?.preferences;
    if (!preferences) return;
    this.cancelDebounce();
    this.edits++;
    this.dirty = false;
    this.blocked = false;
    this.pendingApply = null;
    this.options.apply({ ...preferences });
    this.notify("synced", "Saved to device and account.");
  }
  saveDevice() {
    if (!this.status.canSaveDevice) return;
    this.cancelDebounce();
    this.blocked = false;
    this.pendingApply = null;
    this.dirty = true;
    void this.flush();
  }
  private async flush() {
    if (
      this.disposed ||
      this.putInFlight ||
      this.getInFlight ||
      !this.snapshot ||
      this.blocked ||
      !this.dirty
    )
      return;
    const preferences = parseGamePreferences(this.options.read());
    if (!preferences) {
      this.notify("device", "Saved to this device.");
      return;
    }
    const accountId = this.snapshot.accountId,
      expectedRevision = this.snapshot.revision,
      sentEdits = this.edits;
    this.putInFlight = true;
    let success = false,
      conflict = false;
    this.notify("saving", "Saved to device. Saving to account...");
    try {
      const response = await this.call({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ accountId, preferences, expectedRevision }),
      });
      if (this.disposed) return;
      if (response.status === 409) {
        this.blocked = true;
        this.pendingApply = null;
        conflict = true;
        this.notify(
          "conflict",
          "Account settings changed. Choose which settings to keep.",
        );
        return;
      }
      if (!response.ok) {
        if (response.status === 401) this.snapshot = null;
        throw new Error("Preference write unavailable");
      }
      const snapshot = parsePreferencesResponse(await response.json());
      if (this.disposed) return;
      if (
        !snapshot ||
        snapshot.accountId !== accountId ||
        snapshot.revision < expectedRevision ||
        !snapshot.preferences ||
        !preferenceValuesEqual(snapshot.preferences, preferences)
      ) {
        this.blocked = true;
        conflict = true;
        this.notify(
          "conflict",
          "Account settings changed. Choose which settings to keep.",
        );
        return;
      }
      this.snapshot = snapshot;
      this.lastAccountId = snapshot.accountId;
      success = true;
      this.dirty = this.edits !== sentEdits;
      this.notify(
        this.dirty ? "saving" : "synced",
        this.dirty
          ? "Saved to device. Saving your latest changes..."
          : "Saved to device and account.",
      );
    } catch {
      if (!this.disposed)
        this.notify("device", "Saved to device. Account sync is unavailable.");
    } finally {
      this.putInFlight = false;
      this.notify();
      if (!this.disposed && conflict) await this.refresh();
      else if (success && this.dirty) this.schedule();
    }
  }
  dispose() {
    this.disposed = true;
    this.cancelDebounce();
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}

export interface RecentAccountMatch {
  matchId: string;
  team: 0 | 1;
  score: number;
  character: GamePreferences["character"];
  winner: boolean;
  endedAt: string;
  match: {
    mode: "ffa" | "teams" | "relay";
    mapId: string;
    wins: 3 | 5 | 7;
    ruleset: string;
    contentHash: string;
    startedAt: string;
    endedAt: string;
  };
}
const exactHistory = (
  v: unknown,
  keys: string[],
): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  Reflect.ownKeys(v).length === keys.length &&
  keys.every((k) => Object.prototype.hasOwnProperty.call(v, k));
const historyDate = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 45 &&
  /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
/** Accept only the bounded projection returned by the authenticated history route. */
export function parseAccountHistory(
  value: unknown,
): RecentAccountMatch[] | null {
  if (
    !exactHistory(value, ["matches"]) ||
    !Array.isArray(value.matches) ||
    value.matches.length > 20
  )
    return null;
  const matches: RecentAccountMatch[] = [],
    ids = new Set<string>();
  for (const row of value.matches) {
    if (
      !exactHistory(row, [
        "match_id",
        "team",
        "score",
        "character",
        "winner",
        "ended_at",
        "boomerangavoid_matches",
      ]) ||
      typeof row.match_id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        row.match_id,
      ) ||
      ![0, 1].includes(row.team as number) ||
      typeof row.score !== "number" ||
      !Number.isSafeInteger(row.score) ||
      row.score < 0 ||
      typeof row.winner !== "boolean" ||
      !historyDate(row.ended_at)
    )
      return null;
    const character = parseGamePreferences({
      music: 0,
      sfx: 0,
      reducedMotion: false,
      character: row.character,
    })?.character;
    const m = row.boomerangavoid_matches;
    if (
      !character ||
      !exactHistory(m, [
        "mode",
        "map_id",
        "wins",
        "ruleset",
        "content_hash",
        "started_at",
        "ended_at",
      ]) ||
      !["ffa", "teams", "relay"].includes(m.mode as string) ||
      ![3, 5, 7].includes(m.wins as number) ||
      typeof m.map_id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(m.map_id) ||
      typeof m.ruleset !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(m.ruleset) ||
      typeof m.content_hash !== "string" ||
      !/^[a-f0-9]{8,128}$/i.test(m.content_hash) ||
      !historyDate(m.started_at) ||
      !historyDate(m.ended_at) ||
      Date.parse(m.ended_at) < Date.parse(m.started_at) ||
      Date.parse(m.ended_at) - Date.parse(m.started_at) > 86400000 ||
      row.score > (m.mode === "relay" ? 3 : (m.wins as number))
    )
      return null;
    const matchId = row.match_id.toLowerCase();
    if (ids.has(matchId)) return null;
    ids.add(matchId);
    matches.push({
      matchId,
      team: row.team as 0 | 1,
      score: row.score,
      character,
      winner: row.winner,
      endedAt: row.ended_at,
      match: {
        mode: m.mode as "ffa" | "teams" | "relay",
        mapId: m.map_id,
        wins: m.wins as 3 | 5 | 7,
        ruleset: m.ruleset,
        contentHash: m.content_hash,
        startedAt: m.started_at,
        endedAt: m.ended_at,
      },
    });
  }
  return matches.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}
export interface AccountHistoryOptions {
  accountId: () => string | null;
  onStatus?: () => void;
  onIdentityLost?: () => void;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  clock?: PreferenceClock;
  now?: () => number;
}
export class AccountHistoryBridge {
  private accountId: string | null = null;
  private matches: RecentAccountMatch[] = [];
  private loadedAt = 0;
  private verified = false;
  private kind: "idle" | "loading" | "ready" | "unavailable" = "idle";
  private generation = 0;
  private disposed = false;
  private flight: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private clock: PreferenceClock;
  private request: (url: string, init: RequestInit) => Promise<Response>;
  constructor(private options: AccountHistoryOptions) {
    this.clock = options.clock || {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (handle) =>
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.request = options.fetch || ((url, init) => fetch(url, init));
  }
  get status() {
    const authenticated =
      !this.disposed &&
      this.accountId !== null &&
      this.accountId === this.options.accountId();
    return {
      authenticated,
      kind: this.kind,
      matches: authenticated && this.verified ? this.matches : [],
    };
  }
  syncIdentity() {
    const id = this.options.accountId();
    if (id === this.accountId) return;
    this.generation++;
    this.controller?.abort();
    this.accountId = id;
    this.matches = [];
    this.loadedAt = 0;
    this.verified = false;
    this.kind = "idle";
    this.options.onStatus?.();
  }
  suspend() {
    this.generation++;
    this.controller?.abort();
    this.verified = false;
    this.kind = "loading";
    this.options.onStatus?.();
  }
  async refresh(force = false): Promise<void> {
    if (this.disposed) return;
    this.syncIdentity();
    if (!this.accountId) return;
    if (this.flight) return this.flight;
    const now = (this.options.now || Date.now)();
    if (!force && this.verified && now - this.loadedAt < 30000) return;
    const accountId = this.accountId,
      generation = this.generation,
      controller = new AbortController();
    this.controller = controller;
    this.kind = "loading";
    this.verified = false;
    const work = Promise.resolve().then(async () => {
      this.options.onStatus?.();
      let timeout: unknown;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = this.clock.setTimeout(() => {
          controller.abort();
          reject(new Error("History request timed out"));
        }, 8000);
      });
      try {
        const response = await Promise.race([
          this.request("/api/v1/boomerangavoid/history/", {
            method: "GET",
            credentials: "same-origin",
            mode: "same-origin",
            cache: "no-store",
            redirect: "error",
            headers: {
              Accept: "application/json",
              "X-Boomerangavoid-Account": accountId,
            },
            signal: controller.signal,
          }),
          deadline,
        ]);
        if (
          this.disposed ||
          generation !== this.generation ||
          accountId !== this.options.accountId()
        )
          return;
        if (!response.ok) {
          this.matches = [];
          this.loadedAt = 0;
          this.kind = "unavailable";
          if (response.status === 401 || response.status === 409)
            this.options.onIdentityLost?.();
          return;
        }
        const matches = parseAccountHistory(await response.json());
        if (
          this.disposed ||
          generation !== this.generation ||
          accountId !== this.options.accountId()
        )
          return;
        if (!matches) throw new Error("Invalid match history");
        this.matches = matches;
        this.loadedAt = (this.options.now || Date.now)();
        this.verified = true;
        this.kind = "ready";
      } catch {
        if (
          !this.disposed &&
          generation === this.generation &&
          accountId === this.options.accountId()
        ) {
          this.matches = [];
          this.verified = false;
          this.kind = "unavailable";
        }
      } finally {
        this.clock.clearTimeout(timeout);
      }
    });
    this.flight = work;
    try {
      await work;
    } finally {
      if (this.flight === work) {
        this.flight = null;
        this.controller = null;
        this.syncIdentity();
        this.options.onStatus?.();
        if (!this.disposed && generation !== this.generation && this.accountId)
          void this.refresh(true);
      }
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.matches = [];
  }
}
