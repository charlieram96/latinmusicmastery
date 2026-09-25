// PlaySense Studio — the zoom's note cursor.
//
// A pure model for where note entry is "at" inside a zoomed-open bar: which
// measure, which voice, which event index (or 'end', the append point past
// the last event), and an optional selection anchor. Ports v6's `advanceN`,
// the ←/→ handler and `refIdx` into a standalone, testable module.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { occupiedQN, QN_EPS } from './time-mapping';
import { pitchIndex } from './pitch';

export interface NoteCursor { measureIndex: number; voice: 0 | 1; index: number | 'end'; anchor: number | null }

export interface CursorContext {
  count: number; // bars in the track
  events: (measureIndex: number, voice: 0 | 1) => MusicalEvent[];
  barQN: (measureIndex: number) => number;
}

/**
 * The selected event indices in `c`'s bar/voice: the inclusive range from the
 * anchor (if set) to the current index. `cursorRange` has no bar-length
 * context, so when the current index is 'end' with an anchor set, it resolves
 * 'end' relative to the anchor (one past it) rather than the bar's true last
 * event — the only shape that combination can take in practice, since
 * crossing bars always clears the anchor (see `walkCursor`).
 */
export function cursorRange(c: NoteCursor): number[] {
  if (c.anchor === null) return c.index === 'end' ? [] : [c.index];
  const end = c.index === 'end' ? c.anchor + 1 : c.index;
  const lo = Math.min(c.anchor, end);
  const hi = Math.max(c.anchor, end);
  const range: number[] = [];
  for (let i = lo; i <= hi; i++) range.push(i);
  return range;
}

/** Advance the cursor after an entry. The anchor is always cleared. */
export function advanceCursor(c: NoteCursor, ctx: CursorContext): NoteCursor {
  const events = ctx.events(c.measureIndex, c.voice);
  const nextIndex = c.index === 'end' ? -1 : c.index + 1;

  if (nextIndex >= 0 && nextIndex < events.length) {
    return { ...c, index: nextIndex, anchor: null };
  }

  const barQN = ctx.barQN(c.measureIndex);
  if (occupiedQN(events) < barQN - QN_EPS) {
    return { ...c, index: 'end', anchor: null };
  }

  const next = c.measureIndex + 1;
  if (next < ctx.count) {
    const nextEvents = ctx.events(next, c.voice);
    return { measureIndex: next, voice: c.voice, index: nextEvents.length ? 0 : 'end', anchor: null };
  }

  return { ...c, index: 'end', anchor: null };
}

/** The old index as a number, for setting a fresh anchor ('end' becomes the last event). */
function resolveAnchor(c: NoteCursor, ctx: CursorContext): number {
  if (c.index !== 'end') return c.index;
  return Math.max(0, ctx.events(c.measureIndex, c.voice).length - 1);
}

/**
 * Walk the cursor by `dir` through the positions `[0 … len-1, 'end']`,
 * crossing bars at either end (or staying put at the score's edges).
 * `extend` sets/keeps the anchor; crossing into another bar always clears it.
 */
export function walkCursor(c: NoteCursor, dir: 1 | -1, extend: boolean, ctx: CursorContext): NoteCursor {
  const len = ctx.events(c.measureIndex, c.voice).length;
  const positions: Array<number | 'end'> = [...Array.from({ length: len }, (_, i) => i), 'end'];
  const posIdx = positions.indexOf(c.index);
  let newPosIdx = posIdx + dir;

  if (newPosIdx < 0) {
    const prev = c.measureIndex - 1;
    if (prev >= 0) return { measureIndex: prev, voice: c.voice, index: 'end', anchor: null };
    newPosIdx = 0; // the score's start edge: stay put
  } else if (newPosIdx >= positions.length) {
    const next = c.measureIndex + 1;
    if (next < ctx.count) {
      const nextEvents = ctx.events(next, c.voice);
      return { measureIndex: next, voice: c.voice, index: nextEvents.length ? 0 : 'end', anchor: null };
    }
    newPosIdx = positions.length - 1; // the score's end edge: stay put
  }

  const anchor = extend ? c.anchor ?? resolveAnchor(c, ctx) : null;
  return { ...c, index: positions[newPosIdx], anchor };
}

/** Clamp the cursor after edits: an out-of-range index becomes 'end', an out-of-range bar clamps to the last one. */
export function clampCursor(c: NoteCursor, ctx: CursorContext): NoteCursor {
  const measureIndex = Math.max(0, Math.min(c.measureIndex, ctx.count - 1));
  const len = ctx.events(measureIndex, c.voice).length;
  const index = c.index !== 'end' && c.index >= len ? 'end' : c.index;
  return { ...c, measureIndex, index };
}

/** The staff index of a note/chord's top pitch, or null for a rest. */
function topIndex(event: MusicalEvent, keyFifths: number): number | null {
  if (event.kind === 'note') return pitchIndex(event.midi, event.spelling, keyFifths);
  if (event.kind === 'chord') {
    const top = event.notes.reduce((a, b) => (b.midi > a.midi ? b : a));
    return pitchIndex(top.midi, top.spelling, keyFifths);
  }
  return null;
}

/**
 * The staff index of the nearest note or chord top before the cursor,
 * searching back through earlier bars of the same voice. Falls back to
 * `fallback` (the clef's reference, `CLEF_REF_INDEX`) when nothing is found.
 */
export function entryReference(c: NoteCursor, ctx: CursorContext, keyFifths: number, fallback: number): number {
  let measureIndex = c.measureIndex;
  let events = ctx.events(measureIndex, c.voice);
  let from = c.index === 'end' ? events.length - 1 : c.index - 1;

  for (;;) {
    for (let i = from; i >= 0; i--) {
      const idx = topIndex(events[i], keyFifths);
      if (idx !== null) return idx;
    }
    measureIndex -= 1;
    if (measureIndex < 0) return fallback;
    events = ctx.events(measureIndex, c.voice);
    from = events.length - 1;
  }
}
