'use server';

// PlaySense Studio server actions — score document CRUD, time map publishing, clip management.
//
// Surface lands across milestones:
//   M3: getScoreDocumentForClassItem
//   M5: createClip / listClipsForClassItem / deleteClip
//   M6: createScoreDocumentFromImport / attachScoreToClassItem
//   M7: publishTimeMap (writes score_time_maps + score_time_waypoints)
//   M8: saveScoreDocument / saveScoreRevision

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

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

export interface PlaysenseStudioClip {
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
}): Promise<{ data?: PlaysenseStudioClip; error?: string }> {
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
): Promise<{ data?: PlaysenseStudioClip[]; error?: string }> {
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
// M9 — analytics
// ============================================

export type PlaysenseStudioEventType =
  | 'playsense_studio_player_loaded'
  | 'playsense_studio_play'
  | 'playsense_studio_seek_via_notation'
  | 'playsense_studio_clip_saved'
  | 'playsense_studio_view_switched'
  | 'playsense_studio_legacy_iframe_shown';

/**
 * Log a PlaySense Studio player event. Cheap, fire-and-forget; we don't await this
 * from the call sites and silently drop on error so the player never
 * blocks waiting for analytics.
 */
export async function logPlaysenseStudioEvent(input: {
  eventType: PlaysenseStudioEventType;
  classItemId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('playsense_studio_events').insert({
      user_id: user?.id ?? null,
      class_item_id: input.classItemId ?? null,
      event_type: input.eventType,
      metadata: (input.metadata ?? null) as unknown as never,
    });
  } catch {
    // analytics failures must never bubble up
  }
}

// ============================================
// M6 — admin import (MusicXML / MIDI)
// ============================================

import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';

// ============================================
// Shared helpers — a ScoreDocument can be owned by EITHER a class_item (course
// content) OR a play_sense_songs row (standalone song). These helpers are the
// single insert/auth path both owners share.
// ============================================

/** Discriminated owner of a score document. */
export type ScoreOwner =
  | { kind: 'classItem'; classItemId: string }
  | { kind: 'song'; songId: string };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Resolve the current user and assert admin. Returns userId or an error. */
async function requireAdmin(
  supabase: SupabaseServerClient
): Promise<{ userId: string } | { error: string }> {
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
  return { userId: user.id };
}

/** Validate + insert a score_documents row and its score_tracks. Cleans up the
 *  document if track insertion fails. Returns the new score_document id. */
async function insertScore(
  supabase: SupabaseServerClient,
  score: ScoreDocument,
  userId: string
): Promise<{ docId: string } | { error: string }> {
  let parsed: ScoreDocument;
  try {
    parsed = parseScoreDocument(score as unknown);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid score document';
    return { error: `Score validation failed: ${message}` };
  }

  const { data: doc, error: docErr } = await supabase
    .from('score_documents')
    .insert({
      title: parsed.title,
      composer: parsed.composer ?? null,
      source_format: parsed.sourceFormat,
      parsed_score: parsed as unknown as never,
      schema_version: parsed.schemaVersion,
      created_by: userId,
    })
    .select('id')
    .single();
  if (docErr || !doc) return { error: docErr?.message ?? 'Insert failed' };

  if (parsed.tracks.length > 0) {
    const { error: trackErr } = await supabase.from('score_tracks').insert(
      parsed.tracks.map((t) => ({
        score_document_id: doc.id,
        track_index: t.index,
        instrument: t.instrument,
        display_name: t.displayName,
        tuning: t.tuning as unknown as never,
        string_multiplicity: t.stringMultiplicity,
        channel: t.channel,
        default_view: t.defaultView,
      }))
    );
    if (trackErr) {
      // Don't leave an orphan score_document behind.
      await supabase.from('score_documents').delete().eq('id', doc.id);
      return { error: trackErr.message };
    }
  }

  return { docId: doc.id };
}

/** A default-shape empty score: 4 bars of 4/4 at 120 BPM, single staff track,
 *  each measure a whole-note rest. Shared by class-item + song blank creation. */
function buildBlankScore(title: string): ScoreDocument {
  return {
    schemaVersion: 1,
    title: title.trim() || 'New score',
    sourceFormat: 'native',
    initialTempo: 120,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    tracks: [
      {
        index: 0,
        instrument: 'staff',
        displayName: 'Staff',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures: [1, 2, 3, 4].map((number) => ({
          number,
          voices: [{ number: 1, events: [{ kind: 'rest' as const, durationQN: 4 }] }],
        })),
      },
    ],
  };
}

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
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  // Insert the score (re-validates + writes score_documents + score_tracks).
  const inserted = await insertScore(supabase, input.scoreDocument, admin.userId);
  if ('error' in inserted) return { error: inserted.error };
  const docId = inserted.docId;

  // Wire to the class_item. If a score was already attached, this is a REPLACE:
  // point at the new doc and clear active_time_map_id (the old map belongs to the
  // previous score and would otherwise dangle / mis-sync).
  const { data: prevItem } = await supabase
    .from('class_items')
    .select('score_document_id')
    .eq('id', input.classItemId)
    .single();
  const prevScoreId = prevItem?.score_document_id ?? null;

  const { error: linkErr } = await supabase
    .from('class_items')
    .update({ score_document_id: docId, active_time_map_id: null })
    .eq('id', input.classItemId);
  if (linkErr) return { error: linkErr.message };

  // Best-effort cleanup of the replaced document (CASCADE removes its tracks +
  // time maps). A failure here must not fail the import.
  if (prevScoreId && prevScoreId !== docId) {
    await supabase.from('score_documents').delete().eq('id', prevScoreId);
  }

  revalidatePath('/dashboard');
  return { scoreDocumentId: docId };
}

// ============================================
// M7 — sync (publishing time maps)
// ============================================

export type PlaysenseStudioSyncMethod = 'tempo' | 'tap' | 'drag' | 'midi';

export interface PublishTimeMapInput {
  classItemId: string;
  scoreDocumentId: string;
  method: PlaysenseStudioSyncMethod;
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
// M8 — blank score creation (author from scratch)
// ============================================

export async function createBlankScoreForClassItem(input: {
  classItemId: string;
  title?: string;
}): Promise<{ scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  // Check the class item exists and isn't already attached.
  const { data: classItem } = await supabase
    .from('class_items')
    .select('id, score_document_id, title')
    .eq('id', input.classItemId)
    .single();
  if (!classItem) return { error: 'Class item not found' };
  if (classItem.score_document_id) {
    return { error: 'A score is already attached. Detach it first.' };
  }

  const blank = buildBlankScore(input.title || classItem.title || 'New score');
  const inserted = await insertScore(supabase, blank, admin.userId);
  if ('error' in inserted) return { error: inserted.error };

  // Attach to the class item.
  const { error: linkErr } = await supabase
    .from('class_items')
    .update({ score_document_id: inserted.docId })
    .eq('id', input.classItemId);
  if (linkErr) return { error: linkErr.message };

  revalidatePath('/dashboard');
  return { scoreDocumentId: inserted.docId };
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

// ============================================
// Standalone songs — play_sense_songs owns a ScoreDocument (the single source of
// truth). The rhythm highway derives its events at runtime via
// scoreToExerciseDefinition(); nothing is persisted as events. Authored in the
// SAME studio as course items, just with a 'song' owner (no video, no time map).
// ============================================

export type SongDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SongSummary {
  id: string;
  scoreDocumentId: string;
  title: string;
  difficulty: SongDifficulty;
  trackIndex: number;
  isPublished: boolean;
  orderIndex: number;
}

/** Admin list of all songs (published or not). */
export async function listSongs(): Promise<{ data?: SongSummary[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('play_sense_songs')
    .select('id, score_document_id, title, difficulty, track_index, is_published, order_index')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return {
    data: (data ?? []).map((s) => ({
      id: s.id,
      scoreDocumentId: s.score_document_id,
      title: s.title,
      difficulty: s.difficulty as SongDifficulty,
      trackIndex: s.track_index,
      isPublished: s.is_published,
      orderIndex: s.order_index,
    })),
  };
}

export interface PublishedSong {
  id: string;
  title: string;
  difficulty: SongDifficulty;
  trackIndex: number;
  parsedScore: ScoreDocument;
}

/** Published songs for the student stage. Returns parsed scores; the caller maps
 *  each through scoreToExerciseDefinition() to feed the highway. */
export async function getPublishedSongs(): Promise<{ data?: PublishedSong[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('play_sense_songs')
    .select('id, title, difficulty, track_index, is_published, order_index, score_documents(parsed_score)')
    .eq('is_published', true)
    .order('order_index', { ascending: true });
  if (error) return { error: error.message };
  return {
    data: (data ?? [])
      .filter((s) => s.score_documents)
      .map((s) => ({
        id: s.id,
        title: s.title,
        difficulty: s.difficulty as SongDifficulty,
        trackIndex: s.track_index,
        parsedScore: (s.score_documents as unknown as { parsed_score: ScoreDocument })
          .parsed_score,
      })),
  };
}

export interface SongScorePayload extends ClassItemScorePayload {
  song: {
    id: string;
    title: string;
    difficulty: SongDifficulty;
    trackIndex: number;
    isPublished: boolean;
    orderIndex: number;
  };
}

/** Studio read path for a song — score + tracks + song meta. No time map (songs
 *  are always fixed-BPM, no video). */
export async function getScoreDocumentForSong(
  songId: string
): Promise<{ data?: SongScorePayload; error?: string }> {
  const supabase = await createClient();

  const { data: song, error: songErr } = await supabase
    .from('play_sense_songs')
    .select('id, score_document_id, title, difficulty, track_index, is_published, order_index')
    .eq('id', songId)
    .single();
  if (songErr) return { error: songErr.message };
  if (!song?.score_document_id) return { error: 'Song has no score document' };

  const { data: doc, error: docErr } = await supabase
    .from('score_documents')
    .select('id, title, composer, parsed_score')
    .eq('id', song.score_document_id)
    .single();
  if (docErr || !doc) return { error: docErr?.message ?? 'Score not found' };

  const { data: tracks, error: tracksErr } = await supabase
    .from('score_tracks')
    .select('id, track_index, instrument, display_name, tuning, string_multiplicity, default_view')
    .eq('score_document_id', song.score_document_id)
    .order('track_index', { ascending: true });
  if (tracksErr) return { error: tracksErr.message };

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
      activeTimeMap: null,
      song: {
        id: song.id,
        title: song.title,
        difficulty: song.difficulty as SongDifficulty,
        trackIndex: song.track_index,
        isPublished: song.is_published,
        orderIndex: song.order_index,
      },
    },
  };
}

/** Create a new song from a blank score (opens straight into the studio). */
export async function createBlankScoreForSong(input: {
  title?: string;
  difficulty?: SongDifficulty;
}): Promise<{ songId?: string; scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const title = input.title?.trim() || 'New song';
  const inserted = await insertScore(supabase, buildBlankScore(title), admin.userId);
  if ('error' in inserted) return { error: inserted.error };

  const { data: song, error: songErr } = await supabase
    .from('play_sense_songs')
    .insert({
      score_document_id: inserted.docId,
      title,
      difficulty: input.difficulty ?? 'intermediate',
      created_by: admin.userId,
    })
    .select('id')
    .single();
  if (songErr || !song) {
    // Don't leave an orphan score_document behind.
    await supabase.from('score_documents').delete().eq('id', inserted.docId);
    return { error: songErr?.message ?? 'Failed to create song' };
  }

  revalidatePath('/admin/play-sense');
  return { songId: song.id, scoreDocumentId: inserted.docId };
}

/** Create a new song from an imported MusicXML/MIDI score. */
export async function createSongFromImport(input: {
  scoreDocument: ScoreDocument;
  title?: string;
  difficulty?: SongDifficulty;
}): Promise<{ songId?: string; scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const inserted = await insertScore(supabase, input.scoreDocument, admin.userId);
  if ('error' in inserted) return { error: inserted.error };

  const title = input.title?.trim() || input.scoreDocument.title || 'New song';
  const { data: song, error: songErr } = await supabase
    .from('play_sense_songs')
    .insert({
      score_document_id: inserted.docId,
      title,
      difficulty: input.difficulty ?? 'intermediate',
      created_by: admin.userId,
    })
    .select('id')
    .single();
  if (songErr || !song) {
    await supabase.from('score_documents').delete().eq('id', inserted.docId);
    return { error: songErr?.message ?? 'Failed to create song' };
  }

  revalidatePath('/admin/play-sense');
  return { songId: song.id, scoreDocumentId: inserted.docId };
}

/** Update song-level metadata (difficulty / publish / order / title / graded track). */
export async function updateSongMeta(input: {
  songId: string;
  title?: string;
  difficulty?: SongDifficulty;
  isPublished?: boolean;
  trackIndex?: number;
  orderIndex?: number;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty;
  if (input.isPublished !== undefined) patch.is_published = input.isPublished;
  if (input.trackIndex !== undefined) patch.track_index = input.trackIndex;
  if (input.orderIndex !== undefined) patch.order_index = input.orderIndex;
  if (Object.keys(patch).length === 0) return { success: true };

  const { error } = await supabase
    .from('play_sense_songs')
    .update(patch)
    .eq('id', input.songId);
  if (error) return { error: error.message };

  revalidatePath('/admin/play-sense');
  revalidatePath('/dashboard/play-sense');
  return { success: true };
}

/** Delete a song and its owned score document. Surfaces a failure to clean up the
 *  score rather than silently leaving an ownerless score_document. */
export async function deleteSong(
  songId: string
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { data: song, error: songErr } = await supabase
    .from('play_sense_songs')
    .select('score_document_id')
    .eq('id', songId)
    .single();
  if (songErr) return { error: songErr.message };

  const { error: delSongErr } = await supabase
    .from('play_sense_songs')
    .delete()
    .eq('id', songId);
  if (delSongErr) return { error: delSongErr.message };

  // Remove the now-ownerless score document. Surface a failure — don't swallow it.
  if (song?.score_document_id) {
    const { error: delScoreErr } = await supabase
      .from('score_documents')
      .delete()
      .eq('id', song.score_document_id);
    if (delScoreErr) {
      return {
        error: `Song deleted, but its score document could not be removed (${delScoreErr.message}). Score ${song.score_document_id} is now ownerless.`,
      };
    }
  }

  revalidatePath('/admin/play-sense');
  revalidatePath('/dashboard/play-sense');
  return { success: true };
}
