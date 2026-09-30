'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// A small menu pinned to a point in the strip. Closes on Escape or an outside
// click. Pops in (160 ms) unless the viewer prefers reduced motion.

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface PopoverAnchor { left: number; top: number }

export function MeasurePopover({ anchor, title, hint, onClose, children, className = '', floating = false }: {
  className?: string;
  floating?: boolean;
  anchor: PopoverAnchor; title: string; hint?: string; onClose: () => void; children: ReactNode;
}) {
  const st = useStudioText();
  const ref = useRef<HTMLDivElement | null>(null);
  const position = useRef({ left: 0, top: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const place = (left: number, top: number) => {
    const el = ref.current;
    if (!el) return;
    position.current = {
      left: Math.max(12, Math.min(left, window.innerWidth - el.offsetWidth - 12)),
      top: Math.max(12, Math.min(top, window.innerHeight - el.offsetHeight - 12)),
    };
    el.style.left = `${position.current.left}px`;
    el.style.top = `${position.current.top}px`;
  };
  useEffect(() => {
    const el = ref.current;
    if (!floating || !el) return;
    const initial = el.getBoundingClientRect();
    // The top layer escapes the waveform's clipping while retaining its theme.
    el.style.position = 'fixed';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.margin = '0';
    el.style.maxHeight = 'calc(100dvh - 24px)';
    el.style.overflowY = 'auto';
    const resize = () => place(position.current.left, position.current.top);
    if (typeof el.showPopover === 'function') {
      el.setAttribute('popover', 'manual');
      el.showPopover();
    }
    place(initial.left, initial.top);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) el.hidePopover();
    };
  }, [floating, anchor.left, anchor.top]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [onClose]);
  return (
    <div ref={ref} data-score-preserve-selection role="dialog" aria-label={st(title)} className={`st-mpop ${className}`} style={{ left: anchor.left, top: anchor.top }}>
      <div className="st-mpop-title"
        style={floating ? { cursor: 'grab', touchAction: 'none', userSelect: 'none' } : undefined}
        onPointerDown={e => {
          if (!floating || e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, ...position.current };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = 'grabbing';
        }}
        onPointerMove={e => {
          const current = drag.current;
          if (!current || current.pointerId !== e.pointerId) return;
          e.stopPropagation();
          place(current.left + e.clientX - current.x, current.top + e.clientY - current.y);
        }}
        onPointerUp={e => {
          if (drag.current?.pointerId !== e.pointerId) return;
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          e.currentTarget.style.cursor = 'grab';
        }}
        onLostPointerCapture={e => {
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
        }}
      >
        <span>{st(title)}</span>
        <button type="button" className="st-mpop-close" aria-label={st('Close')} title={st('Close')}
          onMouseDown={e => e.preventDefault()}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClose(); }}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {children}
      {hint && <p className="st-mpop-hint">{st(hint)}</p>}
    </div>
  );
}
