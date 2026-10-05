'use client';

// PlaySense Studio — VexFlow staff renderer.
//
// React wrapper around an imperative VexFlow class. The component holds a ref
// to the mount div, instantiates StaffRendererImpl on mount, and pushes new
// times through setTimeMs without ever re-rendering React. The cursor moves
// via direct DOM mutation at 60fps.
//
// Two layout modes:
//   • 'scroll'  — one horizontal staff, followed continuously.
//   • 'wrapped' — measures wrap into several staves stacked vertically (like a
//                 page of sheet music); the pane advances gradually with the
//                 music, keeping upcoming rows in view. This is the default for the
//                 lesson viewer.
//
// Click-to-seek hit testing: after VexFlow lays out the notes, we capture each
// note's bounding box + its cumulative QN. A pointer event finds the position
// by interpolating between note anchors and fires onSeek.

import { hasFinalBarline } from '@/lib/playsense-studio/barlines';
import { useEffect, useMemo, useRef } from 'react';
import { repeatProjection } from '@/lib/playsense-studio/repeats';
import {
  Barline,
  BarlineType,
  type Beam,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  type Tuplet,
  type Voice,
} from 'vexflow';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { qnToTrackMs } from '@/lib/playsense-studio/time-mapping';
import {
  extractTrackEvents,
  scoreTieIndices,
  type NotationClef,
  type VexEventDescriptor,
} from '@/lib/playsense-studio/score-to-vexflow';
import { applyStaveHeader, buildMeasure, drawMeasure, formatMeasure, staveHeader } from '@/lib/playsense-studio/notation/build-measure';
import { drawSpanSegments, spanSegments, type PlacedNote } from '@/lib/playsense-studio/notation/spans';
import type {
  ScoreRenderer,
  SeekListener,
  SeekTarget,
} from '@/lib/playsense-studio/renderer';
import { scoreCursorAt, scoreScrollOffset, scoreReadingStops, scoreReadingOffset, type ScoreReadingStop } from '@/lib/playsense-studio/notation-playback';
import { packLessonScoreRows, MEASURE_WIDTH } from '@/lib/playsense-studio/notation-layout';
import { createNotationInterlude } from './notation-interlude';
import { barCounts, barsPerRow, glide, isAttack, noteLabel, noteStateAt, pageTurn, rowStates, stackedFollowTarget, type NoteNameStyle } from '@/lib/playsense-studio/notation/staff-n1';
import { useTranslation } from '@/components/language-provider';
import './staff-renderer.css';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';

export interface SelectedRange {
  startMs: number;
  endMs: number;
  startQn: number;
  endQn: number;
}

export type RangeListener = (range: SelectedRange) => void;

/**
 * 'scroll' — one continuous line; 'wrapped' — stacked rows that glide to the top;
 * 'paged' — the same rows shown one at a time, turning with a slide.
 */
export type StaffLayoutMode = 'scroll' | 'wrapped' | 'paged';

/** Always-on reading helpers: note-name chips, beat counts and the current-note ring. */
export interface StaffHelpers {
  /** The spoken "and" between beats ("&", or "y" in Spanish). */
  and: string;
  noteNames: NoteNameStyle;
}
const DEFAULT_HELPERS: StaffHelpers = { and: '&', noteNames: 'letters' };

interface NoteHit {
  /** Cumulative QN at the start of this event. */
  qn: number;
  /** Score-relative ms at the start of this event. */
  ms: number;
  endMs: number;
  measure: number;
  beat: number;
  /** SVG bounding box from VexFlow, in renderer-local px. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which system (row) this note lives on. Always 0 in scroll mode. */
  system: number;
  /** Block index of the bar, and the model-x a note's tail runs to before the barline. */
  bar: number;
  barEndX: number;
}

/** One voice's notes in time order (they never overlap within a voice). */
interface NoteLane {
  notes: Array<{ group: SVGElement | null; rest: boolean; ms: number; endMs: number }>;
  played: number;
  active: number;
}

const SYSTEM_PADDING_X = 12;
const STAVE_TOP = 24;
// VexFlow default Stave: ~4 blank line-spaces above the staff at 10px each, so
// the visible 5-line staff sits this far below the stave's `y`, spanning 40px.
const STAFF_LINE_TOP = 40;
const STAFF_LINE_SPAN = 40;
/** Extra CSS pixels around video intervals; staff spacing stays aligned. */
const INTERLUDE_EXTRA_HEIGHT = 15;
/** Playhead extends this far above/below the staff lines. */
const CURSOR_OVERHANG = 10;
/** Keep staff lines finer than the note glyphs. */
const STAFF_LINE_WIDTH = 1;
/** Base model width of a video interlude in horizontal notation. */
const GAP_BOX_W = 112;
// Shared with the PDF exporter (lib/playsense-studio/notation-layout.ts).
const FIRST_MEASURE_EXTRA_WIDTH = MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH; // room for clef + time signature
/** Room for the clef every later wrapped row restates (the key signature adds 10 per accidental). */
const ROW_START_CLEF_WIDTH = 40;
/** Preserve note spacing when fitting several measures across a row. */
const PER_NOTE_MIN_WIDTH = MEASURE_WIDTH.PER_NOTE_MIN_WIDTH;
const QN_WIDTH = MEASURE_WIDTH.QN_WIDTH;
/** Space for measure labels and beat guides between wrapped staff rows. */
const WRAP_ROW_GAP = 96;
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
const CURSOR_ANCHOR_FRACTION = 0.26;

/** Pixel distance the pointer must travel before we treat it as a drag. */
const DRAG_THRESHOLD_PX = 5;

interface MeasurePlacement {
  blockIndex: number;
  x: number;
  y: number;
  width: number;
  firstInRow: boolean;
  /** True only for the very first measure — gets the clef, key and time signature.
   *  Later row starts (`firstInRow`) restate the clef and key signature. */
  showHeader: boolean;
  system: number;
  /** Video time before/after notation, never a musical measure. */
  isGap?: 'leading' | 'trailing';
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
  private interludes: ReturnType<typeof createNotationInterlude>[] = [];
  private leadingMs = 0;
  private leadingLabel = '';
  private leadingPlacement: MeasurePlacement | null = null;
  private hits: NoteHit[] = [];
  /**
   * Per-voice note groups, in time order, so emphasis changes without disturbing connected beams.
   * Each lane keeps how many notes have finished sounding and which one is lit.
   */
  private noteLanes: NoteLane[] = [];
  /** Every SVG element of row k lives in rowGroups[k]; its HTML helpers in rowDivs[k]. */
  private rowGroups: SVGGElement[] = [];
  private rowDivs: HTMLDivElement[] = [];
  private diamondEl: HTMLSpanElement | null = null;
  // Per-measure geometry + start time, used to light the current measure.
  private measureGeoms: Array<{
    x: number;
    y: number;
    width: number;
    startMs: number;
    endMs: number;
    system: number;
  }> = [];
  /** Beats drive the diamond pulse and the reading stops. */
  private beatMarks: Array<{ ms: number; endMs: number; x: number; system: number }> = [];
  /** "1 & 2 &" labels under the staff, in time order. */
  private countMarks: Array<{ el: HTMLSpanElement; ms: number; endMs: number }> = [];
  private activeCountIdx = -1;
  /** Note attacks (not tied continuations or rests), in time order; chips only on pitched staves. */
  private attacks: Array<{ ms: number; endMs: number; x: number; y: number; system: number; chip: HTMLSpanElement | null }> = [];
  private chipState = { active: -1, played: 0 };
  private bandEl: HTMLDivElement | null = null;
  private bandSystem = -1;
  private nextRingEl: HTMLDivElement | null = null;
  private helpers: StaffHelpers | false = DEFAULT_HELPERS;
  /** Model-y offsets (from a stave's y) of the note-name and count rows. */
  private namesY = 0;
  private countsY = 0;
  private rowReadingStops: ScoreReadingStop[][] = [];
  /** Stacked follow: the row being read and the glide towards it. */
  private currentRow = -1;
  private glideY = -1;
  private glideTarget = 0;
  private glideFrame = 0;
  private glideLast = 0;
  /** Paged: the page on show. */
  private currentPage = -1;
  private overlayFades: Animation[] = [];
  private activeBeatIdx = -1;
  private staveTop = STAVE_TOP;
  private staffLineTop = STAFF_LINE_TOP;
  private staffFootprint = 132;
  private autoFollow = true;
  private staffTranslate = 0;
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
  private viewportHeight = 0;

  // Wrapped-mode geometry.
  private layoutMode: StaffLayoutMode = 'scroll';
  private systemPitch = 0;
  private systemCount = 1;
  private lastBuildAvail = 0;

  // Stored so we can rebuild on resize (wrapped reflow) / mode change.
  private score: ScoreDocument | null = null;
  private trackIndex = 0;

  // Effective render scale = BASE_SCALE * user zoom. Changing it rebuilds the
  // staff (wrapped mode reflows to fit; scroll mode just renders larger).
  private scale = BASE_SCALE;

  // Video intervals occupy compact segments beside the notation.
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
  private dragSeeking = false;
  private boundPointerId: number | null = null;

  mount(
    el: HTMLElement,
    score: ScoreDocument,
    trackIndex: number,
    layoutMode: StaffLayoutMode = 'scroll',
    zoom = 1,
    trailingGapMs = 0,
    trailingGapLabel = '',
    compact = false,
    leadingGapMs = 0,
    leadingGapLabel = '',
    helpers: StaffHelpers | false = DEFAULT_HELPERS,
    /** Where playback and the view already are, so the first page shown is the right one (no turn from page 1). */
    initial: { playbackMs: number; viewMs: number } = { playbackMs: 0, viewMs: 0 }
  ): void {
    this.destroy();
    this.lastPlaybackMs = initial.playbackMs;
    this.lastViewMs = initial.viewMs;
    this.container = el;
    this.score = score;
    this.trackIndex = trackIndex;
    this.layoutMode = layoutMode;
    this.staveTop = compact ? 8 : STAVE_TOP;
    this.scale = BASE_SCALE * clampZoom(zoom);
    this.gapMs = Math.max(0, trailingGapMs);
    this.gapLabel = trailingGapLabel;
    this.leadingMs = Math.max(0, leadingGapMs);
    this.leadingLabel = leadingGapLabel;
    this.helpers = helpers;
    this.build();
  }

  /** Update the trailing video interlude (duration + label) and rebuild. */
  setTrailingGap(ms: number, label: string): void {
    const next = Math.max(0, ms);
    if (Math.abs(next - this.gapMs) < 1 && label === this.gapLabel) return;
    this.gapMs = next;
    this.gapLabel = label;
    this.build();
  }

  setLeadingGap(ms: number, label: string): void {
    const next = Math.max(0, ms);
    if (Math.abs(next - this.leadingMs) < 1 && label === this.leadingLabel) return;
    this.leadingMs = next;
    this.leadingLabel = label;
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
    if (this.viewportEl && anchorRatio > 0 && !this.autoFollow) {
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
    this.interludes = [];
    this.leadingPlacement = null;
    this.hits = [];
    this.noteLanes = [];
    this.rowGroups = [];
    this.rowDivs = [];
    this.diamondEl = null;
    this.measureGeoms = [];
    this.beatMarks = [];
    this.countMarks = [];
    this.activeCountIdx = -1;
    this.attacks = [];
    this.chipState = { active: -1, played: 0 };
    this.bandEl = null;
    this.bandSystem = -1;
    this.nextRingEl = null;
    this.activeBeatIdx = -1;
    this.rowReadingStops = [];
    this.currentRow = -1;
    this.currentPage = -1;
    this.overlayFades.forEach(animation => animation.cancel());
    this.overlayFades = [];
    this.glideY = -1;
    if (this.glideFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.glideFrame);
    this.glideFrame = 0;
    this.staffTranslate = 0;
    this.activeMeasureIdx = -1;
    this.systemRanges = [];
    this.systemRowEndX = [];
  }

  private computePlan(
    measureBlocks: ReturnType<typeof extractTrackEvents>,
    avail: number
  ): LayoutPlan {
    const hasGap = this.gapMs > 0;
    const hasLeading = this.leadingMs > 0;
    const interludeWidth = Math.max(GAP_BOX_W, 76 / this.scale);
    // Header modifiers of any length never overlap the notes: a key signature
    // with several sharps/flats needs more lead-in than a bare clef.
    const firstBlockKeyFifths = measureBlocks[0]?.keyFifths ?? 0;
    const firstMeasureExtraWidth = FIRST_MEASURE_EXTRA_WIDTH + Math.abs(firstBlockKeyFifths) * 10;

    if (this.layoutMode === 'scroll') {
      let x = SYSTEM_PADDING_X + (hasLeading ? interludeWidth : 0);
      const placements: MeasurePlacement[] = measureBlocks.map((block, i) => {
        const quarterNotes = block.timeSignature[0] * 4 / block.timeSignature[1];
        const width = Math.max(quarterNotes * 64, block.events.length * 24 + 24)
          + (i === 0 ? firstMeasureExtraWidth : 0);
        const placement: MeasurePlacement = {
          blockIndex: i,
          x,
          y: this.staveTop,
          width,
          firstInRow: i === 0,
          showHeader: i === 0,
          system: 0,
        };
        x += width;
        return placement;
      });
      if (hasLeading) placements.unshift({ blockIndex: -1, x: SYSTEM_PADDING_X, y: this.staveTop,
        width: interludeWidth, firstInRow: true, showHeader: false, system: 0, isGap: 'leading' });
      if (hasGap) {
        placements.push({
          blockIndex: -1,
          x,
          y: this.staveTop,
          width: interludeWidth,
          firstInRow: false,
          showHeader: false,
          system: 0,
          isGap: 'trailing',
        });
        x += interludeWidth;
      }
      return {
        placements,
        totalWidth: SYSTEM_PADDING_X + x,
        stageHeight: this.staveTop + this.staffFootprint,
        systemPitch: 0,
        systemCount: 1,
      };
    }

    // Fit one, two, or three measures using each bar's own width requirement.
    // The opening bar carries clef, key and time signature; any bar that ends up
    // starting a later row restates clef and key, so the packer reserves that
    // room only for the bar in that position, not every column.
    const paged = this.layoutMode === 'paged';
    // Every page sits at the same height; only the current one is shown.
    const systemPitch = paged ? 0 : Math.max(STAFF_LINE_SPAN + WRAP_ROW_GAP, this.staffFootprint + 10);
    const requiredWidths = measureBlocks.map((block, index) => {
      const quarterNotes = block.timeSignature[0] * 4 / block.timeSignature[1];
      return Math.max(MEASURE_WIDTH.MIN, quarterNotes * QN_WIDTH, block.events.length * PER_NOTE_MIN_WIDTH + 24)
        + (index === 0 ? firstMeasureExtraWidth : 0);
    });
    const rowStartExtra = measureBlocks.map((block, index) =>
      index === 0 ? 0 : ROW_START_CLEF_WIDTH + Math.abs(block.keyFifths) * 10);
    const maxPerRow = barsPerRow((avail + SYSTEM_PADDING_X * 2) * this.scale, this.scale);
    const rows = packLessonScoreRows(requiredWidths, avail, { leading: hasLeading, trailing: hasGap }, rowStartExtra, maxPerRow);
    const systemCount = rows.length;

    const placements: MeasurePlacement[] = [];
    rows.forEach((row, system) => {
      let x = SYSTEM_PADDING_X;
      row.widths.forEach((width, col) => {
        const blockIndex = row.interlude ? -1 : row.startIndex + col;
        placements.push({ blockIndex, isGap: row.interlude, x,
          y: this.staveTop + system * systemPitch, width,
          firstInRow: col === 0, showHeader: blockIndex === 0, system });
        x += width;
      });
    });

    return {
      placements,
      totalWidth: Math.max(SYSTEM_PADDING_X * 2 + avail, ...placements.map(p => p.x + p.width + SYSTEM_PADDING_X)),
      // Reserve a full staff footprint for the LAST row (pitch is tighter than
      // one staff, so earlier rows overlap their neighbour's top padding).
      stageHeight: this.staveTop + (systemCount - 1) * systemPitch + this.staffFootprint,
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
    el.dataset.scoreLayoutMode = this.layoutMode;

    const track = score.tracks[this.trackIndex];
    if (!track) return;

    const measureBlocks = extractTrackEvents(
      track,
      score.initialTimeSignature,
      score.initialKeyFifths
    );
    if (measureBlocks.length === 0) return;

    // Reserve space for ledger notes before placing labels/beat guides. Treble
    // staff steps are 5 model pixels; percussion keys use the same staff grid.
    const headYs = measureBlocks.flatMap(block => [...block.events, ...block.voice2Events].flatMap(event => event.keys.map(key => {
      const match = /^([a-g])(?:##|bb|#|b)?\/(-?\d+)$/.exec(key);
      if (!match) return 60;
      const step = Number(match[2]) * 7 + 'cdefgab'.indexOf(match[1]);
      return 80 - (step - 30) * 5;
    })));
    const extraTop = Math.max(0, 32 - Math.min(50, ...headYs));
    this.staffLineTop = STAFF_LINE_TOP + extraTop;
    // Helper rows sit under the lowest note head: names (20px chips), then counts.
    // Chips and counts keep their CSS size at any zoom, so their spacing is px / scale.
    const lowestHead = Math.max(80, ...headYs) + extraTop;
    // Dynamics and hairpins sit under the staff; the helper rows go below them.
    const marksBelow = measureBlocks.some(block => block.events.some(event => event.dynamic))
      || (score.spans ?? []).some(span => span.type !== 'slur');
    const helperTop = Math.max(104 + extraTop, lowestHead + 16) + (marksBelow ? 24 : 0);
    const pitched = measureBlocks.some(block => block.clef !== 'percussion');
    const names = !!this.helpers && pitched;
    this.namesY = helperTop + 10 / this.scale;
    this.countsY = helperTop + ((names ? 26 : 0) + 8) / this.scale;
    this.staffFootprint = this.helpers
      ? this.countsY + 14 / this.scale + 4
      : Math.max(110, lowestHead + 22) + 22;


    const wrapped = this.layoutMode === 'wrapped';
    // Rows (stacked or paged) keep the playhead inside the content; the scroll line anchors it in the viewport.
    const rowsLayout = this.layoutMode !== 'scroll';
    const avail = Math.max(el.clientWidth / this.scale - SYSTEM_PADDING_X * 2, 240) || WRAP_FALLBACK_WIDTH;
    this.lastBuildAvail = avail;

    const plan = this.computePlan(measureBlocks, avail);
    this.totalWidth = plan.totalWidth;
    this.stageHeight = plan.stageHeight;
    this.systemPitch = plan.systemPitch;
    this.systemCount = plan.systemCount;

    // Keep video segments in the reading flow so follow mode can bring them into view.
    this.leadingPlacement = plan.placements.find(p => p.isGap === 'leading') ?? null;
    const gapPlacement = plan.placements.find((p) => p.isGap === 'trailing') ?? null;
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
      if (p.isGap) continue; // Musical playheads stop at the barline, before video time.
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
      overflowX: wrapped ? 'auto' : 'hidden',
      overflowY: wrapped ? 'auto' : 'hidden',
    } as CSSStyleDeclaration);
    viewport.className = 'ps-staff-viewport';
    if (wrapped) {
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', 'Score measures');
    }
    el.appendChild(viewport);
    // A paged row fills its pane (at least one row tall) and centres there; CSS does the centring.
    const paged = this.layoutMode === 'paged';
    el.style.height = wrapped || paged ? '100%' : `${scaledStageHeight}px`;
    el.style.minHeight = paged ? `${scaledStageHeight}px` : '';
    this.viewportEl = viewport;

    const rendererDiv = document.createElement('div');
    rendererDiv.className = 'ps-staff-content';
    rendererDiv.style.position = rowsLayout ? 'relative' : 'absolute';
    rendererDiv.style.top = '0';
    rendererDiv.style.left = '0';
    rendererDiv.style.width = `${this.totalWidth * this.scale}px`;
    rendererDiv.style.height = `${scaledStageHeight}px`;
    rendererDiv.style.willChange = 'transform';
    rendererDiv.style.cursor = 'default';
    rendererDiv.style.userSelect = 'none';
    (rendererDiv.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
      'none';
    rendererDiv.style.touchAction = el.hasAttribute('data-score-interactive') ? 'none' : 'pan-y';
    viewport.appendChild(rendererDiv);
    this.rendererDiv = rendererDiv;
    // HTML helpers (note names, counts, interludes) share the SVG rows' grouping.
    this.rowDivs = Array.from({ length: this.systemCount }, (_, k) => {
      const row = document.createElement('div');
      row.className = 'ps-staff-row';
      row.dataset.scoreRow = String(k);
      rendererDiv.appendChild(row);
      return row;
    });

    this.renderer = new Renderer(rendererDiv, Renderer.Backends.SVG);
    this.renderer.resize(this.totalWidth, this.stageHeight);
    const ctx = this.renderer.getContext();

    // ---- Draw staves per the plan ----
    const allNotes: Array<{
      vexNote: StaveNote;
      descriptor: VexEventDescriptor;
      system: number;
      bar: number;
      barEndX: number;
      staveY: number;
      pitched: boolean;
    }> = [];
    const placed: PlacedNote[] = [];
    const voice2Notes: Array<{ vexNote: StaveNote; descriptor: VexEventDescriptor }> = [];

    this.measureGeoms = [];
    // One SVG group per row, so rows can dim (stacked) or page (paged) without re-engraving.
    this.rowGroups = [];
    let openRow = -1;
    const openRowsThrough = (system: number) => {
      while (openRow < system) {
        if (openRow >= 0) ctx.closeGroup();
        openRow++;
        const group = ctx.openGroup('ps-row') as SVGGElement;
        group.setAttribute('data-score-row', String(openRow));
        this.rowGroups.push(group);
      }
    };
    for (const p of plan.placements) {
      openRowsThrough(p.system);
      if (p.isGap) continue; // video guidance is rendered separately below
      const block = measureBlocks[p.blockIndex];
      this.measureGeoms.push({
        system: p.system,
        x: p.x,
        y: p.y,
        width: p.width,
        startMs: qnToTrackMs(track, score, block.cumulativeQN),
        endMs: qnToTrackMs(track, score, block.cumulativeQN + block.timeSignature[0] * 4 / block.timeSignature[1]),
      });
      const stave = new Stave(p.x, p.y + this.staffLineTop - STAFF_LINE_TOP, p.width);
      const repeat = block.measure.repeat;
      if (repeat?.offset === 0) stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      if (repeat && repeat.offset === repeat.length - 1) {
        stave.setEndBarType(BarlineType.REPEAT_END);
      } else if (hasFinalBarline(track.measures, p.blockIndex)) {
        // The section's last measure closes with a final bar, like the end of a piece.
        stave.setEndBarType(BarlineType.END);
      } else if (block.measure.endBarline === 'double') {
        stave.setEndBarType(BarlineType.DOUBLE);
      }
      applyStaveHeader(stave, staveHeader(block, { opening: p.showHeader, rowStart: p.firstInRow }));
      // Bolder staff lines, then back to default weight for notes/stems/beams.
      const staffGroup = ctx.openGroup('ps-staff-lines') as SVGElement;
      staffGroup?.setAttribute('data-score-stave', '');
      ctx.setLineWidth(STAFF_LINE_WIDTH);
      stave.setContext(ctx).draw();
      ctx.closeGroup();
      for (const modifier of stave.getModifiers()) {
        if (modifier instanceof Barline && [BarlineType.REPEAT_BEGIN, BarlineType.REPEAT_END, BarlineType.REPEAT_BOTH].includes(modifier.getType())) {
          modifier.getSVGElement()?.setAttribute('data-score-repeat-sign', '');
        }
      }
      ctx.setLineWidth(1);

      // Justify into the note area only. The stave already knows how wide its
      // header modifiers are (clef, key signature, time signature), so this
      // stays correct no matter how many sharps/flats a key signature draws.
      const built = buildMeasure([block.events, block.voice2Events], block.timeSignature, block.clef);
      // A blank measure (the studio persists these) is just the empty stave.
      if (!built) continue;
      formatMeasure(built, Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 12));
      drawMeasure(ctx, stave, built);

      block.events.forEach((d, idx) => {
        allNotes.push({ vexNote: built.notes[0][idx], descriptor: d, system: p.system,
          bar: p.blockIndex, barEndX: p.x + p.width - 8, staveY: p.y, pitched: block.clef !== 'percussion' });
      });
      block.events.forEach((d, idx) => {
        placed.push({ id: d.id, note: built.notes[0][idx], system: p.system, hasDynamic: !!d.dynamic });
      });
      (block.voice2Events ?? []).forEach((d, idx) => {
        placed.push({ id: d.id, note: built.notes[1][idx], system: p.system, hasDynamic: !!d.dynamic });
        voice2Notes.push({ vexNote: built.notes[1][idx], descriptor: d });
      });
    }

    openRowsThrough(this.systemCount - 1);
    if (openRow >= 0) ctx.closeGroup();

    // Ties and spans are drawn after every row exists; each moves into the row it belongs to.
    const drawInRow = (system: number, draw: () => void) => {
      const group = ctx.openGroup('ps-row-mark') as SVGGElement;
      try { draw(); } finally { ctx.closeGroup(); }
      this.rowGroups[system]?.appendChild(group);
    };
    // Draw held pitches across chords and barlines, with half-ties on both sides of a row turn.
    allNotes.forEach((first, i) => {
      const next = allNotes[i + 1];
      if (!next) return;
      const indices = scoreTieIndices(first.descriptor, next.descriptor);
      if (!indices.firstIndexes.length) return;
      if (first.system === next.system) {
        drawInRow(first.system, () => new StaveTie({ firstNote: first.vexNote, lastNote: next.vexNote, ...indices }).setContext(ctx).draw());
      } else {
        drawInRow(first.system, () => new StaveTie({ firstNote: first.vexNote, firstIndexes: indices.firstIndexes, lastIndexes: indices.firstIndexes }).setContext(ctx).draw());
        drawInRow(next.system, () => new StaveTie({ lastNote: next.vexNote, firstIndexes: indices.lastIndexes, lastIndexes: indices.lastIndexes }).setContext(ctx).draw());
      }
    });

    const noteSystem = new Map(placed.map(p => [p.note, p.system] as const));
    for (const segment of spanSegments(score.spans, placed)) {
      const anchor = segment.from ?? segment.to;
      drawInRow(anchor ? noteSystem.get(anchor) ?? 0 : 0, () => drawSpanSegments(ctx, [segment]));
    }

    // ---- Capture hit boxes + ms positions ----
    this.totalDurationMs = qnToTrackMs(track, score, qnAtEnd(measureBlocks));
    this.startMs = -this.leadingMs;

    // The gap occupies score-time [notationEnd, notationEnd + gapMs]; extend the
    // total so reading and countdowns continue after the music.
    this.gapStartMs = this.totalDurationMs;
    if (this.gapMs > 0) this.totalDurationMs += this.gapMs;

    this.hits = allNotes.map(({ vexNote, descriptor, system, bar, barEndX }) => {
      const bbox = vexNote.getBoundingBox();
      return {
        qn: descriptor.qnStart,
        ms: qnToTrackMs(track, score, descriptor.qnStart),
        endMs: qnToTrackMs(track, score, descriptor.qnStart + descriptor.durationQN),
        measure: lookupMeasureNumber(measureBlocks, descriptor.qnStart),
        beat: descriptor.beatInMeasure,
        x: vexNote.getNoteHeadBeginX(),
        y: bbox.getY(),
        width: bbox.getW(),
        height: bbox.getH(),
        system,
        bar,
        barEndX,
      };
    });

    // CurrentColor tints the whole note group, preserving beam/stem alignment. Every voice gets states.
    const lane = (notes: ReadonlyArray<{ vexNote: StaveNote; descriptor: VexEventDescriptor }>, voice: number): NoteLane => ({
      played: 0,
      active: -1,
      notes: notes.map(({ vexNote, descriptor }) => {
        const group = vexNote.getSVGElement() ?? null;
        if (group) {
          group.setAttribute('data-score-note', descriptor.isRest ? 'rest' : 'note');
          group.setAttribute('data-voice', String(voice));
          group.setAttribute('data-note-state', 'upcoming');
        }
        return { group, rest: descriptor.isRest,
          ms: qnToTrackMs(track, score, descriptor.qnStart),
          endMs: qnToTrackMs(track, score, descriptor.qnStart + descriptor.durationQN) };
      }),
    });
    this.noteLanes = [lane(allNotes, 1), lane(voice2Notes, 2)];

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
    this.cursorEl.className = 'ps-staff-playhead';
    Object.assign(this.cursorEl.style, {
      position: 'absolute',
      top: `${(this.staveTop + this.staffLineTop - CURSOR_OVERHANG) * this.scale}px`,
      left: '0px',
      height: `${(STAFF_LINE_SPAN + 2 * CURSOR_OVERHANG) * this.scale}px`,
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      zIndex: '2',
    } as CSSStyleDeclaration);
    // The diamond on top pulses on every beat (see pulseBeat).
    this.diamondEl = document.createElement('span');
    this.diamondEl.className = 'ps-staff-playhead-diamond';
    this.cursorEl.appendChild(this.diamondEl);
    // In scroll mode the cursor lives in the viewport (fixed anchor, clipped).
    // In wrapped mode it lives in the scrolling content so it tracks the row.
    (rowsLayout ? rendererDiv : viewport).appendChild(this.cursorEl);

    // ---- Hover-preview cursor (ghost playhead showing where a click lands) ----
    this.hoverCursorEl = document.createElement('div');
    Object.assign(this.hoverCursorEl.style, {
      position: 'absolute',
      top: `${(this.staveTop + this.staffLineTop - CURSOR_OVERHANG) * this.scale}px`,
      left: '0px',
      width: `${2 * this.scale}px`,
      height: `${(STAFF_LINE_SPAN + 2 * CURSOR_OVERHANG) * this.scale}px`,
      background: 'hsl(var(--primary))',
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      opacity: '0',
    } as CSSStyleDeclaration);
    (rowsLayout ? rendererDiv : viewport).appendChild(this.hoverCursorEl);

    // ---- Resize handling ----
    const onResize = () => {
      {
        // Throttle engraving during a drag so rows update while the edge moves
        // without rebuilding the entire SVG on every pointer event.
        const nextAvail = Math.max(
          (this.container?.clientWidth ?? 0) / this.scale - SYSTEM_PADDING_X * 2,
          240
        );
        if (Math.abs(nextAvail - this.lastBuildAvail) < 16) {
          this.viewportWidth = viewport.clientWidth;
          this.viewportHeight = viewport.clientHeight;
          this.planReadingStops();
          this.applyLayout();
          return;
        }
        if (this.resizeTimer) return;
        this.resizeTimer = setTimeout(() => {
          this.resizeTimer = null;
          this.build();
        }, 80);
        return;
      }
    };
    this.viewportWidth = viewport.clientWidth;
    this.viewportHeight = viewport.clientHeight;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(onResize);
      this.resizeObserver.observe(viewport);
    }

    // ---- Theme + SVG overlays (bg, drag overlay, loop markers) ----
    const svg = rendererDiv.querySelector('svg') as SVGSVGElement | null;
    // Helpers paint above the engraving.
    this.rowDivs.forEach(row => rendererDiv.appendChild(row));
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

      // An engraving instruction, right-aligned with the closing repeat barline.
      // Two playthroughs are already implied by the repeat sign.
      this.measureGeoms.forEach((g, index) => {
        const repeat = measureBlocks[index].measure.repeat;
        if (!repeat || repeat.count <= 2 || repeat.offset !== repeat.length - 1) return;
        const right = g.x + g.width;
        // By bar index: bar numbers can repeat (every exercise pass restarts them).
        const nearbyTop = Math.min(...this.hits.filter(hit => hit.bar === index
          && hit.x + hit.width >= right - 80).map(hit => hit.y));
        const instruction = document.createElementNS(NS, 'text');
        instruction.setAttribute('data-score-repeat-count', '');
        instruction.setAttribute('x', `${right - 2}`);
        instruction.setAttribute('y', `${Math.min(g.y + this.staffLineTop - 18, nearbyTop - 8)}`);
        instruction.setAttribute('text-anchor', 'end');
        instruction.setAttribute('aria-label', `Play ${repeat.count} times`);
        const count = document.createElementNS(NS, 'tspan');
        count.setAttribute('data-score-repeat-number', '');
        count.textContent = String(repeat.count);
        const wording = document.createElementNS(NS, 'tspan');
        wording.setAttribute('dx', '3');
        wording.textContent = 'times';
        instruction.append(count, wording);
        (this.rowGroups[g.system] ?? svg).appendChild(instruction);
      });

      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('data-playsense-studio-staff-bg', 'true');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', `${this.totalWidth}`);
      bg.setAttribute('height', `${this.stageHeight}`);
      bg.setAttribute('fill', 'transparent');
      svg.insertBefore(bg, svg.firstChild);

      // An italic bar number opens every row after the first.
      const firstMusicRow = plan.placements.find(p => !p.isGap)?.system ?? 0;
      plan.placements.forEach((p, index) => {
        if (p.isGap || p.system === firstMusicRow || plan.placements[index - 1]?.system === p.system) return;
        const number = document.createElementNS(NS, 'text');
        number.setAttribute('data-score-bar-number', '');
        number.setAttribute('x', `${p.x + 2}`);
        number.setAttribute('y', `${p.y + this.staffLineTop - 12}`);
        number.textContent = String(measureBlocks[p.blockIndex].measure.number);
        this.rowGroups[p.system]?.appendChild(number);
      });

      // The current bar's soft band sits behind the engraving.
      const band = document.createElement('div');
      band.className = 'ps-staff-band';
      band.setAttribute('aria-hidden', 'true');
      rendererDiv.insertBefore(band, rendererDiv.firstChild);
      svg.style.position = 'relative';
      this.bandEl = band;

      if (this.helpers) this.buildHelpers(this.helpers, measureBlocks, allNotes, (qn) => qnToTrackMs(track, score, qn));
      else this.buildBeats(measureBlocks, (qn) => qnToTrackMs(track, score, qn));

      // The frame extends equally above/below the staff without changing its spacing.
      for (const placement of plan.placements.filter(p => p.isGap)) {
        const leading = placement.isGap === 'leading';
        this.interludes.push(createNotationInterlude(this.rowDivs[placement.system] ?? rendererDiv, {
          kind: leading ? 'leading' : 'trailing',
          x: placement.x * this.scale,
          y: (placement.y + this.staffLineTop) * this.scale - INTERLUDE_EXTRA_HEIGHT / 2,
          width: placement.width * this.scale,
          height: STAFF_LINE_SPAN * this.scale + INTERLUDE_EXTRA_HEIGHT,
          staffHeight: STAFF_LINE_SPAN * this.scale,
          startMs: leading ? -this.leadingMs : this.gapStartMs,
          durationMs: leading ? this.leadingMs : this.gapMs,
          detail: (leading ? this.leadingLabel : this.gapLabel) || 'Follow along with your instructor.',
        }));
      }

      const overlay = document.createElementNS(NS, 'rect');
      overlay.setAttribute('data-playsense-studio-drag-overlay', 'true');
      overlay.setAttribute('y', `${this.staveTop - 4}`);
      overlay.setAttribute('height', `${this.staffFootprint + 8}`);
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
        line.setAttribute('y1', `${this.staveTop - 14}`);
        line.setAttribute('y2', `${this.staveTop + this.staffFootprint + 8}`);
        line.setAttribute('stroke', 'hsl(var(--gold-highlight))');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '5 4');
        line.setAttribute('opacity', '0');
        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('data-playsense-studio-loop-marker', label);
        text.setAttribute('y', `${this.staveTop - 18}`);
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
        if (!this.container?.hasAttribute('data-score-interactive')) return;
        event.preventDefault();
        this.hideHoverCursor();
        const rect = target.getBoundingClientRect();
        this.dragStartModelX = (event.clientX - rect.left) / this.scale;
        this.dragStartModelY = (event.clientY - rect.top) / this.scale;
        this.dragCurrentModelX = this.dragStartModelX;
        this.dragCurrentModelY = this.dragStartModelY;
        this.dragIsActive = false;
        const cursor = this.cursorEl?.getBoundingClientRect();
        this.dragSeeking = !this.container.hasAttribute('data-score-range-select') ||
          !!(cursor && this.cursorEl?.style.opacity !== '0' && Math.abs(event.clientX - cursor.left) <= 10 && event.clientY >= cursor.top - 12 && event.clientY <= cursor.bottom + 12);
        this.boundPointerId = event.pointerId;
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          /* setPointerCapture may fail on some browsers; degrades gracefully */
        }
      };
      this.moveHandler = (event: PointerEvent) => {
        if (!this.container?.hasAttribute('data-score-interactive')) return;
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
        if (this.dragIsActive && this.dragSeeking) {
          const pos = this.xToTimePosition(x, y);
          if (pos) for (const listener of this.seekListeners) listener({ qn: pos.qn, measure: pos.measure, beat: pos.beat });
        } else if (this.dragIsActive) this.updateDragOverlay();
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

        if (this.dragIsActive && this.dragSeeking) {
          const pos = this.xToTimePosition(this.dragCurrentModelX ?? this.dragStartModelX, this.dragCurrentModelY ?? this.staveTop);
          if (pos) for (const listener of this.seekListeners) listener({ qn: pos.qn, measure: pos.measure, beat: pos.beat });
        } else if (this.dragIsActive) {
          const startX = Math.min(
            this.dragStartModelX,
            this.dragCurrentModelX ?? this.dragStartModelX
          );
          const endX = Math.max(
            this.dragStartModelX,
            this.dragCurrentModelX ?? this.dragStartModelX
          );
          const startPos = this.xToTimePosition(startX, this.dragStartModelY ?? this.staveTop);
          const endPos = this.xToTimePosition(endX, this.dragCurrentModelY ?? this.dragStartModelY ?? this.staveTop);
          // A range that starts or ends on a row without notes selects nothing.
          const lo = startPos && endPos ? Math.min(startPos.ms, endPos.ms) : 0;
          const hi = startPos && endPos ? Math.max(startPos.ms, endPos.ms) : 0;
          if (startPos && endPos && hi > lo) {
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
            this.dragStartModelY ?? this.staveTop
          );
          // A row without notes (a video interlude page) has nothing to seek to.
          if (pos) for (const listener of this.seekListeners) {
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
    this.planReadingStops();
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
      const system = this.systemFromY(this.dragStartModelY ?? this.staveTop);
      const yTop = this.staveTop + system * this.systemPitch;
      this.dragOverlayEl.setAttribute('y', `${yTop - 4}`);
      this.dragOverlayEl.setAttribute('height', `${this.staffFootprint + 8}`);
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

  setPlaybackPosition(ms: number, viewMs = ms): void {
    this.lastPlaybackMs = ms;
    this.lastViewMs = viewMs;
    this.applyLayout();
  }

  setAutoFollow(enabled: boolean): void {
    if (this.autoFollow === enabled) return;
    this.autoFollow = enabled;
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
    if (this.layoutMode === 'paged' && pos.system !== this.currentPage) {
      line.setAttribute('opacity', '0');
      label.setAttribute('opacity', '0');
      return;
    }
    const yTop =
      this.layoutMode !== 'scroll'
        ? this.staveTop + pos.system * this.systemPitch
        : this.staveTop;
    line.setAttribute('x1', `${pos.x}`);
    line.setAttribute('x2', `${pos.x}`);
    line.setAttribute('y1', `${yTop - 14}`);
    line.setAttribute('y2', `${yTop + this.staffFootprint + 8}`);
    line.setAttribute('opacity', '0.85');
    label.setAttribute('x', `${pos.x}`);
    label.setAttribute('y', `${yTop - 18}`);
    label.setAttribute('opacity', '1');
  }

  /** Beat positions only (helpers off): the diamond still pulses and reading stops still plan. */
  private buildBeats(blocks: ReturnType<typeof extractTrackEvents>, qnToMs: (qn: number) => number): void {
    for (const block of blocks) {
      for (const mark of barCounts(block.cumulativeQN, block.timeSignature, '').filter(m => m.beat)) {
        const ms = qnToMs(mark.qn);
        const pos = this.msToCursorPos(ms);
        this.beatMarks.push({ ms, endMs: qnToMs(mark.qn + 4 / block.timeSignature[1]), x: pos.x, system: pos.system });
      }
    }
  }

  private buildHelpers(
    helpers: StaffHelpers,
    blocks: ReturnType<typeof extractTrackEvents>,
    notes: ReadonlyArray<{ vexNote: StaveNote; descriptor: VexEventDescriptor; system: number; staveY: number; pitched: boolean }>,
    qnToMs: (qn: number) => number,
  ): void {
    const s = this.scale;
    // Beat numbers under every bar, placed on the same path as the playhead.
    const barsWithNotes = new Set(this.hits.map(hit => hit.bar));
    this.measureGeoms.forEach((g, index) => {
      const block = blocks[index];
      const barStartQn = block.cumulativeQN;
      const barQn = block.timeSignature[0] * 4 / block.timeSignature[1];
      const marks = barCounts(block.cumulativeQN, block.timeSignature, helpers.and).filter(mark => mark.beat);
      const barEndQn = block.cumulativeQN + block.timeSignature[0] * 4 / block.timeSignature[1];
      marks.forEach((mark, k) => {
        const ms = qnToMs(mark.qn);
        const endMs = qnToMs(marks[k + 1]?.qn ?? barEndQn);
        const pos = this.msToCursorPos(ms);
        // A bar with no notes (a blank studio bar) spreads its counts over its own width.
        const x = !barsWithNotes.has(index)
          ? g.x + 12 + (g.width - 24) * (mark.qn - barStartQn) / barQn
          : pos.system === g.system ? pos.x : g.x + g.width / 2;
        const el = document.createElement('span');
        el.className = 'ps-staff-count';
        el.dataset.beat = String(mark.beat);
        el.dataset.active = 'false';
        el.textContent = mark.label;
        el.style.left = `${x * s}px`;
        el.style.top = `${(g.y + this.countsY) * s}px`;
        this.rowDivs[g.system]?.appendChild(el);
        this.countMarks.push({ el, ms, endMs });
        if (mark.beat) {
          const beatEnd = qnToMs(Math.min(barEndQn, mark.qn + 4 / block.timeSignature[1]));
          this.beatMarks.push({ ms, endMs: beatEnd, x, system: g.system });
        }
      });
    });

    // Attacks: note-name chips (pitched staves) and the current-note ring's targets.
    notes.forEach((note, i) => {
      const d = note.descriptor;
      if (!isAttack(notes[i - 1]?.descriptor, d)) return;
      let last = i;
      while (notes[last]?.descriptor.tieToNext && notes[last + 1]) last++;
      const vex = note.vexNote;
      const x = (vex.getNoteHeadBeginX() + vex.getNoteHeadEndX()) / 2;
      const ys = vex.getYs();
      const y = ys.length ? Math.min(...ys) : note.staveY + this.staffLineTop + 20;
      let chip: HTMLSpanElement | null = null;
      if (note.pitched) {
        const label = noteLabel(topKey(d), helpers.noteNames);
        if (label) {
          chip = document.createElement('span');
          chip.className = 'ps-staff-name';
          chip.dataset.active = 'false';
          chip.textContent = label;
          chip.style.left = `${x * s}px`;
          chip.style.top = `${(note.staveY + this.namesY) * s}px`;
          this.rowDivs[note.system]?.appendChild(chip);
        }
      }
      this.attacks.push({ ms: this.hits[i].ms, endMs: this.hits[last].endMs, x, y, system: note.system, chip });
    });

    const ring = document.createElement('div');
    ring.className = 'ps-staff-next';
    ring.hidden = true;
    ring.setAttribute('aria-hidden', 'true');
    this.rendererDiv?.appendChild(ring);
    this.nextRingEl = ring;
  }

  /** Current count and chip, past chips, and the ring on the sounding attack of this row. */
  private updateHelpers(live: boolean): void {
    const ms = this.lastPlaybackMs;
    if (this.countMarks.length) {
      const k = live ? this.indexAtOrBefore(this.countMarks, ms, 'ms') : -1;
      const mark = this.countMarks[k];
      const active = mark && ms >= mark.ms && ms < mark.endMs ? k : -1;
      if (active !== this.activeCountIdx) {
        this.countMarks[this.activeCountIdx]?.el.setAttribute('data-active', 'false');
        this.countMarks[active]?.el.setAttribute('data-active', 'true');
        this.activeCountIdx = active;
      }
    }
    if (!this.attacks.length) return;
    const state = ms < 0 ? { active: -1, played: 0 } : noteStateAt(ms, this.attacks);
    const active = live ? state.active : -1;
    const prev = this.chipState;
    if (state.played !== prev.played || active !== prev.active) {
      const lo = Math.min(state.played, prev.played), hi = Math.max(state.played, prev.played);
      for (let k = lo; k < hi; k++) this.attacks[k].chip?.setAttribute('data-past', String(k < state.played));
      this.attacks[prev.active]?.chip?.setAttribute('data-active', 'false');
      this.attacks[active]?.chip?.setAttribute('data-active', 'true');
      this.chipState = { active, played: state.played };
    }
    const ring = this.nextRingEl;
    if (!ring) return;
    const current = this.attacks[active];
    const row = this.layoutMode === 'paged' ? this.currentPage : this.msToCursorPos(ms).system;
    if (!live || !current || current.system !== row) { ring.hidden = true; return; }
    ring.hidden = false;
    ring.style.transform = `translate(${current.x * this.scale}px, ${current.y * this.scale}px)`;
  }

  private updateGapCountdown(): void {
    for (const interlude of this.interludes) interlude.update(this.lastPlaybackMs);
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

  /** Update measure states only when crossing a barline or seeking. */
  private updateActiveMeasure(): void {
    const idx = this.cursorVisible && this.lastPlaybackMs >= 0 && this.lastPlaybackMs < this.gapStartMs
      ? this.indexAtOrBefore(this.measureGeoms, this.lastPlaybackMs, 'startMs') : -1;
    if (idx === this.activeMeasureIdx) return;
    this.activeMeasureIdx = idx;
    this.placeBand();
  }

  /** Glide the band to the current bar; jump (no diagonal slide) when the row changes. */
  private placeBand(): void {
    const band = this.bandEl;
    if (!band) return;
    const g = this.measureGeoms[this.activeMeasureIdx];
    if (!g) { band.style.opacity = '0'; return; }
    const s = this.scale;
    const jump = g.system !== this.bandSystem || band.style.opacity !== '1';
    if (jump) band.style.transition = 'none';
    band.style.width = `${(g.width - 4) * s}px`;
    band.style.height = `${(STAFF_LINE_SPAN + 52) * s}px`;
    band.style.transform = `translate(${(g.x + 2) * s}px, ${(g.y + this.staffLineTop - 26) * s}px)`;
    band.style.opacity = '1';
    if (jump) { void band.offsetWidth; band.style.transition = ''; }
    this.bandSystem = g.system;
  }

  /**
   * Played notes dim, the sounding one lights, in every voice. Played progress stays while the
   * cursor is hidden. A sounding rest is never lit (it keeps its ink until it has passed).
   */
  private updateNoteStates(): void {
    const ms = this.lastPlaybackMs;
    const inGap = ms < 0 || ms >= this.gapStartMs;
    for (const lane of this.noteLanes) {
      if (lane.notes.length === 0) continue;
      const { active, played } = ms < 0 ? { active: -1, played: 0 } : noteStateAt(ms, lane.notes);
      const shownActive = this.cursorVisible && !inGap && !lane.notes[active]?.rest ? active : -1;
      if (played === lane.played && shownActive === lane.active) continue;
      const lo = Math.min(played, lane.played);
      const hi = Math.max(played, lane.played);
      for (let k = lo; k < hi; k++) {
        lane.notes[k]?.group?.setAttribute('data-note-state', k < played ? 'played' : 'upcoming');
      }
      lane.notes[lane.active]?.group?.setAttribute('data-note-state', lane.active < played ? 'played' : 'upcoming');
      lane.notes[shownActive]?.group?.setAttribute('data-note-state', 'active');
      lane.played = played;
      lane.active = shownActive;
    }
  }

  /** Restart the diamond's beat pulse (skipped under reduced motion). */
  private pulseBeat(): void {
    const diamond = this.diamondEl;
    if (!diamond || typeof diamond.animate !== 'function' || prefersReducedMotion()) return;
    diamond.animate(
      [{ transform: 'rotate(45deg) scale(1.7)' }, { transform: 'rotate(45deg) scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }

  private planReadingStops(): void {
    const scale = this.scale;
    // Rows (stacked or paged) turn within a row only when a bar is wider than the pane.
    // The scroll line follows continuously and needs no stops.
    if (this.layoutMode === 'scroll') { this.rowReadingStops = []; return; }
    this.rowReadingStops = Array.from({ length: this.systemCount }, (_, system) => scoreReadingStops(
      this.measureGeoms.filter(g => g.system === system)
        .map(g => ({ ...g, x: g.x * scale, width: g.width * scale })),
      this.beatMarks.filter(b => b.system === system).map(b => ({ ms: b.ms, x: b.x * scale })),
      this.hits.filter(h => h.system === system).map(h => ({ ms: h.ms, x: h.x * scale })),
      this.viewportWidth,
      (this.systemRowEndX[system] + SYSTEM_PADDING_X) * scale,
    ));
  }

  private applyLayout(): void {
    if (!this.rendererDiv || !this.cursorEl) return;

    this.updateGapCountdown();
    if (this.layoutMode === 'paged') this.showPage(this.msToCursorPos(this.lastViewMs).system);
    const inInterlude = this.lastPlaybackMs < 0 || (this.gapMs > 0 && this.lastPlaybackMs >= this.gapStartMs);
    // These live inside the SVG (model coords), so they work in both modes
    // without per-mode handling.
    this.updateActiveMeasure();
    this.updateNoteStates();
    const live = this.cursorVisible && !inInterlude;
    const beatIndex = live ? this.indexAtOrBefore(this.beatMarks, this.lastPlaybackMs, 'ms') : -1;
    const beat = this.beatMarks[beatIndex];
    const activeBeat = beat && this.lastPlaybackMs >= beat.ms && this.lastPlaybackMs < beat.endMs ? beatIndex : -1;
    if (activeBeat !== this.activeBeatIdx) {
      this.activeBeatIdx = activeBeat;
      if (activeBeat >= 0) this.pulseBeat();
    }
    this.updateHelpers(live);

    if (this.layoutMode !== 'scroll') {
      this.rendererDiv.style.transform = 'none';
      const pos = this.msToCursorPos(this.lastPlaybackMs);
      const paged = this.layoutMode === 'paged';
      const onShow = !paged || pos.system === this.currentPage;
      const x = pos.x * this.scale;
      const top =
        (this.staveTop + pos.system * this.systemPitch + this.staffLineTop - CURSOR_OVERHANG) *
        this.scale;
      this.cursorEl.style.top = `${top}px`;
      this.cursorEl.style.transform = `translateX(${x}px)`;
      this.cursorEl.style.opacity =
        this.cursorVisible && !inInterlude && this.hits.length > 0 && onShow ? '1' : '0';
      if (this.bandEl) this.bandEl.style.visibility = paged && this.bandSystem !== this.currentPage ? 'hidden' : '';
      if (paged) {
        // A page wider than a narrow pane holds still and turns within itself at barlines or beats.
        const left = -scoreReadingOffset(this.lastViewMs, this.rowReadingStops[this.currentPage] ?? []);
        if (this.viewportEl && Math.abs(this.viewportEl.scrollLeft - left) > 1) this.viewportEl.scrollLeft = left;
        return;
      }

      // Plain engraving (helpers off, e.g. Studio previews) keeps every row at full ink.
      if (this.helpers && pos.system !== this.currentRow) {
        this.currentRow = pos.system;
        rowStates(this.systemCount, pos.system).forEach((state, k) => {
          this.rowGroups[k]?.setAttribute('data-row-state', state);
          this.rowDivs[k]?.setAttribute('data-row-state', state);
        });
      }
      // Glide so the row being read sits at the top; the next rows stay in view below it.
      if (this.viewportEl && this.autoFollow && this.cursorVisible) {
        const left = -scoreReadingOffset(this.lastPlaybackMs, this.rowReadingStops[pos.system] ?? []);
        if (Math.abs(this.viewportEl.scrollLeft - left) > 1) this.viewportEl.scrollLeft = left;
        this.followRow(stackedFollowTarget(pos.system * this.systemPitch * this.scale,
          this.viewportHeight, this.stageHeight * this.scale));
      }
      return;
    }

    // Scroll mode: translate the staff so viewMs lands at the anchor.
    const viewScaledX = this.msToCursorX(this.lastViewMs) * this.scale;
    const playbackScaledX = this.msToCursorX(this.lastPlaybackMs) * this.scale;

    const viewingInterlude = this.lastViewMs < 0 || (this.gapMs > 0 && this.lastViewMs >= this.gapStartMs);
    const shortPhraseInset = Math.max(0, (this.viewportWidth - this.totalWidth * this.scale) / 2);
    const staffTranslate = shortPhraseInset
      || scoreScrollOffset(viewScaledX, this.viewportWidth, this.totalWidth * this.scale, viewingInterlude ? .5 : CURSOR_ANCHOR_FRACTION);
    this.staffTranslate = staffTranslate;
    this.rendererDiv.style.transform = `translateX(${staffTranslate}px)`;

    const cursorX = staffTranslate + playbackScaledX;
    this.cursorEl.style.transform = `translateX(${cursorX}px)`;
    const visible = cursorX >= -2 && cursorX <= this.viewportWidth + 2;
    this.cursorEl.style.opacity = this.cursorVisible && !inInterlude && visible ? '1' : '0';
  }

  /** Exponential glide of the stacked view (about 7/s) on rAF; reduced motion jumps. */
  private followRow(target: number): void {
    const vp = this.viewportEl;
    if (!vp) return;
    this.glideTarget = target;
    if (this.glideFrame) return;
    const canAnimate = typeof requestAnimationFrame === 'function' && !prefersReducedMotion();
    if (!canAnimate || this.glideY < 0) {
      this.glideY = target;
      if (Math.abs(vp.scrollTop - target) > .5) vp.scrollTop = target;
      return;
    }
    // Start from wherever the reader left the view.
    this.glideY = vp.scrollTop;
    if (Math.abs(this.glideY - target) < .5) return;
    this.glideLast = performance.now();
    const step = (now: number) => {
      const viewport = this.viewportEl;
      if (!viewport) { this.glideFrame = 0; return; }
      const dt = (now - this.glideLast) / 1000;
      this.glideLast = now;
      this.glideY = glide(this.glideY, this.glideTarget, dt);
      viewport.scrollTop = this.glideY;
      this.glideFrame = this.glideY === this.glideTarget || !this.autoFollow ? 0 : requestAnimationFrame(step);
    };
    this.glideFrame = requestAnimationFrame(step);
  }

  /** Paged: turn to `page` with a slide (or a fade under reduced motion). */
  private showPage(page: number): void {
    if (page === this.currentPage) return;
    const previous = this.currentPage;
    const turn = pageTurn(previous, page, prefersReducedMotion());
    this.currentPage = page;
    const rowEls = (k: number) => [this.rowGroups[k], this.rowDivs[k]].filter((el): el is SVGGElement | HTMLDivElement => !!el);
    for (let k = 0; k < this.systemCount; k++) {
      if (k === page || k === previous) continue;
      rowEls(k).forEach(el => el.setAttribute('data-page-state', 'hidden'));
    }
    const easing = 'cubic-bezier(.22,1,.36,1)';
    const offset = (sign: number) => turn.offsetPercent ? `translateX(${sign * turn.offsetPercent}%)` : 'none';
    for (const el of rowEls(page)) {
      el.getAnimations?.().forEach(animation => animation.cancel());
      el.setAttribute('data-page-state', 'current');
      if (turn.kind !== 'instant' && typeof el.animate === 'function') {
        el.animate([{ transform: offset(turn.direction), opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: turn.durationMs, easing });
      }
    }
    if (previous >= 0) {
      for (const el of rowEls(previous)) {
        el.getAnimations?.().forEach(animation => animation.cancel());
        if (turn.kind === 'instant' || typeof el.animate !== 'function') {
          el.setAttribute('data-page-state', 'hidden');
          continue;
        }
        el.setAttribute('data-page-state', 'leaving');
        const animation = el.animate([{ transform: 'none', opacity: 1 }, { transform: offset(-turn.direction), opacity: 0 }],
          { duration: turn.durationMs, easing, fill: 'forwards' });
        animation.onfinish = () => {
          if (this.currentPage !== previous) el.setAttribute('data-page-state', 'hidden');
          animation.cancel();
        };
      }
    }
    this.setLoopMarkers(this.lastLoopAMs, this.lastLoopBMs);
    this.fadeInOverlays(turn);
  }

  /**
   * The playhead, bar band, current-note ring and loop markers live outside the rows, so they would
   * jump to the new page before it slides in. They stay hidden for the first half of the turn and
   * fade in as the page settles; the implicit end keyframe keeps each one's own opacity (a hidden
   * cursor stays hidden).
   */
  private fadeInOverlays(turn: ReturnType<typeof pageTurn>): void {
    this.overlayFades.forEach(animation => animation.cancel());
    this.overlayFades = [];
    if (turn.kind === 'instant') return;
    const overlays = [this.cursorEl, this.bandEl, this.nextRingEl,
      this.aMarkerLineEl, this.aMarkerLabelEl, this.bMarkerLineEl, this.bMarkerLabelEl];
    for (const el of overlays) {
      if (!el || typeof el.animate !== 'function') continue;
      this.overlayFades.push(el.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: .45 }],
        { duration: turn.durationMs, easing: 'ease-out' }));
    }
  }

  /** Place the translucent ghost playhead at the click-landing position for a
   *  hovered (model-space) point. Reuses the exact click → seek math. */
  private updateHoverCursor(modelX: number, modelY: number): void {
    if (!this.hoverCursorEl || this.hits.length === 0) return;
    const pos = this.xToTimePosition(modelX, modelY);
    if (!pos) { this.hideHoverCursor(); return; }
    const cur = this.msToCursorPos(pos.ms);
    if (this.layoutMode !== 'scroll') {
      const top =
        (this.staveTop + cur.system * this.systemPitch + this.staffLineTop - CURSOR_OVERHANG) *
        this.scale;
      this.hoverCursorEl.style.top = `${top}px`;
      this.hoverCursorEl.style.transform = `translateX(${cur.x * this.scale}px)`;
    } else {
      const hoverX =
        this.staffTranslate + this.msToCursorX(pos.ms) * this.scale;
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
    if (this.container) { this.container.style.height = ''; this.container.style.minHeight = ''; }
    this.container = null;
    this.score = null;
    this.scale = BASE_SCALE;
    this.gapMs = 0;
    this.gapLabel = '';
    this.gapStartMs = 0;
    this.gapBoxW = 0;
    this.leadingMs = 0;
    this.leadingLabel = '';
    this.seekListeners.clear();
    this.rangeListeners.clear();
    this.totalWidth = 0;
    this.stageHeight = 0;
    this.totalDurationMs = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
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
    const clamped = Math.max(this.startMs, Math.min(ms, this.totalDurationMs));
    if (clamped < 0 && this.leadingPlacement) {
      return { x: this.leadingPlacement.x + this.leadingPlacement.width / 2, system: this.leadingPlacement.system };
    }

    // Keep the whole interlude in view while its countdown advances.
    if (this.gapMs > 0 && clamped >= this.gapStartMs) {
      return {
        x: this.gapBoxX + this.gapBoxW / 2,
        system: this.gapBoxSystem,
      };
    }

    if (this.hits.length === 0) return { x: 0, system: 0 };
    return scoreCursorAt(clamped, this.hits, this.gapStartMs, this.systemRowEndX);
  }

  private systemFromY(y: number): number {
    if (this.layoutMode === 'paged') return Math.max(0, this.currentPage);
    if (this.layoutMode !== 'wrapped' || this.systemPitch <= 0) return 0;
    const s = Math.floor((y - this.staveTop) / this.systemPitch);
    return Math.max(0, Math.min(this.systemCount - 1, s));
  }

  /**
   * Map a model-space (x, y) to a continuous time position. In row layouts we
   * first pick the system from y, then interpolate within that row's notes.
   * Null for a row without notes (a video interlude or a blank bar).
   */
  private xToTimePosition(
    x: number,
    y: number
  ): { ms: number; qn: number; measure: number; beat: number } | null {
    if (this.hits.length === 0) return { ms: 0, qn: 0, measure: 1, beat: 1 };

    let loIdx = 0;
    let hiIdx = this.hits.length - 1;
    if (this.layoutMode !== 'scroll') {
      const range = this.systemRanges[this.systemFromY(y)];
      if (!range || range.start === -1) return null;
      loIdx = range.start;
      hiIdx = range.end - 1;
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

/** The highest written pitch of an event (a chord's chip names its top note). */
function topKey(d: VexEventDescriptor): string {
  const pitches = d.midiPitches;
  if (pitches && pitches.length === d.keys.length) {
    let best = 0;
    pitches.forEach((midi, k) => { if (midi > pitches[best]) best = k; });
    return d.keys[best];
  }
  return d.keys.at(-1) ?? '';
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

/**
 * Lay out one measure's events into a formatted VexFlow voice, ready to draw.
 *
 * Returns null for a blank measure. The studio deliberately persists measures
 * with no events (see editor-state.ts `emptyMeasure` / `delete-event`), and
 * VexFlow's Formatter throws "Cannot read properties of undefined (reading
 * 'getMetrics')" when asked to justify a voice with no tickables — so the
 * caller draws only the empty stave for those.
 *
 * A thin wrapper over the shared measure builder (build-measure.ts); kept for
 * its exported signature, which the `.worktrees/sheet-music-export` branch
 * still imports. Callers must draw the returned `tuplets` as well as the
 * beams, or tuplet numbers/brackets go missing.
 */
export function formatMeasureVoice(
  events: VexEventDescriptor[],
  timeSignature: [number, number],
  justifyWidth: number,
  clef: NotationClef = 'treble'
): { vexNotes: StaveNote[]; voice: Voice; beams: Beam[]; tuplets: Tuplet[] } | null {
  const built = buildMeasure([events], timeSignature, clef);
  if (!built || !built.notes[0].length) return null;
  formatMeasure(built, justifyWidth);
  return { vexNotes: built.notes[0], voice: built.voices[0], beams: built.beams, tuplets: built.tuplets };
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
  /** Optional live playback clock. Enables frame-accurate following without React updates. */
  getCurrentMs?: () => number;
  compact?: boolean;
  /** Follow the active staff row. Disable to read ahead without interruption. */
  autoFollow?: boolean;
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
  /** Video-time segments before/after the notation. Leading time uses negative ms. */
  leadingGapMs?: number;
  leadingGapLabel?: string;
  trailingGapMs?: number;
  trailingGapLabel?: string;
  onSeek?: (target: SeekTarget) => void;
  /** Fires when the user click-and-drags a range across the staff. */
  onSelectRange?: (range: SelectedRange) => void;
  /** Fires once after mount with the active track's total duration in ms. */
  onDurationKnown?: (ms: number) => void;
  /** Reading helpers; defaults to the student's language. `false` is plain engraving: no helpers, no row dimming. */
  helpers?: StaffHelpers | false;
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
    getCurrentMs={props.getCurrentMs ? () => map(props.getCurrentMs!()) : undefined}
    viewMs={props.viewMs == null ? undefined : map(props.viewMs)}
    loopAMs={props.loopAMs == null ? props.loopAMs : map(props.loopAMs)}
    loopBMs={props.loopBMs == null ? props.loopBMs : map(props.loopBMs)}
    onSeek={props.onSeek ? target => props.onSeek?.({ ...target, ...original(target.qn) }) : undefined}
    onSelectRange={props.onSelectRange ? range => {
      const start = original(range.startQn);
      const end = projection.toOriginalQN(range.endQn, props.currentMs, true);
      props.onSelectRange?.({ startQn: start.qn, endQn: end.qn,
        startMs: qnToTrackMs(track, props.score, start.qn), endMs: qnToTrackMs(track, props.score, end.qn) });
    } : undefined}
    onDurationKnown={() => props.onDurationKnown?.(projection.originalDuration + (props.trailingGapMs ?? 0))}
  />;
}

function StaffRendererView({
  score,
  trackIndex,
  currentMs,
  getCurrentMs,
  compact = false,
  autoFollow = true,
  viewMs,
  loopAMs,
  loopBMs,
  layoutMode = 'scroll',
  zoom = 1,
  showCursor = true,
  trailingGapMs = 0,
  trailingGapLabel = '',
  leadingGapMs = 0,
  leadingGapLabel = '',
  onSeek,
  onSelectRange,
  onDurationKnown,
  helpers: helpersProp,
  className,
}: StaffRendererProps) {
  const { t, locale } = useTranslation();
  const and = t('staff.countAnd');
  const helpers = useMemo<StaffHelpers | false>(() => helpersProp ?? {
    and: and === 'staff.countAnd' ? DEFAULT_HELPERS.and : and,
    noteNames: locale === 'es' ? 'solfege' : 'letters',
  }, [helpersProp, and, locale]);
  const helpersKey = helpers ? `${helpers.and}|${helpers.noteNames}` : 'off';
  const helpersRef = useRef(helpers);
  // Declared before the mount effect, so a remount reads the latest helpers.
  useEffect(() => { helpersRef.current = helpers; }, [helpers]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<StaffRendererImpl | null>(null);
  const clockRef = useRef(getCurrentMs);
  const hasLiveClock = !!getCurrentMs;
  const autoFollowRef = useRef(autoFollow);
  const zoomRef = useRef(zoom);
  const showCursorRef = useRef(showCursor);
  const gapMsRef = useRef(trailingGapMs);
  const gapLabelRef = useRef(trailingGapLabel);
  const leadingMsRef = useRef(leadingGapMs);
  const leadingLabelRef = useRef(leadingGapLabel);
  const onSeekRef = useRef(onSeek);
  const onSelectRangeRef = useRef(onSelectRange);
  const onDurationKnownRef = useRef(onDurationKnown);
  // Latest time/loop values, so a re-mount (track or layout-mode change) can
  // restore the playhead instead of snapping to 0.
  const currentMsRef = useRef(currentMs);
  const viewMsRef = useRef(viewMs);
  const loopARef = useRef(loopAMs);
  const loopBRef = useRef(loopBMs);

  useEffect(() => {
    clockRef.current = getCurrentMs;
    autoFollowRef.current = autoFollow;
    zoomRef.current = zoom;
    showCursorRef.current = showCursor;
    gapMsRef.current = trailingGapMs;
    gapLabelRef.current = trailingGapLabel;
    leadingMsRef.current = leadingGapMs;
    leadingLabelRef.current = leadingGapLabel;
    currentMsRef.current = currentMs;
    viewMsRef.current = viewMs;
    loopARef.current = loopAMs;
    loopBRef.current = loopBMs;
  }, [getCurrentMs, autoFollow, zoom, showCursor, trailingGapMs, trailingGapLabel, leadingGapMs, leadingGapLabel, currentMs, viewMs, loopAMs, loopBMs]);

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
      gapLabelRef.current,
      compact,
      leadingMsRef.current,
      leadingLabelRef.current,
      helpersRef.current,
      { playbackMs: currentMsRef.current, viewMs: viewMsRef.current ?? currentMsRef.current }
    );

    const unsubSeek = impl.onSeek((target) => onSeekRef.current?.(target));
    const unsubRange = impl.onSelectRange((range) => onSelectRangeRef.current?.(range));

    // Restore the playhead/markers into the freshly-built renderer.
    impl.setAutoFollow(autoFollowRef.current);
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
  }, [score, trackIndex, layoutMode, compact, helpersKey]);

  useEffect(() => {
    if (!hasLiveClock) rendererRef.current?.setPlaybackPosition(currentMs, viewMs ?? currentMs);
  }, [currentMs, viewMs, hasLiveClock]);

  useEffect(() => {
    if (!hasLiveClock) return;
    let frame = 0;
    const tick = () => {
      const ms = clockRef.current?.();
      if (ms != null && !document.hidden) rendererRef.current?.setPlaybackPosition(ms, viewMsRef.current ?? ms);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasLiveClock]);

  useEffect(() => { rendererRef.current?.setAutoFollow(autoFollow); }, [autoFollow]);

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

  useEffect(() => {
    rendererRef.current?.setLeadingGap(leadingGapMs, leadingGapLabel);
  }, [leadingGapMs, leadingGapLabel]);

  return (
    <div
      ref={containerRef}
      data-score-interactive={onSeek || onSelectRange ? true : undefined}
      data-score-range-select={onSelectRange ? true : undefined}
      className={`playsense-studio-notation ps-score-engraving ${className ?? ''}`}
      style={layoutMode === 'wrapped' ? { height: '100%' } : undefined}
    />
  );
}
