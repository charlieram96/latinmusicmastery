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
