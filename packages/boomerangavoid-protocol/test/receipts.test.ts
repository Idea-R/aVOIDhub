import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import {
  CHARACTERS,
  CONTENT_VERSION,
  RULESET,
  createMatch,
  type MatchState,
  type Mode,
} from '@avoid/boomerangavoid-sim';
import { CONTENT_HASH } from '../src/index';
import { mintTicket } from '../src/tickets';
import {
  buildMatchReceipt,
  parseMatchReceipt,
  serializeMatchReceipt,
  receiptDigest,
  signReceiptEnvelope,
  verifyReceiptEnvelope,
  MAX_RECEIPT_BYTES,
  RECEIPT_CLOCK_SKEW_MS,
  MAX_MATCH_SPAN_MS,
  type MatchReceipt,
  type BuildReceiptContext,
} from '../src/receipts';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const MATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECRET = 'a-shared-ticket-secret-of-at-least-thirty-two-bytes';
const NOW = 1_800_000_000_000;

function fixture(
  mode: Mode = 'ffa',
  wins: 3 | 5 | 7 = 3,
): { state: MatchState; context: BuildReceiptContext } {
  const seats = CHARACTERS.slice(0, 4).map((c, i) => ({
    id: 's' + i,
    name: c.name,
    character: c.id,
    color: c.color,
    team: i % 2,
    bot: i === 3 ? ('easy' as const) : null,
  }));
  const state = createMatch(
    {
      mode,
      wins,
      mapId: 'moss-court',
      seed: 918,
      friendlyFire: false,
      upgrades: true,
    },
    seats,
  );
  state.phase = 'matchResults';
  state.tick = 20000;
  state.matchWinnerIds = mode === 'ffa' ? ['s0'] : ['s0', 's2'];
  state.winnerIds = [...state.matchWinnerIds];
  for (const p of state.players)
    p.score =
      mode === 'relay'
        ? p.team === 0
          ? 3
          : 1
        : p.id === 's0'
          ? wins
          : mode === 'teams' && p.id === 's2'
            ? 1
            : p.id === 's1'
              ? wins - 1
              : 0;
  if (mode === 'relay') state.relay.scores = [3, 1];
  return {
    state,
    context: {
      source: 'authoritative-online',
      matchId: MATCH_ID,
      roomId: 'garden-room-1',
      startedAt: NOW - 400000,
      endedAt: NOW,
      identities: {
        s0: { kind: 'account', accountId: ACCOUNT_A },
        s1: { kind: 'account', accountId: ACCOUNT_B },
        s2: { kind: 'local-guest', accountId: null },
        s3: { kind: 'bot', accountId: null },
      },
    },
  };
}
function receipt(mode: Mode = 'ffa', wins: 3 | 5 | 7 = 3): MatchReceipt {
  const { state, context } = fixture(mode, wins);
  const result = buildMatchReceipt(state, context);
  assert.ok(result);
  return result;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('builder uses terminal simulation plus server identities and emits only the bounded wire contract', () => {
  const { state, context } = fixture();
  const result = buildMatchReceipt(state, context)!;
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.source, 'authoritative-online');
  assert.equal(result.ruleset, RULESET);
  assert.equal(result.contentHash, CONTENT_HASH);
  assert.deepEqual(
    result.players.map((p) => [
      p.seatId,
      p.accountId,
      p.localGuest,
      p.bot,
      p.winner,
    ]),
    [
      ['s0', ACCOUNT_A, false, false, true],
      ['s1', ACCOUNT_B, false, false, false],
      ['s2', null, true, false, false],
      ['s3', null, false, true, false],
    ],
  );
  assert.equal('name' in result.players[0]!, false);
  assert.equal('kills' in result.players[0]!, false);
  const copied = clone(result);
  state.players[0]!.score = 0;
  context.identities = {};
  assert.deepEqual(result, copied);
});

test('incomplete, local, development-guest and anonymous-only matches cannot produce receipts', () => {
  for (const phase of ['countdown', 'playing', 'roundResults'] as const) {
    const f = fixture();
    f.state.phase = phase;
    assert.equal(buildMatchReceipt(f.state, f.context), null);
  }
  for (const source of ['local', 'guest-development'] as const) {
    const f = fixture();
    f.context.source = source;
    assert.equal(buildMatchReceipt(f.state, f.context), null);
  }
  const dev = fixture();
  dev.context.identities = {
    ...dev.context.identities,
    s2: { kind: 'development-guest', accountId: null },
  };
  assert.equal(buildMatchReceipt(dev.state, dev.context), null);
  const guest = receipt();
  for (const p of guest.players) {
    p.accountId = null;
    if (!p.bot) p.localGuest = true;
  }
  assert.equal(parseMatchReceipt(guest), null);
  const fake = receipt();
  fake.players[0]!.accountId = 'local:development';
  assert.equal(parseMatchReceipt(fake), null);
});

test('identity map must retain an authenticated primary and distinguish couch guests and bots', () => {
  const missing = fixture();
  delete (missing.context.identities as Record<string, unknown>).s1;
  assert.equal(buildMatchReceipt(missing.state, missing.context), null);
  const bot = fixture();
  bot.context.identities = {
    ...bot.context.identities,
    s3: { kind: 'account', accountId: ACCOUNT_B },
  };
  assert.equal(buildMatchReceipt(bot.state, bot.context), null);
  const human = fixture();
  human.context.identities = {
    ...human.context.identities,
    s0: { kind: 'bot', accountId: null },
  };
  assert.equal(buildMatchReceipt(human.state, human.context), null);
  for (const id of ['s2', 's3']) {
    const r = receipt();
    r.players.find((p) => p.seatId === id)!.accountId = ACCOUNT_A;
    assert.equal(parseMatchReceipt(r), null);
  }
  const unbound = receipt();
  unbound.players[1]!.accountId = null;
  assert.equal(parseMatchReceipt(unbound), null);
});

test('duplicate seat IDs or account UUIDs are rejected including UUID case aliases', () => {
  const seats = receipt();
  seats.players[1]!.seatId = seats.players[0]!.seatId;
  assert.equal(parseMatchReceipt(seats), null);
  const accounts = receipt();
  accounts.players[1]!.accountId = ACCOUNT_A;
  assert.equal(parseMatchReceipt(accounts), null);
  const upper = receipt();
  upper.players[0]!.accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  upper.players[1]!.accountId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  assert.equal(parseMatchReceipt(upper), null);
});

test('FFA winner must be unique at the configured threshold; forged losers and incomplete scores fail', () => {
  for (const wins of [3, 5, 7] as const)
    assert.equal(receipt('ffa', wins).players[0]!.score, wins);
  const wrong = receipt();
  wrong.players[0]!.winner = false;
  wrong.players[1]!.winner = true;
  assert.equal(parseMatchReceipt(wrong), null);
  const multi = receipt();
  multi.players[1]!.winner = true;
  assert.equal(parseMatchReceipt(multi), null);
  const noWinner = receipt();
  noWinner.players[0]!.winner = false;
  assert.equal(parseMatchReceipt(noWinner), null);
  const threshold = receipt();
  threshold.players[0]!.score = 2;
  assert.equal(parseMatchReceipt(threshold), null);
  const tied = receipt();
  tied.players[1]!.score = 3;
  assert.equal(parseMatchReceipt(tied), null);
  const f = fixture();
  f.state.matchWinnerIds = ['s1'];
  f.state.winnerIds = ['s1'];
  assert.equal(buildMatchReceipt(f.state, f.context), null);
});

test('teams award all winning teammates, allow legitimate late-seat scores and reject opponent thresholds', () => {
  const r = receipt('teams');
  assert.deepEqual(
    r.players.filter((p) => p.winner).map((p) => [p.seatId, p.score]),
    [
      ['s0', 3],
      ['s2', 1],
    ],
  );
  const omitted = clone(r);
  omitted.players[2]!.winner = false;
  assert.equal(parseMatchReceipt(omitted), null);
  const mixed = clone(r);
  mixed.players[1]!.winner = true;
  assert.equal(parseMatchReceipt(mixed), null);
  const opponent = clone(r);
  opponent.players[1]!.score = 3;
  assert.equal(parseMatchReceipt(opponent), null);
  const absent = clone(r);
  for (const p of absent.players) p.team = 0;
  assert.equal(parseMatchReceipt(absent), null);
});

test('Relay uses delivery scores capped at three independently of configured round wins', () => {
  for (const wins of [3, 5, 7] as const) {
    const r = receipt('relay', wins);
    assert.equal(r.wins, wins);
    assert.equal(r.players[0]!.score, 3);
  }
  const over = receipt('relay', 7);
  over.players[0]!.score = 4;
  assert.equal(parseMatchReceipt(over), null);
  const unequal = receipt('relay');
  unequal.players[2]!.score = 2;
  assert.equal(parseMatchReceipt(unequal), null);
  const tied = receipt('relay');
  for (const p of tied.players) p.score = 2;
  assert.equal(parseMatchReceipt(tied), null);
});

test('Relay clock victories below three require both elapsed match time and terminal simulation clock', () => {
  const f = fixture('relay');
  f.state.relay.scores = [2, 1];
  for (const p of f.state.players) p.score = p.team === 0 ? 2 : 1;
  assert.ok(buildMatchReceipt(f.state, f.context));
  f.context.startedAt = NOW - 299999;
  assert.equal(buildMatchReceipt(f.state, f.context), null);
  f.context.startedAt = NOW - 300000;
  f.state.tick = f.state.relay.endTick - 1;
  assert.equal(buildMatchReceipt(f.state, f.context), null);
  f.state.tick = f.state.relay.endTick;
  assert.ok(buildMatchReceipt(f.state, f.context));
});

test('strict schema rejects unknown, oversized, malformed and out-of-range fields', () => {
  const mutations: ((r: Record<string, any>) => void)[] = [
    (r) => (r.extra = true),
    (r) => (r.schemaVersion = 2),
    (r) => (r.source = 'local'),
    (r) => (r.matchId = 'not-a-uuid'),
    (r) => (r.roomId = ''),
    (r) => (r.roomId = 'a'.repeat(65)),
    (r) => (r.roomId = 'bad\nroom'),
    (r) => (r.ruleset = RULESET + '-old'),
    (r) => (r.contentHash = '00000000'),
    (r) => (r.mode = 'ranked'),
    (r) => (r.mapId = 'unknown'),
    (r) => (r.wins = 4),
    (r) => (r.completed = false),
    (r) => (r.startedAt = NaN),
    (r) => (r.endedAt = Infinity),
    (r) => (r.startedAt = -1),
    (r) => (r.endedAt = r.startedAt),
    (r) => (r.startedAt = 0.5),
    (r) => (r.startedAt = r.endedAt - MAX_MATCH_SPAN_MS - 1),
    (r) => (r.players = []),
    (r) => (r.players = r.players.slice(0, 1)),
    (r) => (r.players = [...r.players, ...r.players]),
    (r) => (r.players[0].accountId = '00000000-0000-0000-0000-000000000000'),
    (r) => (r.players[0].seatId = 'a'.repeat(65)),
    (r) => (r.players[0].team = 2),
    (r) => (r.players[0].score = 4),
    (r) => (r.players[0].score = 0.5),
    (r) => (r.players[0].character = 'unknown'),
    (r) => (r.players[0].bot = 'false'),
    (r) => (r.players[0].winner = 1),
    (r) => (r.players[0].extra = 'x'),
    (r) => delete r.players[0].localGuest,
  ];
  for (const mutate of mutations) {
    const r = receipt();
    mutate(r);
    assert.equal(parseMatchReceipt(r), null, mutate.toString());
  }
  assert.equal(parseMatchReceipt(null), null);
  assert.equal(parseMatchReceipt([]), null);
  assert.equal(parseMatchReceipt('receipt'), null);
});

test('builder rejects mismatched canonical version, winner lists and Relay score evidence', () => {
  const version = fixture();
  version.state.version = `${RULESET}/${CONTENT_VERSION}-old`;
  assert.equal(buildMatchReceipt(version.state, version.context), null);
  const winner = fixture();
  winner.state.matchWinnerIds = ['missing'];
  winner.state.winnerIds = ['missing'];
  assert.equal(buildMatchReceipt(winner.state, winner.context), null);
  const disagreement = fixture();
  disagreement.state.winnerIds = ['s1'];
  assert.equal(
    buildMatchReceipt(disagreement.state, disagreement.context),
    null,
  );
  const duplicate = fixture();
  duplicate.state.matchWinnerIds = ['s0', 's0'];
  assert.equal(buildMatchReceipt(duplicate.state, duplicate.context), null);
  const relay = fixture('relay');
  relay.state.relay.scores = [2, 1];
  assert.equal(buildMatchReceipt(relay.state, relay.context), null);
});

test('canonical serialization and digest normalize seat ordering, object ordering and UUID case', () => {
  const a = receipt(),
    b = clone(a);
  b.players.reverse();
  b.matchId = b.matchId.toUpperCase();
  const reordered = Object.fromEntries(
    Object.entries(b).reverse(),
  ) as unknown as MatchReceipt;
  assert.equal(serializeMatchReceipt(a), serializeMatchReceipt(reordered));
  assert.equal(receiptDigest(a), receiptDigest(reordered));
  assert.match(receiptDigest(a), /^[0-9a-f]{64}$/);
  const changed = clone(a);
  changed.players[1]!.score--;
  assert.notEqual(receiptDigest(a), receiptDigest(changed));
});

test('receipt envelope authenticates raw bytes, is domain-separated from room tickets, and can be retried idempotently', () => {
  const r = receipt(),
    body = serializeMatchReceipt(r),
    header = signReceiptEnvelope(body, SECRET, NOW);
  assert.match(header, /^[0-9]+\.[0-9a-f]{64}$/);
  assert.deepEqual(
    verifyReceiptEnvelope(Buffer.from(body), header, SECRET, NOW),
    r,
  );
  assert.deepEqual(verifyReceiptEnvelope(body, header, SECRET, NOW), r);
  const derived = createHmac('sha256', SECRET)
    .update('boomerangavoid/match-receipt/v1', 'utf8')
    .digest();
  const expected =
    String(NOW) +
    '.' +
    createHmac('sha256', derived)
      .update(String(NOW) + '.', 'utf8')
      .update(Buffer.from(body, 'utf8'))
      .digest('hex');
  assert.equal(header, expected);
  assert.equal(verifyReceiptEnvelope(body + ' ', header, SECRET, NOW), null);
  assert.equal(
    verifyReceiptEnvelope(body, header, SECRET + 'different', NOW),
    null,
  );
  const direct =
    String(NOW) +
    '.' +
    createHmac('sha256', SECRET)
      .update(String(NOW) + '.' + body)
      .digest('hex');
  assert.equal(verifyReceiptEnvelope(body, direct, SECRET, NOW), null);
  const ticket = mintTicket(
    {
      userId: ACCOUNT_A,
      name: 'Pip',
      room: 'create',
      audience: 'boomerangavoid',
      seats: 1,
    },
    SECRET,
    NOW,
  );
  assert.equal(verifyReceiptEnvelope(body, ticket, SECRET, NOW), null);
});

test('tampered payloads and timestamps fail while the five-minute skew boundary is explicit', () => {
  const body = serializeMatchReceipt(receipt()),
    header = signReceiptEnvelope(body, SECRET, NOW);
  assert.ok(
    verifyReceiptEnvelope(body, header, SECRET, NOW + RECEIPT_CLOCK_SKEW_MS),
  );
  assert.ok(
    verifyReceiptEnvelope(body, header, SECRET, NOW - RECEIPT_CLOCK_SKEW_MS),
  );
  assert.equal(
    verifyReceiptEnvelope(
      body,
      header,
      SECRET,
      NOW + RECEIPT_CLOCK_SKEW_MS + 1,
    ),
    null,
  );
  assert.equal(
    verifyReceiptEnvelope(
      body,
      header,
      SECRET,
      NOW - RECEIPT_CLOCK_SKEW_MS - 1,
    ),
    null,
  );
  assert.equal(
    verifyReceiptEnvelope(
      body.replace('garden-room-1', 'garden-room-2'),
      header,
      SECRET,
      NOW,
    ),
    null,
  );
  assert.equal(
    verifyReceiptEnvelope(
      body,
      header.replace(String(NOW), String(NOW + 1)),
      SECRET,
      NOW,
    ),
    null,
  );
  for (const bad of [
    '',
    header + '.x',
    '0' + header,
    '-1.' + '0'.repeat(64),
    String(NOW) + '.' + 'z'.repeat(64),
    String(NOW) + '.' + '0'.repeat(63),
  ])
    assert.equal(verifyReceiptEnvelope(body, bad, SECRET, NOW), null);
});

test('body bounds count UTF-8 bytes; valid signatures cannot authorize malformed or incoherent receipts', () => {
  assert.throws(
    () => signReceiptEnvelope('x'.repeat(MAX_RECEIPT_BYTES + 1), SECRET, NOW),
    /body/,
  );
  assert.throws(
    () => signReceiptEnvelope('é'.repeat(MAX_RECEIPT_BYTES), SECRET, NOW),
    /body/,
  );
  const exact = ' '.repeat(MAX_RECEIPT_BYTES);
  assert.doesNotThrow(() => signReceiptEnvelope(exact, SECRET, NOW));
  assert.equal(
    verifyReceiptEnvelope(
      exact,
      signReceiptEnvelope(exact, SECRET, NOW),
      SECRET,
      NOW,
    ),
    null,
  );
  for (const body of [
    'not json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...receipt(), completed: false }),
  ])
    assert.equal(
      verifyReceiptEnvelope(
        body,
        signReceiptEnvelope(body, SECRET, NOW),
        SECRET,
        NOW,
      ),
      null,
    );
  const invalid = Buffer.from([255]);
  assert.equal(
    verifyReceiptEnvelope(
      invalid,
      signReceiptEnvelope(invalid, SECRET, NOW),
      SECRET,
      NOW,
    ),
    null,
  );
  assert.throws(() => signReceiptEnvelope('{}', 'short', NOW), /secret/);
  assert.equal(verifyReceiptEnvelope('{}', 'bad', 'short', NOW), null);
  assert.throws(() => signReceiptEnvelope('{}', SECRET, NaN), /timestamp/);
});

test('retained departed development guests disqualify the entire match',()=>{const {state,context}=fixture();context.identities={...context.identities,departed:{kind:'development-guest',accountId:null}};assert.equal(buildMatchReceipt(state,context),null);});
