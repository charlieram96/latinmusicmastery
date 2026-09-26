'use client';

// PlaySense Studio — waveform canvas for the sync editor.
//
// Two stacked <canvas> layers (the same separation StaffRenderer uses for its
// SVG cursor):
//   • waveLayer — peaks + beat/measure gridlines + numbered measure markers +
//     beat handles. Redrawn only when peaks/zoom/scroll/markers/size change.
//   • overlayLayer — the playhead, redrawn every RAF tick from a getter so 60fps
//     motion never repaints the expensive wave layer.
//
// The canvas owns NO marker state. It draws the handles it is given and emits
// semantic drag events; the workspace mutates MarkerState (clamping lives in
// marker-model). Coordinate space: videoTimeToX(t) = t*pps - scrollLeftPx.

import { useCallback, useEffect, useRef } from 'react';
import { bucketMinMax, type WaveformPeaks } from '@/lib/playsense-studio/waveform';
import type { FlexMap, FlexPoint } from '@/lib/playsense-studio/flex';
import { mediaForColumn } from '@/lib/playsense-studio/warp-draw';
import type { MarkerRef } from './marker-model';

export interface MarkerHandle {
  measureNumber: number;
  beatInMeasure: number;
  isDownbeat: boolean;
  videoTimeSeconds: number;
  /** This bar's first note or tempo looks off the recording (Task 5). */
  flagged?: boolean;
}

export type DragMode = 'single' | 'all-after';
export type DragTarget =
  | { kind: 'anchor' }
  | { kind: 'marker'; ref: MarkerRef }
  | { kind: 'tail' }
  | { kind: 'trim'; edge: 'in' | 'out' }
  /** The selected note's onset handle (exists only while a note is selected). */
  | { kind: 'note' };

export interface NoteTickHandle {
  videoTimeSeconds: number;
  /** Drawn in the accent colour so the admin can see which notes were adjusted. */
  nudged: boolean;
}

export interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  /** Fallback timeline length before peaks finish decoding. */
  durationSeconds: number;
  handles: MarkerHandle[];
  /** Note onsets (video seconds, all tracks) for the overlay ticks. */
  noteTicks: NoteTickHandle[];
  /** Toggle the faint note-onset ticks over the waveform. */
  showNotes: boolean;
  /** The selected note's onset: drawn as a handle and draggable, regardless of showNotes. */
  selectedNote?: { videoTimeSeconds: number } | null;
  onNoteDrag?: (videoTimeSeconds: number) => void;
  tailVideoTimeSeconds: number;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  /** When true, dragging a marker shifts it and all later markers. */
  dragAll: boolean;
  selected: MarkerRef | 'tail' | null;
  height?: number;
  /** Drop the canvas's own border + rounding (e.g. when nested in the stage). */
  bare?: boolean;
  getCurrentSeconds: () => number;
  onSeek: (seconds: number) => void;
  onSelect: (target: DragTarget) => void;
  onMarkerDrag: (ref: MarkerRef, videoTimeSeconds: number, mode: DragMode, mods: { snap: boolean }) => void;
  onTailDrag: (videoTimeSeconds: number) => void;
  onDragEnd: () => void;
  onScrollByPx: (dx: number) => void;
  onViewportWidth: (w: number) => void;
  /** Pinch / ctrl-wheel zoom by a multiplicative factor (>1 in, <1 out). */
  onZoomBy?: (factor: number, anchorPx?: number) => void;
  /** Usable region of the media. Outside it the wave is scrimmed and playback
   *  is clamped by the parent; sync waypoints are unaffected. Omit both to
   *  disable trimming entirely — the two non-trim call sites pass nothing. */
  trimInSeconds?: number;
  trimOutSeconds?: number | null;
  /** Resolves a null trimOut for drawing. */
  mediaDurationSeconds?: number | null;
  onTrimDrag?: (edge: 'in' | 'out', videoTimeSeconds: number) => void;
  /** One video second known to land on a beat, for the student click track.
   *  Optional: callers that don't author an anchor pass nothing and get
   *  byte-for-byte the old behaviour. */
  metronomeAnchorSeconds?: number | null;
  onAnchorDrag?: (videoTimeSeconds: number) => void;
  /** Flex Time: the canvas lays out TIMELINE time; the peaks are MEDIA time,
   *  so each column reads the media its timeline span maps to. Omitted or
   *  identity draws exactly as before. Every other draw is already timeline. */
  warp?: FlexMap;
  /** Flex editing (Task 6). On: hits draw as grips (click one to add a point),
   *  points drag and double-click to remove. Off: only the stretch tints draw. */
  flexMode?: boolean;
  /** The section's flex points (src MEDIA, dst TIMELINE). */
  flexPoints?: FlexPoint[];
  /** Detected hits in TIMELINE time, for the grips. */
  hitsTimeline?: readonly number[];
  /** Written note onsets (TIMELINE) — the snap targets, marked in Flex mode. */
  noteTimes?: readonly number[];
  onFlexAdd?: (hitIndex: number) => void;
  onFlexDrag?: (index: number, dstTimeline: number, mods: { snap: boolean }) => void;
  onFlexRemove?: (index: number) => void;
  /** The bar markers and tail still draw but can't be grabbed (a graded part's
   *  bar lines come from the tempo grid). A press on one scrubs/drags as empty
   *  space instead. */
  markersLocked?: boolean;
  /** When given, dragging empty waveform reports a shift (delta seconds from
   *  the press; `mods.snap` false while ⌘ is held) instead of scrubbing. A
   *  plain click still seeks. */
  onBackgroundDrag?: (deltaSeconds: number, phase: 'move' | 'end', mods: { snap: boolean }) => void;
  /** The running A/B loop in TIMELINE seconds, drawn as a gold bracket. */
  loop?: { a: number; b: number } | null;
}

const DEFAULT_HEIGHT = 240;
const LABEL_BAND = 22; // top strip reserved for measure-number chips
const ANCHOR_BAND = 18; // bottom strip reserved for the metronome-anchor grip
/** Pointer must be within this of a handle's x to grab it. Exported so the
 *  backing-track lanes feel identical and the two can never drift apart. */
export const HANDLE_HIT_PX = 9;
export const DRAG_THRESHOLD_PX = 4;
/** Hit grips: ticks along the top of the wave area (just under LABEL_BAND). */
const GRIP_H = 6;
/** The grip band's hit height — a little taller than the tick, for the pointer. */
const GRIP_HIT_H = 12;
/** Two clicks on one flex point within this many ms remove it (on the second
 *  release, and only if that press didn't become a drag). */
const DOUBLE_CLICK_MS = 400;
const FLEX_AMBER = 'hsl(38 92% 50%)';
const TINT_SLOWER = 'hsl(210 90% 55% / .14)';
const TINT_FASTER = 'hsl(28 95% 55% / .14)';

/** `+12 ms · 104%`: signed ms of dst − src, then the playback speed of the
 *  segment to the point's left as a % (Δsrc/Δdst: slower is under 100;
 *  identity, so 100%, for the first point), clamped for display to the rate
 *  driver's [50, 200]. */
export function flexDragLabel(points: readonly FlexPoint[], index: number): string {
  const p = points[index];
  const ms = Math.round((p.dst - p.src) * 1000);
  const prev = points[index - 1];
  const rate = prev && p.dst - prev.dst > 0 ? (p.src - prev.src) / (p.dst - prev.dst) : 1;
  const pct = Math.min(200, Math.max(50, Math.round(100 * rate)));
  return `${ms >= 0 ? '+' : ''}${ms} ms · ${pct}%`;
}

interface ThemeColors {
  bg: string;
  wave: string;
  beatLine: string;
  measureLine: string;
  measureFill: string;
  measureText: string;
  selected: string;
  playhead: string;
  tail: string;
  flag: string;
}

function readTheme(el: HTMLElement): ThemeColors {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).trim();
    return raw ? `hsl(${raw})` : fallback;
  };
  return {
    bg: v('--card', '#ffffff'),
    wave: v('--muted-foreground', '#9ca3af'),
    beatLine: v('--border', '#e5e7eb'),
    measureLine: v('--primary', '#e11d48'),
    measureFill: v('--primary', '#e11d48'),
    measureText: v('--primary-foreground', '#ffffff'),
    selected: v('--gold-highlight', '#d4a017'),
    playhead: v('--primary', 'hsl(30 85% 55%)'),
    tail: v('--muted-foreground', '#9ca3af'),
    flag: v('--destructive', '#dc2626'),
  };
}

export function WaveformCanvas(props: WaveformCanvasProps) {
  const {
    peaks,
    durationSeconds,
    handles,
    noteTicks,
    showNotes,
    selectedNote = null,
    onNoteDrag,
    tailVideoTimeSeconds,
    pixelsPerSecond,
    scrollLeftPx,
    dragAll,
    selected,
    height = DEFAULT_HEIGHT,
    bare = false,
    getCurrentSeconds,
    onSeek,
    onSelect,
    onMarkerDrag,
    onTailDrag,
    onDragEnd,
    onScrollByPx,
    onViewportWidth,
    onZoomBy,
    trimInSeconds,
    trimOutSeconds,
    mediaDurationSeconds,
    onTrimDrag,
    metronomeAnchorSeconds,
    onAnchorDrag,
    warp,
    flexMode = false,
    flexPoints = EMPTY_POINTS,
    hitsTimeline = EMPTY_TIMES,
    noteTimes = EMPTY_TIMES,
    onFlexAdd,
    onFlexDrag,
    onFlexRemove,
    markersLocked = false,
    onBackgroundDrag,
    loop = null,
  } = props;

  const onZoomByRef = useRef(onZoomBy);
  onZoomByRef.current = onZoomBy;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<ThemeColors | null>(null);
  const widthRef = useRef(0);

  // Latest props mirrored into refs for the RAF + pointer handlers (no stale closures).
  const ppsRef = useRef(pixelsPerSecond);
  const scrollRef = useRef(scrollLeftPx);
  const handlesRef = useRef(handles);
  const ticksRef = useRef(noteTicks);
  const selectedNoteRef = useRef(selectedNote);
  const tailRef = useRef(tailVideoTimeSeconds);
  const dragAllRef = useRef(dragAll);
  ppsRef.current = pixelsPerSecond;
  scrollRef.current = scrollLeftPx;
  handlesRef.current = handles;
  ticksRef.current = noteTicks;
  selectedNoteRef.current = selectedNote;
  tailRef.current = tailVideoTimeSeconds;
  dragAllRef.current = dragAll;

  // The pointer effect below keeps its drag state (mode/target/pointerId) in
  // effect-local variables, so it has to subscribe exactly once: re-subscribing
  // mid-drag resets the drag to idle and every later pointermove is dropped.
  // Callers pass identity-unstable callbacks — SyncPanel's onDragEnd is an inline
  // arrow, and its onSeek closes over a transport clock that is a fresh object
  // every render — so the handlers read them through refs and never list them as
  // deps. Same reason as the mirrors above, different failure mode: those exist
  // to avoid stale values, these to avoid losing the drag.
  const onSeekRef = useRef(onSeek);
  const onSelectRef = useRef(onSelect);
  const onMarkerDragRef = useRef(onMarkerDrag);
  const onTailDragRef = useRef(onTailDrag);
  const onNoteDragRef = useRef(onNoteDrag);
  const onDragEndRef = useRef(onDragEnd);
  const onScrollByPxRef = useRef(onScrollByPx);
  // Graded mode (locked markers, background shift): mirrored in an effect, like flex below.
  const markersLockedRef = useRef(markersLocked);
  const onBackgroundDragRef = useRef(onBackgroundDrag);
  useEffect(() => {
    markersLockedRef.current = markersLocked;
    onBackgroundDragRef.current = onBackgroundDrag;
  });
  onSeekRef.current = onSeek;
  onSelectRef.current = onSelect;
  onMarkerDragRef.current = onMarkerDrag;
  onTailDragRef.current = onTailDrag;
  onNoteDragRef.current = onNoteDrag;
  onDragEndRef.current = onDragEnd;
  onScrollByPxRef.current = onScrollByPx;

  // Flex editing, read by the draw and pointer handlers through refs for the
  // same reasons as above. `flexDragRef` is the point being dragged (for the
  // overlay's label) — written only by the pointer handlers.
  const flexModeRef = useRef(flexMode);
  const flexPointsRef = useRef(flexPoints);
  const loopRef = useRef(loop);
  const hitsTimelineRef = useRef(hitsTimeline);
  const noteTimesRef = useRef(noteTimes);
  const onFlexAddRef = useRef(onFlexAdd);
  const onFlexDragRef = useRef(onFlexDrag);
  const onFlexRemoveRef = useRef(onFlexRemove);
  // Mirrored in an effect (not during render). It is declared before the
  // draw effects below, so they always read this commit's values.
  useEffect(() => {
    flexModeRef.current = flexMode;
    flexPointsRef.current = flexPoints;
    loopRef.current = loop;
    hitsTimelineRef.current = hitsTimeline;
    noteTimesRef.current = noteTimes;
    onFlexAddRef.current = onFlexAdd;
    onFlexDragRef.current = onFlexDrag;
    onFlexRemoveRef.current = onFlexRemove;
  });
  const flexDragRef = useRef<number | null>(null);

  // Trim is optional; `trimEnabled` gates both the grips and the hit test so
  // callers that don't trim get byte-for-byte the old behaviour.
  const trimEnabled = onTrimDrag != null && trimInSeconds != null;
  const resolvedTrimOut =
    trimOutSeconds ?? (mediaDurationSeconds != null && mediaDurationSeconds > 0 ? mediaDurationSeconds : null);
  const trimInRef = useRef(trimInSeconds ?? 0);
  const trimOutRef = useRef<number | null>(resolvedTrimOut);
  const trimEnabledRef = useRef(trimEnabled);
  const onTrimDragRef = useRef(onTrimDrag);
  trimInRef.current = trimInSeconds ?? 0;
  trimOutRef.current = resolvedTrimOut;
  trimEnabledRef.current = trimEnabled;
  onTrimDragRef.current = onTrimDrag;

  // The metronome anchor gets its OWN hit band at the bottom, mirroring what
  // trim does at the top. Putting it in hitTest's closest-wins pool would let
  // it steal a downbeat drag exactly when the two coincide -- which is the
  // common case, since an anchor is usually placed on a beat.
  const anchorEnabled = onAnchorDrag != null && metronomeAnchorSeconds != null;
  const anchorRef = useRef<number | null>(metronomeAnchorSeconds ?? null);
  const anchorEnabledRef = useRef(anchorEnabled);
  const onAnchorDragRef = useRef(onAnchorDrag);
  anchorRef.current = metronomeAnchorSeconds ?? null;
  anchorEnabledRef.current = anchorEnabled;
  onAnchorDragRef.current = onAnchorDrag;

  const videoTimeToX = useCallback(
    (t: number) => t * ppsRef.current - scrollRef.current,
    []
  );
  const xToVideoTime = useCallback(
    (x: number) => (x + scrollRef.current) / ppsRef.current,
    []
  );

  // ---- Wave layer draw (gated by prop deps) --------------------------------
  const drawWave = useCallback(() => {
    const canvas = waveRef.current;
    const theme = themeRef.current;
    if (!canvas || !theme) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = widthRef.current;
    const h = height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const waveTop = LABEL_BAND;
    const waveH = h - LABEL_BAND;
    const mid = waveTop + waveH / 2;

    // Flex stretch tints, under everything: drawn whenever points exist (Flex
    // mode or not) so a flexed section reads as flexed.
    const fps = flexPointsRef.current;
    for (let i = 0; i + 1 < fps.length; i++) {
      const a = fps[i];
      const b = fps[i + 1];
      const dDst = b.dst - a.dst;
      const dSrc = b.src - a.src;
      if (Math.abs(dDst - dSrc) < 1e-6) continue;
      const x0 = videoTimeToX(a.dst);
      const x1 = videoTimeToX(b.dst);
      if (x1 < 0 || x0 > w) continue;
      ctx.fillStyle = dDst > dSrc ? TINT_SLOWER : TINT_FASTER;
      ctx.fillRect(x0, waveTop, x1 - x0, waveH);
    }

    // The A/B loop: a gold band at 12% with 2px edges, under the peaks.
    const lp = loopRef.current;
    if (lp && lp.b > lp.a) {
      const x0 = videoTimeToX(lp.a);
      const x1 = videoTimeToX(lp.b);
      if (x1 >= 0 && x0 <= w) {
        ctx.fillStyle = theme.selected;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x0, waveTop, x1 - x0, waveH);
        ctx.globalAlpha = 1;
        ctx.fillRect(x0, waveTop, 2, waveH);
        ctx.fillRect(x1 - 2, waveTop, 2, waveH);
      }
    }

    // Peaks
    if (peaks && peaks.bucketCount > 0 && durationSeconds > 0 && warp && !warp.isIdentity) {
      // Warped: walk the screen columns in timeline time and aggregate the
      // buckets over the media span each column maps to.
      const secPerBucket = peaks.durationSeconds / peaks.bucketCount;
      ctx.strokeStyle = theme.wave;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const [m0, m1] = mediaForColumn(warp, xToVideoTime(x), xToVideoTime(x + 1));
        const first = Math.max(0, Math.floor(m0 / secPerBucket));
        const last = Math.min(peaks.bucketCount - 1, Math.max(first, Math.ceil(m1 / secPerBucket) - 1));
        if (last < first) continue;
        let min = Infinity;
        let max = -Infinity;
        for (let i = first; i <= last; i++) {
          const peak = bucketMinMax(peaks, i);
          min = Math.min(min, peak.min);
          max = Math.max(max, peak.max);
        }
        const yTop = mid - max * (waveH / 2);
        const yBot = mid - min * (waveH / 2);
        ctx.moveTo(x + 0.5, yTop);
        ctx.lineTo(x + 0.5, Math.max(yBot, yTop + 0.5));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (peaks && peaks.bucketCount > 0 && durationSeconds > 0) {
      const secPerBucket = peaks.durationSeconds / peaks.bucketCount;
      const firstT = xToVideoTime(0);
      const lastT = xToVideoTime(w);
      let first = Math.max(0, Math.floor(firstT / secPerBucket));
      let last = Math.min(peaks.bucketCount - 1, Math.ceil(lastT / secPerBucket));
      if (last < first) [first, last] = [0, -1];
      const stride = Math.max(1, Math.ceil((last - first + 1) / Math.max(1, w)));

      ctx.strokeStyle = theme.wave;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let b = first; b <= last; b += stride) {
        const x = videoTimeToX(b * secPerBucket);
        // Aggregate every peak in this screen column so short attacks survive
        // zooming out instead of disappearing between sampled buckets.
        let min = Infinity;
        let max = -Infinity;
        for (let i = b; i < Math.min(b + stride, last + 1); i++) {
          const peak = bucketMinMax(peaks, i);
          min = Math.min(min, peak.min);
          max = Math.max(max, peak.max);
        }
        const yTop = mid - max * (waveH / 2);
        const yBot = mid - min * (waveH / 2);
        ctx.moveTo(x + 0.5, yTop);
        ctx.lineTo(x + 0.5, Math.max(yBot, yTop + 0.5));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // No peaks yet: faint midline so the grid still reads as a timeline.
      ctx.strokeStyle = theme.beatLine;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
    }

    // Note-onset ticks (faint, all tracks) — drawn over the peaks but under the
    // grid so measure lines/chips stay legible. Toggleable via showNotes.
    const drawNotehead = (x: number, scale = 1) => {
      ctx.beginPath();
      ctx.ellipse(x, waveTop + 14, 3.5 * scale, 2.5 * scale, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 3 * scale, waveTop + 14);
      ctx.lineTo(x + 3 * scale, waveTop + 3);
      ctx.stroke();
    };
    if (showNotes && ticksRef.current.length) {
      ctx.strokeStyle = theme.selected;
      ctx.fillStyle = theme.selected;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      for (const tick of ticksRef.current) {
        if (tick.nudged) continue;
        const x = videoTimeToX(tick.videoTimeSeconds);
        if (x < -2 || x > w + 2) continue;
        ctx.moveTo(x + 0.5, waveTop);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();
      // Small noteheads distinguish score onsets from the audio peaks and grid.
      for (const tick of ticksRef.current) {
        if (tick.nudged) continue;
        const x = videoTimeToX(tick.videoTimeSeconds);
        if (x < -4 || x > w + 4) continue;
        drawNotehead(x);
      }
      // Nudged notes: solid, in the primary colour, so adjustments are visible.
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = theme.measureLine;
      ctx.fillStyle = theme.measureLine;
      for (const tick of ticksRef.current) {
        if (!tick.nudged) continue;
        const x = videoTimeToX(tick.videoTimeSeconds);
        if (x < -4 || x > w + 4) continue;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, waveTop);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
        drawNotehead(x);
      }
      ctx.globalAlpha = 1;
    }
    // The selected note's handle: always drawn, so the admin can drag it even
    // with the faint ticks hidden.
    const selNote = selectedNoteRef.current;
    if (selNote) {
      const x = videoTimeToX(selNote.videoTimeSeconds);
      if (x >= -6 && x <= w + 6) {
        ctx.strokeStyle = theme.selected;
        ctx.fillStyle = theme.selected;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, waveTop);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        drawNotehead(x, 1.5);
      }
    }

    // Beat gridlines (faint) for non-downbeat handles in view.
    ctx.strokeStyle = theme.beatLine;
    ctx.lineWidth = 1;
    for (const hnd of handlesRef.current) {
      if (hnd.isDownbeat) continue;
      const x = videoTimeToX(hnd.videoTimeSeconds);
      if (x < -2 || x > w + 2) continue;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, waveTop);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();

      // Beat handle nub at the midline.
      const isSel =
        selected !== null &&
        selected !== 'tail' &&
        selected.measureNumber === hnd.measureNumber &&
        selected.beatInMeasure === hnd.beatInMeasure;
      ctx.fillStyle = isSel ? theme.selected : theme.wave;
      ctx.beginPath();
      ctx.arc(x, mid, isSel ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Measure gridlines + numbered chips (drawn last so they sit on top).
    for (const hnd of handlesRef.current) {
      if (!hnd.isDownbeat) continue;
      const x = videoTimeToX(hnd.videoTimeSeconds);
      if (x < -30 || x > w + 30) continue;
      const isSel =
        selected !== null &&
        selected !== 'tail' &&
        selected.measureNumber === hnd.measureNumber &&
        selected.beatInMeasure === 1;
      ctx.strokeStyle = isSel ? theme.selected : theme.measureLine;
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, LABEL_BAND - 2);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();

      // Number chip.
      const label = String(hnd.measureNumber);
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const chipW = tw + 10;
      ctx.fillStyle = isSel ? theme.selected : theme.measureFill;
      roundRect(ctx, x, 2, chipW, LABEL_BAND - 6, 4);
      ctx.fill();
      ctx.fillStyle = theme.measureText;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 5, 2 + (LABEL_BAND - 6) / 2 + 0.5);

      if (hnd.flagged) {
        ctx.fillStyle = theme.flag;
        ctx.beginPath();
        ctx.arc(x + chipW - 1, 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tail boundary.
    const tx = videoTimeToX(tailRef.current);
    if (tx >= -2 && tx <= w + 2) {
      ctx.strokeStyle = selected === 'tail' ? theme.selected : theme.tail;
      ctx.lineWidth = selected === 'tail' ? 2.5 : 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(tx + 0.5, LABEL_BAND - 2);
      ctx.lineTo(tx + 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Flex editing: note targets, hit grips, then the points (anchors dashed
    // and dimmer). Points show only in Flex mode; the tints above always do.
    if (flexModeRef.current) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = FLEX_AMBER;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (const t of noteTimesRef.current) {
        const x = videoTimeToX(t);
        if (x < -2 || x > w + 2) continue;
        ctx.moveTo(x + 0.5, h - 6);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();

      ctx.strokeStyle = theme.wave;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const t of hitsTimelineRef.current) {
        const x = videoTimeToX(t);
        if (x < -2 || x > w + 2) continue;
        ctx.moveTo(x, waveTop);
        ctx.lineTo(x, waveTop + GRIP_H);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = FLEX_AMBER;
      for (const p of fps) {
        const x = videoTimeToX(p.dst);
        if (x < -2 || x > w + 2) continue;
        ctx.globalAlpha = p.anchor ? 0.5 : 1;
        ctx.lineWidth = p.anchor ? 1.5 : 2;
        ctx.setLineDash(p.anchor ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(x, waveTop);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }

    // Trim: scrim everything outside the usable region, then draw the grips.
    // A theme.bg scrim (rather than recolouring the peaks) dims peaks, grid
    // lines and note ticks uniformly, so "outside the usable region" reads as
    // one idea and the peak loop above needs no changes. LABEL_BAND stays
    // undimmed so the grips remain bright and grabbable.
    if (trimEnabledRef.current) {
      const inX = videoTimeToX(trimInRef.current);
      const outX = trimOutRef.current != null ? videoTimeToX(trimOutRef.current) : w;

      ctx.fillStyle = theme.bg;
      ctx.globalAlpha = 0.62;
      if (inX > 0) ctx.fillRect(0, LABEL_BAND, Math.min(inX, w), h - LABEL_BAND);
      if (outX < w) ctx.fillRect(Math.max(outX, 0), LABEL_BAND, w - Math.max(outX, 0), h - LABEL_BAND);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = theme.measureLine;
      ctx.lineWidth = 1.5;
      for (const x of [inX, outX]) {
        if (x < -2 || x > w + 2) continue;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, LABEL_BAND);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }

      // Grips, in the band that owns their hit test.
      ctx.fillStyle = theme.measureLine;
      for (const x of [inX, outX]) {
        if (x < -2 || x > w + 2) continue;
        ctx.beginPath();
        ctx.roundRect(x - 4, 3, 8, LABEL_BAND - 6, 2);
        ctx.fill();
      }
      ctx.lineWidth = 1;
    }

    // Metronome anchor: one beat of the recording, drawn full height so it can
    // be eyeballed against a transient, but grabbable only by the grip in
    // ANCHOR_BAND. Distinct colour from the trim grips so the two bands read as
    // different tools.
    if (anchorEnabledRef.current && anchorRef.current != null) {
      const ax = videoTimeToX(anchorRef.current);
      if (ax >= -2 && ax <= w + 2) {
        ctx.strokeStyle = theme.selected;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ax + 0.5, LABEL_BAND);
        ctx.lineTo(ax + 0.5, h - ANCHOR_BAND);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = theme.selected;
        ctx.beginPath();
        ctx.roundRect(ax - 5, h - ANCHOR_BAND + 3, 10, ANCHOR_BAND - 6, 2);
        ctx.fill();
        ctx.lineWidth = 1;
      }
    }
  }, [
    peaks,
    durationSeconds,
    selected,
    height,
    showNotes,
    videoTimeToX,
    xToVideoTime,
    warp,
  ]);

  // ---- Sizing + DPR --------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const wave = waveRef.current;
    const overlay = overlayRef.current;
    if (!container || !wave || !overlay) return;

    themeRef.current = readTheme(container);

    const applySize = () => {
      const cssW = container.clientWidth;
      widthRef.current = cssW;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [wave, overlay]) {
        c.width = Math.max(1, Math.floor(cssW * dpr));
        c.height = Math.max(1, Math.floor(height * dpr));
        c.style.width = `${cssW}px`;
        c.style.height = `${height}px`;
        const cx = c.getContext('2d');
        if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      onViewportWidth(cssW);
      drawWave();
    };
    applySize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(applySize);
      ro.observe(container);
    }
    return () => ro?.disconnect();
  }, [height, drawWave, onViewportWidth]);

  // Redraw the wave layer whenever inputs change.
  useEffect(() => {
    drawWave();
  }, [
    drawWave,
    handles,
    noteTicks,
    selectedNote,
    tailVideoTimeSeconds,
    pixelsPerSecond,
    scrollLeftPx,
    // Read through refs inside drawWave, but a change still needs a repaint.
    trimEnabled,
    trimInSeconds,
    resolvedTrimOut,
    anchorEnabled,
    metronomeAnchorSeconds,
    flexMode,
    flexPoints,
    hitsTimeline,
    noteTimes,
    loop,
  ]);

  // ---- Playhead overlay RAF -----------------------------------------------
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = overlayRef.current;
      const theme = themeRef.current;
      if (canvas && theme) {
        const ctx = canvas.getContext('2d');
        const w = widthRef.current;
        if (ctx) {
          ctx.clearRect(0, 0, w, height);
          const x = videoTimeToX(getCurrentSeconds());
          if (x >= -2 && x <= w + 2) {
            ctx.strokeStyle = theme.playhead;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, LABEL_BAND - 6);
            ctx.lineTo(x + 0.5, height);
            ctx.stroke();
          }
          // The dragged flex point's offset and its left segment's speed.
          const di = flexDragRef.current;
          const fp = di !== null ? flexPointsRef.current[di] : undefined;
          if (di !== null && fp) {
            const label = flexDragLabel(flexPointsRef.current, di);
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            const tw = ctx.measureText(label).width;
            const px = videoTimeToX(fp.dst);
            const lx = Math.min(Math.max(px + 6, 2), Math.max(2, w - tw - 12));
            const ly = LABEL_BAND + GRIP_HIT_H + 2;
            ctx.fillStyle = FLEX_AMBER;
            roundRect(ctx, lx, ly, tw + 10, 16, 4);
            ctx.fill();
            ctx.fillStyle = '#1a1206';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx + 5, ly + 8.5);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentSeconds, height, videoTimeToX]);

  // ---- Pointer interaction -------------------------------------------------
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    let mode:
      | 'idle'
      | 'pending-marker'
      | 'dragging-marker'
      | 'pending-scrub'
      | 'scrubbing'
      | 'shifting'
      | 'pending-trim'
      | 'dragging-trim'
      | 'pending-anchor'
      | 'dragging-anchor'
      | 'pending-flex-add'
      | 'pending-flex'
      | 'pending-flex-remove'
      | 'dragging-flex' = 'idle';
    let target: DragTarget | null = null;
    let startX = 0;
    let pointerId: number | null = null;
    // Flex: the hit or point under the press, and the last plain click on a
    // point (for the double-click remove; a drag never counts as a click).
    let flexIndex = -1;
    let lastFlexClick: { index: number; at: number } | null = null;

    const localX = (e: { clientX: number }) => {
      const rect = overlay.getBoundingClientRect();
      return e.clientX - rect.left;
    };
    const localY = (e: { clientY: number }) => {
      const rect = overlay.getBoundingClientRect();
      return e.clientY - rect.top;
    };

    /**
     * Trim grips live ONLY in the top label band. Putting them in the same
     * closest-wins pool as the markers would let a trim handle steal a downbeat
     * drag exactly when they coincide — which is precisely when an admin trims
     * to a bar line. Below LABEL_BAND nothing about the existing behaviour
     * changes.
     */
    const trimHitTest = (x: number): 'in' | 'out' | null => {
      if (!trimEnabledRef.current) return null;
      const inX = videoTimeToX(trimInRef.current);
      if (Math.abs(inX - x) <= HANDLE_HIT_PX) return 'in';
      const out = trimOutRef.current;
      if (out != null && Math.abs(videoTimeToX(out) - x) <= HANDLE_HIT_PX) return 'out';
      return null;
    };

    /** Anchor grip: bottom band only, same isolation rationale as trim. */
    const anchorHitTest = (x: number): boolean => {
      if (!anchorEnabledRef.current || anchorRef.current == null) return false;
      return Math.abs(videoTimeToX(anchorRef.current) - x) <= HANDLE_HIT_PX;
    };

    const hitTest = (x: number): DragTarget | null => {
      let best: { target: DragTarget; dist: number } | null = null;
      // The note the admin just selected wins ties with markers.
      const selNote = selectedNoteRef.current;
      if (selNote && onNoteDragRef.current) {
        const d = Math.abs(videoTimeToX(selNote.videoTimeSeconds) - x);
        if (d <= HANDLE_HIT_PX) best = { target: { kind: 'note' }, dist: d };
      }
      if (markersLockedRef.current) return best?.target ?? null;
      for (const hnd of handlesRef.current) {
        const hx = videoTimeToX(hnd.videoTimeSeconds);
        const d = Math.abs(hx - x);
        if (d <= HANDLE_HIT_PX && (!best || d < best.dist)) {
          best = { target: { kind: 'marker', ref: { measureNumber: hnd.measureNumber, beatInMeasure: hnd.beatInMeasure } }, dist: d };
        }
      }
      const tx = videoTimeToX(tailRef.current);
      if (Math.abs(tx - x) <= HANDLE_HIT_PX && (!best || Math.abs(tx - x) < best.dist)) {
        best = { target: { kind: 'tail' }, dist: Math.abs(tx - x) };
      }
      return best?.target ?? null;
    };

    /** Flex mode, below the chip band and above the anchor band: the nearest
     *  point (the metronome-anchor grip and tail stay reachable below). */
    const flexPointHitTest = (x: number): number => {
      let best = -1;
      let bestD = Infinity;
      flexPointsRef.current.forEach((p, i) => {
        const d = Math.abs(videoTimeToX(p.dst) - x);
        if (d <= HANDLE_HIT_PX && d < bestD) {
          best = i;
          bestD = d;
        }
      });
      return best;
    };
    /** Flex mode: the nearest hit grip (the caller checks the grip band). */
    const gripHitTest = (x: number): number => {
      let best = -1;
      let bestD = Infinity;
      hitsTimelineRef.current.forEach((t, i) => {
        const d = Math.abs(videoTimeToX(t) - x);
        if (d <= HANDLE_HIT_PX && d < bestD) {
          best = i;
          bestD = d;
        }
      });
      return best;
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const x = localX(e);
      startX = x;
      pointerId = e.pointerId;
      try { overlay.setPointerCapture(e.pointerId); } catch { /* noop */ }

      // Flex mode wins over the bar markers only for its own points and grips,
      // and never in the chip band, so bar chips and trim keep working.
      const y = localY(e);
      if (flexModeRef.current && y >= LABEL_BAND) {
        const aboveAnchorBand = y <= overlay.clientHeight - ANCHOR_BAND;
        const pi = onFlexDragRef.current && aboveAnchorBand ? flexPointHitTest(x) : -1;
        if (pi >= 0) {
          const now = performance.now();
          const second = !!lastFlexClick && lastFlexClick.index === pi && now - lastFlexClick.at <= DOUBLE_CLICK_MS;
          lastFlexClick = null;
          flexIndex = pi;
          // The second press only arms the removal: it happens on release if
          // the pointer stayed put, and becomes a plain drag if it moved.
          mode = second ? 'pending-flex-remove' : 'pending-flex';
          return;
        }
        if (y < LABEL_BAND + GRIP_HIT_H) {
          const gi = onFlexAddRef.current ? gripHitTest(x) : -1;
          if (gi >= 0) {
            flexIndex = gi;
            mode = 'pending-flex-add';
            return;
          }
        }
      }
      if (localY(e) > overlay.clientHeight - ANCHOR_BAND && anchorHitTest(x)) {
        target = { kind: 'anchor' };
        mode = 'pending-anchor';
        onSelectRef.current(target);
        return;
      }

      if (localY(e) < LABEL_BAND) {
        const edge = trimHitTest(x);
        if (edge) {
          target = { kind: 'trim', edge };
          mode = 'pending-trim';
          onSelectRef.current(target);
          return;
        }
      }

      const hit = hitTest(x);
      if (hit) {
        target = hit;
        mode = 'pending-marker';
        onSelectRef.current(hit);
      } else {
        target = null;
        mode = 'pending-scrub';
      }
    };

    const onMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId || mode === 'idle') return;
      e.preventDefault();
      const x = localX(e);
      const moved = Math.abs(x - startX) >= DRAG_THRESHOLD_PX;

      if (mode === 'pending-marker' && moved) mode = 'dragging-marker';
      if (mode === 'pending-scrub' && moved) mode = onBackgroundDragRef.current ? 'shifting' : 'scrubbing';
      if (mode === 'pending-trim' && moved) mode = 'dragging-trim';
      if (mode === 'pending-anchor' && moved) mode = 'dragging-anchor';
      if ((mode === 'pending-flex' || mode === 'pending-flex-remove') && moved) {
        mode = 'dragging-flex';
        flexDragRef.current = flexIndex;
      }

      if (mode === 'dragging-flex') {
        onFlexDragRef.current?.(flexIndex, xToVideoTime(x), { snap: !e.metaKey });
      } else if (mode === 'dragging-anchor') {
        onAnchorDragRef.current?.(xToVideoTime(x));
      } else if (mode === 'dragging-trim' && target?.kind === 'trim') {
        onTrimDragRef.current?.(target.edge, xToVideoTime(x));
      } else if (mode === 'dragging-marker' && target) {
        const t = xToVideoTime(x);
        if (target.kind === 'tail') onTailDragRef.current(t);
        else if (target.kind === 'marker') {
          const ripple = dragAllRef.current !== e.altKey;
          onMarkerDragRef.current(target.ref, t, ripple ? 'all-after' : 'single', { snap: !e.metaKey });
        } else if (target.kind === 'note') {
          onNoteDragRef.current?.(t);
        }
      } else if (mode === 'scrubbing') {
        onSeekRef.current(xToVideoTime(x));
      } else if (mode === 'shifting') {
        onBackgroundDragRef.current?.((x - startX) / ppsRef.current, 'move', { snap: !e.metaKey });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      try { overlay.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      lastFlexClick = null;
      if (mode === 'pending-flex-add' && Math.abs(localX(e) - startX) < DRAG_THRESHOLD_PX) {
        onFlexAddRef.current?.(flexIndex);
      } else if (mode === 'pending-flex-remove') {
        if (Math.abs(localX(e) - startX) < DRAG_THRESHOLD_PX) onFlexRemoveRef.current?.(flexIndex);
      } else if (mode === 'pending-flex') {
        lastFlexClick = { index: flexIndex, at: performance.now() };
      } else if (mode === 'dragging-flex') {
        flexDragRef.current = null;
      } else if (mode === 'pending-scrub') {
        // A click on empty space = seek there.
        onSeekRef.current(xToVideoTime(localX(e)));
      } else if (mode === 'shifting') {
        onBackgroundDragRef.current?.((localX(e) - startX) / ppsRef.current, 'end', { snap: !e.metaKey });
      } else if (
        mode === 'dragging-marker' ||
        mode === 'dragging-trim' ||
        mode === 'dragging-anchor'
      ) {
        onDragEndRef.current();
      }
      mode = 'idle';
      target = null;
      pointerId = null;
      flexIndex = -1;
    };

    const onWheel = (e: WheelEvent) => {
      const horizontal = !e.ctrlKey && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY));
      if (!horizontal && onZoomByRef.current && e.deltaY !== 0) {
        e.preventDefault();
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? overlay.clientHeight : 1);
        onZoomByRef.current(Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003), localX(e));
        return;
      }
      if (!horizontal) return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx !== 0) {
        e.preventDefault();
        onScrollByPxRef.current(dx);
      }
    };

    // Safari/macOS pinch fires gesture events (no ctrl+wheel). Track the scale
    // delta between frames and translate it into multiplicative zoom steps.
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as unknown as { scale: number }).scale || 1;
      if (onZoomByRef.current && lastScale > 0) onZoomByRef.current(scale / lastScale);
      lastScale = scale;
    };

    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    overlay.addEventListener('wheel', onWheel, { passive: false });
    overlay.addEventListener('gesturestart', onGestureStart as EventListener);
    overlay.addEventListener('gesturechange', onGestureChange as EventListener);
    return () => {
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      overlay.removeEventListener('wheel', onWheel);
      overlay.removeEventListener('gesturestart', onGestureStart as EventListener);
      overlay.removeEventListener('gesturechange', onGestureChange as EventListener);
    };
    // Deliberately subscribes once: both deps are useCallback([]) and the drag
    // callbacks are read through refs, so an in-flight drag survives re-renders.
  }, [videoTimeToX, xToVideoTime]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none overflow-hidden${bare ? '' : ' rounded-md border border-border'}`}
      style={{ height, touchAction: 'none' }}
    >
      <canvas ref={waveRef} className="absolute inset-0" />
      <canvas ref={overlayRef} className="absolute inset-0 cursor-crosshair" />
    </div>
  );
}

const EMPTY_POINTS: FlexPoint[] = [];
const EMPTY_TIMES: number[] = [];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
