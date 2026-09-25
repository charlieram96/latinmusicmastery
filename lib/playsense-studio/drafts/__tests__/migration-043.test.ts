import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/043_studio_versions.sql'), 'utf8');

describe('043_studio_versions', () => {
  it('creates the table with the owner and kind checks', () => {
    expect(sql).toMatch(/create table (if not exists )?studio_versions/i);
    expect(sql).toMatch(/owner_kind in \('section', ?'exercise', ?'song'\)/i);
    expect(sql).toMatch(/kind in \('draft', ?'published'\)/i);
    expect(sql).toMatch(/updated_at timestamptz not null default now\(\)/i);
  });
  it('keeps version rows when their author is deleted', () => {
    expect(sql).toMatch(/created_by uuid references auth\.users\(id\) on delete set null/i);
  });
  it('enables RLS with one admin-only policy and no student read policy', () => {
    expect(sql).toMatch(/alter table studio_versions enable row level security/i);
    const policies = sql.match(/create policy/gi) ?? [];
    expect(policies).toHaveLength(1);
    expect(sql).toMatch(/for all to authenticated/i);
    expect(sql).toMatch(/is_admin = true/i);
    expect(sql).not.toMatch(/using \(true\)/i);
  });
});
