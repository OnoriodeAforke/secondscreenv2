// Web Audio API procedural Synthwave / Cyberpunk music engine for SecondScreen Wrapped
// 100% offline, zero external dependencies, seamless looping and responsive mute control

class WrappedAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private nextStepTime: number = 0;
  private currentStep: number = 0;
  private timerId: number | null = null;
  private listeners: Set<(playing: boolean) => void> = new Set();

  private readonly BPM = 122;
  private readonly SECONDS_PER_BEAT = 60 / 122;
  private readonly STEP_TIME = (60 / 122) / 4; // 16th note step: ~0.123s
  private readonly SCHEDULE_AHEAD_TIME = 0.15; // 150ms lookahead
  private readonly LOOKAHEAD_INTERVAL = 30; // check every 30ms

  // Chord progression (Dm -> Bb -> F -> C) - 4 bars of 16 steps each = 64 steps
  private readonly ROOT_NOTES = [
    // Bar 1: Dm
    73.42, 73.42, 73.42, 73.42, 73.42, 73.42, 73.42, 73.42,
    73.42, 73.42, 73.42, 73.42, 73.42, 73.42, 73.42, 73.42,
    // Bar 2: Bb
    58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27,
    58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27,
    // Bar 3: F
    87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31,
    87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31,
    // Bar 4: C
    65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41,
    65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41
  ];

  // Lead arpeggio frequencies (Hz) across 64 steps
  private readonly ARP_NOTES = [
    // Bar 1 (Dm): D4, F4, A4, D5, C5, A4, F4, A4 ...
    293.66, 349.23, 440.00, 587.33, 523.25, 440.00, 349.23, 440.00,
    293.66, 349.23, 440.00, 587.33, 659.25, 587.33, 523.25, 440.00,
    // Bar 2 (Bb): Bb3, D4, F4, Bb4, A4, F4, D4, F4 ...
    233.08, 293.66, 349.23, 466.16, 440.00, 349.23, 293.66, 349.23,
    233.08, 293.66, 349.23, 466.16, 523.25, 466.16, 440.00, 349.23,
    // Bar 3 (F): F3, A3, C4, F4, E4, C4, A3, C4 ...
    174.61, 220.00, 261.63, 349.23, 329.63, 261.63, 220.00, 261.63,
    174.61, 220.00, 261.63, 349.23, 392.00, 349.23, 329.63, 261.63,
    // Bar 4 (C): C4, E4, G4, C5, B4, G4, E4, G4 ...
    261.63, 329.63, 392.00, 523.25, 493.88, 392.00, 329.63, 392.00,
    261.63, 329.63, 392.00, 523.25, 587.33, 523.25, 440.00, 392.00
  ];

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Master Compressor for punchy EDM / Synthwave loudness
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.28, this.ctx.currentTime);

    // Analyser Node for visualizer animations
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Generate White Noise Buffer for drums (Snare & Hi-hats)
    const bufferSize = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  // Play Kick Drum
  private playKick(time: number) {
    if (!this.ctx || !this.compressor) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

    gain.gain.setValueAtTime(0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  // Play Snare / Cyber Clap
  private playSnare(time: number) {
    if (!this.ctx || !this.compressor || !this.noiseBuffer) return;

    // Noise component
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, time);
    noiseFilter.Q.setValueAtTime(1.2, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.16);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.compressor);

    // Tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);

    oscGain.gain.setValueAtTime(0.35, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.compressor);

    noiseSource.start(time);
    noiseSource.stop(time + 0.2);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  // Play Hi-Hat
  private playHiHat(time: number, accent: boolean = false) {
    if (!this.ctx || !this.compressor || !this.noiseBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    const vol = accent ? 0.22 : 0.12;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + (accent ? 0.07 : 0.035));

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    source.start(time);
    source.stop(time + 0.08);
  }

  // Play Synthwave Rolling Bassline Note
  private playBass(time: number, freq: number) {
    if (!this.ctx || !this.compressor) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(240, time + 0.11);
    filter.Q.setValueAtTime(3.5, time);

    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.13);
  }

  // Play Lead Arpeggio Synth Note
  private playArp(time: number, freq: number) {
    if (!this.ctx || !this.compressor) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 1.004, time); // slight detune for stereo lush chorus

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + 0.18);
    filter.Q.setValueAtTime(4.0, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + 0.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.22);
    osc2.stop(time + 0.22);
  }

  // Main step sequencer
  private schedule() {
    if (!this.ctx || !this.isPlaying) return;

    while (this.nextStepTime < this.ctx.currentTime + this.SCHEDULE_AHEAD_TIME) {
      const step = this.currentStep % 64;
      const stepInBar = step % 16;
      const t = this.nextStepTime;

      // 1. Drums Rhythm (Four on the floor punchy synthwave beat)
      // Kick on 16th steps 0, 4, 8, 12 (beats 1, 2, 3, 4)
      if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
        this.playKick(t);
      }

      // Snare on beats 2 and 4 (steps 4 and 12)
      if (stepInBar === 4 || stepInBar === 12) {
        this.playSnare(t);
      }

      // Hi-Hats on every even 16th note, accented on off-beats
      if (stepInBar % 2 === 0) {
        const isOffbeat = (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14);
        this.playHiHat(t, isOffbeat);
      }

      // 2. Rolling 16th Bassline
      const bassRoot = this.ROOT_NOTES[step] || 73.42;
      // Octave bounce on odd steps
      const bassFreq = (step % 2 === 1) ? bassRoot * 2 : bassRoot;
      this.playBass(t, bassFreq);

      // 3. Cyberpunk Lead Arp
      const arpFreq = this.ARP_NOTES[step];
      if (arpFreq) {
        this.playArp(t, arpFreq);
      }

      // Advance step
      this.currentStep++;
      this.nextStepTime += this.STEP_TIME;
    }

    if (this.isPlaying) {
      this.timerId = window.setTimeout(() => this.schedule(), this.LOOKAHEAD_INTERVAL);
    }
  }

  public async start(): Promise<void> {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Autoplay policy may suspend until user gesture
      }
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.schedule();

    this.notifyListeners();
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isPlaying = false;
    this.notifyListeners();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      if (muted) {
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.1);
      } else {
        this.masterGain.gain.linearRampToValueAtTime(0.28, now + 0.1);
      }
    }
    this.notifyListeners();
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public subscribe(cb: (playing: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb(this.isPlaying && !this.isMuted));
  }
}

export const wrappedAudio = new WrappedAudioEngine();
