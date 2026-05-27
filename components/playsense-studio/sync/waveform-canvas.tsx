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
import type { MarkerRef } from './marker-model';

export interface MarkerHandle {
  measureNumber: number;
  beatInMeasure: number;
  isDownbeat: boolean;
  videoTimeSeconds: number;
}

export type DragMode = 'single' | 'all-after';
export type DragTarget = { kind: 'marker'; ref: MarkerRef } | { kind: 'tail' };

export interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  /** Fallback timeline length before peaks finish decoding. */
  durationSeconds: number;
  handles: MarkerHandle[];
  tailVideoTimeSeconds: number;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  /** When true, dragging a marker shifts it and all later markers. */
  dragAll: boolean;
  selected: MarkerRef | 'tail' | null;
  height?: number;
  getCurrentSeconds: () => number;
  onSeek: (seconds: number) => void;
  onSelect: (target: DragTarget) => void;
  onMarkerDrag: (ref: MarkerRef, videoTimeSeconds: number, mode: DragMode) => void;
  onTailDrag: (videoTimeSeconds: number) => void;
  onDragEnd: () => void;
  onScrollByPx: (dx: number) => void;
  onViewportWidth: (w: number) => void;
}

const DEFAULT_HEIGHT = 150;
const LABEL_BAND = 22; // top strip reserved for measure-number chips
const HANDLE_HIT_PX = 9; // pointer must be within this of a handle's x to grab it
const DRAG_THRESHOLD_PX = 4;

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
    playhead: 'hsl(30 85% 55%)',
    tail: v('--muted-foreground', '#9ca3af'),
  };
}

export function WaveformCanvas(props: WaveformCanvasProps) {
  const {
    peaks,
    durationSeconds,
    handles,
    tailVideoTimeSeconds,
    pixelsPerSecond,
    scrollLeftPx,
    dragAll,
    selected,
    height = DEFAULT_HEIGHT,
    getCurrentSeconds,
    onSeek,
    onSelect,
    onMarkerDrag,
    onTailDrag,
    onDragEnd,
    onScrollByPx,
    onViewportWidth,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<ThemeColors | null>(null);
  const widthRef = useRef(0);

  // Latest props mirrored into refs for the RAF + pointer handlers (no stale closures).
  const ppsRef = useRef(pixelsPerSecond);
  const scrollRef = useRef(scrollLeftPx);
  const handlesRef = useRef(handles);
  const tailRef = useRef(tailVideoTimeSeconds);
  const dragAllRef = useRef(dragAll);
  ppsRef.current = pixelsPerSecond;
  scrollRef.current = scrollLeftPx;
  handlesRef.current = handles;
  tailRef.current = tailVideoTimeSeconds;
  dragAllRef.current = dragAll;

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

    // Peaks
    if (peaks && peaks.bucketCount > 0 && durationSeconds > 0) {
      const secPerBucket = peaks.durationSeconds / peaks.bucketCount;
      const firstT = xToVideoTime(0);
      const lastT = xToVideoTime(w);
      let first = Math.max(0, Math.floor(firstT / secPerBucket));
      let last = Math.min(peaks.bucketCount - 1, Math.ceil(lastT / secPerBucket));
      if (last < first) [first, last] = [0, -1];
      const stride = Math.max(1, Math.floor((last - first) / (w * 2)));

      ctx.strokeStyle = theme.wave;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let b = first; b <= last; b += stride) {
        const x = videoTimeToX(b * secPerBucket);
        const { min, max } = bucketMinMax(peaks, b);
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
  }, [peaks, durationSeconds, selected, height, videoTimeToX, xToVideoTime]);

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
  }, [drawWave, handles, tailVideoTimeSeconds, pixelsPerSecond, scrollLeftPx]);

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

    let mode: 'idle' | 'pending-marker' | 'dragging-marker' | 'pending-scrub' | 'scrubbing' = 'idle';
    let target: DragTarget | null = null;
    let startX = 0;
    let pointerId: number | null = null;

    const localX = (e: PointerEvent) => {
      const rect = overlay.getBoundingClientRect();
      return e.clientX - rect.left;
    };

    const hitTest = (x: number): DragTarget | null => {
      let best: { target: DragTarget; dist: number } | null = null;
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

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const x = localX(e);
      startX = x;
      pointerId = e.pointerId;
      try { overlay.setPointerCapture(e.pointerId); } catch { /* noop */ }
      const hit = hitTest(x);
      if (hit) {
        target = hit;
        mode = 'pending-marker';
        onSelect(hit);
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
      if (mode === 'pending-scrub' && moved) mode = 'scrubbing';

      if (mode === 'dragging-marker' && target) {
        const t = xToVideoTime(x);
        if (target.kind === 'tail') onTailDrag(t);
        else onMarkerDrag(target.ref, t, dragAllRef.current ? 'all-after' : 'single');
      } else if (mode === 'scrubbing') {
        onSeek(xToVideoTime(x));
      }
    };

    const onUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      try { overlay.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (mode === 'pending-scrub') {
        // A click on empty space = seek there.
        onSeek(xToVideoTime(localX(e)));
      } else if (mode === 'dragging-marker') {
        onDragEnd();
      }
      mode = 'idle';
      target = null;
      pointerId = null;
    };

    const onWheel = (e: WheelEvent) => {
      // Horizontal scroll (trackpads send deltaX; mice send deltaY).
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (dx !== 0) {
        e.preventDefault();
        onScrollByPx(dx);
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
  }, [onSeek, onSelect, onMarkerDrag, onTailDrag, onDragEnd, onScrollByPx, videoTimeToX, xToVideoTime]);

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none rounded-md border border-border overflow-hidden"
      style={{ height, touchAction: 'none' }}
    >
      <canvas ref={waveRef} className="absolute inset-0" />
      <canvas ref={overlayRef} className="absolute inset-0 cursor-crosshair" />
    </div>
  );
}

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
