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
const FIRST_MEASURE_EXTRA_WIDTH = 80; // room for clef + time signature
const PER_NOTE_MIN_WIDTH = 60;
/** Vertical gap between stacked systems in wrapped mode (model units). */
const WRAP_V_GAP = 28;
/** Fallback model width when the container hasn't been measured yet. */
const WRAP_FALLBACK_WIDTH = 760;
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
  system: number;
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
  private dragOverlayEl: SVGRectElement | null = null;
  private aMarkerLineEl: SVGLineElement | null = null;
  private aMarkerLabelEl: SVGTextElement | null = null;
  private bMarkerLineEl: SVGLineElement | null = null;
  private bMarkerLabelEl: SVGTextElement | null = null;
  private hits: NoteHit[] = [];
  private systemRanges: Array<{ start: number; end: number }> = [];
  private seekListeners: Set<SeekListener> = new Set();
  private rangeListeners: Set<RangeListener> = new Set();
  private downHandler: ((e: PointerEvent) => void) | null = null;
  private moveHandler: ((e: PointerEvent) => void) | null = null;
  private upHandler: ((e: PointerEvent) => void) | null = null;
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
    layoutMode: StaffLayoutMode = 'scroll'
  ): void {
    this.destroy();
    this.container = el;
    this.score = score;
    this.trackIndex = trackIndex;
    this.layoutMode = layoutMode;
    this.build();
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
    }
    this.downHandler = null;
    this.moveHandler = null;
    this.upHandler = null;
    if (this.container) this.container.innerHTML = '';
    this.renderer = null;
    this.viewportEl = null;
    this.rendererDiv = null;
    this.cursorEl = null;
    this.dragOverlayEl = null;
    this.aMarkerLineEl = null;
    this.aMarkerLabelEl = null;
    this.bMarkerLineEl = null;
    this.bMarkerLabelEl = null;
    this.hits = [];
    this.systemRanges = [];
    this.lastSystem = -1;
  }

  private computePlan(
    measureBlocks: ReturnType<typeof extractTrackEvents>,
    avail: number
  ): LayoutPlan {
    const baseWidths = measureBlocks.map(
      (b) => Math.max(b.events.length, 1) * PER_NOTE_MIN_WIDTH
    );

    if (this.layoutMode === 'scroll') {
      let x = SYSTEM_PADDING_X;
      const placements: MeasurePlacement[] = measureBlocks.map((_, i) => {
        const width = baseWidths[i] + (i === 0 ? FIRST_MEASURE_EXTRA_WIDTH : 0);
        const placement: MeasurePlacement = {
          blockIndex: i,
          x,
          y: STAVE_TOP,
          width,
          firstInRow: i === 0,
          system: 0,
        };
        x += width;
        return placement;
      });
      return {
        placements,
        totalWidth: SYSTEM_PADDING_X + x,
        stageHeight: STAVE_TOP + STAVE_HEIGHT + 20,
        systemPitch: 0,
        systemCount: 1,
      };
    }

    // Wrapped: greedily pack measures into rows that fit `avail`.
    const rows: Array<Array<{ blockIndex: number; width: number }>> = [];
    let row: Array<{ blockIndex: number; width: number }> = [];
    let rowWidth = 0;
    for (let i = 0; i < measureBlocks.length; i++) {
      const isFirst = row.length === 0;
      let width = baseWidths[i] + (isFirst ? FIRST_MEASURE_EXTRA_WIDTH : 0);
      if (!isFirst && rowWidth + width > avail) {
        rows.push(row);
        row = [];
        rowWidth = 0;
        width = baseWidths[i] + FIRST_MEASURE_EXTRA_WIDTH; // now first in new row
      }
      row.push({ blockIndex: i, width });
      rowWidth += width;
    }
    if (row.length) rows.push(row);

    const systemPitch = STAVE_HEIGHT + WRAP_V_GAP;
    const placements: MeasurePlacement[] = [];
    let maxRowRight = 0;
    rows.forEach((r, sysIndex) => {
      let x = SYSTEM_PADDING_X;
      const y = STAVE_TOP + sysIndex * systemPitch;
      r.forEach((m, idx) => {
        placements.push({
          blockIndex: m.blockIndex,
          x,
          y,
          width: m.width,
          firstInRow: idx === 0,
          system: sysIndex,
        });
        x += m.width;
      });
      maxRowRight = Math.max(maxRowRight, x);
    });

    return {
      placements,
      totalWidth: maxRowRight + SYSTEM_PADDING_X,
      stageHeight: STAVE_TOP + rows.length * systemPitch + 20,
      systemPitch,
      systemCount: rows.length,
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
      ? Math.max(el.clientWidth / SCALE - SYSTEM_PADDING_X * 2, 240) ||
        WRAP_FALLBACK_WIDTH
      : 0;
    this.lastBuildAvail = avail;

    const plan = this.computePlan(measureBlocks, avail);
    this.totalWidth = plan.totalWidth;
    this.stageHeight = plan.stageHeight;
    this.systemPitch = plan.systemPitch;
    this.systemCount = plan.systemCount;

    const scaledStageHeight = this.stageHeight * SCALE;

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
    rendererDiv.style.width = `${this.totalWidth * SCALE}px`;
    rendererDiv.style.height = `${scaledStageHeight}px`;
    rendererDiv.style.willChange = 'transform';
    rendererDiv.style.cursor = 'pointer';
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

    for (const p of plan.placements) {
      const block = measureBlocks[p.blockIndex];
      const stave = new Stave(p.x, p.y, p.width);
      if (p.firstInRow) {
        stave.addClef('treble').addTimeSignature(
          `${block.timeSignature[0]}/${block.timeSignature[1]}`
        );
      }
      stave.setContext(ctx).draw();

      const vexNotes = block.events.map((d) => descriptorToStaveNote(d));

      const voice = new Voice({
        numBeats: block.timeSignature[0],
        beatValue: block.timeSignature[1],
      });
      voice.setStrict(false);
      voice.addTickables(vexNotes);

      new Formatter().joinVoices([voice]).format([voice], p.width - 20);
      voice.draw(ctx, stave);

      block.events.forEach((d, idx) => {
        allNotes.push({ vexNote: vexNotes[idx], descriptor: d, system: p.system });
      });
    }

    // ---- Capture hit boxes + ms positions ----
    this.totalDurationMs = qnToTrackMs(track, score, qnAtEnd(measureBlocks));
    this.startMs = 0;

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
    // In scroll mode the cursor lives in the viewport (fixed anchor, clipped).
    // In wrapped mode it lives in the scrolling content so it tracks the row.
    (wrapped ? rendererDiv : viewport).appendChild(this.cursorEl);

    // ---- Resize handling ----
    const onResize = () => {
      if (this.layoutMode === 'wrapped') {
        // Reflow depends on width — rebuild, but debounce so dragging the
        // pane reflows on release rather than every frame.
        const nextAvail = Math.max(
          (this.container?.clientWidth ?? 0) / SCALE - SYSTEM_PADDING_X * 2,
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
      const scaledWidth = this.totalWidth * SCALE;
      const scaledHeight = this.stageHeight * SCALE;
      svg.setAttribute('viewBox', `0 0 ${this.totalWidth} ${this.stageHeight}`);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      svg.setAttribute('width', `${scaledWidth}`);
      svg.setAttribute('height', `${scaledHeight}`);
      svg.style.width = `${scaledWidth}px`;
      svg.style.height = `${scaledHeight}px`;
      svg.style.cursor = 'pointer';
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
        const rect = target.getBoundingClientRect();
        this.dragStartModelX = (event.clientX - rect.left) / SCALE;
        this.dragStartModelY = (event.clientY - rect.top) / SCALE;
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
        if (
          this.dragStartModelX === null ||
          this.boundPointerId !== event.pointerId
        )
          return;
        event.preventDefault();
        const rect = target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / SCALE;
        const y = (event.clientY - rect.top) / SCALE;
        this.dragCurrentModelX = x;
        this.dragCurrentModelY = y;
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

      target.addEventListener('pointerdown', this.downHandler);
      target.addEventListener('pointermove', this.moveHandler);
      target.addEventListener('pointerup', this.upHandler);
      target.addEventListener('pointercancel', this.upHandler);
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

  private applyLayout(): void {
    if (!this.rendererDiv || !this.cursorEl) return;

    if (this.layoutMode === 'wrapped') {
      this.rendererDiv.style.transform = 'none';
      const pos = this.msToCursorPos(this.lastPlaybackMs);
      const x = pos.x * SCALE;
      const top = (STAVE_TOP + pos.system * this.systemPitch - 6) * SCALE;
      this.cursorEl.style.top = `${top}px`;
      this.cursorEl.style.transform = `translateX(${x}px)`;
      this.cursorEl.style.opacity = this.hits.length > 0 ? '0.9' : '0';

      // Keep the active row in view.
      if (this.viewportEl && pos.system !== this.lastSystem) {
        this.lastSystem = pos.system;
        const bandTop = (STAVE_TOP + pos.system * this.systemPitch) * SCALE;
        const bandBottom = bandTop + STAVE_HEIGHT * SCALE;
        const vh = this.viewportEl.clientHeight;
        const st = this.viewportEl.scrollTop;
        if (bandTop < st || bandBottom > st + vh) {
          this.viewportEl.scrollTop = Math.max(0, bandTop - 24);
        }
      }
      return;
    }

    // Scroll mode: translate the staff so viewMs lands at the anchor.
    const viewScaledX = this.msToCursorX(this.lastViewMs) * SCALE;
    const playbackScaledX = this.msToCursorX(this.lastPlaybackMs) * SCALE;

    const staffTranslate = this.cursorAnchorPx - viewScaledX;
    this.rendererDiv.style.transform = `translateX(${staffTranslate}px)`;

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
    this.teardownDom();
    if (this.container) this.container.style.height = '';
    this.container = null;
    this.score = null;
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
    // If the interval spans a row break, snap to the start-of-segment note.
    if (a.system !== b.system) return { x: a.x, system: a.system };
    const t = (clamped - a.ms) / Math.max(b.ms - a.ms, 1);
    return { x: a.x + t * (b.x - a.x), system: a.system };
  }

  private systemFromY(y: number): number {
    if (this.layoutMode !== 'wrapped' || this.systemPitch <= 0) return 0;
    const s = Math.round((y - STAVE_TOP) / this.systemPitch);
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
  loopAMs,
  loopBMs,
  layoutMode = 'scroll',
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
    impl.mount(el, score, trackIndex, layoutMode);

    const unsubSeek = impl.onSeek((target) => onSeekRef.current?.(target));
    const unsubRange = impl.onSelectRange((range) => onSelectRangeRef.current?.(range));

    // Restore the playhead/markers into the freshly-built renderer.
    impl.setLoopMarkers(loopARef.current ?? null, loopBRef.current ?? null);
    impl.setViewMs(viewMsRef.current ?? currentMsRef.current);
    impl.setTimeMs(currentMsRef.current);

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

  return (
    <div
      ref={containerRef}
      className={`playsense-studio-notation ${className ?? ''}`}
      style={layoutMode === 'wrapped' ? { height: '100%' } : undefined}
    />
  );
}
