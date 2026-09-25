import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const score = { title: 'Live' } as never;
const exMap = { id: 'ex', method: 'drag', params: {}, waypoints: [wp(0, 0.5), wp(4, 2.5)], nudges: [] };
const media = { videoUrl: 'v', videoStartSeconds: 0, videoTrimOutSeconds: null, metronomeAnchorSeconds: 0.5, metronomeAnchorQn: 0, timeMap: exMap, backingTracks: [] };

describe('workspaceSeed', () => {
  it('exercise timing comes from the play-along map and the class item anchor', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'exercise', initialScore: score, activeTimeMap: null, exerciseMedia: media as never });
    expect(s.timing.waypoints).toEqual(exMap.waypoints);
    // qn is carried too, so an untouched seed anchor matches live exactly (no
    // phantom "Click anchor changed", and publish leaves it alone).
    expect(s.timing.anchor).toEqual({ seconds: 0.5, qn: 0 });
  });
  it('a legacy single-score lesson uses its active map and no anchor', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'video', initialScore: score, activeTimeMap: exMap as never });
    expect(s.timing.waypoints).toEqual(exMap.waypoints);
    expect(s.timing.anchor).toBeNull();
  });
  it('a song has no timing, and a draft wins over live', () => {
    const song = { kind: 'song' as const, songId: 's', difficulty: 'beginner' as const, isPublished: true, trackIndex: 0 };
    expect(workspaceSeed({ owner: song, mode: 'video', initialScore: score, activeTimeMap: null }).timing).toEqual(EMPTY_TIMING);
    const d = workspaceSeed({ owner: song, mode: 'video', initialScore: score, activeTimeMap: null, studioDraft: { score: { title: 'Draft' } as never, timing: EMPTY_TIMING, updatedAt: 'x' } });
    expect((d.score as unknown as { title: string }).title).toBe('Draft');
  });
});
