import { describe, expect, it } from 'vitest';
import { buildRowPlan } from '../pdf/row-plan';
import { SON_MONTUNO_FIXTURE, GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

describe('buildRowPlan', () => {
  it('packs every selected track with the same rows', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    expect(plan.aligned).toBe(true);
    const measures = plan.rows.reduce((n, r) => n + r.widths.length, 0);
    expect(measures).toBe(4);
    expect(plan.rows[0].startIndex).toBe(0);
  });

  it('uses the widest requirement across tracks for each measure', () => {
    // Track 1 is a copy of the guitar lick's track 0 with measure index 1
    // replaced by a dense bar (16 sixteenth notes) so the two tracks disagree
    // on how wide that measure needs to be, and a naive implementation that
    // reads only `widthsByTrack[0]` cannot pass by coincidence the way it did
    // against SON_MONTUNO_FIXTURE (every track there is 4/4, so the beat term
    // dominated and all tracks needed the same width regardless).
    const dense = {
      ...GUITAR_LICK_FIXTURE.tracks[0].measures[1],
      voices: [{ number: 1, events: Array.from({ length: 16 }, () => ({ kind: 'note' as const, midi: 60, durationQN: 0.25 })) }],
    };
    const twoTrack: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [
        GUITAR_LICK_FIXTURE.tracks[0],
        { ...GUITAR_LICK_FIXTURE.tracks[0], index: 1, measures: [GUITAR_LICK_FIXTURE.tracks[0].measures[0], dense] },
      ],
    };
    const width = (p: ReturnType<typeof buildRowPlan>, i: number) => p.rows.flatMap(r => r.widths)[i];

    const soloTrack0 = buildRowPlan(twoTrack, [0], 700, { expandRepeats: true });
    const mergedInOrder = buildRowPlan(twoTrack, [0, 1], 700, { expandRepeats: true });
    const mergedReversed = buildRowPlan(twoTrack, [1, 0], 700, { expandRepeats: true });

    // requiredMeasureWidths gives measure index 1 = max(100, 216, 4*22+24=112) = 216
    // for track 0 and max(100, 216, 16*22+24=376) = 376 for track 1 (the beat
    // term no longer dominates once the bar is this dense). packLessonScoreRows
    // then stretches whichever measures share a row to fill availWidth evenly,
    // so the *packed* numbers below are 310 (both bars fit one row alone with
    // track 0's own 216) and 390 (the row absorbs track 1's wider 376 instead) —
    // still strictly different, so the merge across tracks is what's under test.
    expect(width(soloTrack0, 1)).toBe(310);
    expect(width(mergedInOrder, 1)).toBe(390);
    expect(width(mergedReversed, 1)).toBe(390);
    expect(width(mergedInOrder, 1)).toBeGreaterThan(width(soloTrack0, 1));
  });

  it('falls back to per-track rows when measure counts differ', () => {
    const uneven: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [
        GUITAR_LICK_FIXTURE.tracks[0],
        { ...GUITAR_LICK_FIXTURE.tracks[0], index: 1, measures: GUITAR_LICK_FIXTURE.tracks[0].measures.slice(0, 1) },
      ],
    };
    const plan = buildRowPlan(uneven, [0, 1], 700, { expandRepeats: true });
    expect(plan.aligned).toBe(false);
    expect(plan.perTrackRows[0].flatMap(r => r.widths)).toHaveLength(2);
    expect(plan.perTrackRows[1].flatMap(r => r.widths)).toHaveLength(1);
  });

  it('collapses repeats when not expanding', () => {
    const m = GUITAR_LICK_FIXTURE.tracks[0].measures[0];
    const repeated: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{
        ...GUITAR_LICK_FIXTURE.tracks[0],
        measures: [
          { ...m, number: 1, repeat: { id: 'r', pass: 0, count: 2, offset: 0, length: 1 } },
          { ...m, number: 2, repeat: { id: 'r', pass: 1, count: 2, offset: 0, length: 1 } },
        ],
      }],
    };
    expect(buildRowPlan(repeated, [0], 700, { expandRepeats: false }).rows.flatMap(r => r.widths)).toHaveLength(1);
    expect(buildRowPlan(repeated, [0], 700, { expandRepeats: true }).rows.flatMap(r => r.widths)).toHaveLength(2);
  });
});
