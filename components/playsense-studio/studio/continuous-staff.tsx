'use client';
import { applyMeasureSymbols } from '@/lib/playsense-studio/notation/measure-symbols';
import {drawEmptyMeasure} from '@/lib/playsense-studio/notation/empty-measure';

// PlaySense Studio — the measure strip's notation, drawn as ONE VexFlow SVG
// across the render window (a viewport either side of the visible range), so
// slurs, hairpins and ties cross barlines just as they do for students. Each
// bar keeps its time-proportional width: its stave runs from its start to its
// end time at the current zoom.
//
// Scrolling within the window never redraws: the host moves by a CSS
// transform, and only a window move (or new items/zoom/spans/height) redraws.
// Redraws are merged to at most one per animation frame (drag and zoom ticks
// can change the inputs several times a frame); until a merged redraw lands,
// the transform keeps placing the old drawing at the window it was drawn for.
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
import { syncBarBounds } from '@/lib/playsense-studio/notation/sync-bar-bounds';
import { REP_H } from './measure/repeat-lane';

/** Below this width a bar can't render notes legibly — the strip shows a placeholder instead. */
export const MIN_RENDER_WIDTH = 46;
/** Below this width a bar draws "bare": no dynamics or text, which would crowd it. */
const BARE_WIDTH = 110;

export interface ContinuousStaffProps {
  items: MeasureStripItem[];
  noteTimeForQN?: (qn: number) => number;
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
  notes2: StaveNote[];
}

interface DrawInput {
  win: RenderWindow;
  noteTimeForQN?: (qn: number) => number;
  pixelsPerSecond: number;
  items: MeasureStripItem[];
  spans: Span[] | undefined;
  staffHeight: number;
}

/** Draws the window's bars into `el` as one SVG; returns a cleanup that empties it and clears the reported hits. */
function drawStaff(el: HTMLDivElement, { win, pixelsPerSecond, items, spans, staffHeight, noteTimeForQN }: DrawInput, report: ContinuousStaffProps['onHitsReady']): () => void {
  el.innerHTML = '';
  const reported = new Set<number>();

  const width = win.end - win.start;
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, staffHeight);
  const ctx = renderer.getContext();

  const drawn = new Map<number, DrawnBar>();
  const placed: PlacedNote[][] = [[], []];

  items.forEach((item, k) => {
    const x0 = item.startVideoTimeSeconds * pixelsPerSecond - win.start;
    const x1 = item.endVideoTimeSeconds * pixelsPerSecond - win.start;
    if (x1 < 0 || x0 > width) return;
    try {
      // Put the opening clef/key before musical time zero, rather than
      // pushing every note to the right of its waveform reference.
      const headerWidth = noteTimeForQN && item.isFirst ? 110 : 0;
      const stave = new Stave(x0 - headerWidth, 0, x1 - x0 + headerWidth);
      // One continuous row: only the opening bar is a row start.
      applyStaveHeader(stave, staveHeader(item, { opening: item.isFirst, rowStart: false }));
      if (item.isFirst || item.continuousBarlines) stave.setBegBarType(BarlineType.NONE);
      if (noteTimeForQN) {
        // Draw separators separately so downbeats stay exactly on audio time
        // while the engraved barline has room before the notehead.
        if (!item.isFirst) stave.setBegBarType(BarlineType.NONE);
        if (k < items.length - 1 || item.continuousBarlines) stave.setEndBarType(BarlineType.NONE);
      }
      if (item.endBarline === 'double') stave.setEndBarType(BarlineType.DOUBLE);
      // Keep the final glyph wholly inside its section's clipping boundary.
      // VexFlow's end modifier can extend past that boundary in sibling layers.
      if (item.finalBarline) stave.setEndBarType(BarlineType.NONE);
      // Center the staff vertically: the middle line (line 2 = B4) at the
      // box's vertical center, so stems have even headroom above and below.
      stave.setY(Math.round(staffHeight / 2 - stave.getYForLine(2)));
      applyMeasureSymbols(stave,item);
      stave.setContext(ctx).draw();
      if (item.finalBarline && !item.repeatEnd) {
        ctx.save();
        ctx.openGroup('sync-final-barline');
        const top = stave.getYForLine(0);
        const height = stave.getYForLine(4) - top;
        ctx.fillRect(x1 - 8, top, 1, height);
        ctx.fillRect(x1 - 5, top, 3, height);
        ctx.closeGroup();
        ctx.restore();
      }
      if (noteTimeForQN && !item.isFirst) {
        const barX = item.continuousBarlines ? x0 : syncBarBounds(x0,x1).left - 14;
        ctx.save();
        ctx.openGroup('sync-bar-separator');
        // Engraving clearance only: note positions and synchronization do not move.
        ctx.setStrokeStyle('#94a3b8');
        ctx.setLineWidth(0.75);
        ctx.beginPath();
        ctx.moveTo(barX, stave.getYForLine(0));
        ctx.lineTo(barX, stave.getYForLine(4));
        ctx.stroke();
        ctx.closeGroup();
        ctx.restore();
      }

      // Keep all five lines even where zoom makes notation too narrow.
      if (x1-x0 < MIN_RENDER_WIDTH && (item.events.length || item.voice2Events?.length)) return;
      const bare = x1 - x0 < BARE_WIDTH;
      const strip = (ds: VexEventDescriptor[]): VexEventDescriptor[] =>
        bare ? ds.map((d) => ({ ...d, dynamic: undefined, text: undefined })) : ds;
      const events = strip(item.events);
      const voice2 = strip(item.voice2Events ?? []);

      // Voice 2 alone (voice 1 empty) still has notes to show.
      const built = buildMeasure([events, voice2], item.timeSignature, item.clef);
      if (!built) { drawEmptyMeasure(ctx,stave,item.timeSignature,item.emptyText,{left:x0,right:x1}); return; }
      formatMeasure(built, Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 8));
      if (noteTimeForQN) {
        // The sync editor uses a time axis, not engraving spacing: every
        // attack follows its waveform time, with visual clearance at barlines.
        const positioned = new Set<ReturnType<StaveNote['getTickContext']>>();
        built.notes.forEach((notes, voice) => notes.forEach((note, index) => {
          note.setStave(stave);
          const event = (voice === 0 ? events : voice2)[index];
          const tick = note.getTickContext();
          if (!event || positioned.has(tick)) return;
          const timeX = noteTimeForQN(event.qnStart) * pixelsPerSecond - win.start;
          // Continuous bars keep their authored time boundary. Give the glyph
          // breathing room inside it instead of drawing a rest/note over the
          // separator. This is engraving only; event and click times stay intact.
          const halfGlyph = note.getGlyphWidth() / 2;
          const openingGap = Math.min(36, (x1 - x0) * 0.12);
          const left = x0 + halfGlyph + openingGap;
          const right = x1 - halfGlyph - (item.finalBarline || item.repeatPass ? 28 : 24);
          // Redistribute the whole bar into the inset, rather than clamping
          // its first attacks onto the same x (which reverses/collapses beams).
          const fraction = Math.max(0, Math.min(1, (timeX - x0) / (x1 - x0)));
          const target = item.continuousBarlines && right >= left
            ? left + fraction * (right - left)
            : timeX;
          // Move the shared rhythmic context, preserving chord displacements,
          // beams, articulations and the formatter's voice collision handling.
          tick.setX(tick.getX() + target - note.getAbsoluteX() - note.getGlyphWidth() / 2);
          positioned.add(tick);
        }));
      }
      drawMeasure(ctx, stave, built);
      const vexNotes = built.notes[0] ?? [];
      const vexNotes2 = built.notes[1] ?? [];

      // Held pitches inside the bar, matched even when the next chord changes shape.
      [events,voice2].forEach((lane, v) => lane.forEach((d, i) => {
        const laneNotes = v === 0 ? vexNotes : vexNotes2;
        const after = lane[i + 1];
        if (!after) return;
        const indices = scoreTieIndices(d, after);
        if (indices.firstIndexes.length) new StaveTie({ firstNote: laneNotes[i], lastNote: laneNotes[i + 1], ...indices }).setContext(ctx).draw();
      }));

      // Reading order for spans: voice 1, then voice 2, bar by bar.
      vexNotes.forEach((note, i) => placed[0].push({ id: events[i].id, note, system: 0, hasDynamic: !!events[i].dynamic }));
      vexNotes2.forEach((note, i) => placed[1].push({ id: voice2[i].id, note, system: 0, hasDynamic: !!voice2[i].dynamic }));

      const hits: MeasureHit[] = [];
      built.notes.forEach((notes, voice) => notes.forEach((note, eventIndex) => {
        const used = new Set<number>();
        note.noteHeads.forEach(head => {
          const member = note.getKeyProps().findIndex((key, i) => key.line === head.getLine() && !used.has(i));
          if (member < 0) return;
          used.add(member);
          hits.push({ eventIndex, voice, member, x: head.getAbsoluteX() - x0 - 3, y: head.getY() - 6, w: 18, h: 12 });
        });
      }));
      drawn.set(k, { k, events, notes: vexNotes, notes2: vexNotes2 });
      reported.add(item.measureIndex);
      report(item.measureIndex, hits);
    } catch {
      // A bar VexFlow can't lay out is skipped; its stave may still have drawn.
    }
  });

  // Ties across barlines. Both ends drawn: one tie in this SVG. One end
  // off-window or too narrow: a partial tie to/from the barline.
  for (const voice of [0, 1]) for (let k = 0; k + 1 < items.length; k++) {
    const a = drawn.get(k);
    const b = drawn.get(k + 1);
    if (!a && !b) continue;
    const last = (voice === 0 ? items[k].events : items[k].voice2Events ?? []).at(-1);
    const first = (voice === 0 ? items[k + 1].events : items[k + 1].voice2Events ?? [])[0];
    if (!last || !first) continue;
    try {
      const indices = scoreTieIndices(last, first);
      if (a && b) {
        const firstNote = (voice === 0 ? a.notes : a.notes2).at(-1);
        const lastNote = (voice === 0 ? b.notes : b.notes2)[0];
        if (indices.firstIndexes.length && firstNote && lastNote) new StaveTie({ firstNote, lastNote, ...indices }).setContext(ctx).draw();
      } else if (a) {
        const firstNote = (voice === 0 ? a.notes : a.notes2).at(-1);
        const { firstIndexes } = indices;
        if (firstIndexes.length && firstNote) new StaveTie({ firstNote, firstIndexes, lastIndexes: firstIndexes }).setContext(ctx).draw();
      } else if (b) {
        const lastNote = (voice === 0 ? b.notes : b.notes2)[0];
        const { lastIndexes } = indices;
        if (lastIndexes.length && lastNote) new StaveTie({ lastNote, firstIndexes: lastIndexes, lastIndexes }).setContext(ctx).draw();
      }
    } catch {
      // A tie VexFlow can't place is skipped, never fatal.
    }
  }

  placed.forEach(lane => drawSpanSegments(ctx, spanSegments(spans, lane, { openEnds: true })));

  const svg = el.querySelector('svg');
  if (svg) themeVexflowSvg(svg as SVGSVGElement);

  return () => {
    el.innerHTML = '';
    reported.forEach((i) => report(i, null));
  };
}

export function ContinuousStaff({ items, noteTimeForQN, pixelsPerSecond, scrollLeftPx, viewportWidth, height, spans, onHitsReady }: ContinuousStaffProps) {
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

  // The window actually on screen, which lags `next` until a merged redraw lands.
  const [drawn, setDrawn] = useState<RenderWindow | null>(null);
  const shown = drawn ?? next;

  // Latest inputs, read when the frame fires; the pending frame; the live drawing's cleanup.
  const input = useRef<DrawInput | null>(null);
  const scroll = useRef(scrollLeftPx);
  const frame = useRef(0);
  const clear = useRef<(() => void) | null>(null);
  const publishedHits = useRef(new Map<number, MeasureHit[]>());
  useEffect(() => {
    scroll.current = scrollLeftPx;
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    input.current = { win: { start: next.start, end: next.end }, pixelsPerSecond, items, spans, staffHeight, noteTimeForQN };
    const run = () => {
      frame.current = 0;
      const now = input.current;
      if (!now) return;
      clear.current?.();
      // Publish the completed geometry, not the temporary empty state between
      // drawings. Identical redraws must not trigger another parent update.
      const nextHits = new Map<number, MeasureHit[]>();
      clear.current = drawStaff(el, now, (index, hits) => {
        if (hits) nextHits.set(index, hits);
        else nextHits.delete(index);
      });
      const previousHits = publishedHits.current;
      publishedHits.current = new Map(nextHits);
      previousHits.forEach((_, index) => {
        if (!nextHits.has(index)) hitsCb.current(index, null);
      });
      nextHits.forEach((hits, index) => {
        const previous = previousHits.get(index);
        const unchanged = previous?.length === hits.length && hits.every((hit, i) => {
          const old = previous[i];
          return hit.eventIndex === old.eventIndex && hit.voice === old.voice && hit.member === old.member
            && hit.x === old.x && hit.y === old.y && hit.w === old.w && hit.h === old.h;
        });
        if (!unchanged) hitsCb.current(index, hits);
      });
      // Place the new drawing now; the re-render below keeps it placed.
      el.style.width = `${now.win.end - now.win.start}px`;
      el.style.transform = `translateX(${now.win.start - scroll.current}px)`;
      setDrawn(previous => previous?.start === now.win.start && previous.end === now.win.end ? previous : now.win);
    };
    // The first drawing is immediate, so the staff never mounts blank.
    if (!clear.current) run();
    else if (!frame.current) frame.current = requestAnimationFrame(run);
  }, [next.start, next.end, pixelsPerSecond, items, spans, staffHeight, noteTimeForQN]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    clear.current?.();
    clear.current = null;
    publishedHits.current.forEach((_, index) => hitsCb.current(index, null));
    publishedHits.current.clear();
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute left-0"
      style={{ top: REP_H, height: staffHeight, width: shown.end - shown.start, transform: `translateX(${shown.start - scrollLeftPx}px)` }}
    />
  );
}
