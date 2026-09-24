'use client';

// PlaySense Studio — hover rail. A 52 px icon strip that opens to 340 px over
// the stage the moment the pointer arrives and closes 180 ms after it leaves
// (the stage never moves). Section bodies stay mounted while collapsed so the
// portal slots inside them (inspector, score meta, monitor) keep working.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RailBadge = 'ok' | 'warn' | 'bad';

export interface RailSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: RailBadge | null;
  content: ReactNode;
}

export const RAIL_CLOSE_DELAY_MS = 180;

export function HoverRail({ sections }: { sections: RailSection[] }) {
  const [open, setOpen] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);

  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      // Typing in a rail field keeps it open after the pointer leaves.
      const active = document.activeElement;
      if (active && railRef.current?.contains(active) && !(active instanceof HTMLButtonElement)) return;
      setOpen(false);
    }, RAIL_CLOSE_DELAY_MS);
  };
  const goTo = (id: string) => {
    openNow();
    document.getElementById(`st-rail-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside
      ref={railRef}
      className={cn('st-hrail', open && 'is-open')}
      aria-label="Studio panels"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={(e) => {
        if (!railRef.current?.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <nav className="st-hrail-icons">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" className="st-hrail-icon" title={s.label} aria-label={s.label} onClick={() => goTo(s.id)}>
              <Icon className="h-[18px] w-[18px]" />
              {s.badge && <span className={cn('st-hrail-dot', `is-${s.badge}`)} aria-hidden />}
            </button>
          );
        })}
      </nav>
      <div className="st-hrail-body">
        {sections.map((s) => (
          <section key={s.id} id={`st-rail-${s.id}`} className="st-hrail-sec">
            <span className="st-sec-label">{s.label}</span>
            <div className="mt-3">{s.content}</div>
          </section>
        ))}
      </div>
    </aside>
  );
}
