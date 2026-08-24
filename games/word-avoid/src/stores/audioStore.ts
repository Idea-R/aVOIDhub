import { create } from 'zustand';
import type { Gain, NoiseSynth, Player, PolySynth, Synth } from 'tone';

let audioInitialization: Promise<void> | null = null;

interface AudioState {
  isInitialized: boolean;
  status: 'idle' | 'initializing' | 'ready' | 'unavailable';
  statusMessage: string;
  isPlaying: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  
  // Audio nodes
  masterGain: Gain | null;
  musicGain: Gain | null;
  sfxGain: Gain | null;
  
  // Instruments
  keyPressSynth: Synth | null;
  wordCompleteSynth: PolySynth | null;
  wordMissSynth: NoiseSynth | null;
  
  // Music layers
  ambientLayer: Player | null;
  tensionLayer: Player | null;
  actionLayer: Player | null;
  
  // Actions
  initializeAudio: () => Promise<void>;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  playKeyPress: (key: string) => void;
  playWordComplete: (difficulty: string) => void;
  playWordMiss: () => void;
  updateMusicIntensity: (intensity: number) => void;
  startMusic: () => void;
  stopMusic: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isInitialized: false,
  status: 'idle',
  statusMessage: 'Audio starts after your first interaction.',
  isPlaying: false,
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  
  keyPressSynth: null,
  wordCompleteSynth: null,
  wordMissSynth: null,
  
  ambientLayer: null,
  tensionLayer: null,
  actionLayer: null,

  initializeAudio: () => {
    if (get().isInitialized) {
      return Promise.resolve();
    }

    if (audioInitialization) {
      return audioInitialization;
    }

    audioInitialization = (async () => {
      set({ status: 'initializing', statusMessage: 'Starting audio…' });
      try {
        const Tone = await import('tone');

        // Start Tone.js audio context
        await Tone.start();
      
        // Create master gain nodes
        const current = get();
        const masterGain = new Tone.Gain(current.masterVolume).toDestination();
        const musicGain = new Tone.Gain(current.musicVolume).connect(masterGain);
        const sfxGain = new Tone.Gain(current.sfxVolume).connect(masterGain);
      
        // Create synthesizers for sound effects
        const keyPressSynth = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
        }).connect(sfxGain);
      
        const wordCompleteSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.5 }
        }).connect(sfxGain);
      
        const wordMissSynth = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
        }).connect(sfxGain);
      
        // Create music layers (using simple oscillators for now)
        // Disable oscillators for now to prevent buzzing
        const ambientLayer = null;
        const tensionLayer = null;
        const actionLayer = null;
      
        set({
          isInitialized: true,
          status: 'ready',
          statusMessage: 'Audio ready.',
          masterGain,
          musicGain,
          sfxGain,
          keyPressSynth,
          wordCompleteSynth,
          wordMissSynth,
          ambientLayer,
          tensionLayer,
          actionLayer
        });
      
      } catch {
        set({
          isInitialized: false,
          status: 'unavailable',
          statusMessage: 'Audio is unavailable in this browser. Gameplay continues silently.',
        });
      } finally {
        audioInitialization = null;
      }
    })();

    return audioInitialization;
  },

  setMasterVolume: (volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume));
    const { masterGain } = get();
    if (masterGain) {
      masterGain.gain.rampTo(nextVolume, 0.1);
    }
    set({ masterVolume: nextVolume });
  },

  setMusicVolume: (volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume));
    const { musicGain } = get();
    if (musicGain) {
      musicGain.gain.value = nextVolume;
    }
    set({ musicVolume: nextVolume });
  },

  setSfxVolume: (volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume));
    const { sfxGain } = get();
    if (sfxGain) {
      sfxGain.gain.rampTo(nextVolume, 0.1);
    }
    set({ sfxVolume: nextVolume });
  },

  playKeyPress: (key: string) => {
    const { keyPressSynth, isInitialized } = get();
    if (!isInitialized || !keyPressSynth) return;
    
    // Map keys to frequencies for spatial feedback
    const keyFrequencies: Record<string, number> = {
      'a': 220, 's': 247, 'd': 277, 'f': 294,
      'g': 330, 'h': 370, 'j': 415, 'k': 466, 'l': 523,
      'q': 262, 'w': 294, 'e': 330, 'r': 370, 't': 415,
      'y': 466, 'u': 523, 'i': 587, 'o': 659, 'p': 740
    };
    
    const frequency = keyFrequencies[key.toLowerCase()] || 440;
    keyPressSynth.triggerAttackRelease(frequency, '8n');
  },

  playWordComplete: (difficulty: string) => {
    const { wordCompleteSynth, isInitialized } = get();
    if (!isInitialized || !wordCompleteSynth) return;
    
    // Different chord progressions for different difficulties
    const chords = {
      easy: ['C4', 'E4', 'G4'],
      medium: ['C4', 'E4', 'G4', 'C5'],
      hard: ['C4', 'E4', 'G4', 'B4', 'D5'],
      extreme: ['C4', 'E4', 'G4', 'B4', 'D5', 'F#5'],
      boss: ['C4', 'E4', 'G4', 'B4', 'D5', 'F#5', 'A5']
    };
    
    const chord = chords[difficulty as keyof typeof chords] || chords.easy;
    wordCompleteSynth.triggerAttackRelease(chord, '4n');
  },

  playWordMiss: () => {
    const { wordMissSynth, isInitialized } = get();
    if (!isInitialized || !wordMissSynth) return;
    
    wordMissSynth.triggerAttackRelease('8n');
  },

  updateMusicIntensity: () => {
    // Disabled for now to prevent buzzing
    return;
  },

  startMusic: () => {
    // Disabled for now
    set({ isPlaying: true });
  },

  stopMusic: () => {
    // Disabled for now
    set({ isPlaying: false });
  }
}));
