'use client';

// Resizable two-pane workspace shell.
//
// Extracted from PlaysenseStudioPlayer's split layout so the same drag-knob +
// orientation chrome can wrap any pair of panes — the with-score player
// (video | notation) and the no-score video lesson (video | "about" panel).
//
// The shell owns only the geometry (split %, workspace height, row/column
// orientation) and the diagonal corner knob; pane *contents* are supplied by
// the consumer. The knob rebalances the split on its primary axis and adjusts
// the overall height on the other axis (double-click resets).

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Columns2, Rows2 } from 'lucide-react';

const SPLIT_MIN = 28;
const SPLIT_MAX = 72;
const H_MIN = 360;
const hMax = () =>
  Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.92);

export interface SplitWorkspaceSecondaryHeaderCtx {
  orient: 'row' | 'column';
  setOrient: (v: 'row' | 'column') => void;
  isRow: boolean;
}

export interface SplitWorkspaceProps {
  /** Fills the primary (video) pane edge-to-edge. */
  primary: ReactNode;
  /** Fills the secondary pane body (below its header). */
  secondary: ReactNode;
  /** Renders the secondary pane's header bar; receives orientation controls. */
  secondaryHeader: (ctx: SplitWorkspaceSecondaryHeaderCtx) => ReactNode;
  /** % of the workspace given to the primary pane (default 55). */
  initialSplit?: number;
  /** Workspace height in px (default 560). */
  initialHeight?: number;
}

export function SplitWorkspace({
  primary,
  secondary,
  secondaryHeader,
  initialSplit = 55,
  initialHeight = 560,
}: SplitWorkspaceProps) {
  const [orient, setOrient] = useState<'row' | 'column'>('row');
  const [split, setSplit] = useState(initialSplit); // % given to the primary pane
  const [workspaceH, setWorkspaceH] = useState(initialHeight);
  const [knobDragging, setKnobDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const isRow = orient === 'row';

  const resetSize = useCallback(() => {
    setSplit(isRow ? 55 : 60);
    setWorkspaceH(560);
  }, [isRow]);

  // Delta-based 2-axis drag: primary axis rebalances the split, the other axis
  // changes the overall workspace height.
  const startKnob = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = 'touches' in e ? e.touches[0] : e;
      const sx = point.clientX;
      const sy = point.clientY;
      const start = { sx, sy, split, h: workspaceH, w: rect.width, ht: rect.height };
      setKnobDragging(true);
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const p = 'touches' in ev ? ev.touches[0] : ev;
        const dx = p.clientX - start.sx;
        const dy = p.clientY - start.sy;
        if (isRow) {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dx / start.w) * 100))
          );
          setWorkspaceH(Math.max(H_MIN, Math.min(hMax(), start.h + dy)));
        } else {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dy / start.ht) * 100))
          );
          setWorkspaceH(Math.max(H_MIN, Math.min(hMax(), start.h + dx)));
        }
      };
      const onUp = () => {
        setKnobDragging(false);
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    },
    [isRow, split, workspaceH]
  );

  return (
    <div
      ref={workspaceRef}
      className="relative overflow-visible rounded-xl border border-border bg-card"
      style={{ height: workspaceH }}
    >
      <div
        className="flex h-full items-stretch"
        style={{ flexDirection: isRow ? 'row' : 'column' }}
      >
        {/* Primary pane */}
        <div
          className="flex min-h-0 min-w-0 flex-col bg-black"
          style={{ flex: `${split} 1 0` }}
        >
          {primary}
        </div>

        {/* Secondary pane */}
        <div
          className="flex min-h-0 min-w-0 flex-col bg-card"
          style={{
            flex: `${100 - split} 1 0`,
            borderLeft: isRow ? '1px solid hsl(var(--border))' : 'none',
            borderTop: isRow ? 'none' : '1px solid hsl(var(--border))',
          }}
        >
          {secondaryHeader({ orient, setOrient, isRow })}
          {secondary}
        </div>
      </div>

      {/* Single diagonal corner knob — resizes split + height together. */}
      <button
        type="button"
        onMouseDown={startKnob}
        onTouchStart={startKnob}
        onDoubleClick={resetSize}
        aria-label="Resize"
        title="Drag to adjust the split and height · double-click to reset"
        className={[
          'absolute z-[12] grid h-[30px] w-[30px] place-items-center rounded-full border bg-secondary text-muted-foreground shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-colors hover:border-primary hover:bg-primary hover:text-white',
          isRow ? 'cursor-[nwse-resize]' : 'cursor-[ns-resize]',
          knobDragging ? 'border-primary bg-primary text-white' : 'border-border',
        ].join(' ')}
        style={
          isRow
            ? { left: `${split}%`, bottom: -15, transform: 'translateX(-50%)' }
            : { top: `${split}%`, right: -15, transform: 'translateY(-50%)' }
        }
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: isRow ? 'rotate(45deg)' : 'rotate(90deg)' }}
        >
          <polyline points="7 5 2 12 7 19" />
          <polyline points="17 5 22 12 17 19" />
        </svg>
      </button>
    </div>
  );
}

// Icon-only orientation toggle: side-by-side ↔ stacked. Shared by both the
// PlaySense player header and the no-score video panel header.
export function OrientationToggle({
  value,
  onChange,
}: {
  value: 'row' | 'column';
  onChange: (v: 'row' | 'column') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange('row')}
        title="Side by side"
        aria-label="Side by side"
        className={`grid h-[30px] w-8 place-items-center rounded-full transition-colors ${
          value === 'row'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Columns2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('column')}
        title="Stacked"
        aria-label="Stacked"
        className={`grid h-[30px] w-8 place-items-center rounded-full transition-colors ${
          value === 'column'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Rows2 className="h-4 w-4" />
      </button>
    </div>
  );
}
