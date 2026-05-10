'use server';

// Compás server actions — score document CRUD, time map publishing, clip management.
//
// Surface lands across milestones:
//   M3: getScoreDocumentForClassItem
//   M5: createClip / listClipsForClassItem / deleteClip
//   M6: createScoreDocumentFromImport / attachScoreToClassItem
//   M7: publishTimeMap (writes score_time_maps + score_time_waypoints)
//   M8: saveScoreDocument / saveScoreRevision

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

// ============================================
// M3 — student player read path
// ============================================

export interface ClassItemScorePayload {
  scoreDocument: {
    id: string;
    title: string;
    composer: string | null;
    parsedScore: ScoreDocument;
  };
  tracks: Array<{
    id: string;
    trackIndex: number;
    instrument: string;
    displayName: string;
    tuning: string[] | null;
    stringMultiplicity: number;
    defaultView: string | null;
  }>;
  activeTimeMap: {
    id: string;
    method: string;
    waypoints: Array<{
      musicalPositionQN: number;
      videoTimeSeconds: number;
      measureNumber: number | null;
      beatInMeasure: number | null;
    }>;
  } | null;
}

export async function getScoreDocumentForClassItem(
  classItemId: string
): Promise<{ data?: ClassItemScorePayload; error?: string }> {
  const supabase = await createClient();

  const { data: item, error: itemErr } = await supabase
    .from('class_items')
    .select('id, score_document_id, active_time_map_id')
    .eq('id', classItemId)
    .single();

  if (itemErr) return { error: itemErr.message };
  if (!item?.score_document_id) return { error: 'No score document attached' };

  const { data: doc, error: docErr } = await supabase
    .from('score_documents')
    .select('id, title, composer, parsed_score')
    .eq('id', item.score_document_id)
    .single();

  if (docErr || !doc) return { error: docErr?.message ?? 'Score not found' };

  const { data: tracks, error: tracksErr } = await supabase
    .from('score_tracks')
    .select('id, track_index, instrument, display_name, tuning, string_multiplicity, default_view')
    .eq('score_document_id', item.score_document_id)
    .order('track_index', { ascending: true });

  if (tracksErr) return { error: tracksErr.message };

  let activeTimeMap: ClassItemScorePayload['activeTimeMap'] = null;
  if (item.active_time_map_id) {
    const { data: tm, error: tmErr } = await supabase
      .from('score_time_maps')
      .select('id, method')
      .eq('id', item.active_time_map_id)
      .single();

    if (tmErr) return { error: tmErr.message };

    const { data: waypoints, error: wpErr } = await supabase
      .from('score_time_waypoints')
      .select('musical_position_qn, video_time_seconds, measure_number, beat_in_measure')
      .eq('time_map_id', item.active_time_map_id)
      .order('musical_position_qn', { ascending: true });

    if (wpErr) return { error: wpErr.message };

    activeTimeMap = {
      id: tm.id,
      method: tm.method,
      waypoints: (waypoints ?? []).map((w) => ({
        musicalPositionQN: w.musical_position_qn,
        videoTimeSeconds: w.video_time_seconds,
        measureNumber: w.measure_number,
        beatInMeasure: w.beat_in_measure,
      })),
    };
  }

  return {
    data: {
      scoreDocument: {
        id: doc.id,
        title: doc.title,
        composer: doc.composer,
        parsedScore: doc.parsed_score as unknown as ScoreDocument,
      },
      tracks: (tracks ?? []).map((t) => ({
        id: t.id,
        trackIndex: t.track_index,
        instrument: t.instrument,
        displayName: t.display_name,
        tuning: t.tuning as string[] | null,
        stringMultiplicity: t.string_multiplicity ?? 1,
        defaultView: t.default_view,
      })),
      activeTimeMap,
    },
  };
}

// ============================================
// M5 — clip CRUD (per-user A/B loop bookmarks)
// ============================================

export interface CompasClip {
  id: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  loopCount: number | null;
  playbackRate: number;
  createdAt: string;
}

export async function createClip(input: {
  classItemId: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  playbackRate?: number;
  loopCount?: number | null;
}): Promise<{ data?: CompasClip; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (input.endSeconds <= input.startSeconds) {
    return { error: 'End must be greater than start' };
  }
  const trimmed = input.name.trim();
  if (!trimmed) return { error: 'Name is required' };

  const { data, error } = await supabase
    .from('score_clips')
    .insert({
      user_id: user.id,
      class_item_id: input.classItemId,
      name: trimmed,
      start_seconds: input.startSeconds,
      end_seconds: input.endSeconds,
      playback_rate: input.playbackRate ?? 1,
      loop_count: input.loopCount ?? null,
    })
    .select('id, name, start_seconds, end_seconds, loop_count, playback_rate, created_at')
    .single();

  if (error || !data) return { error: error?.message ?? 'Insert failed' };

  return {
    data: {
      id: data.id,
      name: data.name,
      startSeconds: data.start_seconds,
      endSeconds: data.end_seconds,
      loopCount: data.loop_count,
      playbackRate: data.playback_rate ?? 1,
      createdAt: data.created_at ?? new Date().toISOString(),
    },
  };
}

export async function listClipsForClassItem(
  classItemId: string
): Promise<{ data?: CompasClip[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('score_clips')
    .select('id, name, start_seconds, end_seconds, loop_count, playback_rate, created_at')
    .eq('user_id', user.id)
    .eq('class_item_id', classItemId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      startSeconds: c.start_seconds,
      endSeconds: c.end_seconds,
      loopCount: c.loop_count,
      playbackRate: c.playback_rate ?? 1,
      createdAt: c.created_at ?? new Date().toISOString(),
    })),
  };
}

export async function deleteClip(
  clipId: string
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('score_clips')
    .delete()
    .eq('id', clipId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

// ============================================
// M6 — admin import (MusicXML / MIDI)
// ============================================

import { parseScoreDocument } from '@/components/compas/shared/score-model/serialization';

export interface AttachScoreFromImportInput {
  classItemId: string;
  /** A ScoreDocument produced by one of the parsers (already validated client-side; we re-validate here). */
  scoreDocument: ScoreDocument;
  /** Original filename — used as the document's title fallback and for audit. */
  sourceFilename?: string;
}

export interface AttachScoreFromImportResult {
  scoreDocumentId?: string;
  error?: string;
}

export async function attachScoreFromImport(
  input: AttachScoreFromImportInput
): Promise<AttachScoreFromImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'Admin only' };

  // Re-validate at the storage boundary. A bad/corrupt payload from the
  // browser shouldn't be able to insert junk JSON into the DB.
  let parsed: ScoreDocument;
  try {
    parsed = parseScoreDocument(input.scoreDocument as unknown);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid score document';
    return { error: `Score validation failed: ${message}` };
  }

  // 1. Insert the score_documents row.
  const { data: doc, error: docErr } = await supabase
    .from('score_documents')
    .insert({
      title: parsed.title,
      composer: parsed.composer ?? null,
      source_format: parsed.sourceFormat,
      parsed_score: parsed as unknown as never,
      schema_version: parsed.schemaVersion,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (docErr || !doc) return { error: docErr?.message ?? 'Insert failed' };

  // 2. Insert score_tracks rows mirroring parsed_score.tracks[].
  if (parsed.tracks.length > 0) {
    const trackRows = parsed.tracks.map((t) => ({
      score_document_id: doc.id,
      track_index: t.index,
      instrument: t.instrument,
      display_name: t.displayName,
      tuning: t.tuning as unknown as never,
      string_multiplicity: t.stringMultiplicity,
      channel: t.channel,
      default_view: t.defaultView,
    }));
    const { error: trackErr } = await supabase
      .from('score_tracks')
      .insert(trackRows);
    if (trackErr) {
      // Best-effort cleanup so we don't leave an orphan score_document row.
      await supabase.from('score_documents').delete().eq('id', doc.id);
      return { error: trackErr.message };
    }
  }

  // 3. Wire to the class_item.
  const { error: linkErr } = await supabase
    .from('class_items')
    .update({ score_document_id: doc.id })
    .eq('id', input.classItemId);
  if (linkErr) return { error: linkErr.message };

  revalidatePath('/dashboard');
  return { scoreDocumentId: doc.id };
}

// ============================================
// M7 — sync (publishing time maps)
// ============================================

export type CompasSyncMethod = 'tempo' | 'tap' | 'drag' | 'midi';

export interface PublishTimeMapInput {
  classItemId: string;
  scoreDocumentId: string;
  method: CompasSyncMethod;
  /** Method-specific parameters (e.g. {bpm, offset_seconds} for 'tempo'). */
  params: Record<string, unknown>;
  waypoints: Array<{
    musicalPositionQN: number;
    videoTimeSeconds: number;
    measureNumber: number | null;
    beatInMeasure: number | null;
  }>;
  /** When true, also set this class_item's active_time_map_id to the new map. */
  makeActive?: boolean;
}

export async function publishTimeMap(
  input: PublishTimeMapInput
): Promise<{ timeMapId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'Admin only' };

  if (input.waypoints.length < 2) {
    return { error: 'Need at least two waypoints to publish a time map.' };
  }

  // Strict-monotonic check on both axes — the player relies on this.
  const sorted = [...input.waypoints].sort(
    (a, b) => a.musicalPositionQN - b.musicalPositionQN
  );
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].musicalPositionQN <= sorted[i - 1].musicalPositionQN) {
      return { error: 'Waypoints have duplicate musical positions.' };
    }
    if (sorted[i].videoTimeSeconds <= sorted[i - 1].videoTimeSeconds) {
      return { error: 'Waypoints must be strictly increasing in video time.' };
    }
  }

  // 1. Insert the time map header.
  const { data: tmRow, error: tmErr } = await supabase
    .from('score_time_maps')
    .insert({
      score_document_id: input.scoreDocumentId,
      class_item_id: input.classItemId,
      method: input.method,
      params: input.params as unknown as never,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (tmErr || !tmRow) return { error: tmErr?.message ?? 'Insert failed' };

  // 2. Insert waypoints.
  const waypointRows = sorted.map((w) => ({
    time_map_id: tmRow.id,
    musical_position_qn: w.musicalPositionQN,
    video_time_seconds: w.videoTimeSeconds,
    measure_number: w.measureNumber,
    beat_in_measure: w.beatInMeasure,
  }));
  const { error: wpErr } = await supabase
    .from('score_time_waypoints')
    .insert(waypointRows);
  if (wpErr) {
    await supabase.from('score_time_maps').delete().eq('id', tmRow.id);
    return { error: wpErr.message };
  }

  // 3. Optionally point the class_item at this new map.
  if (input.makeActive ?? true) {
    const { error: linkErr } = await supabase
      .from('class_items')
      .update({ active_time_map_id: tmRow.id })
      .eq('id', input.classItemId);
    if (linkErr) return { error: linkErr.message };
  }

  revalidatePath('/dashboard');
  return { timeMapId: tmRow.id };
}

// ============================================
// M8 — score document save (visual editor)
// ============================================

export async function saveScoreDocument(input: {
  scoreDocumentId: string;
  scoreDocument: ScoreDocument;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'Admin only' };

  // Re-validate at the storage boundary.
  let parsed: ScoreDocument;
  try {
    parsed = parseScoreDocument(input.scoreDocument as unknown);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid score document';
    return { error: `Score validation failed: ${message}` };
  }

  // Update the score_documents row.
  const { error: updErr } = await supabase
    .from('score_documents')
    .update({
      title: parsed.title,
      composer: parsed.composer ?? null,
      parsed_score: parsed as unknown as never,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.scoreDocumentId);
  if (updErr) return { error: updErr.message };

  // Resync score_tracks rows. Simple approach: delete all and re-insert
  // matching the new parsed_score.tracks[]. This keeps row IDs unstable
  // across edits, which is fine in v1 because we don't use them as keys
  // outside the score itself.
  await supabase.from('score_tracks').delete().eq('score_document_id', input.scoreDocumentId);
  if (parsed.tracks.length > 0) {
    const trackRows = parsed.tracks.map((t) => ({
      score_document_id: input.scoreDocumentId,
      track_index: t.index,
      instrument: t.instrument,
      display_name: t.displayName,
      tuning: t.tuning as unknown as never,
      string_multiplicity: t.stringMultiplicity,
      channel: t.channel,
      default_view: t.defaultView,
    }));
    const { error: trkErr } = await supabase.from('score_tracks').insert(trackRows);
    if (trkErr) return { error: trkErr.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function detachScoreFromClassItem(
  classItemId: string
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'Admin only' };

  const { error } = await supabase
    .from('class_items')
    .update({ score_document_id: null, active_time_map_id: null })
    .eq('id', classItemId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}
