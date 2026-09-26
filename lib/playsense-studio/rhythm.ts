// PlaySense Studio — written note values. Events store their sounding length
// (durationQN); the zoom edits written value + dots + tuplet.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';

export type NoteValue = 'w' | 'h' | 'q' | '8' | '16' | '32' | '64';

export const VALUE_QN: Record<NoteValue, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625 };
export const KEY_VALUE: Record<string, NoteValue> = { '1': '64', '2': '32', '3': '16', '4': '8', '5': 'q', '6': 'h', '7': 'w' };
export const VALUE_NAME: Record<NoteValue, string> = { w: 'Whole', h: 'Half', q: 'Quarter', '8': '8th', '16': '16th', '32': '32nd', '64': '64th' };

export function dotFactor(dots: 0 | 1 | 2): number {
  return dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1;
}

export function soundingQN(value: NoteValue, dots: 0 | 1 | 2, tuplet?: { n: number; m: number } | null): number {
  return VALUE_QN[value] * dotFactor(dots) * (tuplet ? tuplet.m / tuplet.n : 1);
}

export function valueFromQN(qn: number): NoteValue | null {
  const hit = (Object.keys(VALUE_QN) as NoteValue[]).find((v) => Math.abs(VALUE_QN[v] - qn) < 1e-6);
  return hit ?? null;
}

// eventTuplet() (accessors.ts) already folds the legacy `triplet: true` flag
// into a 3:2 tuplet when `tuplet` is absent, so tupletScale() below covers
// both the current and legacy shapes without a separate fallback here.
export function writtenValue(e: MusicalEvent): NoteValue | null {
  return valueFromQN(e.durationQN / (dotFactor(eventDots(e)) * tupletScale(e)));
}
