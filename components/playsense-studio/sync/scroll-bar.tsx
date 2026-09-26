'use client';

// PlaySense Studio — sync panel's custom horizontal scrollbar.

import { useRef } from 'react';

// A thin custom horizontal scrollbar over the canvas coordinate space. The
// thumb is draggable (pointer capture); clicking the track jumps there and the
// same gesture keeps dragging. Geometry is fraction-based off the track's own
// rect, so it stays accurate regardless of the bar's rendered width.
export function ScrollBar({
  scrollLeft,
  maxScroll,
  viewportWidth,
  contentWidth,
  onScroll,
}: {
  scrollLeft: number;
  maxScroll: number;
  viewportWidth: number;
  contentWidth: number;
  onScroll: (v: number) => void;
}) {
  const dragRef = useRef<{ pointerId: number; grabOffsetPx: number } | null>(null);
  if (maxScroll <= 0 || contentWidth <= 0) return null;

  const thumbFrac = Math.max(0.02, Math.min(1, viewportWidth / contentWidth));
  const leftFrac = (scrollLeft / maxScroll) * (1 - thumbFrac);

  const thumbPx = (rect: DOMRect) => Math.max(24, thumbFrac * rect.width);
  const scrollFromThumbLeft = (rect: DOMRect, thumbLeftPx: number) => {
    const range = Math.max(1, rect.width - thumbPx(rect));
    const frac = Math.max(0, Math.min(1, thumbLeftPx / range));
    onScroll(frac * maxScroll);
  };

  return (
    <div
      className="relative h-2.5 w-full cursor-pointer rounded-full bg-muted"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const tw = thumbPx(rect);
        const thumbLeft = leftFrac * rect.width;
        const x = e.clientX - rect.left;
        // Grab the thumb where pressed; off the thumb, center it under the cursor.
        const grabOffsetPx = x >= thumbLeft && x <= thumbLeft + tw ? x - thumbLeft : tw / 2;
        dragRef.current = { pointerId: e.pointerId, grabOffsetPx };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        scrollFromThumbLeft(rect, x - grabOffsetPx);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        scrollFromThumbLeft(rect, e.clientX - rect.left - drag.grabOffsetPx);
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.pointerId !== e.pointerId) return;
        dragRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <div
        className="absolute top-0 h-2.5 rounded-full bg-foreground/40 transition-colors hover:bg-foreground/60"
        style={{ width: `${thumbFrac * 100}%`, minWidth: 24, left: `${leftFrac * 100}%` }}
      />
    </div>
  );
}
