import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import { EMPTY_TIMING } from '../timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const live = vi.hoisted(() => ({
  saveScoreDocument: vi.fn(), publishTimeMap: vi.fn(), setSectionMetronomeAnchor: vi.fn(), setClassItemMetronomeAnchor: vi.fn(),
}));
vi.mock('@/app/actions/playsense-studio', () => live);

import {
  discardStudioDraft, getStudioDrafts, listStudioVersions, restoreStudioVersion, saveStudioDraft,
} from '@/app/actions/studio-drafts';

const T0 = Date.parse('2026-09-25T10:00:00.000Z');
// The brief's minimal SCORE doesn't pass parseScoreDocument (initialTimeSignature
// isn't a tuple, and sourceFormat/initialKeyFifths/track fields are missing), so
// this is built the way the repo's blank-score factory
// (app/actions/playsense-studio.ts's buildBlankScore) shapes one, with the title
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
const section = { kind: 'section' as const, id: 'sec-1' };

function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{ id: 'sec-1', class_item_id: 'ci-1', score_document_id: 'doc-1', active_time_map_id: null, metronome_anchor_seconds: null, metronome_anchor_qn: null }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    studio_versions: [],
    ...extra,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  seed();
});
afterEach(() => vi.useRealTimers());

describe('saveStudioDraft', () => {
  it('writes a draft row and never touches the live rows', async () => {
    const res = await saveStudioDraft({ owner: section, score: SCORE, timing: EMPTY_TIMING });
    expect(res.error).toBeUndefined();
    const rows = h.fake!.tables.studio_versions;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ owner_kind: 'section', owner_id: 'sec-1', kind: 'draft', created_by: 'admin-1' });
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
  });
  it('updates the same row within a minute and adds a row after it', async () => {
    await saveStudioDraft({ owner: section, score: SCORE, timing: EMPTY_TIMING });
    vi.setSystemTime(T0 + 30_000);
    await saveStudioDraft({ owner: section, score: { ...SCORE, title: 'B' }, timing: EMPTY_TIMING });
    expect(h.fake!.tables.studio_versions).toHaveLength(1);
    expect((h.fake!.tables.studio_versions[0].score as { title: string }).title).toBe('B');
    vi.setSystemTime(T0 + 61_000);
    await saveStudioDraft({ owner: section, score: SCORE, timing: EMPTY_TIMING });
    expect(h.fake!.tables.studio_versions).toHaveLength(2);
  });
  it('rejects a non-admin and an invalid score', async () => {
    h.fake = createFakeSupabase({ studio_versions: [] }, { isAdmin: false });
    expect((await saveStudioDraft({ owner: section, score: SCORE, timing: EMPTY_TIMING })).error).toBe('Admin only');
    seed();
    expect((await saveStudioDraft({ owner: section, score: { nope: true } as never, timing: EMPTY_TIMING })).error).toBeTruthy();
    expect(h.fake!.tables.studio_versions).toHaveLength(0);
  });
});

describe('reading, restoring and discarding drafts', () => {
  const at = (ms: number) => new Date(T0 + ms).toISOString();
  const v = (id: string, kind: string, ms: number, title: string) => ({
    id, owner_kind: 'section', owner_id: 'sec-1', kind, score: { ...SCORE, title }, timing: EMPTY_TIMING, created_at: at(ms), updated_at: at(ms), created_by: 'admin-1',
  });

  it('returns only unpublished drafts, keyed by owner', async () => {
    seed({ studio_versions: [v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await getStudioDrafts([section, { kind: 'section', id: 'sec-2' }]);
    expect(Object.keys(res.data!)).toEqual(['section:sec-1']);
    expect(res.data!['section:sec-1'].score.title).toBe('Draft');
  });
  it('lists versions newest first with the live one marked', async () => {
    seed({ studio_versions: [v('p0', 'published', -9000, 'Old'), v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await listStudioVersions(section);
    expect(res.data!.map((r) => [r.id, r.kind, r.isLive])).toEqual([
      ['d1', 'draft', false], ['p1', 'published', true], ['p0', 'published', false],
    ]);
  });
  it('restores a version as a new draft without touching live', async () => {
    seed({ studio_versions: [v('p0', 'published', -9000, 'Old'), v('p1', 'published', -5000, 'Live')] });
    const res = await restoreStudioVersion({ owner: section, versionId: 'p0' });
    expect(res.data!.score.title).toBe('Old');
    const drafts = h.fake!.tables.studio_versions.filter((r) => r.kind === 'draft');
    expect(drafts).toHaveLength(1);
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
  });
  it('refuses to restore another owner\'s version', async () => {
    seed({ studio_versions: [{ ...v('x', 'published', -9000, 'Other'), owner_id: 'sec-9' }] });
    expect((await restoreStudioVersion({ owner: section, versionId: 'x' })).error).toBe('Version not found');
  });
  it('discards unpublished drafts, keeps history, and returns the live content', async () => {
    seed({ studio_versions: [v('d0', 'draft', -9000, 'Older draft'), v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await discardStudioDraft(section);
    expect(h.fake!.tables.studio_versions.map((r) => r.id).sort()).toEqual(['d0', 'p1']);
    expect(res.data!.score.title).toBe('Tumbao');
    expect(res.data!.timing).toEqual(EMPTY_TIMING);
  });
  it('returns an error for an unknown owner instead of a silent null', async () => {
    const res = await discardStudioDraft({ kind: 'section', id: 'nope' });
    expect(res.data).toBeUndefined();
    expect(res.error).toBeTruthy();
  });
  it('rejects a non-admin', async () => {
    h.fake = createFakeSupabase({ studio_versions: [] }, { isAdmin: false });
    expect((await discardStudioDraft(section)).error).toBe('Admin only');
  });
});
