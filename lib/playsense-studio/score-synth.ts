// PlaySense Studio — score synth engine (Listen).
//
// BROWSER ONLY (the scheduling class). Builds timeline notes from the score
// and the sync markers, converts them to MEDIA seconds through the flex map,
// and schedules them against the recording's own clock the way ClickTrack
// schedules the click (see lib/playsense-studio/click-track.ts): a per-tick
// lookahead over a monotone `nextIndex`, a note too close to now dropped
// rather than played late, and teardown ramping a per-run gain bus instead of
// cutting the sources.
//
// Building the notes reuses extractTrackEvents (score-to-vexflow.ts), the
// same walk the notation renderer and note-onsets.ts use: it already expands
// chords to one entry per pitch, carries each event's tied-forward pitches
// (tiedMidiPitches) and drops grace notes (they're never emitted as events,
// only as a `grace` side list on the event they lead into). Ties are merged
// here by keeping an "open" note per pitch until an event doesn't carry that
// pitch forward — mirroring the tieCarry bookkeeping extractTrackEvents does
// for accidentals, but merging into one long note instead of just flagging
// the continuation. A rest clears every open tie, matching tieCarry being
// reset to [] on a rest there, and so does a measure where the voice is absent.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { noteTime, gridTime, type MarkerState } from '@/components/playsense-studio/sync/marker-model';
import type { FlexMap } from '@/lib/playsense-studio/flex';
import { firstIndexAtOrAfter } from '@/lib/playsense-studio/beat-grid';

export interface SynthNote {
  start: number;
  end: number;
  midi: number;
  voice: 1 | 2;
  percussion: boolean;
}

interface OpenNote {
  startQN: number;
  endQN: number;
}

/**
 * Timeline notes for the active track: voice 1 and 2, ties merged, rests and
 * graces skipped, chords expanded to one note per pitch. Start/end are in
 * QN-derived TIMELINE seconds (start includes nudges via `noteTime`; end is
 * the plain grid time of the note's QN end, per global-constraints.md).
 * Sorted by start.
 */
export function scoreSynthNotes(
  score: ScoreDocument,
  trackIndex: number,
  markers: MarkerState
): SynthNote[] {
  const track = score.tracks[trackIndex];
  if (!track) return [];
  const percussion = isPercussion(track.instrument);
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths ?? 0);

  const notes: SynthNote[] = [];

  for (const voiceNo of [1, 2] as const) {
    const open = new Map<number, OpenNote>();
    const finalize = (midi: number, o: OpenNote) => {
      notes.push({
        start: noteTime(markers, o.startQN),
        end: gridTime(markers, o.endQN),
        midi,
        voice: voiceNo,
        percussion,
      });
    };
    const closeAllOpen = () => {
      for (const [midi, o] of open) finalize(midi, o);
      open.clear();
    };

    for (const block of blocks) {
      const events = voiceNo === 1 ? block.events : block.voice2Events;
      // A voice with no events in a measure breaks its ties, as
      // extractTrackEvents resets tieCarry for an empty voice.
      if (events.length === 0) closeAllOpen();
      for (const ev of events) {
        if (ev.isRest) {
          // A rest breaks any tie in flight — matches extractTrackEvents
          // resetting tieCarry to [] on a rest.
          closeAllOpen();
          continue;
        }
        const pitches = ev.midiPitches ?? [];
        const tiedForward = new Set(ev.tiedMidiPitches ?? []);
        const endQN = ev.qnStart + ev.durationQN;
        for (const midi of pitches) {
          const existing = open.get(midi);
          if (existing) {
            existing.endQN = endQN;
            if (!tiedForward.has(midi)) {
              finalize(midi, existing);
              open.delete(midi);
            }
          } else if (tiedForward.has(midi)) {
            open.set(midi, { startQN: ev.qnStart, endQN });
          } else {
            finalize(midi, { startQN: ev.qnStart, endQN });
          }
        }
      }
    }
    closeAllOpen();
  }

  return notes.sort((a, b) => a.start - b.start);
}

/** Same notes with start/end converted to MEDIA seconds through the flex map. */
export function toMediaNotes(notes: SynthNote[], flex: FlexMap): SynthNote[] {
  return notes.map((n) => ({ ...n, start: flex.toMedia(n.start), end: flex.toMedia(n.end) }));
}

// ---------------------------------------------------------------------------
// Scheduling — modeled on ClickTrack (lib/playsense-studio/click-track.ts).
// ---------------------------------------------------------------------------

const TICK_MS = 25;
/** Same horizon ClickTrack uses: several ticks of headroom, at most a beat. */
const HORIZON_SEC = 0.12;
/** Floor for the lead, when the context doesn't report its own latency. */
const MIN_LEAD_FLOOR_SEC = 0.015;
const RAMP_SEC = 0.005;
const BUS_RETIRE_MS = 60;

const PITCHED_PEAK_V1 = 0.25;
const PITCHED_PEAK_V2 = 0.12;
const ATTACK_SEC = 0.004;
const DECAY_SEC = 0.08;
const MIN_GAIN = 0.001;

const PERC_DURATION_SEC = 0.03;
const PERC_FILTER_HZ = 1800;
const PERC_PEAK = 0.3;

/** A restart this close to the loop's A takes the notes just before A too: a
 *  downbeat nudged early, or a seek the browser lands a frame late. */
const LOOP_START_GRACE_SEC = 0.04;
/** A note at the loop's B belongs to the next pass (it's the next bar's downbeat). */
const LOOP_END_EPS_SEC = 0.002;

/** Small tail past the decay so `.stop()` never clips the release. */
const STOP_MARGIN_SEC = 0.02;

interface SynthAnchor {
  ctxStartSeconds: number;
  mediaStartSeconds: number;
  rate: number;
}

function defaultAudioContext(): AudioContext {
  const Ctor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor({ latencyHint: 'interactive' });
}

/**
 * Schedules the written notes as Web Audio, phase-locked to a media clock the
 * same way ClickTrack locks the click to it. `notes` must be MEDIA seconds
 * (toMediaNotes' output) and sorted by start — this class trusts that
 * contract rather than re-sorting, exactly like ClickTrack.setGrid.
 */
export class ScoreSynth {
  private readonly ctxFactory: () => AudioContext;
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private live = new Set<AudioScheduledSourceNode>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private notes: SynthNote[] = [];
  private starts: number[] = [];
  private nextIndex = 0;
  private anchor: SynthAnchor | null = null;
  private volume = 1;
  /** The running A/B loop in MEDIA seconds, or null. */
  private loop: { a: number; b: number } | null = null;
  /** The start of the last note the tick advanced past (scheduled or dropped). */
  private scheduledThrough = -Infinity;

  constructor(ctxFactory?: () => AudioContext) {
    this.ctxFactory = ctxFactory ?? defaultAudioContext;
  }

  /** Create the context on first use; resume() it from a user gesture before start(). */
  ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = this.ctxFactory();
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get isRunning(): boolean {
    return this.anchor != null;
  }

  /** Media seconds, sorted by start. */
  setNotes(notes: SynthNote[]) {
    this.notes = notes;
    this.starts = notes.map((n) => n.start);
    if (this.anchor && this.ctx) {
      const media = this.mediaNow();
      // Resume past what the tick already handled, so notes already on the
      // bus aren't scheduled a second time (an edit while playing).
      if (media != null) {
        this.nextIndex = firstIndexAtOrAfter(this.starts, Math.max(media, this.scheduledThrough + 1e-6));
      }
    }
  }

  /** The running loop in MEDIA seconds: nothing at or past B is scheduled, and
   *  a note held over B is cut there, so the wrap never plays the next bar. */
  setLoop(loop: { a: number; b: number } | null) {
    this.loop = loop && loop.b > loop.a ? loop : null;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.bus && this.ctx) {
      this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  /** Schedule from mediaNow at playback rate. Call on play / playing / seeked / ratechange. */
  start(mediaNow: number, rate: number) {
    const ctx = this.ensureContext();
    this.teardown();
    if (ctx.state !== 'running') return; // resume() first; nothing to hear yet
    if (!(rate > 0) || !Number.isFinite(mediaNow)) return;

    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume;
    this.bus.connect(ctx.destination);

    this.anchor = { ctxStartSeconds: ctx.currentTime, mediaStartSeconds: mediaNow, rate };
    const nearLoopStart = this.loop != null && Math.abs(mediaNow - this.loop.a) <= LOOP_START_GRACE_SEC;
    const from = nearLoopStart ? Math.min(mediaNow, this.loop!.a - LOOP_START_GRACE_SEC) : mediaNow;
    this.nextIndex = firstIndexAtOrAfter(this.starts, from);
    this.scheduledThrough = -Infinity;

    this.timer = setInterval(() => this.tick(false), TICK_MS);
    // The first tick of a fresh start lifts notes at the play position up to
    // the lead instead of dropping them: pressing play on a note must sound it.
    this.tick(true);
  }

  /** Correct a stale media<->context mapping without restarting (see ClickTrack.reanchor). */
  reanchor(mediaNow: number, rate: number) {
    if (!this.anchor || !this.ctx) return;
    if (!(rate > 0) || !Number.isFinite(mediaNow)) return;
    this.anchor = { ctxStartSeconds: this.ctx.currentTime, mediaStartSeconds: mediaNow, rate };
  }

  /** How far the media clock has drifted from what we scheduled, in seconds (see ClickTrack.drift). */
  drift(mediaSeconds: number): number | null {
    const predicted = this.mediaNow();
    return predicted == null ? null : mediaSeconds - predicted;
  }

  /** Silence scheduled notes (gain bus to 0) and stop the tick. */
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
    this.noiseBuffer = null;
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

  private tick(liftLateToLead: boolean) {
    const ctx = this.ctx;
    const anchor = this.anchor;
    if (!ctx || !anchor || !this.bus) return;

    const now = ctx.currentTime;
    const horizonMedia =
      anchor.mediaStartSeconds + (now + HORIZON_SEC - anchor.ctxStartSeconds) * anchor.rate;
    const lead = this.minLead;
    const toCtxTime = (media: number) =>
      anchor.ctxStartSeconds + (media - anchor.mediaStartSeconds) / anchor.rate;

    while (this.nextIndex < this.notes.length && this.notes[this.nextIndex].start <= horizonMedia) {
      const note = this.notes[this.nextIndex];
      // ALWAYS advance, even when we drop the note below, so a re-anchor can
      // never replay one (same invariant as ClickTrack.tick).
      this.nextIndex += 1;
      this.scheduledThrough = note.start;
      const loop = this.loop;
      if (loop && note.start >= loop.b - LOOP_END_EPS_SEC) continue;

      let when = toCtxTime(note.start);
      if (when < now + lead) {
        if (!liftLateToLead) continue; // too late to be on time: drop, never late
        when = now + lead;
      }

      const end = loop && note.end > loop.b ? loop.b : note.end;
      const whenEnd = Math.max(when, toCtxTime(end));
      this.scheduleNote(ctx, note, when, whenEnd);
    }
  }

  private scheduleNote(ctx: AudioContext, note: SynthNote, when: number, whenEnd: number) {
    if (!this.bus) return;
    if (note.percussion) {
      this.schedulePercussion(ctx, when);
      return;
    }

    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    const peak = note.voice === 1 ? PITCHED_PEAK_V1 : PITCHED_PEAK_V2;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const attackEnd = when + ATTACK_SEC;
    const holdEnd = Math.max(whenEnd, attackEnd);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, attackEnd);
    gain.gain.setValueAtTime(peak, holdEnd);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, holdEnd + DECAY_SEC);

    osc.connect(gain);
    gain.connect(this.bus);
    osc.onended = () => {
      this.live.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(when);
    osc.stop(holdEnd + DECAY_SEC + STOP_MARGIN_SEC);
    this.live.add(osc);
  }

  private schedulePercussion(ctx: AudioContext, when: number) {
    if (!this.bus) return;
    const buffer = this.ensureNoiseBuffer(ctx);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = PERC_FILTER_HZ;

    const gain = ctx.createGain();
    const endAt = when + PERC_DURATION_SEC;
    gain.gain.setValueAtTime(PERC_PEAK, when);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endAt);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    source.onended = () => {
      this.live.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(when);
    source.stop(endAt + STOP_MARGIN_SEC);
    this.live.add(source);
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const sampleRate = ctx.sampleRate;
      const length = Math.max(1, Math.ceil(sampleRate * PERC_DURATION_SEC));
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}
