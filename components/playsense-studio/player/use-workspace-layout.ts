'use client';

// State for the lesson workspace (video · staff · highway), kept apart from
// the workspace shell so the layout switcher can live anywhere on the page
// (the lesson action bar, a pane header) while the regions stay put.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WORKSPACE_LAYOUTS,
  effectiveLayout,
  parseWorkspaceState,
  serializeWorkspaceState,
  swapWorkspace,
  workspaceStorageKey,
  type WorkspaceLayout,
  type WorkspaceState,
} from '@/lib/playsense-studio/workspace-layout';

/** Phones: side-by-side becomes stacked and the switcher hides "side". */
export const PHONE_QUERY = '(max-width: 767px)';

export interface WorkspaceController {
  kind: string;
  /** The stored choice. */
  state: WorkspaceState;
  /** What renders: the stored layout, with side shown as stack on phones. */
  layout: WorkspaceLayout;
  narrow: boolean;
  /** Layouts this view offers. */
  layouts: readonly WorkspaceLayout[];
  defaults: WorkspaceState;
  /** Change the layout (animated by the workspace). */
  setLayout: (layout: WorkspaceLayout) => void;
  /** Reverse the regions (animated); in PiP, mirror the corner. */
  swap: () => void;
  /** Commit a geometry change (drags, keys, resets); not animated. */
  update: (patch: Partial<WorkspaceState>) => void;
  /** Set by <SplitWorkspace>: measures the regions right before a layout change. */
  beforeLayoutChange: { current: (() => void) | null };
}

export function useWorkspaceLayout(
  kind: string,
  defaults: WorkspaceState,
  { layouts = WORKSPACE_LAYOUTS }: { layouts?: readonly WorkspaceLayout[] } = {},
): WorkspaceController {
  const [state, setState] = useState<WorkspaceState>(defaults);
  const [narrow, setNarrow] = useState(false);
  const beforeLayoutChange = useRef<(() => void) | null>(null);
  const kindRef = useRef(kind);
  const configRef = useRef({ defaults, layouts });
  useEffect(() => {
    kindRef.current = kind;
    configRef.current = { defaults, layouts };
  });

  // Hydrate after mount so the server render and the first client render agree.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(workspaceStorageKey(kind)); } catch { /* storage blocked */ }
    setState(parseWorkspaceState(raw, configRef.current.defaults, configRef.current.layouts));
  }, [kind]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  const commit = useCallback((next: (s: WorkspaceState) => WorkspaceState) => {
    setState((prev) => {
      const value = next(prev);
      try { localStorage.setItem(workspaceStorageKey(kindRef.current), serializeWorkspaceState(value)); } catch { /* session only */ }
      return value;
    });
  }, []);

  const setLayout = useCallback((layout: WorkspaceLayout) => {
    if (!configRef.current.layouts.includes(layout)) return;
    beforeLayoutChange.current?.();
    commit((s) => ({ ...s, layout }));
  }, [commit]);

  const swap = useCallback(() => {
    beforeLayoutChange.current?.();
    commit(swapWorkspace);
  }, [commit]);

  const update = useCallback((patch: Partial<WorkspaceState>) => commit((s) => ({ ...s, ...patch })), [commit]);

  return useMemo(() => ({
    kind, state, layout: effectiveLayout(state.layout, narrow), narrow, layouts, defaults,
    setLayout, swap, update, beforeLayoutChange,
  }), [kind, state, narrow, layouts, defaults, setLayout, swap, update]);
}
