import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NEUTRAL, type Input } from '@avoid/boomerangavoid-sim';
import { InputSession } from '../src/input-session';

const command = (patch: Partial<Input>): Input => ({ ...NEUTRAL, ...patch });
const neutral = (): Input => ({ ...NEUTRAL });

test('normal input is owned-only, copied, and does not mutate caller data', () => {
  const session = new InputSession();
  const a = Object.freeze(command({ mx: 1, ax: 1, throw: true }));
  const source = Object.freeze({ a, foreign: command({ slash: true }) });
  const result = session.map(source, ['a', 'missing']);
  assert.equal(session.paused, false);
  assert.deepEqual(result, { a, missing: neutral() });
  assert.notEqual(result.a, a);
  Object.assign(result.a!, { mx: 0 });
  assert.equal(a.mx, 1);
  assert.deepEqual(source.foreign, command({ slash: true }));
});

test('a neutral seat cannot unlock another held seat in the same sample, regardless of order', () => {
  for (const ids of [
    ['a', 'b'],
    ['b', 'a'],
  ]) {
    const session = new InputSession();
    session.suspend();
    for (let sample = 0; sample < 10; sample++) {
      assert.deepEqual(
        session.map({ a: neutral(), b: command({ mx: 1, slash: true }) }, ids),
        { a: neutral(), b: neutral() },
      );
      assert.equal(session.paused, true);
    }
  }
});

test('alternating per-seat releases do not substitute for a whole-party neutral sample', () => {
  const session = new InputSession();
  session.suspend();
  session.map({ a: command({ mx: 1 }), b: neutral() }, ['a', 'b']);
  session.map({ a: neutral(), b: command({ dash: true }) }, ['a', 'b']);
  assert.equal(session.paused, true);
  assert.deepEqual(
    session.map({ a: command({ slash: true }), b: neutral() }, ['a', 'b']),
    { a: neutral(), b: neutral() },
  );
  assert.equal(session.paused, true);
});

test('a complete neutral sample arms recovery and a later movement or action resumes', () => {
  for (const active of [
    command({ mx: 1 }),
    command({ my: -0.5 }),
    command({ dash: true }),
    command({ slash: true }),
    command({ throw: true }),
  ]) {
    const session = new InputSession();
    session.suspend();
    assert.deepEqual(session.map({ a: neutral(), b: neutral() }, ['a', 'b']), {
      a: neutral(),
      b: neutral(),
    });
    assert.equal(
      session.paused,
      true,
      'the neutral sample must not itself resume',
    );
    assert.deepEqual(session.map({ a: neutral(), b: active }, ['a', 'b']), {
      a: neutral(),
      b: active,
    });
    assert.equal(session.paused, false);
  }
});

test('aim-only samples never resume and all emitted values stay fully neutral while paused', () => {
  const session = new InputSession();
  session.suspend();
  const aim = command({ ax: 1, ay: -0.5 });
  assert.deepEqual(session.map({ a: aim }, ['a']), { a: neutral() });
  assert.equal(session.paused, true);
  assert.deepEqual(session.map({ a: aim }, ['a']), { a: neutral() });
  assert.equal(session.paused, true);
  assert.deepEqual(session.map({ a: command({ mx: 0.5, ax: 1 }) }, ['a']), {
    a: command({ mx: 0.5, ax: 1 }),
  });
  assert.equal(session.paused, false);
});

test('missing owned input is neutral; foreign activity cannot resume the owned party', () => {
  const session = new InputSession();
  session.suspend();
  assert.deepEqual(
    session.map({ foreign: command({ throw: true }) }, ['a', 'b']),
    { a: neutral(), b: neutral() },
  );
  assert.equal(session.paused, true);
  assert.deepEqual(session.map({ b: command({ mx: 1 }) }, ['a', 'b']), {
    a: neutral(),
    b: command({ mx: 1 }),
  });
  assert.equal(session.paused, false);
});

test('an empty seat list does not arm a later held party; changed membership requires a new neutral barrier', () => {
  const session = new InputSession();
  session.suspend();
  assert.deepEqual(session.map({}, []), {});
  assert.deepEqual(session.map({ a: command({ mx: 1 }) }, ['a']), {
    a: neutral(),
  });
  assert.equal(session.paused, true);
  session.map({}, ['a']);
  assert.deepEqual(session.map({ b: command({ throw: true }) }, ['a', 'b']), {
    a: neutral(),
    b: neutral(),
  });
  assert.equal(session.paused, true);
  session.map({}, ['a', 'b']);
  assert.deepEqual(session.map({ b: command({ mx: 1 }) }, ['b', 'a']), {
    b: command({ mx: 1 }),
    a: neutral(),
  });
  assert.equal(
    session.paused,
    false,
    'seat ordering alone must not reset the barrier',
  );
});

test('suspending again forgets the prior neutral barrier and never replays suppressed actions', () => {
  const session = new InputSession();
  session.suspend();
  session.map({}, ['a']);
  session.suspend();
  assert.deepEqual(session.map({ a: command({ slash: true }) }, ['a']), {
    a: neutral(),
  });
  assert.equal(session.paused, true);
  session.map({}, ['a']);
  session.map({ a: command({ mx: 1 }) }, ['a']);
  assert.deepEqual(session.map({}, ['a']), { a: neutral() });
  assert.equal(session.paused, false);
});

test('duplicate owned IDs are emitted once and prototype names remain ordinary owned keys', () => {
  const session = new InputSession();
  const result = session.map(
    Object.fromEntries([['__proto__', command({ mx: 1 })]]),
    ['__proto__', '__proto__', 'constructor'],
  );
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.deepEqual(Object.keys(result), ['__proto__', 'constructor']);
  assert.deepEqual(result.__proto__, command({ mx: 1 }));
  assert.deepEqual(result.constructor, neutral());
});
