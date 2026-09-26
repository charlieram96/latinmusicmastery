// Guards the students-read-live-only boundary (spec §9): the class-viewer
// student reader (components/class-viewer/class-item-renderer.tsx) calls
// getScoreSectionsForClassItem directly, with no admin session. getStudioDrafts
// requires admin, so that reader must never reach it — only the admin-only
// getStudioScoreSectionsForClassItem may.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const drafts = vi.hoisted(() => ({ getStudioDrafts: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => drafts);

import { getScoreSectionsForClassItem, getStudioScoreSectionsForClassItem } from '@/app/actions/playsense-studio';

const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Tumbao',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [],
};

function seed() {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{
      id: 'sec-1', section_index: 0, label: null, class_item_id: 'ci-1', score_document_id: 'doc-1',
      active_time_map_id: null, video_start_seconds: null, video_end_seconds: null,
      metronome_anchor_seconds: null, metronome_anchor_qn: null,
    }],
    score_documents: [{ id: 'doc-1', title: 'Tumbao', composer: null, parsed_score: SCORE }],
    score_tracks: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seed();
  drafts.getStudioDrafts.mockResolvedValue({
    data: { 'section:sec-1': { score: { ...SCORE, title: 'Draft' }, timing: { method: 'drag', params: {}, waypoints: [], anchor: null }, updatedAt: 'x' } },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('getScoreSectionsForClassItem (the student reader)', () => {
  it('never calls getStudioDrafts, and leaves studioDraft unset', async () => {
    const res = await getScoreSectionsForClassItem('ci-1');
    expect(res.error).toBeUndefined();
    expect(res.data).toHaveLength(1);
    expect(drafts.getStudioDrafts).not.toHaveBeenCalled();
    expect(res.data![0].studioDraft).toBeUndefined();
  });
});

describe('getStudioScoreSectionsForClassItem (the admin reader)', () => {
  it('fills studioDraft from getStudioDrafts', async () => {
    const res = await getStudioScoreSectionsForClassItem('ci-1');
    expect(res.error).toBeUndefined();
    expect(drafts.getStudioDrafts).toHaveBeenCalledWith([{ kind: 'section', id: 'sec-1' }]);
    expect(res.data![0].studioDraft?.score.title).toBe('Draft');
  });
  it('sets studioDraft to null when there is none', async () => {
    drafts.getStudioDrafts.mockResolvedValue({ data: {} });
    const res = await getStudioScoreSectionsForClassItem('ci-1');
    expect(res.data![0].studioDraft).toBeNull();
  });
  it('propagates the error and skips the drafts call when the section read fails', async () => {
    // Points at a score document that doesn't exist, so fetchScorePayload's
    // single() errors and getScoreSectionsForClassItem fails before any draft
    // is ever looked up.
    h.fake = createFakeSupabase({
      class_item_score_sections: [{
        id: 'sec-1', section_index: 0, label: null, class_item_id: 'ci-1', score_document_id: 'missing-doc',
        active_time_map_id: null, video_start_seconds: null, video_end_seconds: null,
        metronome_anchor_seconds: null, metronome_anchor_qn: null,
      }],
    });
    const res = await getStudioScoreSectionsForClassItem('ci-1');
    expect(res.error).toBeDefined();
    expect(drafts.getStudioDrafts).not.toHaveBeenCalled();
  });
});
