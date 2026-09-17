'use client';

// PlaySense Studio — editable notation strip beneath the waveform.
//
// Replaces the old read-only MeasureStrip. Each measure is its own VexFlow
// mini-stave, absolutely positioned at the measure's audio span (startX..endX
// derived from the markers) and sized to its pixel width. Clicking a note
// selects it (the parent's toolbar then edits that event); clicking empty
// measure space appends a note using the toolbar's current pitch + duration.
// Below ~46 px wide a measure becomes a clickable placeholder that asks the
// parent to zoom in on it — the click itself IS the zoom gesture.
//
// Hit-testing: after VexFlow lays out the notes, each note's getBoundingBox()
// is captured inside the same try block as voice.draw and reported up to the
// strip via onHitsReady. The strip keeps these in a ref Map keyed by
// measureIndex and consults it on pointer events. The selection highlight is a
// separate absolute <div> overlay (pointer-events:none) that reads from the
// Map on each render, so it tracks the right note across marker drags + zoom.

import { createStaveNote } from '@/lib/playsense-studio/percussion-stave-note';
import { GripHorizontal, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Accidental,
  Articulation,
  BarlineType,
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
} from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import { beatLengthInQN, measureLengthInQN, occupiedQN } from '@/lib/playsense-studio/time-mapping';
import {
  diatonicToMidi,
  midiToDiatonic,
  type VexEventDescriptor,
  scoreTieIndices,
} from '@/lib/playsense-studio/score-to-vexflow';
import type { PercStroke } from '@/lib/playsense-studio/perc-strokes';
import type { DragMode } from '@/components/playsense-studio/sync/waveform-canvas';

export interface MeasureStripItem {
  /** 0-based index into the score track's measures (NOT the 1-based measureNumber). */
  measureIndex: number;
  measureNumber: number;
  repeatPass?: { pass: number; count: number };
  /** Close this measure with a final (thin–thick) bar. */
  finalBarline?: boolean;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
  events: VexEventDescriptor[];
  timeSignature: [number, number];
  isFirst: boolean;
  clef: 'treble' | 'percussion';
}

export interface SelectedEventRef {
  measureIndex: number;
  eventIndex: number;
}

interface MeasureHit {
  eventIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditableMeasureStripProps {
  measures: MeasureStripItem[];
  /** Live playback position (video seconds) for the playhead; omit to hide it. */
  getCurrentSeconds?: () => number;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  selected: SelectedEventRef | null;
  /** Highlighted measure range [start, end] (inclusive indices), or null. */
  selectedMeasures?: [number, number] | null;
  /** Click selects one bar; Shift+click (extend = true) grows the range to it. */
  onSelectMeasure?: (measureIndex: number, extend: boolean) => void;
  /** Insert a blank bar at this barline gap (0 = before the first bar, n = after the last). */
  onInsertMeasureAt?: (index: number) => void;
  /** Per gap (n + 1 entries): why a bar cannot be inserted there, or null. */
  gapProblems?: Array<string | null>;
  onSelectEvent: (ref: SelectedEventRef) => void;
  onClickMeasureEmpty: (measureIndex: number) => void;
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
  /**
   * Default mode for measure-block time drags. When true, dragging a measure's
   * handle shifts it and every later measure (region drag); holding Alt/Option
   * inverts to single-measure. When false the defaults swap.
   */
  dragAll: boolean;
  /** A measure-block time drag began (downbeat repositioning). */
  onMeasureDragStart?: (measureIndex: number) => void;
  /** Live measure-block time drag: move this measure's downbeat to `videoTimeSeconds`. */
  onMeasureDrag: (measureIndex: number, videoTimeSeconds: number, mode: DragMode) => void;
  /** A measure-block time drag ended (commit / reinterpolate). */
  onMeasureDragEnd?: () => void;
  /** Move the tail boundary (right edge of the LAST measure) in video time. */
  onTailDrag?: (videoTimeSeconds: number) => void;
  /** Show the per-measure left/right edge resize handles (sync mode only). */
  resizable?: boolean;
  /** MIDI a click on empty space will insert (for the hover preview); null = rest. */
  previewMidi?: number | null;
  /** Horizontal wheel/trackpad pan over the staff (shared timeline scroll). */
  onScrollByPx?: (dx: number) => void;
  onWheelZoom?: (factor: number, anchorPx: number) => void;
  insertOnClick?: boolean;
  height?: number;
}

const DEFAULT_HEIGHT = 220;
const LEFT_PAD = 6;
const RIGHT_PAD = 6;
/** Height of the grab-handle band at the top of each measure block. */
const HANDLE_BAND_PX = 28;
/** Below this width a measure can't render notes legibly — show a zoom-in placeholder. */
const MIN_RENDER_WIDTH = 46;
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

/** A press on empty measure space; becomes an insert only if released in place. */
interface PendingEmptyInsert {
  measureIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
}

/** Horizontal drag of a measure block's grab handle (repositions its downbeat in time). */
interface TimeDragState {
  measureIndex: number;
  pointerId: number;
  /** Seconds between the grab point and the measure's start, so the block stays under the cursor. */
  grabOffsetSeconds: number;
  mode: DragMode;
  moved: boolean;
}

/** Drag of a measure's left/right edge — stretches that one boundary in time. */
interface EdgeDragState {
  measureIndex: number;
  edge: 'left' | 'right';
  pointerId: number;
  moved: boolean;
}

/** Width (px) of the left/right edge resize handles. */
const EDGE_PX = 7;

export function EditableMeasureStrip({
  measures,
  getCurrentSeconds,
  pixelsPerSecond,
  scrollLeftPx,
  selected,
  selectedMeasures = null,
  onSelectMeasure,
  onInsertMeasureAt,
  gapProblems,
  onSelectEvent,
  onClickMeasureEmpty,
  onRequestZoomTo,
  onSetPitch,
  accidental,
  keyFifths,
  isPercussion,
  percStrokes,
  dragAll,
  onMeasureDragStart,
  onMeasureDrag,
  onMeasureDragEnd,
  onTailDrag,
  resizable,
  previewMidi,
  onScrollByPx,
  onWheelZoom,
  insertOnClick = true,
  height = DEFAULT_HEIGHT,
}: EditableMeasureStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [timeDrag, setTimeDrag] = useState<TimeDragState | null>(null);
  const [edgeDrag, setEdgeDrag] = useState<EdgeDragState | null>(null);
  const pendingEmptyRef = useRef<PendingEmptyInsert | null>(null);
  // Cursor preview: where (container x) over empty measure space a click would
  // drop a note. The note's identity comes from `previewMidi` (the toolbar).
  const [ghost, setGhost] = useState<{ measureIndex: number; x: number } | null>(null);
  const ghostXRef = useRef(0);
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

  // Captured bboxes per measureIndex, refreshed by MiniStave on each draw.
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
  const xToVideoTime = (x: number) => (x + scrollLeftPx) / pixelsPerSecond;
  const inRange = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex >= selectedMeasures[0] && measureIndex <= selectedMeasures[1];
  const isFocus = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex === selectedMeasures[1];

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

  // ---- Measure-block time drag (the grab handle band) ----------------------
  // Default mode is region (all-after) when `dragAll` is on; Alt/Option inverts.
  const containerX = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return 0;
    return e.clientX - container.getBoundingClientRect().left;
  };

  const handleHandleDown = (e: React.PointerEvent, item: MeasureStripItem) => {
    e.stopPropagation(); // don't let the note pointerdown on the wrapper fire
    e.preventDefault();
    if (e.shiftKey) {
      // Shift+click grows the measure range; it never starts a time drag.
      onSelectMeasure?.(item.measureIndex, true);
      return;
    }
    onSelectMeasure?.(item.measureIndex, false);
    const grabTime = xToVideoTime(containerX(e));
    const mode: DragMode = dragAll !== e.altKey ? 'all-after' : 'single';
    setTimeDrag({
      measureIndex: item.measureIndex,
      pointerId: e.pointerId,
      grabOffsetSeconds: grabTime - item.startVideoTimeSeconds,
      mode,
      moved: false,
    });
    onMeasureDragStart?.(item.measureIndex);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const handleHandleMove = (e: React.PointerEvent) => {
    if (!timeDrag || timeDrag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const newStart = Math.max(0, xToVideoTime(containerX(e)) - timeDrag.grabOffsetSeconds);
    if (!timeDrag.moved) setTimeDrag({ ...timeDrag, moved: true });
    onMeasureDrag(timeDrag.measureIndex, newStart, timeDrag.mode);
  };

  const handleHandleUp = (e: React.PointerEvent) => {
    if (!timeDrag || timeDrag.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (timeDrag.moved) onMeasureDragEnd?.();
    setTimeDrag(null);
  };

  const handleHandleCancel = (e: React.PointerEvent) => {
    if (timeDrag?.pointerId !== e.pointerId) return;
    setTimeDrag(null);
  };

  // ---- Edge resize (left/right boundary of a single measure) ----------------
  // Left edge moves this measure's downbeat; right edge moves the next measure's
  // downbeat (or the tail, for the last measure). Always 'single' so only that
  // one boundary moves — the measure stretches/squeezes on the dragged side.
  const lastMeasureIndex = measures.length ? measures[measures.length - 1].measureIndex : -1;

  const handleEdgeDown = (e: React.PointerEvent, item: MeasureStripItem, edge: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setEdgeDrag({ measureIndex: item.measureIndex, edge, pointerId: e.pointerId, moved: false });
    onMeasureDragStart?.(item.measureIndex);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const handleEdgeMove = (e: React.PointerEvent) => {
    if (!edgeDrag || edgeDrag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const t = Math.max(0, xToVideoTime(containerX(e)));
    if (!edgeDrag.moved) setEdgeDrag({ ...edgeDrag, moved: true });
    if (edgeDrag.edge === 'left') {
      onMeasureDrag(edgeDrag.measureIndex, t, 'single');
    } else if (edgeDrag.measureIndex === lastMeasureIndex) {
      onTailDrag?.(t);
    } else {
      onMeasureDrag(edgeDrag.measureIndex + 1, t, 'single');
    }
  };

  const handleEdgeUp = (e: React.PointerEvent) => {
    if (!edgeDrag || edgeDrag.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (edgeDrag.moved) onMeasureDragEnd?.();
    setEdgeDrag(null);
  };

  const handleEdgeCancel = (e: React.PointerEvent) => {
    if (edgeDrag?.pointerId === e.pointerId) setEdgeDrag(null);
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
    const hit = hitAt(item, e.clientX - rect.left, rect.width);

    if (e.shiftKey) {
      onSelectMeasure?.(item.measureIndex, true);
      return;
    }
    if (hit) {
      onSelectEvent({ measureIndex: item.measureIndex, eventIndex: hit.eventIndex });
      // Seed a drag if this event is a pitched/percussion note (has a midi).
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
    } else if (insertOnClick) {
      // Empty space: insert only if the press RELEASES in place (pointer-up),
      // so a stray drag across the staff doesn't drop notes.
      pendingEmptyRef.current = {
        measureIndex: item.measureIndex,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
      };
    } else {
      onSelectMeasure?.(item.measureIndex, false);
    }
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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const hit = hitAt(item, e.clientX - rect.left, rect.width);
    setHover(hit ? { measureIndex: item.measureIndex, eventIndex: hit.eventIndex } : null);
    // Over empty space: show the cursor preview note (throttled to ~2px moves).
    if (!hit && !timeDrag && !edgeDrag) {
      const cx = containerX(e);
      if (!ghost || ghost.measureIndex !== item.measureIndex || Math.abs(cx - ghostXRef.current) >= 2) {
        ghostXRef.current = cx;
        setGhost({ measureIndex: item.measureIndex, x: cx });
      }
    } else if (ghost) {
      setGhost(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const pending = pendingEmptyRef.current;
    if (pending && pending.pointerId === e.pointerId) {
      pendingEmptyRef.current = null;
      const movedPx = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (insertOnClick && movedPx < DRAG_THRESHOLD_PX) onClickMeasureEmpty(pending.measureIndex);
      return;
    }
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
    if (pendingEmptyRef.current?.pointerId === e.pointerId) pendingEmptyRef.current = null;
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
      left: startX + hit.x - 3,
      top: hit.y - 3 + dragOffsetY,
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
        return { left: startX + hit.x, top: (highlight?.top ?? hit.y) - 16, label };
      })()
    : null;

  return (
    <div
      ref={containerRef}
      className="playsense-studio-notation relative w-full select-none overflow-hidden rounded-md border border-border bg-card"
      style={{ height }}
    >
      {measures.map((item, itemIndex) => {
        const startX = videoTimeToX(item.startVideoTimeSeconds);
        const endXVal = videoTimeToX(item.endVideoTimeSeconds);
        const width = endXVal - startX;
        if (endXVal < -20 || startX > viewportWidth + 20) return null;

        if (width < MIN_RENDER_WIDTH) {
          // Narrow tier: clickable placeholder; click to zoom in.
          return (
            <button
              key={item.measureIndex}
              type="button"
              onClick={(e) => { onSelectMeasure?.(item.measureIndex, e.shiftKey); if (!e.shiftKey) onRequestZoomTo(item.measureIndex); }}
              className={`absolute top-0 flex items-center justify-center rounded border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground${inRange(item.measureIndex) ? ' ring-2 ring-inset ring-primary' : ''}`}
              style={{ left: startX, width: Math.max(8, width), height, cursor: 'zoom-in' }}
              title={`Measure ${item.measureNumber} — click to zoom in and edit`}
            >
              {item.measureNumber}
            </button>
          );
        }

        const isTimeDragging = timeDrag?.measureIndex === item.measureIndex;
        // Capacity for the measure's time signature, shown as used/total beats
        // (e.g. "0/4", "4/4") so the author sees how full the measure is.
        const beatQN = beatLengthInQN(item.timeSignature);
        const usedBeats = occupiedQN(item.events) / beatQN;
        const totalBeats = measureLengthInQN(item.timeSignature) / beatQN;
        const isFull = usedBeats >= totalBeats - 1e-6;
        const capLabel = `${formatBeatsShort(usedBeats)}/${formatBeatsShort(totalBeats)}`;
        const showCap = width >= 64;
        const cursor = dragging
          ? 'grabbing'
          : hovered?.measureIndex === item.measureIndex
            ? 'ns-resize' // a note is under the cursor — drag ↕ changes its pitch
            : insertOnClick ? 'crosshair' : 'default';
        return (
          <div
            key={item.measureIndex}
            className={`absolute top-0 ${inRange(item.measureIndex) ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}${isFocus(item.measureIndex) ? ' st-measure-focus' : ''}`}
            style={{ left: startX, width, cursor, touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={(e) => handlePointerMove(e, item)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => {
              if (hovered?.measureIndex === item.measureIndex) setHover(null);
              if (ghost?.measureIndex === item.measureIndex) setGhost(null);
            }}
          >
            {/* Left/right edge handles — drag to stretch this measure's start or
                end boundary (sync mode only; meaningless on the fixed-BPM grid). */}
            {resizable && (
              <>
                <div
                  className="st-measure-edge st-measure-edge-l"
                  style={{ left: 0, top: HANDLE_BAND_PX, width: EDGE_PX }}
                  onPointerDown={(e) => handleEdgeDown(e, item, 'left')}
                  onPointerMove={handleEdgeMove}
                  onPointerUp={handleEdgeUp}
                  onPointerCancel={handleEdgeCancel}
                  title="Drag to move this measure's left edge"
                />
                <div
                  className="st-measure-edge st-measure-edge-r"
                  style={{ right: 0, top: HANDLE_BAND_PX, width: EDGE_PX }}
                  onPointerDown={(e) => handleEdgeDown(e, item, 'right')}
                  onPointerMove={handleEdgeMove}
                  onPointerUp={handleEdgeUp}
                  onPointerCancel={handleEdgeCancel}
                  title="Drag to move this measure's right edge"
                />
              </>
            )}
            {/* Grab-handle band: drag horizontally to reposition this measure in
                time. Sits above the staff and stops propagation so note
                selection / pitch-drag on the staff below is unaffected. */}
            <button
              type="button"
              aria-label={`Select measure ${item.measureNumber}`}
              aria-pressed={inRange(item.measureIndex)}
              onClick={(e) => onSelectMeasure?.(item.measureIndex, e.shiftKey)}
              className={`absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 rounded-t-sm px-2 text-[11px] transition ${
                isTimeDragging
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/70 text-muted-foreground hover:bg-primary/15 hover:text-foreground'
              }`}
              style={{ height: HANDLE_BAND_PX, cursor: isTimeDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={(e) => handleHandleDown(e, item)}
              onPointerMove={handleHandleMove}
              onPointerUp={handleHandleUp}
              onPointerCancel={handleHandleCancel}
              title={dragAll ? 'Drag to move this measure and everything after it. Hold Option for just this measure.' : 'Drag to move just this measure. Hold Option to move everything after it too.'}
            >
              <GripHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="tabular-nums leading-none">{item.measureNumber}</span>
              {item.repeatPass && width >= 100 && <span className="truncate opacity-70">· pass {item.repeatPass.pass + 1}/{item.repeatPass.count}</span>}
              {showCap && (
                <span
                  className={`ml-auto shrink-0 tabular-nums leading-none ${
                    isFull ? 'text-[hsl(var(--primary))] opacity-90' : 'opacity-60'
                  }`}
                  title={`${formatBeatsShort(usedBeats)} of ${formatBeatsShort(totalBeats)} beats filled`}
                >
                  {capLabel}
                </span>
              )}
            </button>
            <MiniStave
              measureIndex={item.measureIndex}
              events={item.events}
              previousEvent={measures[itemIndex - 1]?.events.at(-1)}
              nextEvent={measures[itemIndex + 1]?.events[0]}
              width={Math.round(width)}
              height={height}
              timeSignature={item.timeSignature}
              isFirst={item.isFirst}
              finalBarline={!!item.finalBarline}
              clef={item.clef}
              onHitsReady={handleHitsReady}
            />
          </div>
        );
      })}

      {/* "+" at every barline gap (and both ends): insert a bar there. Hidden
          during drags and where a neighbouring bar is too narrow to read. */}
      {onInsertMeasureAt && !dragging && !timeDrag && !edgeDrag && measures.length > 0 &&
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
              style={{ left: x, top: 5 }}
              aria-label={label}
              title={problem ?? label}
              disabled={!!problem}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onInsertMeasureAt(gap); }}
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

      {/* Cursor preview: the note a click would add, shown next to the cursor at
          its staff pitch (B4 sits on the middle line at height/2). */}
      {ghost && !dragging && previewMidi !== undefined && (() => {
        const isRest = previewMidi === null;
        const stroke = !isRest && isPercussion && percStrokes
          ? percStrokes.find((s) => s.midi === previewMidi)
          : null;
        const diatonic = isRest
          ? 34
          : stroke
            ? keyToDiatonic(stroke.staffLine)
            : midiToDiatonic(previewMidi as number);
        const topY = Math.max(
          HANDLE_BAND_PX + 8,
          Math.min(height - 8, height / 2 - (diatonic - 34) * STEP_PX)
        );
        const label = isRest ? 'rest' : stroke ? stroke.label : midiToName(previewMidi as number);
        return (
          <div
            className="pointer-events-none absolute z-20 flex items-center gap-1.5"
            style={{ left: ghost.x, top: topY, transform: 'translateY(-50%)' }}
          >
            {!isRest && (
              <span
                style={{
                  width: 11,
                  height: 8,
                  borderRadius: '50%',
                  background: 'hsl(var(--gold-highlight))',
                  opacity: 0.6,
                  transform: 'rotate(-18deg)',
                  flexShrink: 0,
                }}
              />
            )}
            <span className="rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium leading-none text-background shadow">
              {label}
            </span>
          </div>
        );
      })()}

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

interface MiniStaveProps {
  previousEvent?: VexEventDescriptor;
  nextEvent?: VexEventDescriptor;
  measureIndex: number;
  events: VexEventDescriptor[];
  width: number;
  height: number;
  timeSignature: [number, number];
  isFirst: boolean;
  finalBarline: boolean;
  clef: 'treble' | 'percussion';
  onHitsReady: (measureIndex: number, hits: MeasureHit[] | null) => void;
}

const MiniStave = memo(function MiniStave({
  previousEvent,
  nextEvent,
  measureIndex,
  events,
  width,
  height,
  timeSignature,
  isFirst,
  finalBarline,
  clef,
  onHitsReady,
}: MiniStaveProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    // Clear stale bboxes for this measure BEFORE attempting a redraw; only
    // re-populate after a successful draw so a malformed-measure throw doesn't
    // leave us with stale hits.
    onHitsReady(measureIndex, null);

    const staveWidth = Math.max(20, width - LEFT_PAD - RIGHT_PAD);
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const stave = new Stave(LEFT_PAD, 0, staveWidth);
    if (isFirst) {
      stave.addClef(clef).addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
    }
    if (finalBarline) stave.setEndBarType(BarlineType.END);
    // Center the staff vertically: put the middle line (line 2 = B4) at the
    // box's vertical center so notes/stems have even headroom above and below.
    stave.setY(Math.round(height / 2 - stave.getYForLine(2)));
    stave.setContext(ctx).draw();

    if (events.length > 0) {
      try {
        const vexNotes = events.map(descriptorToStaveNote);
        const voice = new Voice({ numBeats: timeSignature[0], beatValue: timeSignature[1] });
        voice.setStrict(false);
        voice.addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(20, staveWidth - 16));

        // Beam connectable notes (eighths and shorter); rests break the beam.
        // Generated BEFORE the draw so beamed notes drop their individual flags
        // and each note's bounding box (captured below) stays a single-note box.
        const beams = Beam.generateBeams(vexNotes, { beamRests: false });
        voice.draw(ctx, stave);
        beams.forEach((beam) => beam.setContext(ctx).draw());

        // Triplet brackets — group consecutive triplet-flagged events into
        // runs of three and draw a tuplet over each complete group.
        let run: StaveNote[] = [];
        const flushRun = () => {
          if (run.length === 3) {
            new Tuplet(run, { numNotes: 3, notesOccupied: 2, bracketed: true })
              .setContext(ctx)
              .draw();
          }
          run = [];
        };
        events.forEach((d, i) => {
          if (d.triplet) {
            run.push(vexNotes[i]);
            if (run.length === 3) flushRun();
          } else {
            flushRun();
          }
        });
        flushRun();

        // Match individual held pitches even when the next chord changes shape.
        events.forEach((d, i) => {
          const next = events[i + 1];
          if (!next) return;
          const indices = scoreTieIndices(d, next);
          if (indices.firstIndexes.length) new StaveTie({ firstNote: vexNotes[i], lastNote: vexNotes[i + 1], ...indices }).setContext(ctx).draw();
        });

        // Each measure has its own SVG; partial ties meet at the shared barline.
        if (previousEvent && events[0]) {
          const { lastIndexes } = scoreTieIndices(previousEvent, events[0]);
          if (lastIndexes.length) new StaveTie({ lastNote: vexNotes[0], firstIndexes: lastIndexes, lastIndexes }).setContext(ctx).draw();
        }
        if (nextEvent && events.length) {
          const { firstIndexes } = scoreTieIndices(events[events.length - 1], nextEvent);
          if (firstIndexes.length) new StaveTie({ firstNote: vexNotes[vexNotes.length - 1], firstIndexes, lastIndexes: firstIndexes }).setContext(ctx).draw();
        }

        // Capture per-event bboxes after a successful draw.
        const hits: MeasureHit[] = vexNotes.map((n, i) => {
          const bb = n.getBoundingBox();
          return { eventIndex: i, x: bb.getX(), y: bb.getY(), w: bb.getW(), h: bb.getH() };
        });
        onHitsReady(measureIndex, hits);
      } catch {
        // Malformed/overfull measure — the stave still drew; no hits captured.
      }
    }

    const svg = el.querySelector('svg');
    if (svg) themeVexflowSvg(svg as SVGSVGElement);

    return () => {
      el.innerHTML = '';
      onHitsReady(measureIndex, null);
    };
  }, [measureIndex, events, previousEvent, nextEvent, width, height, timeSignature, isFirst, finalBarline, clef, onHitsReady]);

  return <div ref={ref} />;
});

const ARTICULATION_CODE: Record<'staccato' | 'accent' | 'tenuto', string> = {
  staccato: 'a.',
  accent: 'a>',
  tenuto: 'a-',
};

function descriptorToStaveNote(d: VexEventDescriptor): StaveNote {
  const note = createStaveNote({
    keys: d.keys,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
    ...(d.noteType ? { type: d.noteType } : {}),
  }, d.percussion);
  if (d.dotted) Dot.buildAndAttach([note]);
  d.accidentals.forEach((acc, idx) => {
    if (acc) note.addModifier(new Accidental(acc), idx);
  });
  if (!d.isRest && d.articulation) {
    note.addModifier(new Articulation(ARTICULATION_CODE[d.articulation]), 0);
  }
  return note;
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

/** Short beat count for the per-measure capacity chip (e.g. "2", "1.5"). */
function formatBeatsShort(beats: number): string {
  const rounded = Math.round(beats * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
