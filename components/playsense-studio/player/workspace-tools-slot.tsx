'use client';

// Lets a page host the workspace's tools (the layout switcher) somewhere other
// than the pane that owns the workspace — the lesson action bar. Without a
// slot on the page the tools render where they are declared.

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SlotContext = createContext<{ host: HTMLElement | null } | null>(null);

export function WorkspaceToolsSlotProvider({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  return <SlotContext.Provider value={{ host }}>{children}</SlotContext.Provider>;
}

export function WorkspaceToolsPortal({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  if (!slot) return <>{children}</>;
  // The slot mounts with the page; until then render nothing rather than a flash in the pane.
  return slot.host ? createPortal(children, slot.host) : null;
}
