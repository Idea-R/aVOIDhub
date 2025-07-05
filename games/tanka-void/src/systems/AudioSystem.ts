export class AudioSystem {
  private context: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private masterVolume: number = 0.3;
  private sfxVolume: number = 0.7;
  private musicVolume: number = 0.4;

  constructor() {
    this.initializeAudioContext();
    this.createSounds();
  }

  private initializeAudioContext(): void {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private createSounds(): void {
    // Create synthetic sound effects since we can't load external files
    this.createSyntheticSound('machinegun', this.createMachineGunSound.bind(this));
    this.createSyntheticSound('cannon', this.createCannonSound.bind(this));
    this.createSyntheticSound('rocket', this.createRocketSound.bind(this));
    this.createSyntheticSound('explosion', this.createExplosionSound.bind(this));
    this.createSyntheticSound('engine', this.createEngineSound.bind(this));
    this.createSyntheticSound('hit', this.createHitSound.bind(this));
  }

  private createSyntheticSound(name: string, generator: () => AudioBuffer | null): void {
    if (!this.context) return;
    
    const buffer = generator();
    if (buffer) {
      this.sounds.set(name, buffer);
    }
  }

  private createMachineGunSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 0.1;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Sharp crack with quick decay
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.5;
    }

    return buffer;
  }

  private createCannonSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 0.3;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Deep boom with low frequency
      const lowFreq = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 8);
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.3;
      data[i] = (lowFreq + crack) * 0.7;
    }

    return buffer;
  }

  private createRocketSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 0.5;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Whoosh sound with rising frequency
      const freq = 200 + t * 300;
      data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2) * 0.4;
    }

    return buffer;
  }

  private createExplosionSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 1.0;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Big boom with rumble
      const lowRumble = Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 3);
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 10) * 0.5;
      data[i] = (lowRumble + crack) * 0.8;
    }

    return buffer;
  }

  private createEngineSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 0.5;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Low rumbling engine
      data[i] = Math.sin(2 * Math.PI * 80 * t) * 0.3 + 
                (Math.random() * 2 - 1) * 0.1;
    }

    return buffer;
  }

  private createHitSound(): AudioBuffer | null {
    if (!this.context) return null;

    const duration = 0.2;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Sharp metallic hit
      data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 20) * 0.6;
    }

    return buffer;
  }

  playSound(soundName: string, x?: number, y?: number, listenerX?: number, listenerY?: number, volume: number = 1): void {
    if (!this.context || !this.sounds.has(soundName)) return;

    try {
      const buffer = this.sounds.get(soundName)!;
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();

      source.buffer = buffer;
      
      // Calculate distance-based volume if positions provided
      let finalVolume = volume * this.masterVolume * this.sfxVolume;
      if (x !== undefined && y !== undefined && listenerX !== undefined && listenerY !== undefined) {
        const distance = Math.sqrt((x - listenerX) ** 2 + (y - listenerY) ** 2);
        const maxDistance = 500;
        const distanceFactor = Math.max(0, 1 - distance / maxDistance);
        finalVolume *= distanceFactor;
      }

      gainNode.gain.value = Math.max(0, Math.min(1, finalVolume));

      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      source.start();
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  resume(): void {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }
}