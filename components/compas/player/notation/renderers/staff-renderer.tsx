'use client';

// Compás — VexFlow staff renderer.
//
// React wrapper around an imperative VexFlow class. The component holds a ref
// to the mount div, instantiates StaffRendererImpl on mount, and pushes new
// times through setTimeMs without ever re-rendering React. The cursor moves
// via direct DOM mutation at 60fps.
//
// Click-to-seek hit testing: after VexFlow lays out the notes, we capture
// each note's bounding box + its cumulative QN. A pointer event on the SVG
// finds the nearest note by horizontal proximity and fires onSeek.

import { useEffect, useRef } from 'react';
import {
  Accidental,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from 'vexflow';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';
import { qnToTrackMs } from '@/lib/compas/time-mapping';
import {
  extractTrackEvents,
  type VexEventDescriptor,
} from '@/lib/compas/score-to-vexflow';
import type {
  ScoreRenderer,
  SeekListener,
  SeekTarget,
} from '@/lib/compas/renderer';
import { themeVexflowSvg } from '@/lib/compas/svg-theme';

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
}

const SYSTEM_PADDING_X = 12;
const STAVE_TOP = 40;
const STAVE_HEIGHT = 100;
const FIRST_MEASURE_EXTRA_WIDTH = 80; // room for clef + time signature
const PER_NOTE_MIN_WIDTH = 60;
/**
 * Visual scale for the rendered SVG. The internal model coordinates
 * (bounding boxes, hit testing) stay in 1x; the SVG's rendered pixels are
 * SCALE'd via viewBox so the browser handles the upscaling crisply (still
 * vector). Click x and cursor x compensate by dividing/multiplying by SCALE.
 */
const SCALE = 1.3;
/**
 * Scrolling-music mode: the cursor is anchored at this fraction of the
 * viewport's width and the staff translates underneath so that the playhead
 * is always under the cursor. ~8% leaves a tight margin so the staff sits
 * close to the left edge while still leaving room for completed material
 * to slide back in for context.
 */
const CURSOR_ANCHOR_FRACTION = 0.08;

class StaffRendererImpl implements ScoreRenderer {
  private container: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private viewportEl: HTMLDivElement | null = null;
  private rendererDiv: HTMLDivElement | null = null;
  private cursorEl: HTMLDivElement | null = null;
  private hits: NoteHit[] = [];
  private listeners: Set<SeekListener> = new Set();
  private clickHandler: ((e: PointerEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private totalWidth = 0;
  private totalDurationMs = 0;
  private pixelsPerMs = 0;
  private startMs = 0;
  private viewportWidth = 0;
  private cursorAnchorPx = 0;
  private lastCursorMs = 0;

  mount(el: HTMLElement, score: ScoreDocument, trackIndex: number): void {
    this.destroy();
    this.container = el;
    el.innerHTML = '';
    el.style.position = 'relative';

    const track = score.tracks[trackIndex];
    if (!track) return;

    const measureBlocks = extractTrackEvents(
      track,
      score.initialTimeSignature,
      score.initialKeyFifths
    );
    if (measureBlocks.length === 0) return;

    // Compute per-measure widths so we can lay out staves left-to-right
    // without fighting VexFlow's auto-formatting.
    const measureWidths = measureBlocks.map((b, i) => {
      const eventCount = Math.max(b.events.length, 1);
      const base = eventCount * PER_NOTE_MIN_WIDTH;
      return i === 0 ? base + FIRST_MEASURE_EXTRA_WIDTH : base;
    });
    this.totalWidth =
      SYSTEM_PADDING_X * 2 + measureWidths.reduce((s, w) => s + w, 0);

    // VexFlow renderer. Native model size first; we resize the SVG via
    // viewBox after drawing so the rendered pixels are SCALE'd up.
    //
    // Layout:
    //   <el>                                         positioned, fixed height
    //     <viewport overflow:hidden width:100%>      the visible window
    //       <rendererDiv translateX'd>               the score, slides left
    //         <svg/>
    //       </rendererDiv>
    //     </viewport>
    //     <cursor at fixed anchor X />               playhead stays put
    //   </el>
    const stageHeight = STAVE_TOP + STAVE_HEIGHT + 20;
    const scaledStageHeight = stageHeight * SCALE;

    const viewport = document.createElement('div');
    Object.assign(viewport.style, {
      position: 'relative',
      width: '100%',
      height: `${scaledStageHeight}px`,
      overflow: 'hidden',
    } as CSSStyleDeclaration);
    el.appendChild(viewport);
    el.style.height = `${scaledStageHeight}px`;
    this.viewportEl = viewport;

    const rendererDiv = document.createElement('div');
    rendererDiv.style.position = 'absolute';
    rendererDiv.style.top = '0';
    rendererDiv.style.left = '0';
    rendererDiv.style.width = `${this.totalWidth * SCALE}px`;
    rendererDiv.style.height = `${scaledStageHeight}px`;
    rendererDiv.style.willChange = 'transform';
    viewport.appendChild(rendererDiv);
    this.rendererDiv = rendererDiv;

    this.renderer = new Renderer(rendererDiv, Renderer.Backends.SVG);
    this.renderer.resize(this.totalWidth, stageHeight);
    const ctx = this.renderer.getContext();

    // Lay out each measure as its own Stave; keep one continuous SVG.
    let currentX = SYSTEM_PADDING_X;
    const allNotes: Array<{ stave: Stave; vexNote: StaveNote; descriptor: VexEventDescriptor }> = [];

    for (let i = 0; i < measureBlocks.length; i++) {
      const block = measureBlocks[i];
      const width = measureWidths[i];

      const stave = new Stave(currentX, STAVE_TOP, width);
      if (i === 0) {
        stave.addClef('treble').addTimeSignature(
          `${block.timeSignature[0]}/${block.timeSignature[1]}`
        );
      }
      stave.setContext(ctx).draw();

      const vexNotes = block.events.map((d) =>
        descriptorToStaveNote(d)
      );

      const voice = new Voice({
        numBeats: block.timeSignature[0],
        beatValue: block.timeSignature[1],
      });
      voice.setStrict(false); // tolerate fixtures whose total duration doesn't fill the bar
      voice.addTickables(vexNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 20);
      voice.draw(ctx, stave);

      block.events.forEach((d, idx) => {
        allNotes.push({ stave, vexNote: vexNotes[idx], descriptor: d });
      });

      currentX += width;
    }

    // After draw, capture hit boxes + ms positions.
    this.totalDurationMs = qnToTrackMs(
      track,
      score,
      qnAtEnd(measureBlocks)
    );
    this.startMs = 0;

    this.hits = allNotes.map(({ vexNote, descriptor }) => {
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
      };
    });

    this.pixelsPerMs =
      this.totalDurationMs > 0 ? this.totalWidth / this.totalDurationMs : 0;

    // Cursor — fixed at the anchor position; the staff scrolls under it.
    this.cursorEl = document.createElement('div');
    Object.assign(this.cursorEl.style, {
      position: 'absolute',
      top: `${(STAVE_TOP - 6) * SCALE}px`,
      left: '0px',
      width: `${2 * SCALE}px`,
      height: `${(STAVE_HEIGHT + 12) * SCALE}px`,
      background: 'hsl(30 85% 55%)',
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      opacity: '0.85',
    } as CSSStyleDeclaration);
    el.appendChild(this.cursorEl);

    // Capture the viewport's current width and recompute on resize so the
    // cursor anchor stays at CURSOR_ANCHOR_FRACTION of the visible width.
    const updateLayout = () => {
      this.viewportWidth = viewport.clientWidth;
      this.cursorAnchorPx = this.viewportWidth * CURSOR_ANCHOR_FRACTION;
      if (this.cursorEl) {
        this.cursorEl.style.transform = `translateX(${this.cursorAnchorPx}px)`;
      }
      // Re-apply current time so the staff translation reflects the new anchor.
      this.applyScroll(this.lastCursorMs);
    };
    updateLayout();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(updateLayout);
      this.resizeObserver.observe(viewport);
    }

    // Theme + scale + click-to-seek
    const svg = rendererDiv.querySelector('svg') as SVGSVGElement | null;
    if (svg) {
      themeVexflowSvg(svg);
      // viewBox keeps drawn coordinates in model space while the SVG itself
      // is rendered at SCALE'd pixel dimensions. We also clear VexFlow's
      // inline style and set both the attribute and CSS dimensions to the
      // scaled size — VexFlow sets `style.width/height` during resize() and
      // inline style otherwise overrides the attribute.
      const scaledWidth = this.totalWidth * SCALE;
      const scaledHeight = stageHeight * SCALE;
      svg.setAttribute('viewBox', `0 0 ${this.totalWidth} ${stageHeight}`);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      svg.setAttribute('width', `${scaledWidth}`);
      svg.setAttribute('height', `${scaledHeight}`);
      svg.style.width = `${scaledWidth}px`;
      svg.style.height = `${scaledHeight}px`;
      svg.style.cursor = 'pointer';
      this.clickHandler = (event: PointerEvent) => {
        const rect = svg.getBoundingClientRect();
        // CSS pixel x → model space x by dividing out the scale.
        const x = (event.clientX - rect.left) / SCALE;
        const target = this.findNearestHit(x);
        if (target) {
          for (const listener of this.listeners) {
            listener({
              qn: target.qn,
              measure: target.measure,
              beat: target.beat,
            });
          }
        }
      };
      svg.addEventListener('pointerdown', this.clickHandler);
    }
  }

  setTimeMs(ms: number): void {
    this.applyScroll(ms);
  }

  private applyScroll(ms: number): void {
    this.lastCursorMs = ms;
    if (!this.rendererDiv) return;
    // The position in scaled pixels of the playhead within the rendererDiv.
    const cursorScaledX = this.msToCursorX(ms) * SCALE;
    // Translate the rendererDiv so that cursorScaledX lands at the anchor.
    const translate = this.cursorAnchorPx - cursorScaledX;
    this.rendererDiv.style.transform = `translateX(${translate}px)`;
  }

  onSeek(listener: SeekListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container) {
      const svg = this.container.querySelector('svg');
      if (svg && this.clickHandler) svg.removeEventListener('pointerdown', this.clickHandler);
      this.container.innerHTML = '';
      this.container.style.height = '';
    }
    this.container = null;
    this.renderer = null;
    this.viewportEl = null;
    this.rendererDiv = null;
    this.cursorEl = null;
    this.hits = [];
    this.listeners.clear();
    this.clickHandler = null;
    this.totalWidth = 0;
    this.totalDurationMs = 0;
    this.pixelsPerMs = 0;
    this.viewportWidth = 0;
    this.cursorAnchorPx = 0;
    this.lastCursorMs = 0;
  }

  private msToCursorX(ms: number): number {
    if (this.hits.length === 0) return 0;
    const clamped = Math.max(this.startMs, Math.min(ms, this.totalDurationMs));

    // Find the surrounding hits and interpolate.
    let lo = 0;
    let hi = this.hits.length - 1;
    if (clamped <= this.hits[0].ms) return this.hits[0].x;
    const last = this.hits[hi];
    if (clamped >= last.ms) {
      // Past the last note — extrapolate using the slope of the last segment.
      if (hi >= 1) {
        const prev = this.hits[hi - 1];
        const slope = (last.x - prev.x) / Math.max(last.ms - prev.ms, 1);
        return last.x + (clamped - last.ms) * slope;
      }
      return last.x;
    }

    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (this.hits[mid].ms <= clamped) lo = mid;
      else hi = mid;
    }
    const a = this.hits[lo];
    const b = this.hits[hi];
    const t = (clamped - a.ms) / Math.max(b.ms - a.ms, 1);
    return a.x + t * (b.x - a.x);
  }

  private findNearestHit(x: number): NoteHit | null {
    if (this.hits.length === 0) return null;
    let best: NoteHit | null = null;
    let bestDist = Infinity;
    for (const hit of this.hits) {
      const cx = hit.x + hit.width / 2;
      const d = Math.abs(cx - x);
      if (d < bestDist) {
        bestDist = d;
        best = hit;
      }
    }
    return best;
  }
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

function qnAtEnd(
  blocks: ReturnType<typeof extractTrackEvents>
): number {
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
  /** Score-relative ms. Updates push directly to DOM, not through React. */
  currentMs: number;
  onSeek?: (target: SeekTarget) => void;
  className?: string;
}

export function StaffRenderer({
  score,
  trackIndex,
  currentMs,
  onSeek,
  className,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<StaffRendererImpl | null>(null);
  const onSeekRef = useRef(onSeek);

  // Keep latest seek handler in a ref so we can register a stable listener.
  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  // Mount / remount whenever the score or active track changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const impl = new StaffRendererImpl();
    rendererRef.current = impl;
    impl.mount(el, score, trackIndex);

    const unsub = impl.onSeek((target) => {
      onSeekRef.current?.(target);
    });

    return () => {
      unsub();
      impl.destroy();
      rendererRef.current = null;
    };
  }, [score, trackIndex]);

  // Push time updates straight to the imperative renderer.
  useEffect(() => {
    rendererRef.current?.setTimeMs(currentMs);
  }, [currentMs]);

  return (
    <div
      ref={containerRef}
      className={`compas-notation ${className ?? ''}`}
    />
  );
}
