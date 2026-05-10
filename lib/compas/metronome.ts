// Compás — Web Audio metronome.
//
// Used by the player's optional click-track and the 1-bar count-in. Lazy-
// initializes the AudioContext on first start (browser autoplay policies
// require a user gesture; the toggle button click satisfies that). Schedules
// short oscillator beeps with a higher tone on each downbeat.
//
// All scheduling uses AudioContext.currentTime to avoid setTimeout drift.
// The lookahead window is 100 ms; the scheduler runs every 25 ms via
// setInterval and queues every beat that falls inside the next window.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

export interface MetronomeBeat {
  /** Beat index from the moment start() was called. 0 = first beat. */
  index: number;
  /** True for the downbeat of each measure (index % beatsPerMeasure === 0). */
  isDownbeat: boolean;
}

export interface MetronomeOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** Volume in [0, 1]. Defaults to 0.4 — audible but not loud. */
  volume?: number;
  /** Stop after this many beats. Use for the 1-bar count-in. Omit for continuous. */
  totalBeats?: number;
  /** Fired right before each beat is scheduled, in case the caller wants
   *  to update UI on the beat. */
  onBeat?: (beat: MetronomeBeat) => void;
  /** Fired when the metronome runs out of scheduled beats (only when
   *  totalBeats is set). */
  onComplete?: () => void;
}

export class Metronome {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private opts: MetronomeOptions;
  private running = false;

  constructor(opts: MetronomeOptions) {
    this.opts = opts;
  }

  updateOptions(opts: Partial<MetronomeOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (!this.ctx) {
      const Ctor =
        typeof window !== 'undefined'
          ? (window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext)
          : undefined;
      if (!Ctor) {
        this.running = false;
        return;
      }
      this.ctx = new Ctor();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.opts.volume ?? 0.4;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.beatIndex = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.intervalId = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduler(): void {
    if (!this.ctx || !this.running) return;
    const beatDuration = 60 / this.opts.bpm;

    while (this.nextBeatTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const beat: MetronomeBeat = {
        index: this.beatIndex,
        isDownbeat: this.beatIndex % this.opts.beatsPerMeasure === 0,
      };
      this.scheduleClick(this.nextBeatTime, beat.isDownbeat);
      this.opts.onBeat?.(beat);

      this.beatIndex += 1;
      this.nextBeatTime += beatDuration;

      if (
        this.opts.totalBeats !== undefined &&
        this.beatIndex >= this.opts.totalBeats
      ) {
        this.stop();
        this.opts.onComplete?.();
        return;
      }
    }
  }

  private scheduleClick(when: number, isDownbeat: boolean): void {
    if (!this.ctx || !this.gain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = isDownbeat ? 1500 : 1000;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(1, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    osc.connect(env).connect(this.gain);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  destroy(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.gain = null;
    }
  }
}
