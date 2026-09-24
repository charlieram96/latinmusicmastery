'use client';

// A small menu pinned to a point in the strip. Closes on Escape or an outside
// click. Pops in (160 ms) unless the viewer prefers reduced motion.

import { useEffect, useRef, type ReactNode } from 'react';

export interface PopoverAnchor { left: number; top: number }

export function MeasurePopover({ anchor, title, hint, onClose, children }: {
  anchor: PopoverAnchor; title: string; hint?: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-label={title} className="st-mpop" style={{ left: anchor.left, top: anchor.top }}>
      <div className="st-mpop-title">{title}</div>
      {children}
      {hint && <p className="st-mpop-hint">{hint}</p>}
    </div>
  );
}
