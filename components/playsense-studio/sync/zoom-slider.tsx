'use client';

// PlaySense Studio — sync panel's drag-to-zoom timeline control.

import { useRef } from 'react';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { clamp, MAX_PPS, MIN_PPS } from '@/components/playsense-studio/sync/zoom-range';

/**
 * Drag-to-zoom timeline control. The knob position is a log mapping of the
 * current pixels-per-second between MIN_PPS and MAX_PPS, so dragging feels even
 * across the whole zoom range. The −/＋ buttons nudge by a fixed factor and the
 * last button fits the whole timeline to the viewport.
 */
export function ZoomSlider({
  pps,
  onZoomTo,
  onZoomBy,
  onFit,
  fitLabel = 'Fit to width',
}: {
  pps: number;
  onZoomTo: (pps: number) => void;
  onZoomBy: (factor: number) => void;
  onFit: () => void;
  /** Accessible name (and tooltip) for the fit button — callers with a more
   *  specific fit target (e.g. "Fit the section") override the default. */
  fitLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = Math.log(MAX_PPS / MIN_PPS);
  const fraction = clamp(Math.log(pps / MIN_PPS) / span, 0, 1);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = clamp((clientX - r.left) / r.width, 0, 1);
    onZoomTo(MIN_PPS * Math.exp(f * span));
  };
  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const onUp = (e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="st-zoom" title="Zoom timeline (drag)">
      <button type="button" className="st-zoom-btn" onClick={() => onZoomBy(1 / 1.5)} aria-label="Zoom out">
        <ZoomOut className="h-[15px] w-[15px]" />
      </button>
      <div
        ref={trackRef}
        className="st-zoom-track"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="slider"
        aria-label="Zoom level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <div className="fill" style={{ width: `${fraction * 100}%` }} />
        <div className="knob" style={{ left: `${fraction * 100}%` }} />
      </div>
      <button type="button" className="st-zoom-btn" onClick={() => onZoomBy(1.5)} aria-label="Zoom in">
        <ZoomIn className="h-[15px] w-[15px]" />
      </button>
      <button type="button" className="st-iconbtn" onClick={onFit} title={fitLabel} aria-label={fitLabel} style={{ marginLeft: 2 }}>
        <Maximize className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
