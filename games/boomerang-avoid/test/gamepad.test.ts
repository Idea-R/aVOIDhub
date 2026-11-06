import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectedPads, padAxes, radialStick, type PadSample } from '../src/gamepad';
import { DEFAULT_BINDINGS, Inputs, type Preferences } from '../src/input';

const pad = (fields: Partial<PadSample> = {}): PadSample => ({
  id: 'Standard test pad', index: 0, connected: true, mapping: 'standard',
  axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })), ...fields,
});

test('radial deadzone preserves 360 degree direction and fractional stick strength', () => {
  for (let degrees = 0; degrees < 360; degrees += 3) {
    const angle = degrees * Math.PI / 180;
    for (const magnitude of [0.2, 0.4, 0.75, 1]) {
      const stick = radialStick(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
      const expected = (magnitude - 0.18) / 0.82;
      assert.ok(Math.abs(Math.hypot(stick.x, stick.y) - expected) < 1e-12);
      assert.ok(Math.abs(stick.x * Math.sin(angle) - stick.y * Math.cos(angle)) < 1e-12);
    }
  }
  const shallow = radialStick(0.8, 0.1);
  assert.ok(shallow.y > 0, 'a shallow angle must not snap to the horizontal axis');
  assert.ok(Math.abs(shallow.y / shallow.x - 0.125) < 1e-12);
});

test('drift, malformed axes and diagonal overtravel produce finite bounded samples', () => {
  assert.deepEqual(radialStick(0.1, -0.1), { x: 0, y: 0 });
  assert.deepEqual(radialStick(NaN, Infinity), { x: 0, y: 0 });
  assert.equal(Math.hypot(...Object.values(radialStick(1, 1))), 1);
  assert.deepEqual(padAxes(pad({ connected: false, axes: [1, 1, 1, 1] })), { mx: 0, my: 0, ax: 0, ay: 0 });
});

test('standard dual sticks, digital D-pad, short pads and unmapped Sony axes use safe fallbacks', () => {
  assert.deepEqual(padAxes(pad({ axes: [1, 0, 0, -1] })), { mx: 1, my: 0, ax: 0, ay: -1 });
  const dpad = pad({ axes: [] });
  dpad.buttons[12] = { value: 1 };
  assert.deepEqual(padAxes(dpad), { mx: 0, my: -1, ax: 0, ay: 0 });
  const short = padAxes(pad({ mapping: '', axes: [0.5, 0] }));
  assert.ok(Math.abs(short.mx - (0.5 - 0.18) / 0.82) < 1e-12);
  assert.equal(short.ax, 0);
  assert.equal(short.ay, 0);
  assert.deepEqual(padAxes(pad({ id: 'Wireless Controller (054c)', mapping: '', axes: [0, 0, 0, -1, -1, 0] })),
    { mx: 0, my: 0, ax: 0, ay: 0 });
  assert.equal(padAxes(pad({ id: 'DualSense', mapping: '', axes: [0, 0, 0, -1, -1, 1] })).ay, 1);
  assert.equal(padAxes(pad({ id: 'DualSense', mapping: 'standard', axes: [0, 0, 0, 1, 0, -1] })).ay, 1);
});

test('gamepad discovery tolerates missing APIs, permission errors, null slots and disconnected samples', () => {
  assert.deepEqual(connectedPads(undefined), []);
  assert.deepEqual(connectedPads(() => { throw new Error('blocked'); }), []);
  const good = pad({ index: 3 });
  assert.deepEqual(connectedPads(() => [null, pad({ connected: false }), good]), [good]);
});

test('pad actions are single pulses and blur/reconnection requires complete release before recovery', () => {
  let samples: (PadSample | null)[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => samples } });
  Object.assign(globalThis, {
    addEventListener: () => {},
    document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] },
  });
  const preferences: Preferences = { music: 0, sfx: 0, reducedMotion: false, character: 'pip', touch: false,
    quality: 'auto', bindings: DEFAULT_BINDINGS, gamepadButtons: { dash: 0, slash: 2, throw: 1 } };
  const inputs = new Inputs(preferences);
  inputs.active = true;
  const current = pad({ index: 3 });
  samples = [null, null, null, current];
  inputs.pollGamepads(false);
  current.axes = [0.8, 0.1, 0, -1];
  current.buttons[0] = { pressed: true };
  inputs.pollGamepads(false);
  const first = inputs.read('pad3');
  assert.ok(first.mx > 0 && first.my > 0);
  assert.equal(first.ay, -1);
  assert.equal(first.dash, true);
  assert.equal(inputs.read('pad3').dash, false);
  inputs.pollGamepads(false);
  assert.equal(inputs.read('pad3').dash, false, 'held buttons never repeat');
  inputs.clear();
  inputs.pollGamepads(false);
  assert.equal(inputs.read('pad3').mx, 0, 'held sticks cannot resume after focus loss');
  current.axes = [0, 0, 0, 0];
  current.buttons[0] = { pressed: false };
  inputs.pollGamepads(false);
  current.buttons[0] = { pressed: true };
  inputs.pollGamepads(false);
  assert.equal(inputs.read('pad3').dash, true);
  samples = [];
  inputs.pollGamepads(false);
  assert.equal(inputs.read('pad3').dash, false);
  samples = [pad({ index: 3, id: 'Replacement', axes: [1, 0, 0, 0] })];
  inputs.pollGamepads(false);
  assert.equal(inputs.read('pad3').mx, 0, 'replacement controller must return to neutral');
});
