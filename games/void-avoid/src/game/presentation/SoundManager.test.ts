import { describe, expect, it } from 'vitest';
import { SoundManager } from './SoundManager';

class FakeAudioParam {
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  private ended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  start(): void {}
  stop(): void { this.ended?.(); }
  addEventListener(_type: string, listener: () => void): void { this.ended = listener; }
}

class FakeGain {
  gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  async resume(): Promise<void> { this.resumeCalls += 1; this.state = 'running'; }
  async suspend(): Promise<void> { this.suspendCalls += 1; this.state = 'suspended'; }
  async close(): Promise<void> { this.closeCalls += 1; this.state = 'closed'; }
  createOscillator(): OscillatorNode { return new FakeOscillator() as unknown as OscillatorNode; }
  createGain(): GainNode { return new FakeGain() as unknown as GainNode; }
}

describe('SoundManager', () => {
  it('does not create or resume audio until activate is called from a player gesture', async () => {
    const context = new FakeAudioContext();
    const sound = new SoundManager(true, () => context as unknown as AudioContext);
    expect(sound.getDiagnostics()).toMatchObject({ status: 'idle', contextState: 'none', contextsCreated: 0 });

    expect(await sound.activate()).toBe('ready');
    expect(context.resumeCalls).toBe(1);
    expect(sound.play('start')).toBe(true);
    expect(sound.getDiagnostics()).toMatchObject({ status: 'ready', activeVoices: 0, contextsCreated: 1 });
  });

  it('mutes without leaving voices and closes its one context during teardown', async () => {
    const context = new FakeAudioContext();
    const sound = new SoundManager(true, () => context as unknown as AudioContext);
    await sound.activate();
    expect(await sound.setEnabled(false)).toBe('muted');
    expect(context.suspendCalls).toBe(1);
    expect(sound.play('impact')).toBe(false);

    await sound.destroy();
    expect(context.closeCalls).toBe(1);
    expect(sound.getDiagnostics()).toMatchObject({ status: 'muted', contextState: 'none', activeVoices: 0, contextsClosed: 1 });
  });

  it('reports an unavailable context and can retry on a later player gesture', async () => {
    const context = new FakeAudioContext();
    let attempts = 0;
    const sound = new SoundManager(true, () => {
      attempts += 1;
      if (attempts === 1) throw new Error('blocked');
      return context as unknown as AudioContext;
    });

    expect(await sound.activate()).toBe('unavailable');
    expect(await sound.activate()).toBe('ready');
    expect(sound.getDiagnostics()).toMatchObject({ contextsCreated: 1, status: 'ready' });
  });
});
