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

export interface SelectedRange {
  startMs: number;
  endMs: number;
  startQn: number;
  endQn: number;
}

export type RangeListener = (range: SelectedRange) => void;

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

/** Pixel distance the pointer must travel before we treat it as a drag. */
const DRAG_THRESHOLD_PX = 5;

class StaffRendererImpl implements ScoreRenderer {
  private container: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private viewportEl: HTMLDivElement | null = null;
  private rendererDiv: HTMLDivElement | null = null;
  private cursorEl: HTMLDivElement | null = null;
  private dragOverlayEl: SVGRectElement | null = null;
  private hits: NoteHit[] = [];
  private seekListeners: Set<SeekListener> = new Set();
  private rangeListeners: Set<RangeListener> = new Set();
  private downHandler: ((e: PointerEvent) => void) | null = null;
  private moveHandler: ((e: PointerEvent) => void) | null = null;
  private upHandler: ((e: PointerEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private totalWidth = 0;
  private totalDurationMs = 0;
  private pixelsPerMs = 0;
  private startMs = 0;
  private viewportWidth = 0;
  private cursorAnchorPx = 0;

  // Two independent time inputs. Playback drives the orange line; view
  // drives staff translation. They equal each other when "follow playback"
  // is on; the parent decouples them while the user is scrubbing the staff.
  private lastPlaybackMs = 0;
  private lastViewMs = 0;

  // Drag-selection state
  private dragStartModelX: number | null = null;
  private dragCurrentModelX: number | null = null;
  private dragIsActive = false;
  private boundPointerId: number | null = null;

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

    // Cursor goes INSIDE the viewport so it gets clipped when the user
    // scrolls the staff away from the playhead.
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
    viewport.appendChild(this.cursorEl);

    // Capture the viewport's current width and recompute on resize so the
    // cursor anchor stays at CURSOR_ANCHOR_FRACTION of the visible width.
    const updateLayout = () => {
      this.viewportWidth = viewport.clientWidth;
      this.cursorAnchorPx = this.viewportWidth * CURSOR_ANCHOR_FRACTION;
      this.applyLayout();
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
      // Suppress browser text/glyph selection during drag so VexFlow's
      // <text> elements don't get the selection highlight.
      svg.style.userSelect = 'none';
      (svg.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
      svg.style.touchAction = 'none';

      const NS = 'http://www.w3.org/2000/svg';

      // A transparent background rect that fills the entire SVG so the
      // user's clicks on empty space (between/above/below notes) still
      // produce pointer events. SVG only fires events on painted elements
      // by default, so without this clicks would only register on note
      // glyphs themselves.
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('data-compas-staff-bg', 'true');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', `${this.totalWidth}`);
      bg.setAttribute('height', `${stageHeight}`);
      bg.setAttribute('fill', 'transparent');
      svg.insertBefore(bg, svg.firstChild);

      // A drag-preview overlay rect inside the SVG. We reuse the SVG's
      // model coordinate system so the rect lives in the same space as
      // the notes and translates with the staff. The data attribute opts
      // out of the global "force currentColor" CSS rule so the brand fill
      // survives.
      const overlay = document.createElementNS(NS, 'rect');
      overlay.setAttribute('data-compas-drag-overlay', 'true');
      overlay.setAttribute('y', `${STAVE_TOP - 4}`);
      overlay.setAttribute('height', `${STAVE_HEIGHT + 8}`);
      overlay.setAttribute('fill', 'hsl(var(--primary))');
      overlay.setAttribute('stroke', 'hsl(var(--primary))');
      overlay.setAttribute('stroke-width', '1.5');
      overlay.setAttribute('opacity', '0');
      overlay.setAttribute('pointer-events', 'none');
      svg.appendChild(overlay);
      this.dragOverlayEl = overlay;

      // Click-or-drag pointer handlers. A small initial movement is
      // tolerated (taps on touch devices wobble); past DRAG_THRESHOLD_PX
      // we switch into drag-selection mode and emit onSelectRange on up.
      // preventDefault on pointerdown stops the browser from starting a
      // text/glyph selection while the user drags across the SVG.
      this.downHandler = (event: PointerEvent) => {
        event.preventDefault();
        const rect = svg.getBoundingClientRect();
        const x = (event.clientX - rect.left) / SCALE;
        this.dragStartModelX = x;
        this.dragCurrentModelX = x;
        this.dragIsActive = false;
        this.boundPointerId = event.pointerId;
        try {
          svg.setPointerCapture(event.pointerId);
        } catch {
          /* setPointerCapture may fail on some browsers; degrades gracefully */
        }
      };
      this.moveHandler = (event: PointerEvent) => {
        if (
          this.dragStartModelX === null ||
          this.boundPointerId !== event.pointerId
        )
          return;
        event.preventDefault();
        const rect = svg.getBoundingClientRect();
        const x = (event.clientX - rect.left) / SCALE;
        this.dragCurrentModelX = x;
        const delta = Math.abs((x - this.dragStartModelX) * SCALE);
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
          svg.releasePointerCapture(event.pointerId);
        } catch {
          /* noop */
        }

        if (this.dragIsActive) {
          // Drag selection — convert pixel x's to ms via continuous
          // interpolation across the staff, NOT note snapping. The user
          // can select any time range, not just from-note-to-note.
          const startX = Math.min(this.dragStartModelX, this.dragCurrentModelX ?? this.dragStartModelX);
          const endX = Math.max(this.dragStartModelX, this.dragCurrentModelX ?? this.dragStartModelX);
          const startPos = this.xToTimePosition(startX);
          const endPos = this.xToTimePosition(endX);
          if (endPos.ms > startPos.ms) {
            const range: SelectedRange = {
              startMs: startPos.ms,
              endMs: endPos.ms,
              startQn: startPos.qn,
              endQn: endPos.qn,
            };
            for (const listener of this.rangeListeners) listener(range);
          }
        } else {
          // Bare click anywhere on the staff — interpolate to the time
          // at that x and seek there. No nearest-note snap.
          const pos = this.xToTimePosition(this.dragStartModelX);
          for (const listener of this.seekListeners) {
            listener({
              qn: pos.qn,
              measure: pos.measure,
              beat: pos.beat,
            });
          }
        }

        this.dragStartModelX = null;
        this.dragCurrentModelX = null;
        this.dragIsActive = false;
        this.boundPointerId = null;
        this.hideDragOverlay();
      };

      svg.addEventListener('pointerdown', this.downHandler);
      svg.addEventListener('pointermove', this.moveHandler);
      svg.addEventListener('pointerup', this.upHandler);
      svg.addEventListener('pointercancel', this.upHandler);
    }
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
    this.dragOverlayEl.setAttribute('opacity', '0.28');
  }

  private hideDragOverlay(): void {
    if (!this.dragOverlayEl) return;
    this.dragOverlayEl.setAttribute('opacity', '0');
  }

  setTimeMs(ms: number): void {
    this.lastPlaybackMs = ms;
    this.applyLayout();
  }

  setViewMs(ms: number): void {
    this.lastViewMs = ms;
    this.applyLayout();
  }

  /** Total ms covered by the active track — useful for the parent's scrub bar range. */
  getTotalDurationMs(): number {
    return this.totalDurationMs;
  }

  private applyLayout(): void {
    if (!this.rendererDiv || !this.cursorEl) return;
    const viewScaledX = this.msToCursorX(this.lastViewMs) * SCALE;
    const playbackScaledX = this.msToCursorX(this.lastPlaybackMs) * SCALE;

    // Translate the staff so the viewMs-position lands at the cursor anchor.
    const staffTranslate = this.cursorAnchorPx - viewScaledX;
    this.rendererDiv.style.transform = `translateX(${staffTranslate}px)`;

    // Cursor follows playback within the viewport. When viewMs == playbackMs
    // the cursor sits at cursorAnchorPx. Off that, it shifts; if it leaves
    // the viewport bounds it gets visually clipped (overflow:hidden) and we
    // fade it out so a half-visible line doesn't read as the playhead.
    const cursorX = this.cursorAnchorPx + (playbackScaledX - viewScaledX);
    this.cursorEl.style.transform = `translateX(${cursorX}px)`;
    const visible = cursorX >= -2 && cursorX <= this.viewportWidth + 2;
    this.cursorEl.style.opacity = visible ? '0.85' : '0';
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container) {
      const svg = this.container.querySelector('svg');
      if (svg) {
        if (this.downHandler) svg.removeEventListener('pointerdown', this.downHandler);
        if (this.moveHandler) svg.removeEventListener('pointermove', this.moveHandler);
        if (this.upHandler) {
          svg.removeEventListener('pointerup', this.upHandler);
          svg.removeEventListener('pointercancel', this.upHandler);
        }
      }
      this.container.innerHTML = '';
      this.container.style.height = '';
    }
    this.container = null;
    this.renderer = null;
    this.viewportEl = null;
    this.rendererDiv = null;
    this.cursorEl = null;
    this.dragOverlayEl = null;
    this.hits = [];
    this.seekListeners.clear();
    this.rangeListeners.clear();
    this.downHandler = null;
    this.moveHandler = null;
    this.upHandler = null;
    this.totalWidth = 0;
    this.totalDurationMs = 0;
    this.pixelsPerMs = 0;
    this.viewportWidth = 0;
    this.cursorAnchorPx = 0;
    this.lastPlaybackMs = 0;
    this.lastViewMs = 0;
    this.dragStartModelX = null;
    this.dragCurrentModelX = null;
    this.dragIsActive = false;
    this.boundPointerId = null;
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

  /**
   * Map an x position in model space to a continuous time position on the
   * staff. We use the captured per-note bounding boxes as anchors and
   * linear-interpolate ms / qn between adjacent ones, so the user can land
   * a click or a drag endpoint anywhere — the resolved ms doesn't quantize
   * to note onsets.
   */
  private xToTimePosition(x: number): {
    ms: number;
    qn: number;
    measure: number;
    beat: number;
  } {
    if (this.hits.length === 0) return { ms: 0, qn: 0, measure: 1, beat: 1 };
    if (this.hits.length === 1) {
      const only = this.hits[0];
      return { ms: only.ms, qn: only.qn, measure: only.measure, beat: only.beat };
    }

    const first = this.hits[0];
    const last = this.hits[this.hits.length - 1];

    if (x <= first.x) {
      // Extrapolate left of the first note using the slope of the first segment.
      const second = this.hits[1];
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
      const prev = this.hits[this.hits.length - 2];
      const denom = Math.max(last.x - prev.x, 1);
      const t = (x - prev.x) / denom;
      return {
        ms: prev.ms + t * (last.ms - prev.ms),
        qn: prev.qn + t * (last.qn - prev.qn),
        measure: last.measure,
        beat: last.beat,
      };
    }

    // Binary search for the surrounding hits.
    let lo = 0;
    let hi = this.hits.length - 1;
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
      // measure/beat are denormalized note-level info — pick whichever side
      // we're closer to. The seek consumer uses ms/qn for actual seeking
      // so this is purely informational.
      measure: t < 0.5 ? a.measure : b.measure,
      beat: t < 0.5 ? a.beat : b.beat,
    };
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
  /** Score-relative ms of the playhead (drives the orange line). */
  currentMs: number;
  /** Score-relative ms anchored at the cursor anchor. Defaults to currentMs (auto-follow). */
  viewMs?: number;
  onSeek?: (target: SeekTarget) => void;
  /** Fires when the user click-and-drags a range across the staff. */
  onSelectRange?: (range: SelectedRange) => void;
  /** Fires once after mount with the active track's total duration in ms. */
  onDurationKnown?: (ms: number) => void;
  className?: string;
}

export function StaffRenderer({
  score,
  trackIndex,
  currentMs,
  viewMs,
  onSeek,
  onSelectRange,
  onDurationKnown,
  className,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<StaffRendererImpl | null>(null);
  const onSeekRef = useRef(onSeek);
  const onSelectRangeRef = useRef(onSelectRange);
  const onDurationKnownRef = useRef(onDurationKnown);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);
  useEffect(() => {
    onSelectRangeRef.current = onSelectRange;
  }, [onSelectRange]);
  useEffect(() => {
    onDurationKnownRef.current = onDurationKnown;
  }, [onDurationKnown]);

  // Mount / remount whenever the score or active track changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const impl = new StaffRendererImpl();
    rendererRef.current = impl;
    impl.mount(el, score, trackIndex);

    const unsubSeek = impl.onSeek((target) => onSeekRef.current?.(target));
    const unsubRange = impl.onSelectRange((range) => onSelectRangeRef.current?.(range));

    onDurationKnownRef.current?.(impl.getTotalDurationMs());

    return () => {
      unsubSeek();
      unsubRange();
      impl.destroy();
      rendererRef.current = null;
    };
  }, [score, trackIndex]);

  // Push time updates straight to the imperative renderer.
  useEffect(() => {
    rendererRef.current?.setTimeMs(currentMs);
  }, [currentMs]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewMs(viewMs ?? currentMs);
    }
  }, [viewMs, currentMs]);

  return (
    <div
      ref={containerRef}
      className={`compas-notation ${className ?? ''}`}
    />
  );
}
