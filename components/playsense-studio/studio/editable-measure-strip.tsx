'use client';

// PlaySense Studio — editable notation strip beneath the waveform.
//
// Each measure is its own VexFlow mini-stave, absolutely positioned at the
// measure's audio span (startX..endX derived from the markers) and sized to its
// pixel width.
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
// is captured inside the same try block as voice.draw and reported up to the
// strip via onHitsReady. The strip keeps these in a ref Map keyed by
// measureIndex and consults it on pointer events. The selection highlight is a
// separate absolute <div> overlay (pointer-events:none) that reads from the
// Map on each render, so it tracks the right note across marker drags + zoom.

import { Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  BarlineType,
  Renderer,
  Stave,
  StaveTie,
} from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import { beatLengthInQN, measureLengthInQN, occupiedQN } from '@/lib/playsense-studio/time-mapping';
import {
  diatonicToMidi,
  midiToDiatonic,
  type NotationClef,
  type VexEventDescriptor,
  scoreTieIndices,
} from '@/lib/playsense-studio/score-to-vexflow';
import { applyStaveHeader, buildMeasure, drawMeasure, formatMeasure, staveHeader } from '@/lib/playsense-studio/notation/build-measure';
import { drawSpanSegments, spanSegments } from '@/lib/playsense-studio/notation/spans';
import type { PercStroke } from '@/lib/playsense-studio/perc-strokes';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import { repeatSpans } from '@/lib/playsense-studio/repeats';
import { measureAtX } from '@/lib/playsense-studio/measure-selection';

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
  /** Slurs and hairpins (ScoreDocument.spans) to draw within each measure. A
   *  span whose ends fall in different measures is skipped here — each measure
   *  is its own SVG in this strip; cross-bar spans wait for the continuous strip. */
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
  /** Insert a blank bar at this barline gap (0 = before the first bar, n = after the last). */
  onInsertMeasureAt?: (index: number) => void;
  /** Per gap (n + 1 entries): why a bar cannot be inserted there, or null. */
  gapProblems?: Array<string | null>;
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
const LEFT_PAD = 6;
const RIGHT_PAD = 6;
/** Height of the header band (measure number, capacity) at the top of each measure block. */
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

/** A press on a bar that may become a drag across bars (container-space x). */
interface SelectionDrag {
  pointerId: number;
  anchor: number;
  x: number;
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
  onInsertMeasureAt,
  gapProblems,
  onSelectMeasureRange,
  onOpenMeasure,
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
  const inRange = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex >= selectedMeasures[0] && measureIndex <= selectedMeasures[1];
  const isFocus = (measureIndex: number) =>
    selectedMeasures !== null && measureIndex === selectedMeasures[1];
  // One bracket per repeat group, spanning every written-out pass, so the
  // strip itself says which measures repeat and how many times.
  const spans = repeatSpans(measures);

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
  // edges) and grows the selection from the anchor. The loop reads the latest
  // props through refs, since scrolling re-renders while it runs.
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
  const stopSelectionLoop = () => {
    if (selRaf.current) cancelAnimationFrame(selRaf.current);
    selRaf.current = 0;
  };
  useEffect(() => stopSelectionLoop, []);

  const startSelectionDrag = (e: React.PointerEvent, measureIndex: number) => {
    selDrag.current = { pointerId: e.pointerId, anchor: measureIndex, x: containerX(e) };
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    stopSelectionLoop();
    let last = measureIndex;
    const tick = () => {
      const drag = selDrag.current;
      if (!drag) return;
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
    if (drag && drag.pointerId === e.pointerId) drag.x = containerX(e);
  };

  const endSelectionDrag = (e: React.PointerEvent) => {
    const drag = selDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    stopSelectionLoop();
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    selDrag.current = null;
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
    if (selDrag.current) return;
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
      onPointerMove={handleContainerPointerMove}
      onPointerUp={endSelectionDrag}
      onPointerCancel={endSelectionDrag}
    >
      {measures.map((item, itemIndex) => {
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
              className={`absolute top-0 flex items-center justify-center rounded border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground${inRange(item.measureIndex) ? ' ring-2 ring-inset ring-primary' : ''}`}
              style={{ left: startX, width: Math.max(8, width), height }}
              title={`Measure ${item.measureNumber} — double-click to open`}
            >
              {item.measureNumber}
            </button>
          );
        }

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
            : 'default';
        return (
          <div
            key={item.measureIndex}
            data-measure-index={item.measureIndex}
            className={`absolute top-0 ${inRange(item.measureIndex) ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}${isFocus(item.measureIndex) ? ' st-measure-focus' : ''}`}
            style={{ left: startX, width, cursor, touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={(e) => handlePointerMove(e, item)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => {
              if (hovered?.measureIndex === item.measureIndex) setHover(null);
            }}
            onDoubleClick={() => onOpenMeasure(item.measureIndex)}
          >
            {/* Header band: measure number, repeat pass and capacity. A press
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
            </div>
            <MiniStave
              measureIndex={item.measureIndex}
              events={item.events}
              voice2Events={item.voice2Events}
              previousEvent={measures[itemIndex - 1]?.events.at(-1)}
              nextEvent={measures[itemIndex + 1]?.events[0]}
              width={Math.round(width)}
              height={height}
              timeSignature={item.timeSignature}
              isFirst={item.isFirst}
              finalBarline={!!item.finalBarline}
              clef={item.clef}
              keyFifths={item.keyFifths}
              previousKeyFifths={item.previousKeyFifths}
              keyChanged={item.keyChanged}
              clefChanged={item.clefChanged}
              spans={scoreSpans}
              onHitsReady={handleHitsReady}
            />
          </div>
        );
      })}

      {/* Repeat brackets — a bar along the top edge of each group's passes,
          ticked at every pass boundary, lit while the group is selected. */}
      {spans.map((span) => {
        const left = videoTimeToX(measures[span.firstIndex].startVideoTimeSeconds);
        const right = videoTimeToX(measures[span.lastIndex].endVideoTimeSeconds);
        if (right < -20 || left > viewportWidth + 20) return null;
        const selectedGroup = Array.from({ length: span.lastIndex - span.firstIndex + 1 }, (_, i) => span.firstIndex + i).some(inRange);
        return (
          <div
            key={`repeat-${span.id}`}
            data-repeat-bracket={span.id}
            aria-hidden
            className={`pointer-events-none absolute top-0 z-20 h-[3px] rounded-b-sm bg-[hsl(var(--primary))] transition-opacity ${selectedGroup ? 'opacity-100' : 'opacity-45'}`}
            style={{ left, width: Math.max(2, right - left) }}
            title={`Measures repeat ${span.count} times`}
          >
            {span.passStarts.slice(1).map((index) => (
              <span
                key={index}
                className="absolute top-0 h-[7px] w-px bg-[hsl(var(--primary))]"
                style={{ left: videoTimeToX(measures[index].startVideoTimeSeconds) - left }}
              />
            ))}
          </div>
        );
      })}

      {/* "+" at every barline gap (and both ends): insert a bar there. Hidden
          during drags and where a neighbouring bar is too narrow to read. */}
      {onInsertMeasureAt && !dragging && measures.length > 0 &&
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
  voice2Events: VexEventDescriptor[];
  width: number;
  height: number;
  timeSignature: [number, number];
  isFirst: boolean;
  finalBarline: boolean;
  clef: NotationClef;
  keyFifths: number;
  previousKeyFifths: number;
  keyChanged: boolean;
  clefChanged: boolean;
  spans?: Span[];
  onHitsReady: (measureIndex: number, hits: MeasureHit[] | null) => void;
}

const MiniStave = memo(function MiniStave({
  previousEvent,
  nextEvent,
  measureIndex,
  events,
  voice2Events,
  width,
  height,
  timeSignature,
  isFirst,
  finalBarline,
  clef,
  keyFifths,
  previousKeyFifths,
  keyChanged,
  clefChanged,
  spans: spansForMeasure,
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
    // One SVG per measure in a single scrolling row: only the opening bar is a row start.
    applyStaveHeader(stave, staveHeader(
      { clef, keyFifths, previousKeyFifths, keyChanged, clefChanged, timeSignature },
      { opening: isFirst, rowStart: false },
    ));
    if (finalBarline) stave.setEndBarType(BarlineType.END);
    // Center the staff vertically: put the middle line (line 2 = B4) at the
    // box's vertical center so notes/stems have even headroom above and below.
    stave.setY(Math.round(height / 2 - stave.getYForLine(2)));
    stave.setContext(ctx).draw();

    // Voice 2 alone (voice 1 empty) still has notes to show.
    if (events.length > 0 || (voice2Events?.length ?? 0) > 0) {
      try {
        const built = buildMeasure([events, voice2Events ?? []], timeSignature, clef);
        if (built) {
          formatMeasure(built, Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 8));
          drawMeasure(ctx, stave, built);
          const vexNotes = built.notes[0];

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

          drawSpanSegments(ctx, spanSegments(spansForMeasure, vexNotes.map((note, i) => ({ id: events[i].id, note, system: 0, hasDynamic: !!events[i].dynamic }))));

          // Capture per-event bboxes after a successful draw.
          const hits: MeasureHit[] = vexNotes.map((n, i) => {
            const bb = n.getBoundingBox();
            return { eventIndex: i, x: bb.getX(), y: bb.getY(), w: bb.getW(), h: bb.getH() };
          });
          onHitsReady(measureIndex, hits);
        }
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
  }, [measureIndex, events, voice2Events, previousEvent, nextEvent, width, height, timeSignature, isFirst, finalBarline, clef, keyFifths, previousKeyFifths, keyChanged, clefChanged, spansForMeasure, onHitsReady]);

  return <div ref={ref} />;
});

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
