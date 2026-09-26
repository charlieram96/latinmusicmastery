import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const score = { title: 'Live' } as never;
const exMap = { id: 'ex', method: 'drag', params: {}, waypoints: [wp(0, 0.5), wp(4, 2.5)], nudges: [] };
const play = { bar1Seconds: 1.2, countInBars: 2 as const, preroll: false };
const media = { videoUrl: 'v', videoStartSeconds: 0, videoTrimOutSeconds: null, metronomeAnchorSeconds: 0.5, metronomeAnchorQn: 0, timeMap: exMap, backingTracks: [], play };

describe('workspaceSeed', () => {
  // Studio rework P5: 'exercise' mode is the graded workspace (EXERCISE and
  // JAM_SESSION items alike). Bar 1 places the media now, so there's no time
  // map or click anchor to seed — only the play-along settings.
  it('a graded (exercise/jam) owner has no waypoints or anchor to seed', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'exercise', initialScore: score, activeTimeMap: null, exerciseMedia: media as never });
    expect(s.timing.waypoints).toEqual([]);
    expect(s.timing.anchor).toBeNull();
    expect(s.timeMap).toBeNull();
  });
  it('a graded owner seeds timing.play from the exercise media', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'exercise', initialScore: score, activeTimeMap: null, exerciseMedia: media as never });
    expect(s.timing.play).toEqual(play);
  });
  it('a graded owner with no media yet seeds no play settings', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'exercise', initialScore: score, activeTimeMap: null, exerciseMedia: null });
    expect(s.timing.play).toBeUndefined();
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
