'use client';

// Bar-level keys in the strip: ←/→ move the selection (⇧ extends), ⏎ opens,
// ⌘C/⌘V/⌘D copy, paste after and duplicate, ⌫ deletes, Esc clears. Off while a
// note is selected (note keys own the arrows then) and while typing anywhere.

import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { selectionBounds, stepSelection, type MeasureSelection } from '@/lib/playsense-studio/measure-selection';

export function useMeasureKeys(opts: {
  enabled: boolean; count: number; selection: MeasureSelection | null;
  onSelection: (sel: MeasureSelection | null) => void; onOpen: (index: number) => void;
  onCopy: () => void; onPaste: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const o = ref.current;
      if (!o.enabled || e.altKey || isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const bounds = selectionBounds(o.selection);
      if (!mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        o.onSelection(stepSelection(o.selection, e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey, o.count));
        return;
      }
      if (e.key === 'Escape' && o.selection) { e.preventDefault(); o.onSelection(null); return; }
      if (!bounds) return;
      if (!mod && e.key === 'Enter') { e.preventDefault(); o.onOpen(bounds[0]); return; }
      if (!mod && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); o.onDelete(); return; }
      if (mod && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'c') { e.preventDefault(); o.onCopy(); }
        else if (k === 'v') { e.preventDefault(); o.onPaste(); }
        else if (k === 'd') { e.preventDefault(); o.onDuplicate(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
