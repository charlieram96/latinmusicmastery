'use server';

// PlaySense Studio drafts (spec §9). Autosave writes here, never to the live
// rows students read; publishStudioDraft (below) is the only path from a draft
// to live.
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { latestPublished, planDraftWrite, unpublishedDraft } from '@/lib/playsense-studio/drafts/policy';
import { studioTimingSchema, type StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import {
  clearUnpublishedDrafts, insertVersion, listVersionMeta, loadLiveContent, pruneDrafts, resolveOwner,
} from '@/lib/playsense-studio/drafts/server';

export interface StudioDraft {
  score: ScoreDocument;
  timing: StudioTiming;
  updatedAt: string;
}

export interface StudioVersionListItem {
  id: string;
  kind: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  isLive: boolean;
}

function validate(score: unknown, timing: unknown): { score?: ScoreDocument; timing?: StudioTiming; error?: string } {
  let parsed: ScoreDocument;
  try {
    parsed = parseScoreDocument(score);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid score' };
  }
  const t = studioTimingSchema.safeParse(timing);
  if (!t.success) return { error: 'Invalid timing' };
  return { score: parsed, timing: t.data };
}

export async function saveStudioDraft(input: {
  owner: StudioDraftOwner;
  score: ScoreDocument;
  timing: StudioTiming;
}): Promise<{ updatedAt?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const v = validate(input.score, input.timing);
  if (v.error) return { error: v.error };

  const meta = await listVersionMeta(supabase, input.owner);
  if (meta.error) return { error: meta.error };
  const plan = planDraftWrite(meta.data ?? [], Date.now());
  if (plan.action === 'update') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('studio_versions')
      .update({ score: v.score as never, timing: v.timing as never, updated_at: now })
      .eq('id', plan.id);
    if (error) return { error: error.message };
    return { updatedAt: now };
  }
  const ins = await insertVersion(supabase, input.owner, 'draft', { score: v.score!, timing: v.timing! }, admin.userId);
  if (ins.error) return { error: ins.error };
  await pruneDrafts(supabase, input.owner);
  return { updatedAt: ins.data!.updatedAt };
}

export async function getStudioDrafts(
  owners: StudioDraftOwner[]
): Promise<{ data?: Record<string, StudioDraft>; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const out: Record<string, StudioDraft> = {};
  for (const owner of owners) {
    const meta = await listVersionMeta(supabase, owner);
    if (meta.error) return { error: meta.error };
    const d = unpublishedDraft(meta.data ?? []);
    if (!d) continue;
    const { data, error } = await supabase.from('studio_versions').select('score, timing, updated_at').eq('id', d.id).single();
    if (error || !data) return { error: error?.message ?? 'Draft not found' };
    out[ownerKey(owner)] = {
      score: data.score as unknown as ScoreDocument,
      timing: data.timing as unknown as StudioTiming,
      updatedAt: data.updated_at,
    };
  }
  return { data: out };
}

export async function listStudioVersions(
  owner: StudioDraftOwner
): Promise<{ data?: StudioVersionListItem[]; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const meta = await listVersionMeta(supabase, owner);
  if (meta.error) return { error: meta.error };
  const rows = meta.data ?? [];
  const live = latestPublished(rows);
  return {
    data: [...rows]
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, updatedAt: r.updated_at, isLive: r.id === live?.id })),
  };
}

export async function restoreStudioVersion(input: {
  owner: StudioDraftOwner;
  versionId: string;
}): Promise<{ data?: StudioDraft; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const { data: row } = await supabase
    .from('studio_versions')
    .select('owner_kind, owner_id, score, timing')
    .eq('id', input.versionId)
    .maybeSingle();
  if (!row || row.owner_kind !== input.owner.kind || row.owner_id !== input.owner.id) return { error: 'Version not found' };
  const content = { score: row.score as unknown as ScoreDocument, timing: row.timing as unknown as StudioTiming };
  // Always a fresh row: a restore is its own history entry.
  const ins = await insertVersion(supabase, input.owner, 'draft', content, admin.userId);
  if (ins.error) return { error: ins.error };
  await pruneDrafts(supabase, input.owner);
  return { data: { ...content, updatedAt: ins.data!.updatedAt } };
}

export async function discardStudioDraft(
  owner: StudioDraftOwner
): Promise<{ data?: StudioDraft | null; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const cleared = await clearUnpublishedDrafts(supabase, owner);
  if (cleared.error) return { error: cleared.error };
  const resolved = await resolveOwner(supabase, owner);
  if (resolved.error) return { data: null };
  const liveContent = await loadLiveContent(supabase, resolved.data!);
  if (liveContent.error) return { error: liveContent.error };
  return { data: { ...liveContent.data!, updatedAt: '' } };
}
