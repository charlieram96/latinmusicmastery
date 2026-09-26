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
//
// Fix round 1: because it portals out from under `.st-stage`, it also loses
// that ancestor's dark-token overrides, so `.st-stroke-list` hardcodes its
// own ink (like `.st-fbar`/`.st-toast` already do) instead of trusting the
// cascade. `role="listbox"` also makes it a typing target (typing-target.ts),
// the same way `role="dialog"` already does for MeasurePopover, so the zoom's
// own shortcuts (arrows, letters, etc.) leave focus inside the list alone.
import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LIST_WIDTH = 220;
const LIST_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

export function StrokeMenu({ strokes, current, onPick }: {
  strokes: { midi: number; label: string }[]; current: number | null; onPick: (midi: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, maxHeight: LIST_MAX_HEIGHT });
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

  // Fix round 1: focus the current stroke (or the first one) as soon as the
  // list mounts, so keyboard users land in it instead of on nothing.
  useLayoutEffect(() => {
    if (!open) return;
    const idx = Math.max(0, strokes.findIndex((s) => s.midi === current));
    const opts = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    opts?.[idx]?.focus();
    // Only on open: re-focusing every time `strokes`/`current` tick (e.g. the
    // score model refreshing) would yank focus back while the list is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const label = strokes.find((s) => s.midi === current)?.label ?? 'Stroke';

  const toggle = () => {
    if (!open) {
      // Read at the click, not in render (same rule the More ▾ popover's
      // anchor follows): the chip's on-screen position when it's pressed.
      const r = chipRef.current?.getBoundingClientRect();
      if (r) {
        // Fix round 1: clamp inside the viewport instead of trusting the
        // chip's position — the toolbar can dock anywhere along a wide,
        // narrow-window header, and a docked toolbar near the top leaves
        // less than the list's full height below it.
        const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left, window.innerWidth - LIST_WIDTH - VIEWPORT_MARGIN));
        const top = r.bottom + 6;
        const spaceBelow = window.innerHeight - VIEWPORT_MARGIN - top;
        const maxHeight = Math.max(0, Math.min(LIST_MAX_HEIGHT, spaceBelow));
        setPos({ left, top, maxHeight });
      }
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
          style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight }}
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
