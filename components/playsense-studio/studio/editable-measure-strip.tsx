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

import { GripHorizontal } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Accidental,
  Articulation,
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
import {
  diatonicToMidi,
  midiToDiatonic,
  type VexEventDescriptor,
} from '@/lib/playsense-studio/score-to-vexflow';
import type { PercStroke } from '@/lib/playsense-studio/perc-strokes';
import type { DragMode } from '@/components/playsense-studio/sync/waveform-canvas';

export interface MeasureStripItem {
  /** 0-based index into the score track's measures (NOT the 1-based measureNumber). */
  measureIndex: number;
  measureNumber: number;
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
  pixelsPerSecond: number;
  scrollLeftPx: number;
  selected: SelectedEventRef | null;
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
  /** Horizontal wheel/trackpad pan over the staff (shared timeline scroll). */
  onScrollByPx?: (dx: number) => void;
  height?: number;
}

const DEFAULT_HEIGHT = 150;
const STAVE_TOP = 14;
const LEFT_PAD = 6;
const RIGHT_PAD = 6;
/** Height of the grab-handle band at the top of each measure block. */
const HANDLE_BAND_PX = 14;
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

export function EditableMeasureStrip({
  measures,
  pixelsPerSecond,
  scrollLeftPx,
  selected,
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
  onScrollByPx,
  height = DEFAULT_HEIGHT,
}: EditableMeasureStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [timeDrag, setTimeDrag] = useState<TimeDragState | null>(null);
  const pendingEmptyRef = useRef<PendingEmptyInsert | null>(null);
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

  // Horizontal wheel/trackpad pans the shared timeline, exactly like over the
  // waveform. Native listener (passive:false) because React's onWheel can't
  // preventDefault. Plain vertical wheel falls through so the notation column
  // keeps page-scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onScrollByPx) return;
    const onWheel = (e: WheelEvent) => {
      // Horizontal intent: trackpad x-deltas, or shift+wheel (Chrome/Safari remap
      // shift+wheel to deltaX; Firefox keeps deltaY with shiftKey set).
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal) return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      onScrollByPx(dx);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onScrollByPx]);

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
        let best = percStrokes[0];
        let bestDist = Infinity;
        for (const s of percStrokes) {
          const d = Math.abs(keyToDiatonic(s.staffLine) - targetDia);
          if (d < bestDist) {
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
    } else {
      // Empty space: insert only if the press RELEASES in place (pointer-up),
      // so a stray drag across the staff doesn't drop notes.
      pendingEmptyRef.current = {
        measureIndex: item.measureIndex,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
      };
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
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const pending = pendingEmptyRef.current;
    if (pending && pending.pointerId === e.pointerId) {
      pendingEmptyRef.current = null;
      const movedPx = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (movedPx < DRAG_THRESHOLD_PX) onClickMeasureEmpty(pending.measureIndex);
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
      {measures.map((item) => {
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
              onClick={() => onRequestZoomTo(item.measureIndex)}
              className="absolute top-0 flex items-center justify-center rounded border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              style={{ left: startX, width: Math.max(8, width), height, cursor: 'zoom-in' }}
              title={`Measure ${item.measureNumber} — click to zoom in and edit`}
            >
              {item.measureNumber}
            </button>
          );
        }

        const isTimeDragging = timeDrag?.measureIndex === item.measureIndex;
        const cursor = dragging
          ? 'grabbing'
          : hovered?.measureIndex === item.measureIndex
            ? 'ns-resize' // a note is under the cursor — drag ↕ changes its pitch
            : 'pointer'; // empty space — click to add
        return (
          <div
            key={item.measureIndex}
            className="absolute top-0"
            style={{ left: startX, width, cursor, touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={(e) => handlePointerMove(e, item)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => {
              if (hovered?.measureIndex === item.measureIndex) setHover(null);
            }}
          >
            {/* Grab-handle band: drag horizontally to reposition this measure in
                time. Sits above the staff and stops propagation so note
                selection / pitch-drag on the staff below is unaffected. */}
            <div
              className={`absolute inset-x-0 top-0 z-10 flex items-center gap-1 rounded-t-sm px-1 text-[10px] transition ${
                isTimeDragging
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/70 text-muted-foreground hover:bg-primary/15 hover:text-foreground'
              }`}
              style={{ height: HANDLE_BAND_PX, cursor: isTimeDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={(e) => handleHandleDown(e, item)}
              onPointerMove={handleHandleMove}
              onPointerUp={handleHandleUp}
              onPointerCancel={handleHandleCancel}
              title="Drag to move this measure (and everything after it). Hold Option for just this measure."
            >
              <GripHorizontal className="h-2.5 w-2.5 shrink-0 opacity-70" />
              <span className="tabular-nums leading-none">{item.measureNumber}</span>
            </div>
            <MiniStave
              measureIndex={item.measureIndex}
              events={item.events}
              width={Math.round(width)}
              height={height}
              timeSignature={item.timeSignature}
              isFirst={item.isFirst}
              clef={item.clef}
              onHitsReady={handleHitsReady}
            />
          </div>
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
    </div>
  );
}

interface MiniStaveProps {
  measureIndex: number;
  events: VexEventDescriptor[];
  width: number;
  height: number;
  timeSignature: [number, number];
  isFirst: boolean;
  clef: 'treble' | 'percussion';
  onHitsReady: (measureIndex: number, hits: MeasureHit[] | null) => void;
}

const MiniStave = memo(function MiniStave({
  measureIndex,
  events,
  width,
  height,
  timeSignature,
  isFirst,
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

    const stave = new Stave(LEFT_PAD, STAVE_TOP, staveWidth);
    if (isFirst) {
      stave.addClef(clef).addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
    }
    stave.setContext(ctx).draw();

    if (events.length > 0) {
      try {
        const vexNotes = events.map(descriptorToStaveNote);
        const voice = new Voice({ numBeats: timeSignature[0], beatValue: timeSignature[1] });
        voice.setStrict(false);
        voice.addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(20, staveWidth - 16));
        voice.draw(ctx, stave);

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

        // Ties — within this measure only (each measure is its own SVG, so
        // cross-measure ties can't reference the next note object).
        events.forEach((d, i) => {
          if (d.tieToNext && i + 1 < vexNotes.length && !d.isRest && !events[i + 1].isRest) {
            new StaveTie({
              firstNote: vexNotes[i],
              lastNote: vexNotes[i + 1],
              firstIndexes: [0],
              lastIndexes: [0],
            })
              .setContext(ctx)
              .draw();
          }
        });

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
  }, [measureIndex, events, width, height, timeSignature, isFirst, clef, onHitsReady]);

  return <div ref={ref} />;
});

const ARTICULATION_CODE: Record<'staccato' | 'accent' | 'tenuto', string> = {
  staccato: 'a.',
  accent: 'a>',
  tenuto: 'a-',
};

function descriptorToStaveNote(d: VexEventDescriptor): StaveNote {
  const note = new StaveNote({
    keys: d.keys,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
    ...(d.noteType ? { type: d.noteType } : {}),
  });
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
