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
//
// Pointer editing in the center (v6's focusPointerDown / focusPointerMove):
//   • a press on a note of the cursor's voice selects it (⇧ extends the
//     range); without ⇧ it also starts a pitch drag on a note or chord, every
//     note moving by the same diatonic steps in the key (a drum stroke snaps
//     to the nearest stroke line instead). The release commits one edit.
//   • the other voice's notes are drawn at half opacity and ignore the pointer.
//   • pencil mode: a gold ghost notehead follows the pointer over empty
//     staff, and a click appends a note of the current value at that line.

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type Dispatch, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import type { EditorAction, EventRef } from '@/lib/playsense-studio/editor-state';
import type { MeasureFill } from '@/lib/playsense-studio/measure-fill';
import type { NoteCursor } from '@/lib/playsense-studio/note-cursor';
import { strokeNotation, type PercStroke } from '@/lib/playsense-studio/perc-strokes';
import { keyPitchAt, pitchName } from '@/lib/playsense-studio/pitch';
import type { NoteValue } from '@/lib/playsense-studio/rhythm';
import type { NotationClef } from '@/lib/playsense-studio/score-to-vexflow';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';
import { dragSteps, indexForLine, snapStroke, stepPitches, type SpelledPitch } from '@/lib/playsense-studio/zoom-pointer';
import type { Span } from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureStripItem } from '../editable-measure-strip';
import type { ZoomEditing } from './use-zoom-editing';
import { ZoomStaff, type ZoomHit, type ZoomLayout } from './zoom-staff';

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
  /** The zoom's editing handlers (the pencil's append goes through them). */
  editing: ZoomEditing;
  /** A pitch drag commits straight to the reducer (one undo step). */
  dispatch: Dispatch<EditorAction>;
  /** A press on a note moves the cursor (select, or ⇧ extend). */
  onCursor: (c: NoteCursor) => void;
  /** The zoomed bar's clef and key, for the pencil's pitch and the drag's steps. */
  clef: NotationClef;
  keyFifths: number;
  /** The percussion track's strokes (a drag snaps to their lines), else null. */
  percStrokes: PercStroke[] | null;
  /**
   * Toolbar and popovers (Tasks 8–10). A function is called with the center
   * column's width and height (for clamping a floating bar inside it, the
   * measure bar's pattern) and its current layout, and is re-invoked whenever
   * any of them changes. Rendered with `gridColumn: 2; gridRow: 2`, the same
   * grid area as the staff, so an absolutely-positioned child's `left`/`top`
   * share the hits' coordinate space (0,0 at the center column's top-left).
   */
  children?: ReactNode | ((ctx: { centerW: number; bodyH: number; layout: ZoomLayout | null }) => ReactNode);
}

const HEAD_H = 30;
const METER_ROW_H = 18;
/** Until the overlay is measured (and in jsdom, where it never is). */
const FALLBACK_WIDTH = 800;
const CENTER_SCALE = 1.5;
const SLIVER_SCALE = 0.7;
/** Half a stave space, unscaled: one diatonic step. */
const STEP_PX = 5;
/** Slack around a note's box for a press to still take it. */
const HIT_PAD = 3;
/** The pencil reaches this far past the stave (lines, 0 = top line). */
const GHOST_LINES: [number, number] = [-5, 9];

interface PitchDrag {
  pointerId: number;
  y0: number;
  ref: EventRef;
  hit: ZoomHit;
  /** The note or chord's pitches before the drag. */
  notes: SpelledPitch[];
  /** A drum stroke's midi (the drag snaps to stroke lines), else null. */
  strokeMidi: number | null;
  steps: number;
}

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
/** Header buttons keep focus where it was, so the zoom's keys keep working after a click. */
const keepFocus = (e: ReactMouseEvent) => e.preventDefault();

export function MeasureZoom({
  items, zoom, height, spans, fill, bpm, percussion, origin, closing = false,
  onVoice, onNav, onClose, onLayout, editing, dispatch, onCursor, clef, keyFifths, percStrokes, children,
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
  // V2 is always offered on a pitched track, so a first voice-2 note can be entered.
  const showVoices = !!item && (item.voice2Events?.length > 0 || voice === 1 || !percussion);

  // ---- Pointer editing ---------------------------------------------------------

  const drag = useRef<PitchDrag | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; text: string } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = centerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  /** The cursor voice's note under (x, y); the other voice never takes the pointer. */
  const hitAt = (x: number, y: number): ZoomHit | null =>
    layout?.hits.find((h) => h.voice === voice
      && x >= h.x - HIT_PAD && x <= h.x + h.w + HIT_PAD
      && y >= h.y - HIT_PAD && y <= h.y + h.h + HIT_PAD) ?? null;

  /** The pencil's stave line at y: snapped to half-lines, kept near the stave. */
  const pencilLine = (l: ZoomLayout, y: number) =>
    Math.max(GHOST_LINES[0], Math.min(GHOST_LINES[1], Math.round(l.lineForY(y) * 2) / 2));

  const pxPerStep = STEP_PX * CENTER_SCALE;

  /** The drag's result: new pitches (or a stroke), and their names for the tooltip. */
  const dragResult = (d: PitchDrag, steps: number) => {
    if (d.strokeMidi !== null) {
      const midi = snapStroke(percStrokes ?? [], d.strokeMidi, steps);
      return { midis: [midi], text: percStrokes?.find((s) => s.midi === midi)?.label ?? '' };
    }
    const next = stepPitches(d.notes, steps, keyFifths);
    return { midis: next.map((p) => p.midi), text: next.map((p) => pitchName(p.midi, p.spelling, keyFifths)).join(' ') };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !layout) return;
    const p = localPoint(e);
    const hit = hitAt(p.x, p.y);
    if (hit) {
      e.preventDefault();
      const c = zoom.cursor;
      if (e.shiftKey) {
        const here = c.measureIndex === i && c.voice === voice;
        const anchor = here ? c.anchor ?? (typeof c.index === 'number' ? c.index : hit.eventIndex) : hit.eventIndex;
        onCursor({ measureIndex: i, voice, index: hit.eventIndex, anchor });
        return;
      }
      onCursor({ measureIndex: i, voice, index: hit.eventIndex, anchor: null });
      const at = editing.eventAt(voice, hit.eventIndex);
      if (!at || at.event.kind === 'rest') return;
      let strokeMidi: number | null = null;
      if (percussion) {
        // A stacked stroke (chord) keeps its strokes, as ↑/↓ does.
        if (at.event.kind !== 'note' || !percStrokes?.length) return;
        strokeMidi = at.event.midi;
      }
      const notes = at.event.kind === 'chord' ? at.event.notes : [at.event];
      drag.current = {
        pointerId: e.pointerId, y0: p.y, ref: at.ref, hit, strokeMidi, steps: 0,
        notes: notes.map((n) => ({ midi: n.midi, spelling: n.spelling })),
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      return;
    }
    if (zoom.pencil) {
      e.preventDefault();
      const pitch = keyPitchAt(indexForLine(pencilLine(layout, p.y), clef), keyFifths);
      editing.enterPitch(pitch.midi, pitch.spelling);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = localPoint(e);
    const d = drag.current;
    if (d) {
      if (d.pointerId !== e.pointerId) return;
      const steps = dragSteps(d.y0, p.y, pxPerStep);
      if (steps === d.steps) return;
      d.steps = steps;
      if (steps === 0) {
        setTip(null);
        return;
      }
      setTip({ left: d.hit.x + d.hit.w / 2, top: d.hit.y - steps * pxPerStep - 6, text: dragResult(d, steps).text });
      return;
    }
    if (!zoom.pencil || !layout || hitAt(p.x, p.y)) {
      if (ghost) setGhost(null);
      return;
    }
    const y = layout.yForLine(pencilLine(layout, p.y));
    if (!ghost || ghost.x !== p.x || ghost.y !== y) setGhost({ x: p.x, y });
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setTip(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (!commit) return;
    const steps = dragSteps(d.y0, localPoint(e).y, pxPerStep);
    if (steps === 0) return;
    const { midis } = dragResult(d, steps);
    if (d.strokeMidi !== null) {
      const stroke = percStrokes?.find((s) => s.midi === midis[0]);
      if (!stroke || stroke.midi === d.strokeMidi) return;
      dispatch({ type: 'write-event', at: d.ref, kind: 'note', midi: stroke.midi, percussion: strokeNotation(stroke) });
      return;
    }
    if (midis.every((m, k) => m === d.notes[k].midi)) return;
    dispatch({ type: 'set-event-pitches', ref: d.ref, midis });
  };

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
            <button type="button" className={voice === 0 ? 'is-on' : ''} aria-pressed={voice === 0} onMouseDown={keepFocus} onClick={() => onVoice(0)}>V1</button>
            <button type="button" className={voice === 1 ? 'is-on' : ''} aria-pressed={voice === 1} onMouseDown={keepFocus} onClick={() => onVoice(1)}>V2</button>
          </div>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className="st-iconbtn" title="Previous bar (⌘←)" aria-label="Previous bar" disabled={!prev} onMouseDown={keepFocus} onClick={() => onNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="st-iconbtn" title="Next bar (⌘→)" aria-label="Next bar" disabled={!next} onMouseDown={keepFocus} onClick={() => onNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="st-iconbtn" title="Close (Esc)" aria-label="Close" onMouseDown={keepFocus} onClick={exit}>
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      {sliver('prev', prev)}

      <div
        ref={centerRef}
        className="st-zoom-center"
        style={{ gridColumn: 2, gridRow: 2, touchAction: 'none', cursor: zoom.pencil ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
        onLostPointerCapture={(e) => endDrag(e, false)}
        onPointerLeave={() => setGhost(null)}
      >
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
        <ZoomStaff
          item={item} width={centerW} height={bodyH} scale={CENTER_SCALE} spans={spans}
          dimVoice={voice === 0 ? 1 : 0} onLayout={handleLayout}
        />
        {zoom.pencil && ghost && (
          <div className="st-zoom-ghost" aria-hidden style={{ left: ghost.x - 5.5, top: ghost.y - 4 }} />
        )}
        {tip && (
          <div className="st-zoom-tip" role="status" style={{ left: tip.left, top: tip.top }}>
            {tip.text}
          </div>
        )}
      </div>

      {sliver('next', next)}

      <div className={`st-zoom-meter${fill.kind === 'over' ? ' is-over' : ''}`} style={{ gridRow: 3 }} aria-hidden>
        {meterEvents.map((d, k) => (
          <i key={k} className={d.isRest ? 'is-rest' : undefined} style={{ width: `${(d.durationQN / barQN) * 100}%` }} />
        ))}
      </div>

      {typeof children === 'function' ? children({ centerW, bodyH, layout }) : children}
    </div>
  );
}
