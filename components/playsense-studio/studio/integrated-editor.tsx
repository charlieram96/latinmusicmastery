'use client';

// PlaySense Studio — integrated editor under the waveform.
//
// Lives in the same vertical slot the old MeasureStrip occupied. Renders a
// toolbar + track tabs + view-mode tabs + the active view:
//   • Staff (default): the audio-aligned EditableMeasureStrip — clicking a
//     note selects it (toolbar edits it); clicking empty space in a measure
//     appends a note using the toolbar's current pitch + duration.
//   • Piano-roll: the existing PianoRollView (not audio-aligned).
//   • List: the existing TrackEditor (not audio-aligned).
//
// Owns the editor view state (selected event, active track, active view, toolbar
// pitch/duration). Score itself lives in the parent via useEditor; this just
// dispatches edits. Markers + waveform live in SyncPanel and are not touched
// here — note edits don't change `structuralSignature`, so the markers above
// stay put while you edit pitches/durations.

import { Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState, type Dispatch } from 'react';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type {
  Chord,
  Note,
  ScoreDocument,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  EditableMeasureStrip,
  type MeasureStripItem,
  type SelectedEventRef,
} from './editable-measure-strip';
import { PianoRollView } from './piano-roll-view';
import { TrackEditor } from './track-editor';

const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 4, label: 'whole' },
  { value: 2, label: 'half' },
  { value: 1, label: 'quarter' },
  { value: 0.5, label: '8th' },
  { value: 0.25, label: '16th' },
];

const PITCH_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const ACCIDENTAL_OPTIONS = [
  { value: 0, label: '♮' },
  { value: 1, label: '♯' },
  { value: -1, label: '♭' },
];
const STEP_MAP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

type EditorTab = 'staff' | 'piano-roll' | 'list';

export interface IntegratedEditorMeasureTiming {
  measureNumber: number;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
}

export interface IntegratedEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  /** Per-measure audio span from the markers (track 0). */
  measureTimings: IntegratedEditorMeasureTiming[];
  pixelsPerSecond: number;
  scrollLeftPx: number;
  viewportWidth: number;
  /** Strip asks SyncPanel to zoom in and center a tiny measure. */
  onRequestZoom: (pixelsPerSecond: number, scrollLeftPx: number) => void;
}

export const IntegratedEditor = memo(function IntegratedEditor({
  score,
  dispatch,
  measureTimings,
  pixelsPerSecond,
  scrollLeftPx,
  viewportWidth,
  onRequestZoom,
}: IntegratedEditorProps) {
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');
  const [selected, setSelected] = useState<SelectedEventRef | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [pitchLetter, setPitchLetter] = useState<string>('C');
  const [pitchAcc, setPitchAcc] = useState<number>(0);
  const [pitchOctave, setPitchOctave] = useState<number>(4);

  const activeTrack = score.tracks[activeTrackIndex] ?? score.tracks[0];

  // Keep active track in range when tracks are deleted.
  useEffect(() => {
    if (activeTrackIndex >= score.tracks.length) {
      setActiveTrackIndex(Math.max(0, score.tracks.length - 1));
    }
  }, [score.tracks.length, activeTrackIndex]);

  // Reset selection when switching tracks (an event index from track A isn't
  // meaningful on track B).
  useEffect(() => {
    setSelected(null);
  }, [activeTrackIndex]);

  // Defensive: clear selection if the indexed event has gone away (undo/redo,
  // delete, etc.).
  useEffect(() => {
    if (!selected || !activeTrack) return;
    const measure = activeTrack.measures[selected.measureIndex];
    const event = measure?.voices[0]?.events[selected.eventIndex];
    if (!event) setSelected(null);
  }, [selected, activeTrack]);

  const currentMidi = useMemo(
    () => Math.max(0, Math.min(127, (pitchOctave + 1) * 12 + STEP_MAP[pitchLetter] + pitchAcc)),
    [pitchLetter, pitchAcc, pitchOctave]
  );

  const selectedEvent = useMemo(() => {
    if (!selected || !activeTrack) return null;
    return activeTrack.measures[selected.measureIndex]?.voices[0]?.events[selected.eventIndex] ?? null;
  }, [selected, activeTrack]);

  // Sync toolbar to the selected event.
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

  const applyPitchToSelection = useCallback(
    (next: { letter: string; accidental: number; octave: number }) => {
      if (!selected) return;
      const midi = Math.max(
        0,
        Math.min(127, (next.octave + 1) * 12 + STEP_MAP[next.letter] + next.accidental)
      );
      dispatch({
        type: 'set-event-pitch',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        midi,
      });
    },
    [selected, activeTrackIndex, dispatch]
  );

  const applyDurationToSelection = useCallback(
    (qn: number) => {
      if (!selected) return;
      dispatch({
        type: 'set-event-duration',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        durationQN: qn,
      });
    },
    [selected, activeTrackIndex, dispatch]
  );

  // Keyboard: Delete/Backspace → delete selected event, Esc → clear.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') {
        if (selected) {
          e.preventDefault();
          setSelected(null);
        }
        return;
      }
      if (!selected) return;
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

  // Build stripItems for the active track — zip events with timings.
  const stripItems: MeasureStripItem[] = useMemo(() => {
    if (!activeTrack) return [];
    const tracked = extractTrackEvents(activeTrack, score.initialTimeSignature, score.initialKeyFifths);
    const count = Math.min(tracked.length, measureTimings.length);
    const out: MeasureStripItem[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        measureIndex: i,
        measureNumber: tracked[i].measure.number,
        startVideoTimeSeconds: measureTimings[i].startVideoTimeSeconds,
        endVideoTimeSeconds: measureTimings[i].endVideoTimeSeconds,
        events: tracked[i].events,
        timeSignature: tracked[i].timeSignature,
        isFirst: i === 0,
      });
    }
    return out;
  }, [activeTrack, score.initialTimeSignature, score.initialKeyFifths, measureTimings]);

  const handleSelectEvent = useCallback((ref: SelectedEventRef) => setSelected(ref), []);

  const handleClickEmpty = useCallback(
    (measureIndex: number) => {
      dispatch({
        type: 'add-note',
        trackIndex: activeTrackIndex,
        measureIndex,
        midi: currentMidi,
        durationQN: duration,
      });
      setSelected(null);
    },
    [activeTrackIndex, currentMidi, duration, dispatch]
  );

  const handleRequestZoomTo = useCallback(
    (measureIndex: number) => {
      const item = stripItems[measureIndex];
      if (!item || viewportWidth === 0) return;
      const spanSec = Math.max(0.001, item.endVideoTimeSeconds - item.startVideoTimeSeconds);
      // Aim for ~140 px per measure so notes are comfortably clickable.
      const targetPps = 140 / spanSec;
      const centerSec = (item.startVideoTimeSeconds + item.endVideoTimeSeconds) / 2;
      const nextScroll = Math.max(0, centerSec * targetPps - viewportWidth / 2);
      onRequestZoom(targetPps, nextScroll);
    },
    [stripItems, viewportWidth, onRequestZoom]
  );

  const trackCountMismatch = activeTrack && measureTimings.length !== activeTrack.measures.length;

  return (
    <div className="space-y-3">
      {/* Track tabs (multi-track only) */}
      {score.tracks.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 text-[11px] uppercase tracking-wider text-muted-foreground">Track</span>
          {score.tracks.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTrackIndex(i)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                i === activeTrackIndex
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {t.displayName}
            </button>
          ))}
          {trackCountMismatch && (
            <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">
              Track measure count differs from track 1 — alignment is approximate.
            </span>
          )}
        </div>
      )}

      {/* View-mode tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'staff' as const, label: 'Staff' },
              { id: 'piano-roll' as const, label: 'Piano-roll' },
              { id: 'list' as const, label: 'List' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setEditorTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition ${
                editorTab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => dispatch({ type: 'add-measure', trackIndex: activeTrackIndex })}
          className="mb-1 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs transition hover:bg-muted"
          title="Add a measure to the end of this track"
        >
          <Plus className="h-3.5 w-3.5" />
          Add measure
        </button>
      </div>

      {/* Editing toolbar (always visible — values drive both insertion and selected edits) */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Duration</span>
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setDuration(opt.value);
              applyDurationToSelection(opt.value);
            }}
            className={`rounded border px-2 py-0.5 text-[11px] transition ${
              Math.abs(duration - opt.value) < 0.001
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <span className="ml-3 text-[11px] uppercase tracking-wider text-muted-foreground">Pitch</span>
        <select
          value={pitchLetter}
          onChange={(e) => {
            setPitchLetter(e.target.value);
            applyPitchToSelection({ letter: e.target.value, accidental: pitchAcc, octave: pitchOctave });
          }}
          className="rounded border border-border bg-background px-2 py-0.5 text-sm"
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
          className="rounded border border-border bg-background px-1.5 py-0.5 text-sm"
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
          className="w-12 rounded border border-border bg-background px-2 py-0.5 text-sm tabular-nums"
        />
        <span className="text-[11px] tabular-nums text-muted-foreground">midi {currentMidi}</span>

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
            className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </button>
        )}
      </div>

      {/* Active view */}
      {editorTab === 'staff' && (
        <EditableMeasureStrip
          measures={stripItems}
          pixelsPerSecond={pixelsPerSecond}
          scrollLeftPx={scrollLeftPx}
          selected={selected}
          onSelectEvent={handleSelectEvent}
          onClickMeasureEmpty={handleClickEmpty}
          onRequestZoomTo={handleRequestZoomTo}
        />
      )}
      {editorTab === 'piano-roll' && (
        <div className="rounded-md border border-border bg-card p-3">
          <PianoRollView score={score} activeTrackIndex={activeTrackIndex} dispatch={dispatch} />
        </div>
      )}
      {editorTab === 'list' && (
        <div className="rounded-md border border-border bg-card p-3">
          <TrackEditor
            score={score}
            activeTrackIndex={activeTrackIndex}
            onSelectTrack={setActiveTrackIndex}
            dispatch={dispatch}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Click a note to select it; the toolbar shows its pitch + duration. Click empty space inside a
        measure to append a note with the toolbar values. Press{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] text-foreground">Delete</kbd> to
        remove the selected note.
      </p>
    </div>
  );
});

function midiToParts(midi: number): { letter: string; accidental: number; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table: Record<number, [string, number]> = {
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
  const [letter, accidental] = table[pc];
  return { letter, accidental, octave };
}
