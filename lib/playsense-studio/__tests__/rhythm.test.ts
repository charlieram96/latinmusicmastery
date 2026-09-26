import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { KEY_VALUE, soundingQN, valueFromQN, writtenValue } from '../rhythm';

describe('rhythm', () => {
  it('maps keys 1–7 to 64th … whole', () => {
    expect(Object.entries(KEY_VALUE)).toEqual([['1', '64'], ['2', '32'], ['3', '16'], ['4', '8'], ['5', 'q'], ['6', 'h'], ['7', 'w']]);
  });
  it('sounding length covers dots and tuplets', () => {
    expect(soundingQN('q', 0)).toBe(1);
    expect(soundingQN('q', 1)).toBe(1.5);
    expect(soundingQN('q', 2)).toBe(1.75);
    expect(soundingQN('8', 0, { n: 3, m: 2 })).toBeCloseTo(1 / 3, 9);
    expect(soundingQN('16', 0, { n: 5, m: 4 })).toBeCloseTo(0.2, 9);
  });
  it('recovers the written value from a stored event, legacy flags included', () => {
    const e = (x: Partial<MusicalEvent>) => ({ kind: 'note', midi: 60, durationQN: 1, ...x }) as MusicalEvent;
    expect(writtenValue(e({ durationQN: 1.5, dots: 1 }))).toBe('q');
    expect(writtenValue(e({ durationQN: 0.75, dotted: true }))).toBe('8');
    expect(writtenValue(e({ durationQN: 1 / 3, tuplet: { id: 't', n: 3, m: 2 } }))).toBe('8');
    expect(writtenValue(e({ durationQN: 1 / 3, triplet: true }))).toBe('8');
    expect(writtenValue(e({ durationQN: 0.3 }))).toBeNull();
    expect(valueFromQN(4)).toBe('w');
  });
});
