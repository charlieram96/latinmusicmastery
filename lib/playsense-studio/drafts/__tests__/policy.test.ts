import { describe, expect, it } from 'vitest';
import { DRAFT_CAP, draftIdsToPrune, planDraftWrite, unpublishedDraft } from '../policy';
import type { VersionMeta } from '../types';

const T0 = Date.parse('2026-09-25T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const row = (id: string, kind: 'draft' | 'published', created: number, updated = created): VersionMeta => ({ id, kind, created_at: at(created), updated_at: at(updated) });

describe('draft write policy', () => {
  it('inserts the first draft', () => {
    expect(planDraftWrite([], T0)).toEqual({ action: 'insert' });
  });
  it('updates the newest draft while it is younger than a minute', () => {
    expect(planDraftWrite([row('d1', 'draft', 0, 30_000)], T0 + 59_000)).toEqual({ action: 'update', id: 'd1' });
  });
  it('starts a new row once the newest draft is a minute old', () => {
    expect(planDraftWrite([row('d1', 'draft', 0, 30_000)], T0 + 60_000)).toEqual({ action: 'insert' });
  });
  it('never updates a draft that predates the latest publish', () => {
    const rows = [row('p1', 'published', 10_000), row('d1', 'draft', 0, 5_000)];
    expect(planDraftWrite(rows, T0 + 20_000)).toEqual({ action: 'insert' });
  });
  it('prunes drafts beyond the cap, oldest first, and never a published row', () => {
    const rows: VersionMeta[] = [row('p', 'published', 0)];
    for (let i = 0; i < DRAFT_CAP + 2; i++) rows.push(row(`d${i}`, 'draft', i * 1000));
    expect(draftIdsToPrune(rows).sort()).toEqual(['d0', 'd1']);
  });
  it('reports the unpublished draft only when it is newer than the latest publish', () => {
    expect(unpublishedDraft([row('d1', 'draft', 0)])?.id).toBe('d1');
    expect(unpublishedDraft([row('d1', 'draft', 0, 5_000), row('p1', 'published', 6_000)])).toBeNull();
    expect(unpublishedDraft([row('p1', 'published', 6_000), row('d2', 'draft', 7_000)])?.id).toBe('d2');
  });
});
