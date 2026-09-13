// PlaySense Studio — backing-track mixer slaved to the reference <video>.
//
// BROWSER ONLY. A plain class with no React, shaped like metronome.ts.
//
// This is a BINARY AUDITION MUTE, not a mixer. There is one gain per clip and
// it is only ever 0 or 1, with a short ramp to kill the click. No faders, no
// persistence, no solo. If you are here to "finish" it into a console, that is
// a product decision, not a missing feature.
//
// Design notes that are easy to get wrong:
//
//  * The <video> is the clock. We re-anchor from it on every transport event
//    rather than trying to phase-lock; the studio metronome deliberately runs
//    free for the same reason (a performed video has no constant tempo).
//  * Teardown-and-reschedule is CHEAP -- creating source nodes over already
//    decoded buffers costs microseconds. So every event does a full recompute
//    from a fresh anchor. There is intentionally no partial-update path.
//  * Source nodes are one-shot by spec and are never reused.
//  * We never pass the third `duration` argument to start(). Engines have
//    historically disagreed on whether it is buffer time or wall time when
//    playbackRate != 1; stop(when) is unambiguously context time.

import {
  scheduleClip,
  type Anchor,
  type SchedulableClip,
  type UsableRegion,
} from '@/lib/playsense-studio/clip-schedule';
import { pinClipAudio, unpinClipAudio } from '@/lib/playsense-studio/clip-audio-cache';

/** Scheduling headroom. Matches metronome.ts's lookahead. */
const LEAD_SECONDS = 0.06;
/** Ramp for the audition toggle — long enough to avoid a click. */
const GAIN_RAMP_SECONDS = 0.01;
/** Resync above this much error. Below the ~100ms where flam becomes obvious. */
const DRIFT_TOLERANCE_SECONDS = 0.08;

export interface MixerClip extends SchedulableClip {
  id: string;
  /** Cache key, so the buffer can be pinned against LRU eviction. */
  url: string;
  buffer: AudioBuffer;
}

export class BackingMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private gains = new Map<string, GainNode>();
  private sources = new Map<string, AudioBufferSourceNode>();

  private clips: MixerClip[] = [];
  private enabled: ReadonlySet<string> = new Set();
  private usable: UsableRegion = { startSeconds: 0, endSeconds: Infinity };
  private anchor: Anchor | null = null;

  /** Lazily create the context. Starts suspended, which is fine for decoding;
   *  resume() must happen inside a real user gesture (the transport click). */
  ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get isRunning(): boolean {
    return this.anchor != null;
  }

  setClips(clips: MixerClip[]) {
    for (const clip of this.clips) unpinClipAudio(clip.url);
    this.clips = clips;
    for (const clip of clips) pinClipAudio(clip.url);

    // Drop gain nodes for clips that went away.
    for (const [id, gain] of this.gains) {
      if (!clips.some((c) => c.id === id)) {
        this.stopClip(id);
        gain.disconnect();
        this.gains.delete(id);
      }
    }
  }

  setEnabled(ids: ReadonlySet<string>) {
    this.enabled = ids;
    const ctx = this.ctx;
    if (!ctx) return;
    // Gain only — never reschedule. The source keeps running, so re-enabling
    // snaps back in perfect phase instead of re-cueing from a new offset.
    for (const clip of this.clips) {
      const gain = this.gains.get(clip.id);
      if (!gain) continue;
      gain.gain.setTargetAtTime(ids.has(clip.id) ? 1 : 0, ctx.currentTime, GAIN_RAMP_SECONDS);
    }
  }

  setUsableRegion(region: UsableRegion) {
    this.usable = region;
  }

  /** Make `timelineSeconds` sound now, at `rate`. Call on play/seeked/ratechange. */
  start(timelineSeconds: number, rate: number) {
    const ctx = this.ensureContext();
    this.teardown();
    if (ctx.state !== 'running') return; // resume() first; nothing to hear yet

    this.anchor = {
      ctxStartSeconds: ctx.currentTime + LEAD_SECONDS,
      timelineStartSeconds: timelineSeconds + LEAD_SECONDS * rate,
      rate,
    };
    for (const clip of this.clips) this.scheduleOne(clip);
  }

  /** Stop every source and forget the anchor. Call on pause/seeking/ended. */
  teardown() {
    for (const id of [...this.sources.keys()]) this.stopClip(id);
    this.anchor = null;
  }

  /** Re-cue a single clip mid-playback (its placement changed). */
  rescheduleClip(id: string) {
    if (!this.anchor || !this.ctx) return;
    this.stopClip(id);
    const clip = this.clips.find((c) => c.id === id);
    if (clip) this.scheduleOne(clip);
  }

  /** Stop one clip's source, e.g. while its handle is being dragged. */
  stopClip(id: string) {
    const source = this.sources.get(id);
    if (!source) return;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    source.disconnect();
    this.sources.delete(id);
  }

  /**
   * How far the video has drifted from what we scheduled, in seconds.
   * Positive = the video is ahead of the audio. null when not playing.
   */
  drift(timelineSeconds: number): number | null {
    if (!this.anchor || !this.ctx) return null;
    const predicted =
      this.anchor.timelineStartSeconds +
      (this.ctx.currentTime - this.anchor.ctxStartSeconds) * this.anchor.rate;
    return timelineSeconds - predicted;
  }

  static get driftToleranceSeconds() {
    return DRIFT_TOLERANCE_SECONDS;
  }

  close() {
    this.teardown();
    for (const clip of this.clips) unpinClipAudio(clip.url);
    this.clips = [];
    for (const gain of this.gains.values()) gain.disconnect();
    this.gains.clear();
    this.master?.disconnect();
    this.master = null;
    const ctx = this.ctx;
    this.ctx = null;
    void ctx?.close().catch(() => {});
  }

  // ---- internals ---------------------------------------------------------

  private gainFor(id: string): GainNode {
    const ctx = this.ensureContext();
    let gain = this.gains.get(id);
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = this.enabled.has(id) ? 1 : 0;
      gain.connect(this.master!);
      this.gains.set(id, gain);
    }
    return gain;
  }

  private scheduleOne(clip: MixerClip) {
    const ctx = this.ctx;
    const anchor = this.anchor;
    if (!ctx || !anchor) return;

    const plan = scheduleClip(clip, anchor, this.usable);
    if (!plan) return;

    const source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.playbackRate.value = anchor.rate;
    source.connect(this.gainFor(clip.id));
    source.onended = () => {
      if (this.sources.get(clip.id) === source) this.sources.delete(clip.id);
    };
    source.start(Math.max(plan.when, ctx.currentTime), plan.offset);
    source.stop(plan.stopAt);
    this.sources.set(clip.id, source);
  }
}
