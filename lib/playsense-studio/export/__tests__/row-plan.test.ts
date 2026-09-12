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
    const narrow = buildRowPlan(SON_MONTUNO_FIXTURE, [2], 700, { expandRepeats: true });
    const all = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    const width = (p: typeof all, i: number) => p.rows.flatMap(r => r.widths)[i];
    expect(width(all, 1)).toBeGreaterThanOrEqual(width(narrow, 1));
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
