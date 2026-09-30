// PlaySense Studio — a click track phase-locked to a media clock.
//
// BROWSER ONLY. A plain class with no React, shaped on backing-mixer.ts.
//
// Replaces lib/playsense-studio/metronome.ts, whose start() meant "beat one is
// NOW" — so its beat one landed wherever the student happened to press play.
// Here the beat times are given in MEDIA seconds (see beat-grid.ts) and the
// only thing start() establishes is which context time a given media time
// sounds at. Same beats, every time, no matter when you pressed play.
//
// Three rules carry the design:
//
//   1. The grid is a monotone array and `nextIndex` only ever moves forward,
//      including for a beat we decide to drop. That single invariant makes a
//      double-click structurally impossible under re-anchoring.
//   2. A beat too close to now is DROPPED, never fired late. A hole is far
//      less objectionable than a flam — and firing inside the context's own
//      latency would be late and jittery anyway.
//   3. Teardown silences a per-generation gain bus rather than the source
//      nodes. Scheduled sources cannot be reliably un-scheduled, and a hard cut
//      pops.
//
// The click is UNIFORM. The anchor marks any beat, not necessarily a downbeat,
// so accenting a bar would be a guess. (The old accent was counted from
// wherever play started, i.e. it was already accenting arbitrary beats.)

import { firstIndexAtOrAfter } from '@/lib/playsense-studio/beat-grid';

/** Shared by every surface that offers a click, so one viewer's level follows
 *  them from the studio to the student player instead of being two settings. */
export const CLICK_VOLUME_STORAGE_KEY = 'playsense.clickVolume';
export const DEFAULT_CLICK_VOLUME = 0.2;

/** Read the stored level, tolerating private windows and blocked site data. */
export function readStoredClickVolume(): number {
  try {
    const raw = window.localStorage.getItem(CLICK_VOLUME_STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_CLICK_VOLUME;
  } catch {
    return DEFAULT_CLICK_VOLUME;
  }
}

export function writeStoredClickVolume(volume: number): void {
  try {
    window.localStorage.setItem(CLICK_VOLUME_STORAGE_KEY, String(volume));
  } catch {
    /* not persisting is fine */
  }
}

const TICK_MS = 25;
/**
 * Scheduling horizon. At least 4 ticks, so three consecutive slipped timers
 * still can't cause a miss; at most one beat period at the fastest supported
 * rate, so a re-anchor never has more than one beat committed against a stale
 * anchor.
 */
const HORIZON_SEC = 0.12;
/** Floor for the lead, when the context doesn't report its own latency. */
const MIN_LEAD_FLOOR_SEC = 0.015;
const RAMP_SEC = 0.005;
const BUS_RETIRE_MS = 60;

export interface ClickAnchor {
  ctxStartSeconds: number;
  mediaStartSeconds: number;
  rate: number;
}

export class ClickTrack {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private bus: GainNode | null = null;
  private live = new Set<AudioBufferSourceNode>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private grid: readonly number[] = [];
  private nextIndex = 0;
  private anchor: ClickAnchor | null = null;
  private volume = 0.2;
  /** Manual nudge for the offset between the element's audio path and ours. */
  private offsetSeconds = 0;

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buffer = renderClick(this.ctx);
    }
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get isRunning(): boolean {
    return this.anchor != null;
  }

  /**
   * Replace the beat grid without interrupting playback. Re-derives the cursor
   * from the current media position, so no beat is replayed.
   */
  setGrid(grid: readonly number[]) {
    this.grid = grid;
    if (this.anchor && this.ctx) {
      const media = this.mediaNow();
      if (media != null) this.nextIndex = firstIndexAtOrAfter(this.grid, media);
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.bus && this.ctx) {
      this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  setOffsetSeconds(offsetSeconds: number) {
    this.offsetSeconds = Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
  }

  /** Make `mediaSeconds` sound now. Call on play / playing / seeked / ratechange. */
  start(mediaSeconds: number, rate: number, scheduleAhead = false): number | undefined {
    const ctx = this.ensureContext();
    this.teardown();
    if (ctx.state !== 'running') return; // resume() first; nothing to hear yet
    if (!(rate > 0) || !Number.isFinite(mediaSeconds)) return;

    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume;
    this.bus.connect(ctx.destination);

    this.anchor = {
      // A standalone score owns its clock: reserve enough lead to include
      // beat zero. Media players keep their already-running external clock.
      ctxStartSeconds: ctx.currentTime + (scheduleAhead ? this.minLead + TICK_MS / 1000 : 0),
      mediaStartSeconds: mediaSeconds,
      rate,
    };
    this.nextIndex = firstIndexAtOrAfter(this.grid, mediaSeconds);

    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    return this.anchor.ctxStartSeconds;
  }

  /**
   * Correct a stale media↔context mapping WITHOUT restarting. The beat times
   * are constants, so tempo can't drift — but the two clocks are independent
   * hardware and the mapping does. Restarting here would reset nextIndex and
   * could replay a beat, which is why this is a separate operation.
   */
  reanchor(mediaSeconds: number, rate: number) {
    if (!this.anchor || !this.ctx) return;
    if (!(rate > 0) || !Number.isFinite(mediaSeconds)) return;
    this.anchor = {
      ctxStartSeconds: this.ctx.currentTime,
      mediaStartSeconds: mediaSeconds,
      rate,
    };
  }

  /** How far the media clock has drifted from what we scheduled, in seconds. */
  drift(mediaSeconds: number): number | null {
    if (!this.anchor || !this.ctx) return null;
    const predicted =
      this.anchor.mediaStartSeconds +
      (this.ctx.currentTime - this.anchor.ctxStartSeconds) * this.anchor.rate;
    return mediaSeconds - predicted;
  }

  teardown() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    const bus = this.bus;
    const dying = this.live;
    this.bus = null;
    this.live = new Set();
    this.anchor = null;

    if (ctx && bus) {
      // Ramp the bus down rather than cutting: already-scheduled sources can't
      // be reliably un-scheduled, and a hard cut on a transient pops.
      const t = ctx.currentTime;
      try {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(bus.gain.value, t);
        bus.gain.linearRampToValueAtTime(0, t + RAMP_SEC);
      } catch {
        /* a detached node can throw; the retire below still cleans up */
      }
      setTimeout(() => {
        for (const source of dying) {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
          source.disconnect();
        }
        bus.disconnect();
      }, BUS_RETIRE_MS);
    }
  }

  close() {
    this.teardown();
    const ctx = this.ctx;
    this.ctx = null;
    this.buffer = null;
    void ctx?.close().catch(() => {});
  }

  // ---- internals ---------------------------------------------------------

  private mediaNow(): number | null {
    if (!this.anchor || !this.ctx) return null;
    return (
      this.anchor.mediaStartSeconds +
      (this.ctx.currentTime - this.anchor.ctxStartSeconds) * this.anchor.rate
    );
  }

  private get minLead(): number {
    const reported = this.ctx?.baseLatency;
    return Math.max(MIN_LEAD_FLOOR_SEC, Number.isFinite(reported) ? (reported as number) : 0);
  }

  private tick() {
    const ctx = this.ctx;
    const anchor = this.anchor;
    if (!ctx || !anchor || !this.bus || !this.buffer) return;

    const now = ctx.currentTime;
    const horizonMedia =
      anchor.mediaStartSeconds + (now + HORIZON_SEC - anchor.ctxStartSeconds) * anchor.rate;
    const lead = this.minLead;

    while (this.nextIndex < this.grid.length && this.grid[this.nextIndex] <= horizonMedia) {
      const media = this.grid[this.nextIndex];
      // ALWAYS advance, even when we drop the beat below — this is what makes a
      // double-click impossible after a re-anchor.
      this.nextIndex += 1;

      const when =
        anchor.ctxStartSeconds +
        (media - anchor.mediaStartSeconds) / anchor.rate +
        this.offsetSeconds;
      if (when < now + lead) continue; // too late to be on time: drop, never flam

      const source = ctx.createBufferSource();
      source.buffer = this.buffer;
      source.connect(this.bus);
      source.onended = () => {
        this.live.delete(source);
        source.disconnect();
      };
      source.start(when);
      this.live.add(source);
    }
  }
}

/**
 * One short click, rendered once per context.
 *
 * A 3.5kHz sine sits above the 120-2000Hz band where congas and timbales live,
 * so it stays audible over the material instead of fighting it — the same
 * reasoning use-metronome.ts gives for the exercise click, and the opposite of
 * the 1kHz square this replaces. The 1ms raised-cosine attack removes the
 * onset discontinuity; a smeared attack reads as "not quite on the beat" even
 * when the scheduling is perfect.
 */
function renderClick(ctx: BaseAudioContext): AudioBuffer {
  const durationSeconds = 0.04;
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.ceil(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const attack = Math.max(1, Math.floor(sampleRate * 0.001));
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const rise = i < attack ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attack) : 1;
    const decay = Math.exp(-t / 0.006);
    data[i] = Math.sin(2 * Math.PI * 3500 * t) * rise * decay;
  }
  return buffer;
}
