'use client';

// PlaySense Studio — editable notation strip beneath the waveform.
//
// The notation is one continuous VexFlow staff (ContinuousStaff) across the
// visible range, each bar drawn at its audio span (startX..endX derived from
// the markers), so slurs, hairpins and ties cross barlines. Above it, each
// measure keeps a transparent absolutely positioned block for selection, hits,
// its header band and gap fill.
//
// Gestures select; they never change notes. A click on a bar (its header band
// or empty staff) selects that bar, ⇧-click extends the selection from its
// anchor, and a drag across bars selects every bar the pointer passes over
// (auto-scrolling near either edge). A double-click opens the bar. Clicking a
// note selects the note; dragging a note vertically still changes its pitch
// until the measure zoom takes that over. Moving bars in time lives on the
// waveform's number chips, not here. Below ~46 px wide a measure becomes a
// placeholder that selects on click and opens on double-click.
//
// Hit-testing: after VexFlow lays out the notes, each note's getBoundingBox()
// is captured inside the same try block as the bar's draw and reported up to
// the strip via onHitsReady, bar-local in x. The strip keeps these in a ref Map keyed by
// measureIndex and consults it on pointer events. The selection highlight is a
// separate absolute <div> overlay (pointer-events:none) that reads from the
// Map on each render, so it tracks the right note across marker drags + zoom.
//
// Coordinates: the strip reserves REP_H (the repeat lane's height) at the top.
// Measure blocks, placeholders and the staff are pushed down to `top: REP_H`
// with `height: height - REP_H`, so anything nested inside a measure block
// (the header band, the gapfill) is already in the right place — it inherits
// the shift from its positioned ancestor. Overlays drawn at the CONTAINER
// level instead (the selection highlight, the drag chip, the gap "+"
// buttons) read raw note bboxes and video-time-derived x's that don't know
// about the lane, so each must add REP_H itself, exactly once, when it turns
// a staff-local y into a container-space one. Task 14 follows this rule too.

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { beatsText, fillTitle, type MeasureFill } from '@/lib/playsense-studio/measure-fill';
import {
  diatonicToMidi,
  midiToDiatonic,
  type NotationClef,
  type VexEventDescriptor,
} from '@/lib/playsense-studio/score-to-vexflow';
import type { PercStroke } from '@/lib/playsense-studio/perc-strokes';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import { measureAtX } from '@/lib/playsense-studio/measure-selection';
import { REP_H, RepeatLane, repeatBands, type RepeatBand } from './measure/repeat-lane';
import type { PopoverAnchor } from './measure/popover';
import { ContinuousStaff, MIN_RENDER_WIDTH } from './continuous-staff';

export interface MeasureStripItem {
  /** 0-based index into the score track's measures (NOT the 1-based measureNumber). */
  measureIndex: number;
  measureNumber: number;
  /** The measure's repeat membership, when it is one written-out pass of a group. */
  repeatPass?: { id: string; pass: number; count: number; offset: number; length: number };
  /** Close this measure with a final (thin–thick) bar. */
  finalBarline?: boolean;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
  events: VexEventDescriptor[];
  /** Second voice, display-only — never hit-tested, selected or graded. */
  voice2Events: VexEventDescriptor[];
  timeSignature: [number, number];
  isFirst: boolean;
  clef: NotationClef;
  /** Key signature for this measure (fifths), and whether it/the clef changed from the previous measure. */
  keyFifths: number;
  /** The key in force before this measure (equals keyFifths when unchanged). */
  previousKeyFifths: number;
  keyChanged: boolean;
  clefChanged: boolean;
  /** How full this bar is, keyed on the track's own events (voice 1 only counted for grading). */
  fill: MeasureFill;
}

export interface SelectedEventRef {
  measureIndex: number;
  eventIndex: number;
}

/** A voice-1 note's box: x bar-local (0 at the bar's start), y staff-local
 *  (0 at the top of the staff, which sits at container y = REP_H). */
export interface MeasureHit {
  eventIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditableMeasureStripProps {
  measures: MeasureStripItem[];
  /** Slurs and hairpins (ScoreDocument.spans), drawn across barlines on the
   *  continuous staff. */
  spans?: Span[];
  /** Live playback position (video seconds) for the playhead; omit to hide it. */
  getCurrentSeconds?: () => number;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  selected: SelectedEventRef | null;
  /** Highlighted measure range [start, end] (inclusive indices), or null. */
  selectedMeasures?: [number, number] | null;
  /** Click selects one bar; Shift+click (extend = true) grows the range to it. */
  onSelectMeasure?: (measureIndex: number, extend: boolean) => void;
  /** A drag across bars: select from the bar it started on to the bar under the pointer. */
  onSelectMeasureRange: (anchor: number, focus: number) => void;
  /** Double-click opens a bar. */
  onOpenMeasure: (index: number) => void;
  /** A drag across bars started (true, once the pointer passes the drag
   *  threshold) or ended (false). A plain click never reports. */
  onSelectionDragChange?: (dragging: boolean) => void;
  /** Open the "+" menu (empty / copy of the bar before / paste) at this barline
   *  gap (0 = before the first bar, n = after the last). */
  onGapClick?: (gap: number, anchor: PopoverAnchor) => void;
  /** Per gap (n + 1 entries): why a bar cannot be inserted there, or null. */
  gapProblems?: Array<string | null>;
  /** Measure indices to flash (just inserted by the gap menu): adds `is-new`. */
  newBars?: Set<number>;
  /** A repeat-lane band was clicked: open the repeat menu at this anchor. */
  onRepeatBandClick?: (band: RepeatBand, anchor: PopoverAnchor) => void;
  onSelectEvent: (ref: SelectedEventRef) => void;
  onRequestZoomTo: (measureIndex: number) => void;
  /** Commit a pitch change after a drag (or click-drag) on a note. */
  onSetPitch: (ref: SelectedEventRef, midi: number) => void;
  /** Toolbar accidental (-1/0/+1), applied to staff drag for pitched tracks. */
  accidental: number;
  /** Key signature for spelling (fifths). */
  keyFifths: number;
  /** True when the active track is percussion (drag snaps to stroke lines). */
  isPercussion: boolean;
  /** Stroke palette for the active percussion track (null for pitched). */
  percStrokes: PercStroke[] | null;
  /** Horizontal wheel/trackpad pan over the staff (shared timeline scroll). */
  onScrollByPx?: (dx: number) => void;
  onWheelZoom?: (factor: number, anchorPx: number) => void;
  height?: number;
}

const DEFAULT_HEIGHT = 220;
/** Height of the header band (measure number, capacity) at the top of each measure block. */
const HANDLE_BAND_PX = 28;
/** Pixels per diatonic staff step (half of VexFlow's 10px line spacing). */
const STEP_PX = 5;
/** A press must travel this far vertically before a pitch drag starts, so a
 *  slightly-wobbly click never transposes the note. */
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  measureIndex: number;
  eventIndex: number;
  originalMidi: number;
  currentMidi: number;
  /** Container-space Y of the POINTER at pointerdown — deltas are measured from
   *  the grab point, not the glyph center, so a click can't jump the pitch. */
  startY: number;
  pointerId: number;
  moved: boolean;
}

/** A press on a bar that may become a drag across bars (container-space x). */
interface SelectionDrag {
  pointerId: number;
  anchor: number;
  x: number;
  /** Press point (client space); nothing tracks or scrolls until the pointer leaves it. */
  startX: number;
  startY: number;
  /** The pointer has travelled past DRAG_THRESHOLD_PX: a real drag, captured. */
  moved: boolean;
}

/** Near either edge of the strip, a selection drag scrolls the timeline. */
const AUTO_SCROLL_EDGE_PX = 30;
const AUTO_SCROLL_STEP_PX = 12;

export function EditableMeasureStrip({
  measures,
  spans: scoreSpans,
  getCurrentSeconds,
  pixelsPerSecond,
  scrollLeftPx,
  selected,
  selectedMeasures = null,
  onSelectMeasure,
  onGapClick,
  gapProblems,
  newBars,
  onRepeatBandClick,
  onSelectMeasureRange,
  onOpenMeasure,
  onSelectionDragChange,
  onSelectEvent,
  onSetPitch,
  accidental,
  keyFifths,
  isPercussion,
  percStrokes,
  onScrollByPx,
  onWheelZoom,
  height = DEFAULT_HEIGHT,
}: EditableMeasureStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const selDrag = useRef<SelectionDrag | null>(null);
  // Which note the cursor is over (cursor feedback only) — state for the CSS
  // cursor, mirrored in a ref so pointermove only re-renders on identity change.
  const [hovered, setHovered] = useState<{ measureIndex: number; eventIndex: number } | null>(null);
  const hoveredRef = useRef(hovered);
  const setHover = (next: { measureIndex: number; eventIndex: number } | null) => {
    const prev = hoveredRef.current;
    if (
      (prev === null) !== (next === null) ||
      (prev && next && (prev.measureIndex !== next.measureIndex || prev.eventIndex !== next.eventIndex))
    ) {
      hoveredRef.current = next;
      setHovered(next);
    }
  };

  // Captured bboxes per measureIndex, refreshed by ContinuousStaff on each draw.
  // A version counter forces the overlay to re-render after bboxes update.
  const hitsByMeasure = useRef<Map<number, MeasureHit[]>>(new Map());
  const [bboxVersion, setBboxVersion] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const videoTimeToX = (t: number) => t * pixelsPerSecond - scrollLeftPx;
  const inRange = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex >= selectedMeasures[0] && measureIndex <= selectedMeasures[1];
  const isFocus = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex === selectedMeasures[1];
  // One band per repeat pass, drawn in the lane reserved at the strip's top.
  const bands = repeatBands(measures, videoTimeToX);

  // Playhead — a thin --primary line matching the waveform's, positioned
  // imperatively on a RAF loop so 60fps playback never re-renders this strip.
  // pps/scroll change only on zoom/scroll, so restarting on those is cheap; the
  // getter reads the live clock each frame (same pattern as the waveform).
  const playheadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!getCurrentSeconds) return;
    let raf = 0;
    const draw = () => {
      const el = playheadRef.current;
      const container = containerRef.current;
      if (el && container) {
        const w = container.clientWidth;
        const x = getCurrentSeconds() * pixelsPerSecond - scrollLeftPx;
        if (x >= -1 && x <= w + 1) {
          el.style.visibility = 'visible';
          el.style.transform = `translateX(${x}px)`;
        } else {
          el.style.visibility = 'hidden';
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentSeconds, pixelsPerSecond, scrollLeftPx]);

  // Horizontal gestures pan; vertical gestures zoom around the pointer.
  // Use a non-passive listener so the page does not scroll while zooming.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Horizontal intent: trackpad x-deltas, or shift+wheel (Chrome/Safari remap
      // shift+wheel to deltaX; Firefox keeps deltaY with shiftKey set).
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal) {
        if (!onWheelZoom || e.deltaY === 0) return;
        e.preventDefault();
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
        onWheelZoom(Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003), e.clientX - el.getBoundingClientRect().left);
        return;
      }
      if (!onScrollByPx) return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      onScrollByPx(dx);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onScrollByPx, onWheelZoom]);

  // ---- Bar selection by drag ------------------------------------------------
  // A press on a bar's header or empty staff selects it; while the button is
  // held, a rAF loop tracks the bar under the pointer (auto-scrolling near the
  // edges) and grows the selection from the anchor. Nothing tracks, scrolls or
  // captures the pointer until it has moved past DRAG_THRESHOLD_PX, so a click
  // near an edge stays a click and click/dblclick still reach the bar. The loop
  // reads the latest props through refs, since scrolling re-renders while it runs.
  const containerX = (e: { clientX: number }) => {
    const container = containerRef.current;
    if (!container) return 0;
    return e.clientX - container.getBoundingClientRect().left;
  };
  const live = useRef({ measures, pixelsPerSecond, scrollLeftPx, viewportWidth, onScrollByPx, onSelectMeasureRange });
  useEffect(() => {
    live.current = { measures, pixelsPerSecond, scrollLeftPx, viewportWidth, onScrollByPx, onSelectMeasureRange };
  });
  const selRaf = useRef(0);
  // Window listeners that end a press released outside the strip — before a
  // drag captures the pointer, the container never hears that pointerup.
  const selWindowOff = useRef<(() => void) | null>(null);
  const stopSelectionLoop = () => {
    if (selRaf.current) cancelAnimationFrame(selRaf.current);
    selRaf.current = 0;
    selWindowOff.current?.();
    selWindowOff.current = null;
  };
  useEffect(() => stopSelectionLoop, []);

  const startSelectionDrag = (e: React.PointerEvent, measureIndex: number) => {
    selDrag.current = {
      pointerId: e.pointerId,
      anchor: measureIndex,
      x: containerX(e),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    stopSelectionLoop();
    const onWindowEnd = (ev: PointerEvent) => endSelectionDrag(ev);
    window.addEventListener('pointerup', onWindowEnd);
    window.addEventListener('pointercancel', onWindowEnd);
    selWindowOff.current = () => {
      window.removeEventListener('pointerup', onWindowEnd);
      window.removeEventListener('pointercancel', onWindowEnd);
    };
    let last = measureIndex;
    const tick = () => {
      const drag = selDrag.current;
      if (!drag) return;
      if (!drag.moved) {
        selRaf.current = requestAnimationFrame(tick);
        return;
      }
      const { measures: ms, pixelsPerSecond: pps, scrollLeftPx: scroll, viewportWidth: w } = live.current;
      if (drag.x < AUTO_SCROLL_EDGE_PX) live.current.onScrollByPx?.(-AUTO_SCROLL_STEP_PX);
      else if (drag.x > w - AUTO_SCROLL_EDGE_PX) live.current.onScrollByPx?.(AUTO_SCROLL_STEP_PX);
      const bars = ms.map((m) => ({
        left: m.startVideoTimeSeconds * pps - scroll,
        right: m.endVideoTimeSeconds * pps - scroll,
      }));
      const i = measureAtX(drag.x, bars);
      const index = i === null ? null : ms[i].measureIndex;
      if (index !== null && index !== last) {
        last = index;
        live.current.onSelectMeasureRange(drag.anchor, index);
      }
      selRaf.current = requestAnimationFrame(tick);
    };
    selRaf.current = requestAnimationFrame(tick);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    const drag = selDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.x = containerX(e);
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      onSelectionDragChange?.(true);
      // Capture only now, so a plain click or double-click keeps its target bar.
      try {
        containerRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  };

  // Double-click opens the bar under the pointer. Handled on the container
  // because a captured pointer retargets click/dblclick away from the bar.
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('button')) return; // placeholders open themselves; "+" never opens
    const el = target.closest('[data-measure-index]');
    let index = el ? Number(el.getAttribute('data-measure-index')) : null;
    if (index === null || Number.isNaN(index)) {
      const x = containerX(e);
      const i = measureAtX(x, measures.map((m) => ({ left: videoTimeToX(m.startVideoTimeSeconds), right: videoTimeToX(m.endVideoTimeSeconds) })));
      index = i === null ? null : measures[i].measureIndex;
    }
    if (index !== null) onOpenMeasure(index);
  };

  const endSelectionDrag = (e: { pointerId: number }) => {
    const drag = selDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    stopSelectionLoop();
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    selDrag.current = null;
    if (drag.moved) onSelectionDragChange?.(false);
  };

  const handleHitsReady = useCallback((measureIndex: number, hits: MeasureHit[] | null) => {
    if (hits === null) hitsByMeasure.current.delete(measureIndex);
    else hitsByMeasure.current.set(measureIndex, hits);
    setBboxVersion((v) => v + 1);
  }, []);

  // Map a cursor Y (container space) to a target MIDI, given the drag's grab point.
  const dragTargetMidi = useCallback(
    (drag: DragState, cursorY: number): number => {
      const deltaSteps = Math.round((drag.startY - cursorY) / STEP_PX);
      if (deltaSteps === 0) return drag.originalMidi;
      if (isPercussion && percStrokes && percStrokes.length > 0) {
        const anchorDia = keyToDiatonic(
          percStrokes.find((s) => s.midi === drag.originalMidi)?.staffLine ?? 'c/5'
        );
        const targetDia = anchorDia + deltaSteps;
        const original = percStrokes.find(s => s.midi === drag.originalMidi);
        let best = original ?? percStrokes[0];
        let bestDist = Infinity;
        for (const s of percStrokes) {
          const d = Math.abs(keyToDiatonic(s.staffLine) - targetDia);
          const sameHead = (s.notehead ?? s.noteType) === (original?.notehead ?? original?.noteType);
          const bestSameHead = (best.notehead ?? best.noteType) === (original?.notehead ?? original?.noteType);
          if (d < bestDist || (d === bestDist && sameHead && !bestSameHead)) {
            bestDist = d;
            best = s;
          }
        }
        return best.midi;
      }
      return diatonicToMidi(midiToDiatonic(drag.originalMidi) + deltaSteps, accidental, keyFifths);
    },
    [isPercussion, percStrokes, accidental, keyFifths]
  );

  // Closest note to a local x, within tolerance (~40px or 1/n of the measure).
  const hitAt = (item: MeasureStripItem, localX: number, measureWidth: number): MeasureHit | null => {
    const hits = hitsByMeasure.current.get(item.measureIndex);
    if (!hits || hits.length === 0) return null;
    let best: MeasureHit | null = null;
    let bestDist = Infinity;
    for (const h of hits) {
      const cx = h.x + h.w / 2;
      const d = Math.abs(cx - localX);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    const tolerance = Math.min(40, measureWidth / Math.max(1, hits.length));
    return best && bestDist <= tolerance ? best : null;
  };

  const handlePointerDown = (e: React.PointerEvent, item: MeasureStripItem) => {
    // Stop native selection/drag gestures before they start (the blue-highlight bug).
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerTop = containerRef.current?.getBoundingClientRect().top ?? rect.top;
    // The header band always means the bar; on the staff, a note under the
    // pointer takes the press.
    const inHeader = e.clientY - rect.top < HANDLE_BAND_PX;
    const hit = inHeader ? null : hitAt(item, e.clientX - rect.left, rect.width);

    if (hit && !e.shiftKey) {
      onSelectEvent({ measureIndex: item.measureIndex, eventIndex: hit.eventIndex });
      // Seed a pitch drag if this event is a pitched/percussion note (has a midi).
      const ev = item.events[hit.eventIndex];
      if (ev && ev.midi != null) {
        setDragging({
          measureIndex: item.measureIndex,
          eventIndex: hit.eventIndex,
          originalMidi: ev.midi,
          currentMidi: ev.midi,
          startY: e.clientY - containerTop,
          pointerId: e.pointerId,
          moved: false,
        });
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
      return;
    }
    onSelectMeasure?.(item.measureIndex, e.shiftKey);
    if (!e.shiftKey) startSelectionDrag(e, item.measureIndex);
  };

  const handlePointerMove = (e: React.PointerEvent, item: MeasureStripItem) => {
    if (dragging && dragging.pointerId === e.pointerId) {
      const container = containerRef.current;
      if (!container) return;
      const cursorY = e.clientY - container.getBoundingClientRect().top;
      // Dead zone: ignore sub-threshold wobble so clicks never transpose.
      if (!dragging.moved && Math.abs(dragging.startY - cursorY) < DRAG_THRESHOLD_PX) return;
      const nextMidi = dragTargetMidi(dragging, cursorY);
      if (nextMidi !== dragging.currentMidi || !dragging.moved) {
        setDragging({ ...dragging, currentMidi: nextMidi, moved: true });
      }
      return;
    }
    // Not dragging: hover feedback for the cursor.
    if (selDrag.current?.moved) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const inHeader = e.clientY - rect.top < HANDLE_BAND_PX;
    const hit = inHeader ? null : hitAt(item, e.clientX - rect.left, rect.width);
    setHover(hit ? { measureIndex: item.measureIndex, eventIndex: hit.eventIndex } : null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (dragging.currentMidi !== dragging.originalMidi) {
      onSetPitch(
        { measureIndex: dragging.measureIndex, eventIndex: dragging.eventIndex },
        dragging.currentMidi
      );
    }
    setDragging(null);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (dragging?.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    setDragging(null);
  };

  // Selection highlight position — recomputed every render (reads from the ref Map).
  const highlight = (() => {
    if (!selected) return null;
    const item = measures.find((m) => m.measureIndex === selected.measureIndex);
    if (!item) return null;
    const hits = hitsByMeasure.current.get(selected.measureIndex);
    const hit = hits?.find((h) => h.eventIndex === selected.eventIndex);
    if (!hit) return null;
    const startX = videoTimeToX(item.startVideoTimeSeconds);
    // While dragging this note, lift the highlight by the live pitch delta so
    // the feedback tracks the cursor before the model commits on release.
    let dragOffsetY = 0;
    if (dragging && dragging.measureIndex === selected.measureIndex && dragging.eventIndex === selected.eventIndex) {
      const before = isPercussion && percStrokes
        ? keyToDiatonic(percStrokes.find((s) => s.midi === dragging.originalMidi)?.staffLine ?? 'c/5')
        : midiToDiatonic(dragging.originalMidi);
      const after = isPercussion && percStrokes
        ? keyToDiatonic(percStrokes.find((s) => s.midi === dragging.currentMidi)?.staffLine ?? 'c/5')
        : midiToDiatonic(dragging.currentMidi);
      dragOffsetY = (before - after) * STEP_PX;
    }
    return {
      // hit.y is staff-local (0 at the top of the ContinuousStaff's SVG); the staff
      // itself sits at container y = REP_H, so the overlay adds it back once.
      left: startX + hit.x - 3,
      top: REP_H + hit.y - 3 + dragOffsetY,
      width: hit.w + 6,
      height: hit.h + 6,
    };
  })();
  void bboxVersion; // dep marker so the overlay re-renders when bboxes update

  // Pitch chip text shown while dragging.
  const dragChip = dragging
    ? (() => {
        const item = measures.find((m) => m.measureIndex === dragging.measureIndex);
        if (!item) return null;
        const hits = hitsByMeasure.current.get(dragging.measureIndex);
        const hit = hits?.find((h) => h.eventIndex === dragging.eventIndex);
        if (!hit) return null;
        const startX = videoTimeToX(item.startVideoTimeSeconds);
        const label =
          isPercussion && percStrokes
            ? percStrokes.find((s) => s.midi === dragging.currentMidi)?.label ?? ''
            : midiToName(dragging.currentMidi);
        // highlight.top already includes REP_H when it exists; the fallback
        // (highlight absent, e.g. a fresh drag before selection catches up)
        // adds it here so both paths land in the same container coordinates.
        return { left: startX + hit.x, top: (highlight?.top ?? REP_H + hit.y) - 16, label };
      })()
    : null;

  return (
    <div
      ref={containerRef}
      className="playsense-studio-notation relative w-full select-none overflow-hidden rounded-md border border-border bg-card"
      style={{ height }}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={endSelectionDrag}
      onPointerCancel={endSelectionDrag}
      onLostPointerCapture={endSelectionDrag}
      onDoubleClick={handleContainerDoubleClick}
    >
      {/* The notation: one continuous staff under the measure overlays. */}
      <ContinuousStaff
        items={measures}
        pixelsPerSecond={pixelsPerSecond}
        scrollLeftPx={scrollLeftPx}
        viewportWidth={viewportWidth}
        height={height}
        spans={scoreSpans}
        onHitsReady={handleHitsReady}
      />

      {measures.map((item) => {
        const startX = videoTimeToX(item.startVideoTimeSeconds);
        const endXVal = videoTimeToX(item.endVideoTimeSeconds);
        const width = endXVal - startX;
        if (endXVal < -20 || startX > viewportWidth + 20) return null;

        if (width < MIN_RENDER_WIDTH) {
          // Narrow tier: a placeholder that selects on click, opens on double-click.
          return (
            <button
              key={item.measureIndex}
              type="button"
              data-measure-index={item.measureIndex}
              onClick={(e) => onSelectMeasure?.(item.measureIndex, e.shiftKey)}
              onDoubleClick={() => onOpenMeasure(item.measureIndex)}
              className={`absolute flex items-center justify-center rounded border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground${inRange(item.measureIndex) ? ' ring-2 ring-inset ring-primary' : ''}`}
              style={{ left: startX, top: REP_H, width: Math.max(8, width), height: height - REP_H }}
              title={`Measure ${item.measureNumber} — double-click to open`}
            >
              {item.measureNumber}
            </button>
          );
        }

        const cursor = dragging
          ? 'grabbing'
          : hovered?.measureIndex === item.measureIndex
            ? 'ns-resize' // a note is under the cursor — drag ↕ changes its pitch
            : 'default';
        return (
          <div
            key={item.measureIndex}
            data-measure-index={item.measureIndex}
            className={`absolute ${inRange(item.measureIndex) ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}${isFocus(item.measureIndex) ? ' st-measure-focus' : ''}${newBars?.has(item.measureIndex) ? ' is-new' : ''}`}
            style={{ left: startX, top: REP_H, width, height: height - REP_H, cursor, touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={(e) => handlePointerMove(e, item)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => {
              if (hovered?.measureIndex === item.measureIndex) setHover(null);
            }}
          >
            {/* Header band: measure number, repeat pass and beat count. A press
                here selects the bar (handled by the measure's pointerdown). */}
            <div
              className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 rounded-t-sm bg-muted/70 px-2 text-[11px] text-muted-foreground"
              style={{ height: HANDLE_BAND_PX }}
            >
              <span className="tabular-nums leading-none">{item.measureNumber}</span>
              {item.repeatPass && width >= 100 && <span className="truncate opacity-70">
                {item.repeatPass.pass === 0 && item.repeatPass.offset === 0 && <>· ↻ ×{item.repeatPass.count} </>}
                · pass {item.repeatPass.pass + 1}/{item.repeatPass.count}
              </span>}
              {width >= 60 && (
                <span className={`st-cap is-${item.fill.kind} ml-auto shrink-0 tabular-nums leading-none`} title={fillTitle(item.measureNumber, item.fill)}>
                  {item.fill.kind === 'empty' ? `0/${beatsText(item.fill.totalBeats)}` : `${beatsText(item.fill.usedBeats)}/${beatsText(item.fill.totalBeats)}`}
                </span>
              )}
            </div>
            {item.fill.kind === 'short' && (() => {
              const hits = hitsByMeasure.current.get(item.measureIndex);
              const last = hits?.at(-1);
              const gapLeft = last ? Math.min(width - 8, last.x + last.w + 4) : width * (item.fill.usedBeats / item.fill.totalBeats);
              return (
                <div className="st-gapfill" style={{ left: gapLeft, width: width - gapLeft, top: HANDLE_BAND_PX + 6, bottom: 6 }}>
                  {width - gapLeft > 60 && (
                    <span>{`−${beatsText(item.fill.missingBeats)} beat${item.fill.missingBeats === 1 ? '' : 's'} missing`}</span>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Repeat lane — one band per pass, reserved at the strip's top edge. */}
      <RepeatLane bands={bands} onBandClick={onRepeatBandClick ?? (() => {})} />

      {/* "+" at every barline gap (and both ends): opens the gap menu (empty /
          copy / paste). Hidden during drags and where a neighbouring bar is
          too narrow to read. */}
      {onGapClick && !dragging && measures.length > 0 &&
        Array.from({ length: measures.length + 1 }, (_, gap) => {
          const before = measures[gap - 1];
          const after = measures[gap];
          const x = after ? videoTimeToX(after.startVideoTimeSeconds) : videoTimeToX(before.endVideoTimeSeconds);
          if (x < -12 || x > viewportWidth + 12) return null;
          const narrow = (item?: MeasureStripItem) =>
            !!item && videoTimeToX(item.endVideoTimeSeconds) - videoTimeToX(item.startVideoTimeSeconds) < MIN_RENDER_WIDTH;
          if (narrow(before) || narrow(after)) return null;
          const problem = gapProblems?.[gap] ?? null;
          const label = after
            ? `Insert a measure before measure ${after.measureNumber}`
            : `Add a measure after measure ${before.measureNumber}`;
          return (
            <button
              key={`gap-${gap}`}
              type="button"
              className="st-gap-add"
              style={{ left: x, top: REP_H + 5 }}
              aria-label={label}
              title={problem ?? label}
              disabled={!!problem}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onGapClick(gap, { left: x - 10, top: REP_H + 26 }); }}
            >
              <Plus className="h-3 w-3" />
            </button>
          );
        })}

      {highlight && (
        <div
          className="pointer-events-none absolute rounded ring-2 ring-[hsl(var(--gold-highlight))]"
          style={highlight}
        />
      )}

      {dragChip && dragChip.label && (
        <div
          className="pointer-events-none absolute z-10 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-background shadow"
          style={{ left: dragChip.left, top: Math.max(0, dragChip.top) }}
        >
          {dragChip.label}
        </div>
      )}

      {/* Playback playhead — mirrors the waveform's 2px --primary line. Positioned
          via RAF (see effect above); starts hidden until the loop places it. */}
      {getCurrentSeconds && (
        <div
          ref={playheadRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-0.5 bg-[hsl(var(--primary))]"
          style={{ height: '100%', visibility: 'hidden', willChange: 'transform' }}
        />
      )}
    </div>
  );
}

// Parse a VexFlow key string ('g/5', 'c#/4') to a continuous diatonic index
// (octave*7 + letterIndex). Used to snap percussion drags to stroke lines.
const LETTER_TO_INDEX: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
function keyToDiatonic(key: string): number {
  const m = key.match(/^([a-gA-G])[#b]?\/(-?\d+)$/);
  if (!m) return 0;
  return Number(m[2]) * 7 + (LETTER_TO_INDEX[m[1].toLowerCase()] ?? 0);
}

function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[pc]}${octave}`;
}
