'use client';

// PlaySense Studio — backing-track lanes.
//
// One thin row per backing track, directly under the main waveform and in the
// SAME coordinate space (x = t*pps - scrollLeft). Each row draws that track's
// own peaks inside a clip body you can drag horizontally to position, with
// grab handles on both edges to trim it.
//
// Canvas rather than DOM (unlike SectionsLane, which is one rectangle per
// section): a lane is a peaks envelope of hundreds of strokes that must be
// redrawn on every wheel tick as pps/scrollLeft change. WaveformCanvas already
// solved that with an imperative redraw and no reconciliation, so this mirrors
// it — two stacked canvases, a static lane layer plus an overlay that owns the
// playhead and all pointer handling. A click-through DOM layer on top carries
// the label + audition toggle so the lanes stay keyboard- and screen-reader-
// reachable.
//
// No trim arithmetic lives here. Every drag routes through clip-model.ts.

import type { FlexMap } from '@/lib/playsense-studio/flex';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  clipTimelineRange,
  moveClip,
  snapToNearest,
  trimClipIn,
  trimClipOut,
  type Clip,
  type ClipBounds,
} from '@/lib/playsense-studio/clip-model';
import { bucketMinMax, type WaveformPeaks } from '@/lib/playsense-studio/waveform';
import { sectionColor } from '@/components/playsense-studio/sync/sections-lane';
import {
  DRAG_THRESHOLD_PX,
  HANDLE_HIT_PX,
} from '@/components/playsense-studio/sync/waveform-canvas';

/** Row height: a 28px clip body with 3px of air above and below. */
export const LANE_H = 34;
const CLIP_PAD = 3;
const CLIP_BODY_H = LANE_H - CLIP_PAD * 2;
/** Shift-snap tolerance in pixels, converted to seconds at the current zoom. */
const SNAP_PX = 8;

export interface LaneClip extends Clip {
  warp?: FlexMap;
  trackId: string;
  label: string;
  sourceDurationSeconds: number | null;
  peaks: WaveformPeaks | null;
  /** Decode in flight — the body renders as a skeleton, still draggable. */
  loading: boolean;
  progress: number;
  /** Peaks unavailable (CORS/codec). Positioning still works off a flat bar. */
  failed: boolean;
  /** Audition state. Ephemeral — never persisted; this is not a mixer. */
  enabled: boolean;
}

export type ClipDragPart = 'body' | 'in' | 'out';

export interface BackingLanesProps {
  clips: LaneClip[];
  pixelsPerSecond: number;
  scrollLeftPx: number;
  selectedTrackId: string | null;
  /** Measure downbeats, for Shift-snap. */
  snapTimes: number[];
  getCurrentSeconds: () => number;
  isPlaying: boolean;
  onSelect: (trackId: string) => void;
  /** Live during a drag — the parent holds the clip state. */
  onClipChange: (trackId: string, next: Clip) => void;
  /** Pointer released. `moved` distinguishes a real drag from a plain click,
   *  which matters for both persistence and re-cueing the mixer. */
  onClipCommit: (trackId: string, part: ClipDragPart, moved: boolean) => void;
  onScrollByPx: (dx: number) => void;
  onZoomBy?: (factor: number, anchorPx?: number) => void;
}

interface LaneTheme {
  bg: string;
  wave: string;
  line: string;
  text: string;
  playhead: string;
  skeleton: string;
}

function readLaneTheme(el: HTMLElement): LaneTheme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).trim();
    return raw ? `hsl(${raw})` : fallback;
  };
  return {
    bg: v('--card', '#ffffff'),
    wave: v('--foreground', '#111827'),
    line: v('--border', '#e5e7eb'),
    text: v('--foreground', '#111827'),
    playhead: v('--primary', 'hsl(30 85% 55%)'),
    skeleton: v('--muted-foreground', '#9ca3af'),
  };
}

const boundsOf = (clip: LaneClip): ClipBounds => ({
  sourceDurationSeconds: clip.sourceDurationSeconds,
});

export function BackingLanes(props: BackingLanesProps) {
  const {
    clips,
    pixelsPerSecond,
    scrollLeftPx,
    selectedTrackId,
    snapTimes,
    getCurrentSeconds,
    isPlaying,
    onSelect,
    onClipChange,
    onClipCommit,
    onScrollByPx,
    onZoomBy,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<LaneTheme | null>(null);
  const widthRef = useRef(0);

  const height = Math.max(LANE_H, clips.length * LANE_H);

  // Everything the pointer handlers read lives in a ref, so the listener effect
  // depends only on stable identities and can never rebind mid-drag.
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const ppsRef = useRef(pixelsPerSecond);
  ppsRef.current = pixelsPerSecond;
  const scrollRef = useRef(scrollLeftPx);
  scrollRef.current = scrollLeftPx;
  const snapRef = useRef(snapTimes);
  snapRef.current = snapTimes;
  const getCurrentSecondsRef = useRef(getCurrentSeconds);
  getCurrentSecondsRef.current = getCurrentSeconds;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onClipChangeRef = useRef(onClipChange);
  onClipChangeRef.current = onClipChange;
  const onClipCommitRef = useRef(onClipCommit);
  onClipCommitRef.current = onClipCommit;
  const onScrollByPxRef = useRef(onScrollByPx);
  onScrollByPxRef.current = onScrollByPx;
  const onZoomByRef = useRef(onZoomBy);
  onZoomByRef.current = onZoomBy;

  const timeToX = useCallback((t: number) => t * ppsRef.current - scrollRef.current, []);
  const xToTime = useCallback((x: number) => (x + scrollRef.current) / ppsRef.current, []);

  // ---- Lane layer ---------------------------------------------------------
  const drawLanes = useCallback(() => {
    const canvas = laneRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const theme = themeRef.current ?? readLaneTheme(container);
    const w = widthRef.current;
    const h = height;
    if (w <= 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.bg;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    clipsRef.current.forEach((clip, index) => {
      const top = index * LANE_H;

      // Row separator.
      ctx.strokeStyle = theme.line;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, top + 0.5);
      ctx.lineTo(w, top + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const range = clipTimelineRange(clip, boundsOf(clip));
      const x0 = timeToX(clip.warp?.toTimeline(range.startSeconds) ?? range.startSeconds);
      const x1 = timeToX(clip.warp?.toTimeline(range.endSeconds) ?? range.endSeconds);
      // A clip whose source length is still unknown has a zero-width range;
      // give it a placeholder body so it can still be seen and grabbed.
      const bodyX0 = x0;
      const bodyX1 = x1 > x0 ? x1 : x0 + 120;
      if (bodyX1 < 0 || bodyX0 > w) return;

      const bodyTop = top + CLIP_PAD;
      const color = sectionColor(index);
      const selected = clip.trackId === selectedTrackId;

      const left = Math.max(bodyX0, -2);
      const right = Math.min(bodyX1, w + 2);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(left, bodyTop, Math.max(right - left, 2), CLIP_BODY_H, 5);
      ctx.clip();

      ctx.globalAlpha = clip.enabled ? 0.22 : 0.09;
      ctx.fillStyle = color;
      ctx.fillRect(left, bodyTop, Math.max(right - left, 2), CLIP_BODY_H);
      ctx.globalAlpha = 1;

      if (clip.peaks && clip.peaks.bucketCount > 0) {
        drawClipPeaks(ctx, clip, clip.peaks, {
          left,
          right,
          bodyTop,
          color,
          alpha: clip.enabled ? 0.85 : 0.35,
          xToTime: x => clip.warp?.toMedia(xToTime(x)) ?? xToTime(x),
          timeToX,
          pixelsPerSecond: ppsRef.current,
        });
      } else {
        // No peaks (loading, or decode failed): a flat midline keeps the body
        // readable as a clip and the whole row stays draggable.
        ctx.strokeStyle = clip.failed ? theme.skeleton : color;
        ctx.globalAlpha = clip.failed ? 0.5 : 0.35;
        ctx.beginPath();
        ctx.moveTo(left, bodyTop + CLIP_BODY_H / 2);
        ctx.lineTo(right, bodyTop + CLIP_BODY_H / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (clip.loading) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(left, bodyTop + CLIP_BODY_H - 3, (right - left) * clip.progress, 3);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();

      // Body outline + edge grips.
      ctx.strokeStyle = color;
      ctx.globalAlpha = selected ? 1 : 0.6;
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(left + 0.5, bodyTop + 0.5, Math.max(right - left - 1, 1), CLIP_BODY_H - 1, 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;

      for (const [x, visible] of [
        [bodyX0, bodyX0 >= -1 && bodyX0 <= w + 1],
        [bodyX1, bodyX1 >= -1 && bodyX1 <= w + 1],
      ] as [number, boolean][]) {
        if (!visible) continue;
        ctx.fillStyle = color;
        ctx.globalAlpha = selected ? 0.95 : 0.7;
        ctx.fillRect(x - 1.5, bodyTop + 3, 3, CLIP_BODY_H - 6);
        ctx.globalAlpha = 1;
      }
    });
  }, [height, selectedTrackId, timeToX, xToTime]);

  // ---- Sizing / DPR -------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const lane = laneRef.current;
    const overlay = overlayRef.current;
    if (!container || !lane || !overlay) return;

    themeRef.current = readLaneTheme(container);

    const applySize = () => {
      const cssW = container.clientWidth;
      widthRef.current = cssW;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [lane, overlay]) {
        c.width = Math.max(1, Math.floor(cssW * dpr));
        c.height = Math.max(1, Math.floor(height * dpr));
        c.style.width = `${cssW}px`;
        c.style.height = `${height}px`;
        const cx = c.getContext('2d');
        if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      drawLanes();
    };
    applySize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(applySize);
      ro.observe(container);
    }
    return () => ro?.disconnect();
  }, [height, drawLanes]);

  useEffect(() => {
    drawLanes();
  }, [drawLanes, clips, pixelsPerSecond, scrollLeftPx]);

  // ---- Playhead overlay ---------------------------------------------------
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const paint = () => {
      const theme = themeRef.current;
      const w = widthRef.current;
      ctx.clearRect(0, 0, w, height);
      if (theme) {
        const x = timeToX(getCurrentSecondsRef.current());
        if (x >= 0 && x <= w) {
          ctx.strokeStyle = theme.playhead;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, height);
          ctx.stroke();
        }
      }
      if (isPlaying) raf = requestAnimationFrame(paint);
    };

    paint();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, height, timeToX]);

  // ---- Pointer ------------------------------------------------------------
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    type Mode = 'idle' | 'pending' | 'move' | 'trim-in' | 'trim-out';
    let mode: Mode = 'idle';
    let part: ClipDragPart = 'body';
    let trackId: string | null = null;
    let grabOffsetSeconds = 0;
    let downX = 0;

    const localX = (e: PointerEvent | WheelEvent) =>
      e.clientX - overlay.getBoundingClientRect().left;
    const localY = (e: PointerEvent) => e.clientY - overlay.getBoundingClientRect().top;

    /** Edges are tested before the body, so a narrow clip stays trimmable. */
    const hitTest = (x: number, y: number): { trackId: string; part: ClipDragPart } | null => {
      const index = Math.floor(y / LANE_H);
      const clip = clipsRef.current[index];
      if (!clip) return null;
      const range = clipTimelineRange(clip, boundsOf(clip));
      const x0 = timeToX(clip.warp?.toTimeline(range.startSeconds) ?? range.startSeconds);
      const x1 = range.endSeconds > range.startSeconds ? timeToX(clip.warp?.toTimeline(range.endSeconds) ?? range.endSeconds) : x0 + 120;
      if (Math.abs(x - x0) <= HANDLE_HIT_PX) return { trackId: clip.trackId, part: 'in' };
      if (Math.abs(x - x1) <= HANDLE_HIT_PX) return { trackId: clip.trackId, part: 'out' };
      if (x >= x0 && x <= x1) return { trackId: clip.trackId, part: 'body' };
      return null;
    };

    const maybeSnap = (seconds: number, shift: boolean) =>
      shift ? snapToNearest(seconds, snapRef.current, SNAP_PX / ppsRef.current) : seconds;

    const apply = (e: PointerEvent) => {
      const clip = clipsRef.current.find((c) => c.trackId === trackId);
      if (!clip) return;
      const bounds = boundsOf(clip);
      const timeline = xToTime(localX(e));
      const t = clip.warp?.toMedia(timeline) ?? timeline;
      if (mode === 'move') {
        onClipChangeRef.current(clip.trackId, moveClip(clip, bounds, clip.warp?.toMedia(maybeSnap(clip.warp.toTimeline(t - grabOffsetSeconds), e.shiftKey)) ?? maybeSnap(t - grabOffsetSeconds, e.shiftKey)));
      } else if (mode === 'trim-in') {
        onClipChangeRef.current(clip.trackId, trimClipIn(clip, bounds, clip.warp?.toMedia(maybeSnap(timeline, e.shiftKey)) ?? maybeSnap(t, e.shiftKey)));
      } else if (mode === 'trim-out') {
        onClipChangeRef.current(clip.trackId, trimClipOut(clip, bounds, clip.warp?.toMedia(maybeSnap(timeline, e.shiftKey)) ?? maybeSnap(t, e.shiftKey)));
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const hit = hitTest(localX(e), localY(e));
      if (!hit) return;
      const clip = clipsRef.current.find((c) => c.trackId === hit.trackId);
      if (!clip) return;

      overlay.setPointerCapture(e.pointerId);
      trackId = hit.trackId;
      part = hit.part;
      mode = 'pending';
      downX = localX(e);
      // Grab the clip where it was actually clicked, so it doesn't teleport.
      grabOffsetSeconds = (clip.warp?.toMedia(xToTime(downX)) ?? xToTime(downX)) - clip.timelineStartSeconds;
      onSelectRef.current(hit.trackId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (mode === 'idle') {
        const hit = hitTest(localX(e), localY(e));
        overlay.style.cursor = !hit ? 'default' : hit.part === 'body' ? 'grab' : 'ew-resize';
        return;
      }
      if (mode === 'pending') {
        if (Math.abs(localX(e) - downX) < DRAG_THRESHOLD_PX) return;
        mode = part === 'body' ? 'move' : part === 'in' ? 'trim-in' : 'trim-out';
        overlay.style.cursor = part === 'body' ? 'grabbing' : 'ew-resize';
      }
      apply(e);
    };

    const onUp = (e: PointerEvent) => {
      const moved = mode === 'move' || mode === 'trim-in' || mode === 'trim-out';
      // A click that never moved selects only. Lanes deliberately do NOT seek —
      // that would fight the main waveform's scrub.
      if (trackId) onClipCommitRef.current(trackId, part, moved);
      mode = 'idle';
      trackId = null;
      overlay.style.cursor = 'default';
      try {
        overlay.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onZoomByRef.current?.(Math.exp(-e.deltaY * 0.003), localX(e));
        return;
      }
      // Vertical gestures belong to the track stack's native scroll area.
      // Only horizontal gestures (or Shift + wheel) pan the timeline.
      e.stopPropagation();
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const dx = horizontal ? (e.shiftKey ? e.deltaY || e.deltaX : e.deltaX) : 0;
      if (dx !== 0) {
        e.preventDefault();
        onScrollByPxRef.current(dx);
      }
    };

    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      overlay.removeEventListener('wheel', onWheel);
    };
  }, [timeToX, xToTime]);

  // ---- Click-through DOM chrome (labels stay selectable/announced) ---------
  const chrome = useMemo(
    () =>
      clips.map((clip, index) => {
        const range = clipTimelineRange(clip, boundsOf(clip));
        return {
          clip,
          index,
          left: Math.max((clip.warp?.toTimeline(range.startSeconds) ?? range.startSeconds) * pixelsPerSecond - scrollLeftPx, 2),
          top: index * LANE_H + CLIP_PAD,
        };
      }),
    [clips, pixelsPerSecond, scrollLeftPx]
  );

  return (
    <div ref={containerRef} className="st-backing-lanes" style={{ height }}>
      <canvas ref={laneRef} className="st-backing-lane-canvas" />
      <canvas ref={overlayRef} className="st-backing-lane-canvas st-backing-lane-overlay" />
      <div className="st-backing-lane-chrome">
        {chrome.map(({ clip, index, left, top }) => (
          <span
            key={clip.trackId}
            className="st-backing-lane-chip"
            style={{ left, top, ['--block-color' as string]: sectionColor(index) }}
            title={clip.failed ? `${clip.label} — couldn't read this audio` : clip.label}
          >
            {clip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Draw one clip's peaks inside its body. Column-based rather than bucket-based
 * because the source window is offset by trimIn: each screen column maps back
 * through the clip's placement into the file's own time, then into buckets.
 */
function drawClipPeaks(
  ctx: CanvasRenderingContext2D,
  clip: LaneClip,
  peaks: WaveformPeaks,
  o: {
    left: number;
    right: number;
    bodyTop: number;
    color: string;
    alpha: number;
    xToTime: (x: number) => number;
    timeToX: (t: number) => number;
    pixelsPerSecond: number;
  }
) {
  const secPerBucket = peaks.durationSeconds / peaks.bucketCount;
  if (!(secPerBucket > 0)) return;

  const mid = o.bodyTop + CLIP_BODY_H / 2;
  const halfH = (CLIP_BODY_H - 4) / 2;


  ctx.strokeStyle = o.color;
  ctx.globalAlpha = o.alpha;
  ctx.beginPath();

  for (let x = Math.floor(o.left); x <= Math.ceil(o.right); x++) {
    // Timeline -> source-file time, honouring where the clip was trimmed in.
    const sourceT = clip.trimInSeconds + (o.xToTime(x) - clip.timelineStartSeconds);
    if (sourceT < 0 || sourceT >= peaks.durationSeconds) continue;

    const first = Math.floor(sourceT / secPerBucket);
    const last = Math.min(peaks.bucketCount - 1, Math.floor((clip.trimInSeconds + o.xToTime(x + 1) - clip.timelineStartSeconds) / secPerBucket));

    let min = Infinity;
    let max = -Infinity;
    for (let b = first; b <= last; b++) {
      const peak = bucketMinMax(peaks, b);
      min = Math.min(min, peak.min);
      max = Math.max(max, peak.max);
    }
    if (min === Infinity) continue;

    const yTop = mid - max * halfH;
    const yBot = mid - min * halfH;
    ctx.moveTo(x + 0.5, yTop);
    ctx.lineTo(x + 0.5, Math.max(yBot, yTop + 0.5));
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}
