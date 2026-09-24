'use client';

import { useEditor } from '@/lib/playsense-studio/editor-state';
import { getPercStrokes } from '@/lib/playsense-studio/perc-strokes';
import type { Instrument, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { IntegratedEditor } from '@/components/playsense-studio/studio/integrated-editor';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';

function legendScore(instrument: Instrument): ScoreDocument {
  const strokes = getPercStrokes(instrument) ?? [];
  return {
    schemaVersion: 1, sourceFormat: 'native', title: instrument === 'perc-conga' ? 'Conga notation legend' : 'Timbal notation legend',
    initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument, displayName: 'Legend', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: Array.from({ length: Math.ceil(strokes.length / 4) + 1 }, (_, i) => ({ number: i + 1, voices: [{ number: 1,
        events: i === Math.ceil(strokes.length / 4) ? [] : strokes.slice(i * 4, i * 4 + 4).map(s => ({ kind: 'note' as const, midi: s.midi, durationQN: 1 })),
      }] })),
    }],
  };
}
const initial = legendScore('perc-timbal');

export function PercussionPreview() {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useEditor(initial);
  return <main className="mx-auto max-w-7xl space-y-5 p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">PlaySense Studio</p>
        <h1 className="mt-2 text-2xl font-semibold">Percussion notation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your conga & timbal legends, in the shared score builder. Changes here are for preview only.</p></div>
      <div className="flex gap-2">{(['perc-timbal', 'perc-conga'] as const).map(instrument => <button type="button" key={instrument}
        className={`rounded-lg border px-4 py-2 text-sm ${state.score.tracks[0].instrument === instrument ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border'}`}
        onClick={() => dispatch({ type: 'replace-score', score: legendScore(instrument) })}>{instrument === 'perc-conga' ? 'Congas · 8 strokes' : 'Timbales · 15 strokes'}</button>)}</div>
    </div>
    <div className="flex gap-2"><button type="button" onClick={undo} disabled={!canUndo} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40">Undo</button><button type="button" onClick={redo} disabled={!canRedo} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40">Redo</button></div>
    <div className="overflow-hidden rounded-xl border border-border"><IntegratedEditor score={state.score} dispatch={dispatch}
      measureTimings={state.score.tracks[0].measures.map((m, i) => ({ measureNumber: m.number, startVideoTimeSeconds: i * 2.4, endVideoTimeSeconds: (i + 1) * 2.4 }))}
      pixelsPerSecond={160} scrollLeftPx={0} viewportWidth={1200} onRequestZoom={() => {}} /></div>
    <div className="h-[420px] overflow-hidden rounded-xl border border-border"><StaffRenderer score={state.score} trackIndex={0} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" className="h-full" /></div>
  </main>;
}
