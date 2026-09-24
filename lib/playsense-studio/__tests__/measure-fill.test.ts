import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { beatsText, fillIssues, fillTitle, measureFill } from '../measure-fill';

const n = (q: number): MusicalEvent => ({ kind: 'note', midi: 60, durationQN: q });
const r = (q: number): MusicalEvent => ({ kind: 'rest', durationQN: q });

describe('measureFill', () => {
  it('counts a full 4/4 bar as ok', () => {
    expect(measureFill([n(1), n(1), n(2)], undefined, [4, 4])).toMatchObject({ kind: 'ok', usedBeats: 4, totalBeats: 4 });
  });
  it('a short bar reports what is missing', () => {
    expect(measureFill([n(1), n(1.5)], undefined, [3, 4])).toMatchObject({ kind: 'short', usedBeats: 2.5, missingBeats: 0.5 });
  });
  it('an over-full bar reports the excess', () => {
    expect(measureFill([n(2), n(2), n(1)], undefined, [4, 4])).toMatchObject({ kind: 'over', overBeats: 1 });
  });
  it('counts 6/8 in eighths', () => {
    expect(measureFill([n(1.5), n(1.5)], undefined, [6, 8])).toMatchObject({ kind: 'ok', usedBeats: 6, totalBeats: 6 });
  });
  it('an empty bar or a lone filler rest is empty', () => {
    expect(measureFill([], undefined, [4, 4]).kind).toBe('empty');
    expect(measureFill([r(4)], undefined, [4, 4]).kind).toBe('empty');
  });
  it('a real rest counts as filled time', () => {
    expect(measureFill([n(2), r(2)], undefined, [4, 4]).kind).toBe('ok');
  });
  it('voice 2 is checked only when it has notes', () => {
    expect(measureFill([n(4)], [r(1)], [4, 4]).kind).toBe('ok');
    expect(measureFill([n(4)], [n(1)], [4, 4]).kind).toBe('short');
  });
});

describe('beatsText / fillTitle / fillIssues', () => {
  it('renders fractions as glyphs', () => {
    expect(beatsText(2.5)).toBe('2½');
    expect(beatsText(0.5)).toBe('½');
    expect(beatsText(3)).toBe('3');
    expect(beatsText(1 + 1 / 3)).toBe('1⅓');
    expect(beatsText(2.1)).toBe('2+');
  });
  it('titles say what is wrong', () => {
    expect(fillTitle(2, measureFill([n(1), n(1.5)], undefined, [3, 4]))).toBe('m.2: ½ beat missing');
    expect(fillTitle(3, measureFill([n(2), n(2), n(2)], undefined, [4, 4]))).toBe('m.3: 2 beats too many');
    expect(fillTitle(4, measureFill([], undefined, [4, 4]))).toBe('m.4 is empty');
    expect(fillTitle(5, measureFill([n(4)], undefined, [4, 4]))).toBe('m.5: 4 of 4 beats');
  });
  it('lists short and over bars only', () => {
    const fills = [measureFill([n(4)], undefined, [4, 4]), measureFill([n(1)], undefined, [4, 4]), measureFill([], undefined, [4, 4]), measureFill([n(5)], undefined, [4, 4])];
    expect(fillIssues(fills)).toEqual([1, 3]);
  });
});
