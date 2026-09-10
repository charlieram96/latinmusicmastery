'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject } from 'react';
import { Circle, Loader2, Plug, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useStudioMidiRecorder } from '@/hooks/use-studio-midi-recorder';
import { recordingContext } from '@/lib/playsense-studio/midi-recording';
import { planMidiRecording, prepareMidiRecording, type MidiRecordingDestination, type MidiRecordingInsert } from '@/lib/playsense-studio/midi-recording-placement';
import type { Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
import { isPercussion } from '@/lib/playsense-studio/perc-strokes';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { StaffRenderer } from '../player/notation/renderers/staff-renderer';

export type MidiRecordingSource = { videoUrl: string | null; videoRef: RefObject<HTMLVideoElement | null>; waypoints: Waypoint[]; onInsert: MidiRecordingInsert; onPosition: (seconds: number) => void };
type Props = { score: ScoreDocument; trackIndex: number; targetMeasure: number; dispatch: Dispatch<EditorAction>; getCurrentSeconds?: () => number; recordingSource?: MidiRecordingSource };
export function MidiRecordButton(props: Props) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="st-chip" title="Record MIDI notes with your performance timing"><Circle className="h-3.5 w-3.5 text-primary" />Record MIDI</button></DialogTrigger>
    <DialogContent className={`max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto ${props.recordingSource?.videoUrl ? 'sm:max-w-5xl' : 'sm:max-w-2xl'} [&>*]:min-w-0`}
      onInteractOutside={event => event.preventDefault()}>
      <DialogHeader><DialogTitle>Record your performance</DialogTitle>
        <DialogDescription>{props.recordingSource?.videoUrl ? 'Record from the playhead. Follow the reference video while your notes keep its timing.' : 'Record from the playhead. Capture your note timing, chords, and pauses, then review the notation.'}</DialogDescription></DialogHeader>
      {open && <MidiRecorderPanel {...props} onInserted={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}

function MidiRecorderPanel({ score, trackIndex, targetMeasure, dispatch, getCurrentSeconds, recordingSource, onInserted }: Props & { onInserted: () => void }) {
  const recorder = useStudioMidiRecorder();
  const [originalTrack] = useState(() => score.tracks[trackIndex]);
  const [originalScore] = useState(score);
  const [originalWaypoints] = useState(() => recordingSource?.waypoints);
  const [playheadSeconds] = useState(() => recordingSource?.videoRef.current?.currentTime ?? getCurrentSeconds?.());
  const [playbackRate] = useState(() => recordingSource?.videoRef.current?.playbackRate ?? 1);
  const [destination, setDestination] = useState<MidiRecordingDestination>('playhead');
  const [startMeasure, setStartMeasure] = useState(targetMeasure + 1);
  const placement = useMemo(() => {
    try { return { plan: planMidiRecording(originalScore, trackIndex, { destination, startMeasure: startMeasure - 1, playheadSeconds, waypoints: originalWaypoints }), error: null }; }
    catch (err) { return { plan: null, error: err instanceof Error ? err.message : 'Choose a recording position.' }; }
  }, [originalScore, trackIndex, destination, startMeasure, playheadSeconds, originalWaypoints]);
  const plan = placement.plan;
  const context = plan?.context ?? recordingContext(originalScore, originalTrack, 0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { recordingSource?.videoRef.current?.pause(); }, [recordingSource?.videoRef]);
  const positionVideo = () => {
    if (videoRef.current && plan) { videoRef.current.currentTime = plan.videoStartSeconds; videoRef.current.playbackRate = playbackRate; }
  };
  useEffect(() => { if (videoRef.current?.readyState && plan) { videoRef.current.currentTime = plan.videoStartSeconds; videoRef.current.playbackRate = playbackRate; } }, [plan, playbackRate]);
  const [countIn, setCountIn] = useState(true);
  const [click, setClick] = useState(!recordingSource?.videoUrl);
  const [sustain, setSustain] = useState(!isPercussion(originalTrack.instrument));
  const [grid, setGrid] = useState(0);
  const [gmPercussion, setGmPercussion] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = ['starting', 'count-in', 'recording'].includes(recorder.phase);
  const locked = busy || !!recorder.take;
  const scoreChanged = score !== originalScore;
  const conversion = useMemo(() => {
    if (!recorder.take || !plan) return { measures: [], edit: null, error: null };
    try { const edit = prepareMidiRecording(originalScore, trackIndex, plan, recorder.take, grid, gmPercussion); return { measures: edit.measures, edit, error: null }; }
    catch (error) { return { measures: [], edit: null, error: error instanceof Error ? error.message : 'Could not prepare the notation.' }; }
  }, [originalScore, trackIndex, plan, recorder.take, grid, gmPercussion]);
  const preview = useMemo<ScoreDocument>(() => ({ ...originalScore,
    initialKeyFifths: context.keyFifths,
    initialTempo: recorder.take?.bpm ?? context.bpm, initialTimeSignature: recorder.take?.timeSignature ?? context.timeSignature,
    tracks: [{ ...originalTrack, index: 0, measures: conversion.measures }],
  }), [originalScore, originalTrack, recorder.take, context.bpm, context.timeSignature, context.keyFifths, conversion.measures]);
  const replaceCount = conversion.edit?.replaceCount ?? 0;
  const insert = () => {
    if (scoreChanged || !conversion.edit || !conversion.measures.length) return;
    try {
      if (recordingSource) recordingSource.onInsert(conversion.edit.nextScore, conversion.edit.waypoints, originalScore);
      else dispatch({ type: 'apply-midi-score', score: conversion.edit.nextScore, expectedScore: originalScore });
      onInserted();
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not add the take.'); }
  };
  const startRecording = () => {
    if (!plan) return;
    setLocalError(null);
    void recorder.start({ ...context, countIn, click, sustain, ...(recordingSource?.videoUrl && videoRef.current ? { video: {
      element: videoRef.current, startSeconds: plan.videoStartSeconds, onStop: recordingSource.onPosition,
      beatAtSeconds: (seconds: number) => plan.map.toMusicalPosition(seconds) * context.timeSignature[1] / 4,
    } } : {}) });
  };
  const clockSeconds = (recordingSource?.videoUrl ? plan?.videoStartSeconds ?? 0 : 0) + recorder.meter.elapsedMs / 1000;
  const clock = formatRecordingTime(clockSeconds);
  return <div className={recordingSource?.videoUrl ? 'grid min-w-0 gap-5 md:grid-cols-[1fr_1fr]' : 'min-w-0'}>
    {recordingSource?.videoUrl && <div className="min-w-0 space-y-2 md:sticky md:top-0 md:self-start">
      <div className="overflow-hidden rounded-xl border border-border bg-black"><video ref={videoRef} src={recordingSource.videoUrl} onLoadedMetadata={positionVideo} playsInline preload="auto" className="aspect-video w-full" aria-label="MIDI recording reference video" /></div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>Reference video</span><span>{playbackRate}× speed · Video timing</span></div>
      <p className="text-xs text-muted-foreground">The video starts at {formatRecordingTime(plan?.videoStartSeconds ?? 0)} after the count-in. Notes stay aligned when you slow the video down.</p>
    </div>}
    <div className="min-w-0 space-y-4">
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-muted-foreground">MIDI input
        <select aria-label="MIDI input" value={recorder.selectedInput} disabled={busy || !recorder.inputs.length} onChange={e => recorder.selectInput(e.target.value)} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          {!recorder.inputs.length && <option value="">{recorder.connected ? 'Connect a MIDI instrument' : 'No instrument selected'}</option>}
          {recorder.inputs.map(input => <option key={input.id} value={input.id}>{input.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void recorder.connect()} disabled={recorder.connecting || busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
        {recorder.connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}{recorder.connected ? 'Refresh' : 'Connect MIDI'}
      </button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 space-y-1 text-xs font-medium text-muted-foreground">Add recording
        <select aria-label="Recording destination" value={destination} disabled={locked} onChange={e => { setDestination(e.target.value as MidiRecordingDestination); setLocalError(null); }} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="playhead">From playhead (default)</option><option value="append">After the last measure</option><option value="replace">Replace from a measure</option>
        </select>
      </label>
      {destination === 'replace' && <label className="space-y-1 text-xs font-medium text-muted-foreground">Start measure
        <input aria-label="Recording start measure" type="number" min={1} max={originalTrack.measures.length + 1} disabled={locked} value={startMeasure} onChange={e => setStartMeasure(Number(e.target.value))} className="block w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
      </label>}
      <div className="py-2 text-sm tabular-nums"><span className="font-semibold text-primary">{context.bpm}</span> BPM <span className="mx-2 text-muted-foreground">·</span>{context.timeSignature.join('/')}</div>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <label className="flex items-center gap-2"><input type="checkbox" checked={countIn} disabled={locked} onChange={e => setCountIn(e.target.checked)} className="accent-primary" />One-bar count-in</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={click} disabled={locked} onChange={e => setClick(e.target.checked)} className="accent-primary" />Metronome</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={sustain} disabled={locked} onChange={e => setSustain(e.target.checked)} className="accent-primary" />Capture sustain pedal</label>
    </div>
    <div className={`rounded-xl border p-5 ${busy ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/10'}`}>
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-xs font-medium text-muted-foreground">{recorder.phase === 'count-in' ? 'Get ready' : recorder.phase === 'starting' ? (recordingSource?.videoUrl ? 'Waiting for the video…' : 'Getting ready…') : busy ? (recordingSource?.videoUrl ? 'Video time · recording' : 'Recording your timing') : recorder.take ? 'Take ready' : 'Ready when you are'}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight" aria-live="off">{recorder.phase === 'count-in' ? recorder.meter.countdown : clock}</p></div>
        <div className="text-right"><span className="text-lg font-semibold tabular-nums text-primary">{recorder.meter.count}</span><p className="text-xs text-muted-foreground">notes captured</p></div>
      </div>
      <div className="mt-3 min-h-5 text-xs text-muted-foreground">{recorder.meter.pitches.length
        ? recorder.meter.pitches.map(midi => `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`).join(' · ')
        : busy ? 'Play after the count-in. Press Stop when you finish.' : 'Note lengths follow your performance. Up to 3 minutes per take.'}</div>
      <div className="mt-4 flex gap-2">
        {busy ? <button type="button" onClick={() => recorder.stop()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Square className="h-3.5 w-3.5 fill-current" />Stop recording</button>
          : !recorder.take && <button type="button" disabled={!recorder.selectedInput || scoreChanged || !plan || !!placement.error || !Number.isInteger(startMeasure) || startMeasure < 1 || startMeasure > originalTrack.measures.length + 1}
            onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"><Circle className="h-3.5 w-3.5 fill-current" />Start recording</button>}
        {recorder.take && !busy && <button type="button" onClick={() => { recorder.discard(); setLocalError(null); }} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Discard & record again</button>}
      </div>
    </div>
    {recorder.take && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">{conversion.measures.length} measures · {recorder.take.notes.length} played notes</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Quantization
          <select aria-label="Recording quantization" value={grid} onChange={e => setGrid(Number(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground">
            <option value={0}>As played</option><option value={.125}>1/32 note</option><option value={.25}>1/16 note</option><option value={.5}>1/8 note</option><option value={1}>1/4 note</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{grid ? 'Notes and rests are snapped to this grid. Change it to compare with your original timing.' : 'Exact performance timing is preserved. Printed note values are approximate for unquantized rhythms.'}</p>
      {isPercussion(originalTrack.instrument) && <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={gmPercussion} onChange={e => setGmPercussion(e.target.checked)} className="accent-primary" />Map General MIDI drum notes to this instrument’s strokes</label>}
      {!!conversion.measures.length && <div className="h-56 min-w-0 overflow-hidden rounded-xl border border-border"><StaffRenderer score={preview} trackIndex={0} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" zoom={.7} className="h-full" /></div>}
      <p className="text-xs text-muted-foreground">{destination === 'append' ? 'Adds new measures at the end.' : `Replaces ${replaceCount} measure${replaceCount === 1 ? "" : "s"} from measure ${(plan?.start ?? 0) + 1}${conversion.measures.length > replaceCount ? ` and adds ${conversion.measures.length - replaceCount} new measures` : ""}.`} Notes before the playhead are kept. The last recorded measure is replaced through its end. Undo restores the previous score and video sync.</p>
      <div className="flex justify-end"><button type="button" onClick={insert} disabled={!conversion.measures.length || scoreChanged || !!conversion.error} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">Add take to score</button></div>
    </>}
    {(scoreChanged || localError || placement.error || conversion.error || recorder.error) && <p role="alert" className="text-sm text-destructive">{scoreChanged ? 'The score changed while recording. Close this panel and reopen it before adding a take.' : localError || placement.error || conversion.error || recorder.error}</p>}
    </div>
  </div>;
}

function formatRecordingTime(seconds: number) {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  return `${Math.floor(centiseconds / 6000)}:${(centiseconds % 6000 / 100).toFixed(2).padStart(5, '0')}`;
}
