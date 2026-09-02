/**
 * Real music tracks (generated with Suno, see ATTRIBUTIONS.md) with per-mood crossfading.
 * Falls back to the procedural MusicEngine when a mood has no track or the file fails to load.
 */
import type { Mood } from './music';

export interface TrackManifest { tracks: Partial<Record<Mood, string>>; version?: number }

interface Deck { el: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode; mood: Mood; ready: boolean; failed: boolean }

const XFADE = 2.2;

export class TrackPlayer {
  private decks = new Map<Mood, Deck>();
  private manifest: TrackManifest | null = null;
  private current: Mood | null = null;
  private out: GainNode;
  private level = 1;
  private loading: Promise<void>;
  /** Called whenever the availability of a real track for the active mood changes (so the synth can duck). */
  onActiveChange: ((usingTrack: boolean) => void) | null = null;

  constructor(private ctx: AudioContext, dest: AudioNode, base = './audio/') {
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(dest);
    this.loading = fetch(base + 'manifest.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then((m: TrackManifest | null) => {
        this.manifest = m && m.tracks ? m : { tracks: {} };
        for (const mood of Object.keys(this.manifest.tracks) as Mood[]) this.prepare(mood, base + this.manifest.tracks[mood]!);
        // the first mood was usually requested before the manifest arrived: re-apply it so the synth ducks
        if (this.current) this.setMood(this.current);
      })
      .catch(() => { this.manifest = { tracks: {} }; });
  }

  private prepare(mood: Mood, url: string): void {
    if (this.decks.has(mood)) return;
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    const node = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    node.connect(gain);
    gain.connect(this.out);
    const deck: Deck = { el, node, gain, mood, ready: false, failed: false };
    el.addEventListener('canplaythrough', () => { deck.ready = true; if (this.current === mood) { this.fadeTo(mood); this.onActiveChange?.(true); } }, { once: true });
    el.addEventListener('error', () => { deck.failed = true; if (this.current === mood) this.onActiveChange?.(false); });
    this.decks.set(mood, deck);
  }

  hasTrack(mood: Mood): boolean {
    const d = this.decks.get(mood);
    return !!d && !d.failed;
  }

  /** Crossfade to the mood's track. Returns true if a real track will play. */
  setMood(mood: Mood): boolean {
    this.current = mood;
    const d = this.decks.get(mood);
    const now = this.ctx.currentTime;
    for (const [m, deck] of this.decks) {
      if (m === mood) continue;
      if (deck.gain.gain.value > 0.001) {
        deck.gain.gain.cancelScheduledValues(now);
        deck.gain.gain.setTargetAtTime(0.0001, now, XFADE / 3);
        window.setTimeout(() => { if (this.current !== m) { try { deck.el.pause(); } catch { /* */ } } }, XFADE * 1000 + 100);
      }
    }
    if (!d || d.failed) { this.onActiveChange?.(false); return false; }
    if (d.ready) this.fadeTo(mood);
    this.onActiveChange?.(true);
    return true;
  }

  private fadeTo(mood: Mood): void {
    const d = this.decks.get(mood);
    if (!d || d.failed) return;
    const now = this.ctx.currentTime;
    // restart short stingers from the top, keep long beds where they were
    if (mood === 'victory' || mood === 'defeat' || mood === 'title') { try { d.el.currentTime = 0; } catch { /* */ } }
    d.el.play().catch(() => { /* autoplay policy: will retry on next gesture via unlock */ });
    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setValueAtTime(Math.max(0.0001, d.gain.gain.value), now);
    d.gain.gain.setTargetAtTime(this.level, now, XFADE / 3);
  }

  /** Retry playback after an autoplay block (called on unlock/gesture). */
  resume(): void {
    if (!this.current) return;
    const d = this.decks.get(this.current);
    if (d && !d.failed && d.el.paused) d.el.play().catch(() => { /* */ });
  }

  setLevel(v: number): void {
    this.level = v;
    if (!this.current) return;
    const d = this.decks.get(this.current);
    if (d && d.ready) d.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  whenLoaded(): Promise<void> { return this.loading; }

  dispose(): void {
    for (const d of this.decks.values()) { try { d.el.pause(); d.el.src = ''; d.node.disconnect(); d.gain.disconnect(); } catch { /* */ } }
    this.decks.clear();
    try { this.out.disconnect(); } catch { /* */ }
  }
}
