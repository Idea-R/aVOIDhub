// Server-only subpath. Do not re-export from the browser-safe protocol entry point.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ARENAS,
  CHARACTERS,
  CONTENT_VERSION,
  RULESET,
  RULES,
  TICK_RATE,
  type CharacterId,
  type MatchState,
  type Mode,
} from '@avoid/boomerangavoid-sim';
import { CONTENT_HASH } from './index';

export const RECEIPT_SCHEMA_VERSION = 1;
export const RECEIPT_SOURCE = 'authoritative-online';
export const RECEIPT_DOMAIN = 'boomerangavoid/match-receipt/v1';
export const MAX_RECEIPT_BYTES = 16 * 1024;
export const RECEIPT_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const MAX_MATCH_SPAN_MS = 24 * 60 * 60 * 1000;

export interface ReceiptPlayer {
  seatId: string;
  accountId: string | null;
  localGuest: boolean;
  bot: boolean;
  team: 0 | 1;
  score: number;
  character: CharacterId;
  winner: boolean;
}
export interface MatchReceipt {
  schemaVersion: 1;
  source: typeof RECEIPT_SOURCE;
  matchId: string;
  roomId: string;
  ruleset: typeof RULESET;
  contentHash: string;
  mode: Mode;
  mapId: string;
  wins: 3 | 5 | 7;
  startedAt: number;
  endedAt: number;
  completed: true;
  players: ReceiptPlayer[];
}
/** Retained server authentication metadata; never fill this map from a client result. */
export type ServerSeatIdentity =
  | { kind: 'account'; accountId: string }
  | { kind: 'local-guest' | 'bot' | 'development-guest'; accountId: null };
export interface BuildReceiptContext {
  source: typeof RECEIPT_SOURCE | 'local' | 'guest-development';
  matchId: string;
  roomId: string;
  startedAt: number;
  endedAt: number;
  identities: Readonly<Record<string, ServerSeatIdentity>>;
}

const ROOT_KEYS = [
  'schemaVersion',
  'source',
  'matchId',
  'roomId',
  'ruleset',
  'contentHash',
  'mode',
  'mapId',
  'wins',
  'startedAt',
  'endedAt',
  'completed',
  'players',
];
const PLAYER_KEYS = [
  'seatId',
  'accountId',
  'localGuest',
  'bot',
  'team',
  'score',
  'character',
  'winner',
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is number =>
  integer(value) && value <= 8_640_000_000_000_000;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 1 &&
  value.length <= 64 &&
  value.trim() === value &&
  !/[\x00-\x1f\x7f]/.test(value);
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);
const exactKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).length === allowed.length &&
  Object.keys(value).every((key) => allowed.includes(key)) &&
  allowed.every((key) => Object.hasOwn(value, key));
const character = (value: unknown): value is CharacterId =>
  CHARACTERS.some((c) => c.id === value);

/** Strict structural and terminal-score validation; authenticity additionally requires the HMAC envelope. */
export function parseMatchReceipt(value: unknown): MatchReceipt | null {
  if (
    !object(value) ||
    !exactKeys(value, ROOT_KEYS) ||
    value.schemaVersion !== 1 ||
    value.source !== RECEIPT_SOURCE ||
    !uuid(value.matchId) ||
    !identifier(value.roomId) ||
    value.ruleset !== RULESET ||
    value.contentHash !== CONTENT_HASH ||
    !['ffa', 'teams', 'relay'].includes(value.mode as string) ||
    !ARENAS.some((a) => a.id === value.mapId) ||
    ![3, 5, 7].includes(value.wins as number) ||
    !timestamp(value.startedAt) ||
    !timestamp(value.endedAt) ||
    value.endedAt <= value.startedAt ||
    value.endedAt - value.startedAt > MAX_MATCH_SPAN_MS ||
    value.completed !== true ||
    !Array.isArray(value.players) ||
    value.players.length < 2 ||
    value.players.length > 6
  )
    return null;
  const wins = value.wins as 3 | 5 | 7;
  const players: ReceiptPlayer[] = [];
  const seats = new Set<string>(),
    accounts = new Set<string>();
  for (const raw of value.players) {
    if (
      !object(raw) ||
      !exactKeys(raw, PLAYER_KEYS) ||
      !identifier(raw.seatId) ||
      seats.has(raw.seatId) ||
      typeof raw.localGuest !== 'boolean' ||
      typeof raw.bot !== 'boolean' ||
      (raw.localGuest && raw.bot) ||
      (raw.team !== 0 && raw.team !== 1) ||
      !integer(raw.score) ||
      raw.score > (value.mode === 'relay' ? 3 : wins) ||
      !character(raw.character) ||
      typeof raw.winner !== 'boolean'
    )
      return null;
    seats.add(raw.seatId);
    let accountId: string | null = null;
    if (raw.bot || raw.localGuest) {
      if (raw.accountId !== null) return null;
    } else {
      if (!uuid(raw.accountId)) return null;
      accountId = raw.accountId.toLowerCase();
      if (accounts.has(accountId)) return null;
      accounts.add(accountId);
    }
    players.push({
      seatId: raw.seatId,
      accountId,
      localGuest: raw.localGuest,
      bot: raw.bot,
      team: raw.team,
      score: raw.score,
      character: raw.character,
      winner: raw.winner,
    });
  }
  if (!accounts.size) return null;
  const winners = players.filter((p) => p.winner);
  if (value.mode === 'ffa') {
    if (
      winners.length !== 1 ||
      winners[0]!.score !== wins ||
      players.some((p) => !p.winner && p.score >= wins)
    )
      return null;
  } else {
    if (
      !players.some((p) => p.team === 0) ||
      !players.some((p) => p.team === 1) ||
      !winners.length
    )
      return null;
    const winningTeam = winners[0]!.team;
    if (players.some((p) => p.winner !== (p.team === winningTeam))) return null;
    const winning = players.filter((p) => p.team === winningTeam),
      losing = players.filter((p) => p.team !== winningTeam);
    const winScore = Math.max(...winning.map((p) => p.score)),
      loseScore = Math.max(...losing.map((p) => p.score));
    if (value.mode === 'teams') {
      // Late seats start at zero; only the winning team's maximum must reach the match threshold.
      if (winScore !== wins || loseScore >= wins) return null;
    } else {
      if (
        winning.some((p) => p.score !== winScore) ||
        losing.some((p) => p.score !== loseScore) ||
        winScore <= loseScore
      )
        return null;
      if (
        winScore < 3 &&
        value.endedAt - value.startedAt <
          (RULES.relayDuration / TICK_RATE) * 1000
      )
        return null;
    }
  }
  return {
    schemaVersion: 1,
    source: RECEIPT_SOURCE,
    matchId: value.matchId.toLowerCase(),
    roomId: value.roomId,
    ruleset: RULESET,
    contentHash: CONTENT_HASH,
    mode: value.mode as Mode,
    mapId: value.mapId as string,
    wins: value.wins as 3 | 5 | 7,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    completed: true,
    players: players.sort((a, b) => compare(a.seatId, b.seatId)),
  };
}

/** Build only from the server's terminal simulation and retained, verified seat identities. */
export function buildMatchReceipt(
  state: MatchState,
  context: BuildReceiptContext,
): MatchReceipt | null {
  if (
    context.source !== RECEIPT_SOURCE ||
    state.phase !== 'matchResults' ||
    state.version !== `${RULESET}/${CONTENT_VERSION}` ||
    !object(context.identities) ||
    Object.values(context.identities).some(identity => identity?.kind === 'development-guest') ||
    !Array.isArray(state.matchWinnerIds) ||
    !Array.isArray(state.winnerIds) ||
    new Set(state.matchWinnerIds).size !== state.matchWinnerIds.length
  )
    return null;
  const sorted = (ids: string[]) => [...ids].sort(compare);
  if (
    JSON.stringify(sorted(state.winnerIds)) !==
      JSON.stringify(sorted(state.matchWinnerIds)) ||
    state.matchWinnerIds.some((id) => !state.players.some((p) => p.id === id))
  )
    return null;
  const players: ReceiptPlayer[] = [];
  for (const p of state.players) {
    if (!Object.hasOwn(context.identities, p.id)) return null;
    const identity = context.identities[p.id];
    if (
      !identity ||
      identity.kind === 'development-guest' ||
      !['account', 'local-guest', 'bot'].includes(identity.kind) ||
      (identity.kind === 'bot') !== (p.bot !== null)
    )
      return null;
    if (identity.kind !== 'account' && identity.accountId !== null) return null;
    players.push({
      seatId: p.id,
      accountId: identity.accountId,
      localGuest: identity.kind === 'local-guest',
      bot: identity.kind === 'bot',
      team: p.team as 0 | 1,
      score: p.score,
      character: p.character,
      winner: state.matchWinnerIds.includes(p.id),
    });
  }
  if (state.config.mode === 'relay') {
    if (
      state.relay.scores.length !== 2 ||
      state.players.some((p) => p.score !== state.relay.scores[p.team])
    )
      return null;
    if (Math.max(...state.relay.scores) < 3 && state.tick < state.relay.endTick)
      return null;
  }
  return parseMatchReceipt({
    schemaVersion: 1,
    source: context.source,
    matchId: context.matchId,
    roomId: context.roomId,
    ruleset: RULESET,
    contentHash: CONTENT_HASH,
    mode: state.config.mode,
    mapId: state.config.mapId,
    wins: state.config.wins,
    startedAt: context.startedAt,
    endedAt: context.endedAt,
    completed: true,
    players,
  });
}

/** Stable semantic representation for database idempotency, independent of raw JSON formatting/order. */
export function serializeMatchReceipt(receipt: MatchReceipt): string {
  const parsed = parseMatchReceipt(receipt);
  if (!parsed) throw new Error('invalid_match_receipt');
  return JSON.stringify(parsed);
}
export function receiptDigest(receipt: MatchReceipt): string {
  return createHash('sha256')
    .update(serializeMatchReceipt(receipt), 'utf8')
    .digest('hex');
}
function bodyBytes(rawBody: string | Uint8Array): Buffer | null {
  if (typeof rawBody !== 'string' && !(rawBody instanceof Uint8Array))
    return null;
  const length =
    typeof rawBody === 'string'
      ? Buffer.byteLength(rawBody, 'utf8')
      : rawBody.byteLength;
  if (length < 1 || length > MAX_RECEIPT_BYTES) return null;
  return typeof rawBody === 'string'
    ? Buffer.from(rawBody, 'utf8')
    : Buffer.from(rawBody);
}
function derivedKey(secret: string): Buffer | null {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32)
    return null;
  return createHmac('sha256', secret).update(RECEIPT_DOMAIN, 'utf8').digest();
}
function signature(body: Buffer, key: Buffer, issued: string): Buffer {
  return createHmac('sha256', key)
    .update(issued + '.', 'utf8')
    .update(body)
    .digest();
}
/** Header value: decimal millisecond timestamp, dot, lowercase SHA-256 HMAC hex. */
export function signReceiptEnvelope(
  rawBody: string | Uint8Array,
  secret: string,
  now = Date.now(),
): string {
  const body = bodyBytes(rawBody),
    key = derivedKey(secret);
  if (!body) throw new Error('invalid_receipt_body');
  if (!key) throw new Error('receipt_secret_unconfigured');
  if (!timestamp(now)) throw new Error('invalid_receipt_timestamp');
  const issued = String(now);
  return issued + '.' + signature(body, key, issued).toString('hex');
}
/** Verify the exact raw HTTP bytes before parsing. Database matchId/digest enforce idempotency. */
export function verifyReceiptEnvelope(
  rawBody: string | Uint8Array,
  header: unknown,
  secret: string,
  now = Date.now(),
): MatchReceipt | null {
  const body = bodyBytes(rawBody),
    key = derivedKey(secret);
  if (
    !body ||
    !key ||
    !timestamp(now) ||
    typeof header !== 'string' ||
    header.length > 82
  )
    return null;
  const match = /^(0|[1-9][0-9]{0,15})\.([0-9a-f]{64})$/.exec(header);
  if (!match) return null;
  const issued = Number(match[1]);
  if (!timestamp(issued) || Math.abs(now - issued) > RECEIPT_CLOCK_SKEW_MS)
    return null;
  const expected = signature(body, key, match[1]!),
    actual = Buffer.from(match[2]!, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    return parseMatchReceipt(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)),
    );
  } catch {
    return null;
  }
}
