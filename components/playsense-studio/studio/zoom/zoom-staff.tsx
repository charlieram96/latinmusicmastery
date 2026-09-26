'use client';

// PlaySense Studio — one bar drawn large for the measure zoom (and small, for
// its neighbour slivers). Mirrors how ContinuousStaff draws a bar (header,
// build/format/draw, ties inside the bar, spans, theming) but in its own SVG,
// scaled by `scale` through the SVG context.
//
// Coordinates: hits, noteStartX/noteEndX and yForLine are in this component's
// own px (0,0 at its top-left, which the zoom places at its center column's
// top-left), i.e. VexFlow's unscaled math multiplied by `scale`. lineForY
// takes those px back to a stave line (0 = top line).

import { useEffect, useRef } from 'react';
import { BarlineType, Renderer, Stave, StaveTie } from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import { scoreTieIndices } from '@/lib/playsense-studio/score-to-vexflow';
import { applyStaveHeader, buildMeasure, drawMeasure, formatMeasure, staveHeader } from '@/lib/playsense-studio/notation/build-measure';
import { drawSpanSegments, spanSegments, type PlacedNote } from '@/lib/playsense-studio/notation/spans';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureStripItem } from '../editable-measure-strip';

export interface ZoomHit { voice: 0 | 1; eventIndex: number; x: number; y: number; w: number; h: number }

export interface ZoomLayout {
  hits: ZoomHit[];
  /** px, for the beat bands. */
  noteStartX: number;
  noteEndX: number;
  /** Stave line (0 = top line) for a y in this staff's px. */
  lineForY: (y: number) => number;
  yForLine: (line: number) => number;
}

export interface ZoomStaffProps {
  item: MeasureStripItem;
  width: number;
  height: number;
  scale: number;
  spans?: Span[];
  /** Draw this voice's notes at half opacity (the voice not being edited). */
  dimVoice?: 0 | 1;
  onLayout: (l: ZoomLayout) => void;
}

const EMPTY: ZoomLayout = { hits: [], noteStartX: 0, noteEndX: 0, lineForY: () => 0, yForLine: () => 0 };

function draw(el: HTMLDivElement, { item, width, height, scale, spans, dimVoice }: Omit<ZoomStaffProps, 'onLayout'>): ZoomLayout {
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);

  const stave = new Stave(4, 30, Math.max(20, width / scale - 8));
  applyStaveHeader(stave, staveHeader(item, { opening: true, rowStart: false }));
  if (item.finalBarline) stave.setEndBarType(BarlineType.END);
  stave.setContext(ctx).draw();

  const layout: ZoomLayout = {
    hits: [],
    noteStartX: stave.getNoteStartX() * scale,
    noteEndX: stave.getNoteEndX() * scale,
    lineForY: (y) => stave.getLineForY(y / scale),
    yForLine: (line) => stave.getYForLine(line) * scale,
  };

  const events = item.events;
  const voice2 = item.voice2Events ?? [];
  const built = buildMeasure([events, voice2], item.timeSignature, item.clef);
  if (built) {
    formatMeasure(built, Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 8));
    drawMeasure(ctx, stave, built);
    const notes = built.notes[0] ?? [];
    const notes2 = built.notes[1] ?? [];

    // Held pitches inside the bar.
    events.forEach((d, i) => {
      const after = events[i + 1];
      if (!after) return;
      try {
        const indices = scoreTieIndices(d, after);
        if (indices.firstIndexes.length) new StaveTie({ firstNote: notes[i], lastNote: notes[i + 1], ...indices }).setContext(ctx).draw();
      } catch {
        // A tie VexFlow can't place is skipped.
      }
    });

    // Spans with both ends inside this bar.
    const placed: PlacedNote[] = [];
    notes.forEach((note, i) => placed.push({ id: events[i].id, note, system: 0, hasDynamic: !!events[i].dynamic }));
    notes2.forEach((note, i) => placed.push({ id: voice2[i].id, note, system: 0, hasDynamic: !!voice2[i].dynamic }));
    drawSpanSegments(ctx, spanSegments(spans, placed));

    const box = (voice: 0 | 1) => (n: (typeof notes)[number], i: number): ZoomHit => {
      const bb = n.getBoundingBox();
      return { voice, eventIndex: i, x: bb.getX() * scale, y: bb.getY() * scale, w: bb.getW() * scale, h: bb.getH() * scale };
    };
    layout.hits = [...notes.map(box(0)), ...notes2.map(box(1))];

    if (dimVoice !== undefined) {
      for (const n of dimVoice === 0 ? notes : notes2) n.getSVGElement()?.setAttribute('opacity', '0.5');
    }
  }

  const svg = el.querySelector('svg');
  if (svg) themeVexflowSvg(svg as SVGSVGElement);
  return layout;
}

export function ZoomStaff({ item, width, height, scale, spans, dimVoice, onLayout }: ZoomStaffProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Latest callback, read by the draw effect without making it a redraw trigger.
  const layoutCb = useRef(onLayout);
  useEffect(() => {
    layoutCb.current = onLayout;
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.innerHTML = '';
    let layout = EMPTY;
    if (width > 0 && height > 0) {
      try {
        layout = draw(el, { item, width, height, scale, spans, dimVoice });
      } catch {
        // A bar VexFlow can't lay out reports no hits; its stave may still have drawn.
        layout = EMPTY;
      }
    }
    layoutCb.current(layout);
    return () => {
      el.innerHTML = '';
    };
  }, [item, width, height, scale, spans, dimVoice]);

  return <div ref={hostRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />;
}
