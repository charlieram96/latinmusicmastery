'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';

// PlaySense Studio — the app bar's Score ▾ menu (mockup #scoreMenu): add
// measures from a file, replace the score, export. The items are dialog
// triggers, so the panel stays mounted and only hides — unmounting it would
// unmount a dialog the item just opened.
import { ChevronDown, FileUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export function ScoreMenu({
  children,
  /** Exposes the chip's DOM node to the host, so a dialog opened from an item
   *  (this component's own children, or one portalled in from a sibling like
   *  SyncPanel's "Add score") can return focus here on close instead of
   *  Radix's default target — the item itself, which by the time the dialog
   *  closes sits inside this panel's now-`hidden`, unfocusable subtree. See
   *  score-section-editor.tsx / studio-workspace.tsx's `onCloseAutoFocus`. */
  chipRef,
}: {
  children: ReactNode;
  chipRef?: RefObject<HTMLButtonElement | null>;
}) {
  const st = useStudioText();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Closes the menu on a click anywhere inside the panel — including an item
    // portalled in from a React SIBLING (SyncPanel's "Add score" chip portals
    // into a span that's one of `children`): its DOM node ends up inside this
    // panel, but it was never mounted as a React descendant of <ScoreMenu>, so
    // React's synthetic event system (which dispatches by the REACT tree, not
    // the DOM tree) never runs a React onClickCapture handler placed on the
    // panel for it. A native listener sees every real click regardless of
    // which component's createPortal put the target there.
    const root = rootRef.current;
    const onRootClick = (e: MouseEvent) => { if (panelRef.current?.contains(e.target as Node)) setOpen(false); };
    root?.addEventListener('click', onRootClick, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      root?.removeEventListener('click', onRootClick, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={chipRef}
        type="button"
        className="st-chip"
        aria-label={st("Score")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FileUp className="h-4 w-4" />{st("Score")}<ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div ref={panelRef} role="menu" hidden={!open} className="st-mpop right-0 top-[calc(100%+6px)]">
        {children}
      </div>
    </div>
  );
}
