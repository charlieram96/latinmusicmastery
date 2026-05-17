'use client';

// One row per Note/Rest/Chord event in a measure. Each row exposes the
// pitch (note name + octave + accidental), duration (whole/half/quarter/
// 8th/16th, with optional dot), and a delete button. "Add note" and
// "Add rest" footers append events.

import { Plus, Trash2 } from 'lucide-react';
import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type {
  Chord,
  Measure,
  MusicalEvent,
  Note,
  ScoreDocument,
} from '@/components/playsense-studio/shared/score-model/types';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';

interface MeasureEditorProps {
  measure: Measure;
  measureIndex: number;
  trackIndex: number;
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
}

const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 4, label: 'whole' },
  { value: 2, label: 'half' },
  { value: 1, label: 'quarter' },
  { value: 0.5, label: 'eighth' },
  { value: 0.25, label: 'sixteenth' },
  { value: 0.125, label: '32nd' },
];

const PITCH_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_OPTIONS = [
  { value: 0, label: '♮' },
  { value: 1, label: '♯' },
  { value: -1, label: '♭' },
];

export function MeasureEditor({
  measure,
  measureIndex,
  trackIndex,
  score,
  dispatch,
}: MeasureEditorProps) {
  const events = measure.voices[0]?.events ?? [];
  const totalDurationQN = events.reduce(
    (sum, ev) => sum + ev.durationQN * (ev.dotted ? 1.5 : 1),
    0
  );
  const targetDurationQN = measureLengthInQN(score.initialTimeSignature);

  return (
    <div className="border border-border rounded-md bg-background/40">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Measure {measure.number}
          </span>
          <span
            className={`text-xs font-mono tabular-nums ${
              Math.abs(totalDurationQN - targetDurationQN) > 0.001
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
            title={`${totalDurationQN} / ${targetDurationQN} QN`}
          >
            {totalDurationQN}/{targetDurationQN} QN
          </span>
        </div>
        <button
          onClick={() =>
            dispatch({ type: 'delete-measure', trackIndex, measureIndex })
          }
          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition"
          title="Delete measure"
          aria-label="Delete measure"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </header>

      <ul className="divide-y divide-border">
        {events.map((event, idx) => (
          <EventRow
            key={idx}
            event={event}
            eventIndex={idx}
            trackIndex={trackIndex}
            measureIndex={measureIndex}
            dispatch={dispatch}
          />
        ))}
      </ul>

      <footer className="px-3 py-2 flex gap-2 border-t border-border bg-muted/10">
        <button
          onClick={() =>
            dispatch({
              type: 'add-note',
              trackIndex,
              measureIndex,
              midi: 60,
              durationQN: 1,
            })
          }
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
        >
          <Plus className="w-3.5 h-3.5" />
          Add note
        </button>
        <button
          onClick={() =>
            dispatch({
              type: 'add-rest',
              trackIndex,
              measureIndex,
              durationQN: 1,
            })
          }
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
        >
          <Plus className="w-3.5 h-3.5" />
          Add rest
        </button>
      </footer>
    </div>
  );
}

interface EventRowProps {
  event: MusicalEvent;
  eventIndex: number;
  trackIndex: number;
  measureIndex: number;
  dispatch: Dispatch<EditorAction>;
}

function EventRow({
  event,
  eventIndex,
  trackIndex,
  measureIndex,
  dispatch,
}: EventRowProps) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="w-6 text-xs font-mono text-muted-foreground tabular-nums">
        {eventIndex + 1}
      </span>

      <span className="text-xs font-medium uppercase tracking-wider w-12 text-muted-foreground">
        {event.kind}
      </span>

      {event.kind === 'rest' ? (
        <span className="text-xs text-muted-foreground italic flex-1">silence</span>
      ) : (
        <PitchControls event={event} eventIndex={eventIndex} trackIndex={trackIndex} measureIndex={measureIndex} dispatch={dispatch} />
      )}

      <select
        value={event.durationQN / (event.dotted ? 1.5 : 1)}
        onChange={(e) =>
          dispatch({
            type: 'set-event-duration',
            trackIndex,
            measureIndex,
            eventIndex,
            durationQN: Number(e.target.value) * (event.dotted ? 1.5 : 1),
          })
        }
        className="px-2 py-1 rounded border border-border bg-background text-xs"
      >
        {DURATION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={event.dotted ?? false}
          onChange={(e) =>
            dispatch({
              type: 'set-event-dotted',
              trackIndex,
              measureIndex,
              eventIndex,
              dotted: e.target.checked,
            })
          }
          className="accent-primary"
        />
        dot
      </label>

      <button
        onClick={() =>
          dispatch({ type: 'delete-event', trackIndex, measureIndex, eventIndex })
        }
        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition ml-auto"
        title="Delete event"
        aria-label="Delete event"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function PitchControls({
  event,
  eventIndex,
  trackIndex,
  measureIndex,
  dispatch,
}: EventRowProps) {
  const midi = pitchOf(event);
  const { letter, accidental, octave } = midiToParts(midi);

  const updateMidi = (next: { letter: string; accidental: number; octave: number }) => {
    const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const newMidi = (next.octave + 1) * 12 + stepMap[next.letter] + next.accidental;
    dispatch({
      type: 'set-event-pitch',
      trackIndex,
      measureIndex,
      eventIndex,
      midi: Math.max(0, Math.min(127, newMidi)),
    });
  };

  return (
    <div className="flex items-center gap-1 flex-1">
      <select
        value={letter}
        onChange={(e) => updateMidi({ letter: e.target.value, accidental, octave })}
        className="px-2 py-1 rounded border border-border bg-background text-sm"
      >
        {PITCH_LETTERS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        value={accidental}
        onChange={(e) => updateMidi({ letter, accidental: Number(e.target.value), octave })}
        className="px-1.5 py-1 rounded border border-border bg-background text-sm"
        title="Accidental"
      >
        {ACCIDENTAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={9}
        value={octave}
        onChange={(e) => updateMidi({ letter, accidental, octave: Number(e.target.value) || 0 })}
        className="w-14 px-2 py-1 rounded border border-border bg-background text-sm tabular-nums"
        title="Octave"
      />
      <span className="text-xs text-muted-foreground tabular-nums w-10">
        midi {midi}
      </span>
    </div>
  );
}

function pitchOf(event: MusicalEvent): number {
  if (event.kind === 'note') return (event as Note).midi;
  if (event.kind === 'chord') {
    const c = event as Chord;
    return c.notes[0]?.midi ?? 60;
  }
  return 60;
}

function midiToParts(midi: number): { letter: string; accidental: number; octave: number } {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const sharpName: Record<number, [string, number]> = {
    0: ['C', 0],
    1: ['C', 1],
    2: ['D', 0],
    3: ['D', 1],
    4: ['E', 0],
    5: ['F', 0],
    6: ['F', 1],
    7: ['G', 0],
    8: ['G', 1],
    9: ['A', 0],
    10: ['A', 1],
    11: ['B', 0],
  };
  const [letter, accidental] = sharpName[pitchClass];
  return { letter, accidental, octave };
}
