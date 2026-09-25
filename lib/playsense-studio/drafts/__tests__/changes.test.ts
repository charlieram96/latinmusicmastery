import { describe, expect, it } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { diffParts, summarizeChanges } from '../changes';
import { EMPTY_TIMING, type StudioTiming } from '../timing';

function score(title: string, measures: unknown[]): ScoreDocument {
  return { title, tracks: [{ index: 0, measures }] } as unknown as ScoreDocument;
}
const m = (pitch: number, id = 'x') => ({ events: [{ id, kind: 'note', pitch }] });
const timed = (s: number): StudioTiming => ({ ...EMPTY_TIMING, waypoints: [
  { musicalPositionQN: 0, videoTimeSeconds: s, measureNumber: 1, beatInMeasure: 1 },
  { musicalPositionQN: 4, videoTimeSeconds: s + 2, measureNumber: 2, beatInMeasure: 1 },
] });

describe('change summary', () => {
  it('ignores event ids assigned on open', () => {
    const live = { score: score('A', [m(60, 'a')]), timing: EMPTY_TIMING };
    const draft = { score: score('A', [m(60, 'b')]), timing: EMPTY_TIMING };
    expect(diffParts(live, draft)).toEqual({ score: false, timing: false, anchor: false });
    expect(summarizeChanges(live, draft)).toEqual(['No changes from the live version']);
  });
  it('counts changed, added and removed bars, title, timing and anchor', () => {
    const live = { score: score('A', [m(60), m(62), m(64)]), timing: timed(1) };
    const draft = { score: score('B', [m(60), m(63), m(64), m(65), m(67)]), timing: { ...timed(1.5), anchor: { seconds: 2, qn: 0 } } };
    expect(summarizeChanges(live, draft)).toEqual([
      'Title changed', '1 bar changed', '2 bars added', 'Timing changed', 'Click anchor changed',
    ]);
    expect(summarizeChanges({ ...live, score: score('A', [m(60), m(62), m(64)]) }, { ...live, score: score('A', [m(60)]) }))
      .toEqual(['2 bars removed']);
  });
  it('treats a null draft anchor as "keep live", never a change', () => {
    const live = { score: score('A', []), timing: { ...timed(1), anchor: { seconds: 1, qn: 0 } } };
    const draft = { score: score('A', []), timing: { ...timed(1), anchor: null } };
    expect(diffParts(live, draft)).toEqual({ score: false, timing: false, anchor: false });
  });
  it('treats a draft with fewer than two waypoints as unable to publish timing', () => {
    const live = { score: score('A', []), timing: timed(1) };
    const draft = { score: score('A', []), timing: EMPTY_TIMING };
    expect(diffParts(live, draft)).toEqual({ score: false, timing: false, anchor: false });
  });
});
