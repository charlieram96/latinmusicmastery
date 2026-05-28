'use client';

// Tabbed track editor + per-track measure list. Track tab strip on top,
// then the active track's measures stacked vertically. Each measure has a
// list of events (Note / Rest / Chord) with pitch + duration controls.

import { Plus, Trash2 } from 'lucide-react';
import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type {
  Instrument,
  ScoreDocument,
} from '@/components/playsense-studio/shared/score-model/types';
import { MeasureEditor } from './measure-editor';

const INSTRUMENT_OPTIONS: Array<{ value: Instrument; label: string }> = [
  { value: 'staff', label: 'Staff' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'bass', label: 'Bass' },
  { value: 'tres', label: 'Cuban Tres' },
  { value: 'cuatro', label: 'Cuatro' },
  { value: 'tiple', label: 'Tiple' },
  { value: 'ukulele', label: 'Ukulele' },
  { value: 'mandolin', label: 'Mandolin' },
  { value: 'piano', label: 'Piano' },
  { value: 'perc-kit', label: 'Drum Kit' },
  { value: 'perc-conga', label: 'Conga' },
  { value: 'perc-bongo', label: 'Bongo' },
  { value: 'perc-timbal', label: 'Timbales' },
  { value: 'perc-clave', label: 'Clave' },
];

interface TrackEditorProps {
  score: ScoreDocument;
  activeTrackIndex: number;
  onSelectTrack: (idx: number) => void;
  dispatch: Dispatch<EditorAction>;
}

export function TrackEditor({
  score,
  activeTrackIndex,
  onSelectTrack,
  dispatch,
}: TrackEditorProps) {
  const activeTrack = score.tracks[activeTrackIndex] ?? score.tracks[0];

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Track tab strip */}
      <div className="flex items-center border-b border-border bg-muted/20">
        <div className="flex gap-1 px-3 py-2 flex-wrap">
          {score.tracks.map((t, idx) => (
            <button
              key={idx}
              onClick={() => onSelectTrack(idx)}
              className={`px-3 py-1.5 rounded text-sm transition ${
                idx === activeTrackIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {t.displayName}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 px-3 py-2">
          <button
            onClick={() => dispatch({ type: 'add-track' })}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
          >
            <Plus className="w-3.5 h-3.5" />
            Track
          </button>
          {score.tracks.length > 1 && (
            <button
              onClick={() => dispatch({ type: 'delete-track', trackIndex: activeTrackIndex })}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete track
            </button>
          )}
        </div>
      </div>

      {/* Track properties */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-border">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Track name
          </span>
          <input
            type="text"
            value={activeTrack.displayName}
            onChange={(e) =>
              dispatch({ type: 'set-track-name', trackIndex: activeTrackIndex, name: e.target.value })
            }
            className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Instrument
          </span>
          <select
            value={activeTrack.instrument}
            onChange={(e) =>
              dispatch({
                type: 'set-track-instrument',
                trackIndex: activeTrackIndex,
                instrument: e.target.value as Instrument,
              })
            }
            className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
          >
            {INSTRUMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Measures */}
      <div className="px-5 py-4 space-y-3">
        {activeTrack.measures.map((measure, idx) => (
          <MeasureEditor
            key={`${activeTrackIndex}-${measure.number}-${idx}`}
            measure={measure}
            measureIndex={idx}
            trackIndex={activeTrackIndex}
            score={score}
            dispatch={dispatch}
          />
        ))}

        <button
          onClick={() => dispatch({ type: 'add-measure', trackIndex: activeTrackIndex })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-sm w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add measure
        </button>
      </div>
    </section>
  );
}
