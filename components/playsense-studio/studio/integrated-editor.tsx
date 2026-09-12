'use client';

// PlaySense Studio — integrated editor under the waveform.
//
// Lives in the same vertical slot the old MeasureStrip occupied. Renders a
// compact track bar + view tabs + an editing toolbar + the active view:
//   • Staff (default, main): the audio-aligned EditableMeasureStrip — click a
//     note to select it; drag a note vertically to change its pitch; click empty
//     space in a measure (or the Add note button) to append a note with the
//     toolbar's current pitch/duration/modifiers.
//   • Piano-roll: the existing PianoRollView (not audio-aligned).
//
// Owns the editor view state (selected event, active track, active view, toolbar
// pitch/duration/modifiers). Score itself lives in the parent via useEditor; this
// just dispatches edits. Markers + waveform live in SyncPanel and are not touched
// here — note edits don't change `structuralSignature`, so the markers above stay
// put while you edit pitches/durations.

import { ChevronDown, ChevronsLeftRight, MoreHorizontal, Move, Music, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { diatonicToMidi, extractTrackEvents, midiToDiatonic } from '@/lib/playsense-studio/score-to-vexflow';
import { getPercStrokes, isPercussion, resolvePercStroke } from '@/lib/playsense-studio/perc-strokes';
import {
  QN_EPS,
  beatLengthInQN,
  effectiveDurationQN,
  isFillerRest,
  measureLengthInQN,
  occupiedQN,
} from '@/lib/playsense-studio/time-mapping';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type {
  Chord,
  Instrument,
  Measure,
  Note,
  ScoreDocument,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  EditableMeasureStrip,
  type MeasureStripItem,
  type SelectedEventRef,
} from './editable-measure-strip';
import { PianoRollView } from './piano-roll-view';
import { PercussionStrokePicker } from './percussion-stroke-picker';
import { MidiRecordButton, type MidiRecordingSource } from './midi-record-button';
import type { DragMode } from '@/components/playsense-studio/sync/waveform-canvas';

type Articulation = 'staccato' | 'accent' | 'tenuto';

const DURATION_OPTIONS: Array<{ value: number; label: string; key?: string }> = [
  { value: 4, label: 'Whole', key: '1' },
  { value: 2, label: 'Half', key: '2' },
  { value: 1, label: 'Quarter', key: '3' },
  { value: 0.5, label: '8th', key: '4' },
  { value: 0.25, label: '16th', key: '5' },
  { value: 0.125, label: '32nd' },
  { value: 0.0625, label: '64th' },
  { value: 0.03125, label: '128th' },
];

/** Note-duration icon drawn inline — Unicode music glyphs (𝅝, 𝅗𝅥, 𝅘𝅥𝅯…) are tofu in
 *  most system fonts, so the toolbar renders its own SVG noteheads/stems/flags. */
function NoteIcon({ durationQN }: { durationQN: number }) {
  const hollow = durationQN >= 2; // whole + half
  const stem = durationQN < 4;
  // 0.5 → 1 flag, 0.25 → 2 … 0.03125 → 5.
  const flags = durationQN <= 0.5 ? Math.round(Math.log2(0.5 / durationQN)) + 1 : 0;
  return (
    <svg viewBox="0 0 16 22" width="13" height="19" aria-hidden focusable="false">
      <ellipse
        cx="6"
        cy="17.6"
        rx="4.3"
        ry="3"
        transform="rotate(-18 6 17.6)"
        fill={hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {stem && <rect x="9.5" y="2.5" width="1.4" height="15" rx="0.7" fill="currentColor" />}
      {Array.from({ length: flags }, (_, i) => (
        <path
          key={i}
          d={`M10.9 ${2.8 + i * 2.6} c3.2 1.5 3.7 3.2 2.5 5.6`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** Simple half-rest-on-a-line icon (the 𝄽 glyph is also tofu-prone). */
function RestIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
      <line x1="2" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="7.2" width="6" height="4.3" rx="0.6" fill="currentColor" />
    </svg>
  );
}
// The Insert toolbar shows the common durations inline; the rest live behind "more".
const COMMON_DURATIONS = DURATION_OPTIONS.slice(0, 5); // whole … 16th
const RARE_DURATIONS = DURATION_OPTIONS.slice(5); // 32nd … 128th

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

const PITCH_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const ACCIDENTAL_OPTIONS = [
  { value: 0, label: '♮' },
  { value: 1, label: '♯' },
  { value: -1, label: '♭' },
];
const ARTICULATION_OPTIONS: Array<{ value: Articulation; label: string; title: string }> = [
  { value: 'staccato', label: '·', title: 'Staccato' },
  { value: 'accent', label: '>', title: 'Accent' },
  { value: 'tenuto', label: '–', title: 'Tenuto' },
];
const STEP_MAP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

type EditorTab = 'staff' | 'piano-roll';

import { repeatGroups } from '@/lib/playsense-studio/repeats';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';

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
  /** Live playback position (video seconds) for the staff-lane playhead. */
  getCurrentSeconds?: () => number;
  recordingSource?: MidiRecordingSource;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  viewportWidth: number;
  /** Strip asks SyncPanel to zoom in and center a tiny measure. */
  onRequestZoom: (pixelsPerSecond: number, scrollLeftPx: number) => void;
  /** Default region/single mode for measure-block drags (true = all-after). */
  dragAll: boolean;
  /** Show the Ripple/Single drag-mode toggle in the editor bar (sync only). */
  showDragMode?: boolean;
  /** Change the drag mode (true = Ripple/all-after, false = Single). */
  onSetDragAll?: (dragAll: boolean) => void;
  /** A measure block was dragged to reposition its downbeat in video time. */
  onMeasureDrag: (measureNumber: number, videoTimeSeconds: number, mode: DragMode) => void;
  /** A measure-block drag ended (commit / reinterpolate unedited beats). */
  onMeasureDragEnd: () => void;
  /** Move the tail boundary (right edge of the last measure) in video time. */
  onTailDrag?: (videoTimeSeconds: number) => void;
  /** Mirrors the current note selection out to the right-rail inspector. The
   *  editor stays the source of truth; pass a stable callback to keep the memo. */
  onSelectionChange?: (selection: { ref: SelectedEventRef; trackIndex: number } | null) => void;
  /** Horizontal wheel/trackpad pan over the staff (shared timeline scroll). */
  onScrollByPx?: (dx: number) => void;
}

/** A repeat's closing bar (with dots) replaces any final bar on that measure. */
function isRepeatEnd(measure: Measure): boolean {
  return !!measure.repeat && measure.repeat.offset === measure.repeat.length - 1;
}

export const IntegratedEditor = memo(function IntegratedEditor({
  score,
  dispatch,
  measureTimings,
  getCurrentSeconds,
  recordingSource,
  pixelsPerSecond,
  scrollLeftPx,
  viewportWidth,
  onRequestZoom,
  dragAll,
  showDragMode,
  onSetDragAll,
  onMeasureDrag,
  onMeasureDragEnd,
  onTailDrag,
  onSelectionChange,
  onScrollByPx,
}: IntegratedEditorProps) {
  // Single-track studio: the score model still holds Track[], but the editor
  // always authors track 0.
  const activeTrackIndex = 0;
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');
  const [insertOnClick, setInsertOnClick] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatStart, setRepeatStart] = useState(1);
  const [repeatEnd, setRepeatEnd] = useState(1);
  const [repeatCount, setRepeatCount] = useState(2);
  const [selected, setSelected] = useState<SelectedEventRef | null>(null);
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [pitchLetter, setPitchLetter] = useState<string>('C');
  const [pitchAcc, setPitchAcc] = useState<number>(0);
  const [pitchOctave, setPitchOctave] = useState<number>(4);
  // Toolbar modifier defaults (apply to the selection and to inserts).
  const [dotted, setDotted] = useState(false);
  const [triplet, setTriplet] = useState(false);
  const [articulation, setArticulation] = useState<Articulation | null>(null);
  const [insertRest, setInsertRest] = useState(false);
  // Percussion: the currently chosen stroke's MIDI.
  const [percMidi, setPercMidi] = useState<number | null>(null);
  // "More durations & articulations" popover in the Insert toolbar.
  const [moreOpen, setMoreOpen] = useState(false);

  // The staff grows to fill the space between the editor bar and the toolbar —
  // measure the wrapper and feed its height to the strip (min keeps it usable).
  const staffWrapRef = useRef<HTMLDivElement | null>(null);
  const [staffHeight, setStaffHeight] = useState(220);
  useEffect(() => {
    const el = staffWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setStaffHeight(Math.max(180, Math.round(el.clientHeight)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editorTab]);

  const activeTrack = score.tracks[activeTrackIndex] ?? score.tracks[0];
  const percussion = activeTrack ? isPercussion(activeTrack.instrument) : false;
  const percStrokes = activeTrack ? getPercStrokes(activeTrack.instrument) : null;

  // Default the percussion stroke to the first stroke whenever the active
  // track's stroke set changes (e.g. switching instrument).
  useEffect(() => {
    if (percStrokes && percStrokes.length > 0) {
      setPercMidi((prev) =>
        prev != null && percStrokes.some((s) => s.midi === prev) ? prev : percStrokes[0].midi
      );
    } else {
      setPercMidi(null);
    }
  }, [percStrokes]);

  // Defensive: clear selection if the indexed event has gone away (undo/redo,
  // delete, etc.).
  useEffect(() => {
    if (!selected || !activeTrack) return;
    const measure = activeTrack.measures[selected.measureIndex];
    const event = measure?.voices[0]?.events[selected.eventIndex];
    if (!event) setSelected(null);
  }, [selected, activeTrack]);

  // Mirror the selection out to the right-rail inspector (display only). Fires
  // only on user-paced selection / track changes, so the memo stays effective.
  useEffect(() => {
    onSelectionChange?.(selected ? { ref: selected, trackIndex: activeTrackIndex } : null);
  }, [selected, activeTrackIndex, onSelectionChange]);

  const currentMidi = useMemo(() => {
    if (percussion) return percMidi ?? percStrokes?.[0]?.midi ?? 60;
    return Math.max(0, Math.min(127, (pitchOctave + 1) * 12 + STEP_MAP[pitchLetter] + pitchAcc));
  }, [percussion, percMidi, percStrokes, pitchLetter, pitchAcc, pitchOctave]);

  const selectedEvent = useMemo(() => {
    if (!selected || !activeTrack) return null;
    return activeTrack.measures[selected.measureIndex]?.voices[0]?.events[selected.eventIndex] ?? null;
  }, [selected, activeTrack]);

  const selectedPercPitch = selectedEvent?.kind === 'note' ? selectedEvent
    : selectedEvent?.kind === 'chord' ? selectedEvent.notes[0] : undefined;
  const strokeValue = percussion && selectedPercPitch?.percussion
    ? resolvePercStroke(activeTrack.instrument, selectedPercPitch)?.midi ?? null : currentMidi;

  // Sync toolbar to the selected event.
  useEffect(() => {
    if (!selectedEvent) return;
    setDuration(selectedEvent.durationQN);
    setDotted(selectedEvent.dotted ?? false);
    setTriplet(selectedEvent.triplet ?? false);
    setInsertRest(selectedEvent.kind === 'rest');
    if (selectedEvent.kind === 'note' || selectedEvent.kind === 'chord') {
      setArticulation(selectedEvent.articulation ?? null);
      const midi =
        selectedEvent.kind === 'note'
          ? (selectedEvent as Note).midi
          : (selectedEvent as Chord).notes[0]?.midi ?? 60;
      if (percussion) {
        setPercMidi(midi);
      } else {
        const parts = midiToParts(midi);
        setPitchLetter(parts.letter);
        setPitchAcc(parts.accidental);
        setPitchOctave(parts.octave);
      }
    }
  }, [selectedEvent, percussion]);

  // ---- Apply-to-selection helpers --------------------------------------------

  const applyPitchToSelection = useCallback(
    (midi: number) => {
      if (!selected) return;
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

  const pitchedMidiFrom = (letter: string, acc: number, octave: number) =>
    Math.max(0, Math.min(127, (octave + 1) * 12 + STEP_MAP[letter] + acc));

  // Keyboard editing — Esc clear · Del remove · ⏎ add · ↑/↓ pitch (⇧ = octave /
  // stroke) · ←/→ walk the selection · 1-5 durations · "." dot · "t" triplet ·
  // "r" rest. Declared below the handlers it calls via function refs would be
  // noisier; instead this effect lives after the toolbar handlers are defined
  // (see the second keydown effect further down). This one keeps Esc/Delete.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
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
        repeatPass: tracked[i].measure.repeat,
        finalBarline: isRepeatEnd(tracked[i].measure) ? false : hasFinalBarline(activeTrack.measures, i),
        startVideoTimeSeconds: measureTimings[i].startVideoTimeSeconds,
        endVideoTimeSeconds: measureTimings[i].endVideoTimeSeconds,
        events: tracked[i].events,
        timeSignature: tracked[i].timeSignature,
        isFirst: i === 0,
        clef: tracked[i].clef,
      });
    }
    return out;
  }, [activeTrack, score.initialTimeSignature, score.initialKeyFifths, measureTimings]);

  // The measure "Add note" targets: the selected event's measure, else the last.
  const targetMeasureIndex = selected
    ? selected.measureIndex
    : Math.min(selectedMeasureIndex ?? Math.max(0, (activeTrack?.measures.length ?? 1) - 1), Math.max(0, (activeTrack?.measures.length ?? 1) - 1));

  // Closing-bar state of the target measure — drives the Double bar toggle.
  const targetMeasure = activeTrack?.measures[targetMeasureIndex];
  const targetIsRepeatEnd = !!targetMeasure && isRepeatEnd(targetMeasure);
  const targetHasFinalBar = !!activeTrack && !targetIsRepeatEnd && hasFinalBarline(activeTrack.measures, targetMeasureIndex);

  // Capacity of the target measure for its time signature — drives the readout
  // and disables "Add note" once the measure is full (a filler rest counts as
  // empty since the first real note replaces it).
  const capacity = useMemo(() => {
    const ts = stripItems[targetMeasureIndex]?.timeSignature ?? score.initialTimeSignature;
    const total = measureLengthInQN(ts);
    const events = activeTrack?.measures[targetMeasureIndex]?.voices[0]?.events ?? [];
    const used = isFillerRest(events, ts) ? 0 : occupiedQN(events);
    const need = effectiveDurationQN(duration, { dotted, triplet });
    const beatQN = beatLengthInQN(ts);
    return {
      measureNumber: stripItems[targetMeasureIndex]?.measureNumber ?? targetMeasureIndex + 1,
      full: used + need > total + QN_EPS,
      usedBeats: used / beatQN,
      totalBeats: total / beatQN,
    };
  }, [activeTrack, targetMeasureIndex, stripItems, score.initialTimeSignature, duration, dotted, triplet]);

  const handleSelectEvent = useCallback((ref: SelectedEventRef) => setSelected(ref), []);

  // Insert a note (or rest) into a given measure using the toolbar values.
  const insertIntoMeasure = useCallback(
    (measureIndex: number) => {
      if (insertRest) {
        dispatch({
          type: 'add-rest',
          trackIndex: activeTrackIndex,
          measureIndex,
          durationQN: duration,
          dotted,
          triplet,
        });
      } else {
        dispatch({
          type: 'add-note',
          trackIndex: activeTrackIndex,
          measureIndex,
          midi: currentMidi,
          durationQN: duration,
          dotted,
          triplet,
          ...(articulation ? { articulation } : {}),
        });
      }
      setSelected(null);
    },
    [insertRest, activeTrackIndex, duration, dotted, triplet, currentMidi, articulation, dispatch]
  );

  const handleClickEmpty = useCallback(
    (measureIndex: number) => insertIntoMeasure(measureIndex),
    [insertIntoMeasure]
  );

  // Add-note button: target the selected event's measure, else the last measure.
  const handleAddNote = useCallback(() => {
    if (capacity.full) return; // measure full — the reducer would no-op anyway
    insertIntoMeasure(targetMeasureIndex);
  }, [capacity.full, targetMeasureIndex, insertIntoMeasure]);

  // Pitch from staff drag commits here.
  const handleSetPitch = useCallback(
    (ref: SelectedEventRef, midi: number) => {
      dispatch({
        type: 'set-event-pitch',
        trackIndex: activeTrackIndex,
        measureIndex: ref.measureIndex,
        eventIndex: ref.eventIndex,
        midi,
      });
      setSelected(ref);
    },
    [activeTrackIndex, dispatch]
  );

  // Strip works in measureIndex; the marker model keys on measureNumber.
  const handleMeasureDrag = useCallback(
    (measureIndex: number, videoTimeSeconds: number, mode: DragMode) => {
      const measureNumber = stripItems[measureIndex]?.measureNumber ?? measureIndex + 1;
      onMeasureDrag(measureNumber, videoTimeSeconds, mode);
    },
    [stripItems, onMeasureDrag]
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

  // ---- Toolbar control handlers ---------------------------------------------

  const onDurationClick = (qn: number) => {
    setDuration(qn);
    applyDurationToSelection(qn);
  };

  const onPitchPartChange = (next: { letter?: string; acc?: number; octave?: number }) => {
    const letter = next.letter ?? pitchLetter;
    const acc = next.acc ?? pitchAcc;
    const octave = next.octave ?? pitchOctave;
    setPitchLetter(letter);
    setPitchAcc(acc);
    setPitchOctave(octave);
    applyPitchToSelection(pitchedMidiFrom(letter, acc, octave));
  };

  const onStrokeClick = (midi: number) => {
    setPercMidi(midi);
    applyPitchToSelection(midi);
  };

  const onToggleRest = () => {
    const next = !insertRest;
    setInsertRest(next);
    if (selected && selectedEvent) {
      dispatch({
        type: 'convert-event-kind',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        to: next ? 'rest' : 'note',
        midi: currentMidi,
      });
    }
  };

  const onToggleDotted = () => {
    const next = !dotted;
    setDotted(next);
    if (selected) {
      dispatch({
        type: 'set-event-dotted',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        dotted: next,
      });
    }
  };

  const onToggleTriplet = () => {
    const next = !triplet;
    setTriplet(next);
    if (selected) {
      dispatch({
        type: 'set-event-triplet',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        triplet: next,
      });
    }
  };

  const onToggleTie = () => {
    if (!selected || !selectedEvent || selectedEvent.kind === 'rest') return;
    const next = !selectedEvent.tieToNext;
    dispatch({
      type: 'set-event-tie',
      trackIndex: activeTrackIndex,
      measureIndex: selected.measureIndex,
      eventIndex: selected.eventIndex,
      tieToNext: next,
    });
  };

  const onArticulationClick = (value: Articulation) => {
    const next = articulation === value ? null : value;
    setArticulation(next);
    if (selected) {
      dispatch({
        type: 'set-event-articulation',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
        articulation: next,
      });
    }
  };

  const tieActive =
    !!selectedEvent && selectedEvent.kind !== 'rest' && !!selectedEvent.tieToNext;

  // ---- Fast keyboard entry (depends on the toolbar handlers above) ----------

  const stepSelectedPitch = (dir: 1 | -1, byOctave: boolean) => {
    if (!selected || !selectedEvent || selectedEvent.kind === 'rest') return;
    const midi =
      selectedEvent.kind === 'note'
        ? (selectedEvent as Note).midi
        : (selectedEvent as Chord).notes[0]?.midi ?? 60;
    let next: number;
    if (percussion) {
      const list = percStrokes ?? [];
      const idx = list.findIndex((s) => s.midi === midi);
      next = list[Math.min(Math.max(idx + dir, 0), list.length - 1)]?.midi ?? midi;
    } else if (byOctave) {
      next = Math.max(0, Math.min(127, midi + 12 * dir));
    } else {
      next = diatonicToMidi(midiToDiatonic(midi) + dir, 0, score.initialKeyFifths);
    }
    applyPitchToSelection(next);
  };

  const walkSelection = (dir: 1 | -1) => {
    if (!activeTrack) return;
    const measures = activeTrack.measures;
    const eventsAt = (mi: number) => measures[mi]?.voices[0]?.events ?? [];
    if (!selected) {
      // No selection: enter the strip at its first (or last) event.
      const range = dir === 1 ? measures.map((_, i) => i) : measures.map((_, i) => measures.length - 1 - i);
      for (const mi of range) {
        const events = eventsAt(mi);
        if (events.length) {
          setSelected({ measureIndex: mi, eventIndex: dir === 1 ? 0 : events.length - 1 });
          return;
        }
      }
      return;
    }
    let mi = selected.measureIndex;
    let ei = selected.eventIndex + dir;
    while (mi >= 0 && mi < measures.length) {
      const events = eventsAt(mi);
      if (ei >= 0 && ei < events.length) {
        setSelected({ measureIndex: mi, eventIndex: ei });
        return;
      }
      mi += dir;
      ei = dir === 1 ? 0 : eventsAt(mi).length - 1;
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNote();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!selected) return;
        e.preventDefault();
        stepSelectedPitch(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        walkSelection(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      const byKey = COMMON_DURATIONS.find((d) => d.key === e.key);
      if (byKey) {
        e.preventDefault();
        onDurationClick(byKey.value);
        return;
      }
      if (e.key === '.') {
        e.preventDefault();
        onToggleDotted();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        onToggleTriplet();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onToggleRest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Editor bar — view tabs · instrument/name · add measure (single track) */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
        <div className="st-seg">
          {(
            [
              { id: 'staff' as const, label: 'Staff' },
              { id: 'piano-roll' as const, label: 'Piano-roll' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setEditorTab(t.id)}
              className={editorTab === t.id ? 'is-on' : ''}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="st-divline" />

        <div className="st-seg" role="group" aria-label="Note editing mode">
          <button type="button" className={!insertOnClick ? 'is-on' : ''} aria-pressed={!insertOnClick} onClick={() => setInsertOnClick(false)} title="Select and edit notes without adding notes on click">Select</button>
          <button type="button" className={insertOnClick ? 'is-on' : ''} aria-pressed={insertOnClick} onClick={() => setInsertOnClick(true)} title="Click empty measure space to insert notes">Insert</button>
        </div>

        {activeTrack && (
          <>
            <input
              type="text"
              value={activeTrack.displayName}
              onChange={(e) =>
                dispatch({ type: 'set-track-name', trackIndex: activeTrackIndex, name: e.target.value })
              }
              className="st-input w-36"
              aria-label="Track name"
            />
            <div className="st-select" style={{ width: 150 }}>
              <select
                value={activeTrack.instrument}
                onChange={(e) =>
                  dispatch({
                    type: 'set-track-instrument',
                    trackIndex: activeTrackIndex,
                    instrument: e.target.value as Instrument,
                  })
                }
                aria-label="Instrument"
              >
                {INSTRUMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="caret">
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </div>
          </>
        )}

        {showDragMode && onSetDragAll && (
          <div className="st-seg ml-auto" role="radiogroup" aria-label="Drag mode">
            <button
              type="button"
              className={dragAll ? 'is-on' : ''}
              onClick={() => onSetDragAll(true)}
              title="Ripple — dragging a measure moves it and everything after it (hold Option to move just one)"
            >
              <ChevronsLeftRight className="h-3.5 w-3.5" />
              Ripple
            </button>
            <button
              type="button"
              className={!dragAll ? 'is-on' : ''}
              onClick={() => onSetDragAll(false)}
              title="Single — dragging moves only that measure or marker (hold Option to ripple)"
            >
              <Move className="h-3.5 w-3.5" />
              Single
            </button>
          </div>
        )}

        {activeTrack && <MidiRecordButton score={score} trackIndex={activeTrackIndex} targetMeasure={targetMeasureIndex} dispatch={dispatch} getCurrentSeconds={getCurrentSeconds} recordingSource={recordingSource} />}

        <button
          onClick={() => dispatch({ type: 'add-measure', trackIndex: activeTrackIndex })}
          className={`st-chip${showDragMode && onSetDragAll ? '' : ' ml-auto'}`}
          title="Add a measure to the end of the score"
        >
          <Plus className="h-3.5 w-3.5" />
          Add measure
        </button>
        <button type="button" className="st-chip"
          disabled={(selected === null && selectedMeasureIndex === null) || (activeTrack?.measures.length ?? 0) <= 1}
          title={(activeTrack?.measures.length ?? 0) <= 1 ? 'Keep at least one measure in the score' : 'Delete the selected measure. Undo restores it.'}
          onClick={() => {
            dispatch({ type: 'delete-measure', trackIndex: activeTrackIndex, measureIndex: targetMeasureIndex });
            setSelected(null);
            setSelectedMeasureIndex(null);
          }}>
          Delete measure{selected !== null || selectedMeasureIndex !== null ? ` ${targetMeasureIndex + 1}` : ''}
        </button>
        <button type="button" className={`st-chip${targetHasFinalBar ? ' is-on' : ''}`}
          aria-pressed={targetHasFinalBar}
          disabled={!activeTrack || targetIsRepeatEnd}
          title={targetIsRepeatEnd
            ? 'A repeat already closes this measure'
            : targetHasFinalBar
              ? `Remove the double bar that closes measure ${targetMeasureIndex + 1}`
              : `Close measure ${targetMeasureIndex + 1} with a double bar (the end of the section)`}
          onClick={() => dispatch({ type: 'set-measure-final-bar', trackIndex: activeTrackIndex, measureIndex: targetMeasureIndex, final: !targetHasFinalBar })}>
          Double bar{selected !== null || selectedMeasureIndex !== null ? ` ${targetMeasureIndex + 1}` : ''}
        </button>
        <button type="button" className={`st-chip${repeatOpen ? ' is-on' : ''}`} aria-expanded={repeatOpen}
          onClick={() => {
            if (!repeatOpen) { setRepeatStart(targetMeasureIndex + 1); setRepeatEnd(targetMeasureIndex + 1); }
            setRepeatOpen(!repeatOpen);
          }}>Repeat measures</button>
      </div>

      {repeatOpen && activeTrack && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <label className="flex items-center gap-2">From measure
            <input aria-label="Repeat from measure" type="number" min={1} max={activeTrack.measures.length}
              className="st-input w-16" value={repeatStart} onChange={e => setRepeatStart(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">Through
            <input aria-label="Repeat through measure" type="number" min={repeatStart} max={activeTrack.measures.length}
              className="st-input w-16" value={repeatEnd} onChange={e => setRepeatEnd(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">Total plays
            <select className="st-input w-16" value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))}>
              {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}×</option>)}
            </select>
          </label>
          <button type="button" className="st-chip"
            disabled={!Number.isInteger(repeatStart) || !Number.isInteger(repeatEnd) || repeatStart < 1 || repeatEnd < repeatStart ||
              repeatEnd > activeTrack.measures.length || activeTrack.measures.slice(repeatStart - 1, repeatEnd).some(m => m.repeat)}
            onClick={() => {
              dispatch({ type: 'repeat-measures', trackIndex: activeTrackIndex, start: repeatStart - 1,
                end: repeatEnd - 1, count: repeatCount, id: crypto.randomUUID() });
              setSelected(null);
            }}>Apply repeat</button>
          <span className="text-muted-foreground">All passes appear here for syncing. Students see repeat dots.</span>
          {repeatGroups(activeTrack).map(group => (
            <div key={group.id} className="flex w-full items-center gap-2">
              <span>Measures {group.start + 1}–{group.start + group.length} · {group.count} plays</span>
              <button type="button" className="st-chip" onClick={() => dispatch({ type: 'unlink-repeat', trackIndex: activeTrackIndex, id: group.id })}>
                Unlink copies
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active view — the audio-aligned staff (or piano-roll). The staff fills
          the available height between the editor bar and the toolbar. */}
      {editorTab === 'staff' && (
        <div ref={staffWrapRef} className="min-h-0 flex-1">
          <EditableMeasureStrip
            measures={stripItems}
            getCurrentSeconds={getCurrentSeconds}
            pixelsPerSecond={pixelsPerSecond}
            scrollLeftPx={scrollLeftPx}
            selected={selected}
            selectedMeasureIndex={selected?.measureIndex ?? selectedMeasureIndex}
            onSelectMeasure={(index) => { setSelected(null); setSelectedMeasureIndex(index); }}
            onSelectEvent={handleSelectEvent}
            onClickMeasureEmpty={handleClickEmpty}
            onRequestZoomTo={handleRequestZoomTo}
            onSetPitch={handleSetPitch}
            accidental={pitchAcc}
            keyFifths={score.initialKeyFifths}
            isPercussion={percussion}
            percStrokes={percStrokes}
            dragAll={dragAll}
            onMeasureDrag={handleMeasureDrag}
            onMeasureDragEnd={onMeasureDragEnd}
            onTailDrag={onTailDrag}
            resizable={showDragMode}
            previewMidi={insertOnClick ? (insertRest ? null : currentMidi) : undefined}
            insertOnClick={insertOnClick}
            onWheelZoom={(factor, anchorPx) => {
              const nextPps = Math.max(8, Math.min(600, pixelsPerSecond * factor));
              const anchorSeconds = (scrollLeftPx + anchorPx) / pixelsPerSecond;
              onRequestZoom(nextPps, Math.max(0, anchorSeconds * nextPps - anchorPx));
            }}
            onScrollByPx={onScrollByPx}
            height={staffHeight}
          />
        </div>
      )}
      {editorTab === 'piano-roll' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-card p-3">
          <PianoRollView score={score} activeTrackIndex={activeTrackIndex} dispatch={dispatch} />
        </div>
      )}

      {/* Insert toolbar — note entry, one compact row */}
      <div className="st-notebar flex-shrink-0">
        <div className="st-nb-lead">
          <span className="st-nb-glyph">
            <Music className="h-4 w-4" />
          </span>
        </div>

        {/* Duration (icons inline · rare durations + articulations behind "more") */}
        <div className="st-nb-grp" aria-label="Duration">
          <div className="st-glyphseg">
            {COMMON_DURATIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDurationClick(opt.value)}
                className={`note-glyph${Math.abs(duration - opt.value) < 1e-7 ? ' is-on' : ''}`}
                title={opt.key ? `${opt.label} note — ${opt.key}` : `${opt.label} note`}
              >
                <NoteIcon durationQN={opt.value} />
              </button>
            ))}
          </div>
          <button
            className={`st-iconbtn${moreOpen ? ' is-on' : ''}`}
            onClick={() => setMoreOpen((m) => !m)}
            title="More durations & articulations"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreOpen && (
            <>
              <div className="st-pop-scrim" onClick={() => setMoreOpen(false)} />
              <div className="st-nb-pop">
                <div className="st-glyphseg">
                  {RARE_DURATIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onDurationClick(opt.value)}
                      className={`note-glyph${Math.abs(duration - opt.value) < 1e-7 ? ' is-on' : ''}`}
                      title={`${opt.label} note`}
                    >
                      <NoteIcon durationQN={opt.value} />
                    </button>
                  ))}
                </div>
                <div className="st-glyphseg">
                  {ARTICULATION_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      className={articulation === a.value ? 'is-on' : ''}
                      onClick={() => onArticulationClick(a.value)}
                      title={a.title}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modifiers — dot/triplet/tie inline; core to Latin rhythm, so one click */}
        <div className="st-glyphseg" aria-label="Modifiers">
          <button className={dotted ? 'is-on' : ''} onClick={onToggleDotted} title="Dotted (1.5×) — .">
            •
          </button>
          <button className={triplet ? 'is-on' : ''} onClick={onToggleTriplet} title="Triplet (3:2) — t">
            ³
          </button>
          <button
            className={tieActive ? 'is-on' : ''}
            onClick={onToggleTie}
            disabled={!selected}
            title="Tie to next"
          >
            ⌣
          </button>
        </div>

        <span className="st-divline" />

        {/* Stroke (percussion) / pitch (pitched) */}
        <div aria-label={percussion ? 'Stroke' : 'Pitch'}>
          {percussion ? (
            <PercussionStrokePicker strokes={percStrokes ?? []} value={strokeValue} onChange={onStrokeClick} />
          ) : (
            <div className="st-nb-grp" title={`midi ${currentMidi}`}>
              <div className="st-seg pitch" role="radiogroup" aria-label="Note letter">
                {PITCH_LETTERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPitchPartChange({ letter: p })}
                    className={pitchLetter === p ? 'is-on' : ''}
                    role="radio"
                    aria-checked={pitchLetter === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="st-glyphseg" role="radiogroup" aria-label="Accidental">
                {ACCIDENTAL_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onPitchPartChange({ acc: o.value })}
                    className={pitchAcc === o.value ? 'is-on' : ''}
                    role="radio"
                    aria-checked={pitchAcc === o.value}
                    title={o.value === 0 ? 'Natural' : o.value === 1 ? 'Sharp' : 'Flat'}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="st-stepper">
                <button
                  type="button"
                  onClick={() => onPitchPartChange({ octave: Math.max(0, pitchOctave - 1) })}
                  aria-label="Octave down"
                >
                  –
                </button>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={pitchOctave}
                  onChange={(e) => onPitchPartChange({ octave: Number(e.target.value) || 0 })}
                  aria-label="Octave"
                />
                <button
                  type="button"
                  onClick={() => onPitchPartChange({ octave: Math.min(9, pitchOctave + 1) })}
                  aria-label="Octave up"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="st-nb-actions">
          <span
            className={`st-nb-cap${capacity.full ? ' is-full' : ''}`}
            title={`Measure ${capacity.measureNumber} — ${formatBeats(capacity.usedBeats)}/${formatBeats(capacity.totalBeats)} beats filled`}
          >
            m.{capacity.measureNumber} · {formatBeats(capacity.usedBeats)}/{formatBeats(capacity.totalBeats)}
          </span>
          <button
            className={`st-nb-rest${insertRest ? ' is-on' : ''}`}
            onClick={onToggleRest}
            title="Insert a rest instead of a note — r"
          >
            <RestIcon /> Rest
          </button>
          <button
            className="st-btn-primary st-nb-add"
            onClick={handleAddNote}
            disabled={capacity.full}
            title={
              capacity.full
                ? `Measure ${capacity.measureNumber} is full — add a measure or pick a shorter duration`
                : 'Add a note/rest with the current toolbar values'
            }
          >
            <Plus className="h-[15px] w-[15px]" /> Add {insertRest ? 'rest' : 'note'}{' '}
            <span className="kbd">⏎</span>
          </button>
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
              className="st-iconbtn hover:!border-destructive/40 hover:!bg-destructive/10 hover:!text-destructive"
              title="Delete selected note"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Help */}
      <p className="st-help flex-shrink-0">
        <span className="k">drag ↕</span> pitch · <span className="k">↑/↓</span> step (
        <span className="k">⇧</span> octave) · <span className="k">←/→</span> walk notes ·{' '}
        <span className="k">⏎</span> add · <span className="k">1–5</span> duration ·{' '}
        <span className="k">Del</span> remove.
      </p>
    </div>
  );
});

/** Compact beat count: whole numbers show plain, fractions to one decimal. */
function formatBeats(beats: number): string {
  return Number.isInteger(beats) ? String(beats) : beats.toFixed(1);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && (target.isContentEditable || !!target.closest('[role="dialog"]')))
  );
}

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
