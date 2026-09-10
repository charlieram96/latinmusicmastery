import { describe, expect, it } from 'vitest';
import { MidiNoteCapture, midiTakeToMeasures, insertMidiMeasures, recordingContext, type MidiTake, type RecordedMidiNote } from '../midi-recording';
import { editorReducer } from '../editor-state';
import { GUITAR_LICK_FIXTURE } from '../score-fixtures';
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise';
import { SCORE_DOCUMENT_SCHEMA } from '@/components/playsense-studio/shared/score-model/serialization';
import { extractTrackEvents, scoreTieIndices } from '../score-to-vexflow';

const note = (id: number, midi: number, startMs: number, endMs: number): RecordedMidiNote => ({ id, midi, startMs, endMs, channel: 0, velocity: 100 });
const take = (notes: RecordedMidiNote[], durationMs = 2000): MidiTake => ({ notes, durationMs, bpm: 120, timeSignature: [4, 4] });
const scoreWith = (t: MidiTake, grid = 0) => {
  const score = structuredClone(GUITAR_LICK_FIXTURE);
  score.tracks[0].instrument = 'piano';
  score.initialTempo = t.bpm;
  score.initialTimeSignature = t.timeSignature;
  score.tracks[0].measures = midiTakeToMeasures(t, grid, 'piano');
  return score;
};

describe('MIDI performance capture', () => {
  it('captures press/release timestamps, velocity and simultaneous notes without frame quantization', () => {
    const capture = new MidiNoteCapture();
    capture.message([0x90, 60, 99], 103.75);
    capture.message([0x90, 64, 90], 103.75);
    capture.message([0x80, 60, 20], 613.125);
    capture.message([0x90, 64, 0], 805.5);
    expect(capture.finish(1000)).toEqual([
      { ...note(0, 60, 103.75, 613.125), velocity: 99 },
      { ...note(1, 64, 103.75, 805.5), velocity: 90 },
    ]);
  });
  it('ignores count-in, malformed packets, clocks and releases without attacks', () => {
    const capture = new MidiNoteCapture();
    for (const data of [[0xf8], [0x90, 60], [0x90, 128, 80], [0x90, 60, 128], [0x80, 60, 0]]) capture.message(data, 20);
    capture.message([0x90, 60, 100], -1);
    expect(capture.finish(100)).toEqual([]);
  });
  it('sustain pedal is channel-specific and retriggers remain separate attacks', () => {
    const capture = new MidiNoteCapture();
    capture.message([0xb0, 64, 127], 0);
    capture.message([0x90, 60, 100], 0);
    capture.message([0x91, 60, 100], 0);
    capture.message([0x80, 60, 0], 100);
    capture.message([0x81, 60, 0], 100);
    capture.message([0x90, 60, 100], 200);
    capture.message([0x80, 60, 0], 300);
    capture.message([0xb0, 64, 0], 600);
    expect(capture.finish(800).map(n => [n.channel, n.startMs, n.endMs])).toEqual([[0, 0, 200], [1, 0, 100], [0, 200, 600]]);
  });
  it('can ignore pedal and closes held notes when recording stops', () => {
    const capture = new MidiNoteCapture(false);
    capture.message([0xb0, 64, 127], 0);
    capture.message([0x90, 60, 100], 0);
    capture.message([0x80, 60, 0], 300);
    capture.message([0x90, 64, 100], 400);
    expect(capture.finish(800).map(n => n.endMs)).toEqual([300, 800]);
    expect(capture.pitches).toEqual([]);
  });
  it.each([120, 123])('handles channel all-notes-off controller %i', controller => {
    const capture = new MidiNoteCapture();
    capture.message([0x90, 60, 100], 0);
    capture.message([0xb0, controller, 0], 400);
    expect(capture.finish(800)[0].endMs).toBe(400);
  });
});

describe('performance to playable score', () => {
  it('retains exact attack/release times, initial silence and rests', () => {
    const score = scoreWith(take([note(0, 60, 137.25, 681.125), note(1, 64, 999.75, 1234.5)]));
    const events = scoreToExerciseDefinition(score).events;
    expect(events).toHaveLength(2);
    expect((events[0].beat - 1) * 500).toBeCloseTo(137.25, 3);
    expect(events[0].duration * 500).toBeCloseTo(543.875, 3);
    expect((events[1].beat - 1) * 500).toBeCloseTo(999.75, 3);
    expect(events[1].duration * 500).toBeCloseTo(234.75, 3);
    expect(score.tracks[0].measures[0].voices[0].events[0].kind).toBe('rest');
    expect(SCORE_DOCUMENT_SCHEMA.parse(JSON.parse(JSON.stringify(score)))).toEqual(score);
  });
  it('allows optional quantization without changing the raw take', () => {
    const raw = take([note(0, 60, 140, 650)]);
    const snapshot = structuredClone(raw);
    const events = scoreToExerciseDefinition(scoreWith(raw, .25)).events;
    expect(events[0]).toMatchObject({ beat: 1.25, duration: 1 });
    expect(raw).toEqual(snapshot);
  });
  it('ties held notes across barlines without asking students to strike again', () => {
    const score = scoreWith(take([note(0, 60, 1500, 3000)], 3500), .25);
    expect(score.tracks[0].measures).toHaveLength(2);
    const events = scoreToExerciseDefinition(score).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ beat: 4, measure: 1, duration: 3 });
    expect(score.tracks[0].measures[0].voices[0].events.at(-1)).toMatchObject({ tieToNext: true });
  });
  it('retains overlapping chords as independent attacks and durations', () => {
    const score = scoreWith(take([note(0, 60, 0, 1500), note(1, 64, 500, 1000), note(2, 67, 500, 1500)]), .25);
    const events = scoreToExerciseDefinition(score).events;
    expect(events.map(e => [e.expectedPitch, e.beat, e.duration])).toEqual([[60, 1, 3], [64, 2, 1], [67, 2, 2]]);
    expect(events[0].chordId).toBeUndefined();
    expect(events[1].chordId).toBe(events[2].chordId);
    expect(events[1].chordId).toBeDefined();
  });
  it('does not tie same-pitch retriggers', () => {
    const events = scoreToExerciseDefinition(scoreWith(take([note(0, 60, 0, 500), note(1, 60, 500, 1000)]), .25)).events;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.duration)).toEqual([1, 1]);
  });
  it('fills complete bars in denominator-based meters and retains trailing silence', () => {
    const score = scoreWith({ ...take([note(0, 60, 0, 250)], 3100), timeSignature: [6, 8] }, .25);
    expect(score.tracks[0].measures).toHaveLength(3);
    for (const bar of score.tracks[0].measures) expect(bar.voices[0].events.reduce((sum, e) => sum + e.durationQN, 0)).toBeCloseTo(3);
    expect(scoreToExerciseDefinition(score).events[0].duration).toBe(1);
  });
  it('engraves only the tied pitches even when chord indices change', () => {
    const score = scoreWith(take([note(0, 64, 0, 1500), note(1, 60, 500, 1000)]), .25);
    const events = extractTrackEvents(score.tracks[0], [4, 4])[0].events;
    expect(scoreTieIndices(events[0], events[1])).toEqual({ firstIndexes: [0], lastIndexes: [1] });
    expect(scoreTieIndices(events[1], events[2])).toEqual({ firstIndexes: [1], lastIndexes: [0] });
  });
});

describe('recording insertion', () => {
  it('inserts one undoable edit, marks dirty, and restores the complete original on undo', () => {
    const score = structuredClone(GUITAR_LICK_FIXTURE);
    const measures = midiTakeToMeasures(take([note(0, 60, 0, 1000)]), .25, 'piano');
    const initial = { score, past: [], future: [], isDirty: false };
    const next = editorReducer(initial, { type: 'insert-midi-recording', trackIndex: 0, expectedTrack: score.tracks[0], start: 1, replaceCount: 1, measures });
    expect(next.isDirty).toBe(true);
    expect(next.past).toHaveLength(1);
    const undone = editorReducer(next, { type: 'undo' });
    expect(undone.score).toEqual(score);
    expect(editorReducer(undone, { type: 'redo' }).score).toEqual(next.score);
    expect(editorReducer(initial, { type: 'insert-midi-recording', trackIndex: 0, expectedTrack: structuredClone(score.tracks[0]), start: 1, replaceCount: 1, measures })).toBe(initial);
  });
  it('restores the original tempo, meter and key after a take', () => {
    const score = structuredClone(GUITAR_LICK_FIXTURE);
    score.tracks[0].measures[0].tempoChange = 90;
    score.tracks[0].measures[0].keyFifths = -2;
    const measures = midiTakeToMeasures(take([note(0, 60, 0, 1000)]), .25, 'piano');
    const next = insertMidiMeasures(score, 0, 0, 1, measures);
    expect(next.tracks[0].measures[0].keyFifths).toBe(-2);
    expect(recordingContext(next, next.tracks[0], 1)).toEqual({ bpm: 90, timeSignature: [4, 4], keyFifths: -2 });
    expect(score.tracks[0].measures[0].tempoChange).toBe(90);
  });
  it('protects repeat groups while allowing an append', () => {
    const score = structuredClone(GUITAR_LICK_FIXTURE);
    score.tracks[0].measures.forEach((m, i) => { m.repeat = { id: 'r', length: 2, offset: i, count: 3 } as NonNullable<typeof m.repeat>; });
    const measures = midiTakeToMeasures(take([note(0, 60, 0, 1000)]), .25, 'piano');
    expect(() => insertMidiMeasures(score, 0, 0, 1, measures)).toThrow(/Unlink/);
    expect(() => insertMidiMeasures(score, 0, 1, 0, measures)).toThrow(/Unlink/);
    expect(insertMidiMeasures(score, 0, 2, 0, measures).tracks[0].measures.map(m => m.number)).toEqual([1, 2, 3]);
  });
});
