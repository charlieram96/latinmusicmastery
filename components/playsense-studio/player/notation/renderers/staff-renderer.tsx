'use client';

// PlaySense Studio — VexFlow staff renderer.
//
// React wrapper around an imperative VexFlow class. The component holds a ref
// to the mount div, instantiates StaffRendererImpl on mount, and pushes new
// times through setTimeMs without ever re-rendering React. The cursor moves
// via direct DOM mutation at 60fps.
//
// Two layout modes:
//   • 'scroll'  — one continuous horizontal staff; the playhead is anchored
//                 near the left and the staff slides underneath it.
//   • 'wrapped' — measures wrap into several staves stacked vertically (like a
//                 page of sheet music); the pane scrolls vertically and the
//                 playhead jumps row-to-row. This is the default for the
//                 lesson viewer.
//
// Click-to-seek hit testing: after VexFlow lays out the notes, we capture each
// note's bounding box + its cumulative QN. A pointer event finds the position
// by interpolating between note anchors and fires onSeek.

import { useEffect, useMemo, useRef } from 'react';
import { repeatProjection } from '@/lib/playsense-studio/repeats';
import {
  Accidental,
  Beam,
  BarlineType,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from 'vexflow';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { qnToTrackMs } from '@/lib/playsense-studio/time-mapping';
import {
  extractTrackEvents,
  type VexEventDescriptor,
} from '@/lib/playsense-studio/score-to-vexflow';
import type {
  ScoreRenderer,
  SeekListener,
  SeekTarget,
} from '@/lib/playsense-studio/renderer';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';

export interface SelectedRange {
  startMs: number;
  endMs: number;
  startQn: number;
  endQn: number;
}

export type RangeListener = (range: SelectedRange) => void;

export type StaffLayoutMode = 'scroll' | 'wrapped';

interface NoteHit {
  /** Cumulative QN at the start of this event. */
  qn: number;
  /** Score-relative ms at the start of this event. */
  ms: number;
  measure: number;
  beat: number;
  /** SVG bounding box from VexFlow, in renderer-local px. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which system (row) this note lives on. Always 0 in scroll mode. */
  system: number;
}

const SYSTEM_PADDING_X = 12;
const STAVE_TOP = 40;
const STAVE_HEIGHT = 100;
// VexFlow default Stave: ~4 blank line-spaces above the staff at 10px each, so
// the visible 5-line staff sits this far below the stave's `y`, spanning 40px.
const STAFF_LINE_TOP = 40;
const STAFF_LINE_SPAN = 40;
/** Playhead extends this far above/below the staff lines. */
const CURSOR_OVERHANG = 10;
/** Staff-line stroke width (model units). VexFlow's default is 1; bumped for
 *  slightly bolder lines. Reset to 1 before notes/stems are drawn. */
const STAFF_LINE_WIDTH = 1.5;
/** Model width of a no-notation gap box appended to the staff. */
const GAP_BOX_W = 240;
const FIRST_MEASURE_EXTRA_WIDTH = 80; // room for clef + time signature
/**
 * Minimum width per note. Kept low because notes are beamed (compact); it only
 * acts as an overflow floor for very dense bars. Tuned so a bar packed with
 * sixteenths (16 notes) still lands near the beat-based ideal below rather than
 * ballooning the uniform measure width and forcing one-per-row.
 */
const PER_NOTE_MIN_WIDTH = 22;
/**
 * Model width per quarter note. Measure width is driven by the measure's
 * duration (beats) rather than its note count, so every bar of the same time
 * signature is the same size regardless of how many notes it holds.
 */
const QN_WIDTH = 90;
/** Gap between a row's bottom staff line and the next row's top staff line
 *  (model units). The staff's unused top padding overlaps the row above, so
 *  this is much smaller than STAVE_HEIGHT — rows sit close together. */
const WRAP_ROW_GAP = 44;
/** Measures per row in wrapped mode. */
const WRAP_MEASURES_PER_ROW = 2;
/** Fallback model width when the container hasn't been measured yet. */
const WRAP_FALLBACK_WIDTH = 760;
/**
 * Base visual scale for the rendered SVG. The internal model coordinates
 * (bounding boxes, hit testing) stay in 1x; the SVG's rendered pixels are
 * scaled via viewBox so the browser handles the upscaling crisply (still
 * vector). Click x and cursor x compensate by dividing/multiplying by the
 * effective scale. The effective scale is BASE_SCALE * zoom (see this.scale).
 */
const BASE_SCALE = 1.3;
/** User-zoom bounds, applied on top of BASE_SCALE. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.6;
/**
 * Scrolling-music mode: the cursor is anchored at this fraction of the
 * viewport's width and the staff translates underneath so that the playhead
 * is always under the cursor.
 */
const CURSOR_ANCHOR_FRACTION = 0.08;

/** Pixel distance the pointer must travel before we treat it as a drag. */
const DRAG_THRESHOLD_PX = 5;

interface MeasurePlacement {
  blockIndex: number;
  x: number;
  y: number;
  width: number;
  firstInRow: boolean;
  /** True only for the very first measure — gets the clef + time signature. */
  showHeader: boolean;
  system: number;
  /** True for the trailing no-notation gap box (not a real measure). */
  isGap?: boolean;
}

interface LayoutPlan {
  placements: MeasurePlacement[];
  totalWidth: number;
  stageHeight: number;
  systemPitch: number;
  systemCount: number;
}

class StaffRendererImpl implements ScoreRenderer {
  private container: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private viewportEl: HTMLDivElement | null = null;
  private rendererDiv: HTMLDivElement | null = null;
  private cursorEl: HTMLDivElement | null = null;
  private hoverCursorEl: HTMLDivElement | null = null;
  private dragOverlayEl: SVGRectElement | null = null;
  private aMarkerLineEl: SVGLineElement | null = null;
  private aMarkerLabelEl: SVGTextElement | null = null;
  private bMarkerLineEl: SVGLineElement | null = null;
  private bMarkerLabelEl: SVGTextElement | null = null;
  // Live "time remaining in this gap" text inside the gap box.
  private gapCountdownEl: SVGTextElement | null = null;
  // Lit-up backing rect for the measure the playhead is currently in.
  private measureHighlightEl: SVGRectElement | null = null;
  private hits: NoteHit[] = [];
  // The rendered `<g>` per note (parallel to `hits`) so the active note can light
  // up (orange tint + soft glow). We don't scale geometry: a beamed note's stem
  // is joined to a separately-drawn beam, so any resize detaches it.
  private noteEls: Array<{ group: SVGElement | null; isRest: boolean }> = [];
  // Per-measure geometry + start time, used to light the current measure.
  private measureGeoms: Array<{
    x: number;
    y: number;
    width: number;
    startMs: number;
  }> = [];
  private activeNoteIdx = -1;
  private activeMeasureIdx = -1;
  private systemRanges: Array<{ start: number; end: number }> = [];
  /** Right-edge model-x of each system's row (for end-of-row playhead sweep). */
  private systemRowEndX: number[] = [];
  // The staff's own playhead is hidden during no-notation gaps (a slow overlay
  // playhead takes over there); the staff itself stays visible.
  private cursorVisible = true;
  private seekListeners: Set<SeekListener> = new Set();
  private rangeListeners: Set<RangeListener> = new Set();
  private downHandler: ((e: PointerEvent) => void) | null = null;
  private moveHandler: ((e: PointerEvent) => void) | null = null;
  private upHandler: ((e: PointerEvent) => void) | null = null;
  private leaveHandler: ((e: PointerEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private totalWidth = 0;
  private stageHeight = 0;
  private totalDurationMs = 0;
  private startMs = 0;
  private viewportWidth = 0;
  private cursorAnchorPx = 0;

  // Wrapped-mode geometry.
  private layoutMode: StaffLayoutMode = 'scroll';
  private systemPitch = 0;
  private systemCount = 1;
  private lastBuildAvail = 0;
  private lastSystem = -1;

  // Stored so we can rebuild on resize (wrapped reflow) / mode change.
  private score: ScoreDocument | null = null;
  private trackIndex = 0;

  // Effective render scale = BASE_SCALE * user zoom. Changing it rebuilds the
  // staff (wrapped mode reflows to fit; scroll mode just renders larger).
  private scale = BASE_SCALE;

  // Trailing no-notation gap rendered as a gray box after the last measure. The
  // playhead sweeps through it over `gapMs` of (video) time once playback runs
  // past the notation. Zero gapMs = no box.
  private gapMs = 0;
  private gapLabel = '';
  private gapStartMs = 0; // score-internal ms at which the gap begins
  private gapBoxX = 0;
  private gapBoxY = 0;
  private gapBoxW = 0;
  private gapBoxSystem = 0;

  // Two independent time inputs. Playback drives the orange line; view
  // drives staff translation (scroll mode). They equal each other when
  // "follow playback" is on; the parent decouples them while scrubbing.
  private lastPlaybackMs = 0;
  private lastViewMs = 0;
  private lastLoopAMs: number | null = null;
  private lastLoopBMs: number | null = null;

  // Drag-selection state
  private dragStartModelX: number | null = null;
  private dragStartModelY: number | null = null;
  private dragCurrentModelX: number | null = null;
  private dragCurrentModelY: number | null = null;
  private dragIsActive = false;
  private boundPointerId: number | null = null;

  mount(
    el: HTMLElement,
    score: ScoreDocument,
    trackIndex: number,
    layoutMode: StaffLayoutMode = 'scroll',
    zoom = 1,
    trailingGapMs = 0,
    trailingGapLabel = ''
  ): void {
    this.destroy();
    this.container = el;
    this.score = score;
    this.trackIndex = trackIndex;
    this.layoutMode = layoutMode;
    this.scale = BASE_SCALE * clampZoom(zoom);
    this.gapMs = Math.max(0, trailingGapMs);
    this.gapLabel = trailingGapLabel;
    this.build();
  }

  /** Update the trailing gap box (duration + label) and rebuild. */
  setTrailingGap(ms: number, label: string): void {
    const next = Math.max(0, ms);
    if (Math.abs(next - this.gapMs) < 1 && label === this.gapLabel) return;
    this.gapMs = next;
    this.gapLabel = label;
    this.build();
  }

  /**
   * Re-render at a new user zoom. The playhead/loop time state is preserved
   * across the rebuild, and we keep the vertical scroll position roughly
   * anchored so zooming doesn't jump the view.
   */
  setZoom(zoom: number): void {
    const next = BASE_SCALE * clampZoom(zoom);
    if (Math.abs(next - this.scale) < 1e-4) return;
    const vp = this.viewportEl;
    const anchorRatio =
      vp && vp.scrollHeight > 0 ? vp.scrollTop / vp.scrollHeight : 0;
    this.scale = next;
    this.build();
    if (this.viewportEl && anchorRatio > 0) {
      this.viewportEl.scrollTop = anchorRatio * this.viewportEl.scrollHeight;
    }
  }

  /** Tear down DOM / handlers / observers but keep listeners + stored score. */
  private teardownDom(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.rendererDiv) {
      if (this.downHandler)
        this.rendererDiv.removeEventListener('pointerdown', this.downHandler);
      if (this.moveHandler)
        this.rendererDiv.removeEventListener('pointermove', this.moveHandler);
      if (this.upHandler) {
        this.rendererDiv.removeEventListener('pointerup', this.upHandler);
        this.rendererDiv.removeEventListener('pointercancel', this.upHandler);
      }
      if (this.leaveHandler)
        this.rendererDiv.removeEventListener('pointerleave', this.leaveHandler);
    }
    this.downHandler = null;
    this.moveHandler = null;
    this.upHandler = null;
    this.leaveHandler = null;
    if (this.container) this.container.innerHTML = '';
    this.renderer = null;
    this.viewportEl = null;
    this.rendererDiv = null;
    this.cursorEl = null;
    this.hoverCursorEl = null;
    this.dragOverlayEl = null;
    this.aMarkerLineEl = null;
    this.aMarkerLabelEl = null;
    this.bMarkerLineEl = null;
    this.bMarkerLabelEl = null;
    this.gapCountdownEl = null;
    this.measureHighlightEl = null;
    this.hits = [];
    this.noteEls = [];
    this.measureGeoms = [];
    this.activeNoteIdx = -1;
    this.activeMeasureIdx = -1;
    this.systemRanges = [];
    this.systemRowEndX = [];
    this.lastSystem = -1;
  }

  private computePlan(
    measureBlocks: ReturnType<typeof extractTrackEvents>,
    avail: number
  ): LayoutPlan {
    // Uniform measure width: every bar is the same size so the staff reads
    // evenly. The width is the widest single measure's requirement — enough for
    // its beats (QN_WIDTH per quarter) and, as a floor, its note count (so a
    // dense bar never spills past the barline).
    const needed = measureBlocks.map((b) => {
      const measureQN = (b.timeSignature[0] * 4) / b.timeSignature[1];
      return Math.max(
        measureQN * QN_WIDTH,
        Math.max(b.events.length, 1) * PER_NOTE_MIN_WIDTH
      );
    });
    const measureWidth = Math.max(...needed, PER_NOTE_MIN_WIDTH);
    // The trailing gap rides along as the last item in the flow so it sits
    // inline, right after the final measure (part of the staff), not on its own.
    const hasGap = this.gapMs > 0;

    if (this.layoutMode === 'scroll') {
      let x = SYSTEM_PADDING_X;
      const placements: MeasurePlacement[] = measureBlocks.map((_, i) => {
        const placement: MeasurePlacement = {
          blockIndex: i,
          x,
          y: STAVE_TOP,
          width: measureWidth,
          firstInRow: i === 0,
          showHeader: i === 0,
          system: 0,
        };
        x += measureWidth;
        return placement;
      });
      if (hasGap) {
        placements.push({
          blockIndex: -1,
          x,
          y: STAVE_TOP,
          width: GAP_BOX_W,
          firstInRow: false,
          showHeader: false,
          system: 0,
          isGap: true,
        });
        x += GAP_BOX_W;
      }
      return {
        placements,
        totalWidth: SYSTEM_PADDING_X + x,
        stageHeight: STAVE_TOP + STAVE_HEIGHT + 20,
        systemPitch: 0,
        systemCount: 1,
      };
    }

    // Wrapped: pack up to WRAP_MEASURES_PER_ROW items per row, but only as many
    // as fit without crowding. The gap box is the final item, so it shares the
    // last row with the measure(s) before it. Each row stretches to fill the
    // width so there's never empty space.
    const maxPerRow = Math.min(WRAP_MEASURES_PER_ROW, measureBlocks.length);
    const perRow = avail >= measureWidth * 2 ? maxPerRow : 1;
    const systemPitch = STAFF_LINE_SPAN + WRAP_ROW_GAP;
    const itemCount = measureBlocks.length + (hasGap ? 1 : 0);
    const systemCount = Math.max(1, Math.ceil(itemCount / perRow));

    const placements: MeasurePlacement[] = [];
    for (let i = 0; i < itemCount; i++) {
      const system = Math.floor(i / perRow);
      const col = i % perRow;
      const itemsInRow = Math.min(perRow, itemCount - system * perRow);
      const w = avail / itemsInRow;
      const base = {
        x: SYSTEM_PADDING_X + col * w,
        y: STAVE_TOP + system * systemPitch,
        width: w,
        firstInRow: col === 0,
        showHeader: i === 0,
        system,
      };
      placements.push(
        i < measureBlocks.length
          ? { blockIndex: i, ...base }
          : { blockIndex: -1, ...base, isGap: true }
      );
    }

    return {
      placements,
      totalWidth: SYSTEM_PADDING_X * 2 + avail,
      // Reserve a full staff footprint for the LAST row (pitch is tighter than
      // one staff, so earlier rows overlap their neighbour's top padding).
      stageHeight: STAVE_TOP + (systemCount - 1) * systemPitch + STAVE_HEIGHT + 20,
      systemPitch,
      systemCount,
    };
  }

  private build(): void {
    const el = this.container;
    const score = this.score;
    if (!el || !score) return;
    this.teardownDom();
    el.style.position = 'relative';

    const track = score.tracks[this.trackIndex];
    if (!track) return;

    const measureBlocks = extractTrackEvents(
      track,
      score.initialTimeSignature,
      score.initialKeyFifths
    );
    if (measureBlocks.length === 0) return;

    const wrapped = this.layoutMode === 'wrapped';
    const avail = wrapped
      ? Math.max(el.clientWidth / this.scale - SYSTEM_PADDING_X * 2, 240) ||
        WRAP_FALLBACK_WIDTH
      : 0;
    this.lastBuildAvail = avail;

    const plan = this.computePlan(measureBlocks, avail);
    this.totalWidth = plan.totalWidth;
    this.stageHeight = plan.stageHeight;
    this.systemPitch = plan.systemPitch;
    this.systemCount = plan.systemCount;

    // The gap box rides in the layout flow (computePlan) — read its geometry off
    // the placement so the cursor can sweep through it.
    const gapPlacement = plan.placements.find((p) => p.isGap) ?? null;
    if (gapPlacement) {
      this.gapBoxX = gapPlacement.x;
      this.gapBoxY = gapPlacement.y;
      this.gapBoxW = gapPlacement.width;
      this.gapBoxSystem = gapPlacement.system;
    } else {
      this.gapBoxW = 0;
    }

    // Right-edge model-x of each row (rows fill the full width). Used so the
    // playhead can sweep to the barline at a row break instead of freezing.
    this.systemRowEndX = Array.from({ length: this.systemCount }, () => 0);
    for (const p of plan.placements) {
      const right = p.x + p.width;
      if (right > this.systemRowEndX[p.system]) this.systemRowEndX[p.system] = right;
    }

    const scaledStageHeight = this.stageHeight * this.scale;

    // ---- DOM scaffold ----
    const viewport = document.createElement('div');
    Object.assign(viewport.style, {
      position: 'relative',
      width: '100%',
      height: wrapped ? '100%' : `${scaledStageHeight}px`,
      overflowX: 'hidden',
      overflowY: wrapped ? 'auto' : 'hidden',
    } as CSSStyleDeclaration);
    el.appendChild(viewport);
    el.style.height = wrapped ? '100%' : `${scaledStageHeight}px`;
    this.viewportEl = viewport;

    const rendererDiv = document.createElement('div');
    rendererDiv.style.position = wrapped ? 'relative' : 'absolute';
    rendererDiv.style.top = '0';
    rendererDiv.style.left = '0';
    rendererDiv.style.width = `${this.totalWidth * this.scale}px`;
    rendererDiv.style.height = `${scaledStageHeight}px`;
    rendererDiv.style.willChange = 'transform';
    rendererDiv.style.cursor = 'default';
    rendererDiv.style.userSelect = 'none';
    (rendererDiv.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
      'none';
    rendererDiv.style.touchAction = 'none';
    viewport.appendChild(rendererDiv);
    this.rendererDiv = rendererDiv;

    this.renderer = new Renderer(rendererDiv, Renderer.Backends.SVG);
    this.renderer.resize(this.totalWidth, this.stageHeight);
    const ctx = this.renderer.getContext();

    // ---- Draw staves per the plan ----
    const allNotes: Array<{
      vexNote: StaveNote;
      descriptor: VexEventDescriptor;
      system: number;
    }> = [];

    this.measureGeoms = [];
    for (const p of plan.placements) {
      if (p.isGap) continue; // the gap box is drawn separately, below
      const block = measureBlocks[p.blockIndex];
      this.measureGeoms.push({
        x: p.x,
        y: p.y,
        width: p.width,
        startMs: qnToTrackMs(track, score, block.events[0]?.qnStart ?? 0),
      });
      const stave = new Stave(p.x, p.y, p.width);
      const repeat = block.measure.repeat;
      if (repeat?.offset === 0) stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      if (repeat && repeat.offset === repeat.length - 1) {
        stave.setEndBarType(BarlineType.REPEAT_END);
        ctx.save();
        ctx.setFont('Arial', 12);
        ctx.fillText(`${repeat.count}×`, p.x + p.width - 30, p.y + 14);
        ctx.restore();
      }
      if (p.showHeader) {
        stave.addClef('treble').addTimeSignature(
          `${block.timeSignature[0]}/${block.timeSignature[1]}`
        );
      }
      // Bolder staff lines, then back to default weight for notes/stems/beams.
      ctx.setLineWidth(STAFF_LINE_WIDTH);
      stave.setContext(ctx).draw();
      ctx.setLineWidth(1);

      const vexNotes = block.events.map((d) => descriptorToStaveNote(d));

      const voice = new Voice({
        numBeats: block.timeSignature[0],
        beatValue: block.timeSignature[1],
      });
      voice.setStrict(false);
      voice.addTickables(vexNotes);

      // Justify into the note area only — for first-in-row measures the clef +
      // time signature consume the lead-in, so we keep the formatter inside
      // that span and notes never spill past the barline.
      const justify =
        p.width - (p.showHeader ? FIRST_MEASURE_EXTRA_WIDTH : 0) - 20;
      new Formatter().joinVoices([voice]).format([voice], Math.max(40, justify));

      // Beam connectable notes (eighths and shorter); rests break the beam.
      const beams = Beam.generateBeams(vexNotes, { beamRests: false });

      voice.draw(ctx, stave);
      beams.forEach((beam) => beam.setContext(ctx).draw());

      block.events.forEach((d, idx) => {
        allNotes.push({ vexNote: vexNotes[idx], descriptor: d, system: p.system });
      });
    }

    // ---- Capture hit boxes + ms positions ----
    this.totalDurationMs = qnToTrackMs(track, score, qnAtEnd(measureBlocks));
    this.startMs = 0;

    // The gap occupies score-time [notationEnd, notationEnd + gapMs]; extend the
    // total so the playhead can travel into the gap box.
    this.gapStartMs = this.totalDurationMs;
    if (this.gapMs > 0) this.totalDurationMs += this.gapMs;

    this.hits = allNotes.map(({ vexNote, descriptor, system }) => {
      const bbox = vexNote.getBoundingBox();
      return {
        qn: descriptor.qnStart,
        ms: qnToTrackMs(track, score, descriptor.qnStart),
        measure: lookupMeasureNumber(measureBlocks, descriptor.qnStart),
        beat: descriptor.beatInMeasure,
        x: bbox.getX(),
        y: bbox.getY(),
        width: bbox.getW(),
        height: bbox.getH(),
        system,
      };
    });

    // Prep each note so it can smoothly light up while the playhead is on it:
    // the group color drives the currentColor of its glyphs, and a drop-shadow
    // adds a soft glow. No geometry changes — those detach beamed notes.
    this.activeNoteIdx = -1;
    this.noteEls = allNotes.map(({ vexNote, descriptor }) => {
      const group = vexNote.getSVGElement() ?? null;
      if (group) group.style.transition = 'color 120ms ease, filter 120ms ease';
      return { group, isRest: descriptor.isRest };
    });

    // Contiguous hit ranges per system (hits are pushed row-by-row, left to right).
    this.systemRanges = Array.from({ length: this.systemCount }, () => ({
      start: -1,
      end: -1,
    }));
    this.hits.forEach((h, k) => {
      const r = this.systemRanges[h.system];
      if (!r) return;
      if (r.start === -1) r.start = k;
      r.end = k + 1;
    });

    // ---- Cursor (playhead) ----
    this.cursorEl = document.createElement('div');
    Object.assign(this.cursorEl.style, {
      position: 'absolute',
      top: `${(STAVE_TOP + STAFF_LINE_TOP - CURSOR_OVERHANG) * this.scale}px`,
      left: '0px',
      width: `${2 * this.scale}px`,
      height: `${(STAFF_LINE_SPAN + 2 * CURSOR_OVERHANG) * this.scale}px`,
      background: 'hsl(30 85% 55%)',
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      opacity: '0.85',
    } as CSSStyleDeclaration);
    // In scroll mode the cursor lives in the viewport (fixed anchor, clipped).
    // In wrapped mode it lives in the scrolling content so it tracks the row.
    (wrapped ? rendererDiv : viewport).appendChild(this.cursorEl);

    // ---- Hover-preview cursor (ghost playhead showing where a click lands) ----
    this.hoverCursorEl = document.createElement('div');
    Object.assign(this.hoverCursorEl.style, {
      position: 'absolute',
      top: `${(STAVE_TOP + STAFF_LINE_TOP - CURSOR_OVERHANG) * this.scale}px`,
      left: '0px',
      width: `${2 * this.scale}px`,
      height: `${(STAFF_LINE_SPAN + 2 * CURSOR_OVERHANG) * this.scale}px`,
      background: 'hsl(30 85% 55%)',
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      opacity: '0',
    } as CSSStyleDeclaration);
    (wrapped ? rendererDiv : viewport).appendChild(this.hoverCursorEl);

    // ---- Resize handling ----
    const onResize = () => {
      if (this.layoutMode === 'wrapped') {
        // Reflow depends on width — rebuild, but debounce so dragging the
        // pane reflows on release rather than every frame.
        const nextAvail = Math.max(
          (this.container?.clientWidth ?? 0) / this.scale - SYSTEM_PADDING_X * 2,
          240
        );
        if (Math.abs(nextAvail - this.lastBuildAvail) < 16) return;
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.resizeTimer = null;
          this.build();
        }, 150);
        return;
      }
      this.viewportWidth = viewport.clientWidth;
      this.cursorAnchorPx = this.viewportWidth * CURSOR_ANCHOR_FRACTION;
      this.applyLayout();
    };
    this.viewportWidth = viewport.clientWidth;
    this.cursorAnchorPx = this.viewportWidth * CURSOR_ANCHOR_FRACTION;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(onResize);
      this.resizeObserver.observe(viewport);
    }

    // ---- Theme + SVG overlays (bg, drag overlay, loop markers) ----
    const svg = rendererDiv.querySelector('svg') as SVGSVGElement | null;
    if (svg) {
      themeVexflowSvg(svg);
      const scaledWidth = this.totalWidth * this.scale;
      const scaledHeight = this.stageHeight * this.scale;
      svg.setAttribute('viewBox', `0 0 ${this.totalWidth} ${this.stageHeight}`);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      svg.setAttribute('width', `${scaledWidth}`);
      svg.setAttribute('height', `${scaledHeight}`);
      svg.style.width = `${scaledWidth}px`;
      svg.style.height = `${scaledHeight}px`;
      svg.style.cursor = 'default';
      svg.style.userSelect = 'none';
      (svg.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
        'none';
      svg.style.touchAction = 'none';
      svg.style.pointerEvents = 'none';

      const NS = 'http://www.w3.org/2000/svg';

      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('data-playsense-studio-staff-bg', 'true');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', `${this.totalWidth}`);
      bg.setAttribute('height', `${this.stageHeight}`);
      bg.setAttribute('fill', 'transparent');
      svg.insertBefore(bg, svg.firstChild);

      // ---- Current-measure highlight (sits just above the bg, behind notes) ----
      const measureHl = document.createElementNS(NS, 'rect');
      measureHl.setAttribute('data-playsense-studio-active-measure', 'true');
      measureHl.setAttribute('rx', '7');
      measureHl.setAttribute('opacity', '0');
      measureHl.setAttribute('pointer-events', 'none');
      svg.insertBefore(measureHl, bg.nextSibling);
      this.measureHighlightEl = measureHl;

      // ---- Trailing gap box (gray fill + continuing staff lines + label) ----
      if (this.gapMs > 0 && this.gapBoxW > 0) {
        const x = this.gapBoxX;
        const w = this.gapBoxW;
        const lineTop = this.gapBoxY + STAFF_LINE_TOP;
        const boxTop = lineTop - 12;
        const boxH = STAFF_LINE_SPAN + 24;

        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('data-playsense-studio-gap-box', 'true');
        box.setAttribute('x', `${x}`);
        box.setAttribute('y', `${boxTop}`);
        box.setAttribute('width', `${w}`);
        box.setAttribute('height', `${boxH}`);
        box.setAttribute('rx', '3');
        box.setAttribute('fill', 'hsl(0 0% 50% / 0.16)');
        box.setAttribute('pointer-events', 'none');
        svg.appendChild(box);

        for (let i = 0; i < 5; i++) {
          const y = lineTop + i * 10;
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('data-playsense-studio-gap-line', 'true');
          ln.setAttribute('x1', `${x}`);
          ln.setAttribute('y1', `${y}`);
          ln.setAttribute('x2', `${x + w}`);
          ln.setAttribute('y2', `${y}`);
          ln.setAttribute('stroke', 'hsl(0 0% 62% / 0.4)');
          ln.setAttribute('stroke-width', `${STAFF_LINE_WIDTH}`);
          ln.setAttribute('pointer-events', 'none');
          svg.appendChild(ln);
        }

        const cx = x + w / 2;
        const midY = lineTop + STAFF_LINE_SPAN / 2;

        // Live countdown (time remaining in this gap, m:ss) — updated each frame.
        const countdown = document.createElementNS(NS, 'text');
        countdown.setAttribute('data-playsense-studio-gap-text', 'true');
        countdown.setAttribute('x', `${cx}`);
        countdown.setAttribute('y', `${midY - 1}`);
        countdown.setAttribute('text-anchor', 'middle');
        countdown.setAttribute('font-size', '16');
        countdown.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        countdown.setAttribute('font-weight', '700');
        countdown.setAttribute('pointer-events', 'none');
        countdown.textContent = this.gapLabel || formatGapTime(this.gapMs);
        svg.appendChild(countdown);
        this.gapCountdownEl = countdown;

        // Total gap length (static).
        const total = document.createElementNS(NS, 'text');
        total.setAttribute('data-playsense-studio-gap-text', 'true');
        total.setAttribute('x', `${cx}`);
        total.setAttribute('y', `${midY + 16}`);
        total.setAttribute('text-anchor', 'middle');
        total.setAttribute('font-size', '10.5');
        total.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        total.setAttribute('font-weight', '600');
        total.setAttribute('opacity', '0.7');
        total.setAttribute('pointer-events', 'none');
        total.textContent = `of ${this.gapLabel || formatGapTime(this.gapMs)}`;
        svg.appendChild(total);
      }

      const overlay = document.createElementNS(NS, 'rect');
      overlay.setAttribute('data-playsense-studio-drag-overlay', 'true');
      overlay.setAttribute('y', `${STAVE_TOP - 4}`);
      overlay.setAttribute('height', `${STAVE_HEIGHT + 8}`);
      overlay.setAttribute('fill', 'hsl(var(--primary))');
      overlay.setAttribute('stroke', 'hsl(var(--primary))');
      overlay.setAttribute('stroke-width', '1.5');
      overlay.setAttribute('opacity', '0');
      overlay.setAttribute('pointer-events', 'none');
      svg.appendChild(overlay);
      this.dragOverlayEl = overlay;

      const buildMarker = (label: 'A' | 'B') => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('data-playsense-studio-loop-marker', label);
        line.setAttribute('y1', `${STAVE_TOP - 14}`);
        line.setAttribute('y2', `${STAVE_TOP + STAVE_HEIGHT + 8}`);
        line.setAttribute('stroke', 'hsl(var(--gold-highlight))');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '5 4');
        line.setAttribute('opacity', '0');
        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('data-playsense-studio-loop-marker', label);
        text.setAttribute('y', `${STAVE_TOP - 18}`);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        text.setAttribute('font-weight', '700');
        text.setAttribute('fill', 'hsl(var(--gold-highlight))');
        text.setAttribute('opacity', '0');
        text.setAttribute('pointer-events', 'none');
        text.textContent = label;
        svg.appendChild(text);
        return { line, text };
      };
      const a = buildMarker('A');
      const b = buildMarker('B');
      this.aMarkerLineEl = a.line;
      this.aMarkerLabelEl = a.text;
      this.bMarkerLineEl = b.line;
      this.bMarkerLabelEl = b.text;

      // ---- Pointer handlers (capture both axes for wrapped hit testing) ----
      const target = rendererDiv;
      this.downHandler = (event: PointerEvent) => {
        event.preventDefault();
        this.hideHoverCursor();
        const rect = target.getBoundingClientRect();
        this.dragStartModelX = (event.clientX - rect.left) / this.scale;
        this.dragStartModelY = (event.clientY - rect.top) / this.scale;
        this.dragCurrentModelX = this.dragStartModelX;
        this.dragCurrentModelY = this.dragStartModelY;
        this.dragIsActive = false;
        this.boundPointerId = event.pointerId;
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          /* setPointerCapture may fail on some browsers; degrades gracefully */
        }
      };
      this.moveHandler = (event: PointerEvent) => {
        // Not in a drag: show the ghost playhead where a click would land.
        if (this.dragStartModelX === null) {
          const rect = target.getBoundingClientRect();
          this.updateHoverCursor(
            (event.clientX - rect.left) / this.scale,
            (event.clientY - rect.top) / this.scale
          );
          return;
        }
        if (this.boundPointerId !== event.pointerId) return;
        event.preventDefault();
        const rect = target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.scale;
        const y = (event.clientY - rect.top) / this.scale;
        this.dragCurrentModelX = x;
        this.dragCurrentModelY = y;
        const delta = Math.abs((x - this.dragStartModelX) * this.scale);
        if (!this.dragIsActive && delta >= DRAG_THRESHOLD_PX) {
          this.dragIsActive = true;
        }
        if (this.dragIsActive) this.updateDragOverlay();
      };
      this.upHandler = (event: PointerEvent) => {
        if (
          this.dragStartModelX === null ||
          this.boundPointerId !== event.pointerId
        )
          return;
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {
          /* noop */
        }

        if (this.dragIsActive) {
          const startX = Math.min(
            this.dragStartModelX,
            this.dragCurrentModelX ?? this.dragStartModelX
          );
          const endX = Math.max(
            this.dragStartModelX,
            this.dragCurrentModelX ?? this.dragStartModelX
          );
          const startPos = this.xToTimePosition(startX, this.dragStartModelY ?? STAVE_TOP);
          const endPos = this.xToTimePosition(endX, this.dragCurrentModelY ?? this.dragStartModelY ?? STAVE_TOP);
          const lo = Math.min(startPos.ms, endPos.ms);
          const hi = Math.max(startPos.ms, endPos.ms);
          if (hi > lo) {
            const loQn = Math.min(startPos.qn, endPos.qn);
            const hiQn = Math.max(startPos.qn, endPos.qn);
            const range: SelectedRange = {
              startMs: lo,
              endMs: hi,
              startQn: loQn,
              endQn: hiQn,
            };
            for (const listener of this.rangeListeners) listener(range);
          }
        } else {
          const pos = this.xToTimePosition(
            this.dragStartModelX,
            this.dragStartModelY ?? STAVE_TOP
          );
          for (const listener of this.seekListeners) {
            listener({ qn: pos.qn, measure: pos.measure, beat: pos.beat });
          }
        }

        this.dragStartModelX = null;
        this.dragStartModelY = null;
        this.dragCurrentModelX = null;
        this.dragCurrentModelY = null;
        this.dragIsActive = false;
        this.boundPointerId = null;
        this.hideDragOverlay();
      };

      this.leaveHandler = () => this.hideHoverCursor();

      target.addEventListener('pointerdown', this.downHandler);
      target.addEventListener('pointermove', this.moveHandler);
      target.addEventListener('pointerup', this.upHandler);
      target.addEventListener('pointercancel', this.upHandler);
      target.addEventListener('pointerleave', this.leaveHandler);
    }

    // Re-apply playback position + loop markers (rebuild keeps the time state).
    this.lastSystem = -1;
    this.applyLayout();
    this.setLoopMarkers(this.lastLoopAMs, this.lastLoopBMs);
  }

  private updateDragOverlay(): void {
    if (
      !this.dragOverlayEl ||
      this.dragStartModelX === null ||
      this.dragCurrentModelX === null
    )
      return;
    const a = Math.min(this.dragStartModelX, this.dragCurrentModelX);
    const b = Math.max(this.dragStartModelX, this.dragCurrentModelX);
    this.dragOverlayEl.setAttribute('x', `${a}`);
    this.dragOverlayEl.setAttribute('width', `${Math.max(b - a, 1)}`);
    if (this.layoutMode === 'wrapped') {
      const system = this.systemFromY(this.dragStartModelY ?? STAVE_TOP);
      const yTop = STAVE_TOP + system * this.systemPitch;
      this.dragOverlayEl.setAttribute('y', `${yTop - 4}`);
      this.dragOverlayEl.setAttribute('height', `${STAVE_HEIGHT + 8}`);
    }
    this.dragOverlayEl.setAttribute('opacity', '0.28');
  }

  private hideDragOverlay(): void {
    if (!this.dragOverlayEl) return;
    this.dragOverlayEl.setAttribute('opacity', '0');
  }

  setCursorVisible(visible: boolean): void {
    if (this.cursorVisible === visible) return;
    this.cursorVisible = visible;
    this.applyLayout();
  }

  setTimeMs(ms: number): void {
    this.lastPlaybackMs = ms;
    this.applyLayout();
  }

  setViewMs(ms: number): void {
    this.lastViewMs = ms;
    this.applyLayout();
  }

  getTotalDurationMs(): number {
    return this.totalDurationMs;
  }

  setLoopMarkers(aMs: number | null, bMs: number | null): void {
    this.lastLoopAMs = aMs;
    this.lastLoopBMs = bMs;
    this.placeMarker(this.aMarkerLineEl, this.aMarkerLabelEl, aMs);
    this.placeMarker(this.bMarkerLineEl, this.bMarkerLabelEl, bMs);
  }

  private placeMarker(
    line: SVGLineElement | null,
    label: SVGTextElement | null,
    ms: number | null
  ): void {
    if (!line || !label) return;
    if (ms === null) {
      line.setAttribute('opacity', '0');
      label.setAttribute('opacity', '0');
      return;
    }
    const pos = this.msToCursorPos(ms);
    const yTop =
      this.layoutMode === 'wrapped'
        ? STAVE_TOP + pos.system * this.systemPitch
        : STAVE_TOP;
    line.setAttribute('x1', `${pos.x}`);
    line.setAttribute('x2', `${pos.x}`);
    line.setAttribute('y1', `${yTop - 14}`);
    line.setAttribute('y2', `${yTop + STAVE_HEIGHT + 8}`);
    line.setAttribute('opacity', '0.85');
    label.setAttribute('x', `${pos.x}`);
    label.setAttribute('y', `${yTop - 18}`);
    label.setAttribute('opacity', '1');
  }

  private updateGapCountdown(): void {
    if (!this.gapCountdownEl || this.gapMs <= 0) return;
    const elapsed = Math.max(0, this.lastPlaybackMs - this.gapStartMs);
    const remainMs = Math.max(0, this.gapMs - elapsed);
    this.gapCountdownEl.textContent = formatGapTime(remainMs);
  }

  /** Rightmost index in `arr` whose `.startMs`/`.ms` is <= ms, or -1. */
  private indexAtOrBefore(
    arr: ReadonlyArray<{ startMs: number } | { ms: number }>,
    ms: number,
    key: 'startMs' | 'ms'
  ): number {
    if (arr.length === 0) return -1;
    const at = (i: number) => (arr[i] as Record<string, number>)[key];
    if (ms < at(0)) return 0; // playhead clamps to the start
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (at(mid) <= ms) lo = mid;
      else hi = mid;
    }
    return at(hi) <= ms ? hi : lo;
  }

  /** Light up the measure the playhead is currently inside. */
  private updateActiveMeasure(): void {
    if (!this.measureHighlightEl) return;
    const inGap = this.lastPlaybackMs >= this.gapStartMs;
    const idx =
      this.cursorVisible && !inGap
        ? this.indexAtOrBefore(this.measureGeoms, this.lastPlaybackMs, 'startMs')
        : -1;
    if (idx === this.activeMeasureIdx) return;
    this.activeMeasureIdx = idx;
    if (idx < 0) {
      this.measureHighlightEl.setAttribute('opacity', '0');
      return;
    }
    const g = this.measureGeoms[idx];
    // Keep the bright core a little inside the staff and barlines; the heavy CSS
    // blur spreads it outward into a soft glow.
    const padY = 4;
    const inset = 10;
    this.measureHighlightEl.setAttribute('x', `${g.x + inset}`);
    this.measureHighlightEl.setAttribute('y', `${g.y + STAFF_LINE_TOP - padY}`);
    this.measureHighlightEl.setAttribute('width', `${Math.max(g.width - inset * 2, 1)}`);
    this.measureHighlightEl.setAttribute('height', `${STAFF_LINE_SPAN + padY * 2}`);
    this.measureHighlightEl.setAttribute('opacity', '1');
  }

  /** Grow + tint the note the playhead is currently on; reset the previous. */
  private updateActiveNote(): void {
    if (this.noteEls.length === 0) return;
    const inGap = this.lastPlaybackMs >= this.gapStartMs;
    let idx =
      this.cursorVisible && !inGap
        ? this.indexAtOrBefore(this.hits, this.lastPlaybackMs, 'ms')
        : -1;
    if (idx >= 0 && this.noteEls[idx]?.isRest) idx = -1; // rests don't animate
    if (idx === this.activeNoteIdx) return;

    const prev = this.noteEls[this.activeNoteIdx]?.group;
    if (prev) {
      prev.style.color = '';
      prev.style.filter = '';
    }
    const next = this.noteEls[idx]?.group;
    if (next) {
      next.style.color = 'hsl(var(--primary))';
      next.style.filter = 'drop-shadow(0 0 2.5px hsl(var(--primary) / 0.9))';
    }
    this.activeNoteIdx = idx;
  }

  private applyLayout(): void {
    if (!this.rendererDiv || !this.cursorEl) return;

    this.updateGapCountdown();
    // These live inside the SVG (model coords), so they work in both modes
    // without per-mode handling.
    this.updateActiveMeasure();
    this.updateActiveNote();

    if (this.layoutMode === 'wrapped') {
      this.rendererDiv.style.transform = 'none';
      const pos = this.msToCursorPos(this.lastPlaybackMs);
      const x = pos.x * this.scale;
      const top =
        (STAVE_TOP + pos.system * this.systemPitch + STAFF_LINE_TOP - CURSOR_OVERHANG) *
        this.scale;
      this.cursorEl.style.top = `${top}px`;
      this.cursorEl.style.transform = `translateX(${x}px)`;
      this.cursorEl.style.opacity =
        this.cursorVisible && this.hits.length > 0 ? '0.9' : '0';

      // Keep the active row in view.
      if (this.viewportEl && pos.system !== this.lastSystem) {
        this.lastSystem = pos.system;
        const bandTop = (STAVE_TOP + pos.system * this.systemPitch) * this.scale;
        const bandBottom = bandTop + STAVE_HEIGHT * this.scale;
        const vh = this.viewportEl.clientHeight;
        const st = this.viewportEl.scrollTop;
        if (bandTop < st || bandBottom > st + vh) {
          this.viewportEl.scrollTop = Math.max(0, bandTop - 24);
        }
      }
      return;
    }

    // Scroll mode: translate the staff so viewMs lands at the anchor.
    const viewScaledX = this.msToCursorX(this.lastViewMs) * this.scale;
    const playbackScaledX = this.msToCursorX(this.lastPlaybackMs) * this.scale;

    const staffTranslate = this.cursorAnchorPx - viewScaledX;
    this.rendererDiv.style.transform = `translateX(${staffTranslate}px)`;

    const cursorX = this.cursorAnchorPx + (playbackScaledX - viewScaledX);
    this.cursorEl.style.transform = `translateX(${cursorX}px)`;
    const visible = cursorX >= -2 && cursorX <= this.viewportWidth + 2;
    this.cursorEl.style.opacity = this.cursorVisible && visible ? '0.85' : '0';
  }

  /** Place the translucent ghost playhead at the click-landing position for a
   *  hovered (model-space) point. Reuses the exact click → seek math. */
  private updateHoverCursor(modelX: number, modelY: number): void {
    if (!this.hoverCursorEl || this.hits.length === 0) return;
    const pos = this.xToTimePosition(modelX, modelY);
    const cur = this.msToCursorPos(pos.ms);
    if (this.layoutMode === 'wrapped') {
      const top =
        (STAVE_TOP + cur.system * this.systemPitch + STAFF_LINE_TOP - CURSOR_OVERHANG) *
        this.scale;
      this.hoverCursorEl.style.top = `${top}px`;
      this.hoverCursorEl.style.transform = `translateX(${cur.x * this.scale}px)`;
    } else {
      const hoverX =
        this.cursorAnchorPx +
        (this.msToCursorX(pos.ms) - this.msToCursorX(this.lastViewMs)) * this.scale;
      this.hoverCursorEl.style.transform = `translateX(${hoverX}px)`;
    }
    this.hoverCursorEl.style.opacity = '0.45';
  }

  private hideHoverCursor(): void {
    if (this.hoverCursorEl) this.hoverCursorEl.style.opacity = '0';
  }

  onSeek(listener: SeekListener): () => void {
    this.seekListeners.add(listener);
    return () => this.seekListeners.delete(listener);
  }

  onSelectRange(listener: RangeListener): () => void {
    this.rangeListeners.add(listener);
    return () => this.rangeListeners.delete(listener);
  }

  destroy(): void {
    this.teardownDom();
    if (this.container) this.container.style.height = '';
    this.container = null;
    this.score = null;
    this.scale = BASE_SCALE;
    this.gapMs = 0;
    this.gapLabel = '';
    this.gapStartMs = 0;
    this.gapBoxW = 0;
    this.seekListeners.clear();
    this.rangeListeners.clear();
    this.totalWidth = 0;
    this.stageHeight = 0;
    this.totalDurationMs = 0;
    this.viewportWidth = 0;
    this.cursorAnchorPx = 0;
    this.systemPitch = 0;
    this.systemCount = 1;
    this.lastBuildAvail = 0;
    this.lastPlaybackMs = 0;
    this.lastViewMs = 0;
    this.lastLoopAMs = null;
    this.lastLoopBMs = null;
    this.dragStartModelX = null;
    this.dragStartModelY = null;
    this.dragCurrentModelX = null;
    this.dragCurrentModelY = null;
    this.dragIsActive = false;
    this.boundPointerId = null;
  }

  private msToCursorX(ms: number): number {
    return this.msToCursorPos(ms).x;
  }

  /** Interpolate ms → model x, and report which system that x lives on. */
  private msToCursorPos(ms: number): { x: number; system: number } {
    if (this.hits.length === 0) return { x: 0, system: 0 };
    const clamped = Math.max(this.startMs, Math.min(ms, this.totalDurationMs));

    // Inside the trailing gap box: sweep linearly across the box.
    if (this.gapMs > 0 && clamped >= this.gapStartMs) {
      const t = Math.min(1, (clamped - this.gapStartMs) / this.gapMs);
      return {
        x: this.gapBoxX + t * this.gapBoxW,
        system: this.gapBoxSystem,
      };
    }

    if (clamped <= this.hits[0].ms) {
      return { x: this.hits[0].x, system: this.hits[0].system };
    }
    const lastIdx = this.hits.length - 1;
    const last = this.hits[lastIdx];
    if (clamped >= last.ms) {
      if (lastIdx >= 1) {
        const prev = this.hits[lastIdx - 1];
        const slope = (last.x - prev.x) / Math.max(last.ms - prev.ms, 1);
        // Extrapolation only makes sense within the last system's row.
        const x =
          prev.system === last.system
            ? last.x + (clamped - last.ms) * slope
            : last.x;
        return { x, system: last.system };
      }
      return { x: last.x, system: last.system };
    }

    let lo = 0;
    let hi = lastIdx;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (this.hits[mid].ms <= clamped) lo = mid;
      else hi = mid;
    }
    const a = this.hits[lo];
    const b = this.hits[hi];
    // If the interval spans a row break, sweep from the last note of the row to
    // that row's right edge over the interval, then the next bracket (first note
    // of the next row) takes over — so the playhead glides to the barline and
    // jumps down at the downbeat instead of freezing on the last note.
    if (a.system !== b.system) {
      const rowEnd = this.systemRowEndX[a.system] ?? a.x;
      const t = (clamped - a.ms) / Math.max(b.ms - a.ms, 1);
      return { x: a.x + t * (rowEnd - a.x), system: a.system };
    }
    const t = (clamped - a.ms) / Math.max(b.ms - a.ms, 1);
    return { x: a.x + t * (b.x - a.x), system: a.system };
  }

  private systemFromY(y: number): number {
    if (this.layoutMode !== 'wrapped' || this.systemPitch <= 0) return 0;
    const s = Math.floor((y - STAVE_TOP) / this.systemPitch);
    return Math.max(0, Math.min(this.systemCount - 1, s));
  }

  /**
   * Map a model-space (x, y) to a continuous time position. In wrapped mode we
   * first pick the system from y, then interpolate within that row's notes.
   */
  private xToTimePosition(
    x: number,
    y: number
  ): { ms: number; qn: number; measure: number; beat: number } {
    if (this.hits.length === 0) return { ms: 0, qn: 0, measure: 1, beat: 1 };

    let loIdx = 0;
    let hiIdx = this.hits.length - 1;
    if (this.layoutMode === 'wrapped') {
      const system = this.systemFromY(y);
      const range = this.systemRanges[system];
      if (range && range.start !== -1) {
        loIdx = range.start;
        hiIdx = range.end - 1;
      }
    }
    return this.interpInRange(x, loIdx, hiIdx);
  }

  private interpInRange(
    x: number,
    loIdx: number,
    hiIdx: number
  ): { ms: number; qn: number; measure: number; beat: number } {
    if (hiIdx <= loIdx) {
      const only = this.hits[loIdx] ?? this.hits[0];
      return { ms: only.ms, qn: only.qn, measure: only.measure, beat: only.beat };
    }
    const first = this.hits[loIdx];
    const last = this.hits[hiIdx];

    if (x <= first.x) {
      const second = this.hits[loIdx + 1];
      const denom = Math.max(second.x - first.x, 1);
      const t = (x - first.x) / denom;
      return {
        ms: Math.max(0, first.ms + t * (second.ms - first.ms)),
        qn: Math.max(0, first.qn + t * (second.qn - first.qn)),
        measure: first.measure,
        beat: first.beat,
      };
    }
    if (x >= last.x) {
      const prev = this.hits[hiIdx - 1];
      const denom = Math.max(last.x - prev.x, 1);
      const t = (x - prev.x) / denom;
      return {
        ms: prev.ms + t * (last.ms - prev.ms),
        qn: prev.qn + t * (last.qn - prev.qn),
        measure: last.measure,
        beat: last.beat,
      };
    }

    let lo = loIdx;
    let hi = hiIdx;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (this.hits[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = this.hits[lo];
    const b = this.hits[hi];
    const denom = Math.max(b.x - a.x, 1);
    const t = (x - a.x) / denom;
    return {
      ms: a.ms + t * (b.ms - a.ms),
      qn: a.qn + t * (b.qn - a.qn),
      measure: t < 0.5 ? a.measure : b.measure,
      beat: t < 0.5 ? a.beat : b.beat,
    };
  }
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

function formatGapTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

function qnAtEnd(blocks: ReturnType<typeof extractTrackEvents>): number {
  if (blocks.length === 0) return 0;
  const last = blocks[blocks.length - 1];
  const ts = last.timeSignature;
  return last.cumulativeQN + (ts[0] * 4) / ts[1];
}

function lookupMeasureNumber(
  blocks: ReturnType<typeof extractTrackEvents>,
  qn: number
): number {
  let last = blocks[0]?.measure.number ?? 1;
  for (const b of blocks) {
    if (b.cumulativeQN > qn) break;
    last = b.measure.number;
  }
  return last;
}

// ---------------------------------------------------------------------------
// React wrapper
// ---------------------------------------------------------------------------

export interface StaffRendererProps {
  score: ScoreDocument;
  trackIndex: number;
  /** Score-relative ms of the playhead (drives the orange line). */
  currentMs: number;
  /** Score-relative ms anchored at the cursor anchor. Defaults to currentMs (auto-follow). */
  viewMs?: number;
  /** Score-relative ms of the loop start marker on the staff (null = hidden). */
  loopAMs?: number | null;
  /** Score-relative ms of the loop end marker on the staff (null = hidden). */
  loopBMs?: number | null;
  /** 'wrapped' stacks staves vertically; 'scroll' is one horizontal line. */
  layoutMode?: StaffLayoutMode;
  /** User zoom multiplier on top of the base scale (default 1). */
  zoom?: number;
  /** Hide the staff's own playhead (e.g. before any notation begins). */
  showCursor?: boolean;
  /** Trailing no-notation gap drawn as a gray box after the last measure. */
  trailingGapMs?: number;
  trailingGapLabel?: string;
  onSeek?: (target: SeekTarget) => void;
  /** Fires when the user click-and-drags a range across the staff. */
  onSelectRange?: (range: SelectedRange) => void;
  /** Fires once after mount with the active track's total duration in ms. */
  onDurationKnown?: (ms: number) => void;
  className?: string;
}

export function StaffRenderer(props: StaffRendererProps) {
  const projection = useMemo(() => repeatProjection(props.score, props.trackIndex), [props.score, props.trackIndex]);
  if (!projection) return <StaffRendererView {...props} />;
  const map = projection.toCompactMs;
  const original = (qn: number) => projection.toOriginalQN(qn, props.currentMs);
  const track = props.score.tracks[props.trackIndex];
  return <StaffRendererView {...props}
    score={projection.score}
    currentMs={map(props.currentMs)}
    viewMs={props.viewMs == null ? undefined : map(props.viewMs)}
    loopAMs={props.loopAMs == null ? props.loopAMs : map(props.loopAMs)}
    loopBMs={props.loopBMs == null ? props.loopBMs : map(props.loopBMs)}
    onSeek={target => props.onSeek?.({ ...target, ...original(target.qn) })}
    onSelectRange={range => {
      const start = original(range.startQn);
      const end = projection.toOriginalQN(range.endQn, props.currentMs, true);
      props.onSelectRange?.({ startQn: start.qn, endQn: end.qn,
        startMs: qnToTrackMs(track, props.score, start.qn), endMs: qnToTrackMs(track, props.score, end.qn) });
    }}
    onDurationKnown={() => props.onDurationKnown?.(projection.originalDuration + (props.trailingGapMs ?? 0))}
  />;
}

function StaffRendererView({
  score,
  trackIndex,
  currentMs,
  viewMs,
  loopAMs,
  loopBMs,
  layoutMode = 'scroll',
  zoom = 1,
  showCursor = true,
  trailingGapMs = 0,
  trailingGapLabel = '',
  onSeek,
  onSelectRange,
  onDurationKnown,
  className,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<StaffRendererImpl | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const showCursorRef = useRef(showCursor);
  showCursorRef.current = showCursor;
  const gapMsRef = useRef(trailingGapMs);
  gapMsRef.current = trailingGapMs;
  const gapLabelRef = useRef(trailingGapLabel);
  gapLabelRef.current = trailingGapLabel;
  const onSeekRef = useRef(onSeek);
  const onSelectRangeRef = useRef(onSelectRange);
  const onDurationKnownRef = useRef(onDurationKnown);
  // Latest time/loop values, so a re-mount (track or layout-mode change) can
  // restore the playhead instead of snapping to 0.
  const currentMsRef = useRef(currentMs);
  const viewMsRef = useRef(viewMs);
  const loopARef = useRef(loopAMs);
  const loopBRef = useRef(loopBMs);
  currentMsRef.current = currentMs;
  viewMsRef.current = viewMs;
  loopARef.current = loopAMs;
  loopBRef.current = loopBMs;

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);
  useEffect(() => {
    onSelectRangeRef.current = onSelectRange;
  }, [onSelectRange]);
  useEffect(() => {
    onDurationKnownRef.current = onDurationKnown;
  }, [onDurationKnown]);

  // Mount / remount whenever the score, track, or layout mode changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const impl = new StaffRendererImpl();
    rendererRef.current = impl;
    impl.mount(
      el,
      score,
      trackIndex,
      layoutMode,
      zoomRef.current,
      gapMsRef.current,
      gapLabelRef.current
    );

    const unsubSeek = impl.onSeek((target) => onSeekRef.current?.(target));
    const unsubRange = impl.onSelectRange((range) => onSelectRangeRef.current?.(range));

    // Restore the playhead/markers into the freshly-built renderer.
    impl.setLoopMarkers(loopARef.current ?? null, loopBRef.current ?? null);
    impl.setViewMs(viewMsRef.current ?? currentMsRef.current);
    impl.setTimeMs(currentMsRef.current);
    impl.setCursorVisible(showCursorRef.current);

    onDurationKnownRef.current?.(impl.getTotalDurationMs());

    return () => {
      unsubSeek();
      unsubRange();
      impl.destroy();
      rendererRef.current = null;
    };
  }, [score, trackIndex, layoutMode]);

  // Push time updates straight to the imperative renderer.
  useEffect(() => {
    rendererRef.current?.setTimeMs(currentMs);
  }, [currentMs]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewMs(viewMs ?? currentMs);
    }
  }, [viewMs, currentMs]);

  useEffect(() => {
    rendererRef.current?.setLoopMarkers(loopAMs ?? null, loopBMs ?? null);
  }, [loopAMs, loopBMs]);

  // Re-render at the new zoom without a full React remount (preserves playhead).
  useEffect(() => {
    rendererRef.current?.setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    rendererRef.current?.setCursorVisible(showCursor);
  }, [showCursor]);

  useEffect(() => {
    rendererRef.current?.setTrailingGap(trailingGapMs, trailingGapLabel);
  }, [trailingGapMs, trailingGapLabel]);

  return (
    <div
      ref={containerRef}
      className={`playsense-studio-notation ${className ?? ''}`}
      style={layoutMode === 'wrapped' ? { height: '100%' } : undefined}
    />
  );
}
