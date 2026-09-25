'use client';

// PlaySense Studio — the measure zoom: one bar drawn large over the strip,
// with its neighbours as dimmed slivers either side, the bar's beats shaded
// behind the notes and a fill meter under the staff (spec §6; v6's setFocus,
// renderFocus and exitFocus).
//
// It fills the strip wrapper (position: absolute; inset: 0; z-index 46) while
// the strip keeps rendering underneath. Animations use element.animate and are
// skipped where it or matchMedia is missing (jsdom) or reduced motion is on:
//   • enter: from the bar's rect in the strip (`origin`), 340 ms;
//   • another bar: the center slides 40 px in from the side it came from, 220 ms;
//   • close (the close button, or `closing` turning true): the reverse of the
//     enter, 240 ms, then onClose.

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { MeasureFill } from '@/lib/playsense-studio/measure-fill';
import type { NoteCursor } from '@/lib/playsense-studio/note-cursor';
import type { NoteValue } from '@/lib/playsense-studio/rhythm';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureStripItem } from '../editable-measure-strip';
import { ZoomStaff, type ZoomLayout } from './zoom-staff';

export interface ZoomState { measureIndex: number; cursor: NoteCursor; value: NoteValue; dots: 0 | 1 | 2; pencil: boolean }

export interface MeasureZoomProps {
  items: MeasureStripItem[];
  zoom: ZoomState;
  height: number;
  spans?: Span[];
  fill: MeasureFill;
  bpm: number | null;
  percussion: boolean;
  /** The bar's rect in the strip, for the enter (and exit) animation. */
  origin: { left: number; width: number } | null;
  /** Set true to play the exit animation and then call onClose (Esc from the editor). */
  closing?: boolean;
  onVoice: (v: 0 | 1) => void;
  onNav: (dir: 1 | -1) => void;
  onClose: () => void;
  onLayout: (l: ZoomLayout) => void;
  /**
   * Toolbar and popovers (Tasks 8–10). A function is called with the center
   * column's width (for clamping a floating bar inside it, the measure bar's
   * pattern) and its current layout, and is re-invoked whenever either
   * changes. Rendered with `gridColumn: 2; gridRow: 2`, the same grid area as
   * the staff, so an absolutely-positioned child's `left`/`top` share the
   * hits' coordinate space (0,0 at the center column's top-left).
   */
  children?: ReactNode | ((ctx: { centerW: number; layout: ZoomLayout | null }) => ReactNode);
}

const HEAD_H = 30;
const METER_ROW_H = 18;
/** Until the overlay is measured (and in jsdom, where it never is). */
const FALLBACK_WIDTH = 800;
const CENTER_SCALE = 1.5;
const SLIVER_SCALE = 0.7;

const ENTER = { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' };
const EXIT = { duration: 240, easing: 'cubic-bezier(.4,0,.8,.4)' };
const SLIDE = { duration: 220, easing: 'ease-out' };

/** Animations run only where the browser supports them and motion is welcome. */
function canAnimate(el: HTMLElement | null): el is HTMLElement {
  if (!el || typeof el.animate !== 'function') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The transform that maps the whole panel onto the bar's rect in the strip. */
function originTransform(origin: { left: number; width: number }, panelWidth: number): string {
  const sx = panelWidth > 0 ? Math.max(0.01, origin.width / panelWidth) : 1;
  return `translateX(${origin.left}px) scaleX(${sx})`;
}

const noop = () => {};

export function MeasureZoom({
  items, zoom, height, spans, fill, bpm, percussion, origin, closing = false,
  onVoice, onNav, onClose, onLayout, children,
}: MeasureZoomProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);

  // The overlay's width, for the grid's column sizes.
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setMeasured(Math.round(el.clientWidth));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const panelW = measured > 0 ? measured : FALLBACK_WIDTH;
  // grid-template-columns: minmax(56px, 13%) 1fr minmax(56px, 13%).
  const sliverW = Math.max(56, panelW * 0.13);
  const centerW = Math.max(0, panelW - 2 * sliverW);
  const bodyH = Math.max(0, height - HEAD_H - METER_ROW_H);

  const i = zoom.measureIndex;
  const item = items[i];
  const prev = items[i - 1];
  const next = items[i + 1];
  const voice = zoom.cursor.voice;

  // The center's layout, for the beat bands; forwarded to the editor.
  const [layout, setLayout] = useState<ZoomLayout | null>(null);
  const layoutCb = useRef(onLayout);
  useEffect(() => {
    layoutCb.current = onLayout;
  });
  const handleLayout = useCallback((l: ZoomLayout) => {
    setLayout(l);
    layoutCb.current(l);
  }, []);

  // ---- Animations ------------------------------------------------------------

  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  });

  // Enter: from the bar's rect, once, on mount.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const o = originRef.current;
    if (!o || !canAnimate(el)) return;
    el.animate(
      [{ transform: originTransform(o, el.clientWidth), opacity: 0.3 }, { transform: 'none', opacity: 1 }],
      ENTER,
    );
  }, []);

  // Another bar: slide the center in from the side it came from.
  const lastIndex = useRef(i);
  useLayoutEffect(() => {
    const from = lastIndex.current;
    lastIndex.current = i;
    if (from === i) return;
    const el = centerRef.current;
    if (!canAnimate(el)) return;
    const dir = i > from ? 1 : -1;
    el.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0.3 }, { transform: 'none' }], SLIDE);
  }, [i]);

  // Close: the reverse of the enter, then onClose. Immediate without animation.
  const closeCb = useRef(onClose);
  useEffect(() => {
    closeCb.current = onClose;
  });
  const exiting = useRef(false);
  const exit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    const el = rootRef.current;
    const o = originRef.current;
    if (!canAnimate(el)) {
      closeCb.current();
      return;
    }
    const to = o ? { transform: originTransform(o, el.clientWidth), opacity: 0.3 } : { opacity: 0 };
    const anim = el.animate([{ transform: 'none', opacity: 1 }, to], { ...EXIT, fill: 'forwards' });
    anim.onfinish = () => closeCb.current();
  }, []);
  useEffect(() => {
    if (closing) exit();
  }, [closing, exit]);

  // ---- Beat bands and meter ----------------------------------------------------

  const ts = item?.timeSignature ?? [4, 4];
  const beats = Math.max(1, ts[0]);
  const bandStart = layout && layout.noteEndX > layout.noteStartX ? layout.noteStartX : 0;
  const bandEnd = layout && layout.noteEndX > layout.noteStartX ? layout.noteEndX : centerW;
  const bandW = (bandEnd - bandStart) / beats;

  const barQN = measureLengthInQN(ts);
  const meterEvents = item ? (voice === 0 ? item.events : item.voice2Events ?? []) : [];
  const showVoices = !!item && (item.voice2Events?.length > 0 || voice === 1);

  const sliver = (side: 'prev' | 'next', neighbour: MeasureStripItem | undefined) => (
    <div
      className="st-zoom-sliver"
      data-side={side}
      style={{ gridColumn: side === 'prev' ? 1 : 3, gridRow: 2, overflow: 'hidden', cursor: neighbour ? 'pointer' : 'default' }}
      onClick={neighbour ? () => onNav(side === 'prev' ? -1 : 1) : undefined}
      title={neighbour ? `m.${neighbour.measureNumber}` : undefined}
    >
      {neighbour && (
        <>
          <ZoomStaff item={neighbour} width={sliverW} height={bodyH} scale={SLIVER_SCALE} spans={spans} onLayout={noop} />
          <span className="st-zoom-sliver-label">m.{neighbour.measureNumber}</span>
        </>
      )}
    </div>
  );

  if (!item) return null;

  return (
    <div
      ref={rootRef}
      className="st-zoom-overlay"
      data-testid="measure-zoom"
      data-percussion={percussion || undefined}
      style={{ transformOrigin: '0 50%' }}
    >
      <div className="st-zoom-head">
        <span className="font-semibold">m.{item.measureNumber}</span>
        {bpm !== null && <span className="text-muted-foreground">≈{bpm.toFixed(1)} BPM</span>}
        {showVoices && (
          <div className="st-seg" role="group" aria-label="Voice">
            <button type="button" className={voice === 0 ? 'is-on' : ''} aria-pressed={voice === 0} onClick={() => onVoice(0)}>V1</button>
            <button type="button" className={voice === 1 ? 'is-on' : ''} aria-pressed={voice === 1} onClick={() => onVoice(1)}>V2</button>
          </div>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className="st-iconbtn" title="Previous bar (⌘←)" aria-label="Previous bar" disabled={!prev} onClick={() => onNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="st-iconbtn" title="Next bar (⌘→)" aria-label="Next bar" disabled={!next} onClick={() => onNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="st-iconbtn" title="Close (Esc)" aria-label="Close" onClick={exit}>
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      {sliver('prev', prev)}

      <div ref={centerRef} className="st-zoom-center" style={{ gridColumn: 2, gridRow: 2 }}>
        {Array.from({ length: beats }, (_, b) => (
          <div
            key={b}
            className="st-zoom-band"
            data-odd={b % 2 === 0 ? 'true' : 'false'}
            style={{ left: bandStart + b * bandW, width: bandW }}
          >
            <span>{b + 1}</span>
          </div>
        ))}
        <ZoomStaff item={item} width={centerW} height={bodyH} scale={CENTER_SCALE} spans={spans} onLayout={handleLayout} />
      </div>

      {sliver('next', next)}

      <div className={`st-zoom-meter${fill.kind === 'over' ? ' is-over' : ''}`} style={{ gridRow: 3 }} aria-hidden>
        {meterEvents.map((d, k) => (
          <i key={k} className={d.isRest ? 'is-rest' : undefined} style={{ width: `${(d.durationQN / barQN) * 100}%` }} />
        ))}
      </div>

      {typeof children === 'function' ? children({ centerW, layout }) : children}
    </div>
  );
}
