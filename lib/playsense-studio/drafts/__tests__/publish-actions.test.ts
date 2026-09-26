import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import { EMPTY_TIMING, type StudioTiming } from '../timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const live = vi.hoisted(() => ({
  saveScoreDocument: vi.fn(), publishTimeMap: vi.fn(), setSectionMetronomeAnchor: vi.fn(),
  setClassItemMetronomeAnchor: vi.fn(), setPlaySettings: vi.fn(),
}));
vi.mock('@/app/actions/playsense-studio', () => live);

import { getPublishPreview, publishStudioDraft } from '@/app/actions/studio-drafts';
import { resolveOwner } from '@/lib/playsense-studio/drafts/server';

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
// A graded owner's draft: no waypoints (bar 1 places the media, not a map).
const GRADED_TIMED: StudioTiming = { ...EMPTY_TIMING, play: { bar1Seconds: 1, countInBars: 1, preroll: true } };
const section = { kind: 'section' as const, id: 'sec-1' };

function seed(
  draft: { score?: object; timing?: StudioTiming },
  liveMap = true,
  liveAnchor: { seconds: number; qn: number } | null = { seconds: 1, qn: 0 }
) {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{ id: 'sec-1', class_item_id: 'ci-1', score_document_id: 'doc-1', active_time_map_id: liveMap ? 'tm-1' : null, metronome_anchor_seconds: liveAnchor?.seconds ?? null, metronome_anchor_qn: liveAnchor?.qn ?? null }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    score_time_maps: [{ id: 'tm-1', method: 'drag', params: { nudges: [] } }],
    score_time_waypoints: [
      { time_map_id: 'tm-1', musical_position_qn: 0, video_time_seconds: 1, measure_number: null, beat_in_measure: null },
      { time_map_id: 'tm-1', musical_position_qn: 4, video_time_seconds: 3, measure_number: null, beat_in_measure: null },
    ],
    studio_versions: [{ id: 'd1', owner_kind: 'section', owner_id: 'sec-1', kind: 'draft', score: draft.score ?? SCORE, timing: draft.timing ?? TIMED, created_at: at(-1000), updated_at: at(-1000), created_by: 'admin-1' }],
  });
}

/** An EXERCISE class item, its own score/timing owner (no section). */
function seedExercise(draft: { score?: object; timing?: StudioTiming }) {
  h.fake = createFakeSupabase({
    class_items: [{ id: 'ci-1', item_type: 'EXERCISE', score_document_id: 'doc-1', active_time_map_id: null, exercise_time_map_id: 'tm-1', metronome_anchor_seconds: 1, metronome_anchor_qn: 0 }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    score_time_maps: [{ id: 'tm-1', method: 'drag', params: { nudges: [] } }],
    score_time_waypoints: [
      { time_map_id: 'tm-1', musical_position_qn: 0, video_time_seconds: 1, measure_number: null, beat_in_measure: null },
      { time_map_id: 'tm-1', musical_position_qn: 4, video_time_seconds: 3, measure_number: null, beat_in_measure: null },
    ],
    studio_versions: [{ id: 'd1', owner_kind: 'exercise', owner_id: 'ci-1', kind: 'draft', score: draft.score ?? SCORE, timing: draft.timing ?? TIMED, created_at: at(-1000), updated_at: at(-1000), created_by: 'admin-1' }],
  });
}

/** A graded (EXERCISE or JAM_SESSION) class item, its own score owner, played
 *  by bar 1 instead of a time map — no exercise_time_map_id or anchor. */
function seedGraded(
  itemType: 'EXERCISE' | 'JAM_SESSION',
  draft: { score?: object; timing?: StudioTiming },
  livePlay: { bar1Seconds: number | null; countInBars: 1 | 2; preroll: boolean } = { bar1Seconds: 1, countInBars: 1, preroll: true }
) {
  h.fake = createFakeSupabase({
    class_items: [{
      id: 'ci-1', item_type: itemType, score_document_id: 'doc-1', active_time_map_id: null, exercise_time_map_id: null,
      metronome_anchor_seconds: null, metronome_anchor_qn: null,
      play_bar1_seconds: livePlay.bar1Seconds, play_count_in_bars: livePlay.countInBars, play_preroll: livePlay.preroll,
    }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    studio_versions: [{ id: 'd1', owner_kind: 'exercise', owner_id: 'ci-1', kind: 'draft', score: draft.score ?? SCORE, timing: draft.timing ?? GRADED_TIMED, created_at: at(-1000), updated_at: at(-1000), created_by: 'admin-1' }],
  });
}

/** Simulates the real setPlaySettings: writes the three columns straight into
 *  the fake class_items row, so a post-publish re-read observes the write. */
function fakeSetPlaySettingsIntoClassItem() {
  live.setPlaySettings.mockImplementation(async (input: { classItemId: string; bar1Seconds: number | null; countInBars: 1 | 2; preroll: boolean }) => {
    const row = h.fake!.tables.class_items.find((r) => r.id === input.classItemId)!;
    row.play_bar1_seconds = input.bar1Seconds;
    row.play_count_in_bars = input.countInBars;
    row.play_preroll = input.preroll;
    return { success: true };
  });
}

/** Simulates the real publishTimeMap: mints a new live map, points the section
 *  at it, and (optionally) rebases/seeds its live anchor — the side effects
 *  publishStudioDraft's post-publish re-read needs to observe. */
function fakePublishTimeMapIntoSection(newAnchor?: { seconds: number; qn: number } | null) {
  live.publishTimeMap.mockImplementation(async (input: { waypoints: Array<Record<string, unknown>> }) => {
    h.fake!.tables.score_time_maps.push({ id: 'tm-2', method: 'drag', params: { nudges: [] } });
    h.fake!.tables.score_time_waypoints.push(
      ...input.waypoints.map((w) => ({
        time_map_id: 'tm-2', musical_position_qn: w.musicalPositionQN, video_time_seconds: w.videoTimeSeconds,
        measure_number: w.measureNumber, beat_in_measure: w.beatInMeasure,
      }))
    );
    const sec = h.fake!.tables.class_item_score_sections.find((r) => r.id === 'sec-1')!;
    sec.active_time_map_id = 'tm-2';
    if (newAnchor !== undefined) {
      sec.metronome_anchor_seconds = newAnchor?.seconds ?? null;
      sec.metronome_anchor_qn = newAnchor?.qn ?? null;
    }
    return { timeMapId: 'tm-2' };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  live.saveScoreDocument.mockResolvedValue({ success: true });
  live.publishTimeMap.mockResolvedValue({ timeMapId: 'tm-2' });
  live.setSectionMetronomeAnchor.mockResolvedValue({ data: {} });
  live.setClassItemMetronomeAnchor.mockResolvedValue({ data: {} });
  live.setPlaySettings.mockResolvedValue({ success: true });
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
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
  });
  it('leaves an untouched anchor to the rebase publishTimeMap did, and records the rebased one', async () => {
    // Draft anchor equals the PRE-publish live anchor (1, 0): the seed copied it
    // and the admin never moved it. The timing changed, so publishTimeMap runs,
    // and its mock rebases the live anchor to (9, 0). Writing the draft's stale
    // (1, 0) back would undo that rebase and drift the students' click.
    seed({ timing: { ...TIMED, waypoints: [wp(0, 1.5), wp(4, 3.5)], anchor: { seconds: 1, qn: 0 } } }, true, { seconds: 1, qn: 0 });
    fakePublishTimeMapIntoSection({ seconds: 9, qn: 0 });
    await publishStudioDraft(section);
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
    const [pub] = h.fake!.tables.studio_versions.filter((r) => r.kind === 'published');
    expect((pub.timing as StudioTiming).anchor).toEqual({ seconds: 9, qn: 0 });
  });
  it('writes a touched anchor after the timing publish, even when publishTimeMap rebased it', async () => {
    seed({ timing: { ...TIMED, waypoints: [wp(0, 1.5), wp(4, 3.5)], anchor: { seconds: 2.5, qn: 4 } } }, true, { seconds: 1, qn: 0 });
    fakePublishTimeMapIntoSection({ seconds: 9, qn: 0 });
    await publishStudioDraft(section);
    expect(live.setSectionMetronomeAnchor).toHaveBeenCalledWith({ sectionId: 'sec-1', anchorSeconds: 2.5, anchorQn: 4 });
    expect(live.publishTimeMap.mock.invocationCallOrder[0]).toBeLessThan(live.setSectionMetronomeAnchor.mock.invocationCallOrder[0]);
  });
  it('never writes a null draft anchor, but records the live-seeded one in the published row', async () => {
    seed({ timing: { ...TIMED, waypoints: [wp(0, 1.5), wp(4, 3.5)], anchor: null } }, true, null);
    fakePublishTimeMapIntoSection({ seconds: 2, qn: 0 });
    await publishStudioDraft(section);
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
    const [pub] = h.fake!.tables.studio_versions.filter((r) => r.kind === 'published');
    expect((pub.timing as StudioTiming).anchor).toEqual({ seconds: 2, qn: 0 });
  });
  // Studio rework P5: EXERCISE items are graded now (target 'graded', not
  // 'exercise') — publish never touches the legacy exercise time map or its
  // class-item anchor, even when the draft still carries stale waypoints/anchor
  // from before the rework. This test used to assert the retired behaviour
  // (publishing through the 'exercise' target); fixed to match the new spec —
  // see lib/playsense-studio/drafts/server.ts's resolveOwner.
  it('an EXERCISE owner is graded: publish skips the legacy exercise time map and its class-item anchor', async () => {
    const exercise = { kind: 'exercise' as const, id: 'ci-1' };
    seedExercise({ timing: { ...TIMED, waypoints: [wp(0, 1.2), wp(4, 3.2)], anchor: { seconds: 1.2, qn: 0 } } });
    const res = await publishStudioDraft(exercise);
    expect(res.error).toBeUndefined();
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.setClassItemMetronomeAnchor).not.toHaveBeenCalled();
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
  });
  it('says timing is live but asks to press Publish again when the score save fails after it', async () => {
    seed({ score: { ...SCORE, title: 'New' }, timing: { ...TIMED, waypoints: [wp(0, 1.5), wp(4, 3.5)] } });
    live.saveScoreDocument.mockResolvedValue({ error: 'Could not reach the database' });
    const res = await publishStudioDraft(section);
    expect(res.error).toBe('Timing is live, but the score could not be saved: Could not reach the database. Press Publish again.');
    expect(h.fake!.tables.studio_versions.filter((r) => r.kind === 'published')).toHaveLength(0);
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
  it('publishes a graded EXERCISE owner: writes the play columns and skips the time map and anchor entirely', async () => {
    const exercise = { kind: 'exercise' as const, id: 'ci-1' };
    seedGraded('EXERCISE', { timing: { ...GRADED_TIMED, play: { bar1Seconds: 3.4, countInBars: 2, preroll: false } } });
    fakeSetPlaySettingsIntoClassItem();
    const res = await publishStudioDraft(exercise);
    expect(res.error).toBeUndefined();
    expect(live.setPlaySettings).toHaveBeenCalledWith({ classItemId: 'ci-1', bar1Seconds: 3.4, countInBars: 2, preroll: false });
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.setClassItemMetronomeAnchor).not.toHaveBeenCalled();
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
    const [pub] = h.fake!.tables.studio_versions.filter((r) => r.kind === 'published');
    expect((pub.timing as StudioTiming).play).toEqual({ bar1Seconds: 3.4, countInBars: 2, preroll: false });
  });
  it('publishes a graded JAM_SESSION owner the same way', async () => {
    const exercise = { kind: 'exercise' as const, id: 'ci-1' };
    seedGraded('JAM_SESSION', { timing: { ...GRADED_TIMED, play: { bar1Seconds: 0.5, countInBars: 1, preroll: true } } }, { bar1Seconds: null, countInBars: 2, preroll: false });
    fakeSetPlaySettingsIntoClassItem();
    await publishStudioDraft(exercise);
    expect(live.setPlaySettings).toHaveBeenCalledWith({ classItemId: 'ci-1', bar1Seconds: 0.5, countInBars: 1, preroll: true });
    expect(live.publishTimeMap).not.toHaveBeenCalled();
  });
  it('a play-only change (score and play settings both unchanged except play) still publishes the columns', async () => {
    const exercise = { kind: 'exercise' as const, id: 'ci-1' };
    // Live play is (1, 1, true) — same as seedGraded's default. Only preroll differs in the draft.
    seedGraded('EXERCISE', { timing: { ...GRADED_TIMED, play: { bar1Seconds: 1, countInBars: 1, preroll: false } } });
    fakeSetPlaySettingsIntoClassItem();
    const res = await publishStudioDraft(exercise);
    expect(res.error).toBeUndefined();
    expect(live.setPlaySettings).toHaveBeenCalledWith({ classItemId: 'ci-1', bar1Seconds: 1, countInBars: 1, preroll: false });
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
  });
  it('writes no play columns when the draft play settings match live', async () => {
    const exercise = { kind: 'exercise' as const, id: 'ci-1' };
    seedGraded('EXERCISE', { timing: GRADED_TIMED });
    await publishStudioDraft(exercise);
    expect(live.setPlaySettings).not.toHaveBeenCalled();
  });
});

describe('resolveOwner — graded owners (Studio rework P5)', () => {
  it('returns target "graded" with no time map or anchor for an EXERCISE item', async () => {
    seedGraded('EXERCISE', {}, { bar1Seconds: 2.2, countInBars: 2, preroll: false });
    const res = await resolveOwner(h.fake!.client as unknown as Parameters<typeof resolveOwner>[0], { kind: 'exercise', id: 'ci-1' });
    expect(res.error).toBeUndefined();
    expect(res.data).toMatchObject({
      target: 'graded', liveTimeMapId: null, anchorKind: null, liveAnchor: null,
      livePlay: { bar1Seconds: 2.2, countInBars: 2, preroll: false },
    });
  });
  it('returns target "graded" with no time map or anchor for a JAM_SESSION item', async () => {
    seedGraded('JAM_SESSION', {}, { bar1Seconds: null, countInBars: 1, preroll: true });
    const res = await resolveOwner(h.fake!.client as unknown as Parameters<typeof resolveOwner>[0], { kind: 'exercise', id: 'ci-1' });
    expect(res.error).toBeUndefined();
    expect(res.data).toMatchObject({
      target: 'graded', liveTimeMapId: null, anchorKind: null, liveAnchor: null,
      livePlay: { bar1Seconds: null, countInBars: 1, preroll: true },
    });
  });
  it('keeps target "classItem" for a legacy single-score class item, with no play settings', async () => {
    h.fake = createFakeSupabase({
      class_items: [{
        id: 'ci-1', item_type: 'VIDEO', score_document_id: 'doc-1', active_time_map_id: 'tm-9', exercise_time_map_id: null,
        metronome_anchor_seconds: null, metronome_anchor_qn: null,
      }],
    });
    const res = await resolveOwner(h.fake!.client as unknown as Parameters<typeof resolveOwner>[0], { kind: 'exercise', id: 'ci-1' });
    expect(res.error).toBeUndefined();
    expect(res.data).toMatchObject({ target: 'classItem', liveTimeMapId: 'tm-9', anchorKind: null, livePlay: null });
  });
});

describe('getPublishPreview', () => {
  it('summarises each unpublished owner against live', async () => {
    seed({ score: { ...SCORE, title: 'New' } });
    const res = await getPublishPreview([section]);
    expect(res.data).toEqual({ 'section:sec-1': ['Title changed'] });
  });
});
