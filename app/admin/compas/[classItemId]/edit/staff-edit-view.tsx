'use client';

// Staff click-to-edit view. Renders the score using the same StaffRenderer
// the student player uses, so the visual matches what listeners will see.
// Click handler is repurposed from "seek video" to "select / add note":
//
//   • Click in a measure (no note hit) → append a note at the toolbar's
//     duration + pitch to the END of that measure. This is simpler than
//     inserting at a specific qn-within-measure (avoids the pad-with-rest
//     bookkeeping) and matches step-entry workflows.
//   • Click on a note               → select it. Selected note's pitch &
//                                     duration become editable in the
//                                     toolbar; Delete removes it.
//
// For v1 the click resolves to "the measure containing qn=X" via the
// renderer's existing onSeek event. The exact qn within the measure is
// not used for placement — append-to-measure-end is the rule.

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { StaffRenderer } from '@/components/compas/player/notation/renderers/staff-renderer';
import { measureBeatToQN } from '@/lib/compas/time-mapping';
import type { EditorAction } from '@/lib/compas/editor-state';
import type {
  Chord,
  Note,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';

const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 4, label: 'whole' },
  { value: 2, label: 'half' },
  { value: 1, label: 'quarter' },
  { value: 0.5, label: '8th' },
  { value: 0.25, label: '16th' },
];

const PITCH_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_OPTIONS = [
  { value: 0, label: '♮' },
  { value: 1, label: '♯' },
  { value: -1, label: '♭' },
];

interface StaffEditViewProps {
  score: ScoreDocument;
  activeTrackIndex: number;
  dispatch: Dispatch<EditorAction>;
}

interface SelectedRef {
  measureIndex: number;
  eventIndex: number;
}

export function StaffEditView({
  score,
  activeTrackIndex,
  dispatch,
}: StaffEditViewProps) {
  const track = score.tracks[activeTrackIndex];
  const [duration, setDuration] = useState<number>(1);
  const [pitchLetter, setPitchLetter] = useState<string>('C');
  const [pitchAcc, setPitchAcc] = useState<number>(0);
  const [pitchOctave, setPitchOctave] = useState<number>(4);
  const [selected, setSelected] = useState<SelectedRef | null>(null);

  const currentMidi = useMemo(() => {
    const stepMap: Record<string, number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    };
    return Math.max(0, Math.min(127, (pitchOctave + 1) * 12 + stepMap[pitchLetter] + pitchAcc));
  }, [pitchLetter, pitchAcc, pitchOctave]);

  // Selected event metadata, used to show its pitch/duration in the toolbar
  // and to drive the Delete button.
  const selectedEvent = useMemo(() => {
    if (!selected || !track) return null;
    return (
      track.measures[selected.measureIndex]?.voices[0]?.events[selected.eventIndex] ?? null
    );
  }, [selected, track]);

  // Sync toolbar pitch/duration with the selected event so editing the
  // toolbar instantly mutates the selection.
  useEffect(() => {
    if (!selectedEvent) return;
    setDuration(selectedEvent.durationQN);
    if (selectedEvent.kind === 'note' || selectedEvent.kind === 'chord') {
      const midi =
        selectedEvent.kind === 'note'
          ? (selectedEvent as Note).midi
          : (selectedEvent as Chord).notes[0]?.midi ?? 60;
      const parts = midiToParts(midi);
      setPitchLetter(parts.letter);
      setPitchAcc(parts.accidental);
      setPitchOctave(parts.octave);
    }
  }, [selectedEvent]);

  // Mutate the selected event when toolbar values change.
  const applyPitchToSelection = (next: { letter: string; accidental: number; octave: number }) => {
    if (!selected) return;
    const stepMap: Record<string, number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    };
    const midi = Math.max(
      0,
      Math.min(127, (next.octave + 1) * 12 + stepMap[next.letter] + next.accidental)
    );
    dispatch({
      type: 'set-event-pitch',
      trackIndex: activeTrackIndex,
      measureIndex: selected.measureIndex,
      eventIndex: selected.eventIndex,
      midi,
    });
  };
  const applyDurationToSelection = (qn: number) => {
    if (!selected) return;
    dispatch({
      type: 'set-event-duration',
      trackIndex: activeTrackIndex,
      measureIndex: selected.measureIndex,
      eventIndex: selected.eventIndex,
      durationQN: qn,
    });
  };

  // Click on staff → either select an existing note at the clicked beat or
  // append a new note to the clicked measure.
  const handleClick = (target: { qn: number; measure: number; beat: number }) => {
    if (!track) return;
    // Find the measure containing the clicked qn.
    const measureIndex = track.measures.findIndex((m) => m.number === target.measure);
    if (measureIndex === -1) return;
    const measure = track.measures[measureIndex];
    // Compute qn-within-measure to find a hit.
    const measureStartQN = measureBeatToQN(track, score, target.measure, 1);
    if (measureStartQN === null) return;
    const qnInMeasure = target.qn - measureStartQN;

    // Walk events to see if the click falls inside one.
    let walker = 0;
    for (let i = 0; i < measure.voices[0].events.length; i++) {
      const ev = measure.voices[0].events[i];
      const span = ev.durationQN;
      if (qnInMeasure >= walker && qnInMeasure < walker + span) {
        if (ev.kind !== 'rest') {
          setSelected({ measureIndex, eventIndex: i });
          return;
        }
        break;
      }
      walker += span;
    }

    // No hit — append new note.
    dispatch({
      type: 'add-note',
      trackIndex: activeTrackIndex,
      measureIndex,
      midi: currentMidi,
      durationQN: duration,
    });
    setSelected(null);
  };

  // Delete key removes selected event.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({
          type: 'delete-event',
          trackIndex: activeTrackIndex,
          measureIndex: selected.measureIndex,
          eventIndex: selected.eventIndex,
        });
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, dispatch, activeTrackIndex]);

  // Reset selection when the track changes.
  useEffect(() => {
    setSelected(null);
  }, [activeTrackIndex]);

  if (!track) return <p className="text-sm text-muted-foreground">No track.</p>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Duration
        </span>
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setDuration(opt.value);
              applyDurationToSelection(opt.value);
            }}
            className={`px-2.5 py-1 rounded text-xs border transition ${
              Math.abs(duration - opt.value) < 0.001
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <span className="text-xs uppercase tracking-wider text-muted-foreground ml-3">
          Pitch
        </span>
        <select
          value={pitchLetter}
          onChange={(e) => {
            setPitchLetter(e.target.value);
            applyPitchToSelection({ letter: e.target.value, accidental: pitchAcc, octave: pitchOctave });
          }}
          className="px-2 py-1 rounded border border-border bg-background text-sm"
        >
          {PITCH_LETTERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={pitchAcc}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPitchAcc(v);
            applyPitchToSelection({ letter: pitchLetter, accidental: v, octave: pitchOctave });
          }}
          className="px-1.5 py-1 rounded border border-border bg-background text-sm"
        >
          {ACCIDENTAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={9}
          value={pitchOctave}
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setPitchOctave(v);
            applyPitchToSelection({ letter: pitchLetter, accidental: pitchAcc, octave: v });
          }}
          className="w-14 px-2 py-1 rounded border border-border bg-background text-sm tabular-nums"
        />
        <span className="text-xs text-muted-foreground tabular-nums">midi {currentMidi}</span>

        {selected && (
          <button
            onClick={() => {
              dispatch({
                type: 'delete-event',
                trackIndex: activeTrackIndex,
                measureIndex: selected.measureIndex,
                eventIndex: selected.eventIndex,
              });
              setSelected(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </button>
        )}
      </div>

      {/* Rendered staff. We pass currentMs=0 so the playback cursor sits
          at the start of the piece rather than animating; the user is
          editing, not listening. */}
      <div className="bg-card border border-border rounded-lg p-4 overflow-hidden">
        <StaffRenderer
          score={score}
          trackIndex={activeTrackIndex}
          currentMs={0}
          onSeek={handleClick}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Click in a measure to append a note with the current toolbar pitch +
        duration. Click an existing note to select it; the toolbar then edits
        that note. Press <kbd className="px-1 py-0.5 rounded bg-muted text-foreground text-[11px]">Delete</kbd> to remove.
      </p>

      <button
        onClick={() => dispatch({ type: 'add-measure', trackIndex: activeTrackIndex })}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-sm"
      >
        <Plus className="w-4 h-4" />
        Add measure
      </button>
    </div>
  );
}

function midiToParts(midi: number): { letter: string; accidental: number; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
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
  const [letter, accidental] = sharpName[pc];
  return { letter, accidental, octave };
}
