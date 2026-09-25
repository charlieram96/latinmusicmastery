'use client';

// PlaySense Studio — integrated editor under the waveform.
//
// Lives in the same vertical slot the old MeasureStrip occupied. Renders a
// compact track bar + view tabs + an editing toolbar + the active view:
//   • Staff (default, main): the audio-aligned EditableMeasureStrip — click a
//     bar to select it (drag or ⇧-click for several, double-click to open it);
//     click a note to select it; drag a note vertically to change its pitch.
//     Clicks never add notes — the Add note button appends one with the
//     toolbar's current pitch/duration/modifiers. A measure bar floats over the
//     selected bars with every bar-level action; useMeasureKeys holds their keys.
//   • Piano-roll: the existing PianoRollView (not audio-aligned).
//
// Owns the editor view state (selected event, active track, active view, toolbar
// pitch/duration/modifiers). Score itself lives in the parent via useEditor; this
// just dispatches edits. Markers + waveform live in SyncPanel and are not touched
// here — note edits don't change `structuralSignature`, so the markers above stay
// put while you edit pitches/durations.

import { ChevronDown, MoreHorizontal, Music, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch } from 'react';
import { diatonicToMidi, extractTrackEvents, midiToDiatonic } from '@/lib/playsense-studio/score-to-vexflow';
import { getPercStrokes, isPercussion, resolvePercStroke } from '@/lib/playsense-studio/perc-strokes';
import { midiToParts } from '@/lib/playsense-studio/pitch';
import { STEP_SEMITONE } from '@/lib/playsense-studio/notation/accidentals';
import {
  QN_EPS,
  beatLengthInQN,
  effectiveDurationQN,
  isFillerRest,
  measureLengthInQN,
  occupiedQN,
} from '@/lib/playsense-studio/time-mapping';
import { fillIssues, measureFill, type MeasureFill } from '@/lib/playsense-studio/measure-fill';
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
import { RepeatPopover } from './measure/repeat-popover';
import { GapMenu } from './measure/gap-menu';
import { BarPopover } from './measure/bar-popover';
import { MeasureBar } from './measure/measure-bar';
import { ShortcutsPopover } from './measure/shortcuts-popover';
import { useMeasureKeys } from './measure/use-measure-keys';
import type { PopoverAnchor } from './measure/popover';
import { tempoAt } from '@/lib/playsense-studio/tempo-marks';
import { REP_H, type RepeatBand } from './measure/repeat-lane';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { PianoRollView } from './piano-roll-view';
import { PercussionStrokePicker } from './percussion-stroke-picker';
import { MidiRecordButton, type MidiRecordingSource } from './midi-record-button';
import { MeasureZoom, type ZoomState } from './zoom/measure-zoom';
import { useZoomEditing } from './zoom/use-zoom-editing';
import type { ZoomLayout } from './zoom/zoom-staff';

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
type EditorTab = 'staff' | 'piano-roll';

import { repeatGroups } from '@/lib/playsense-studio/repeats';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';
import { contextAt, structuralEditProblem } from '@/lib/playsense-studio/measure-edits';
import { readMeasureClipboard, stripCopyTags, subscribeMeasureClipboard } from '@/lib/playsense-studio/measure-clipboard';
import { clampSelection, clickSelect, dragSelect, selectionBounds, type MeasureSelection } from '@/lib/playsense-studio/measure-selection';

export interface IntegratedEditorMeasureTiming {
  measureNumber: number;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
}

export interface IntegratedEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  /** A refused structural edit, shown inline in the editor bar. */
  notice?: string | null;
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
  /** Mirrors the current note selection out to the right-rail inspector. The
   *  editor stays the source of truth; pass a stable callback to keep the memo. */
  onSelectionChange?: (selection: { ref: SelectedEventRef; trackIndex: number } | null) => void;
  /** Horizontal wheel/trackpad pan over the staff (shared timeline scroll). */
  onScrollByPx?: (dx: number) => void;
  /** Loads (or clears, when already looping that range) an A/B loop over bars
   *  start..end. Omitted where there is no video to loop (songs, exercises). */
  onLoopMeasures?: (start: number, end: number) => void;
  /** Which bars the current loop covers, if any. */
  loopedRange?: [number, number] | null;
}

/** A repeat's closing bar (with dots) replaces any final bar on that measure. */
function isRepeatEnd(measure: Measure): boolean {
  return !!measure.repeat && measure.repeat.offset === measure.repeat.length - 1;
}

export const IntegratedEditor = memo(function IntegratedEditor({
  score,
  dispatch,
  notice,
  measureTimings,
  getCurrentSeconds,
  recordingSource,
  pixelsPerSecond,
  scrollLeftPx,
  viewportWidth,
  onRequestZoom,
  onSelectionChange,
  onScrollByPx,
  onLoopMeasures,
  loopedRange = null,
}: IntegratedEditorProps) {
  // Single-track studio: the score model still holds Track[], but the editor
  // always authors track 0.
  const activeTrackIndex = 0;
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');
  const [selected, setSelected] = useState<SelectedEventRef | null>(null);
  // Contiguous measure selection: anchor = where it started, focus = the end
  // being moved (Shift+click / Shift+arrows). The measure bar's actions act on
  // the whole range; "target" semantics (Add note) follow the focus.
  const [measureRange, setMeasureRange] = useState<MeasureSelection | null>(null);
  const [rangeStart, rangeEnd] = selectionBounds(measureRange) ?? [null, null];
  const rangeCount = rangeStart !== null && rangeEnd !== null ? rangeEnd - rangeStart + 1 : 0;
  // The measure menus, each anchored over the strip wrapper (position: relative):
  // the repeat lane's / Repeat ▾ menu, the gap "+" menu (empty bar / copy of the
  // bar before / paste) and the Bar ▾ menu (meter/key/clef/barlines/endings/tempo).
  const [repeatPop, setRepeatPop] = useState<{ anchor: PopoverAnchor } | null>(null);
  const [gapPop, setGapPop] = useState<{ gap: number; anchor: PopoverAnchor } | null>(null);
  const [barPop, setBarPop] = useState<{ anchor: PopoverAnchor } | null>(null);
  // The measure zoom (one bar drawn large over the strip), or null when closed.
  // `zoomOrigin` is the bar's rect in the strip for the enter/exit animation;
  // `zoomClosing` asks the zoom to play its exit and then call back to close.
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<{ left: number; width: number } | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const zoomOpen = zoom !== null;
  // The zoomed bar's note layout (hits, beat span, line math) for the zoom's
  // pointer and toolbar work in later tasks.
  const zoomLayout = useRef<ZoomLayout | null>(null);
  // A menu belongs to the bars it opened on: every key or click that changes
  // the bar selection closes whichever menu is open.
  const closeMenus = useCallback(() => {
    setRepeatPop(null);
    setGapPop(null);
    setBarPop(null);
  }, []);
  // Bars an insert/paste/duplicate is about to add. The parent may still refuse
  // the edit (SyncPanel refuses one that would run into a sibling section, which
  // the problem checks here can't predict), so the new bars are selected (and
  // flashed) only once the score really grows by that many — see expectNewBars
  // and the effect that consumes this. Any selection the user makes by other
  // means drops the plan.
  const pendingBars = useRef<{
    from: ScoreDocument; expectCount: number; sel: MeasureSelection; flash: boolean;
  } | null>(null);
  const selectionChanged = useCallback(() => {
    pendingBars.current = null;
    closeMenus();
  }, [closeMenus]);
  const selectBars = useCallback((sel: MeasureSelection | null) => {
    setSelected(null);
    setMeasureRange(sel);
    selectionChanged();
  }, [selectionChanged]);
  const selectMeasure = useCallback((index: number, extend = false) => {
    setSelected(null);
    setMeasureRange((prev) => clickSelect(prev, index, extend));
    selectionChanged();
  }, [selectionChanged]);
  const selectMeasureRange = useCallback((anchor: number, focus: number) => {
    selectBars(dragSelect(anchor, focus));
  }, [selectBars]);
  const onRepeatBandClick = useCallback((b: RepeatBand, anchor: PopoverAnchor) => {
    selectMeasureRange(b.firstIndex, b.lastIndex);
    setRepeatPop({ anchor });
  }, [selectMeasureRange]);
  const onGapClick = useCallback((gap: number, anchor: PopoverAnchor) => {
    setGapPop({ gap, anchor });
  }, []);
  // The measure bar hides while a drag across bars is still choosing them.
  const [selDragging, setSelDragging] = useState(false);
  // The footer's "?" menu. `shortcutsWasOpen` notes, at pointerdown, whether it
  // was open — the menu's own outside-press close runs first, so a second click
  // on "?" closes it instead of reopening it.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsWasOpen = useRef(false);
  // A short confirmation under the editor bar ("Cleared. Timing kept."). The
  // `notice` prop is the parent's refused-edit line, so local messages live here.
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
  }, []);
  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 2500);
  }, []);
  // Bars just inserted by the gap menu — flashed with `is-new` for 400ms.
  const [newBars, setNewBars] = useState<Set<number>>(new Set());
  const newBarsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (newBarsTimeout.current) clearTimeout(newBarsTimeout.current);
  }, []);
  const flashNewBars = useCallback((from: number, to: number) => {
    const next = new Set<number>();
    for (let i = from; i <= to; i++) next.add(i);
    setNewBars(next);
    if (newBarsTimeout.current) clearTimeout(newBarsTimeout.current);
    newBarsTimeout.current = setTimeout(() => setNewBars(new Set()), 400);
  }, []);
  const clipboard = useSyncExternalStore(subscribeMeasureClipboard, readMeasureClipboard, () => null);
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
    return Math.max(0, Math.min(127, (pitchOctave + 1) * 12 + STEP_SEMITONE[pitchLetter as keyof typeof STEP_SEMITONE] + pitchAcc));
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
    Math.max(0, Math.min(127, (octave + 1) * 12 + STEP_SEMITONE[letter as keyof typeof STEP_SEMITONE] + acc));

  // Keyboard editing — Esc clear · Del remove · ⏎ add · ↑/↓ pitch (⇧ = octave /
  // stroke) · ←/→ walk the selection · 1-5 durations · "." dot · "t" triplet ·
  // "r" rest. Declared below the handlers it calls via function refs would be
  // noisier; instead this effect lives after the toolbar handlers are defined
  // (see the second keydown effect further down). This one keeps Esc/Delete on
  // a selected NOTE; the same keys on selected bars live in useMeasureKeys.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // The zoom owns its keys while it's open (its selection follows its cursor).
      if (!selected || zoomOpen || isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelected(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      dispatch({
        type: 'delete-event',
        trackIndex: activeTrackIndex,
        measureIndex: selected.measureIndex,
        eventIndex: selected.eventIndex,
      });
      setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, zoomOpen, dispatch, activeTrackIndex]);

  // Extract the active track's notation once per score edit. Kept apart from
  // stripItems so moving sync markers (measureTimings) doesn't re-extract.
  const tracked = useMemo(
    () => (activeTrack ? extractTrackEvents(activeTrack, score.initialTimeSignature, score.initialKeyFifths) : []),
    [activeTrack, score.initialTimeSignature, score.initialKeyFifths]
  );

  // The Bar ▾ popover's current values, for the bar at rangeStart.
  const barPopCurrent = useMemo(() => {
    if (!activeTrack || rangeStart === null) return null;
    const measure = activeTrack.measures[rangeStart];
    const t = tracked[rangeStart];
    if (!measure || !t) return null;
    return {
      timeSignature: t.timeSignature,
      keyFifths: t.keyFifths,
      clef: t.clef === 'percussion' ? ('treble' as const) : t.clef,
      tempo: tempoAt(score, activeTrackIndex, rangeStart),
      repeatStart: !!measure.repeatStart,
      repeatEnd: !!measure.repeatEnd,
      double: measure.endBarline === 'double',
      final: hasFinalBarline(activeTrack.measures, rangeStart),
      volta: measure.volta ?? null,
    };
  }, [activeTrack, rangeStart, tracked, score, activeTrackIndex]);

  // How full each bar is — keyed on the track only (not measureTimings), so
  // moving sync markers doesn't recompute it.
  const measureFills: MeasureFill[] = useMemo(
    () => (activeTrack
      ? activeTrack.measures.map((m, i) => measureFill(m.voices[0]?.events ?? [], m.voices[1]?.events, tracked[i].timeSignature))
      : []),
    [activeTrack, tracked]
  );

  // Build stripItems for the active track — zip events with timings.
  const stripItems: MeasureStripItem[] = useMemo(() => {
    if (!activeTrack) return [];
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
        voice2Events: tracked[i].voice2Events,
        timeSignature: tracked[i].timeSignature,
        isFirst: i === 0,
        clef: tracked[i].clef,
        keyFifths: tracked[i].keyFifths,
        previousKeyFifths: tracked[i].previousKeyFifths,
        keyChanged: tracked[i].keyChanged,
        clefChanged: tracked[i].clefChanged,
        fill: measureFills[i],
      });
    }
    return out;
  }, [activeTrack, tracked, measureTimings, measureFills]);

  // The measure "Add note" targets: the selected event's measure, else the last.
  const measureCount = activeTrack?.measures.length ?? 0;
  const lastMeasureIndex = Math.max(0, measureCount - 1);
  const targetMeasureIndex = selected
    ? selected.measureIndex
    : Math.min(measureRange?.focus ?? lastMeasureIndex, lastMeasureIndex);

  // Call just before dispatching the edit. An accepted edit re-renders and runs
  // the effect below synchronously (key presses and clicks are discrete events,
  // whose render and passive effects React flushes before any macrotask), so a
  // plan still parked when the timeout fires belongs to an edit that never
  // landed: drop it, or a later undo/redo/append that happens to reach the same
  // bar count would select (and flash) these bars out of the blue.
  const expectNewBars = useCallback((added: number, sel: MeasureSelection, flash = false) => {
    const plan = { from: score, expectCount: measureCount + added, sel, flash };
    pendingBars.current = plan;
    setTimeout(() => {
      if (pendingBars.current === plan) pendingBars.current = null;
    }, 0);
  }, [score, measureCount]);
  // Keep the range inside the score after deletes / undo — or move it onto the
  // bars that just arrived.
  useEffect(() => {
    const pending = pendingBars.current;
    if (pending && pending.from !== score) {
      pendingBars.current = null;
      if (measureCount === pending.expectCount) {
        selectBars(pending.sel);
        const [a, b] = selectionBounds(pending.sel)!;
        if (pending.flash) flashNewBars(a, b);
        return;
      }
    }
    setMeasureRange((prev) => clampSelection(prev, measureCount));
  }, [score, measureCount, selectBars, flashNewBars]);

  // Why each barline gap can or cannot take a new bar (drives the "+" buttons).
  const gapProblems = useMemo(
    () => Array.from({ length: measureCount + 1 }, (_, i) =>
      structuralEditProblem(score, { type: 'insert-measure', trackIndex: activeTrackIndex, index: i })),
    [score, measureCount, activeTrackIndex]
  );
  const pasteProblem = useMemo(() => {
    if (!clipboard) return 'Copy some measures first.';
    const index = rangeEnd !== null ? rangeEnd + 1 : measureCount;
    return structuralEditProblem(score, { type: 'paste-measures', trackIndex: activeTrackIndex, index, clip: clipboard });
  }, [clipboard, rangeEnd, measureCount, score, activeTrackIndex]);
  const deleteProblem = useMemo(
    () => (rangeStart === null
      ? 'Select a measure first.'
      : structuralEditProblem(score, { type: 'delete-measures', trackIndex: activeTrackIndex, start: rangeStart, count: rangeCount })),
    [score, activeTrackIndex, rangeStart, rangeCount]
  );
  // Duplicating pastes a copy of the bars right after them, so it's refused
  // wherever that paste would be (inside a repeat, past the measure limit…).
  const dupProblem = useMemo(() => {
    if (!activeTrack || rangeStart === null || rangeEnd === null) return 'Select a measure first.';
    return structuralEditProblem(score, {
      type: 'paste-measures',
      trackIndex: activeTrackIndex,
      index: rangeEnd + 1,
      clip: {
        measures: activeTrack.measures.slice(rangeStart, rangeEnd + 1).map(stripCopyTags),
        context: contextAt(score, activeTrack, rangeStart),
        instrument: activeTrack.instrument,
      },
    });
  }, [score, activeTrack, activeTrackIndex, rangeStart, rangeEnd]);

  const insertMeasureAt = useCallback((index: number, flash = false) => {
    expectNewBars(1, { anchor: index, focus: index }, flash);
    dispatch({ type: 'insert-measure', trackIndex: activeTrackIndex, index });
  }, [dispatch, activeTrackIndex, expectNewBars]);
  const copyRange = useCallback(() => {
    if (rangeStart === null) return;
    dispatch({ type: 'copy-measures', trackIndex: activeTrackIndex, start: rangeStart, count: rangeCount });
  }, [dispatch, activeTrackIndex, rangeStart, rangeCount]);
  const pasteAfterRange = useCallback(() => {
    if (!clipboard || pasteProblem) return;
    const index = rangeEnd !== null ? rangeEnd + 1 : measureCount;
    const count = clipboard.measures.length;
    expectNewBars(count, { anchor: index, focus: index + count - 1 });
    dispatch({ type: 'paste-measures', trackIndex: activeTrackIndex, index, clip: clipboard });
  }, [dispatch, activeTrackIndex, clipboard, pasteProblem, rangeEnd, measureCount, expectNewBars]);
  const deleteRange = useCallback(() => {
    if (rangeStart === null || deleteProblem) return;
    dispatch({ type: 'delete-measures', trackIndex: activeTrackIndex, start: rangeStart, count: rangeCount });
    selectBars(null);
  }, [dispatch, activeTrackIndex, rangeStart, rangeCount, deleteProblem, selectBars]);
  // "m.2" or "m.2–3", from the bars' own numbers.
  const rangeLabel = (() => {
    if (!activeTrack || rangeStart === null || rangeEnd === null) return '';
    const a = activeTrack.measures[rangeStart]?.number ?? rangeStart + 1;
    const b = activeTrack.measures[rangeEnd]?.number ?? rangeEnd + 1;
    return rangeStart === rangeEnd ? `m.${a}` : `m.${a}–${b}`;
  })();
  const copyWithNotice = useCallback(() => {
    if (rangeStart === null) return;
    copyRange();
    showFlash(`Copied ${rangeLabel} with its timing.`);
  }, [rangeStart, copyRange, showFlash, rangeLabel]);
  // Duplicate the bars right after themselves (the sync panel keeps the copies'
  // timing) and select the copies.
  const duplicateRange = useCallback(() => {
    if (rangeStart === null || rangeEnd === null || dupProblem) return;
    expectNewBars(rangeCount, { anchor: rangeEnd + 1, focus: rangeEnd + rangeCount });
    dispatch({ type: 'duplicate-measures', trackIndex: activeTrackIndex, start: rangeStart, count: rangeCount });
  }, [dispatch, activeTrackIndex, rangeStart, rangeEnd, rangeCount, dupProblem, expectNewBars]);
  const clearRange = useCallback(() => {
    if (rangeStart === null) return;
    dispatch({ type: 'clear-measures', trackIndex: activeTrackIndex, start: rangeStart, count: rangeCount });
    showFlash('Cleared. Timing kept.');
  }, [dispatch, activeTrackIndex, rangeStart, rangeCount, showFlash]);

  // The gap menu's three actions — each selects the bar(s) it made and flashes
  // them, once they arrive.
  const gapEmpty = useCallback((gap: number) => {
    insertMeasureAt(gap, true);
  }, [insertMeasureAt]);
  const gapCopyLeft = useCallback((gap: number) => {
    expectNewBars(1, { anchor: gap, focus: gap }, true);
    dispatch({ type: 'duplicate-measures', trackIndex: activeTrackIndex, start: gap - 1, count: 1 });
  }, [dispatch, activeTrackIndex, expectNewBars]);
  const gapPaste = useCallback((gap: number) => {
    if (!clipboard) return;
    const count = clipboard.measures.length;
    expectNewBars(count, { anchor: gap, focus: gap + count - 1 }, true);
    dispatch({ type: 'paste-measures', trackIndex: activeTrackIndex, index: gap, clip: clipboard });
  }, [dispatch, activeTrackIndex, clipboard, expectNewBars]);

  // The repeat group under the highlighted range's start, if any — drives the
  // repeat menu, which follows the selection rather than the toolbar target.
  const repeatGroupAtRange = activeTrack && rangeStart !== null
    ? repeatGroups(activeTrack).find(g => rangeStart >= g.start && rangeStart < g.start + g.length * g.count) ?? null
    : null;

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

  const handleSelectEvent = useCallback((ref: SelectedEventRef) => {
    setSelected(ref);
    setMeasureRange({ anchor: ref.measureIndex, focus: ref.measureIndex });
    selectionChanged();
  }, [selectionChanged]);

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

  // Zoom the timeline so bar `index` fills 56% of the viewport, centred.
  const zoomWaveformTo = useCallback((index: number) => {
    const t = measureTimings[index];
    if (!t || viewportWidth <= 0) return false;
    const span = Math.max(0.05, t.endVideoTimeSeconds - t.startVideoTimeSeconds);
    const pps = Math.min(600, Math.max(8, (viewportWidth * 0.56) / span));
    const scroll = Math.max(0, t.startVideoTimeSeconds * pps - (viewportWidth - span * pps) / 2);
    onRequestZoom(pps, scroll);
    return true;
  }, [measureTimings, viewportWidth, onRequestZoom]);

  // A bar's rect in the strip right now (strip x, before any zoom it asks for).
  const barRect = useCallback((index: number) => {
    const t = measureTimings[index];
    if (!t) return null;
    const left = t.startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    return { left, width: Math.max(1, (t.endVideoTimeSeconds - t.startVideoTimeSeconds) * pixelsPerSecond) };
  }, [measureTimings, pixelsPerSecond, scrollLeftPx]);

  const zoomEvents = useCallback(
    (measureIndex: number, voice: 0 | 1) => activeTrack?.measures[measureIndex]?.voices[voice]?.events ?? [],
    [activeTrack]
  );

  // Open a bar in the measure zoom: the timeline zooms to it, it's selected,
  // and the cursor sits on `eventIndex` (else its first event, else the end).
  const openMeasure = useCallback((index: number, eventIndex?: number) => {
    const origin = barRect(index);
    if (!zoomWaveformTo(index)) return;
    selectBars({ anchor: index, focus: index });
    setZoomOrigin(origin);
    setZoomClosing(false);
    setZoom({
      measureIndex: index,
      cursor: { measureIndex: index, voice: 0, index: eventIndex ?? (zoomEvents(index, 0).length ? 0 : 'end'), anchor: null },
      value: 'q',
      dots: 0,
      pencil: false,
    });
  }, [barRect, zoomWaveformTo, selectBars, zoomEvents]);

  // Move the open zoom to bar `index`: the timeline zooms to it, it's the
  // selected bar, and the zoom slides it in (MeasureZoom animates a changed
  // measureIndex). A cursor already placed in that bar (the zoom's keys walk
  // or type into it) is kept; otherwise it sits at the bar's start going
  // forward or its end going back.
  const openBar = useCallback((index: number, dir: 1 | -1) => {
    if (index < 0 || index >= measureCount) return;
    zoomWaveformTo(index);
    setMeasureRange({ anchor: index, focus: index });
    setZoom((z) => {
      if (!z) return z;
      if (z.measureIndex === index && z.cursor.measureIndex === index) return z;
      const voice = z.cursor.voice;
      return {
        ...z,
        measureIndex: index,
        cursor: { measureIndex: index, voice, index: dir === 1 && zoomEvents(index, voice).length ? 0 : 'end', anchor: null },
      };
    });
  }, [measureCount, zoomWaveformTo, zoomEvents]);

  // ‹ › : the neighbouring bar.
  const navZoom = useCallback((dir: 1 | -1) => {
    if (zoom) openBar(zoom.measureIndex + dir, dir);
  }, [zoom, openBar]);

  const setZoomVoice = useCallback((voice: 0 | 1) => {
    if (!zoom) return;
    const m = zoom.measureIndex;
    setZoom({ ...zoom, cursor: { measureIndex: m, voice, index: zoomEvents(m, voice).length ? 0 : 'end', anchor: null } });
  }, [zoom, zoomEvents]);

  // Close: the zoom plays its exit toward the bar's rect now, then finishZoomClose.
  const closeZoom = useCallback(() => {
    if (!zoom) return;
    setZoomOrigin(barRect(zoom.measureIndex));
    setZoomClosing(true);
  }, [zoom, barRect]);
  const finishZoomClose = useCallback(() => {
    const m = zoom?.measureIndex;
    setZoom(null);
    setZoomClosing(false);
    zoomLayout.current = null;
    if (m !== undefined) selectBars({ anchor: m, focus: m });
  }, [zoom, selectBars]);

  // The note selection follows the zoom cursor: a voice-1 event under it is the
  // selected note (SyncPanel's inspector, [ / ] nudges, the waveform handle);
  // anything else ('end', voice 2) selects no note. Adjusted during render
  // whenever the zoom state or the track changes (whoever changed it: an edit,
  // an undo), so it lands in the same commit as the cursor move.
  const [synced, setSynced] = useState<{ zoom: ZoomState | null; track: typeof activeTrack }>({ zoom: null, track: activeTrack });
  if (zoom !== synced.zoom || activeTrack !== synced.track) {
    setSynced({ zoom, track: activeTrack });
    if (zoom) {
      const c = zoom.cursor;
      const eventIndex = c.voice === 0 && typeof c.index === 'number' && zoomEvents(c.measureIndex, 0)[c.index] ? c.index : null;
      if (eventIndex === null) {
        if (selected !== null) setSelected(null);
      } else if (!selected || selected.measureIndex !== c.measureIndex || selected.eventIndex !== eventIndex) {
        setSelected({ measureIndex: c.measureIndex, eventIndex });
      }
    }
  }

  // Note editing in the zoom: its keys (Esc closes it) and, later, its toolbar.
  // The hook clamps the cursor when the score changes under the zoom.
  const zoomKeyFifthsAt = useCallback((m: number) => tracked[m]?.keyFifths ?? score.initialKeyFifths, [tracked, score.initialKeyFifths]);
  const zoomClefAt = useCallback((m: number) => tracked[m]?.clef ?? 'treble', [tracked]);
  const zoomBarQNAt = useCallback(
    (m: number) => measureLengthInQN(tracked[m]?.timeSignature ?? score.initialTimeSignature),
    [tracked, score.initialTimeSignature]
  );
  useZoomEditing({
    score, dispatch, trackIndex: activeTrackIndex, zoom, setZoom,
    keyFifthsAt: zoomKeyFifthsAt, clefAt: zoomClefAt, barQNAt: zoomBarQNAt,
    percussion, flash: showFlash, openBar, close: closeZoom,
  });

  // A zoomed bar that no longer exists (undo, a delete elsewhere) closes the zoom.
  if (zoom && zoom.measureIndex >= measureCount) {
    setZoom(null);
    setZoomClosing(false);
  }

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
    if (!selected) return;
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
      if (zoomOpen || isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        // With bars (and no note) selected, ⏎ opens the bar — useMeasureKeys.
        if (!selected && measureRange && editorTab === 'staff') return;
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
        // Walk notes only while one is selected; otherwise the arrows move the
        // bar selection (useMeasureKeys).
        if (!selected) return;
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

  // Bars that don't add up — drives the strip footer's issue chip and its
  // "jump to the next one" behavior.
  const fills = stripItems.map((it) => it.fill);
  const issues = fillIssues(fills);
  const anyOver = issues.some((i) => fills[i].kind === 'over');
  const nextIssue = () => {
    if (!issues.length) return;
    const from = measureRange ? Math.max(measureRange.anchor, measureRange.focus) : -1;
    const target = issues.find((i) => i > from) ?? issues[0];
    selectBars({ anchor: target, focus: target });
    const t = measureTimings[target];
    if (t) {
      const left = t.startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
      const right = t.endVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
      if (left < 0 || right > viewportWidth) {
        onRequestZoom(pixelsPerSecond, Math.max(0, t.startVideoTimeSeconds * pixelsPerSecond - viewportWidth / 2 + (right - left) / 2));
      }
    }
  };

  // ---- The floating measure bar ----------------------------------------------

  useMeasureKeys({
    enabled: selected === null && !zoom && editorTab === 'staff',
    count: measureCount,
    selection: measureRange,
    onSelection: selectBars,
    onOpen: openMeasure,
    onCopy: copyWithNotice,
    onPaste: pasteAfterRange,
    onDuplicate: duplicateRange,
    onDelete: deleteRange,
  });

  // Centred over the selected bars (clamped so the bar stays on screen), in
  // container space: the staff below the repeat lane starts at REP_H.
  const bounds = selectionBounds(measureRange);
  // The bar's rendered width (it varies with the label); 600 until measured.
  const [barWidth, setBarWidth] = useState(600);
  const measureBarRef = (el: HTMLDivElement | null) => {
    const w = el?.offsetWidth ?? 0;
    if (w > 0 && w !== barWidth) setBarWidth(w);
  };
  const barPos = bounds && !selected && !selDragging && !zoom ? (() => {
    const a = measureTimings[bounds[0]], b = measureTimings[bounds[1]];
    if (!a || !b) return null;
    const l = a.startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    const r = b.endVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    if (r < 0 || l > viewportWidth) return null;
    // Keep the whole bar inside the strip; too narrow to fit, pin it left.
    const half = barWidth / 2 + 8;
    const center = viewportWidth < barWidth + 16 ? half : Math.max(half, Math.min(viewportWidth - half, (l + r) / 2));
    return { left: center, top: Math.min(staffHeight - 44, REP_H + (staffHeight - REP_H) / 2 + 56) };
  })() : null;
  // The tempo the selected bars play at: their quarter notes over their seconds.
  const barBpm = (() => {
    if (!bounds) return null;
    const a = measureTimings[bounds[0]], b = measureTimings[bounds[1]];
    if (!a || !b) return null;
    const seconds = b.endVideoTimeSeconds - a.startVideoTimeSeconds;
    if (seconds <= 0) return null;
    let qn = 0;
    for (let i = bounds[0]; i <= bounds[1]; i++) {
      const t = tracked[i];
      if (t) qn += measureLengthInQN(t.timeSignature);
    }
    return (qn / seconds) * 60;
  })();
  const barLooping = !!bounds && !!loopedRange && loopedRange[0] === bounds[0] && loopedRange[1] === bounds[1];
  // The zoomed bar's tempo: barBpm's formula for that one bar.
  const zoomBpm = (() => {
    if (!zoom) return null;
    const t = measureTimings[zoom.measureIndex];
    const b = tracked[zoom.measureIndex];
    if (!t || !b) return null;
    const seconds = t.endVideoTimeSeconds - t.startVideoTimeSeconds;
    return seconds > 0 ? (measureLengthInQN(b.timeSignature) / seconds) * 60 : null;
  })();

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
              onClick={() => {
                setEditorTab(t.id);
                // The zoom lives over the staff strip; leaving it closes the zoom.
                if (t.id !== 'staff' && zoom) finishZoomClose();
              }}
              className={editorTab === t.id ? 'is-on' : ''}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="st-divline" />

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

        {activeTrack && <MidiRecordButton score={score} trackIndex={activeTrackIndex} targetMeasure={targetMeasureIndex} dispatch={dispatch} getCurrentSeconds={getCurrentSeconds} recordingSource={recordingSource} />}

        <button
          onClick={() => insertMeasureAt(rangeEnd !== null ? rangeEnd + 1 : measureCount)}
          className="st-chip ml-auto"
          disabled={!!gapProblems[rangeEnd !== null ? rangeEnd + 1 : measureCount]}
          title={gapProblems[rangeEnd !== null ? rangeEnd + 1 : measureCount]
            ?? (rangeEnd !== null ? `Add a measure after measure ${rangeEnd + 1}` : 'Add a measure at the end of the score')}
        >
          <Plus className="h-3.5 w-3.5" />
          Add measure
        </button>
        {notice && (
          <span role="status" className="basis-full text-xs text-destructive sm:basis-auto">
            {notice}
          </span>
        )}
      </div>

      {flash && (
        <p role="status" className="st-flash -mt-1.5 flex-shrink-0">
          {flash}
        </p>
      )}

      {/* Active view — the audio-aligned staff (or piano-roll). The staff fills
          the available height between the editor bar and the toolbar. */}
      {editorTab === 'staff' && (
        <>
          <div ref={staffWrapRef} className="relative min-h-0 flex-1">
            <EditableMeasureStrip
              measures={stripItems}
              spans={score.spans}
              getCurrentSeconds={getCurrentSeconds}
              pixelsPerSecond={pixelsPerSecond}
              scrollLeftPx={scrollLeftPx}
              selected={selected}
              selectedMeasures={selected ? [selected.measureIndex, selected.measureIndex] : rangeStart !== null && rangeEnd !== null ? [rangeStart, rangeEnd] : null}
              onSelectMeasure={selectMeasure}
              onSelectMeasureRange={selectMeasureRange}
              onOpenMeasure={openMeasure}
              onSelectionDragChange={setSelDragging}
              onGapClick={onGapClick}
              gapProblems={gapProblems}
              newBars={newBars}
              onRepeatBandClick={onRepeatBandClick}
              onSelectEvent={handleSelectEvent}
              onRequestZoomTo={handleRequestZoomTo}
              onSetPitch={handleSetPitch}
              accidental={pitchAcc}
              keyFifths={score.initialKeyFifths}
              isPercussion={percussion}
              percStrokes={percStrokes}
              onWheelZoom={(factor, anchorPx) => {
                const nextPps = Math.max(8, Math.min(600, pixelsPerSecond * factor));
                const anchorSeconds = (scrollLeftPx + anchorPx) / pixelsPerSecond;
                onRequestZoom(nextPps, Math.max(0, anchorSeconds * nextPps - anchorPx));
              }}
              onScrollByPx={onScrollByPx}
              height={staffHeight}
            />
            {barPos && bounds && (
              <MeasureBar
                ref={measureBarRef}
                left={barPos.left}
                top={barPos.top}
                label={rangeLabel}
                startSeconds={measureTimings[bounds[0]].startVideoTimeSeconds}
                bpm={barBpm}
                looping={barLooping}
                canLoop={!!onLoopMeasures}
                problems={{ dup: dupProblem, paste: pasteProblem, clear: null, del: deleteProblem }}
                onEdit={() => openMeasure(bounds[0])}
                onLoop={() => onLoopMeasures?.(bounds[0], bounds[1])}
                onRepeat={(anchor) => setRepeatPop({ anchor })}
                onDup={duplicateRange}
                onCopy={copyWithNotice}
                onPaste={pasteAfterRange}
                onBar={(anchor) => setBarPop({ anchor })}
                onClear={clearRange}
                onDelete={deleteRange}
              />
            )}
            {zoom && stripItems[zoom.measureIndex] && (
              <MeasureZoom
                items={stripItems}
                zoom={zoom}
                height={staffHeight}
                spans={score.spans}
                fill={stripItems[zoom.measureIndex].fill}
                bpm={zoomBpm}
                percussion={percussion}
                origin={zoomOrigin}
                closing={zoomClosing}
                onVoice={setZoomVoice}
                onNav={navZoom}
                onClose={finishZoomClose}
                onLayout={(l) => { zoomLayout.current = l; }}
              />
            )}
            {shortcutsOpen && !zoom && (
              <ShortcutsPopover
                anchor={{ left: Math.max(8, viewportWidth - 330), top: REP_H + 4 }}
                onClose={() => setShortcutsOpen(false)}
              />
            )}
            {repeatPop && !zoom && rangeStart !== null && rangeEnd !== null && (
              <RepeatPopover
                anchor={repeatPop.anchor}
                range={[rangeStart, rangeEnd]}
                group={repeatGroupAtRange ? { id: repeatGroupAtRange.id, count: repeatGroupAtRange.count } : null}
                problemFor={(n) => repeatGroupAtRange
                  ? structuralEditProblem(score, { type: 'set-repeat-count', trackIndex: activeTrackIndex, id: repeatGroupAtRange.id, count: n })
                  : structuralEditProblem(score, { type: 'repeat-measures', trackIndex: activeTrackIndex, start: rangeStart, end: rangeEnd, count: n, id: 'probe' })}
                onPick={(n) => {
                  if (repeatGroupAtRange) {
                    dispatch({ type: 'set-repeat-count', trackIndex: activeTrackIndex, id: repeatGroupAtRange.id, count: n });
                  } else {
                    dispatch({ type: 'repeat-measures', trackIndex: activeTrackIndex, start: rangeStart, end: rangeEnd, count: n, id: crypto.randomUUID() });
                  }
                  setRepeatPop(null);
                }}
                onRemove={() => {
                  if (repeatGroupAtRange) dispatch({ type: 'unlink-repeat', trackIndex: activeTrackIndex, id: repeatGroupAtRange.id });
                  setRepeatPop(null);
                }}
                onSelectPassOne={() => {
                  // Stays open: the menu's own action, not a new selection in the strip.
                  if (!repeatGroupAtRange) return;
                  setSelected(null);
                  pendingBars.current = null;
                  setMeasureRange(dragSelect(repeatGroupAtRange.start, repeatGroupAtRange.start + repeatGroupAtRange.length - 1));
                }}
                onClose={() => setRepeatPop(null)}
              />
            )}
            {gapPop && !zoom && activeTrack && (
              <GapMenu
                anchor={gapPop.anchor}
                gap={gapPop.gap}
                measureCount={measureCount}
                clipCount={clipboard ? clipboard.measures.length : null}
                problems={{
                  empty: gapProblems[gapPop.gap] ?? null,
                  copy: gapPop.gap > 0
                    ? structuralEditProblem(score, {
                        type: 'paste-measures',
                        trackIndex: activeTrackIndex,
                        index: gapPop.gap,
                        clip: {
                          measures: [stripCopyTags(activeTrack.measures[gapPop.gap - 1])],
                          context: contextAt(score, activeTrack, gapPop.gap - 1),
                          instrument: activeTrack.instrument,
                        },
                      })
                    : null,
                  paste: clipboard
                    ? structuralEditProblem(score, { type: 'paste-measures', trackIndex: activeTrackIndex, index: gapPop.gap, clip: clipboard })
                    : null,
                }}
                onEmpty={() => gapEmpty(gapPop.gap)}
                onCopyLeft={() => gapCopyLeft(gapPop.gap)}
                onPaste={() => gapPaste(gapPop.gap)}
                onClose={() => setGapPop(null)}
              />
            )}
            {barPop && !zoom && activeTrack && rangeStart !== null && barPopCurrent && (
              <BarPopover
                anchor={barPop.anchor}
                measureIndex={rangeStart}
                measureNumber={activeTrack.measures[rangeStart].number}
                percussion={percussion}
                current={barPopCurrent}
                onPatch={(p) => dispatch({ type: 'set-measure-props', trackIndex: activeTrackIndex, measureIndex: rangeStart, props: p })}
                onFinal={(final) => dispatch({ type: 'set-measure-final-bar', trackIndex: activeTrackIndex, measureIndex: rangeStart, final })}
                onClose={() => setBarPop(null)}
              />
            )}
          </div>
          {!zoom && <div className="st-strip-foot">
            {issues.length > 0 && (
              <button type="button" className={`st-issue-chip${anyOver ? ' is-bad' : ''}`} onClick={nextIssue} title="Jump to the next bar that doesn’t add up">
                {issues.length === 1 ? '1 bar doesn’t add up' : `${issues.length} bars don’t add up`} · {issues.slice(0, 3).map((i) => `m.${stripItems[i].measureNumber}`).join(', ')}{issues.length > 3 ? '…' : ''} ▾
              </button>
            )}
            <span className="truncate">
              {measureRange
                ? '⏎ zoom in · ⌘D duplicate · ⌫ delete · esc deselect'
                : 'Drag across bars to select · double-click a bar to zoom in · scroll to zoom'}
            </span>
            <button
              type="button"
              className="ml-auto grid h-6 w-6 place-items-center rounded-full border border-border text-[11px]"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              aria-expanded={shortcutsOpen}
              onPointerDown={() => { shortcutsWasOpen.current = shortcutsOpen; }}
              onClick={() => {
                setShortcutsOpen(!shortcutsWasOpen.current);
                shortcutsWasOpen.current = false;
              }}
            >
              ?
            </button>
          </div>}
        </>
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
        <span className="k">Del</span> remove · <span className="k">⇧click / ⇧←/→</span> select bars ·{' '}
        <span className="k">⌘C/⌘V</span> copy bars.
      </p>
    </div>
  );
});

/** Compact beat count: whole numbers show plain, fractions to one decimal. */
function formatBeats(beats: number): string {
  return Number.isInteger(beats) ? String(beats) : beats.toFixed(1);
}

// Moved to lib/playsense-studio/typing-target.ts (the measure keys hook needs
// it without importing this file); re-exported for existing importers.
export { isTypingTarget };
