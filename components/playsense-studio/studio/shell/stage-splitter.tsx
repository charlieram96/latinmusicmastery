'use client';

// PlaySense Studio — the splitter between the waveform and the measure strip.
// Drag to trade height between them; double-click resets.

import { useRef } from 'react';

export const WAVE_MIN = 110;
export const WAVE_MAX = 360;
export const WAVE_DEFAULT = 180;

export function clampWaveHeight(h: number): number {
  return Math.max(WAVE_MIN, Math.min(WAVE_MAX, Math.round(h)));
}

export function StageSplitter({ height, onChange }: { height: number; onChange: (h: number) => void }) {
  const drag = useRef<{ y: number; h: number } | null>(null);
  return (
    <div
      className="st-splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-valuemin={WAVE_MIN}
      aria-valuemax={WAVE_MAX}
      aria-valuenow={height}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, h: height };
      }}
      onPointerMove={(e) => {
        if (drag.current) onChange(clampWaveHeight(drag.current.h + e.clientY - drag.current.y));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }}
      onDoubleClick={() => onChange(WAVE_DEFAULT)}
    >
      <span className="st-splitter-grip" />
    </div>
  );
}
