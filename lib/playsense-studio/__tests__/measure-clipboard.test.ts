import { describe, expect, it } from 'vitest';
import { readMeasureClipboard, subscribeMeasureClipboard, writeMeasureClipboard } from '../measure-clipboard';
import type { Measure } from '@/components/playsense-studio/shared/score-model/types';

const measure: Measure = {
  number: 3, repeat: { id: 'g', pass: 0, count: 2, offset: 0, length: 1 }, endBarline: 'final',
  voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }],
};

describe('measure clipboard', () => {
  it('stores a deep clone with repeat and barline overrides stripped, and notifies', () => {
    let fired = 0;
    const off = subscribeMeasureClipboard(() => { fired++; });
    writeMeasureClipboard({ measures: [measure], context: { bpm: 120, timeSignature: [4, 4], keyFifths: 0 }, instrument: 'staff' });
    const clip = readMeasureClipboard()!;
    expect(fired).toBe(1);
    expect(clip.measures[0].repeat).toBeUndefined();
    expect(clip.measures[0].endBarline).toBeUndefined();
    (measure.voices[0].events[0] as { midi: number }).midi = 99;
    expect((clip.measures[0].voices[0].events[0] as { midi: number }).midi).toBe(60);
    off();
    writeMeasureClipboard({ measures: [measure], context: { bpm: 120, timeSignature: [4, 4], keyFifths: 0 }, instrument: 'staff' });
    expect(fired).toBe(1);
  });

  it('deep-copies the timing and the slurs inside the clip', () => {
    const timing = [{ lengthQN: 4, durationSeconds: 2 }] as unknown as NonNullable<Parameters<typeof writeMeasureClipboard>[0]['timing']>;
    const notationSpans = [{ id: 's', type: 'slur' as const, from: 'a', to: 'b' }];
    writeMeasureClipboard({ measures: [measure], context: { bpm: 120, timeSignature: [4, 4], keyFifths: 0 }, instrument: 'staff', timing, notationSpans });
    const clip = readMeasureClipboard()!;
    expect(clip.timing).toEqual(timing);
    expect(clip.timing).not.toBe(timing);
    notationSpans[0].to = 'z';
    expect(clip.notationSpans).toEqual([{ id: 's', type: 'slur', from: 'a', to: 'b' }]);
  });
});
