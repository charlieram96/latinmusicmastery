'use client';

// PlaySense Studio — the drum track's stroke picker in the note toolbar: one
// chip naming the current stroke, opening a list. Replaces a button per
// stroke (up to 14), which wrapped the docked toolbar into a grid over the
// notes.
//
// The list portals to document.body instead of rendering as the chip's own
// child. The docked toolbar sits inside `.st-zoom-overlay`, which clips its
// contents (`overflow: hidden`, used for the zoom's rounded-corner "dimmed
// slivers"), and the toolbar itself (`.st-fbar`) carries a `backdrop-filter`,
// which would make it — not the viewport — the containing block for a
// `position: fixed` child, leaving it just as clipped. A portal sidesteps
// both: the list becomes a document.body child, positioned from the chip's
// real screen coordinates, so nothing about the zoom can clip it.
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function StrokeMenu({ strokes, current, onPick }: {
  strokes: { midi: number; label: string }[]; current: number | null; onPick: (midi: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const chipRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Capture phase + stopPropagation: the zoom's own Escape handling
    // (use-zoom-editing.ts) listens on window with no capture flag, i.e. the
    // bubble phase, so intercepting and stopping it here in capture keeps the
    // zoom open and closes only this list.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (chipRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [open]);

  const label = strokes.find((s) => s.midi === current)?.label ?? 'Stroke';

  const toggle = () => {
    if (!open) {
      // Read at the click, not in render (same rule the More ▾ popover's
      // anchor follows): the chip's on-screen position when it's pressed.
      const r = chipRef.current?.getBoundingClientRect();
      if (r) setPos({ left: r.left, top: r.bottom + 6 });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Which stroke new notes use"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          role="listbox"
          aria-label="Strokes"
          className="st-stroke-list"
          style={{ left: pos.left, top: pos.top }}
        >
          {strokes.map((s) => (
            <button
              key={s.midi}
              type="button"
              role="option"
              aria-selected={s.midi === current}
              className={s.midi === current ? 'is-on' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(s.midi); setOpen(false); }}
            >
              {s.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
