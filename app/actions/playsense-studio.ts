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

/** Load one time map's header + waypoints (or null). Shared by the active-map
 *  path and the section draft-map path. */
async function loadTimeMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeMapId: string | null
): Promise<{ data?: ClassItemScorePayload['activeTimeMap']; error?: string }> {
  if (!timeMapId) return { data: null };

  const { data: tm, error: tmErr } = await supabase
    .from('score_time_maps')
    .select('id, method')
    .eq('id', timeMapId)
    .single();
  if (tmErr) return { error: tmErr.message };

  const { data: waypoints, error: wpErr } = await supabase
    .from('score_time_waypoints')
    .select('musical_position_qn, video_time_seconds, measure_number, beat_in_measure')
    .eq('time_map_id', timeMapId)
    .order('musical_position_qn', { ascending: true });
  if (wpErr) return { error: wpErr.message };

  return {
    data: {
      id: tm.id,
      method: tm.method,
      waypoints: (waypoints ?? []).map((w) => ({
        musicalPositionQN: w.musical_position_qn,
        videoTimeSeconds: w.video_time_seconds,
        measureNumber: w.measure_number,
        beatInMeasure: w.beat_in_measure,
      })),
    },
  };
}

/** Load a score document + tracks + (optional) one time map's waypoints. Shared by
 *  the single-score class-item path, the section path, and songs. */
async function fetchScorePayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scoreDocumentId: string,
  activeTimeMapId: string | null
): Promise<{ data?: ClassItemScorePayload; error?: string }> {
  const { data: doc, error: docErr } = await supabase
    .from('score_documents')
    .select('id, title, composer, parsed_score')
    .eq('id', scoreDocumentId)
    .single();

  if (docErr || !doc) return { error: docErr?.message ?? 'Score not found' };

  const { data: tracks, error: tracksErr } = await supabase
    .from('score_tracks')
    .select('id, track_index, instrument, display_name, tuning, string_multiplicity, default_view')
    .eq('score_document_id', scoreDocumentId)
    .order('track_index', { ascending: true });

  if (tracksErr) return { error: tracksErr.message };

  const tmResult = await loadTimeMap(supabase, activeTimeMapId);
  if (tmResult.error) return { error: tmResult.error };
  const activeTimeMap = tmResult.data ?? null;

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

  return fetchScorePayload(supabase, item.score_document_id, item.active_time_map_id);
}

// ============================================
// Multiple scored sections per VIDEO class item. Each section OWNS one score
// document + points at one time map; its video range (start/end) is derived from
// the published waypoints. Lives in class_item_score_sections.
// ============================================

export interface ClassItemScoreSection extends ClassItemScorePayload {
  sectionId: string;
  sectionIndex: number;
  label: string | null;
  videoStartSeconds: number | null;
  videoEndSeconds: number | null;
  /** Admin-only autosaved sync draft (not yet Published). Null when none.
   *  Students never receive this — the studio seeds its markers from it. */
  draftTimeMap: ClassItemScorePayload['activeTimeMap'];
}

/** All scored sections for a class item, ordered by section_index. */
export async function getScoreSectionsForClassItem(
  classItemId: string
): Promise<{ data?: ClassItemScoreSection[]; error?: string }> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('class_item_score_sections')
    .select('id, section_index, label, score_document_id, active_time_map_id, draft_time_map_id, video_start_seconds, video_end_seconds')
    .eq('class_item_id', classItemId)
    .order('section_index', { ascending: true });

  if (error) return { error: error.message };

  const out: ClassItemScoreSection[] = [];
  for (const row of rows ?? []) {
    const payload = await fetchScorePayload(supabase, row.score_document_id, row.active_time_map_id);
    if (payload.error || !payload.data) {
      return { error: payload.error ?? 'Failed to load a section score' };
    }
    // Admin-only draft (transient) — only fetched when a section actually has one.
    const draft = await loadTimeMap(supabase, row.draft_time_map_id);
    if (draft.error) return { error: draft.error };
    out.push({
      ...payload.data,
      sectionId: row.id,
      sectionIndex: row.section_index,
      label: row.label,
      videoStartSeconds: row.video_start_seconds,
      videoEndSeconds: row.video_end_seconds,
      draftTimeMap: draft.data ?? null,
    });
  }

  return { data: out };
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
  | 'playsense_studio_legacy_iframe_shown'
  | 'playsense_studio_section_exported';

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
  /** When set, publish into this SECTION (sets its active map + derived video
   *  range) instead of the class_item's single active_time_map_id. */
  sectionId?: string;
  /** Which owner pointer to update. Defaults to 'section' when sectionId is set,
   *  else 'classItem'. 'exercise' points class_items.exercise_time_map_id at the
   *  new map — the EXERCISE play-along video synced to the graded score. */
  target?: 'classItem' | 'section' | 'exercise';
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

  const target = input.target ?? (input.sectionId ? 'section' : 'classItem');

  // Sections may not overlap on the video timeline. Checked BEFORE any insert so
  // a rejected publish leaves no orphan time-map row.
  if (target === 'section' && input.sectionId) {
    const start = sorted[0].videoTimeSeconds;
    const end = sorted[sorted.length - 1].videoTimeSeconds;
    const { data: siblings, error: sibErr } = await supabase
      .from('class_item_score_sections')
      .select('id, label, video_start_seconds, video_end_seconds')
      .eq('class_item_id', input.classItemId)
      .neq('id', input.sectionId)
      .not('video_start_seconds', 'is', null);
    if (sibErr) return { error: sibErr.message };
    const hit = siblings?.find(
      (s) =>
        s.video_end_seconds != null &&
        start < s.video_end_seconds &&
        end > s.video_start_seconds!
    );
    if (hit) {
      const fmtSec = (v: number) => `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, '0')}`;
      return {
        error: `This sync (${fmtSec(start)}–${fmtSec(end)}) overlaps the section "${
          hit.label ?? 'untitled'
        }" (${fmtSec(hit.video_start_seconds!)}–${fmtSec(hit.video_end_seconds!)}). Move it off that section before publishing.`,
      };
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

  // 3. Point the owner at this new map. A section publish updates the section row
  //    (active map + the video range derived from the waypoints); an exercise
  //    publish points class_items.exercise_time_map_id at it; otherwise the legacy
  //    single-score path updates the class_item's active_time_map_id.
  if (target === 'section' && input.sectionId) {
    const start = sorted[0].videoTimeSeconds;
    const end = sorted[sorted.length - 1].videoTimeSeconds;
    // Capture the maps this publish supersedes so we can reclaim them afterward.
    const { data: prevSec } = await supabase
      .from('class_item_score_sections')
      .select('active_time_map_id, draft_time_map_id')
      .eq('id', input.sectionId)
      .single();
    const { error: secErr } = await supabase
      .from('class_item_score_sections')
      .update({
        active_time_map_id: tmRow.id,
        // Publishing consumes the draft (its contents are now live).
        draft_time_map_id: null,
        video_start_seconds: start,
        video_end_seconds: end,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sectionId);
    if (secErr) return { error: secErr.message };
    // Delete the superseded active + draft maps (waypoints cascade) so rows stay
    // bounded to one active map per section. Done after the repoint so a student
    // never resolves the section to a just-deleted map.
    const stale = [prevSec?.active_time_map_id, prevSec?.draft_time_map_id].filter(
      (id): id is string => !!id && id !== tmRow.id
    );
    if (stale.length) {
      await supabase.from('score_time_maps').delete().in('id', stale);
    }
  } else if (target === 'exercise') {
    const { error: exErr } = await supabase
      .from('class_items')
      .update({ exercise_time_map_id: tmRow.id })
      .eq('id', input.classItemId);
    if (exErr) return { error: exErr.message };
  } else if (input.makeActive ?? true) {
    const { error: linkErr } = await supabase
      .from('class_items')
      .update({ active_time_map_id: tmRow.id })
      .eq('id', input.classItemId);
    if (linkErr) return { error: linkErr.message };
  }

  revalidatePath('/dashboard');
  return { timeMapId: tmRow.id };
}

// Autosave a section's sync as a HIDDEN DRAFT (admin-only). Unlike publishTimeMap
// this never touches active_time_map_id / video range / overlap — students keep
// seeing the last Published alignment. Bounded to one draft map per section: an
// existing draft is updated in place (safe — students never read it); otherwise a
// new map is created and pointed at by draft_time_map_id. Publish consumes it.
export async function saveSectionDraftTimeMap(input: {
  classItemId: string;
  scoreDocumentId: string;
  sectionId: string;
  method: string;
  params: unknown;
  waypoints: Array<{
    musicalPositionQN: number;
    videoTimeSeconds: number;
    measureNumber: number | null;
    beatInMeasure: number | null;
  }>;
}): Promise<{ timeMapId?: string; error?: string }> {
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
    return { error: 'Need at least two waypoints to save a draft.' };
  }
  // Same strict-monotonic invariant the player relies on.
  const sorted = [...input.waypoints].sort((a, b) => a.musicalPositionQN - b.musicalPositionQN);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].musicalPositionQN <= sorted[i - 1].musicalPositionQN) {
      return { error: 'Waypoints have duplicate musical positions.' };
    }
    if (sorted[i].videoTimeSeconds <= sorted[i - 1].videoTimeSeconds) {
      return { error: 'Waypoints must be strictly increasing in video time.' };
    }
  }

  const { data: sec, error: secErr } = await supabase
    .from('class_item_score_sections')
    .select('draft_time_map_id')
    .eq('id', input.sectionId)
    .single();
  if (secErr) return { error: secErr.message };

  const waypointRows = (mapId: string) =>
    sorted.map((w) => ({
      time_map_id: mapId,
      musical_position_qn: w.musicalPositionQN,
      video_time_seconds: w.videoTimeSeconds,
      measure_number: w.measureNumber,
      beat_in_measure: w.beatInMeasure,
    }));

  let draftId = sec?.draft_time_map_id as string | null;

  if (draftId) {
    // Update the existing draft map in place.
    const { error: updErr } = await supabase
      .from('score_time_maps')
      .update({ method: input.method, params: input.params as unknown as never })
      .eq('id', draftId);
    if (updErr) return { error: updErr.message };
    const { error: delErr } = await supabase
      .from('score_time_waypoints')
      .delete()
      .eq('time_map_id', draftId);
    if (delErr) return { error: delErr.message };
    const { error: wpErr } = await supabase.from('score_time_waypoints').insert(waypointRows(draftId));
    if (wpErr) return { error: wpErr.message };
    return { timeMapId: draftId };
  }

  // No draft yet: create one and point the section at it.
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
  draftId = tmRow.id;

  const { error: wpErr } = await supabase.from('score_time_waypoints').insert(waypointRows(draftId));
  if (wpErr) {
    await supabase.from('score_time_maps').delete().eq('id', draftId);
    return { error: wpErr.message };
  }

  const { error: linkErr } = await supabase
    .from('class_item_score_sections')
    .update({ draft_time_map_id: draftId, updated_at: new Date().toISOString() })
    .eq('id', input.sectionId);
  if (linkErr) return { error: linkErr.message };

  return { timeMapId: draftId };
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
// Section mutations (multiple scores per VIDEO class item)
// ============================================

/** Next free section_index for a class item (max + 1, or 0 when empty). */
async function nextSectionIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classItemId: string
): Promise<number> {
  const { data } = await supabase
    .from('class_item_score_sections')
    .select('section_index')
    .eq('class_item_id', classItemId)
    .order('section_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.section_index ?? -1) + 1;
}

/** Insert a new section owning the given score, appended after existing sections.
 *  Cleans up the score document if the section row fails. */
async function insertSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classItemId: string,
  scoreDocumentId: string,
  label: string | null
): Promise<{ sectionId: string } | { error: string }> {
  const sectionIndex = await nextSectionIndex(supabase, classItemId);
  const { data: section, error: secErr } = await supabase
    .from('class_item_score_sections')
    .insert({
      class_item_id: classItemId,
      score_document_id: scoreDocumentId,
      section_index: sectionIndex,
      label,
    })
    .select('id')
    .single();
  if (secErr || !section) {
    await supabase.from('score_documents').delete().eq('id', scoreDocumentId);
    return { error: secErr?.message ?? 'Failed to create section' };
  }
  return { sectionId: section.id };
}

/** Create a new blank-score section on a class item. */
export async function createBlankSection(input: {
  classItemId: string;
  title?: string;
}): Promise<{ sectionId?: string; scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const inserted = await insertScore(supabase, buildBlankScore(input.title || 'New section'), admin.userId);
  if ('error' in inserted) return { error: inserted.error };

  const section = await insertSection(supabase, input.classItemId, inserted.docId, input.title?.trim() || null);
  if ('error' in section) return { error: section.error };

  revalidatePath('/dashboard');
  return { sectionId: section.sectionId, scoreDocumentId: inserted.docId };
}

/** Create a new section from an imported MusicXML/MIDI score. */
export async function createSectionFromImport(input: {
  classItemId: string;
  scoreDocument: ScoreDocument;
  sourceFilename?: string;
}): Promise<{ sectionId?: string; scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const inserted = await insertScore(supabase, input.scoreDocument, admin.userId);
  if ('error' in inserted) return { error: inserted.error };

  const section = await insertSection(
    supabase,
    input.classItemId,
    inserted.docId,
    input.scoreDocument.title?.trim() || null
  );
  if ('error' in section) return { error: section.error };

  revalidatePath('/dashboard');
  return { sectionId: section.sectionId, scoreDocumentId: inserted.docId };
}

/** Swap a section's score for a freshly-imported one. Clears its sync (time map +
 *  derived range) and removes the previous score document. */
export async function replaceSectionScore(input: {
  sectionId: string;
  scoreDocument: ScoreDocument;
  sourceFilename?: string;
}): Promise<{ scoreDocumentId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { data: section, error: secErr } = await supabase
    .from('class_item_score_sections')
    .select('id, score_document_id')
    .eq('id', input.sectionId)
    .single();
  if (secErr) return { error: secErr.message };

  const inserted = await insertScore(supabase, input.scoreDocument, admin.userId);
  if ('error' in inserted) return { error: inserted.error };
  const prevScoreId = section?.score_document_id ?? null;

  const { error: updErr } = await supabase
    .from('class_item_score_sections')
    .update({
      score_document_id: inserted.docId,
      active_time_map_id: null,
      video_start_seconds: null,
      video_end_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.sectionId);
  if (updErr) return { error: updErr.message };

  if (prevScoreId && prevScoreId !== inserted.docId) {
    await supabase.from('score_documents').delete().eq('id', prevScoreId);
  }

  revalidatePath('/dashboard');
  return { scoreDocumentId: inserted.docId };
}

/** Delete a section and its owned score document (CASCADE removes tracks + maps). */
export async function deleteSection(
  sectionId: string
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { data: section, error: secErr } = await supabase
    .from('class_item_score_sections')
    .select('id, score_document_id')
    .eq('id', sectionId)
    .single();
  if (secErr) return { error: secErr.message };

  const { error: delErr } = await supabase
    .from('class_item_score_sections')
    .delete()
    .eq('id', sectionId);
  if (delErr) return { error: delErr.message };

  if (section?.score_document_id) {
    await supabase.from('score_documents').delete().eq('id', section.score_document_id);
  }

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

// ============================================
// EXERCISE play-part media — optional cropped video + backing tracks
// ============================================

export interface BackingTrack {
  id: string;
  label: string;
  audioUrl: string;
  orderIndex: number;
}

export interface ExerciseMedia {
  /** Optional exercise-part video (independent of the Watch demo video). */
  videoUrl: string | null;
  /** Crop start offset — the visible window is exactly the score's length.
   *  Ignored when `timeMap` is set (the map fully positions the video). */
  videoStartSeconds: number;
  /** Optional time map syncing the play-along video to the graded score's beats.
   *  When present, consumers position the video by musical position; otherwise
   *  they fall back to the linear crop (videoStartSeconds). */
  timeMap: ClassItemScorePayload['activeTimeMap'];
  backingTracks: BackingTrack[];
}

/** Read the exercise part's media. Any authenticated user (students included). */
export async function getExerciseMedia(
  classItemId: string
): Promise<{ data?: ExerciseMedia; error?: string }> {
  const supabase = await createClient();

  const { data: item, error: itemErr } = await supabase
    .from('class_items')
    .select('exercise_video_url, exercise_video_start_seconds, exercise_time_map_id')
    .eq('id', classItemId)
    .single();
  if (itemErr || !item) return { error: itemErr?.message ?? 'Class item not found' };

  const { data: tracks, error: tracksErr } = await supabase
    .from('class_item_backing_tracks')
    .select('id, label, audio_url, order_index')
    .eq('class_item_id', classItemId)
    .order('order_index', { ascending: true });
  if (tracksErr) return { error: tracksErr.message };

  // Load the exercise video's time map (same waypoint shape as fetchScorePayload).
  let timeMap: ExerciseMedia['timeMap'] = null;
  if (item.exercise_video_url && item.exercise_time_map_id) {
    const { data: tm, error: tmErr } = await supabase
      .from('score_time_maps')
      .select('id, method')
      .eq('id', item.exercise_time_map_id)
      .single();
    if (tmErr) return { error: tmErr.message };

    const { data: waypoints, error: wpErr } = await supabase
      .from('score_time_waypoints')
      .select('musical_position_qn, video_time_seconds, measure_number, beat_in_measure')
      .eq('time_map_id', item.exercise_time_map_id)
      .order('musical_position_qn', { ascending: true });
    if (wpErr) return { error: wpErr.message };

    timeMap = {
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
      videoUrl: item.exercise_video_url,
      videoStartSeconds: item.exercise_video_start_seconds ?? 0,
      timeMap,
      backingTracks: (tracks ?? []).map((t) => ({
        id: t.id,
        label: t.label,
        audioUrl: t.audio_url,
        orderIndex: t.order_index,
      })),
    },
  };
}

/** Set or clear the exercise-part video + its crop start. Clearing resets the crop. */
export async function updateExerciseVideo(input: {
  classItemId: string;
  videoUrl: string | null;
  startSeconds: number;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { error } = await supabase
    .from('class_items')
    .update({
      exercise_video_url: input.videoUrl,
      exercise_video_start_seconds: input.videoUrl ? Math.max(0, input.startSeconds) : 0,
      // Removing the video orphans its sync map — drop the pointer too.
      ...(input.videoUrl ? {} : { exercise_time_map_id: null }),
    })
    .eq('id', input.classItemId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/playsense-studio/${input.classItemId}`);
  return { success: true };
}

/** Set the class item's demo (Watch-part) video from inside the studio. */
export async function updateClassItemVideo(input: {
  classItemId: string;
  videoUrl: string;
  videoDurationSeconds: number | null;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { error } = await supabase
    .from('class_items')
    .update({
      video_url: input.videoUrl,
      video_duration_seconds: input.videoDurationSeconds,
    })
    .eq('id', input.classItemId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/playsense-studio/${input.classItemId}`);
  return { success: true };
}

export async function addBackingTrack(input: {
  classItemId: string;
  label: string;
  audioUrl: string;
}): Promise<{ data?: BackingTrack; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { data: last } = await supabase
    .from('class_item_backing_tracks')
    .select('order_index')
    .eq('class_item_id', input.classItemId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  const orderIndex = (last?.order_index ?? -1) + 1;

  const { data, error } = await supabase
    .from('class_item_backing_tracks')
    .insert({
      class_item_id: input.classItemId,
      label: input.label.trim() || 'Backing track',
      audio_url: input.audioUrl,
      order_index: orderIndex,
    })
    .select('id, label, audio_url, order_index')
    .single();
  if (error || !data) return { error: error?.message ?? 'Insert failed' };

  revalidatePath(`/admin/playsense-studio/${input.classItemId}`);
  return {
    data: { id: data.id, label: data.label, audioUrl: data.audio_url, orderIndex: data.order_index },
  };
}

export async function updateBackingTrackLabel(input: {
  trackId: string;
  label: string;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { error } = await supabase
    .from('class_item_backing_tracks')
    .update({ label: input.label.trim() || 'Backing track' })
    .eq('id', input.trackId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteBackingTrack(input: {
  trackId: string;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };

  const { error } = await supabase
    .from('class_item_backing_tracks')
    .delete()
    .eq('id', input.trackId);
  if (error) return { error: error.message };
  return { success: true };
}
