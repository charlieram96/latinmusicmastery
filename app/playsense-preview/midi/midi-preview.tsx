'use client';
import { useMemo, useRef, useState } from 'react';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import { IntegratedEditor } from '@/components/playsense-studio/studio/integrated-editor';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise';
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { WaypointTimeMap, type Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
const initial = structuredClone(GUITAR_LICK_FIXTURE);
initial.title = 'MIDI recording preview';
initial.tracks = [{ ...initial.tracks[0], instrument: 'piano', displayName: 'Piano', measures: [{ number: 1, voices: [{ number: 1, events: [] }] }] }];
export function MidiPreview() {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useEditor(initial);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef);
  const [timingHistory] = useState(() => new WeakMap<object, Waypoint[]>());
  const [timing, setTiming] = useState(() => ({ score: state.score, waypoints: buildWaypoints(initial, initial.initialTempo, 0) }));
  if (timing.score !== state.score) {
    timingHistory.set(timing.score, timing.waypoints);
    setTiming({ score: state.score, waypoints: timingHistory.get(state.score) ?? buildWaypoints(state.score, state.score.initialTempo, timing.waypoints[0].videoTimeSeconds) });
  }
  const waypoints = timing.waypoints;
  const map = useMemo(() => new WaypointTimeMap('preview', 'midi', waypoints), [waypoints]);
  const recordingSource = useMemo(() => ({ videoRef, videoUrl: '/videos/band-performing.mp4', waypoints, onPosition: clock.seek,
    onInsert: (next: typeof initial, points: Waypoint[], expected: typeof initial) => {
      timingHistory.set(next, points);
      dispatch({ type: 'apply-midi-score', score: next, expectedScore: expected });
    },
  }), [waypoints, clock.seek, dispatch, timingHistory]);
  const exercise = scoreToExerciseDefinition(state.score);
  return <main className="mx-auto max-w-6xl space-y-6 p-8">
    <div><p className="text-xs uppercase tracking-widest text-primary">PlaySense Studio</p><h1 className="mt-2 text-2xl font-semibold">Record a score with MIDI</h1>
      <p className="mt-2 text-sm text-muted-foreground">Development preview · Uses the shared admin editor. This score stays in this page and is not saved.</p></div>
    <div className="flex items-end gap-6"><video ref={videoRef} src="/videos/band-performing.mp4" controls playsInline preload="auto" aria-label="Studio reference video" className="w-full max-w-lg rounded-xl border border-border" />
      <p className="pb-2 text-sm text-muted-foreground">Video playhead: <span className="tabular-nums">{clock.currentSeconds.toFixed(2)}s</span><br />Move the video playhead, then choose Record MIDI.</p></div>
    <div className="flex gap-3"><button disabled={!canUndo} onClick={undo} className="rounded-lg border px-3 py-2 disabled:opacity-40">Undo</button><button disabled={!canRedo} onClick={redo} className="rounded-lg border px-3 py-2 disabled:opacity-40">Redo</button>
      <p className="self-center text-sm text-muted-foreground">{state.score.tracks[0].measures.length} measures · {exercise.events.length} played notes</p></div>
    <div className="overflow-hidden rounded-xl border border-border"><IntegratedEditor score={state.score} dispatch={dispatch} getCurrentSeconds={clock.getCurrentSeconds} recordingSource={recordingSource} measureTimings={state.score.tracks[0].measures.map((m, i) => ({ measureNumber: m.number, startVideoTimeSeconds: map.toVideoTime(i * 4), endVideoTimeSeconds: map.toVideoTime((i + 1) * 4) }))}
      pixelsPerSecond={160} scrollLeftPx={0} viewportWidth={1000} onRequestZoom={() => {}} dragAll={false} onMeasureDrag={() => {}} onMeasureDragEnd={() => {}} /></div>
    <div className="h-[400px] rounded-xl border border-border"><StaffRenderer score={state.score} trackIndex={0} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" className="h-full" /></div>
  </main>;
}
