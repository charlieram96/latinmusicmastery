import { describe, expect, it } from 'vitest';
import { sectionSeed } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const base = {
  sectionId: 's1', sectionIndex: 0, label: null, videoStartSeconds: 1, videoEndSeconds: 3,
  metronomeAnchorSeconds: 1, metronomeAnchorQn: 0, tracks: [],
  scoreDocument: { id: 'doc-1', title: 'Live', composer: null, parsedScore: { title: 'Live' } },
  activeTimeMap: { id: 'tm-1', method: 'drag', params: { pps: 40 }, waypoints: [wp(0, 1), wp(4, 3)], nudges: [] },
};

describe('sectionSeed', () => {
  it('opens on the live content when there is no draft', () => {
    const seed = sectionSeed({ ...base, studioDraft: null } as never);
    expect((seed.score as { title: string }).title).toBe('Live');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 1), wp(4, 3)]);
    expect(seed.timing.anchor).toEqual({ seconds: 1, qn: 0 });
    expect(seed.anchorSeconds).toBe(1);
  });
  it('opens on the draft when one exists', () => {
    const timing = { ...EMPTY_TIMING, waypoints: [wp(0, 2), wp(4, 4)], anchor: { seconds: 2, qn: 0 } };
    const seed = sectionSeed({ ...base, studioDraft: { score: { title: 'Draft' }, timing, updatedAt: 'x' } } as never);
    expect((seed.score as { title: string }).title).toBe('Draft');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 2), wp(4, 4)]);
    expect(seed.anchorSeconds).toBe(2);
  });
});
