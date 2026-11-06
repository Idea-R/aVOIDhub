import type { CharacterId } from "@avoid/boomerangavoid-sim";

/** Browser-safe wire contract. Device input and graphics settings never cross this boundary. */
export const PREFERENCE_CHARACTER_IDS: readonly CharacterId[] = [
  "pip",
  "kiln",
  "volt",
  "nori",
  "cairn",
  "comet",
];
export interface GamePreferences {
  music: number;
  sfx: number;
  reducedMotion: boolean;
  character: CharacterId;
}
export interface PreferencesResponse {
  accountId: string;
  preferences: GamePreferences | null;
  revision: number;
}
export interface PreferencesWrite {
  accountId: string;
  preferences: GamePreferences;
  expectedRevision: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function exact(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const own = Reflect.ownKeys(value);
  return (
    own.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}
const unit = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const revision = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export function parseGamePreferences(value: unknown): GamePreferences | null {
  if (
    !exact(value, ["music", "sfx", "reducedMotion", "character"]) ||
    !unit(value.music) ||
    !unit(value.sfx) ||
    typeof value.reducedMotion !== "boolean" ||
    !PREFERENCE_CHARACTER_IDS.includes(value.character as CharacterId)
  )
    return null;
  return {
    music: value.music,
    sfx: value.sfx,
    reducedMotion: value.reducedMotion,
    character: value.character as CharacterId,
  };
}
export function parsePreferencesResponse(
  value: unknown,
): PreferencesResponse | null {
  if (
    !exact(value, ["accountId", "preferences", "revision"]) ||
    typeof value.accountId !== "string" ||
    !uuid.test(value.accountId) ||
    !revision(value.revision)
  )
    return null;
  const preferences =
    value.preferences === null ? null : parseGamePreferences(value.preferences);
  if (value.preferences !== null && !preferences) return null;
  return {
    accountId: value.accountId.toLowerCase(),
    preferences,
    revision: value.revision,
  };
}
export function parsePreferencesWrite(value: unknown): PreferencesWrite | null {
  if (
    !exact(value, ["accountId", "preferences", "expectedRevision"]) ||
    typeof value.accountId !== "string" ||
    !uuid.test(value.accountId) ||
    !revision(value.expectedRevision)
  )
    return null;
  const preferences = parseGamePreferences(value.preferences);
  if (!preferences) return null;
  return {
    accountId: value.accountId.toLowerCase(),
    preferences,
    expectedRevision: value.expectedRevision,
  };
}
export function preferenceValuesEqual(
  a: GamePreferences,
  b: GamePreferences,
): boolean {
  return (
    a.music === b.music &&
    a.sfx === b.sfx &&
    a.reducedMotion === b.reducedMotion &&
    a.character === b.character
  );
}
