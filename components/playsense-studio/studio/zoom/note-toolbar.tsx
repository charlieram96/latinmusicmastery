'use client';

// PlaySense Studio — the floating note toolbar over the measure zoom's center
// column (spec §6; v6's renderNoteBar): info chip, durations, dot/rest/tie,
// accidentals (or percussion strokes), triplet, "More" (Task 9's popover) and
// delete. Shares the selected-bars toolbar's `.st-fbar` shell and pop-in.
//
// Buttons take focus out of the loop with onMouseDown's preventDefault, so the
// zoom's own keydown listener (registered on window) keeps working while a
// button is clicked.

import type { Ref } from 'react';
import { Trash2 } from 'lucide-react';
import { KEY_VALUE, VALUE_NAME, VALUE_QN, type NoteValue } from '@/lib/playsense-studio/rhythm';
import type { PopoverAnchor } from '../measure/popover';
import type { ZoomEditing } from './use-zoom-editing';
import { NoteIcon, RestIcon } from './note-glyphs';

export interface NoteToolbarPercussion {
  strokes: { midi: number; label: string }[];
  current: number | null;
}

export interface NoteToolbarProps {
  /** So the caller can measure the toolbar's real `offsetWidth`/`offsetHeight`
   *  (a percussion track's stroke buttons can run wide or wrap tall) and
   *  clamp `left`/`top` against them, the way the measure bar measures itself
   *  against the viewport. */
  ref?: Ref<HTMLDivElement>;
  /** Zoom-center px; the toolbar centres itself on `left` with translateX(-50%). */
  left: number;
  top: number;
  /** Keeps the toolbar inside the center column: long percussion stroke rows
   *  wrap onto further lines instead of overflowing it. */
  maxWidth?: number;
  /** A note's name, a chord's names joined by spaces, 'rest', or 'add' at 'end'. */
  info: string;
  value: NoteValue;
  dots: 0 | 1 | 2;
  isRest: boolean;
  tie: boolean;
  tripletOn: boolean;
  hasSelection: boolean;
  /** Set on a percussion track: replaces ♭♮♯ with one button per stroke. */
  percussion: NoteToolbarPercussion | null;
  editing: ZoomEditing;
  /** Task 9 builds the popover; for now this just records where it would open. */
  onMore: (anchor: PopoverAnchor) => void;
}

const TOOLBAR_DURATIONS: NoteValue[] = ['w', 'h', 'q', '8', '16'];

// KEY_VALUE maps the digit typed to the value it enters ('5' -> quarter); the
// toolbar's titles want the reverse, one key per value.
const VALUE_KEY = Object.fromEntries(
  Object.entries(KEY_VALUE).map(([key, value]) => [value, key]),
) as Record<NoteValue, string>;

const ACCIDENTALS: Array<{ alter: -1 | 0 | 1; label: string; title: string }> = [
  { alter: -1, label: '♭', title: 'Flat' },
  { alter: 0, label: '♮', title: 'Natural' },
  { alter: 1, label: '♯', title: 'Sharp' },
];

/** Before the toolbar's first paint, there's nothing to measure yet — a
 *  percussion track's stroke row is usually wider than a pitched one, so a
 *  wide guess errs toward not overflowing on that very first frame. */
export const NOTE_TOOLBAR_WIDTH_FALLBACK = 520;

/**
 * Clamp a toolbar anchored at `(x, top)` so it stays inside the zoom's center
 * column/row, using its own measured size — the measure bar's clamp
 * (`Math.max(half, Math.min(bound - half, x))`), applied on both axes. A
 * `size.w`/`size.h` of 0 (nothing measured yet, e.g. the toolbar's first
 * frame) leaves that axis unclamped, since there's nothing yet to clamp with;
 * `centerW`/`bodyH` of 0 (the zoom itself unmeasured) does the same.
 */
export function clampNoteToolbarPosition(
  x: number,
  top: number,
  size: { w: number; h: number },
  bounds: { centerW: number; bodyH: number },
): { left: number; top: number } {
  const halfW = size.w / 2 + 8;
  const left = bounds.centerW > 0 && size.w > 0
    ? Math.max(halfW, Math.min(bounds.centerW - halfW, x))
    : x;
  const clampedTop = bounds.bodyH > 0 && size.h > 0
    ? Math.max(0, Math.min(bounds.bodyH - size.h, top))
    : top;
  return { left, top: clampedTop };
}

export function NoteToolbar({
  ref, left, top, maxWidth, info, value, dots, isRest, tie, tripletOn, hasSelection, percussion, editing, onMore,
}: NoteToolbarProps) {
  return (
    <div
      ref={ref}
      className="st-fbar"
      role="toolbar"
      aria-label="Note"
      data-testid="note-toolbar"
      style={{
        left, top, gridColumn: 2, gridRow: 2,
        ...(maxWidth !== undefined ? { maxWidth, flexWrap: 'wrap' } : {}),
      }}
    >
      <span className="st-fbar-info">{info}</span>

      {TOOLBAR_DURATIONS.map((v) => (
        <button
          key={v}
          type="button"
          aria-label={VALUE_NAME[v]}
          title={`${VALUE_NAME[v]} (${VALUE_KEY[v]})`}
          aria-pressed={value === v}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editing.setValue(v)}
        >
          <NoteIcon durationQN={VALUE_QN[v]} />
        </button>
      ))}

      <button
        type="button"
        aria-label="Dot"
        title="Dot (.)"
        aria-pressed={dots > 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.cycleDots()}
      >
        •
      </button>

      <button
        type="button"
        aria-label="Rest"
        title="Rest (R)"
        aria-pressed={isRest}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.enterRest()}
      >
        <RestIcon /> Rest
      </button>

      <button
        type="button"
        aria-label="Tie"
        title="Tie (+)"
        aria-pressed={tie}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.toggleTie()}
      >
        ⌣
      </button>

      <span className="st-fbar-sep" aria-hidden />

      {percussion
        ? percussion.strokes.map((s) => (
            <button
              key={s.midi}
              type="button"
              aria-label={s.label}
              title={s.label}
              aria-pressed={percussion.current === s.midi}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editing.enterStroke(s.midi)}
            >
              {s.label}
            </button>
          ))
        : ACCIDENTALS.map((a) => (
            <button
              key={a.alter}
              type="button"
              aria-label={a.title}
              title={a.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editing.accidental(a.alter)}
            >
              {a.label}
            </button>
          ))}

      <span className="st-fbar-sep" aria-hidden />

      <button
        type="button"
        aria-label="Triplet"
        title="Triplet (T)"
        aria-pressed={tripletOn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.tuplet(3, 2)}
      >
        <i>3</i>
      </button>

      <button
        type="button"
        aria-label="More"
        title="Everything else"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onMore({ left, top: top + 36 })}
      >
        More ▾
      </button>

      {hasSelection && (
        <button
          type="button"
          aria-label="Delete"
          title="Delete (⌫)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editing.remove(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
