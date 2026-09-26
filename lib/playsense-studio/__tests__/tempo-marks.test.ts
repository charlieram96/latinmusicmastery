import { describe, expect, it } from 'vitest';
import { tempoAt, tempoMarks, unconfirmedTempoMarks } from '../tempo-marks';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const doc = (tempos: Array<number | undefined>, confirmed?: boolean): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'musicxml', initialTempo: 96, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tempoMarksConfirmed: confirmed,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'Piano', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: tempos.map((t, i) => ({ number: i + 1, voices: [{ number: 1, events: [] }], ...(t === undefined ? {} : { tempoChange: t }) })) }],
});

describe('tempo marks', () => {
  it('lists bars that carry a mark', () => {
    expect(tempoMarks(doc([undefined, 120, undefined, 100]))).toEqual([
      { measureIndex: 1, measureNumber: 2, bpm: 120 }, { measureIndex: 3, measureNumber: 4, bpm: 100 },
    ]);
  });
  it('the tempo in force walks back to the nearest mark', () => {
    const s = doc([undefined, 120, undefined]);
    expect(tempoAt(s, 0, 0)).toBe(96);
    expect(tempoAt(s, 0, 2)).toBe(120);
  });
  it('unconfirmed marks are the ones that differ from the lesson tempo, until confirmed', () => {
    expect(unconfirmedTempoMarks(doc([undefined, 96, 120]))).toEqual([{ measureIndex: 2, measureNumber: 3, bpm: 120 }]);
    expect(unconfirmedTempoMarks(doc([undefined, 120], true))).toEqual([]);
  });
});
