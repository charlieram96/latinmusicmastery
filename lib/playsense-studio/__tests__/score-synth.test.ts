import { describe, expect, it, vi } from 'vitest';
import { scoreSynthNotes, toMediaNotes, ScoreSynth, type SynthNote } from '../score-synth';
import { seedMarkerState } from '@/components/playsense-studio/sync/marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { FlexMap, type FlexPoint } from '@/lib/playsense-studio/flex';
import { GUITAR_LICK_FIXTURE } from '../score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const GUITAR = GUITAR_LICK_FIXTURE;
const GUITAR_TRACK = GUITAR.tracks[0];

function guitarMarkers(nudges: Array<{ qn: number; deltaSeconds: number }> = []) {
  return seedMarkerState(GUITAR_TRACK, GUITAR, buildWaypoints(GUITAR, 120, 0), nudges);
}

function score(measures: ScoreDocument['tracks'][0]['measures']): ScoreDocument {
  return {
    schemaVersion: 1,
    title: 'Test score',
    sourceFormat: 'native',
    initialTempo: 120,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    tracks: [
      {
        index: 0,
        instrument: 'staff',
        displayName: 'Staff',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures,
      },
    ],
  };
}

function p(src: number, dst: number, anchor = false): FlexPoint {
  return { src, dst, anchor };
}

describe('scoreSynthNotes', () => {
  it('gives a 4/4 bar of quarter notes at 120bpm starts 0,0.5,1,1.5 and ends 0.5,1,1.5,2', () => {
    const markers = guitarMarkers();
    const notes = scoreSynthNotes(GUITAR, 0, markers);
    const first4 = notes.slice(0, 4);
    expect(first4.map((n) => n.start)).toEqual([0, 0.5, 1, 1.5]);
    expect(first4.map((n) => n.end)).toEqual([0.5, 1, 1.5, 2]);
    expect(first4.map((n) => n.midi)).toEqual([60, 62, 64, 65]);
    expect(first4.every((n) => n.voice === 1 && n.percussion === false)).toBe(true);
  });

  it('merges a tie across the bar line into one note', () => {
    const tieScore = score([
      {
        number: 1,
        voices: [
          {
            number: 1,
            events: [
              { kind: 'rest', durationQN: 3 },
              { kind: 'note', midi: 60, durationQN: 1, tieToNext: true },
            ],
          },
        ],
      },
      {
        number: 2,
        voices: [
          {
            number: 1,
            events: [
              { kind: 'note', midi: 60, durationQN: 1 },
              { kind: 'rest', durationQN: 3 },
            ],
          },
        ],
      },
    ]);
    const markers = seedMarkerState(tieScore.tracks[0], tieScore, buildWaypoints(tieScore, 120, 0));
    const notes = scoreSynthNotes(tieScore, 0, markers);
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].start).toBeCloseTo(1.5); // qn 3 * 0.5s/qn
    expect(notes[0].end).toBeCloseTo(2.5); // qn 5 (4+1) * 0.5s/qn
  });

  it('moves a nudged beat-2 start to 0.52 while leaving the end unchanged', () => {
    // Beat 2 of measure 1 is qn 1 (the D4 quarter note).
    const markers = guitarMarkers([{ qn: 1, deltaSeconds: 0.02 }]);
    const notes = scoreSynthNotes(GUITAR, 0, markers);
    const beat2 = notes.find((n) => n.midi === 62)!;
    expect(beat2).toBeDefined();
    expect(beat2.start).toBeCloseTo(0.52);
    expect(beat2.end).toBeCloseTo(1.0);
  });

  it('comes out with voice: 2 for the second voice', () => {
    const twoVoiceScore = score([
      {
        number: 1,
        voices: [
          { number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] },
          { number: 2, events: [{ kind: 'note', midi: 48, durationQN: 2 }, { kind: 'rest', durationQN: 2 }] },
        ],
      },
    ]);
    const markers = seedMarkerState(
      twoVoiceScore.tracks[0],
      twoVoiceScore,
      buildWaypoints(twoVoiceScore, 120, 0)
    );
    const notes = scoreSynthNotes(twoVoiceScore, 0, markers);
    const v2 = notes.filter((n) => n.voice === 2);
    expect(v2).toHaveLength(1);
    expect(v2[0].midi).toBe(48);
    const v1 = notes.filter((n) => n.voice === 1);
    expect(v1).toHaveLength(1);
    expect(v1[0].midi).toBe(60);
  });

  it('skips rests and grace notes', () => {
    const graceScore = score([
      {
        number: 1,
        voices: [
          {
            number: 1,
            events: [
              { kind: 'rest', durationQN: 1 },
              { kind: 'note', midi: 60, durationQN: 1 },
              { kind: 'note', midi: 62, durationQN: 1, grace: [{ midi: 59, slash: true }] },
              { kind: 'rest', durationQN: 1 },
            ],
          },
        ],
      },
    ]);
    const markers = seedMarkerState(graceScore.tracks[0], graceScore, buildWaypoints(graceScore, 120, 0));
    const notes = scoreSynthNotes(graceScore, 0, markers);
    expect(notes.map((n) => n.midi)).toEqual([60, 62]);
    expect(notes.some((n) => n.midi === 59)).toBe(false);
  });

  it('expands a chord to one note per pitch, all sounding together', () => {
    const chordScore = score([
      {
        number: 1,
        voices: [
          {
            number: 1,
            events: [
              { kind: 'chord', durationQN: 2, notes: [{ midi: 60 }, { midi: 64 }, { midi: 67 }] },
              { kind: 'rest', durationQN: 2 },
            ],
          },
        ],
      },
    ]);
    const markers = seedMarkerState(chordScore.tracks[0], chordScore, buildWaypoints(chordScore, 120, 0));
    const notes = scoreSynthNotes(chordScore, 0, markers);
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.midi).sort((a, b) => a - b)).toEqual([60, 64, 67]);
    for (const n of notes) {
      expect(n.start).toBeCloseTo(0);
      expect(n.end).toBeCloseTo(1); // 2 QN * 0.5s/qn
    }
  });
});

describe('toMediaNotes', () => {
  it('sends a timeline start of 1.2 to media 1.0 through the flex map', () => {
    const flex = new FlexMap([p(0, 0, true), p(1, 1.2), p(4, 4, true)]);
    const notes: SynthNote[] = [{ start: 1.2, end: 4, midi: 60, voice: 1, percussion: false }];
    const media = toMediaNotes(notes, flex);
    expect(media[0].start).toBeCloseTo(1.0);
    expect(media[0].end).toBeCloseTo(4);
  });
});

// ---------------------------------------------------------------------------
// Scheduling — a fake AudioContext standing in for the real one.
// ---------------------------------------------------------------------------

function fakeParam(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function createFakeAudioContext() {
  const starts: number[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running' as AudioContextState,
    sampleRate: 44100,
    baseLatency: undefined as number | undefined,
    destination: fakeNode(),
    createGain: vi.fn(() => ({ ...fakeNode(), gain: fakeParam(1) })),
    createOscillator: vi.fn(() => {
      const node = {
        ...fakeNode(),
        type: 'sine',
        frequency: fakeParam(440),
        onended: null as (() => void) | null,
        start: vi.fn((t: number) => starts.push(t)),
        stop: vi.fn(),
      };
      return node;
    }),
    createBufferSource: vi.fn(() => {
      const node = {
        ...fakeNode(),
        buffer: null as unknown,
        onended: null as (() => void) | null,
        start: vi.fn((t: number) => starts.push(t)),
        stop: vi.fn(),
      };
      return node;
    }),
    createBiquadFilter: vi.fn(() => ({ ...fakeNode(), type: 'lowpass', frequency: fakeParam(350) })),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
      getChannelData: () => new Float32Array(length),
      length,
      sampleRate,
      numberOfChannels: channels,
    })),
    close: vi.fn(() => Promise.resolve()),
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, starts };
}

describe('ScoreSynth scheduling', () => {
  it('one tick schedules only the notes whose media start is in the horizon, dropping past notes', () => {
    const { ctx, starts } = createFakeAudioContext();
    const synth = new ScoreSynth(() => ctx);
    synth.setNotes([
      { start: 0.85, end: 0.95, midi: 60, voice: 1, percussion: false }, // before mediaNow: never reached
      { start: 0.92, end: 1.02, midi: 62, voice: 1, percussion: false }, // in [0.9, 1.02]
      { start: 1.0, end: 1.1, midi: 64, voice: 1, percussion: false }, // in [0.9, 1.02]
      { start: 1.05, end: 1.15, midi: 65, voice: 1, percussion: false }, // beyond this tick's horizon
    ]);

    synth.start(0.9, 1);

    // ctxStartSeconds = 0 (fake currentTime never advances), mediaStartSeconds = 0.9, rate = 1,
    // so context `when` = media - 0.9. The 0.85 note is skipped by nextIndex before scheduling
    // even runs; the 1.05 note is past the 0.9 + HORIZON_SEC (0.12) = 1.02 horizon.
    const sorted = [...starts].sort((a, b) => a - b);
    expect(sorted).toHaveLength(2);
    expect(sorted[0]).toBeCloseTo(0.02);
    expect(sorted[1]).toBeCloseTo(0.1);

    synth.teardown();
  });

  it('teardown ramps the bus gain to 0', () => {
    const { ctx } = createFakeAudioContext();
    const synth = new ScoreSynth(() => ctx);
    synth.setNotes([{ start: 1, end: 2, midi: 60, voice: 1, percussion: false }]);
    synth.start(0, 1);

    const busGain = (ctx.createGain as unknown as { mock: { results: Array<{ value: { gain: ReturnType<typeof fakeParam> } }> } }).mock
      .results[0].value.gain;

    synth.teardown();

    expect(busGain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('schedules a pitched note as a triangle oscillator with the voice-1/voice-2 envelope peaks', () => {
    const { ctx } = createFakeAudioContext();
    const synth = new ScoreSynth(() => ctx);
    // Starts just past mediaNow (not AT it) so the schedule-time lead floor
    // doesn't drop them as "too close to now" — see the dropped-notes test.
    synth.setNotes([
      { start: 0.05, end: 1, midi: 69, voice: 1, percussion: false }, // A4 = 440Hz
      { start: 0.05, end: 1, midi: 69, voice: 2, percussion: false },
    ]);
    synth.start(0, 1);

    const oscCalls = (ctx.createOscillator as unknown as { mock: { results: Array<{ value: { type: string; frequency: { value: number } } }> } })
      .mock.results;
    expect(oscCalls).toHaveLength(2);
    for (const call of oscCalls) {
      expect(call.value.type).toBe('triangle');
      expect(call.value.frequency.value).toBeCloseTo(440);
    }

    const gainCalls = (ctx.createGain as unknown as {
      mock: { results: Array<{ value: { gain: ReturnType<typeof fakeParam> } }> };
    }).mock.results;
    // results[0] is the bus; the two note envelopes follow.
    const [voice1Gain, voice2Gain] = [gainCalls[1].value.gain, gainCalls[2].value.gain];
    expect(voice1Gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, expect.any(Number));
    expect(voice2Gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.12, expect.any(Number));
    expect(voice1Gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, expect.any(Number));

    synth.teardown();
  });

  it('schedules percussion as a filtered noise burst peaking at 0.3', () => {
    const { ctx } = createFakeAudioContext();
    const synth = new ScoreSynth(() => ctx);
    synth.setNotes([{ start: 0.05, end: 0.15, midi: 60, voice: 1, percussion: true }]);
    synth.start(0, 1);

    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
    const filterResult = (ctx.createBiquadFilter as unknown as {
      mock: { results: Array<{ value: { type: string; frequency: { value: number } } }> };
    }).mock.results[0].value;
    expect(filterResult.type).toBe('bandpass');
    expect(filterResult.frequency.value).toBe(1800);

    const gainResult = (ctx.createGain as unknown as {
      mock: { results: Array<{ value: { gain: ReturnType<typeof fakeParam> } }> };
    }).mock.results[1].value.gain;
    expect(gainResult.setValueAtTime).toHaveBeenCalledWith(0.3, expect.any(Number));

    synth.teardown();
  });
});
