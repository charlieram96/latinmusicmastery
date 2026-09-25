// Server-only helpers for the Studio draft actions. Not a 'use server' module:
// nothing here is callable from the client.
import type { createClient } from '@/lib/supabase/server';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { draftIdsToPrune, unpublishedDraft } from './policy';
import { timingFromLive, type StudioAnchor, type StudioTiming } from './timing';
import type { StudioDraftOwner, VersionMeta } from './types';

type Supa = Awaited<ReturnType<typeof createClient>>;

export interface ResolvedOwner {
  owner: StudioDraftOwner;
  scoreDocumentId: string;
  classItemId: string | null;
  sectionId: string | null;
  /** Which live map pointer timing publishes into; null = no timing (songs). */
  target: 'section' | 'exercise' | 'classItem' | null;
  liveTimeMapId: string | null;
  /** Which anchor action the owner uses; null = no click anchor. */
  anchorKind: 'section' | 'classItem' | null;
  liveAnchor: StudioAnchor | null;
}

const anchorOf = (seconds: number | null, qn: number | null): StudioAnchor | null =>
  seconds == null ? null : { seconds, qn };

export async function resolveOwner(supabase: Supa, owner: StudioDraftOwner): Promise<{ data?: ResolvedOwner; error?: string }> {
  if (owner.kind === 'section') {
    const { data, error } = await supabase
      .from('class_item_score_sections')
      .select('id, class_item_id, score_document_id, active_time_map_id, metronome_anchor_seconds, metronome_anchor_qn')
      .eq('id', owner.id)
      .single();
    if (error || !data) return { error: error?.message ?? 'Section not found' };
    return { data: {
      owner, scoreDocumentId: data.score_document_id, classItemId: data.class_item_id, sectionId: data.id,
      target: 'section', liveTimeMapId: data.active_time_map_id, anchorKind: 'section',
      liveAnchor: anchorOf(data.metronome_anchor_seconds, data.metronome_anchor_qn),
    } };
  }
  if (owner.kind === 'exercise') {
    const { data, error } = await supabase
      .from('class_items')
      .select('id, item_type, score_document_id, active_time_map_id, exercise_time_map_id, metronome_anchor_seconds, metronome_anchor_qn')
      .eq('id', owner.id)
      .single();
    if (error || !data) return { error: error?.message ?? 'Lesson not found' };
    if (!data.score_document_id) return { error: 'No score document attached' };
    const isExercise = data.item_type === 'EXERCISE';
    return { data: {
      owner, scoreDocumentId: data.score_document_id, classItemId: data.id, sectionId: null,
      target: isExercise ? 'exercise' : 'classItem',
      liveTimeMapId: isExercise ? data.exercise_time_map_id : data.active_time_map_id,
      anchorKind: isExercise ? 'classItem' : null,
      liveAnchor: isExercise ? anchorOf(data.metronome_anchor_seconds, data.metronome_anchor_qn) : null,
    } };
  }
  const { data, error } = await supabase.from('play_sense_songs').select('id, score_document_id').eq('id', owner.id).single();
  if (error || !data) return { error: error?.message ?? 'Song not found' };
  return { data: {
    owner, scoreDocumentId: data.score_document_id, classItemId: null, sectionId: null,
    target: null, liveTimeMapId: null, anchorKind: null, liveAnchor: null,
  } };
}

/** What students get today for this owner, in draft form. */
export async function loadLiveContent(supabase: Supa, r: ResolvedOwner): Promise<{ data?: { score: ScoreDocument; timing: StudioTiming }; error?: string }> {
  const { data: doc, error } = await supabase.from('score_documents').select('id, parsed_score').eq('id', r.scoreDocumentId).single();
  if (error || !doc) return { error: error?.message ?? 'Score not found' };
  let map: Parameters<typeof timingFromLive>[0] = null;
  if (r.liveTimeMapId) {
    const { data: tm, error: tmErr } = await supabase.from('score_time_maps').select('id, method, params').eq('id', r.liveTimeMapId).single();
    if (tmErr || !tm) return { error: tmErr?.message ?? 'Time map not found' };
    const { data: wps, error: wpErr } = await supabase
      .from('score_time_waypoints')
      .select('musical_position_qn, video_time_seconds, measure_number, beat_in_measure')
      .eq('time_map_id', r.liveTimeMapId)
      .order('musical_position_qn', { ascending: true });
    if (wpErr) return { error: wpErr.message };
    map = {
      method: tm.method,
      params: (tm.params ?? {}) as Record<string, unknown>,
      waypoints: (wps ?? []).map((w) => ({
        musicalPositionQN: w.musical_position_qn, videoTimeSeconds: w.video_time_seconds,
        measureNumber: w.measure_number, beatInMeasure: w.beat_in_measure,
      })),
    };
  }
  return { data: { score: doc.parsed_score as unknown as ScoreDocument, timing: timingFromLive(map, r.liveAnchor) } };
}

export async function listVersionMeta(supabase: Supa, owner: StudioDraftOwner): Promise<{ data?: VersionMeta[]; error?: string }> {
  const { data, error } = await supabase
    .from('studio_versions')
    .select('id, kind, created_at, updated_at')
    .eq('owner_kind', owner.kind)
    .eq('owner_id', owner.id);
  if (error) return { error: error.message };
  return { data: (data ?? []) as VersionMeta[] };
}

export async function insertVersion(
  supabase: Supa, owner: StudioDraftOwner, kind: 'draft' | 'published',
  content: { score: ScoreDocument; timing: StudioTiming }, userId: string
): Promise<{ data?: { id: string; updatedAt: string }; error?: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('studio_versions')
    .insert({
      owner_kind: owner.kind, owner_id: owner.id, kind,
      score: content.score as never, timing: content.timing as never,
      created_at: now, updated_at: now, created_by: userId,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not save the version' };
  return { data: { id: data.id, updatedAt: now } };
}

export async function pruneDrafts(supabase: Supa, owner: StudioDraftOwner): Promise<void> {
  const meta = await listVersionMeta(supabase, owner);
  const ids = draftIdsToPrune(meta.data ?? []);
  if (ids.length) await supabase.from('studio_versions').delete().in('id', ids);
}

/** Delete the owner's drafts newer than its last publish (discard, replace). */
export async function clearUnpublishedDrafts(supabase: Supa, owner: StudioDraftOwner): Promise<{ error?: string }> {
  const meta = await listVersionMeta(supabase, owner);
  if (meta.error) return { error: meta.error };
  const rows = meta.data ?? [];
  const ids: string[] = [];
  // Peel unpublished drafts off newest-first until none is newer than the last publish.
  let rest = rows;
  for (let d = unpublishedDraft(rest); d; d = unpublishedDraft(rest)) {
    ids.push(d.id);
    rest = rest.filter((r) => r.id !== d!.id);
  }
  if (!ids.length) return {};
  const { error } = await supabase.from('studio_versions').delete().in('id', ids);
  return error ? { error: error.message } : {};
}
