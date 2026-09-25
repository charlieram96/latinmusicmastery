import type { VersionMeta } from './types';

export const DRAFT_ROW_MIN_AGE_MS = 60_000;
export const DRAFT_CAP = 40;

const t = (iso: string) => Date.parse(iso);
const newestFirst = (a: VersionMeta, b: VersionMeta) => t(b.updated_at) - t(a.updated_at);

export function latestPublished(rows: VersionMeta[]): VersionMeta | null {
  return rows.filter((r) => r.kind === 'published').sort((a, b) => t(b.created_at) - t(a.created_at))[0] ?? null;
}

/** The owner's draft that students have not got yet, or null. */
export function unpublishedDraft(rows: VersionMeta[]): VersionMeta | null {
  const draft = rows.filter((r) => r.kind === 'draft').sort(newestFirst)[0];
  if (!draft) return null;
  const pub = latestPublished(rows);
  return !pub || t(draft.updated_at) > t(pub.created_at) ? draft : null;
}

/** Update the newest unpublished draft while it is under a minute old; else insert. */
export function planDraftWrite(
  rows: VersionMeta[],
  nowMs: number
): { action: 'update'; id: string } | { action: 'insert' } {
  const draft = unpublishedDraft(rows);
  if (draft && nowMs - t(draft.created_at) < DRAFT_ROW_MIN_AGE_MS) return { action: 'update', id: draft.id };
  return { action: 'insert' };
}

/** Draft ids beyond the cap (oldest first to go). Published rows are never pruned. */
export function draftIdsToPrune(rows: VersionMeta[], cap = DRAFT_CAP): string[] {
  return rows.filter((r) => r.kind === 'draft').sort(newestFirst).slice(cap).map((r) => r.id);
}
