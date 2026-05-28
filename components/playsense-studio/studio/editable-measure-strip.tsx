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

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import type { VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';

export interface MeasureStripItem {
  /** 0-based index into the score track's measures (NOT the 1-based measureNumber). */
  measureIndex: number;
  measureNumber: number;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
  events: VexEventDescriptor[];
  timeSignature: [number, number];
  isFirst: boolean;
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
  height?: number;
}

const DEFAULT_HEIGHT = 110;
const STAVE_TOP = 14;
const LEFT_PAD = 6;
const RIGHT_PAD = 6;
/** Below this width a measure can't render notes legibly — show a zoom-in placeholder. */
const MIN_RENDER_WIDTH = 46;

export function EditableMeasureStrip({
  measures,
  pixelsPerSecond,
  scrollLeftPx,
  selected,
  onSelectEvent,
  onClickMeasureEmpty,
  onRequestZoomTo,
  height = DEFAULT_HEIGHT,
}: EditableMeasureStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

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

  const handleHitsReady = useCallback((measureIndex: number, hits: MeasureHit[] | null) => {
    if (hits === null) hitsByMeasure.current.delete(measureIndex);
    else hitsByMeasure.current.set(measureIndex, hits);
    setBboxVersion((v) => v + 1);
  }, []);

  const handlePointerDown = (e: React.PointerEvent, item: MeasureStripItem) => {
    // Local x within this measure's wrapper.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hits = hitsByMeasure.current.get(item.measureIndex);
    if (!hits || hits.length === 0) {
      onClickMeasureEmpty(item.measureIndex);
      return;
    }
    // Find closest hit by horizontal distance to its center-x.
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const h of hits) {
      const cx = h.x + h.w / 2;
      const d = Math.abs(cx - x);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = h.eventIndex;
      }
    }
    // Tolerance: a click within ~40px of a note (or 1/n of the measure width)
    // selects it; outside that, treat as empty-measure click.
    const tolerance = Math.min(40, rect.width / Math.max(1, hits.length));
    if (bestIdx >= 0 && bestDist <= tolerance) {
      onSelectEvent({ measureIndex: item.measureIndex, eventIndex: bestIdx });
    } else {
      onClickMeasureEmpty(item.measureIndex);
    }
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
    return {
      left: startX + hit.x - 3,
      top: hit.y - 3,
      width: hit.w + 6,
      height: hit.h + 6,
    };
  })();
  void bboxVersion; // dep marker so the overlay re-renders when bboxes update

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border border-border bg-card"
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

        return (
          <div
            key={item.measureIndex}
            className="absolute top-0"
            style={{ left: startX, width, cursor: 'pointer' }}
            onPointerDown={(e) => handlePointerDown(e, item)}
          >
            <MiniStave
              measureIndex={item.measureIndex}
              events={item.events}
              width={Math.round(width)}
              height={height}
              timeSignature={item.timeSignature}
              isFirst={item.isFirst}
              onHitsReady={handleHitsReady}
            />
            {/* Small measure-number chip in the top-left corner. */}
            <span className="pointer-events-none absolute left-1 top-0 rounded-br bg-muted/70 px-1 text-[10px] text-muted-foreground">
              {item.measureNumber}
            </span>
          </div>
        );
      })}

      {highlight && (
        <div
          className="pointer-events-none absolute rounded ring-2 ring-[hsl(var(--gold-highlight))]"
          style={highlight}
        />
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
  onHitsReady: (measureIndex: number, hits: MeasureHit[] | null) => void;
}

const MiniStave = memo(function MiniStave({
  measureIndex,
  events,
  width,
  height,
  timeSignature,
  isFirst,
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
      stave.addClef('treble').addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
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
  }, [measureIndex, events, width, height, timeSignature, isFirst, onHitsReady]);

  return <div ref={ref} />;
});

function descriptorToStaveNote(d: VexEventDescriptor): StaveNote {
  const note = new StaveNote({
    keys: d.keys,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
  });
  if (d.dotted) Dot.buildAndAttach([note]);
  d.accidentals.forEach((acc, idx) => {
    if (acc) note.addModifier(new Accidental(acc), idx);
  });
  return note;
}
