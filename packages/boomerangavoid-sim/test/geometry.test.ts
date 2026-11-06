import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circleTOI } from '../src/geometry';

test('previous contact a few ULPs above or below radius has the same overlap classification', () => {
  // Captured from Node 22 and Chrome 155 at tick 1722, seed 41827,
  // Lantern Foundry teams. Both pairs recall away on the following tick.
  const cases = [
    [
      { x: -1.6933519832656896, y: 6.3674030596565 },
      { x: -1.971708438353289, y: 6.255520603877834 },
    ],
    [
      { x: -1.6933519832656867, y: 6.367403059656498 },
      { x: -1.9717084383532861, y: 6.255520603877831 },
    ],
  ];
  for (const [a, b] of cases) {
    assert.equal(
      circleTOI(
        a!,
        { x: a!.x + 0.25, y: a!.y + 0.09 },
        b!,
        { x: b!.x + 0.15, y: b!.y + 0.22 },
        0.3,
      ),
      0,
    );
  }
  for (const scale of [0.001, 1, 1000])
    for (const perturbation of [-1e-14, 0, 1e-14]) {
      const r = 0.3 * scale,
        x = r * (1 + perturbation);
      assert.equal(
        circleTOI(
          { x, y: 0 },
          { x: x + scale, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          r,
        ),
        0,
      );
    }
});

test('overlap tolerance preserves genuine near misses and swept crossing times', () => {
  for (const scale of [0.001, 1, 1000]) {
    const r = 0.3 * scale,
      x = r + 1e-7 * scale;
    assert.equal(
      circleTOI(
        { x, y: 0 },
        { x: x + scale, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        r,
      ),
      null,
    );
    const t = circleTOI(
      { x: -2 * scale, y: 0 },
      { x: 2 * scale, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      r,
    );
    assert.ok(t !== null && Math.abs(t - 0.425) < 1e-12);
  }
  assert.equal(
    circleTOI(
      { x: -1, y: 0.300001 },
      { x: 1, y: 0.300001 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      0.3,
    ),
    null,
  );
});
