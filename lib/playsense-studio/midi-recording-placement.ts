import type { MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { WaypointTimeMap, type Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
import { buildWaypoints } from './sync-seed';
import { isFillerRest, measureLengthInQN, walkMeasures } from './time-mapping';
import { insertMidiMeasures, midiTakeToMeasures, recordingContext, type MidiNotationBar, type MidiTake } from './midi-recording';

export type MidiRecordingDestination = 'playhead' | 'append' | 'replace';
export type MidiRecordingPlan = ReturnType<typeof planMidiRecording>;
export type MidiRecordingInsert = (next: ScoreDocument, waypoints: Waypoint[], expected: ScoreDocument) => void;

/** Freeze the playhead and the current (including unsaved) video sync together. */
export function planMidiRecording(score: ScoreDocument, trackIndex: number, options: {
  destination: MidiRecordingDestination;
  playheadSeconds?: number;
  startMeasure: number;
  waypoints?: Waypoint[];
}) {
  const track = score.tracks[trackIndex];
  const walked = [...walkMeasures(track, score)];
  let waypoints = options.waypoints?.length ? structuredClone(options.waypoints) : buildWaypoints({ ...score, tracks: [track] }, score.initialTempo, 0);
  if (waypoints.length < 2) {
    const length = measureLengthInQN(score.initialTimeSignature);
    waypoints = [{ musicalPositionQN: 0, videoTimeSeconds: 0, measureNumber: 1, beatInMeasure: 1 },
      { musicalPositionQN: length, videoTimeSeconds: length * 60 / score.initialTempo, measureNumber: null, beatInMeasure: null }];
  }
  let map = new WaypointTimeMap('midi-recording', 'midi', waypoints);
  const tailQN = walked.length ? walked.at(-1)!.state.cumulativeQN + measureLengthInQN(walked.at(-1)!.state.timeSignature) : 0;
  const selected = Math.max(0, Math.min(track.measures.length, options.startMeasure));
  const selectedQN = walked[selected]?.state.cumulativeQN ?? tailQN;
  const blank = walked.every(({ measure, state }) => measure.voices.every(v => !v.events.length || isFillerRest(v.events, state.timeSignature)));
  const videoStartSeconds = options.destination === 'append' ? map.toVideoTime(tailQN)
    : options.destination === 'replace' ? map.toVideoTime(selectedQN)
      : options.playheadSeconds ?? map.toVideoTime(selectedQN);
  if (!Number.isFinite(videoStartSeconds) || videoStartSeconds < 0) throw new Error('Choose a valid video playhead position.');
  // An empty score starts where the admin is watching, even deep into a video.
  if (blank && options.destination === 'playhead') {
    const shift = videoStartSeconds - map.toVideoTime(0);
    waypoints = waypoints.map(w => ({ ...w, videoTimeSeconds: w.videoTimeSeconds + shift }));
    map = new WaypointTimeMap('midi-recording', 'midi', waypoints);
  }
  const punchQN = map.toMusicalPosition(videoStartSeconds);
  if (punchQN < -1e-6) throw new Error('The playhead is before this score. Move it into the score, or record into a new empty score.');
  const found = walked.findIndex(({ state }) => state.cumulativeQN + measureLengthInQN(state.timeSignature) > punchQN + 1e-6);
  const start = found < 0 ? track.measures.length : found;
  const baseQN = walked[start]?.state.cumulativeQN ?? tailQN;
  const context = recordingContext(score, track, start);
  const bars: MidiNotationBar[] = [];
  let qn = baseQN;
  for (let i = 0; i < 256; i++) {
    const at = recordingContext(score, track, start + i);
    const endQN = qn + measureLengthInQN(at.timeSignature);
    bars.push({ startQN: qn - baseQN, endQN: endQN - baseQN, bpm: at.bpm, timeSignature: at.timeSignature });
    qn = endQN;
  }
  return { start, baseQN, punchQN: Math.max(0, punchQN), videoStartSeconds, context, bars, map, waypoints };
}

function sliceEvents(events: MusicalEvent[], from: number, to: number, severEnd = false): MusicalEvent[] {
  const result: MusicalEvent[] = [];
  let qn = 0;
  for (const original of events) {
    const end = qn + original.durationQN;
    const durationQN = Math.min(to, end) - Math.max(from, qn);
    if (durationQN > 1e-7) {
      const event = structuredClone(original);
      event.durationQN = durationQN;
      if (durationQN !== original.durationQN) { delete event.dotted; delete event.triplet; }
      if (severEnd && end >= to - 1e-7) {
        delete event.tieToNext;
        if (event.kind === 'chord') event.notes.forEach(n => { delete n.tieToNext; });
      }
      result.push(event);
    }
    qn = end;
  }
  const missing = to - from - result.reduce((sum, e) => sum + e.durationQN, 0);
  if (missing > 1e-7) result.push({ kind: 'rest', durationQN: missing });
  return result;
}

/** Map video timestamps back through the same beat anchors used by playback. */
export function prepareMidiRecording(score: ScoreDocument, trackIndex: number, plan: MidiRecordingPlan, take: MidiTake, gridQN: number, gmPercussion: boolean) {
  const track = score.tracks[trackIndex];
  const toQN = (ms: number) => plan.map.toMusicalPosition(plan.videoStartSeconds + ms / 1000) - plan.baseQN;
  const measures = midiTakeToMeasures(take, gridQN, track.instrument, gmPercussion, { toQN, bars: plan.bars });
  if (!measures.length) return { measures, replaceCount: 0, nextScore: score, waypoints: plan.waypoints };
  // Punching in halfway through a bar must not erase the notes before the cursor.
  const prefixQN = plan.punchQN - plan.baseQN;
  const original = track.measures[plan.start];
  if (original && prefixQN > 1e-7) {
    const barQN = plan.bars[0].endQN;
    measures[0].voices[0].events = [
      ...sliceEvents(original.voices[0]?.events ?? [], 0, prefixQN, true),
      ...sliceEvents(measures[0].voices[0].events, prefixQN, barQN),
    ];
  }
  measures.forEach((m, i) => { m.keyFifths = recordingContext(score, track, plan.start + i).keyFifths; });
  const replaceCount = Math.min(measures.length, track.measures.length - plan.start);
  const nextScore = insertMidiMeasures(score, trackIndex, plan.start, replaceCount, measures);
  const nextTrack = nextScore.tracks[trackIndex];
  // Keep edited beat anchors, and explicitly anchor any newly recorded bars.
  const waypoints = new Map(plan.waypoints.map(w => [w.musicalPositionQN, w]));
  let tailQN = 0;
  for (const { measure, state } of walkMeasures(nextTrack, nextScore)) {
    const qn = state.cumulativeQN;
    waypoints.set(qn, { musicalPositionQN: qn, videoTimeSeconds: plan.map.toVideoTime(qn), measureNumber: measure.number, beatInMeasure: 1 });
    tailQN = qn + measureLengthInQN(state.timeSignature);
  }
  waypoints.set(tailQN, { musicalPositionQN: tailQN, videoTimeSeconds: plan.map.toVideoTime(tailQN), measureNumber: null, beatInMeasure: null });
  return { measures, replaceCount, nextScore, waypoints: [...waypoints.values()].filter(w => w.musicalPositionQN <= tailQN).sort((a, b) => a.musicalPositionQN - b.musicalPositionQN) };
}
