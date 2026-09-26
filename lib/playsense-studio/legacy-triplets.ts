// PlaySense Studio — how legacy (id-less) triplets group. Old scores mark
// triplets with `triplet: true` (or an id-less `tuplet`) and no group id, so
// the groups are rebuilt from rhythm alone. The renderer (what students see)
// and the editor reducer (what a merge or value change takes) both read the
// groups from here, so they can never disagree.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { eventTuplet } from '@/components/playsense-studio/shared/score-model/accessors';
import { VALUE_QN, writtenValue } from './rhythm';

const EPS = 1e-6;

/**
 * The beat-grid unit a legacy triplet group closes against, from the group's
 * first written note value alone — independent of the time signature's beat
 * length, which for meters like 2/2 or 6/8 doesn't match the value's own
 * natural beat. A 16th or shorter closes every half beat; an 8th or a quarter
 * closes every beat; a half or whole closes every 2 or 4 quarter notes.
 */
export function legacyTripletUnit(writtenQN: number | null): number {
  if (writtenQN === null || writtenQN <= VALUE_QN['16']) return 0.5;
  if (writtenQN <= VALUE_QN['q']) return 1;
  return writtenQN; // half (2) or whole (4)
}

const onMultiple = (qn: number, unit: number) => Math.abs(qn - Math.round(qn / unit) * unit) < EPS;

/**
 * The legacy triplet groups of one voice in one bar, as lists of event indices
 * in order. `startQN` is where `events[0]` sits from the bar start (0 for a
 * whole voice).
 *
 * A group opens at an id-less tuplet event, taking its unit from that event's
 * written value (legacyTripletUnit), and closes after the event that lands
 *  - on a multiple of the unit from the bar start, or
 *  - on a multiple of the unit from the group's own start (an off-beat run), or
 *  - at 2 × unit of the group's length (the safety close),
 * whichever comes first. A non-tuplet event, a tuplet with an id, an id-less
 * tuplet of another n:m, or the end of the bar also closes it.
 */
export function legacyTripletGroups(events: MusicalEvent[], startQN = 0): number[][] {
  const groups: number[][] = [];
  let pos = startQN;
  let open: { indices: number[]; unit: number; start: number; n: number; m: number } | null = null;
  events.forEach((e, i) => {
    const t = eventTuplet(e);
    if (!t || t.id) {
      open = null;
    } else {
      if (open && (open.n !== t.n || open.m !== t.m)) open = null;
      if (!open) {
        const wv = writtenValue(e);
        open = { indices: [], unit: legacyTripletUnit(wv !== null ? VALUE_QN[wv] : null), start: pos, n: t.n, m: t.m };
        groups.push(open.indices);
      }
      open.indices.push(i);
      const after = pos + e.durationQN;
      const length = after - open.start;
      if (onMultiple(after, open.unit) || onMultiple(length, open.unit) || length >= 2 * open.unit - EPS) open = null;
    }
    pos += e.durationQN;
  });
  return groups;
}

/** The legacy triplet group holding `events[index]`, or null when it is in none. */
export function legacyTripletGroupAt(events: MusicalEvent[], index: number): number[] | null {
  return legacyTripletGroups(events).find((g) => g.includes(index)) ?? null;
}
