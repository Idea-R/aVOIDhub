import { describe, expect, it } from 'vitest';
import { isDoubleTapGesture } from './InputHandler';

describe('isDoubleTapGesture', () => {
  it('accepts a short, nearby second tap', () => {
    expect(isDoubleTapGesture({ duration: 120, distance: 12, elapsedSincePreviousTap: 240 })).toBe(true);
  });

  it('rejects long presses, drags, and late second taps', () => {
    expect(isDoubleTapGesture({ duration: 221, distance: 12, elapsedSincePreviousTap: 240 })).toBe(false);
    expect(isDoubleTapGesture({ duration: 120, distance: 49, elapsedSincePreviousTap: 240 })).toBe(false);
    expect(isDoubleTapGesture({ duration: 120, distance: 12, elapsedSincePreviousTap: 321 })).toBe(false);
  });
});
