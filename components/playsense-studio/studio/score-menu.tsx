'use client';
// PlaySense Studio — the app bar's Score ▾ menu (mockup #scoreMenu): add
// measures from a file, replace the score, export. The items are dialog
// triggers, so the panel stays mounted and only hides — unmounting it would
// unmount a dialog the item just opened.
import { ChevronDown, FileUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="st-chip" aria-label="Score" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <FileUp className="h-4 w-4" />Score<ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div role="menu" hidden={!open} className="st-mpop right-0 top-[calc(100%+6px)]" onClickCapture={() => setOpen(false)}>
        {children}
      </div>
    </div>
  );
}
