import { describe, expect, it } from 'vitest';
import { hasFinalBarline } from '../barlines';
import type { Measure } from '@/components/playsense-studio/shared/score-model/types';

const measure = (number: number, extra: Partial<Measure> = {}): Measure => ({ number, voices: [{ number: 1, events: [] }], ...extra });

describe('hasFinalBarline', () => {
  it('closes the last measure of a section with a final bar by default', () => {
    const measures = [measure(1), measure(2), measure(3)];
    expect(measures.map((_, i) => hasFinalBarline(measures, i))).toEqual([false, false, true]);
  });

  it('lets the author remove the bar from the last measure', () => {
    const measures = [measure(1), measure(2, { endBarline: 'single' })];
    expect(hasFinalBarline(measures, 1)).toBe(false);
  });

  it('lets the author place a final bar on an inner measure', () => {
    const measures = [measure(1, { endBarline: 'final' }), measure(2)];
    expect(hasFinalBarline(measures, 0)).toBe(true);
    expect(hasFinalBarline(measures, 1)).toBe(true);
  });

  it('is false out of range', () => {
    expect(hasFinalBarline([], 0)).toBe(false);
    expect(hasFinalBarline([measure(1)], 5)).toBe(false);
  });
});
