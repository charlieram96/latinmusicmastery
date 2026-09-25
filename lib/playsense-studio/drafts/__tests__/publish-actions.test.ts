import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import { EMPTY_TIMING, type StudioTiming } from '../timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const live = vi.hoisted(() => ({
  saveScoreDocument: vi.fn(), publishTimeMap: vi.fn(), setSectionMetronomeAnchor: vi.fn(), setClassItemMetronomeAnchor: vi.fn(),
}));
vi.mock('@/app/actions/playsense-studio', () => live);

import { getPublishPreview, publishStudioDraft } from '@/app/actions/studio-drafts';

const T0 = Date.parse('2026-09-25T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
// The brief's minimal SCORE doesn't pass parseScoreDocument (initialTimeSignature
// isn't a tuple, and sourceFormat/initialKeyFifths/track fields are missing), so
// this is the same valid shape draft-actions.test.ts uses, with the title
// overridden to 'Tumbao' as the brief's fallback note says.
const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Tumbao',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'bass', displayName: 'Bass', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [] }],
};
const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const TIMED: StudioTiming = { method: 'drag', params: { nudges: [] }, waypoints: [wp(0, 1), wp(4, 3)], anchor: { seconds: 1, qn: 0 } };
const section = { kind: 'section' as const, id: 'sec-1' };

function seed(draft: { score?: object; timing?: StudioTiming }, liveMap = true) {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{ id: 'sec-1', class_item_id: 'ci-1', score_document_id: 'doc-1', active_time_map_id: liveMap ? 'tm-1' : null, metronome_anchor_seconds: 1, metronome_anchor_qn: 0 }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    score_time_maps: [{ id: 'tm-1', method: 'drag', params: { nudges: [] } }],
    score_time_waypoints: [
      { time_map_id: 'tm-1', musical_position_qn: 0, video_time_seconds: 1, measure_number: null, beat_in_measure: null },
      { time_map_id: 'tm-1', musical_position_qn: 4, video_time_seconds: 3, measure_number: null, beat_in_measure: null },
    ],
    studio_versions: [{ id: 'd1', owner_kind: 'section', owner_id: 'sec-1', kind: 'draft', score: draft.score ?? SCORE, timing: draft.timing ?? TIMED, created_at: at(-1000), updated_at: at(-1000), created_by: 'admin-1' }],
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  live.saveScoreDocument.mockResolvedValue({ success: true });
  live.publishTimeMap.mockResolvedValue({ timeMapId: 'tm-2' });
  live.setSectionMetronomeAnchor.mockResolvedValue({ data: {} });
});
afterEach(() => vi.useRealTimers());

describe('publishStudioDraft', () => {
  it('writes only what changed: a score-only edit mints no time map', async () => {
    seed({ score: { ...SCORE, title: 'New' } });
    const res = await publishStudioDraft(section);
    expect(res.error).toBeUndefined();
    expect(live.saveScoreDocument).toHaveBeenCalledWith({ scoreDocumentId: 'doc-1', scoreDocument: expect.objectContaining({ title: 'New' }) });
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
    const pubs = h.fake!.tables.studio_versions.filter((r) => r.kind === 'published');
    expect(pubs).toHaveLength(1);
  });
  it('publishes timing through publishTimeMap into the section, then the anchor', async () => {
    seed({ timing: { ...TIMED, waypoints: [wp(0, 1.2), wp(4, 3.2)], anchor: { seconds: 1.2, qn: 0 } } });
    await publishStudioDraft(section);
    expect(live.publishTimeMap).toHaveBeenCalledWith(expect.objectContaining({
      classItemId: 'ci-1', scoreDocumentId: 'doc-1', sectionId: 'sec-1', target: 'section', method: 'drag', makeActive: true,
      waypoints: [wp(0, 1.2), wp(4, 3.2)],
    }));
    expect(live.setSectionMetronomeAnchor).toHaveBeenCalledWith({ sectionId: 'sec-1', anchorSeconds: 1.2, anchorQn: 0 });
    expect(live.publishTimeMap.mock.invocationCallOrder[0]).toBeLessThan(live.setSectionMetronomeAnchor.mock.invocationCallOrder[0]);
  });
  it('writes nothing live and records no publish when the time map is refused', async () => {
    seed({ score: { ...SCORE, title: 'New' }, timing: { ...TIMED, waypoints: [wp(0, 5), wp(4, 7)] } });
    live.publishTimeMap.mockResolvedValue({ error: 'This sync overlaps the section "Intro".' });
    const res = await publishStudioDraft(section);
    expect(res.error).toBe('This sync overlaps the section "Intro".');
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
    expect(h.fake!.tables.studio_versions.filter((r) => r.kind === 'published')).toHaveLength(0);
  });
  it('skips timing with fewer than two waypoints', async () => {
    seed({ score: { ...SCORE, title: 'New' }, timing: EMPTY_TIMING }, false);
    await publishStudioDraft(section);
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.saveScoreDocument).toHaveBeenCalled();
  });
  it('says there is nothing to publish when no draft is newer than the last publish', async () => {
    seed({});
    h.fake!.tables.studio_versions.push({ id: 'p1', owner_kind: 'section', owner_id: 'sec-1', kind: 'published', score: SCORE, timing: TIMED, created_at: at(0), updated_at: at(0), created_by: 'admin-1' });
    expect((await publishStudioDraft(section)).error).toBe('Nothing to publish');
  });
});

describe('getPublishPreview', () => {
  it('summarises each unpublished owner against live', async () => {
    seed({ score: { ...SCORE, title: 'New' } });
    const res = await getPublishPreview([section]);
    expect(res.data).toEqual({ 'section:sec-1': ['Title changed'] });
  });
});
