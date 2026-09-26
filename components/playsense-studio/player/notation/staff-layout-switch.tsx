'use client';

import { useCallback, useEffect, useState } from 'react';
import { GalleryHorizontal, LocateFixed, Rows3 } from 'lucide-react';
import { useTranslation } from '@/components/language-provider';
import { parseStaffLayout, STAFF_LAYOUT_KEY, type StaffLayoutChoice } from '@/lib/playsense-studio/notation/staff-n1';
import type { StaffLayoutMode } from './renderers/staff-renderer';

/** The student's Stacked / Horizontal choice, shared by every lesson staff and kept in localStorage. */
export function useStaffLayoutPreference(): [StaffLayoutChoice, (next: StaffLayoutChoice) => void] {
  const [layout, setLayout] = useState<StaffLayoutChoice>('stacked');
  useEffect(() => {
    try {
      const saved = parseStaffLayout(localStorage.getItem(STAFF_LAYOUT_KEY));
      // Read after mount so the server render and the first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLayout(saved);
    } catch { /* Storage may be unavailable; stacked is the default. */ }
  }, []);
  const change = useCallback((next: StaffLayoutChoice) => {
    setLayout(next);
    try { localStorage.setItem(STAFF_LAYOUT_KEY, next); } catch { /* The choice still holds for this session. */ }
  }, []);
  return [layout, change];
}

/** Renderer layout for a choice: stacked rows, or one row at a time with a slide turn. */
export function staffLayoutMode(choice: StaffLayoutChoice): Extract<StaffLayoutMode, 'wrapped' | 'paged'> {
  return choice === 'horizontal' ? 'paged' : 'wrapped';
}

const OPTIONS = [
  { value: 'stacked', icon: Rows3 },
  { value: 'horizontal', icon: GalleryHorizontal },
] as const;

export function StaffLayoutSwitch({ value, onChange, className = '' }: {
  value: StaffLayoutChoice;
  onChange: (next: StaffLayoutChoice) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('staff.layout.label')}
      className={`ps-staff-layout-switch inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary p-0.5 ${className}`}>
      {OPTIONS.map(({ value: option, icon: Icon }) => {
        const label = t(`staff.layout.${option}`);
        const pressed = value === option;
        return (
          <button key={option} type="button" aria-pressed={pressed} title={label} onClick={() => onChange(option)}
            className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold transition-colors duration-tap ease-smooth ${
              pressed ? 'bg-primary/[0.16] text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="ps-staff-layout-label max-[700px]:sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A paged staff turns to the browsed position and has no scrub bar, so once the view stops
 * following playback (say, after scrubbing the single line) it needs its own way back. Stacked
 * rows follow playback themselves, and the scroll line has the scrub bar's Follow.
 */
export function staffNeedsRefollow(mode: StaffLayoutMode, following: boolean): boolean {
  return mode === 'paged' && !following;
}

/**
 * The watch player's notation pane. Stacked rows scroll inside the renderer, so the pane hands
 * them every pixel without a second scroller; a paged row centres in a tall pane but scrolls in a
 * short one; both non-stacked panes keep bottom room for the floating zoom control.
 */
export function staffPaneClass(mode: StaffLayoutMode): string {
  if (mode === 'wrapped') return 'flex h-full flex-col gap-2 overflow-hidden p-3';
  if (mode === 'paged') return 'flex h-full flex-col gap-2 overflow-y-auto p-3 pb-16';
  return 'h-full space-y-2 overflow-auto p-3 pb-16';
}

export function StaffRefollowButton({ onFollow, className = '' }: { onFollow: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onFollow} aria-label={t('staff.followAria')} title={t('staff.followOffTitle')}
      className={`inline-flex h-[28px] flex-shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary transition-colors duration-tap ease-smooth hover:bg-primary/[0.16] ${className}`}>
      <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t('staff.follow')}</span>
    </button>
  );
}
