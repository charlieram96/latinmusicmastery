import { describe, expect, it } from 'vitest';
import { collectOnsets, onsetForSelection } from '../note-onsets';
import {
  CONGA_TUMBAO_FIXTURE,
  GUITAR_LICK_FIXTURE,
  SON_MONTUNO_FIXTURE,
} from '../score-fixtures';

describe('collectOnsets', () => {
  it('lists one onset per quarter note in the guitar lick', () => {
    const onsets = collectOnsets(GUITAR_LICK_FIXTURE);
    expect(onsets.get(1)).toEqual([0, 1, 2, 3]);
    expect(onsets.get(2)).toEqual([4, 5, 6, 7]);
  });

  it('excludes rests', () => {
    const onsets = collectOnsets(CONGA_TUMBAO_FIXTURE);
    // Tumbao: S - O O | B - O O in eighths; rests at 0.5 and 2.5 are skipped.
    expect(onsets.get(1)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
    expect(onsets.get(2)).toEqual([4, 5, 5.5, 6, 7, 7.5]);
  });

  it('unions onsets across tracks, counting chords and coincident hits once', () => {
    const onsets = collectOnsets(SON_MONTUNO_FIXTURE);
    // Tres chords at 0 and 3; bass at 0 and 2; conga at 0,1,1.5,2,3,3.5.
    expect(onsets.get(1)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
    expect(onsets.size).toBe(4);
  });
});

describe('onsetForSelection', () => {
  it('returns the note onset for a note selection', () => {
    expect(onsetForSelection(GUITAR_LICK_FIXTURE, 0, { measureIndex: 0, eventIndex: 2 })).toEqual({
      measureNumber: 1,
      qn: 2,
    });
  });

  it('uses cumulative quarter notes in later measures', () => {
    expect(onsetForSelection(GUITAR_LICK_FIXTURE, 0, { measureIndex: 1, eventIndex: 1 })).toEqual({
      measureNumber: 2,
      qn: 5,
    });
  });

  it('returns null for a rest', () => {
    expect(onsetForSelection(CONGA_TUMBAO_FIXTURE, 0, { measureIndex: 0, eventIndex: 1 })).toBeNull();
  });

  it('returns the chord onset for a chord selection on another track', () => {
    expect(onsetForSelection(SON_MONTUNO_FIXTURE, 0, { measureIndex: 0, eventIndex: 2 })).toEqual({
      measureNumber: 1,
      qn: 3,
    });
  });

  it('returns null when the track, measure, or event does not exist', () => {
    expect(onsetForSelection(GUITAR_LICK_FIXTURE, 3, { measureIndex: 0, eventIndex: 0 })).toBeNull();
    expect(onsetForSelection(GUITAR_LICK_FIXTURE, 0, { measureIndex: 9, eventIndex: 0 })).toBeNull();
    expect(onsetForSelection(GUITAR_LICK_FIXTURE, 0, { measureIndex: 0, eventIndex: 9 })).toBeNull();
  });
});
