import { describe, expect, it } from 'vitest';
import { planMidiRecording, prepareMidiRecording } from '../midi-recording-placement';
import { GUITAR_LICK_FIXTURE } from '../score-fixtures';
import { WaypointTimeMap, type Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
import { extractTrackEvents } from '../score-to-vexflow';
import { editorReducer } from '../editor-state';
import { SCORE_DOCUMENT_SCHEMA } from '@/components/playsense-studio/shared/score-model/serialization';
import type { MidiTake } from '../midi-recording';
const wp = (qn: number, sec: number): Waypoint => ({ musicalPositionQN: qn, videoTimeSeconds: sec, measureNumber: null, beatInMeasure: null });
const take = (startMs = 137.25, endMs = 681.125, durationMs = 1000): MidiTake => ({ bpm: 120, timeSignature: [4, 4], durationMs, notes: [{ id: 0, midi: 72, channel: 0, velocity: 100, startMs, endMs }] });
function score() {
  const s = structuredClone(GUITAR_LICK_FIXTURE); s.initialTempo = 120; s.tracks[0].instrument = 'piano';
  s.tracks[0].measures = Array.from({ length: 4 }, (_, i) => ({ number: i + 1, voices: [{ number: 1, events: [60, 62, 64, 65].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 })) }] }));
  return s;
}
function recordedTimes(s: ReturnType<typeof score>, waypoints: Waypoint[]) {
  const map = new WaypointTimeMap('test', 'midi', waypoints);
  return extractTrackEvents(s.tracks[0], s.initialTimeSignature).flatMap(m => m.events).filter(e => e.midi === 72).map(e => map.toVideoTime(e.qnStart));
}

describe('record at the video playhead', () => {
  it('starts at the actual playhead, preserves earlier notes, and retains edited beat timing', () => {
    const original = score();
    const waypoints = [wp(0, 20), wp(4, 22), wp(5, 22.4), wp(8, 24), wp(16, 28)];
    const plan = planMidiRecording(original, 0, { destination: 'playhead', playheadSeconds: 22.65, startMeasure: 3, waypoints });
    expect(plan.start).toBe(1); expect(plan.videoStartSeconds).toBe(22.65);
    const edit = prepareMidiRecording(original, 0, plan, take(), 0, false);
    expect(edit.nextScore.tracks[0].measures[0]).toEqual(original.tracks[0].measures[0]);
    expect(edit.nextScore.tracks[0].measures[1].voices[0].events[0]).toEqual(original.tracks[0].measures[1].voices[0].events[0]);
    expect(recordedTimes(edit.nextScore, edit.waypoints)[0]).toBeCloseTo(22.78725, 5);
    expect(edit.waypoints.find(w => w.musicalPositionQN === 5)?.videoTimeSeconds).toBe(22.4);
    expect(SCORE_DOCUMENT_SCHEMA.parse(edit.nextScore)).toEqual(edit.nextScore);
  });
  it('anchors a new empty score at the video playhead, without adding minutes of empty bars', () => {
    const original = score(); original.tracks[0].measures = [{ number: 1, voices: [{ number: 1, events: [] }] }];
    const plan = planMidiRecording(original, 0, { destination: 'playhead', playheadSeconds: 83.75, startMeasure: 0 });
    const edit = prepareMidiRecording(original, 0, plan, take(), 0, false);
    expect(edit.nextScore.tracks[0].measures).toHaveLength(1);
    expect(edit.waypoints[0].videoTimeSeconds).toBe(83.75);
    expect(recordedTimes(edit.nextScore, edit.waypoints)[0]).toBeCloseTo(83.88725, 5);
  });
  it('retains silence when starting after existing notation and extends the same video mapping', () => {
    const original = score();
    const plan = planMidiRecording(original, 0, { destination: 'playhead', playheadSeconds: 10.5, startMeasure: 0 });
    const edit = prepareMidiRecording(original, 0, plan, take(), 0, false);
    expect(plan.start).toBe(4);
    expect(edit.nextScore.tracks[0].measures.slice(0, 4)).toEqual(original.tracks[0].measures);
    expect(recordedTimes(edit.nextScore, edit.waypoints)[0]).toBeCloseTo(10.63725, 5);
  });
  it('honors meter and tempo changes across recorded measures and ties held notes across bars', () => {
    const original = score(); original.tracks[0].measures[1].timeSignature = [3, 4]; original.tracks[0].measures[1].tempoChange = 90;
    const plan = planMidiRecording(original, 0, { destination: 'playhead', playheadSeconds: 1.5, startMeasure: 0 });
    const edit = prepareMidiRecording(original, 0, plan, take(0, 4000, 4200), 0, false);
    expect(edit.measures[0].voices[0].events.at(-1)).toMatchObject({ midi: 72, tieToNext: true });
    expect(edit.measures[1].timeSignature).toEqual([3, 4]);
    expect(edit.measures[1].voices[0].events.reduce((s, e) => s + e.durationQN, 0)).toBeCloseTo(3);
    expect(edit.measures[1].tempoChange).toBe(90);
  });
  it('allows explicit append and replace destinations, with repeat protection', () => {
    const original = score();
    const append = planMidiRecording(original, 0, { destination: 'append', playheadSeconds: 1.5, startMeasure: 0 });
    expect(append.start).toBe(4); expect(append.videoStartSeconds).toBe(8);
    const replace = planMidiRecording(original, 0, { destination: 'replace', playheadSeconds: 1.5, startMeasure: 2 });
    expect(replace.start).toBe(2); expect(replace.videoStartSeconds).toBe(4);
    original.tracks[0].measures[2].repeat = { id: 'group', pass: 0, offset: 0, length: 1, count: 2 };
    expect(() => prepareMidiRecording(original, 0, replace, take(), 0, false)).toThrow(/Unlink/);
  });
  it('inserts one guarded undoable score object so its timing snapshot can follow undo and redo', () => {
    const original = score();
    const plan = planMidiRecording(original, 0, { destination: 'playhead', playheadSeconds: 1.5, startMeasure: 0 });
    const edit = prepareMidiRecording(original, 0, plan, take(), 0, false);
    const initial = { score: original, past: [], future: [], isDirty: false };
    const action = { type: 'apply-midi-score' as const, score: edit.nextScore, expectedScore: original };
    const applied = editorReducer(initial, action);
    expect(applied.score).toBe(edit.nextScore);
    const undone = editorReducer(applied, { type: 'undo' }); expect(undone.score).toBe(original);
    expect(editorReducer(undone, { type: 'redo' }).score).toBe(edit.nextScore);
    expect(editorReducer({ ...initial, score: score() }, action).score).not.toBe(edit.nextScore);
  });
});
