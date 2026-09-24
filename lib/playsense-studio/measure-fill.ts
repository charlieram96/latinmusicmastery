// PlaySense Studio — how full each bar is, in the time signature's own beats
// (a 6/8 bar holds 6). Drives the strip's beat chip, the hatched missing time
// and the footer's "bars don't add up" chip.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { QN_EPS, isFillerRest, measureLengthInQN, occupiedQN } from './time-mapping';

export type FillKind = 'empty' | 'short' | 'ok' | 'over';

export interface MeasureFill {
  kind: FillKind;
  usedBeats: number;
  totalBeats: number;
  missingBeats: number;
  overBeats: number;
}

export function measureFill(voice1: MusicalEvent[], voice2: MusicalEvent[] | undefined, ts: [number, number]): MeasureFill {
  const unitQN = 4 / ts[1];
  const needQN = measureLengthInQN(ts);
  const totalBeats = needQN / unitQN;
  const v1 = isFillerRest(voice1, ts) ? [] : voice1;
  const v2 = voice2 && voice2.some((e) => e.kind !== 'rest') ? voice2 : [];
  if (v1.length === 0 && v2.length === 0) {
    return { kind: 'empty', usedBeats: 0, totalBeats, missingBeats: totalBeats, overBeats: 0 };
  }
  const used = occupiedQN(v1);
  const used2 = v2.length ? occupiedQN(v2) : needQN;
  const over = Math.max(used - needQN, used2 - needQN);
  const short = Math.max(needQN - used, needQN - used2);
  const kind: FillKind = over > QN_EPS ? 'over' : short > QN_EPS ? 'short' : 'ok';
  return {
    kind,
    usedBeats: used / unitQN,
    totalBeats,
    missingBeats: kind === 'short' ? short / unitQN : 0,
    overBeats: kind === 'over' ? over / unitQN : 0,
  };
}

const FRACTIONS: Array<[number, string]> = [
  [1 / 2, '½'], [1 / 4, '¼'], [3 / 4, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔'], [1 / 8, '⅛'],
  [3 / 8, '⅜'], [5 / 8, '⅝'], [7 / 8, '⅞'], [1 / 6, '⅙'], [5 / 6, '⅚'],
];

export function beatsText(beats: number): string {
  const whole = Math.floor(beats + 1e-6);
  const frac = beats - whole;
  if (frac < 1e-3) return String(whole);
  const glyph = FRACTIONS.find(([v]) => Math.abs(v - frac) < 1e-3)?.[1] ?? '+';
  return whole === 0 && glyph !== '+' ? glyph : `${whole}${glyph}`;
}

export function fillTitle(measureNumber: number, fill: MeasureFill): string {
  const beats = (b: number) => `${beatsText(b)} beat${Math.abs(b - 1) < 1e-6 || b < 1 ? '' : 's'}`;
  switch (fill.kind) {
    case 'empty': return `m.${measureNumber} is empty`;
    case 'short': return `m.${measureNumber}: ${beats(fill.missingBeats)} missing`;
    case 'over': return `m.${measureNumber}: ${beats(fill.overBeats)} too many`;
    default: return `m.${measureNumber}: ${beatsText(fill.usedBeats)} of ${beatsText(fill.totalBeats)} beats`;
  }
}

export function fillIssues(fills: MeasureFill[]): number[] {
  return fills.flatMap((f, i) => (f.kind === 'short' || f.kind === 'over' ? [i] : []));
}
