'use client';

// The lesson workspace: the teacher video (media) next to the music (the
// staff, and while playing the highway below it with its own divider).
//
// Layouts: side | stack | pip (music fills, the video floats in a corner) |
// music (no video), plus swap. Geometry is CSS grid driven by data attributes
// and CSS variables (split-workspace.css). The DOM order never changes
// between layouts, so the <video>, the staff renderer and the highway are
// never remounted. Drags write the CSS variables directly and commit to the
// controller once, on release, so nothing re-renders per pointer move.
//
// State lives in useWorkspaceLayout so the switcher (WorkspaceLayoutSwitcher)
// can be rendered anywhere, e.g. in the lesson action bar.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, Columns2, Music2, PictureInPicture2, Rows2, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import { lessonExerciseHeight, lessonStageHeight } from '@/lib/playsense-studio/lesson-viewport';
import {
  MUSIC_SPLIT_BOUNDS,
  SPLIT_BOUNDS,
  SPLIT_STEP,
  clamp,
  leadingSplit,
  nearestCorner,
  nudgeSplit,
  resizePipWidth,
  splitFromPointer,
  type WorkspaceLayout,
  type WorkspaceState,
} from '@/lib/playsense-studio/workspace-layout';
import type { WorkspaceController } from './use-workspace-layout';
import './split-workspace.css';

const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const FLIP_MS = 440;
const RESET_MS = 360;
/** Pointer travel below this is a tap on the PiP, not a drag. */
const DRAG_THRESHOLD = 4;
/** Never start a PiP drag from the video's own controls. */
const NO_DRAG = '[data-ws-nodrag], video[controls], input, select, textarea, a, [role="slider"]';
/** A double-click on these (the tap-to-play overlay, any control) is not "go back to side". */
const NO_DBLCLICK = `${NO_DRAG}, button, [role="button"]`;
const TILT = { min: -3, max: 3 };

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SplitWorkspaceProps {
  controller: WorkspaceController;
  /** The teacher video. Omitted → the music fills the workspace. */
  media?: ReactNode;
  /** The staff pane. */
  music: ReactNode;
  /** Shown below the staff with its own horizontal divider (while playing). */
  highway?: ReactNode;
  /** Absolute layer over the whole workspace (prompts, end-of-demo card). */
  overlay?: ReactNode;
  /** Full-width strip below the stage, clear of the floating video (e.g. the transport in PiP). */
  footer?: ReactNode;
  /**
   * Content that sits under the video in side / stack and in the footer in PiP / music only (the
   * watch transport). It is rendered once and its DOM node is moved, so it never remounts.
   */
  dock?: ReactNode;
  /**
   * 'card' — bordered box, `initialHeight` tall (capped to the viewport in a lesson).
   * 'bleed' — edge to edge, fitted to the viewport above the lesson footer.
   * 'fill' — the parent sizes it.
   */
  frame?: 'card' | 'bleed' | 'fill';
  initialHeight?: number;
  className?: string;
}

export function SplitWorkspace({
  controller,
  media,
  music,
  highway,
  overlay,
  footer,
  dock,
  frame = 'card',
  initialHeight = 560,
  className,
}: SplitWorkspaceProps) {
  const { t } = useTranslation();
  const { state, update, setLayout, defaults, beforeLayoutChangeRef } = controller;
  const hasMedia = media != null && media !== false;
  const layout: WorkspaceLayout = hasMedia ? controller.layout : 'music';
  const lead = leadingSplit(state.split, state.swap);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const musicRef = useRef<HTMLDivElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const flipFrom = useRef<(DOMRect | null)[] | null>(null);
  const pipFrom = useRef<DOMRect | null>(null);
  const stateRef = useRef<WorkspaceState>(state);
  useEffect(() => { stateRef.current = state; });
  // The drag in progress, so unmounting mid-drag can drop its window listeners.
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDrag.current?.(); }, []);

  // ---- Dock: one mounted subtree, its node moved between two slots ----
  const [dockNode, setDockNode] = useState<HTMLDivElement | null>(null);
  const hasDock = dock != null && dock !== false;
  useLayoutEffect(() => {
    if (!hasDock) return;
    const node = document.createElement('div');
    node.className = 'ws-dock';
    node.dataset.wsNodrag = '';
    setDockNode(node);
    return () => { node.remove(); setDockNode(null); };
  }, [hasDock]);
  const dockInMedia = hasMedia && (layout === 'side' || layout === 'stack');
  const mediaSlot = useRef<HTMLDivElement | null>(null);
  const footerSlot = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const slot = dockInMedia ? mediaSlot.current : footerSlot.current;
    if (dockNode && slot && dockNode.parentNode !== slot) slot.appendChild(dockNode);
  });

  // ---- Height: fit to the viewport above the lesson footer ----
  const [height, setHeight] = useState(initialHeight);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || frame === 'fill') return;
    const bleed = frame === 'bleed';
    const lesson = el.closest<HTMLElement>('[data-lesson-shell]');
    if (!bleed && !lesson) return;
    const scroller = el.closest<HTMLElement>('[data-dashboard-main]');
    const footer = lesson?.querySelector<HTMLElement>('[data-lesson-footer] > div');
    // The L2 lesson stage: its content (.lx-fill) pads the bottom; fill the rest exactly.
    const fill = el.closest<HTMLElement>('.lx-fill');
    let pending = 0;
    const fit = () => {
      pending = 0;
      const visibleBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight);
      const bottom = Math.min(visibleBottom, scroller?.getBoundingClientRect().bottom ?? visibleBottom);
      const top = el.getBoundingClientRect().top;
      const scrollTop = scroller?.scrollTop ?? window.scrollY;
      const available = fill
        ? lessonStageHeight(bottom, top, scrollTop, parseFloat(getComputedStyle(fill).paddingBottom) || 0)
        : lessonExerciseHeight(bottom, top, scrollTop, (footer?.getBoundingClientRect().height ?? 0) + 8);
      setHeight(bleed ? available : Math.min(initialHeight, available));
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
  }, [frame, initialHeight]);

  // ---- FLIP: measure before a layout change, animate after it lands ----
  useEffect(() => {
    beforeLayoutChangeRef.current = () => {
      flipFrom.current = reducedMotion()
        ? null
        : [mediaRef.current, musicRef.current].map((el) => el?.getBoundingClientRect() ?? null);
    };
    return () => { beforeLayoutChangeRef.current = null; };
  }, [beforeLayoutChangeRef]);

  // Runs after every commit so a measurement taken for a change that did not
  // happen (the active layout picked again) never animates a later change.
  const flipKey = `${layout}|${state.swap}|${state.corner}`;
  const lastFlipKey = useRef(flipKey);
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    const changed = lastFlipKey.current !== flipKey;
    lastFlipKey.current = flipKey;
    if (!from || !changed) return;
    [mediaRef.current, musicRef.current].forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      const to = el.getBoundingClientRect();
      if (!to.width) return;
      const was = from[i];
      if (!was || !was.width) {
        el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: FLIP_MS, easing: EASE_OUT });
        return;
      }
      el.animate([
        { transformOrigin: '0 0', transform: `translate(${was.left - to.left}px, ${was.top - to.top}px) scale(${was.width / to.width}, ${was.height / to.height})` },
        { transformOrigin: '0 0', transform: 'none' },
      ], { duration: FLIP_MS, easing: EASE_OUT });
    });
  });

  // ---- PiP spring to its new corner ----
  const springPip = useCallback(() => {
    const el = mediaRef.current;
    const from = pipFrom.current;
    pipFrom.current = null;
    if (!el || !from || reducedMotion() || typeof el.animate !== 'function') return;
    const to = el.getBoundingClientRect();
    el.animate(
      [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }],
      { duration: FLIP_MS, easing: EASE_SPRING },
    );
  }, []);
  useLayoutEffect(() => { springPip(); }, [state.corner, springPip]);

  // ---- Divider reset (double-click) with a grid transition ----
  const reset = (patch: Partial<WorkspaceState>) => {
    const ws = wsRef.current;
    if (ws && !reducedMotion()) {
      ws.dataset.anim = '';
      window.setTimeout(() => { delete ws.dataset.anim; }, RESET_MS + 40);
    }
    update(patch);
  };

  // ---- Divider drags ----
  const startSplitDrag = (which: 'split' | 'music') => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const ws = wsRef.current;
    const box = which === 'split' ? ws : musicRef.current;
    if (!ws || !box) return;
    e.preventDefault();
    const div = e.currentTarget;
    div.focus({ preventScroll: true });
    const r = box.getBoundingClientRect();
    const vertical = which === 'music' || layout === 'stack';
    const bounds = which === 'split' ? SPLIT_BOUNDS : MUSIC_SPLIT_BOUNDS;
    const swap = stateRef.current.swap;
    let value: number | null = null;
    ws.dataset.dragging = '';
    div.dataset.active = '';
    if (which === 'split' && pctRef.current) pctRef.current.textContent = `${Math.round(leadingSplit(stateRef.current.split, swap))}%`;
    const move = (ev: PointerEvent) => {
      value = splitFromPointer(vertical ? ev.clientY : ev.clientX, vertical ? r.top : r.left, vertical ? r.height : r.width, bounds);
      ws.style.setProperty(which === 'split' ? '--ws-lead' : '--ws-staff', String(value));
      div.setAttribute('aria-valuenow', String(Math.round(value)));
      if (which === 'split' && pctRef.current) pctRef.current.textContent = `${Math.round(value)}%`;
    };
    const detach = () => {
      endDrag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const up = () => {
      detach();
      delete ws.dataset.dragging;
      delete div.dataset.active;
      if (value == null) return;
      update(which === 'split' ? { split: leadingSplit(value, swap) } : { musicSplit: value });
    };
    endDrag.current?.();
    endDrag.current = detach;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onSplitKey = (which: 'split' | 'music') => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const vertical = which === 'music' || layout === 'stack';
    const steps: Record<string, number> = vertical
      ? { ArrowUp: -SPLIT_STEP, ArrowDown: SPLIT_STEP }
      : { ArrowLeft: -SPLIT_STEP, ArrowRight: SPLIT_STEP };
    const delta = steps[e.key];
    if (!delta) return;
    e.preventDefault();
    if (which === 'split') update({ split: leadingSplit(nudgeSplit(lead, delta), state.swap) });
    else update({ musicSplit: nudgeSplit(state.musicSplit, delta, MUSIC_SPLIT_BOUNDS) });
  };

  // ---- PiP: drag anywhere but the controls; resize from the inner corner ----
  const onMediaPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== 'pip' || e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest(NO_DRAG)) return;
    const el = mediaRef.current;
    const ws = wsRef.current;
    if (!el || !ws) return;
    const sizing = !!target.closest('.ws-pip-resize');
    if (sizing) e.preventDefault();
    const box = ws.getBoundingClientRect();
    const start = el.getBoundingClientRect();
    const { corner, pipWidth } = stateRef.current;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let dragging = false;
    let width = pipWidth;
    let last = { dx: 0, dy: 0 };
    // Holding the mouse still for the first few pixels must not start a text selection.
    const noSelect = (ev: Event) => ev.preventDefault();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      last = { dx, dy };
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        el.dataset.grabbing = '';
        ws.dataset.dragging = '';
      }
      if (sizing) {
        width = resizePipWidth(pipWidth, dx, corner, box.width);
        ws.style.setProperty('--ws-pipw', String(width));
      } else {
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${clamp(dx / 60, TILT)}deg)`;
      }
    };
    const detach = () => {
      endDrag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('selectstart', noSelect);
    };
    const up = () => {
      detach();
      if (!dragging) return;
      delete el.dataset.grabbing;
      delete ws.dataset.dragging;
      // The click that ends a drag is not a tap on whatever lies under it.
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      if (sizing) { update({ pipWidth: width }); return; }
      const next = nearestCorner({ x: start.left + start.width / 2 + last.dx, y: start.top + start.height / 2 + last.dy }, box);
      pipFrom.current = el.getBoundingClientRect();
      el.style.transform = '';
      if (next === corner) springPip();
      else update({ corner: next });
    };
    endDrag.current?.();
    endDrag.current = detach;
    document.addEventListener('selectstart', noSelect);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onMediaDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (layout !== 'pip' || (e.target as Element).closest(NO_DBLCLICK)) return;
    setLayout('side');
  };

  const splitActive = layout === 'side' || layout === 'stack';

  return (
    <div
      ref={frameRef}
      data-lesson-workspace=""
      data-frame={frame}
      className={cn('ws-frame', className)}
      style={frame === 'fill' ? undefined : { height }}
    >
      <div
        ref={wsRef}
        className="ws"
        data-layout={layout}
        data-swap={state.swap}
        data-corner={state.corner}
        style={{ '--ws-lead': lead, '--ws-staff': state.musicSplit, '--ws-pipw': state.pipWidth } as CSSProperties}
      >
        {hasMedia && (
          <div ref={mediaRef} className="ws-pane ws-media" onPointerDown={onMediaPointerDown} onDoubleClick={onMediaDoubleClick}>
            {media}
            {hasDock && dockInMedia && <div ref={mediaSlot} className="ws-dock-slot" data-ws-nodrag="" />}
            <span className="ws-pip-resize" aria-hidden="true" title={t('lessonWorkspace.resizePip')} />
          </div>
        )}
        {hasMedia && (
          <div
            className="ws-div"
            role="separator"
            tabIndex={splitActive ? 0 : -1}
            aria-orientation={layout === 'stack' ? 'horizontal' : 'vertical'}
            aria-valuemin={SPLIT_BOUNDS.min}
            aria-valuemax={SPLIT_BOUNDS.max}
            aria-valuenow={Math.round(lead)}
            aria-label={t('lessonWorkspace.resize')}
            title={t('lessonWorkspace.resizeHint')}
            onPointerDown={startSplitDrag('split')}
            onKeyDown={onSplitKey('split')}
            onDoubleClick={() => reset({ split: defaults.split })}
          >
            <span className="ws-grip" />
            <span ref={pctRef} className="ws-pct" aria-hidden="true" />
          </div>
        )}
        <div ref={musicRef} className="ws-pane ws-music">
          <div className="ws-staff">{music}</div>
          {highway && (
            <>
              <div
                className="ws-div2"
                role="separator"
                tabIndex={0}
                aria-orientation="horizontal"
                aria-valuemin={MUSIC_SPLIT_BOUNDS.min}
                aria-valuemax={MUSIC_SPLIT_BOUNDS.max}
                aria-valuenow={Math.round(state.musicSplit)}
                aria-label={t('lessonWorkspace.resizeMusic')}
                title={t('lessonWorkspace.resizeHint')}
                onPointerDown={startSplitDrag('music')}
                onKeyDown={onSplitKey('music')}
                onDoubleClick={() => reset({ musicSplit: defaults.musicSplit })}
              >
                <span className="ws-grip" />
              </div>
              <div className="ws-highway">{highway}</div>
            </>
          )}
        </div>
        {overlay}
      </div>
      {footer && <div className="ws-footer">{footer}</div>}
      {hasDock && !dockInMedia && <div ref={footerSlot} className="ws-footer ws-dock-slot" />}
      {dockNode && createPortal(dock, dockNode)}
    </div>
  );
}

const LAYOUT_OPTIONS: { value: WorkspaceLayout; icon: LucideIcon }[] = [
  { value: 'side', icon: Columns2 },
  { value: 'stack', icon: Rows2 },
  { value: 'pip', icon: PictureInPicture2 },
  { value: 'music', icon: Music2 },
];

/** Layout picker for a workspace. Render it wherever the view keeps its tools. */
export function WorkspaceLayoutSwitcher({ controller, className }: { controller: WorkspaceController; className?: string }) {
  const { t } = useTranslation();
  const groupRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const options = LAYOUT_OPTIONS.filter(
    (o) => controller.layouts.includes(o.value) && !(controller.narrow && o.value === 'side'),
  );

  // Slide the amber indicator under the pressed button (direct DOM write).
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const pressed = groupRef.current?.querySelector<HTMLElement>('[data-layout-option][aria-pressed="true"]');
    if (!indicator) return;
    if (!pressed) { indicator.style.opacity = '0'; return; }
    indicator.style.opacity = '1';
    indicator.style.left = `${pressed.offsetLeft}px`;
    indicator.style.width = `${pressed.offsetWidth}px`;
  }, [controller.layout, options.length]);

  if (controller.layouts.length < 2) return null;

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={t('lessonWorkspace.layout')}
      className={cn('relative inline-flex flex-shrink-0 items-center gap-0.5 rounded-xl border border-border bg-secondary p-1', className)}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 top-1 rounded-lg bg-primary opacity-0 shadow-[0_3px_0_hsl(var(--primary-deep))] transition-[left,width] duration-pop ease-spring motion-reduce:transition-none"
      />
      {options.map(({ value, icon: Icon }) => {
        const label = t(`lessonWorkspace.${value}`);
        return (
          <button
            key={value}
            type="button"
            data-layout-option=""
            aria-pressed={controller.layout === value}
            aria-label={label}
            title={label}
            onClick={() => controller.setLayout(value)}
            className="relative z-[1] grid h-[30px] w-8 place-items-center rounded-lg text-muted-foreground transition-colors duration-state hover:text-foreground aria-pressed:text-primary-foreground aria-pressed:hover:text-primary-foreground"
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-border" />
      <button
        type="button"
        aria-label={t('lessonWorkspace.swap')}
        title={t('lessonWorkspace.swap')}
        onClick={controller.swap}
        className="relative z-[1] grid h-[30px] w-8 place-items-center rounded-lg text-muted-foreground transition-colors duration-state hover:text-foreground"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );
}
