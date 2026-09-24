'use client';

// PlaySense Studio — the measure strip's notation, drawn as ONE VexFlow SVG
// across the render window (a viewport either side of the visible range), so
// slurs, hairpins and ties cross barlines just as they do for students. Each
// bar keeps its time-proportional width: its stave runs from its start to its
// end time at the current zoom.
//
// Scrolling within the window never redraws: the host moves by a CSS
// transform, and only a window move (or new items/zoom/spans/height) redraws.
//
// Coordinates: the host sits at `top: REP_H`, below the repeat lane, exactly
// where each per-bar SVG used to sit. Hits are reported bar-local in x (0 at
// the bar's start time) and staff-local in y (0 at the top of this SVG), the
// same convention the strip's overlays already consume — they add REP_H once.

import { useEffect, useRef, useState } from 'react';
import { BarlineType, Renderer, Stave, StaveTie, type StaveNote } from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import { scoreTieIndices, type VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';
import { applyStaveHeader, buildMeasure, drawMeasure, formatMeasure, staveHeader } from '@/lib/playsense-studio/notation/build-measure';
import { drawSpanSegments, spanSegments, type PlacedNote } from '@/lib/playsense-studio/notation/spans';
import { renderWindow, type RenderWindow } from '@/lib/playsense-studio/render-window';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureHit, MeasureStripItem } from './editable-measure-strip';
import { REP_H } from './measure/repeat-lane';

/** Below this width a bar can't render notes legibly — the strip shows a placeholder instead. */
export const MIN_RENDER_WIDTH = 46;
/** Below this width a bar draws "bare": no dynamics or text, which would crowd it. */
const BARE_WIDTH = 110;

export interface ContinuousStaffProps {
  items: MeasureStripItem[];
  pixelsPerSecond: number;
  scrollLeftPx: number;
  viewportWidth: number;
  /** The strip's full height; the staff takes `height - REP_H` below the repeat lane. */
  height: number;
  spans?: Span[];
  /** Voice-1 hit boxes per drawn bar; null clears a bar that is no longer drawn. */
  onHitsReady: (measureIndex: number, hits: MeasureHit[] | null) => void;
}

interface DrawnBar {
  k: number;
  events: VexEventDescriptor[];
  notes: StaveNote[];
}

export function ContinuousStaff({ items, pixelsPerSecond, scrollLeftPx, viewportWidth, height, spans, onHitsReady }: ContinuousStaffProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The window is derived state: renderWindow hands back the same object while
  // the view stays well inside it, so this only re-renders when it must move.
  const [win, setWin] = useState<RenderWindow | null>(null);
  const next = renderWindow(scrollLeftPx, viewportWidth, win);
  if (next !== win) setWin(next);

  // Latest callback, read by the draw effect without making it a redraw trigger.
  const hitsCb = useRef(onHitsReady);
  useEffect(() => {
    hitsCb.current = onHitsReady;
  });

  const staffHeight = height - REP_H;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.innerHTML = '';
    const report = hitsCb.current;
    const reported = new Set<number>();

    const width = next.end - next.start;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, staffHeight);
    const ctx = renderer.getContext();

    const drawn = new Map<number, DrawnBar>();
    const placed: PlacedNote[] = [];

    items.forEach((item, k) => {
      const x0 = item.startVideoTimeSeconds * pixelsPerSecond - next.start;
      const x1 = item.endVideoTimeSeconds * pixelsPerSecond - next.start;
      if (x1 < 0 || x0 > width || x1 - x0 < MIN_RENDER_WIDTH) return;
      try {
        const stave = new Stave(x0, 0, x1 - x0);
        // One continuous row: only the opening bar is a row start.
        applyStaveHeader(stave, staveHeader(item, { opening: item.isFirst, rowStart: false }));
        if (item.finalBarline) stave.setEndBarType(BarlineType.END);
        // Center the staff vertically: the middle line (line 2 = B4) at the
        // box's vertical center, so stems have even headroom above and below.
        stave.setY(Math.round(staffHeight / 2 - stave.getYForLine(2)));
        stave.setContext(ctx).draw();

        const bare = x1 - x0 < BARE_WIDTH;
        const strip = (ds: VexEventDescriptor[]): VexEventDescriptor[] =>
          bare ? ds.map((d) => ({ ...d, dynamic: undefined, text: undefined })) : ds;
        const events = strip(item.events);
        const voice2 = strip(item.voice2Events ?? []);

        // Voice 2 alone (voice 1 empty) still has notes to show.
        const built = buildMeasure([events, voice2], item.timeSignature, item.clef);
        if (!built) return;
        formatMeasure(built, Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 8));
        drawMeasure(ctx, stave, built);
        const vexNotes = built.notes[0] ?? [];
        const vexNotes2 = built.notes[1] ?? [];

        // Held pitches inside the bar, matched even when the next chord changes shape.
        events.forEach((d, i) => {
          const after = events[i + 1];
          if (!after) return;
          const indices = scoreTieIndices(d, after);
          if (indices.firstIndexes.length) new StaveTie({ firstNote: vexNotes[i], lastNote: vexNotes[i + 1], ...indices }).setContext(ctx).draw();
        });

        // Reading order for spans: voice 1, then voice 2, bar by bar.
        vexNotes.forEach((note, i) => placed.push({ id: events[i].id, note, system: 0, hasDynamic: !!events[i].dynamic }));
        vexNotes2.forEach((note, i) => placed.push({ id: voice2[i].id, note, system: 0, hasDynamic: !!voice2[i].dynamic }));

        const hits: MeasureHit[] = vexNotes.map((n, i) => {
          const bb = n.getBoundingBox();
          // Bar-local x; staff-local y (the strip's overlays add REP_H once).
          return { eventIndex: i, x: bb.getX() - x0, y: bb.getY(), w: bb.getW(), h: bb.getH() };
        });
        drawn.set(k, { k, events, notes: vexNotes });
        reported.add(item.measureIndex);
        report(item.measureIndex, hits);
      } catch {
        // A bar VexFlow can't lay out is skipped; its stave may still have drawn.
      }
    });

    // Ties across barlines. Both ends drawn: one tie in this SVG. One end
    // off-window or too narrow: a partial tie to/from the barline.
    for (let k = 0; k + 1 < items.length; k++) {
      const a = drawn.get(k);
      const b = drawn.get(k + 1);
      if (!a && !b) continue;
      const last = items[k].events.at(-1);
      const first = items[k + 1].events[0];
      if (!last || !first) continue;
      try {
        const indices = scoreTieIndices(last, first);
        if (a && b) {
          const firstNote = a.notes.at(-1);
          const lastNote = b.notes[0];
          if (indices.firstIndexes.length && firstNote && lastNote) new StaveTie({ firstNote, lastNote, ...indices }).setContext(ctx).draw();
        } else if (a) {
          const firstNote = a.notes.at(-1);
          const { firstIndexes } = indices;
          if (firstIndexes.length && firstNote) new StaveTie({ firstNote, firstIndexes, lastIndexes: firstIndexes }).setContext(ctx).draw();
        } else if (b) {
          const lastNote = b.notes[0];
          const { lastIndexes } = indices;
          if (lastIndexes.length && lastNote) new StaveTie({ lastNote, firstIndexes: lastIndexes, lastIndexes }).setContext(ctx).draw();
        }
      } catch {
        // A tie VexFlow can't place is skipped, never fatal.
      }
    }

    drawSpanSegments(ctx, spanSegments(spans, placed));

    const svg = el.querySelector('svg');
    if (svg) themeVexflowSvg(svg as SVGSVGElement);

    return () => {
      el.innerHTML = '';
      reported.forEach((i) => report(i, null));
    };
  }, [next.start, next.end, pixelsPerSecond, items, spans, staffHeight]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute left-0"
      style={{ top: REP_H, height: staffHeight, width: next.end - next.start, transform: `translateX(${next.start - scrollLeftPx}px)` }}
    />
  );
}
