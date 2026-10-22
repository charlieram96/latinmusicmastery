import { expect, it } from 'vitest';
import { previewPayload, previewSection } from '../drafts/preview-payload';
import { GUITAR_LICK_FIXTURE } from '../score-fixtures';
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio';
import type { StudioDraft } from '@/app/actions/studio-drafts';

const live: ClassItemScoreSection = {
  scoreDocument: { id: 'score', title: 'Live', composer: null, parsedScore: { ...GUITAR_LICK_FIXTURE, initialTempo: 100 } },
  tracks: [], activeTimeMap: null, sectionId: 'section', sectionIndex: 0, label: null,
  videoStartSeconds: null, videoEndSeconds: null, metronomeAnchorSeconds: null, metronomeAnchorQn: null,
};
const draft: StudioDraft = {
  score: { ...GUITAR_LICK_FIXTURE, initialTempo: 151 }, updatedAt: '',
  timing: { method: 'drag', params: { nudges: [{ qn: 7.5, deltaSeconds: 0.12 }] },
    anchor: { seconds: 3, qn: 0 }, waypoints: [
      { musicalPositionQN: 0, videoTimeSeconds: 3, measureNumber: 1, beatInMeasure: 1 },
      { musicalPositionQN: 8, videoTimeSeconds: 6.18, measureNumber: 3, beatInMeasure: 1 },
    ] },
};

it('previews the authored tempo with its own timing, preserving the published source', () => {
  const result = previewSection(live, draft);
  expect(result.scoreDocument.parsedScore.initialTempo).toBe(151);
  expect(result.activeTimeMap?.waypoints).toEqual(draft.timing.waypoints);
  expect(result.activeTimeMap?.nudges).toEqual(draft.timing.params.nudges);
  expect([result.videoStartSeconds, result.videoEndSeconds]).toEqual([3, 6.18]);
  expect(result.metronomeAnchorSeconds).toBe(3);
  expect(live.scoreDocument.parsedScore.initialTempo).toBe(100);
  expect(live.activeTimeMap).toBeNull();
});

it('keeps published content unchanged when no authorized local draft exists', () => {
  expect(previewPayload(live)).toBe(live);
  expect(previewSection(live)).toBe(live);
});
