import { describe, expect, it } from 'vitest';
import { competitiveInputCharacter, isCompetitiveKeyboardEvent } from './useKeyboardInput';

function keyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: 'a',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    repeat: false,
    ...overrides,
  } as KeyboardEvent;
}

describe('owned WORDaVOID typing surface', () => {
  it('accepts one normalized physical letter', () => {
    expect(isCompetitiveKeyboardEvent(keyEvent({ key: 'A', shiftKey: true }))).toBe(true);
  });

  it.each([
    { key: 'a', ctrlKey: true },
    { key: 'a', metaKey: true },
    { key: 'a', altKey: true },
    { key: 'a', repeat: true },
    { key: 'a', isComposing: true },
    { key: 'Dead' },
    { key: ' ' },
    { key: '1' },
    { key: 'é' },
  ])('rejects shortcut, composition, repeat, or non-contract input %#', (candidate) => {
    expect(isCompetitiveKeyboardEvent(keyEvent(candidate))).toBe(false);
  });

  it('accepts a one-letter input event fallback used by software keyboards', () => {
    expect(competitiveInputCharacter('A', '', false)).toBe('a');
    expect(competitiveInputCharacter(null, 'b', false)).toBe('b');
    expect(competitiveInputCharacter(null, 'pasted text', false)).toBeNull();
    expect(competitiveInputCharacter('a', 'a', true)).toBeNull();
  });
});
