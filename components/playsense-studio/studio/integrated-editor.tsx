'use client';

// PlaySense Studio — integrated editor under the waveform.
//
// Lives in the same vertical slot the old MeasureStrip occupied. Renders a
// compact track bar + view tabs + the active view:
//   • Staff (default, main): the audio-aligned EditableMeasureStrip — click a
//     bar to select it (drag or ⇧-click for several); a double-click, ⏎, or a
//     click on one of its notes opens it in the measure zoom, which is where
//     all note entry and editing (pitch, duration, modifiers, voice 2, the
//     pencil) now happens. Clicks in the strip itself never add or change
//     notes. A measure bar floats over the selected bars with every bar-level
//     action; useMeasureKeys holds their keys.
//   • Piano-roll: the existing PianoRollView (not audio-aligned), with its
//     own duration state and note entry.
//
// Owns the editor view state (selected event, active track, active view, the
// measure zoom). Score itself lives in the parent via useEditor; this just
// dispatches edits. Markers + waveform live in SyncPanel and are not touched
// here — note edits don't change `structuralSignature`, so the markers above stay
// put while you edit pitches/durations.

import { ChevronDown, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch } from 'react';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { getPercStrokes, isPercussion, resolvePercStroke } from '@/lib/playsense-studio/perc-strokes';
import { pitchName } from '@/lib/playsense-studio/pitch';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';
import { fillIssues, measureFill, type MeasureFill } from '@/lib/playsense-studio/measure-fill';
import { eventDots, eventTuplet } from '@/components/playsense-studio/shared/score-model/accessors';
import { writtenValue, type NoteValue } from '@/lib/playsense-studio/rhythm';
import { cursorRange, type NoteCursor } from '@/lib/playsense-studio/note-cursor';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type {
  Instrument,
  Measure,
  MusicalEvent,
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
import { QuantizePopover } from './measure/quantize-popover';
import { MeasureBar } from './measure/measure-bar';
import { ShortcutsPopover } from './measure/shortcuts-popover';
import { useMeasureKeys } from './measure/use-measure-keys';
import type { PopoverAnchor } from './measure/popover';
import { tempoAt } from '@/lib/playsense-studio/tempo-marks';
import { REP_H, type RepeatBand } from './measure/repeat-lane';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { PianoRollView } from './piano-roll-view';
import { MidiRecordButton, type MidiRecordingSource } from './midi-record-button';
import { MeasureZoom, type ZoomState } from './zoom/measure-zoom';
import { useZoomEditing } from './zoom/use-zoom-editing';
import type { ZoomLayout } from './zoom/zoom-staff';
import { clampNoteToolbarPosition, NoteToolbar, NOTE_TOOLBAR_WIDTH_FALLBACK, type NoteToolbarPercussion } from './zoom/note-toolbar';
import { MorePopover, type MoreTab } from './zoom/more-popover';
import type { NoteTimingProps } from './note-details';

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
  /** Why this bar's timing looks off the recording, if it does (Task 5). */
  flag?: string | null;
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
  /** The selected note's timing against the sync grid (video-synced lessons
   *  only) — the same object SyncPanel builds for its NoteDetails inspector,
   *  threaded down to the zoom's More ▾ → Timing tab. */
  noteTiming?: NoteTimingProps;
  /** Quantize (Task 7 of Plan 4b): a live preview for bars [start, end] at a
   *  candidate strength (0–100), without writing anything. Omitted (no video
   *  to quantize against) hides the measure bar's Quantize button entirely. */
  onQuantizePlan?: (start: number, end: number, strength: number) => { moved: number; largestMs: number };
  /** Commits a Quantize plan at `strength` to the selected bars' flex. */
  onQuantizeApply?: (start: number, end: number, strength: number) => void;
  /** Removes any flex whose points land inside bars [start, end]. */
  onResetFlex?: (start: number, end: number) => void;
  /** "flexed ±<m> ms" for bars [start, end], or null when none of them carry
   *  flex — shown as an info suffix on the measure bar. */
  flexInfo?: (start: number, end: number) => string | null;
  /** Why Quantize can't run right now (e.g. no hits yet); null when it can. */
  quantizeProblem?: string | null;
  /** Reports whether the measure zoom is open (it uses letter keys, e.g. F,
   *  that SyncPanel binds only while it is closed). Pass a stable callback. */
  onZoomOpenChange?: (open: boolean) => void;
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
  noteTiming,
  onQuantizePlan,
  onQuantizeApply,
  onResetFlex,
  flexInfo,
  quantizeProblem,
  onZoomOpenChange,
}: IntegratedEditorProps) {
  // Single-track studio: the score model still holds Track[], but the editor
  // always authors track 0.
  const activeTrackIndex = 0;
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');
  const [selected, setSelected] = useState<SelectedEventRef | null>(null);
  // Contiguous measure selection: anchor = where it started, focus = the end
  // being moved (Shift+click / Shift+arrows). The measure bar's actions act on
  // the whole range; "target" semantics (MIDI record) follow the focus.
  const [measureRange, setMeasureRange] = useState<MeasureSelection | null>(null);
  const [rangeStart, rangeEnd] = selectionBounds(measureRange) ?? [null, null];
  const rangeCount = rangeStart !== null && rangeEnd !== null ? rangeEnd - rangeStart + 1 : 0;
  // The measure menus, each anchored over the strip wrapper (position: relative):
  // the repeat lane's / Repeat ▾ menu, the gap "+" menu (empty bar / copy of the
  // bar before / paste) and the Bar ▾ menu (meter/key/clef/barlines/endings/tempo).
  const [repeatPop, setRepeatPop] = useState<{ anchor: PopoverAnchor } | null>(null);
  const [gapPop, setGapPop] = useState<{ gap: number; anchor: PopoverAnchor } | null>(null);
  const [barPop, setBarPop] = useState<{ anchor: PopoverAnchor } | null>(null);
  const [quantizePop, setQuantizePop] = useState<{ anchor: PopoverAnchor } | null>(null);
  // The note toolbar's "More ▾" popover — just an open flag (fix round 1:
  // its position is recomputed every render from the toolbar's current,
  // measured position below, not stored) — and the last tab picked
  // (remembered across opens/closes, reset only on unmount).
  const [morePop, setMorePop] = useState(false);
  const [moreTab, setMoreTab] = useState<MoreTab>('durations');
  // The measure zoom (one bar drawn large over the strip), or null when closed.
  // `zoomOrigin` is the bar's rect in the strip for the enter/exit animation;
  // `zoomClosing` asks the zoom to play its exit and then call back to close.
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<{ left: number; width: number } | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  // The zoomed bar's note layout (hits, beat span, line math) — a stash for
  // other zoom work; the note toolbar below reads MeasureZoom's own (reactive)
  // layout instead, since a ref write here doesn't request a re-render.
  const zoomLayout = useRef<ZoomLayout | null>(null);
  // A menu belongs to the bars it opened on: every key or click that changes
  // the bar selection closes whichever menu is open.
  const closeMenus = useCallback(() => {
    setRepeatPop(null);
    setGapPop(null);
    setBarPop(null);
    setQuantizePop(null);
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

  // The staff grows to fill the space below the editor bar — measure the
  // wrapper and feed its height to the strip (min keeps it usable).
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

  // The MIDI record target measure: the selected event's measure, else the last.
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

  // A press on a note in the zoom moves its cursor there.
  const setZoomCursor = useCallback((cursor: NoteCursor) => {
    setZoom((z) => (z ? { ...z, cursor } : z));
  }, []);

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
    setMorePop(false);
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
  const zoomEditing = useZoomEditing({
    score, dispatch, trackIndex: activeTrackIndex, zoom, setZoom,
    keyFifthsAt: zoomKeyFifthsAt, clefAt: zoomClefAt, barQNAt: zoomBarQNAt,
    percussion, flash: showFlash, openBar, close: closeZoom,
  });

  // Tell the parent when the zoom opens or closes (and that it's closed on unmount).
  const zoomOpen = zoom !== null;
  useEffect(() => {
    if (!onZoomOpenChange) return;
    onZoomOpenChange(zoomOpen);
    return () => onZoomOpenChange(false);
  }, [zoomOpen, onZoomOpenChange]);

  // A zoomed bar that no longer exists (undo, a delete elsewhere) closes the zoom.
  if (zoom && zoom.measureIndex >= measureCount) {
    setZoom(null);
    setZoomClosing(false);
  }

  // ---- The floating note toolbar (Task 8) ------------------------------------

  // The event at the zoom cursor — null at 'end', or when the cursor sits on a
  // voice with nothing there. Drives the toolbar's info chip and its on/off
  // buttons; read directly off the score (not through `editing`, whose ref
  // only catches up with this render's props in a layout effect).
  const zoomCurrentEvent: MusicalEvent | null = useMemo(() => {
    if (!zoom) return null;
    const c = zoom.cursor;
    if (c.index === 'end') return null;
    return activeTrack?.measures[c.measureIndex]?.voices[c.voice]?.events[c.index] ?? null;
  }, [zoom, activeTrack]);

  const zoomHasSelection = useMemo(() => {
    if (!zoom) return false;
    const events = zoomEvents(zoom.cursor.measureIndex, zoom.cursor.voice);
    return cursorRange(zoom.cursor, events.length).some((i) => i >= 0 && i < events.length);
  }, [zoom, zoomEvents]);

  // Identifies the note at the zoom cursor for the More ▾ → Text tab (fix
  // round 1): two different notes can share the same text (including both
  // empty), so re-seeding the field on the text value alone let a typed but
  // uncommitted value survive a cursor move onto the wrong note.
  const zoomEventKey: string | null = zoom
    ? `${zoom.cursor.measureIndex}:${zoom.cursor.voice}:${zoom.cursor.index}`
    : null;

  // Duration/dots shown reflect the selected note when there is one, else the
  // pending value/dots the zoom will write next (ZoomState.value/dots).
  const zoomValue: NoteValue = zoomCurrentEvent ? writtenValue(zoomCurrentEvent) ?? zoom?.value ?? 'q' : zoom?.value ?? 'q';
  const zoomDots: 0 | 1 | 2 = zoomCurrentEvent ? eventDots(zoomCurrentEvent) : zoom?.dots ?? 0;
  const zoomTupletHere = zoomCurrentEvent ? eventTuplet(zoomCurrentEvent) : null;

  const zoomToolbarPercussion: NoteToolbarPercussion | null = useMemo(() => {
    if (!percussion || !percStrokes || !activeTrack) return null;
    const pitch = zoomCurrentEvent?.kind === 'chord' ? zoomCurrentEvent.notes[0]
      : zoomCurrentEvent?.kind === 'note' ? zoomCurrentEvent : undefined;
    return {
      strokes: percStrokes.map((s) => ({ midi: s.midi, label: s.label })),
      current: pitch ? resolvePercStroke(activeTrack.instrument, pitch)?.midi ?? null : null,
    };
  }, [percussion, percStrokes, activeTrack, zoomCurrentEvent]);

  const zoomInfo = (() => {
    if (!zoom) return '';
    if (!zoomCurrentEvent) return 'add';
    if (zoomCurrentEvent.kind === 'rest') return 'rest';
    const key = zoomKeyFifthsAt(zoom.cursor.measureIndex);
    if (zoomCurrentEvent.kind === 'chord') {
      return zoomCurrentEvent.notes.map((n) => pitchName(n.midi, n.spelling, key)).join(' ');
    }
    return pitchName(zoomCurrentEvent.midi, zoomCurrentEvent.spelling, key);
  })();

  // Anchored under the cursor's note box (or just after the last note at
  // 'end'); clamped into the center column/row against the toolbar's own
  // measured size below (fix round 1 — a percussion track's stroke row can
  // run wide, or wrap tall, well past the 520 fallback).
  const noteToolbarAnchor = useCallback((layout: ZoomLayout | null) => {
    if (!zoom || !layout) return null;
    const c = zoom.cursor;
    let x: number;
    let hitBottom: number;
    if (c.index !== 'end') {
      const hit = layout.hits.find((h) => h.voice === c.voice && h.eventIndex === c.index);
      if (!hit) return null;
      x = hit.x + hit.w / 2;
      hitBottom = hit.y + hit.h;
    } else {
      x = layout.noteEndX;
      const voiceHits = layout.hits.filter((h) => h.voice === c.voice);
      const last = voiceHits[voiceHits.length - 1];
      hitBottom = last ? last.y + last.h : layout.yForLine(2);
    }
    return { x, top: hitBottom + 14 };
  }, [zoom]);

  // The toolbar's real rendered size, so it can be clamped against its own
  // footprint instead of a guess — the measure bar's `measureBarRef`/
  // `barWidth` pattern, on both axes. `w` starts at the pre-paint fallback;
  // `h` starts at 0 (unclamped) since there's no equivalent guess for height.
  const [noteToolbarSize, setNoteToolbarSize] = useState({ w: NOTE_TOOLBAR_WIDTH_FALLBACK, h: 0 });
  const noteToolbarRef = (el: HTMLDivElement | null) => {
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    if (w > 0 && (w !== noteToolbarSize.w || h !== noteToolbarSize.h)) setNoteToolbarSize({ w, h });
  };

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
    onLoop: onLoopMeasures,
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
          the available height below the editor bar. */}
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
              onOpenNote={openMeasure}
              onRequestZoomTo={handleRequestZoomTo}
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
                flag={measureTimings.slice(bounds[0], bounds[1] + 1).find((t) => t.flag)?.flag ?? null}
                flexInfo={flexInfo?.(bounds[0], bounds[1]) ?? null}
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
                onQuantize={onQuantizePlan ? (anchor) => setQuantizePop({ anchor }) : undefined}
                quantizeProblem={quantizeProblem}
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
                editing={zoomEditing}
                dispatch={dispatch}
                onCursor={setZoomCursor}
                clef={zoomClefAt(zoom.measureIndex)}
                keyFifths={zoomKeyFifthsAt(zoom.measureIndex)}
                percStrokes={percStrokes}
              >
                {({ centerW, bodyH, layout }) => {
                  const anchor = noteToolbarAnchor(layout);
                  if (!anchor) return null;
                  const pos = clampNoteToolbarPosition(anchor.x, anchor.top, noteToolbarSize, { centerW, bodyH });
                  const maxWidth = centerW > 0 ? Math.max(0, centerW - 16) : undefined;
                  return (
                    <>
                      <NoteToolbar
                        ref={noteToolbarRef}
                        left={pos.left}
                        top={pos.top}
                        maxWidth={maxWidth}
                        info={zoomInfo}
                        value={zoomValue}
                        dots={zoomDots}
                        isRest={zoomCurrentEvent?.kind === 'rest'}
                        tie={!!zoomCurrentEvent && zoomCurrentEvent.kind !== 'rest' && !!zoomCurrentEvent.tieToNext}
                        tripletOn={!!zoomTupletHere && zoomTupletHere.n === 3 && zoomTupletHere.m === 2}
                        hasSelection={zoomHasSelection}
                        percussion={zoomToolbarPercussion}
                        editing={zoomEditing}
                        onMore={() => setMorePop(true)}
                        pencil={zoom.pencil}
                        onPencil={() => setZoom({ ...zoom, pencil: !zoom.pencil })}
                      />
                      {morePop && (
                        <MorePopover
                          anchor={{ left: pos.left, top: pos.top + noteToolbarSize.h }}
                          tab={moreTab}
                          onTab={setMoreTab}
                          onClose={() => setMorePop(false)}
                          event={zoomCurrentEvent}
                          editing={zoomEditing}
                          timing={noteTiming}
                          watchLike={!!noteTiming}
                          eventKey={zoomEventKey}
                          voice={zoom.cursor.voice}
                        />
                      )}
                    </>
                  );
                }}
              </MeasureZoom>
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
            {quantizePop && !zoom && rangeStart !== null && rangeEnd !== null && onQuantizePlan && (
              <QuantizePopover
                anchor={quantizePop.anchor}
                plan={(strength) => onQuantizePlan(rangeStart, rangeEnd, strength)}
                onApply={(strength) => {
                  onQuantizeApply?.(rangeStart, rangeEnd, strength);
                  setQuantizePop(null);
                }}
                onReset={() => onResetFlex?.(rangeStart, rangeEnd)}
                onClose={() => setQuantizePop(null)}
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
                ? '⏎ edit notes · ⌘D duplicate · ⌫ delete · esc deselect'
                : 'Drag across bars to select · double-click a bar to edit its notes · scroll to zoom'}
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
    </div>
  );
});

// Moved to lib/playsense-studio/typing-target.ts (the measure keys hook needs
// it without importing this file); re-exported for existing importers.
export { isTypingTarget };
