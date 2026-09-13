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
// the overall height on the other axis (double-click resets). In the
// full-bleed lesson frame the height is capped at the space above the lesson
// footer, and when the panes are stacked the knob only moves the split — the
// workspace never grows past the viewport it was fitted to.

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import { lessonExerciseHeight } from '@/lib/playsense-studio/lesson-viewport';

const SPLIT_MIN = 28;
const SPLIT_MAX = 72;
// Stacked, a letterboxed 16:9 video needs far less height than the score
// does, so the split favours the secondary pane (side by side uses initialSplit).
const COLUMN_SPLIT = 40;
const H_MIN = 360;
const hMax = () =>
  Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.92);

export interface SplitWorkspaceSecondaryHeaderCtx {
  orient: 'row' | 'column';
  setOrient: (v: 'row' | 'column') => void;
  isRow: boolean;
}

export interface SplitWorkspaceProps {
  visiblePane?: 'both' | 'primary' | 'secondary';
  /** Fills the primary (video) pane edge-to-edge. */
  primary: ReactNode;
  /** Fills the secondary pane body (below its header). */
  secondary: ReactNode;
  /** Renders the secondary pane's header bar; receives orientation controls. */
  secondaryHeader: (ctx: SplitWorkspaceSecondaryHeaderCtx) => ReactNode;
  /** % of the workspace given to the primary pane (default 55). */
  initialSplit?: number;
  /** Workspace height in px (default 560). Ignored when frame='bleed'. */
  initialHeight?: number;
  /**
   * 'card' (default) — rounded, bordered box at a fixed height.
   * 'bleed' — full-bleed: no border/radius, height grows to fill the viewport
   * below the workspace's top edge (still resizable via the knob).
   */
  frame?: 'card' | 'bleed';
}

export function SplitWorkspace({
  primary,
  secondary,
  secondaryHeader,
  initialSplit = 55,
  initialHeight = 560,
  frame = 'card',
  visiblePane = 'both',
}: SplitWorkspaceProps) {
  const bleed = frame === 'bleed';
  const [orient, setOrient] = useState<'row' | 'column'>('row');
  const [split, setSplit] = useState(initialSplit); // % given to the primary pane
  const [workspaceH, setWorkspaceH] = useState(initialHeight);
  const [userSized, setUserSized] = useState(false);
  const [knobDragging, setKnobDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  // Height that fills the space above the lesson footer — the knob's ceiling
  // in the bleed frame, so a drag can never push the workspace under it.
  const fitHRef = useRef(initialHeight);
  const isRow = orient === 'row';

  // A width split has no meaning as a height split, so each orientation
  // starts from its own default.
  const changeOrient = useCallback((v: 'row' | 'column') => {
    setOrient(v);
    setSplit(v === 'row' ? initialSplit : COLUMN_SPLIT);
  }, [initialSplit]);

  // Fit before paint, including the fixed lesson footer and the resize handle.
  // Natural (unscrolled) position prevents page scrolling from enlarging it.
  // Once the user has sized it we stop growing it, but the bleed frame still
  // shrinks with the viewport so it never overlaps the footer.
  useLayoutEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const lesson = el.closest<HTMLElement>('[data-lesson-shell]');
    if (!bleed && !lesson) return;
    const scroller = el.closest<HTMLElement>('[data-dashboard-main]');
    const footer = lesson?.querySelector<HTMLElement>('[data-lesson-footer] > div');
    let pending = 0;
    const fit = () => {
      pending = 0;
      const visibleBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight);
      const bottom = Math.min(visibleBottom, scroller?.getBoundingClientRect().bottom ?? visibleBottom);
      const available = lessonExerciseHeight(bottom, el.getBoundingClientRect().top,
        scroller?.scrollTop ?? window.scrollY, (footer?.getBoundingClientRect().height ?? 0) + 8);
      const fitted = bleed ? available : Math.min(initialHeight, available);
      fitHRef.current = fitted;
      setWorkspaceH((prev) => (!userSized ? fitted : bleed ? Math.min(prev, fitted) : prev));
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    for (const target of [scroller, lesson?.querySelector('[data-lesson-heading]'), el.parentElement, footer]) {
      if (target) observer.observe(target);
    }
    fit();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [bleed, userSized, initialHeight]);

  const resetSize = useCallback(() => {
    setSplit(isRow ? initialSplit : COLUMN_SPLIT);
    setUserSized(false);
    if (!bleed) setWorkspaceH(initialHeight);
  }, [isRow, bleed, initialSplit, initialHeight]);

  // Delta-based 2-axis drag: primary axis rebalances the split, the other axis
  // changes the overall workspace height. Stacked panes in the bleed frame
  // keep their fitted height — only the split moves.
  const heightLocked = bleed && !isRow;
  const clampH = useCallback(
    (h: number) => Math.max(H_MIN, Math.min(bleed ? fitHRef.current : hMax(), h)),
    [bleed]
  );
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
      if (!heightLocked) setUserSized(true);
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const p = 'touches' in ev ? ev.touches[0] : ev;
        const dx = p.clientX - start.sx;
        const dy = p.clientY - start.sy;
        if (isRow) {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dx / start.w) * 100))
          );
          setWorkspaceH(clampH(start.h + dy));
        } else {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dy / start.ht) * 100))
          );
          if (!heightLocked) setWorkspaceH(clampH(start.h + dx));
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
    [isRow, split, workspaceH, heightLocked, clampH]
  );

  return (
    <div
      ref={workspaceRef}
      data-lesson-workspace=""
      className={
        bleed
          ? 'relative overflow-visible border-y border-border bg-card'
          : 'relative overflow-visible rounded-xl border border-border bg-card'
      }
      style={{ height: workspaceH }}
    >
      <div
        className="flex h-full items-stretch"
        style={{ flexDirection: isRow ? 'row' : 'column' }}
      >
        {/* Primary pane */}
        <div
          className="flex min-h-0 min-w-0 flex-col bg-black"
          style={{ flex: visiblePane === 'both' ? `${split} 1 0` : '1 1 0', display: visiblePane === 'secondary' ? 'none' : undefined }}
        >
          {visiblePane === 'primary' && secondaryHeader({ orient, setOrient: changeOrient, isRow })}
          {primary}
        </div>

        {/* Secondary pane */}
        <div
          className="flex min-h-0 min-w-0 flex-col bg-card"
          style={{
            flex: visiblePane === 'both' ? `${100 - split} 1 0` : '1 1 0',
            display: visiblePane === 'primary' ? 'none' : undefined,
            borderLeft: visiblePane === 'both' && isRow ? '1px solid hsl(var(--border))' : 'none',
            borderTop: visiblePane === 'both' && !isRow ? '1px solid hsl(var(--border))' : 'none',
          }}
        >
          {secondaryHeader({ orient, setOrient: changeOrient, isRow })}
          {secondary}
        </div>
      </div>

      {/* Single diagonal corner knob — resizes split + height together. */}
      <button
        type="button"
        hidden={visiblePane !== 'both'}
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
        className={`grid h-[26px] w-7 place-items-center rounded-full transition-colors ${
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
        className={`grid h-[26px] w-7 place-items-center rounded-full transition-colors ${
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
