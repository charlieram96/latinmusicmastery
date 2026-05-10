'use client';

// Compás view switcher — segmented control over the renderers available
// for the active track. Choice is persisted to localStorage keyed by the
// track's instrument so cycling between lessons remembers your preference
// per instrument type.

import { useEffect, useState } from 'react';
import type { DefaultView, Instrument } from '@/components/compas/shared/score-model/types';

const STORAGE_PREFIX = 'compas:view:';

const VIEW_LABELS: Record<DefaultView, string> = {
  staff: 'Staff',
  tab: 'Tab',
  fretboard: 'Fretboard',
  'rhythm-grid': 'Rhythm',
  pdf: 'PDF',
};

const FRETTED: Instrument[] = [
  'guitar',
  'bass',
  'tres',
  'cuatro',
  'tiple',
  'ukulele',
  'mandolin',
];
const HAND_PERCUSSION: Instrument[] = [
  'perc-conga',
  'perc-bongo',
  'perc-timbal',
  'perc-clave',
];

/**
 * Returns the views that make sense for a given instrument. Order is the
 * order they appear in the segmented control; the first entry is the
 * recommended default if the score doesn't specify one.
 */
export function viewsForInstrument(instrument: Instrument): DefaultView[] {
  if (FRETTED.includes(instrument)) return ['staff', 'tab', 'fretboard'];
  if (HAND_PERCUSSION.includes(instrument)) return ['rhythm-grid', 'staff'];
  if (instrument === 'perc-kit') return ['staff', 'rhythm-grid'];
  if (instrument === 'piano' || instrument === 'staff') return ['staff'];
  return ['staff'];
}

interface ViewSwitcherProps {
  instrument: Instrument;
  defaultView: DefaultView;
  value: DefaultView;
  onChange: (view: DefaultView) => void;
  className?: string;
}

export function ViewSwitcher({
  instrument,
  value,
  onChange,
  className,
}: ViewSwitcherProps) {
  const options = viewsForInstrument(instrument);

  if (options.length <= 1) return null;

  return (
    <div className={`inline-flex rounded-md border border-border bg-card p-0.5 ${className ?? ''}`}>
      {options.map((view) => {
        const active = value === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            className={`px-3 py-1 text-sm rounded transition ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {VIEW_LABELS[view]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hook that wraps a per-instrument persisted view selection.
 *
 *   const [view, setView] = usePersistedView(instrument, defaultView);
 *
 * Initial render returns the defaultView (the same value SSR would produce);
 * on mount we hydrate from localStorage if a value exists. This avoids
 * hydration mismatches.
 */
export function usePersistedView(
  instrument: Instrument,
  defaultView: DefaultView
): [DefaultView, (next: DefaultView) => void] {
  const [view, setViewState] = useState<DefaultView>(defaultView);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_PREFIX + instrument);
    if (stored && isValidView(stored)) {
      const allowed = viewsForInstrument(instrument);
      if (allowed.includes(stored as DefaultView)) {
        setViewState(stored as DefaultView);
      }
    }
  }, [instrument]);

  // Reset to the new default when instrument changes.
  useEffect(() => {
    setViewState(defaultView);
  }, [defaultView]);

  const setView = (next: DefaultView) => {
    setViewState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_PREFIX + instrument, next);
    }
  };

  return [view, setView];
}

function isValidView(s: string): s is DefaultView {
  return ['staff', 'tab', 'fretboard', 'rhythm-grid', 'pdf'].includes(s);
}
