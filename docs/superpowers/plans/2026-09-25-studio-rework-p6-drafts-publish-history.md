# Studio Rework P6 — Drafts, Publish, History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio edits (score and timing) autosave to an admin-only draft, and reach students only when the admin presses Publish. Each owner keeps a history of drafts and published versions that can be restored.

**Architecture:**
- **Storage:** a new admin-only table, `studio_versions`, holds drafts and published snapshots. Each row has an owner (a section, the class item's own score, or a song), a score and a timing blob.
- **Client:** one hook, `useStudioDraft`, replaces the three hosts' autosave code. A lesson-wide `StudioDraftsProvider` tracks which owners are unpublished, publishes and discards, and warns on leaving the page.
- **Publish:** writes the draft through the existing live actions (`publishTimeMap`, `saveScoreDocument`, the anchor actions), so no student code changes.

**Tech Stack:** Next.js 16 server actions, Supabase Postgres + RLS, React 19, TypeScript, zod, vitest (+ jsdom for components; no testing-library), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md`: §9 "Draft vs live and history" and §2 decisions 8–9. The roadmap entry is "Plan 6" in `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`.

## Global Constraints

- **Git rules:**
  - Never run `git stash` in any form; the stash stack is shared with other sessions.
  - Stage only the files you changed, by explicit path.
  - Commit messages are imperative with no prefix, followed by a blank line and your `Co-Authored-By` trailer.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**'`. Typecheck: `npx tsc --noEmit -p .`. Both must be clean at the end of every task.
  - Component tests start with `// @vitest-environment jsdom`. They use `createRoot` and `act` from `react`, with `IS_REACT_ACT_ENVIRONMENT = true`. There is no testing-library.
- **Where things go:** server actions go in `'use server'` modules and export only async functions. Server-only helpers go in plain modules under `lib/`.
- **Migrations:** the migration file is `supabase/migrations/043_studio_versions.sql`. Implementers **never apply it**; only Task 11 applies it, after the user says yes. Dev and production share one hosted database.
- **Students read live rows only:** `score_documents`, `score_tracks`, `score_time_maps`, `score_time_waypoints`, the section and class_item columns. Nothing in this plan changes a student-facing reader.
- **Draft cadence:**
  - A new draft row is created at most once a minute (`DRAFT_ROW_MIN_AGE_MS = 60_000`).
  - Each owner keeps at most 40 draft rows (`DRAFT_CAP = 40`); older drafts are pruned. Published rows are never pruned.
- **Exact UI copy:**
  - Autosave status: `Saving draft…`, `Saving soon…`, `Draft saved`, `Save failed`, `Autosave on`.
  - App bar: `1 unpublished change` / `N unpublished changes`.
  - Publish button: `Publish`, with a count badge.
  - Publish popover: title `Publish to students`, per-part buttons `Publish` and `Discard this draft`, footer `Publish all` (shown when 2 or more parts are unpublished), and `No changes from the live version`.
  - History: button and panel title `History`, badges `Published`, `Draft`, `Live`, button `Restore`.
  - Discard confirm: `Discard the unpublished changes to "<label>"? The live version stays as it is.`
  - Song visibility toggle: `Visible` / `Hidden`, with titles `Visible — students can find this song` / `Hidden — students can't find this song`.
- **Owner kinds** (the `owner_kind` column; the spec's check list is `section | exercise | song`):
  - `section`: `class_item_score_sections.id`.
  - `exercise`: `class_items.id`, for a class item's own score. That covers EXERCISE items (timing = `exercise_time_map_id` plus the class item anchor) and legacy single-score items (timing = `active_time_map_id`, no anchor).
  - `song`: `play_sense_songs.id`, with no timing.

## Decisions this plan makes (the spec is silent on these)

1. **Scope of a draft.** A draft holds the score plus the timing (waypoints, method, params including nudges, and the click anchor). These still write live immediately, as today, because they are class-item or structural actions:
   - video trim, exercise media, backing tracks
   - section create and delete, Replace score
   - song difficulty and visibility

   The spec's `timing` column lists exactly these fields, and trim is not in it.
2. **What counts as unpublished:** an owner is unpublished when its newest draft row was updated after its newest published row (or it has a draft and no published row at all). Undoing back to the live content still counts as unpublished until you publish or discard.
3. **The count:** the "N unpublished changes" count is the number of parts (owners) with an unpublished draft. There is no per-edit count.
4. **The `updated_at` column:** `studio_versions` gains an `updated_at` column (not in the spec's DDL), because the once-a-minute upsert updates a row in place and the unpublished check needs the time of the last write.
5. **Publish order:**
   1. Timing first, through `publishTimeMap`. Its validation (monotonic waypoints, no section overlap) runs before any write.
   2. Then the score.
   3. Then the anchor.
   4. Then the `published` version row.

   Each part is written only if it differs from live, so a score-only publish never mints a new time map. A draft's score is validated with `parseScoreDocument` when the draft is saved, so the score write at publish can fail only on infrastructure.
6. **Replace and discard:** Replace score stays live and immediate (it already asks for confirmation). After a successful replace, the owner's unpublished drafts are deleted, so an old draft can't overwrite the new score. Discard deletes the owner's unpublished draft rows.
7. **Restore and discard in the editor:** these load new content into the mounted editor with `replaceScore` and remount the SyncPanel (by key) to reseed its markers. There is no page refetch.
8. **Song visibility:** the song visibility button's `Published/Draft` copy becomes `Visible/Hidden`, so "Publish" means only one thing in the Studio.
9. **Removed code:** `saveSectionDraftTimeMap` (dead code) is deleted, and `draft_time_map_id` is marked `@deprecated` in `types/database.ts` and is no longer read.

## Review Focus

1. **Publishing right after an edit.** An admin edits, then presses Publish within the 1 s autosave window, or while a draft save is in flight. The published version must contain that last edit. Test: Task 5 (`flush` before `publish`) and Task 9.
2. **Switching sections mid-drag.** The SyncPanel's final timing change and the editor's unmount flush both land in the saved draft, regardless of React's cleanup order. Test: Task 5 (`the unmount flush waits a tick so a child's final setTiming lands`).
3. **A publish that fails partway.** Example: a section-overlap error from `publishTimeMap`. Then nothing live is written, no `published` row is inserted, the part stays unpublished, and the error shows next to that part. Test: Task 4.
4. **Students see nothing until Publish.** Autosave and restore never call `saveScoreDocument`, `publishTimeMap` or the anchor actions. Test: Tasks 3 and 8.
5. **Leaving a section with a draft, then coming back later:** the editor reopens on the draft, not the live content. After discard or publish from the popover, re-selecting that section shows the right content. Test: Task 6.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/043_studio_versions.sql` | table, index, admin-only RLS, deprecation comment |
| `types/database.ts` | `studio_versions` types, `@deprecated` on `draft_time_map_id` |
| `lib/supabase/require-admin.ts` | shared `requireAdmin` (moved out of the actions module) |
| `lib/playsense-studio/drafts/types.ts` | `StudioDraftOwner`, `ownerKey`, row types |
| `lib/playsense-studio/drafts/timing.ts` | `StudioTiming` + zod schema, `EMPTY_TIMING`, `readNudges`, live↔draft conversion |
| `lib/playsense-studio/drafts/policy.ts` | once-a-minute upsert, prune, unpublished detection |
| `lib/playsense-studio/drafts/changes.ts` | `diffParts`, `summarizeChanges` |
| `lib/playsense-studio/drafts/seed.ts` | `sectionSeed`, `workspaceSeed`: what an editor opens on (draft or live) |
| `lib/playsense-studio/drafts/timing-patch.ts` | `timingPatchFromMarkers`: SyncPanel markers → draft timing |
| `lib/playsense-studio/drafts/server.ts` | server-only: resolve owner, load live state, prune/clear drafts |
| `app/actions/studio-drafts.ts` | save/get/list/restore/discard/publish/preview actions |
| `components/playsense-studio/studio/drafts/drafts-context.tsx` | `StudioDraftsProvider`, `useStudioDrafts`, beforeunload |
| `components/playsense-studio/studio/drafts/use-studio-draft.ts` | per-owner autosave hook |
| `components/playsense-studio/studio/drafts/publish-control.tsx` | Publish button + popover |
| `components/playsense-studio/studio/drafts/history-panel.tsx` | History button + panel |
| `components/playsense-studio/studio/drafts/unpublished-dot.tsx` | the gold dot |

---

### Task 1: Migration, DB types, shared requireAdmin

**Files:**
- Create: `supabase/migrations/043_studio_versions.sql`
- Create: `lib/supabase/require-admin.ts`
- Modify: `types/database.ts` (add `studio_versions`; deprecate `draft_time_map_id` in Row/Insert/Update of `class_item_score_sections`)
- Modify: `app/actions/playsense-studio.ts`:
  - import `requireAdmin` from the new module and delete the local copy (currently `:412-426`)
  - delete `saveSectionDraftTimeMap` (currently `:830` onwards) and its input type
- Test: `lib/playsense-studio/drafts/__tests__/migration-043.test.ts`

**Interfaces:**
- Produces: `requireAdmin(supabase): Promise<{ userId: string } | { error: string }>`, and the table `studio_versions(id, owner_kind, owner_id, kind, score, timing, created_at, updated_at, created_by)`.

- [ ] **Step 1: Write the failing test** (it pins the migration's security shape; the SQL is never run in tests)

```ts
// lib/playsense-studio/drafts/__tests__/migration-043.test.ts
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
  it('enables RLS with one admin-only policy and no student read policy', () => {
    expect(sql).toMatch(/alter table studio_versions enable row level security/i);
    const policies = sql.match(/create policy/gi) ?? [];
    expect(policies).toHaveLength(1);
    expect(sql).toMatch(/for all to authenticated/i);
    expect(sql).toMatch(/is_admin = true/i);
    expect(sql).not.toMatch(/using \(true\)/i);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/migration-043.test.ts`
Expected: FAIL with ENOENT (the file doesn't exist yet).

- [ ] **Step 3: Write the migration**

```sql
-- 043_studio_versions.sql
-- PlaySense Studio drafts and history (spec §9). Admin-only: students keep
-- reading the live rows (score_documents, score_time_maps, …) exactly as today.
create table if not exists studio_versions (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('section', 'exercise', 'song')),
  owner_id uuid not null,
  kind text not null check (kind in ('draft', 'published')),
  score jsonb not null,
  timing jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists studio_versions_owner_idx
  on studio_versions (owner_kind, owner_id, updated_at desc);

alter table studio_versions enable row level security;

create policy "studio_versions_admin_all"
  on studio_versions for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

comment on column class_item_score_sections.draft_time_map_id is
  'DEPRECATED (2026-09, Studio rework P6): superseded by studio_versions. No longer read or written by the app.';
```

- [ ] **Step 4: Add the shared `requireAdmin`**

```ts
// lib/supabase/require-admin.ts
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Resolve the current user and assert admin. Returns userId or an error. */
export async function requireAdmin(
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
```

In `app/actions/playsense-studio.ts`:
- delete the local `requireAdmin` and add `import { requireAdmin } from '@/lib/supabase/require-admin';`
- delete `saveSectionDraftTimeMap` and its input type. Nothing calls it; confirm with `grep -rn saveSectionDraftTimeMap app components lib`, which must return nothing afterwards.
- Leave the other `draft_time_map_id` references in the actions (the publish cleanup still nulls and deletes old drafts). They are removed from the reader in Task 6.

- [ ] **Step 5: Add the DB types**

In `types/database.ts`, next to `score_documents` in `Tables` (alphabetical placement is fine), add:

```ts
      studio_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          owner_id: string
          owner_kind: string
          score: Json
          timing: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          owner_id: string
          owner_kind: string
          score: Json
          timing: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          owner_id?: string
          owner_kind?: string
          score?: Json
          timing?: Json
          updated_at?: string
        }
        Relationships: []
      }
```

Above each of the three `draft_time_map_id` fields of `class_item_score_sections`, add `/** @deprecated Superseded by studio_versions (Studio rework P6). */`.

- [ ] **Step 6: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/migration-043.test.ts && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/043_studio_versions.sql lib/supabase/require-admin.ts types/database.ts app/actions/playsense-studio.ts lib/playsense-studio/drafts/__tests__/migration-043.test.ts
git commit -m "Add the studio_versions table for Studio drafts and history"
```

---

### Task 2: Draft domain (owner, timing, policy, change summary)

**Files:**
- Create: `lib/playsense-studio/drafts/types.ts`, `timing.ts`, `policy.ts`, `changes.ts`
- Modify: `app/actions/playsense-studio.ts`: replace its private `readNudges` with `import { readNudges } from '@/lib/playsense-studio/drafts/timing'`
- Test: `lib/playsense-studio/drafts/__tests__/timing.test.ts`, `policy.test.ts`, `changes.test.ts`

**Interfaces:**
- Produces (exact names later tasks use):
  - `types.ts`:
    - `type StudioOwnerKind = 'section' | 'exercise' | 'song'`
    - `interface StudioDraftOwner { kind: StudioOwnerKind; id: string }`
    - `ownerKey(o): string` (returns `${kind}:${id}`)
    - `interface VersionMeta { id: string; kind: 'draft' | 'published'; created_at: string; updated_at: string }`
  - `timing.ts`:
    - `StudioWaypoint`, `StudioAnchor { seconds: number; qn: number | null }`, `StudioTiming { method; params; waypoints; anchor }`
    - `studioTimingSchema`, `EMPTY_TIMING`, `readNudges(params)`
    - `timingFromLive(map, anchor)`, `timingToTimeMap(t)`
  - `policy.ts`:
    - `DRAFT_ROW_MIN_AGE_MS`, `DRAFT_CAP`
    - `planDraftWrite(rows, nowMs)`, `draftIdsToPrune(rows, cap?)`, `unpublishedDraft(rows)`, `latestPublished(rows)`
  - `changes.ts`:
    - `diffParts(live, draft): { score: boolean; timing: boolean; anchor: boolean }`
    - `summarizeChanges(live, draft): string[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/drafts/__tests__/timing.test.ts
import { describe, expect, it } from 'vitest';
import { EMPTY_TIMING, readNudges, studioTimingSchema, timingFromLive, timingToTimeMap } from '../timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });

describe('studio timing', () => {
  it('seeds from a live map, keeping params and folding in nudges', () => {
    const t = timingFromLive(
      { method: 'drag', params: { pps: 40 }, waypoints: [wp(0, 1), wp(4, 3)], nudges: [{ qn: 1, deltaSeconds: 0.02 }] },
      { seconds: 1.5, qn: 1 }
    );
    expect(t).toEqual({
      method: 'drag',
      params: { pps: 40, nudges: [{ qn: 1, deltaSeconds: 0.02 }] },
      waypoints: [wp(0, 1), wp(4, 3)],
      anchor: { seconds: 1.5, qn: 1 },
    });
  });
  it('seeds an empty timing when there is no live map', () => {
    expect(timingFromLive(null, null)).toEqual(EMPTY_TIMING);
  });
  it('turns a draft timing back into the map shape the SyncPanel seeds from', () => {
    const t = timingFromLive({ method: 'drag', params: { nudges: [{ qn: 2, deltaSeconds: -0.01 }] }, waypoints: [wp(0, 0), wp(4, 2)] }, null);
    expect(timingToTimeMap(t)).toEqual({ id: 'draft', method: 'drag', waypoints: [wp(0, 0), wp(4, 2)], nudges: [{ qn: 2, deltaSeconds: -0.01 }] });
    expect(timingToTimeMap(EMPTY_TIMING)).toBeNull();
  });
  it('drops malformed nudges and rejects malformed timing', () => {
    expect(readNudges({ nudges: [{ qn: 1, deltaSeconds: 0.1 }, { qn: 'x' }] })).toEqual([{ qn: 1, deltaSeconds: 0.1 }]);
    expect(studioTimingSchema.safeParse({ method: 'drag', params: {}, waypoints: [{ musicalPositionQN: 'a' }], anchor: null }).success).toBe(false);
    expect(studioTimingSchema.safeParse(EMPTY_TIMING).success).toBe(true);
  });
});
```

```ts
// lib/playsense-studio/drafts/__tests__/policy.test.ts
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
```

```ts
// lib/playsense-studio/drafts/__tests__/changes.test.ts
import { describe, expect, it } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { diffParts, summarizeChanges } from '../changes';
import { EMPTY_TIMING, type StudioTiming } from '../timing';

function score(title: string, measures: unknown[]): ScoreDocument {
  return { title, tracks: [{ index: 0, measures }] } as unknown as ScoreDocument;
}
const m = (pitch: number, id = 'x') => ({ events: [{ id, kind: 'note', pitch }] });
const timed = (s: number): StudioTiming => ({ ...EMPTY_TIMING, waypoints: [
  { musicalPositionQN: 0, videoTimeSeconds: s, measureNumber: 1, beatInMeasure: 1 },
  { musicalPositionQN: 4, videoTimeSeconds: s + 2, measureNumber: 2, beatInMeasure: 1 },
] });

describe('change summary', () => {
  it('ignores event ids assigned on open', () => {
    const live = { score: score('A', [m(60, 'a')]), timing: EMPTY_TIMING };
    const draft = { score: score('A', [m(60, 'b')]), timing: EMPTY_TIMING };
    expect(diffParts(live, draft)).toEqual({ score: false, timing: false, anchor: false });
    expect(summarizeChanges(live, draft)).toEqual(['No changes from the live version']);
  });
  it('counts changed, added and removed bars, title, timing and anchor', () => {
    const live = { score: score('A', [m(60), m(62), m(64)]), timing: timed(1) };
    const draft = { score: score('B', [m(60), m(63), m(64), m(65), m(67)]), timing: { ...timed(1.5), anchor: { seconds: 2, qn: 0 } } };
    expect(summarizeChanges(live, draft)).toEqual([
      'Title changed', '1 bar changed', '2 bars added', 'Timing changed', 'Click anchor changed',
    ]);
    expect(summarizeChanges({ ...live, score: score('A', [m(60), m(62), m(64)]) }, { ...live, score: score('A', [m(60)]) }))
      .toEqual(['2 bars removed']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/`
Expected: FAIL (the modules don't exist yet).

- [ ] **Step 3: Write the modules**

```ts
// lib/playsense-studio/drafts/types.ts
export type StudioOwnerKind = 'section' | 'exercise' | 'song';

/** Who a draft belongs to. section = class_item_score_sections.id;
 *  exercise = class_items.id (a class item's own score); song = play_sense_songs.id. */
export interface StudioDraftOwner {
  kind: StudioOwnerKind;
  id: string;
}

export function ownerKey(o: StudioDraftOwner): string {
  return `${o.kind}:${o.id}`;
}

/** The columns the draft policy needs from a studio_versions row. */
export interface VersionMeta {
  id: string;
  kind: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}
```

```ts
// lib/playsense-studio/drafts/timing.ts
import { z } from 'zod';

const waypointSchema = z.object({
  musicalPositionQN: z.number(),
  videoTimeSeconds: z.number(),
  measureNumber: z.number().nullable(),
  beatInMeasure: z.number().nullable(),
});

export const studioTimingSchema = z.object({
  method: z.enum(['tempo', 'tap', 'drag', 'midi']),
  params: z.record(z.string(), z.unknown()),
  waypoints: z.array(waypointSchema),
  anchor: z.object({ seconds: z.number(), qn: z.number().nullable() }).nullable(),
});

export type StudioTiming = z.infer<typeof studioTimingSchema>;
export type StudioWaypoint = StudioTiming['waypoints'][number];
export type StudioAnchor = NonNullable<StudioTiming['anchor']>;
export type StudioNudge = { qn: number; deltaSeconds: number };

/** A song, or an owner never synced: no waypoints, no anchor. */
export const EMPTY_TIMING: StudioTiming = { method: 'drag', params: {}, waypoints: [], anchor: null };

/** params.nudges, defensively: anything malformed is dropped. */
export function readNudges(params: unknown): StudioNudge[] {
  const raw = (params as { nudges?: unknown } | null)?.nudges;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (n): n is StudioNudge =>
      !!n && typeof n.qn === 'number' && Number.isFinite(n.qn) &&
      typeof n.deltaSeconds === 'number' && Number.isFinite(n.deltaSeconds)
  );
}

const METHODS = ['tempo', 'tap', 'drag', 'midi'] as const;

/** Seed a draft timing from the live map (as the Studio loads it) and anchor. */
export function timingFromLive(
  map: {
    method: string;
    params?: Record<string, unknown> | null;
    waypoints: StudioWaypoint[];
    nudges?: StudioNudge[];
  } | null,
  anchor: StudioAnchor | null
): StudioTiming {
  if (!map) return { ...EMPTY_TIMING, anchor };
  const params: Record<string, unknown> = { ...(map.params ?? {}) };
  if (map.nudges && !('nudges' in params)) params.nudges = map.nudges;
  const method = (METHODS as readonly string[]).includes(map.method)
    ? (map.method as StudioTiming['method'])
    : 'drag';
  return { method, params, waypoints: map.waypoints.map((w) => ({ ...w })), anchor };
}

/** The map shape SyncPanel seeds its markers from; null when not synced. */
export function timingToTimeMap(t: StudioTiming): {
  id: string;
  method: string;
  waypoints: StudioWaypoint[];
  nudges: StudioNudge[];
} | null {
  if (t.waypoints.length < 2) return null;
  return { id: 'draft', method: t.method, waypoints: t.waypoints, nudges: readNudges(t.params) };
}
```

Readme check: the old private `readNudges` in `app/actions/playsense-studio.ts` has the same filter semantics. Replace it with the import, and check its call sites still type-check (`readNudges(tm.params)` returns `Array<{ qn; deltaSeconds }>`).

```ts
// lib/playsense-studio/drafts/policy.ts
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
```

```ts
// lib/playsense-studio/drafts/changes.ts
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { StudioTiming } from './timing';

export interface StudioContent {
  score: ScoreDocument;
  timing: StudioTiming;
}

// Event and tuplet ids are assigned on open and by edits; they carry no music.
const canon = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'id' ? undefined : x));
const round = (n: number) => Math.round(n * 1000) / 1000;
const timingCanon = (t: StudioTiming) =>
  canon({
    method: t.method,
    nudges: t.params.nudges ?? [],
    waypoints: t.waypoints.map((w) => [round(w.musicalPositionQN), round(w.videoTimeSeconds)]),
  });
const anchorCanon = (t: StudioTiming) =>
  t.anchor ? canon([round(t.anchor.seconds), t.anchor.qn == null ? null : round(t.anchor.qn)]) : 'null';

export function diffParts(live: StudioContent, draft: StudioContent) {
  return {
    score: canon(live.score) !== canon(draft.score),
    timing: timingCanon(live.timing) !== timingCanon(draft.timing),
    anchor: anchorCanon(live.timing) !== anchorCanon(draft.timing),
  };
}

const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`;

/** Human lines for the Publish popover, in a fixed order. */
export function summarizeChanges(live: StudioContent, draft: StudioContent): string[] {
  const lines: string[] = [];
  if (live.score.title !== draft.score.title) lines.push('Title changed');
  const a = live.score.tracks[0]?.measures ?? [];
  const b = draft.score.tracks[0]?.measures ?? [];
  let changed = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (canon(a[i]) !== canon(b[i])) changed++;
  if (changed) lines.push(`${bars(changed)} changed`);
  if (b.length > a.length) lines.push(`${bars(b.length - a.length)} added`);
  if (a.length > b.length) lines.push(`${bars(a.length - b.length)} removed`);
  const parts = diffParts(live, draft);
  if (parts.timing) lines.push('Timing changed');
  if (parts.anchor) lines.push('Click anchor changed');
  if (!lines.length && parts.score) lines.push('Score details changed');
  return lines.length ? lines : ['No changes from the live version'];
}
```

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/ && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/drafts app/actions/playsense-studio.ts
git commit -m "Add the Studio draft model: owners, timing, write policy and change summary"
```

---

### Task 3: Draft actions (save, load, list, restore, discard)

**Files:**
- Create: `lib/playsense-studio/drafts/server.ts`
- Create: `app/actions/studio-drafts.ts`
- Create: `lib/playsense-studio/drafts/__tests__/fake-supabase.ts`
- Modify: `app/actions/playsense-studio.ts`. In `loadTimeMap`, also return `params`. Add `params?: Record<string, unknown>` to `ClassItemScorePayload['activeTimeMap']`, filled with `(tm.params ?? {}) as Record<string, unknown>`.
- Test: `lib/playsense-studio/drafts/__tests__/draft-actions.test.ts`

**Interfaces:**
- Consumes: everything from Task 2; `requireAdmin` (Task 1); `parseScoreDocument` from `@/components/playsense-studio/shared/score-model/serialization`.
- Produces:
  - `saveStudioDraft(input: { owner: StudioDraftOwner; score: ScoreDocument; timing: StudioTiming }): Promise<{ updatedAt?: string; error?: string }>`
  - `getStudioDrafts(owners: StudioDraftOwner[]): Promise<{ data?: Record<string, StudioDraft>; error?: string }>`
    - `StudioDraft = { score: ScoreDocument; timing: StudioTiming; updatedAt: string }`
    - keyed by `ownerKey`; only owners with an unpublished draft appear
  - `listStudioVersions(owner): Promise<{ data?: StudioVersionListItem[]; error?: string }>`
    - `StudioVersionListItem = { id: string; kind: 'draft' | 'published'; createdAt: string; updatedAt: string; isLive: boolean }`, newest first
  - `restoreStudioVersion(input: { owner; versionId: string }): Promise<{ data?: StudioDraft; error?: string }>`
  - `discardStudioDraft(owner): Promise<{ data?: StudioDraft | null; error?: string }>`: returns the live content (as a `StudioDraft` whose `updatedAt` is `''`), or null for an owner with no live score
  - server.ts:
    - `resolveOwner(supabase, owner): Promise<{ data?: ResolvedOwner; error?: string }>`
    - `loadLiveContent(supabase, resolved): Promise<{ data?: { score: ScoreDocument; timing: StudioTiming }; error?: string }>`
    - `listVersionMeta(supabase, owner)`
    - `pruneDrafts(supabase, owner)`
    - `clearUnpublishedDrafts(supabase, owner)`
    - `insertVersion(supabase, owner, kind, content, userId)`

- [ ] **Step 1: Write the fake Supabase client used by the action tests**

```ts
// lib/playsense-studio/drafts/__tests__/fake-supabase.ts
// In-memory stand-in for the subset of the Supabase query builder the draft
// actions use: select/eq/neq/in/order/limit/single/maybeSingle/insert/update/delete.
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

export function createFakeSupabase(seed: Record<string, Row[]>, opts: { userId?: string | null; isAdmin?: boolean } = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, rows] of Object.entries(seed)) tables[k] = rows.map((r) => ({ ...r }));
  const userId = opts.userId === undefined ? 'admin-1' : opts.userId;
  tables.profiles ??= userId ? [{ id: userId, is_admin: opts.isAdmin ?? true }] : [];
  let seq = 0;

  function from(table: string) {
    tables[table] ??= [];
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row[] = [];
    let patch: Row = {};
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let mode: 'many' | 'single' | 'maybe' = 'many';

    const run = (): Result => {
      const all = tables[table];
      if (op === 'insert') {
        all.push(...payload);
        return finish(payload);
      }
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, patch));
        return finish(hit);
      }
      if (op === 'delete') {
        tables[table] = all.filter((r) => !hit.includes(r));
        return finish(hit);
      }
      let out = [...hit];
      if (order) {
        const { col, asc } = order;
        out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
      }
      if (limit != null) out = out.slice(0, limit);
      return finish(out);
    };
    const finish = (rows: Row[]): Result => {
      if (mode === 'many') return { data: rows.map((r) => ({ ...r })), error: null };
      if (rows.length === 0) return mode === 'maybe' ? { data: null, error: null } : { data: null, error: { message: 'No rows' } };
      return { data: { ...rows[0] }, error: null };
    };

    const q = {
      select: (_cols?: string) => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), q),
      limit: (n: number) => ((limit = n), q),
      single: () => ((mode = 'single'), q),
      maybeSingle: () => ((mode = 'maybe'), q),
      insert: (rows: Row | Row[]) => {
        op = 'insert';
        payload = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `id-${++seq}`, ...r }));
        return q;
      },
      update: (p: Row) => ((op = 'update'), (patch = p), q),
      delete: () => ((op = 'delete'), q),
      then: <T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) => Promise.resolve().then(run).then(resolve, reject),
    };
    return q;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from,
  };
  return { client, tables };
}
```

- [ ] **Step 2: Write the failing action tests**

```ts
// lib/playsense-studio/drafts/__tests__/draft-actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import { EMPTY_TIMING } from '../timing';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const live = vi.hoisted(() => ({
  saveScoreDocument: vi.fn(), publishTimeMap: vi.fn(), setSectionMetronomeAnchor: vi.fn(), setClassItemMetronomeAnchor: vi.fn(),
}));
vi.mock('@/app/actions/playsense-studio', () => live);

import {
  discardStudioDraft, getStudioDrafts, listStudioVersions, restoreStudioVersion, saveStudioDraft,
} from '@/app/actions/studio-drafts';

const T0 = Date.parse('2026-09-25T10:00:00.000Z');
const SCORE = { schemaVersion: 1, title: 'Tumbao', composer: null, initialTempo: 96, initialTimeSignature: { numerator: 4, denominator: 4 }, tracks: [{ index: 0, instrument: 'bass', displayName: 'Bass', tuning: null, measures: [] }] };
const section = { kind: 'section' as const, id: 'sec-1' };

function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{ id: 'sec-1', class_item_id: 'ci-1', score_document_id: 'doc-1', active_time_map_id: null, metronome_anchor_seconds: null, metronome_anchor_qn: null }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    studio_versions: [],
    ...extra,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  seed();
});
afterEach(() => vi.useRealTimers());

describe('saveStudioDraft', () => {
  it('writes a draft row and never touches the live rows', async () => {
    const res = await saveStudioDraft({ owner: section, score: SCORE as never, timing: EMPTY_TIMING });
    expect(res.error).toBeUndefined();
    const rows = h.fake!.tables.studio_versions;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ owner_kind: 'section', owner_id: 'sec-1', kind: 'draft', created_by: 'admin-1' });
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
    expect(live.publishTimeMap).not.toHaveBeenCalled();
    expect(live.setSectionMetronomeAnchor).not.toHaveBeenCalled();
  });
  it('updates the same row within a minute and adds a row after it', async () => {
    await saveStudioDraft({ owner: section, score: SCORE as never, timing: EMPTY_TIMING });
    vi.setSystemTime(T0 + 30_000);
    await saveStudioDraft({ owner: section, score: { ...SCORE, title: 'B' } as never, timing: EMPTY_TIMING });
    expect(h.fake!.tables.studio_versions).toHaveLength(1);
    expect((h.fake!.tables.studio_versions[0].score as { title: string }).title).toBe('B');
    vi.setSystemTime(T0 + 61_000);
    await saveStudioDraft({ owner: section, score: SCORE as never, timing: EMPTY_TIMING });
    expect(h.fake!.tables.studio_versions).toHaveLength(2);
  });
  it('rejects a non-admin and an invalid score', async () => {
    h.fake = createFakeSupabase({ studio_versions: [] }, { isAdmin: false });
    expect((await saveStudioDraft({ owner: section, score: SCORE as never, timing: EMPTY_TIMING })).error).toBe('Admin only');
    seed();
    expect((await saveStudioDraft({ owner: section, score: { nope: true } as never, timing: EMPTY_TIMING })).error).toBeTruthy();
    expect(h.fake!.tables.studio_versions).toHaveLength(0);
  });
});

describe('reading, restoring and discarding drafts', () => {
  const at = (ms: number) => new Date(T0 + ms).toISOString();
  const v = (id: string, kind: string, ms: number, title: string) => ({
    id, owner_kind: 'section', owner_id: 'sec-1', kind, score: { ...SCORE, title }, timing: EMPTY_TIMING, created_at: at(ms), updated_at: at(ms), created_by: 'admin-1',
  });

  it('returns only unpublished drafts, keyed by owner', async () => {
    seed({ studio_versions: [v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await getStudioDrafts([section, { kind: 'section', id: 'sec-2' }]);
    expect(Object.keys(res.data!)).toEqual(['section:sec-1']);
    expect(res.data!['section:sec-1'].score.title).toBe('Draft');
  });
  it('lists versions newest first with the live one marked', async () => {
    seed({ studio_versions: [v('p0', 'published', -9000, 'Old'), v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await listStudioVersions(section);
    expect(res.data!.map((r) => [r.id, r.kind, r.isLive])).toEqual([
      ['d1', 'draft', false], ['p1', 'published', true], ['p0', 'published', false],
    ]);
  });
  it('restores a version as a new draft without touching live', async () => {
    seed({ studio_versions: [v('p0', 'published', -9000, 'Old'), v('p1', 'published', -5000, 'Live')] });
    const res = await restoreStudioVersion({ owner: section, versionId: 'p0' });
    expect(res.data!.score.title).toBe('Old');
    const drafts = h.fake!.tables.studio_versions.filter((r) => r.kind === 'draft');
    expect(drafts).toHaveLength(1);
    expect(live.saveScoreDocument).not.toHaveBeenCalled();
  });
  it('refuses to restore another owner\'s version', async () => {
    seed({ studio_versions: [{ ...v('x', 'published', -9000, 'Other'), owner_id: 'sec-9' }] });
    expect((await restoreStudioVersion({ owner: section, versionId: 'x' })).error).toBe('Version not found');
  });
  it('discards unpublished drafts, keeps history, and returns the live content', async () => {
    seed({ studio_versions: [v('d0', 'draft', -9000, 'Older draft'), v('p1', 'published', -5000, 'Live'), v('d1', 'draft', -1000, 'Draft')] });
    const res = await discardStudioDraft(section);
    expect(h.fake!.tables.studio_versions.map((r) => r.id).sort()).toEqual(['d0', 'p1']);
    expect(res.data!.score.title).toBe('Tumbao');
    expect(res.data!.timing).toEqual(EMPTY_TIMING);
  });
});
```

If `parseScoreDocument` rejects this minimal `SCORE`, build it with the repo's blank-score factory (`grep -rn "export function createBlank" components/playsense-studio/shared lib/playsense-studio`) and override `title: 'Tumbao'`. Keep every expectation as written.

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/draft-actions.test.ts`
Expected: FAIL (`@/app/actions/studio-drafts` doesn't exist yet).

- [ ] **Step 4: Write the server helpers**

```ts
// lib/playsense-studio/drafts/server.ts
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
```

- [ ] **Step 5: Write the actions**

```ts
// app/actions/studio-drafts.ts
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
```

Note: `getStudioDrafts` reads one owner at a time. A lesson has at most a handful of sections, so the N+1 is acceptable. Don't optimise it.

- [ ] **Step 6: Have `loadTimeMap` return `params`**

In `app/actions/playsense-studio.ts`, add `params?: Record<string, unknown>;` to the `activeTimeMap` object type in `ClassItemScorePayload` (next to `nudges`). In `loadTimeMap`'s return, add `params: (tm.params ?? {}) as Record<string, unknown>,`.

- [ ] **Step 7: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/drafts/ && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 8: Commit**

```bash
git add lib/playsense-studio/drafts app/actions/studio-drafts.ts app/actions/playsense-studio.ts
git commit -m "Save, load, list, restore and discard Studio drafts"
```

---

### Task 4: Publish and preview, and clear drafts on Replace

**Files:**
- Modify: `app/actions/studio-drafts.ts` (add `publishStudioDraft`, `getPublishPreview`)
- Modify: `app/actions/playsense-studio.ts`:
  - in `replaceSectionScore`, after it succeeds, call `clearUnpublishedDrafts(supabase, { kind: 'section', id: input.sectionId })`
  - in `attachScoreFromImport`, when the class item already had a score (the replace path), call `clearUnpublishedDrafts(supabase, { kind: 'exercise', id: input.classItemId })`
- Test: `lib/playsense-studio/drafts/__tests__/publish-actions.test.ts`

**Interfaces:**
- Consumes: Task 3 helpers; the live actions `publishTimeMap`, `saveScoreDocument`, `setSectionMetronomeAnchor`, `setClassItemMetronomeAnchor` (signatures unchanged).
- Produces:
  - `publishStudioDraft(owner): Promise<{ publishedAt?: string; error?: string }>`
  - `getPublishPreview(owners): Promise<{ data?: Record<string, string[]>; error?: string }>`, keyed by `ownerKey`, holding `summarizeChanges` lines

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/drafts/__tests__/publish-actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';
import { EMPTY_TIMING, type StudioTiming } from '../timing';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const live = vi.hoisted(() => ({
  saveScoreDocument: vi.fn(), publishTimeMap: vi.fn(), setSectionMetronomeAnchor: vi.fn(), setClassItemMetronomeAnchor: vi.fn(),
}));
vi.mock('@/app/actions/playsense-studio', () => live);

import { getPublishPreview, publishStudioDraft } from '@/app/actions/studio-drafts';

const T0 = Date.parse('2026-09-25T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const SCORE = { schemaVersion: 1, title: 'Tumbao', composer: null, initialTempo: 96, initialTimeSignature: { numerator: 4, denominator: 4 }, tracks: [{ index: 0, instrument: 'bass', displayName: 'Bass', tuning: null, measures: [] }] };
const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const TIMED: StudioTiming = { method: 'drag', params: { nudges: [] }, waypoints: [wp(0, 1), wp(4, 3)], anchor: { seconds: 1, qn: 0 } };
const section = { kind: 'section' as const, id: 'sec-1' };

function seed(draft: { score?: object; timing?: StudioTiming }, liveMap = true) {
  h.fake = createFakeSupabase({
    class_item_score_sections: [{ id: 'sec-1', class_item_id: 'ci-1', score_document_id: 'doc-1', active_time_map_id: liveMap ? 'tm-1' : null, metronome_anchor_seconds: 1, metronome_anchor_qn: 0 }],
    score_documents: [{ id: 'doc-1', parsed_score: SCORE }],
    score_time_maps: [{ id: 'tm-1', method: 'drag', params: { nudges: [] } }],
    score_time_waypoints: [
      { time_map_id: 'tm-1', musical_position_qn: 0, video_time_seconds: 1, measure_number: null, beat_in_measure: null },
      { time_map_id: 'tm-1', musical_position_qn: 4, video_time_seconds: 3, measure_number: null, beat_in_measure: null },
    ],
    studio_versions: [{ id: 'd1', owner_kind: 'section', owner_id: 'sec-1', kind: 'draft', score: draft.score ?? SCORE, timing: draft.timing ?? TIMED, created_at: at(-1000), updated_at: at(-1000), created_by: 'admin-1' }],
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  live.saveScoreDocument.mockResolvedValue({ success: true });
  live.publishTimeMap.mockResolvedValue({ timeMapId: 'tm-2' });
  live.setSectionMetronomeAnchor.mockResolvedValue({ data: {} });
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
});

describe('getPublishPreview', () => {
  it('summarises each unpublished owner against live', async () => {
    seed({ score: { ...SCORE, title: 'New' } });
    const res = await getPublishPreview([section]);
    expect(res.data).toEqual({ 'section:sec-1': ['Title changed'] });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/publish-actions.test.ts`
Expected: FAIL (the exports don't exist yet).

- [ ] **Step 3: Implement**

Append to `app/actions/studio-drafts.ts`:

```ts
import {
  publishTimeMap,
  saveScoreDocument,
  setClassItemMetronomeAnchor,
  setSectionMetronomeAnchor,
} from '@/app/actions/playsense-studio';
import { diffParts, summarizeChanges } from '@/lib/playsense-studio/drafts/changes';

async function readUnpublished(supabase: Awaited<ReturnType<typeof createClient>>, owner: StudioDraftOwner) {
  const meta = await listVersionMeta(supabase, owner);
  if (meta.error) return { error: meta.error };
  const d = unpublishedDraft(meta.data ?? []);
  if (!d) return { data: null };
  const { data, error } = await supabase.from('studio_versions').select('score, timing').eq('id', d.id).single();
  if (error || !data) return { error: error?.message ?? 'Draft not found' };
  return { data: { score: data.score as unknown as ScoreDocument, timing: data.timing as unknown as StudioTiming } };
}

/** Draft → live, through the same actions the Studio used to call directly.
 *  Order: timing (its validation refuses before any write), score, anchor,
 *  then the published history row. Each part is written only if it changed. */
export async function publishStudioDraft(
  owner: StudioDraftOwner
): Promise<{ publishedAt?: string; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const draft = await readUnpublished(supabase, owner);
  if (draft.error) return { error: draft.error };
  if (!draft.data) return { error: 'Nothing to publish' };
  const resolved = await resolveOwner(supabase, owner);
  if (resolved.error) return { error: resolved.error };
  const r = resolved.data!;
  const liveContent = await loadLiveContent(supabase, r);
  if (liveContent.error) return { error: liveContent.error };
  const parts = diffParts(liveContent.data!, draft.data);
  const { score, timing } = draft.data;

  if (r.target && parts.timing && timing.waypoints.length >= 2) {
    const res = await publishTimeMap({
      classItemId: r.classItemId!, scoreDocumentId: r.scoreDocumentId, sectionId: r.sectionId ?? undefined,
      target: r.target, method: timing.method, params: timing.params, waypoints: timing.waypoints, makeActive: true,
    });
    if (res.error) return { error: res.error };
  }
  if (parts.score) {
    const res = await saveScoreDocument({ scoreDocumentId: r.scoreDocumentId, scoreDocument: score });
    if (res.error) return { error: res.error };
  }
  if (r.anchorKind && parts.anchor) {
    const anchorSeconds = timing.anchor?.seconds ?? null;
    const anchorQn = timing.anchor?.qn ?? null;
    const res = r.anchorKind === 'section'
      ? await setSectionMetronomeAnchor({ sectionId: r.sectionId!, anchorSeconds, anchorQn })
      : await setClassItemMetronomeAnchor({ classItemId: r.classItemId!, anchorSeconds, anchorQn });
    if (res.error) return { error: res.error };
  }
  const ins = await insertVersion(supabase, owner, 'published', draft.data, admin.userId);
  if (ins.error) return { error: ins.error };
  return { publishedAt: ins.data!.updatedAt };
}

export async function getPublishPreview(
  owners: StudioDraftOwner[]
): Promise<{ data?: Record<string, string[]>; error?: string }> {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if ('error' in admin) return { error: admin.error };
  const out: Record<string, string[]> = {};
  for (const owner of owners) {
    const draft = await readUnpublished(supabase, owner);
    if (draft.error) return { error: draft.error };
    if (!draft.data) continue;
    const resolved = await resolveOwner(supabase, owner);
    if (resolved.error) return { error: resolved.error };
    const liveContent = await loadLiveContent(supabase, resolved.data!);
    if (liveContent.error) return { error: liveContent.error };
    out[ownerKey(owner)] = summarizeChanges(liveContent.data!, draft.data);
  }
  return { data: out };
}
```

(Move the new imports to the top of the file with the others.)

Add the Replace hooks in `app/actions/playsense-studio.ts`, importing `clearUnpublishedDrafts` from `@/lib/playsense-studio/drafts/server`:
- `replaceSectionScore`: after the section row points at the new document and before `return`, add `await clearUnpublishedDrafts(supabase, { kind: 'section', id: input.sectionId });`.
- `attachScoreFromImport`: read the function first. Where it replaces an existing `class_items.score_document_id` (the branch that deletes or detaches the old document), add `await clearUnpublishedDrafts(supabase, { kind: 'exercise', id: input.classItemId });` after the class item points at the new document.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/drafts/ && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 5: Commit**

```bash
git add app/actions/studio-drafts.ts app/actions/playsense-studio.ts lib/playsense-studio/drafts/__tests__/publish-actions.test.ts
git commit -m "Publish a Studio draft through the live actions and preview what changes"
```

---

### Task 5: Drafts context and the `useStudioDraft` hook

**Files:**
- Create: `components/playsense-studio/studio/drafts/drafts-context.tsx`
- Create: `components/playsense-studio/studio/drafts/use-studio-draft.ts`
- Test: `components/playsense-studio/studio/drafts/__tests__/use-studio-draft.test.tsx`, `drafts-context.test.tsx`

**Interfaces:**
- Consumes: `saveStudioDraft`, `publishStudioDraft`, `discardStudioDraft` (Tasks 3–4); `queueStudioSave`; the `StudioDraftOwner`, `ownerKey` and `StudioTiming` types.
- Produces:
  - `StudioDraftsProvider({ owners, children })`
    - `owners: Array<{ owner: StudioDraftOwner; label: string; unpublished: boolean }>`
    - A nested provider seeds its owners into the parent and renders children against the parent's value.
  - `useStudioDrafts(): StudioDraftsValue`:
    ```ts
    interface StudioDraftsValue {
      statuses: Record<string, { owner: StudioDraftOwner; label: string; unpublished: boolean }>;
      setStatus(owner: StudioDraftOwner, patch: { label?: string; unpublished?: boolean }): void;
      setPending(key: string, pending: boolean): void;
      register(key: string, handlers: OwnerHandlers): () => void;
      flush(key: string): Promise<void>;
      publish(owner: StudioDraftOwner): Promise<{ error?: string }>;
      discard(owner: StudioDraftOwner): Promise<{ error?: string }>;
      notifyAdopt(key: string, content: StudioContent): void;
    }
    interface OwnerHandlers {
      flush?: () => Promise<void>;
      adopt?: (c: StudioContent) => void;
      changed?: () => void;
    }
    ```
    - `publish` flushes the owner first, then calls `publishStudioDraft`, then clears `unpublished` and calls every `changed` handler for that key.
    - `discard` calls `discardStudioDraft`, then `adopt` with the returned live content, then clears `unpublished` and calls `changed`.
    - Multiple registrations per key are allowed; each handler set is called.
  - `useStudioDraft(opts)` returns `StudioDraftApi`:
    ```ts
    useStudioDraft(opts: {
      owner: StudioDraftOwner; label: string;
      score: ScoreDocument; isDirty: boolean; markClean: () => void; replaceScore: (s: ScoreDocument) => void;
      initialTiming: StudioTiming;
    }): StudioDraftApi
    interface StudioDraftApi {
      timing: StudioTiming;
      /** Bumps when timing is replaced wholesale (restore/discard); key SyncPanel on it. */
      timingEpoch: number;
      setTiming(patch: Partial<StudioTiming>): void;
      replaceTiming(t: StudioTiming): void;
      flush(): Promise<void>;
      saveState: 'idle' | 'saving' | 'saved' | 'error';
      error: string | null;
      pending: boolean; // unsaved local edits (score dirty or timing changed since last save)
    }
    ```
    - It autosaves 1000 ms after the last score or timing change. It registers `flush` and `adopt` with the context.
    - On success it sets the owner's status to `{ unpublished: true, label }`.
    - Its unmount flush runs one `setTimeout(0)` tick later, so a child's final `setTiming` in its own cleanup is included.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/playsense-studio/studio/drafts/__tests__/use-studio-draft.test.tsx
// @vitest-environment jsdom
import React, { act, useEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);

import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';
import { useStudioDraft, type StudioDraftApi } from '../use-studio-draft';

type S = { title: string };
const owner = { kind: 'section' as const, id: 'sec-1' };
let root: Root;
let host: HTMLDivElement;
let api: StudioDraftApi;
let ctx: StudioDraftsValue;
let edit: (title: string) => void;

function Editor({ onUnmountTiming }: { onUnmountTiming?: boolean }) {
  const [state, dispatch] = useReducer(
    (s: { score: S; isDirty: boolean }, a: { type: 'edit'; title: string } | { type: 'clean' } | { type: 'replace'; score: S }) =>
      a.type === 'edit' ? { score: { title: a.title }, isDirty: true } : a.type === 'clean' ? { ...s, isDirty: false } : { score: a.score, isDirty: false },
    { score: { title: 'A' }, isDirty: false }
  );
  edit = (title) => dispatch({ type: 'edit', title });
  api = useStudioDraft({
    owner, label: 'Intro', score: state.score as never, isDirty: state.isDirty,
    markClean: () => dispatch({ type: 'clean' }), replaceScore: (s) => dispatch({ type: 'replace', score: s as never }),
    initialTiming: EMPTY_TIMING,
  });
  return <>{onUnmountTiming && <TimingChild setTiming={api.setTiming} />}</>;
}
function TimingChild({ setTiming }: { setTiming: StudioDraftApi['setTiming'] }) {
  useEffect(() => () => setTiming({ params: { final: true } }), [setTiming]);
  return null;
}
function Probe() {
  ctx = useStudioDrafts();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  acts.saveStudioDraft.mockResolvedValue({ updatedAt: '2026-09-25T10:00:00.000Z' });
  acts.publishStudioDraft.mockResolvedValue({ publishedAt: '2026-09-25T10:00:01.000Z' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const mount = (children: React.ReactNode) =>
  act(() => root.render(<StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe />{children}</StudioDraftsProvider>));

describe('useStudioDraft', () => {
  it('saves a draft 1 s after the last edit and marks the owner unpublished', async () => {
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(999); });
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith({ owner, score: { title: 'B' }, timing: EMPTY_TIMING });
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(true);
    expect(api.saveState).toBe('saved');
  });
  it('saves timing changes even when the score is clean', async () => {
    mount(<Editor />);
    act(() => api.setTiming({ anchor: { seconds: 2, qn: 1 } }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ timing: { ...EMPTY_TIMING, anchor: { seconds: 2, qn: 1 } } }));
  });
  it('publish flushes a pending edit first, so the last edit is published', async () => {
    mount(<Editor />);
    act(() => edit('Last'));
    await act(async () => { await ctx.publish(owner); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ score: { title: 'Last' } }));
    expect(acts.saveStudioDraft.mock.invocationCallOrder[0]).toBeLessThan(acts.publishStudioDraft.mock.invocationCallOrder[0]);
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });
  it('the unmount flush waits a tick so a child\'s final setTiming lands', async () => {
    mount(<Editor onUnmountTiming />);
    act(() => edit('B'));
    act(() => root.render(<StudioDraftsProvider owners={[]}><Probe /></StudioDraftsProvider>));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ score: { title: 'B' }, timing: expect.objectContaining({ params: { final: true } }) }));
  });
  it('discard adopts the live content into the editor and bumps the timing epoch', async () => {
    acts.discardStudioDraft.mockResolvedValue({ data: { score: { title: 'Live' }, timing: EMPTY_TIMING, updatedAt: '' } });
    mount(<Editor />);
    const epoch = api.timingEpoch;
    await act(async () => { await ctx.discard(owner); });
    expect(api.timingEpoch).toBe(epoch + 1);
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();
  });
  it('shows an error and stops retrying when the save fails', async () => {
    acts.saveStudioDraft.mockResolvedValue({ error: 'Admin only' });
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(api.saveState).toBe('error');
    expect(api.error).toBe('Admin only');
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
  });
});
```

```tsx
// components/playsense-studio/studio/drafts/__tests__/drafts-context.test.tsx
// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions/studio-drafts', () => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn() }));
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';

let root: Root;
let host: HTMLDivElement;
let outer: StudioDraftsValue;
let inner: StudioDraftsValue;
const Outer = () => ((outer = useStudioDrafts()), null);
const Inner = () => ((inner = useStudioDrafts()), null);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('StudioDraftsProvider', () => {
  it('a nested provider shares the root value and seeds its owners into it', () => {
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner: { kind: 'exercise', id: 'ci-1' }, label: 'Exercise', unpublished: false }]}>
        <Outer />
        <StudioDraftsProvider owners={[{ owner: { kind: 'section', id: 's1' }, label: 'Intro', unpublished: true }]}>
          <Inner />
        </StudioDraftsProvider>
      </StudioDraftsProvider>
    ));
    expect(Object.keys(outer.statuses).sort()).toEqual(['exercise:ci-1', 'section:s1']);
    expect(inner.statuses).toBe(outer.statuses);
  });
  it('warns before unload while anything is unpublished or unsaved', () => {
    act(() => root.render(<StudioDraftsProvider owners={[{ owner: { kind: 'song', id: 'x' }, label: 'Song', unpublished: false }]}><Outer /></StudioDraftsProvider>));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    act(() => outer.setPending('song:x', true));
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    act(() => { outer.setPending('song:x', false); outer.setStatus({ kind: 'song', id: 'x' }, { unpublished: true }); });
    const unpub = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unpub);
    expect(unpub.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/playsense-studio/studio/drafts/`
Expected: FAIL (the modules don't exist yet).

- [ ] **Step 3: Write the context**

```tsx
// components/playsense-studio/studio/drafts/drafts-context.tsx
'use client';

// Lesson-wide draft state: which owners (sections, the exercise score, a song)
// have unpublished drafts, plus publish/discard and the leave-page warning.
// The OUTERMOST provider owns the state; nested providers (the workspaces inside
// ExerciseStudio) only seed their owners into it and reuse its value.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { discardStudioDraft, publishStudioDraft } from '@/app/actions/studio-drafts';
import type { StudioContent } from '@/lib/playsense-studio/drafts/changes';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';

export interface OwnerStatus {
  owner: StudioDraftOwner;
  label: string;
  unpublished: boolean;
}

export interface OwnerHandlers {
  flush?: () => Promise<void>;
  adopt?: (c: StudioContent) => void;
  changed?: () => void;
}

export interface StudioDraftsValue {
  statuses: Record<string, OwnerStatus>;
  setStatus(owner: StudioDraftOwner, patch: { label?: string; unpublished?: boolean }): void;
  setPending(key: string, pending: boolean): void;
  register(key: string, handlers: OwnerHandlers): () => void;
  flush(key: string): Promise<void>;
  publish(owner: StudioDraftOwner): Promise<{ error?: string }>;
  discard(owner: StudioDraftOwner): Promise<{ error?: string }>;
  notifyAdopt(key: string, content: StudioContent): void;
}

const Ctx = createContext<StudioDraftsValue | null>(null);

export function useStudioDrafts(): StudioDraftsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudioDrafts must be used inside StudioDraftsProvider');
  return v;
}

export function StudioDraftsProvider({ owners, children }: { owners: OwnerStatus[]; children: React.ReactNode }) {
  const parent = useContext(Ctx);
  if (parent) return <NestedSeed parent={parent} owners={owners}>{children}</NestedSeed>;
  return <RootProvider owners={owners}>{children}</RootProvider>;
}

function NestedSeed({ parent, owners, children }: { parent: StudioDraftsValue; owners: OwnerStatus[]; children: React.ReactNode }) {
  // Seed once per owner set; statuses already known to the root win.
  const seedKey = owners.map((o) => ownerKey(o.owner)).join('|');
  useEffect(() => {
    for (const o of owners) {
      if (!parent.statuses[ownerKey(o.owner)]) parent.setStatus(o.owner, { label: o.label, unpublished: o.unpublished });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);
  return <Ctx.Provider value={parent}>{children}</Ctx.Provider>;
}

function RootProvider({ owners, children }: { owners: OwnerStatus[]; children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, OwnerStatus>>(() =>
    Object.fromEntries(owners.map((o) => [ownerKey(o.owner), o]))
  );
  const [pending, setPendingMap] = useState<Record<string, boolean>>({});
  const handlers = useRef(new Map<string, Set<OwnerHandlers>>());

  const setStatus = useCallback((owner: StudioDraftOwner, patch: { label?: string; unpublished?: boolean }) => {
    setStatuses((prev) => {
      const key = ownerKey(owner);
      const cur = prev[key] ?? { owner, label: '', unpublished: false };
      const next = { ...cur, ...patch };
      if (cur.label === next.label && cur.unpublished === next.unpublished && prev[key]) return prev;
      return { ...prev, [key]: next };
    });
  }, []);

  const setPending = useCallback((key: string, p: boolean) => {
    setPendingMap((prev) => (!!prev[key] === p ? prev : { ...prev, [key]: p }));
  }, []);

  const register = useCallback((key: string, h: OwnerHandlers) => {
    let set = handlers.current.get(key);
    if (!set) handlers.current.set(key, (set = new Set()));
    set.add(h);
    return () => { set!.delete(h); };
  }, []);

  const each = (key: string) => [...(handlers.current.get(key) ?? [])];

  const flush = useCallback(async (key: string) => {
    await Promise.all(each(key).map((h) => h.flush?.()));
  }, []);

  const notifyAdopt = useCallback((key: string, content: StudioContent) => {
    each(key).forEach((h) => h.adopt?.(content));
  }, []);

  const publish = useCallback(async (owner: StudioDraftOwner) => {
    const key = ownerKey(owner);
    await flush(key);
    const res = await publishStudioDraft(owner);
    if (res.error) return { error: res.error };
    setStatus(owner, { unpublished: false });
    each(key).forEach((h) => h.changed?.());
    return {};
  }, [flush, setStatus]);

  const discard = useCallback(async (owner: StudioDraftOwner) => {
    const key = ownerKey(owner);
    const res = await discardStudioDraft(owner);
    if (res.error) return { error: res.error };
    if (res.data) notifyAdopt(key, { score: res.data.score, timing: res.data.timing });
    setStatus(owner, { unpublished: false });
    each(key).forEach((h) => h.changed?.());
    return {};
  }, [notifyAdopt, setStatus]);

  // Leaving with unsaved or unpublished work asks the browser to confirm.
  const blockRef = useRef(false);
  blockRef.current = Object.values(pending).some(Boolean) || Object.values(statuses).some((s) => s.unpublished);
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = useMemo<StudioDraftsValue>(
    () => ({ statuses, setStatus, setPending, register, flush, publish, discard, notifyAdopt }),
    [statuses, setStatus, setPending, register, flush, publish, discard, notifyAdopt]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 4: Write the hook**

```ts
// components/playsense-studio/studio/drafts/use-studio-draft.ts
'use client';

// One owner's autosave-to-draft. Replaces the hosts' old persist() that wrote
// the live score directly. Score changes arrive via useEditor's isDirty; timing
// changes via setTiming (SyncPanel). Both are saved together as one draft row.
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveStudioDraft } from '@/app/actions/studio-drafts';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export const DRAFT_AUTOSAVE_MS = 1000;

export interface StudioDraftApi {
  timing: StudioTiming;
  timingEpoch: number;
  setTiming(patch: Partial<StudioTiming>): void;
  replaceTiming(t: StudioTiming): void;
  flush(): Promise<void>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
  pending: boolean;
}

export function useStudioDraft(opts: {
  owner: StudioDraftOwner;
  label: string;
  score: ScoreDocument;
  isDirty: boolean;
  markClean: () => void;
  replaceScore: (s: ScoreDocument) => void;
  initialTiming: StudioTiming;
}): StudioDraftApi {
  const { owner, label, score, isDirty, markClean, replaceScore } = opts;
  const key = ownerKey(owner);
  const ctx = useStudioDrafts();

  const [timing, setTimingState] = useState(opts.initialTiming);
  const [timingEpoch, setTimingEpoch] = useState(0);
  const [timingDirty, setTimingDirty] = useState(false);
  const [saveState, setSaveState] = useState<StudioDraftApi['saveState']>('idle');
  const [error, setError] = useState<string | null>(null);

  // Latest values for timers and the unmount flush.
  const latest = useRef({ score, isDirty, timing, timingDirty, label });
  latest.current = { score, isDirty, timing, timingDirty, label };
  const timingRef = useRef(timing);

  const setTiming = useCallback((patch: Partial<StudioTiming>) => {
    const next = { ...timingRef.current, ...patch };
    timingRef.current = next;
    latest.current.timing = next;
    latest.current.timingDirty = true;
    setTimingState(next);
    setTimingDirty(true);
  }, []);

  const replaceTiming = useCallback((t: StudioTiming) => {
    timingRef.current = t;
    latest.current.timing = t;
    latest.current.timingDirty = false;
    setTimingState(t);
    setTimingDirty(false);
    setTimingEpoch((e) => e + 1);
  }, []);

  const save = useCallback(async (opts2?: { silent?: boolean }) => {
    const snap = latest.current;
    if (!snap.isDirty && !snap.timingDirty) return;
    if (!opts2?.silent) { setSaveState('saving'); setError(null); }
    const res = await queueStudioSave(`draft:${key}`, () =>
      saveStudioDraft({ owner, score: snap.score, timing: snap.timing })
    ).catch(() => ({ error: 'Could not save. Check your connection and retry.' } as { error: string; updatedAt?: string }));
    if (res.error) {
      if (!opts2?.silent) { setSaveState('error'); setError(res.error); }
      return;
    }
    ctx.setStatus(owner, { unpublished: true, label: snap.label });
    if (opts2?.silent) return;
    setSaveState('saved');
    // Only clean what this save covered; later edits keep their dirty flags.
    if (latest.current.score === snap.score) markClean();
    if (timingRef.current === snap.timing) { latest.current.timingDirty = false; setTimingDirty(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, markClean, ctx.setStatus]);

  // Debounced autosave; a failed save waits for flush() (Save now / publish).
  useEffect(() => {
    if ((!isDirty && !timingDirty) || saveState === 'error' || saveState === 'saving') return;
    const id = setTimeout(() => { void save(); }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [isDirty, timingDirty, score, timing, saveState, save]);

  const pending = isDirty || timingDirty;
  useEffect(() => { ctx.setPending(key, pending); }, [ctx.setPending, key, pending]);

  const flush = useCallback(async () => {
    setSaveState((s) => (s === 'error' ? 'idle' : s));
    await save();
  }, [save]);

  const adopt = useCallback((c: { score: ScoreDocument; timing: StudioTiming }) => {
    replaceScore(c.score);
    latest.current.isDirty = false;
    replaceTiming(c.timing);
    setSaveState('idle');
    setError(null);
  }, [replaceScore, replaceTiming]);

  useEffect(() => ctx.register(key, { flush, adopt }), [ctx.register, key, flush, adopt]);

  // Unmount: wait one tick so children's cleanup setTiming calls land first.
  useEffect(() => {
    return () => {
      ctx.setPending(key, false);
      setTimeout(() => { void save({ silent: true }); }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { ctx.setStatus(owner, { label }); /* keep the popover label fresh */ }, [label]); // eslint-disable-line react-hooks/exhaustive-deps

  return { timing, timingEpoch, setTiming, replaceTiming, flush, saveState, error, pending };
}
```

Notes for the implementer:
- `ctx.setStatus`, `ctx.setPending` and `ctx.register` are stable (`useCallback` with no deps), so depending on them doesn't re-run effects.
- The silent unmount save reads `latest.current` after the tick, so it also sees the child's final `setTiming`.
- If the repo's lint forbids the inline `eslint-disable` comments, fold the dependencies in explicitly instead; behaviour must stay the same.

- [ ] **Step 5: Run the tests and tsc**

Run: `npx vitest run components/playsense-studio/studio/drafts/ && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 6: Commit**

```bash
git add components/playsense-studio/studio/drafts
git commit -m "Add the Studio drafts context and the per-owner draft autosave hook"
```

---

### Task 6: Sections use drafts

**Files:**
- Modify: `app/actions/playsense-studio.ts`:
  - `ClassItemScoreSection`: replace `draftTimeMap` with `studioDraft: StudioDraft | null`, and stop selecting and loading `draft_time_map_id` in `getScoreSectionsForClassItem`
  - fill `studioDraft` from one `getStudioDrafts(sections.map(s => ({ kind: 'section', id: s.id })))` call after the loop
- Modify: `components/playsense-studio/studio/score-section-editor.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx`
- Create: `components/playsense-studio/studio/drafts/unpublished-dot.tsx`
- Create: `lib/playsense-studio/drafts/seed.ts`
- Test: `lib/playsense-studio/drafts/__tests__/section-seed.test.ts`

**Interfaces:**
- Consumes: `useStudioDraft`, `StudioDraftsProvider`, `useStudioDrafts` (Task 5); `timingFromLive`, `timingToTimeMap` (Task 2); `getStudioDrafts`, and the `StudioDraft` type (Task 3).
- Produces:
  - `ScoreSectionEditor` no longer takes `hasDraft`, and no longer calls `saveScoreDocument`.
  - `VideoSectionsWorkspace` wraps its tree in a `StudioDraftsProvider` seeded from `initialSections`.
  - `UnpublishedDot({ className? })` renders `<span className="st-unpub-dot" role="img" aria-label="Unpublished changes" />`.
  - `sectionSeed(section: ClassItemScoreSection): { score: ScoreDocument; timing: StudioTiming; timeMap: PlaysenseStudioPlayerTimeMap | null; anchorSeconds: number | null }` is exported from `lib/playsense-studio/drafts/seed.ts`. It's a pure module with type-only imports from the actions and components, so node-environment tests can load it.

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/drafts/__tests__/section-seed.test.ts
import { describe, expect, it } from 'vitest';
import { sectionSeed } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const base = {
  sectionId: 's1', sectionIndex: 0, label: null, videoStartSeconds: 1, videoEndSeconds: 3,
  metronomeAnchorSeconds: 1, metronomeAnchorQn: 0, tracks: [],
  scoreDocument: { id: 'doc-1', title: 'Live', composer: null, parsedScore: { title: 'Live' } },
  activeTimeMap: { id: 'tm-1', method: 'drag', params: { pps: 40 }, waypoints: [wp(0, 1), wp(4, 3)], nudges: [] },
};

describe('sectionSeed', () => {
  it('opens on the live content when there is no draft', () => {
    const seed = sectionSeed({ ...base, studioDraft: null } as never);
    expect((seed.score as { title: string }).title).toBe('Live');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 1), wp(4, 3)]);
    expect(seed.timing.anchor).toEqual({ seconds: 1, qn: 0 });
    expect(seed.anchorSeconds).toBe(1);
  });
  it('opens on the draft when one exists', () => {
    const timing = { ...EMPTY_TIMING, waypoints: [wp(0, 2), wp(4, 4)], anchor: { seconds: 2, qn: 0 } };
    const seed = sectionSeed({ ...base, studioDraft: { score: { title: 'Draft' }, timing, updatedAt: 'x' } } as never);
    expect((seed.score as { title: string }).title).toBe('Draft');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 2), wp(4, 4)]);
    expect(seed.anchorSeconds).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/section-seed.test.ts`
Expected: FAIL (`sectionSeed` isn't exported yet).

- [ ] **Step 3: Load drafts with the sections**

In `app/actions/playsense-studio.ts`:
- Import `getStudioDrafts` and `type StudioDraft` from `@/app/actions/studio-drafts`.
- In `ClassItemScoreSection`, replace the `draftTimeMap` field and its comment with:

```ts
  /** The admin's unpublished draft for this section (studio_versions), or null.
   *  Students never receive this. The Studio opens on it when present. */
  studioDraft: StudioDraft | null;
```

In `getScoreSectionsForClassItem`:
- remove `draft_time_map_id` from the select string
- delete the `loadTimeMap(... row.draft_time_map_id)` lines
- push `studioDraft: null`
- after the loop, before `return`, add:

```ts
  const drafts = await getStudioDrafts(out.map((s) => ({ kind: 'section' as const, id: s.sectionId })));
  if (drafts.error) return { error: drafts.error };
  for (const s of out) s.studioDraft = drafts.data?.[`section:${s.sectionId}`] ?? null;
```

- [ ] **Step 4: Seed the section editor from the draft or live, and wire the hook**

Create `lib/playsense-studio/drafts/seed.ts`:

```ts
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio';
import { timingFromLive, timingToTimeMap } from './timing';

/** What a section's editor opens on: its unpublished draft, else what students see. */
export function sectionSeed(s: ClassItemScoreSection) {
  const timing = s.studioDraft?.timing ?? timingFromLive(
    s.activeTimeMap,
    s.metronomeAnchorSeconds == null ? null : { seconds: s.metronomeAnchorSeconds, qn: s.metronomeAnchorQn }
  );
  return {
    score: s.studioDraft?.score ?? s.scoreDocument.parsedScore,
    timing,
    timeMap: timingToTimeMap(timing),
    anchorSeconds: timing.anchor?.seconds ?? null,
  };
}
```

Then in `VideoSectionsWorkspace` (import `sectionSeed` from `@/lib/playsense-studio/drafts/seed`):
- Wrap the returned JSX in:

  ```tsx
  <StudioDraftsProvider owners={initialSections.map((s) => ({
    owner: { kind: 'section', id: s.sectionId },
    label: s.studioDraft?.score.title ?? s.scoreDocument.title,
    unpublished: s.studioDraft != null,
  }))}>
  ```

  Put the body in an inner component `VideoSectionsBody` so it can call `useStudioDrafts()`.
- **Refetch after changes elsewhere:** in the inner component, register a `changed` handler for every section key that runs `refetch(selectedIdRef.current ?? undefined)`. Sections not currently mounted then reseed from fresh data after a publish or discard from the popover. Use a `selectedIdRef` mirrored from `selectedId`, and re-register whenever the set of section ids changes.
- **Section row name:** show `s.studioDraft?.score.title ?? s.scoreDocument.title`.
- **Dot:** add `{statuses[`section:${s.sectionId}`]?.unpublished && <UnpublishedDot />}` right after the name span.
- **Editor props:** pass `initialScore={seed.score}`, `activeTimeMap={seed.timeMap}`, `initialTiming={seed.timing}` and `initialMetronomeAnchorSeconds={seed.anchorSeconds}` (with `const seed = sectionSeed(selected)`), and remove `hasDraft`.

In `score-section-editor.tsx`:
- Remove `hasDraft` and `AUTOSAVE_INTERVAL_MS`, and add the prop `initialTiming: StudioTiming`.
- Delete `persist`, the autosave effect, the unmount flush, `savingState`, `isPending`/`startTransition` (if now unused) and `savingRef`, and remove the `saveScoreDocument` and `queueStudioSave` imports.
- Add:

```ts
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean, replaceScore } = useEditor(initialScore);
  const draft = useStudioDraft({
    owner: { kind: 'section', id: sectionId },
    label: state.score.title,
    score: state.score,
    isDirty: state.isDirty,
    markClean,
    replaceScore,
    initialTiming,
  });
```

- The rename refresh: keep `lastSyncedTitleRef`. Add an effect that, when `draft.saveState === 'saved'` and `state.score.title !== lastSyncedTitleRef.current`, updates the ref and calls `onChanged()`.
- ⌘S calls `void draft.flush()`.
- Status span:

```tsx
            <span role="status" className="text-right text-xs tabular-nums text-muted-foreground">
              {draft.saveState === 'saving'
                ? 'Saving draft…'
                : draft.saveState === 'error'
                  ? 'Save failed'
                  : draft.pending
                    ? 'Saving soon…'
                    : draft.saveState === 'saved'
                      ? 'Draft saved'
                      : 'Autosave on'}
            </span>
```

- The Save button: `onClick={() => void draft.flush()}`, `disabled={!draft.pending}`, and label `{draft.saveState === 'error' ? 'Retry save' : 'Save now'}`.
- The error banner shows `draft.error`.
- `<SyncPanel key={draft.timingEpoch} … />`: remove `hasDraft`. The timing wiring comes in Task 8.
- Replace score keeps `replaceSectionScore` (live, as before; Task 4 clears the drafts server-side).

Create `unpublished-dot.tsx`:

```tsx
// components/playsense-studio/studio/drafts/unpublished-dot.tsx
import { cn } from '@/lib/utils';

export function UnpublishedDot({ className }: { className?: string }) {
  return <span className={cn('st-unpub-dot', className)} role="img" aria-label="Unpublished changes" />;
}
```

Add to `app/globals.css`, next to the other `.st-*` chip rules:

```css
.st-unpub-dot { display: inline-block; width: 7px; height: 7px; border-radius: 9999px; background: hsl(var(--gold-highlight)); flex-shrink: 0; }
```

Before writing, check how `--gold-highlight` is declared (`grep -n "gold-highlight" app/globals.css`). If it's a full color rather than HSL channels, use `var(--gold-highlight)` directly.

- [ ] **Step 5: Run the tests and tsc**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean. `grep -rn "draftTimeMap\|hasDraft" app components lib --include='*.ts*' | grep -v __tests__` should list only `sync-panel.tsx`'s own `hasDraft` prop, which is removed in Task 8.

- [ ] **Step 6: Commit**

```bash
git add app/actions/playsense-studio.ts components/playsense-studio/studio/score-section-editor.tsx 'app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx' components/playsense-studio/studio/drafts app/globals.css
git commit -m "Autosave section edits to drafts and open sections on their draft"
```

---

### Task 7: The exercise, class-item and song scores use drafts

**Files:**
- Modify: `app/admin/playsense-studio/[classItemId]/studio-workspace.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/exercise-studio.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/page.tsx`
- Modify: `app/admin/playsense-studio/song/[songId]/page.tsx`
- Modify: `lib/playsense-studio/drafts/seed.ts` (add `workspaceSeed`)
- Test: `lib/playsense-studio/drafts/__tests__/workspace-seed.test.ts`

**Interfaces:**
- Consumes: Task 5 hook and provider; `getStudioDrafts`; `timingFromLive`, `timingToTimeMap`.
- Produces:
  - `StudioWorkspaceProps` gains `studioDraft?: StudioDraft | null` (the owner's unpublished draft).
  - `ExerciseStudioProps` gains `initialExerciseDraft: StudioDraft | null`, `initialSectionOwners` (derived from the sections, not a new prop) and `fetchExerciseDraft: () => Promise<{ data?: Record<string, StudioDraft>; error?: string }>`, a bound `getStudioDrafts`.
  - `workspaceSeed(input): { score; timing; timeMap; anchorSeconds }` is exported from `lib/playsense-studio/drafts/seed.ts`:

    ```ts
    workspaceSeed(input: {
      owner: StudioOwner; mode: StudioMode; initialScore: ScoreDocument;
      activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
      exerciseMedia?: ExerciseMedia | null; studioDraft?: StudioDraft | null;
    })
    ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/drafts/__tests__/workspace-seed.test.ts
import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const score = { title: 'Live' } as never;
const exMap = { id: 'ex', method: 'drag', params: {}, waypoints: [wp(0, 0.5), wp(4, 2.5)], nudges: [] };
const media = { videoUrl: 'v', videoStartSeconds: 0, videoTrimOutSeconds: null, metronomeAnchorSeconds: 0.5, timeMap: exMap, backingTracks: [] };

describe('workspaceSeed', () => {
  it('exercise timing comes from the play-along map and the class item anchor', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'exercise', initialScore: score, activeTimeMap: null, exerciseMedia: media as never });
    expect(s.timing.waypoints).toEqual(exMap.waypoints);
    expect(s.timing.anchor).toEqual({ seconds: 0.5, qn: null });
  });
  it('a legacy single-score lesson uses its active map and no anchor', () => {
    const s = workspaceSeed({ owner: { kind: 'classItem', classItemId: 'ci' }, mode: 'video', initialScore: score, activeTimeMap: exMap as never });
    expect(s.timing.waypoints).toEqual(exMap.waypoints);
    expect(s.timing.anchor).toBeNull();
  });
  it('a song has no timing, and a draft wins over live', () => {
    const song = { kind: 'song' as const, songId: 's', difficulty: 'beginner' as const, isPublished: true, trackIndex: 0 };
    expect(workspaceSeed({ owner: song, mode: 'video', initialScore: score, activeTimeMap: null }).timing).toEqual(EMPTY_TIMING);
    const d = workspaceSeed({ owner: song, mode: 'video', initialScore: score, activeTimeMap: null, studioDraft: { score: { title: 'Draft' } as never, timing: EMPTY_TIMING, updatedAt: 'x' } });
    expect((d.score as unknown as { title: string }).title).toBe('Draft');
  });
});
```

Note: the exercise anchor's `qn` isn't in `ExerciseMedia`, so it seeds as `null`. That's acceptable: the anchor action derives the qn from the published map when it's omitted, and the SyncPanel recomputes it when the anchor is dragged (Task 8).

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/workspace-seed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `lib/playsense-studio/drafts/seed.ts`, add the following, with type-only imports of `StudioOwner`/`StudioMode` from `@/app/admin/playsense-studio/[classItemId]/studio-workspace`, `ExerciseMedia`/`StudioDraft` from the actions, and `PlaysenseStudioPlayerTimeMap` from the player. Then import it in `studio-workspace.tsx`:

```ts
/** What the workspace opens on: the owner's unpublished draft, else live. */
export function workspaceSeed(input: {
  owner: StudioOwner;
  mode: StudioMode;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  exerciseMedia?: ExerciseMedia | null;
  studioDraft?: StudioDraft | null;
}) {
  const isExercise = input.mode === 'exercise' && input.owner.kind === 'classItem';
  const live =
    input.owner.kind === 'song'
      ? EMPTY_TIMING
      : isExercise
        ? timingFromLive(
            input.exerciseMedia?.timeMap ?? null,
            input.exerciseMedia?.metronomeAnchorSeconds == null
              ? null
              : { seconds: input.exerciseMedia.metronomeAnchorSeconds, qn: null }
          )
        : timingFromLive(input.activeTimeMap, null);
  const timing = input.studioDraft?.timing ?? live;
  return {
    score: input.studioDraft?.score ?? input.initialScore,
    timing,
    timeMap: timingToTimeMap(timing),
    anchorSeconds: timing.anchor?.seconds ?? null,
  };
}
```

- Split `StudioWorkspace` into an outer shell that renders `<StudioDraftsProvider owners={[{ owner: draftOwner, label: title, unpublished: !!studioDraft }]}>` around an inner `StudioWorkspaceBody` with the current body. Here `draftOwner = owner.kind === 'song' ? { kind: 'song', id: owner.songId } : { kind: 'exercise', id: owner.classItemId }`.
- In the body:

```ts
  const seed = useMemo(() => workspaceSeed({ owner, mode, initialScore, activeTimeMap, exerciseMedia, studioDraft }), []); // mount-only seed
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean, replaceScore } = useEditor(seed.score);
  const draft = useStudioDraft({ owner: draftOwner, label: title, score: state.score, isDirty: state.isDirty, markClean, replaceScore, initialTiming: seed.timing });
```

- **Delete the old autosave:** `persist`, the autosave effect, the unmount flush, `savingState`/`errorMessage`/`savingRef`/`stateRef` (if now unused) and `AUTOSAVE_INTERVAL_MS`. Drop the `saveScoreDocument` and `queueStudioSave` imports if unused.
- **⌘S and the status UI:** ⌘S calls `void draft.flush()`. The status span and Save button change exactly as in Task 6, and the error banner shows `draft.error`.
- **Exercise map follows the draft:** the exercise time map comes from the draft, not from separate state. Replace `exerciseTimeMap` state with `const exerciseTimeMap = useMemo(() => timingToTimeMap(draft.timing), [draft.timing]);`. `BackingLanesPanel` and `ExerciseMediaPanel.hasTimeMap` read it.
- **Removing the exercise video:** in `handleExerciseVideoChange`, when the URL becomes null, also call `draft.replaceTiming({ ...EMPTY_TIMING, anchor: draft.timing.anchor })`. The live map was already nulled by `updateExerciseVideo`, and a stale draft map must not be republished for a removed video. Keep the rest of that handler as it is.
- **SyncPanels:** both get `key={draft.timingEpoch}`. The exercise-sync one gets `activeTimeMap={exerciseTimeMap}` and `initialMetronomeAnchorSeconds={draft.timing.anchor?.seconds ?? null}`. The other gets `activeTimeMap={seed.timeMap}`.
- **Song visibility copy:** in `SongMetaControls`, change the button text to `{isPublished ? 'Visible' : 'Hidden'}` and the title to `isPublished ? 'Visible — students can find this song' : "Hidden — students can't find this song"`.

In `page.tsx` (`[classItemId]`):
- EXERCISE branch: add `const drafts = await getStudioDrafts([{ kind: 'exercise', id: classItemId }]);`, then pass `initialExerciseDraft={drafts.data?.[`exercise:${classItemId}`] ?? null}` and `fetchExerciseDraft={getStudioDrafts.bind(null, [{ kind: 'exercise', id: classItemId }])}`.
- The final single-score branch (`StudioWorkspace mode="video"`): load the same way and pass `studioDraft`.

In `exercise-studio.tsx`:
- Keep **no** import of the actions module (see its note); it uses only the bound prop.
- Hold `exerciseDraft` state and refresh it in `switchPart('exercise')` alongside `fetchExercise` (`Promise.all([...,fetchExerciseDraft()])`), taking `res.data?.['exercise:' + classItemId] ?? null`. Pass `studioDraft={exerciseDraft}` to `StudioWorkspace`.
- Wrap everything it returns in `<StudioDraftsProvider owners={[{ owner: { kind: 'exercise', id: classItemId }, label: 'Exercise', unpublished: !!initialExerciseDraft }, ...initialSections.map((s) => ({ owner: { kind: 'section' as const, id: s.sectionId }, label: s.studioDraft?.score.title ?? s.scoreDocument.title, unpublished: s.studioDraft != null }))]}>`. That makes it the root, and the inner workspaces' providers seed into it.
- **Stale seed guard:** on the switch refetch, a stale `studioDraft` must not resurrect content after a publish or discard. Register a `changed` handler for `exercise:${classItemId}` that sets `exerciseDraft` to null, using an inner component to reach the context.

In `song/[songId]/page.tsx`: load `getStudioDrafts([{ kind: 'song', id: song.id }])` and pass `studioDraft={drafts.data?.[`song:${song.id}`] ?? null}`.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean. Then `grep -n "saveScoreDocument" 'app/admin/playsense-studio/[classItemId]'/*.tsx components/playsense-studio/studio/score-section-editor.tsx` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add 'app/admin/playsense-studio/[classItemId]' 'app/admin/playsense-studio/song/[songId]/page.tsx' lib/playsense-studio/drafts
git commit -m "Autosave exercise, lesson and song scores to drafts"
```

---

### Task 8: SyncPanel hands timing to the draft instead of publishing

**Files:**
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
- Modify: the three SyncPanel call sites (`score-section-editor.tsx`, and `studio-workspace.tsx` ×2) to pass `onTimingChange={draft.setTiming}`
- Create: `lib/playsense-studio/drafts/timing-patch.ts`
- Test: `lib/playsense-studio/drafts/__tests__/timing-patch.test.ts`

**Interfaces:**
- Consumes: `StudioTiming` (Task 2); `draft.setTiming` (Task 5).
- Produces:
  - SyncPanel props lose `hasDraft` and gain `onTimingChange: (patch: Partial<StudioTiming>) => void` (required). `onPublished` is renamed `onTimingSaved`.
  - A pure helper in `lib/playsense-studio/drafts/timing-patch.ts` (so node tests don't load the SyncPanel's VexFlow tree): `export function timingPatchFromMarkers(markers: MarkerState, opts: { pps: number; peaksCached: boolean }): Pick<StudioTiming, 'method' | 'params' | 'waypoints'> | null`. It returns null when there are fewer than 2 waypoints.

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/drafts/__tests__/timing-patch.test.ts
import { describe, expect, it } from 'vitest';
import { timingPatchFromMarkers } from '../timing-patch';
import { seedMarkerState } from '@/components/playsense-studio/sync/marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { createBlankScore } from '@/components/playsense-studio/shared/score-model/blank';

describe('timingPatchFromMarkers', () => {
  it('builds the drag timing a publish needs, with nudges in params', () => {
    const score = createBlankScore({ title: 'T', instrument: 'bass', measureCount: 2 });
    const markers = seedMarkerState(score.tracks[0], score, buildWaypoints(score, score.initialTempo, 0));
    const patch = timingPatchFromMarkers(markers, { pps: 40, peaksCached: true })!;
    expect(patch.method).toBe('drag');
    expect(patch.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(patch.params).toMatchObject({ editedBeats: [], nudges: [], nudgedNotes: 0, pps: 40, peaksCached: true, version: 1 });
  });
});
```

Before writing this test, check the real names:
- the blank-score factory: `grep -rn "export function createBlank" components/playsense-studio/shared lib/playsense-studio`
- `seedMarkerState`'s argument order (`sync-panel.tsx:288` calls it as `seedMarkerState(track, score, waypoints, nudges?)`)

Adjust the two imports and the call to match exactly. The expectations stay the same.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/playsense-studio/drafts/__tests__/timing-patch.test.ts`
Expected: FAIL (`timingPatchFromMarkers` isn't exported yet).

- [ ] **Step 3: Implement**

- Create `lib/playsense-studio/drafts/timing-patch.ts`, built from the existing body of `saveTiming`. Import `MarkerState`, `enforceMonotonic`, `markerStateToWaypoints`, `nudgeList` and `countNudges` from `@/components/playsense-studio/sync/marker-model`, and `StudioTiming` from `./timing`. Then in `sync-panel.tsx`, import it:

```ts
export function timingPatchFromMarkers(
  markers: MarkerState,
  opts: { pps: number; peaksCached: boolean }
): Pick<StudioTiming, 'method' | 'params' | 'waypoints'> | null {
  const waypoints = enforceMonotonic(markerStateToWaypoints(markers, { includeBeats: 'edited-beats' }));
  if (waypoints.length < 2) return null;
  const editedBeats = markers.measures.flatMap((m) => m.beats
    .filter((b) => b.edited && b.beatInMeasure !== 1)
    .map((b) => ({ measure: m.measureNumber, beat: b.beatInMeasure })));
  return {
    method: 'drag',
    params: { editedBeats, nudges: nudgeList(markers), nudgedNotes: countNudges(markers), pps: opts.pps, peaksCached: opts.peaksCached, version: 1 },
    waypoints,
  };
}
```

- Replace the body of `saveTiming` so it no longer calls `queueStudioSave`, `saveScoreDocument` or `publishTimeMap`:

```ts
  const saveTiming = useCallback((opts?: { silent?: boolean }) => {
    if (!timingAutosave) return;
    const snapshot = markers;
    const patch = timingPatchFromMarkers(snapshot, { pps, peaksCached: decodeState === 'ready' });
    if (!patch) {
      if (!opts?.silent) setError('Add a measure before saving its timing.');
      return;
    }
    const anchorPatch = anchorRefreshRef.current ? anchorTimingPatch() : null;
    anchorRefreshRef.current = false;
    onTimingChange({ ...patch, ...(anchorPatch ?? {}) });
    if (opts?.silent) return;
    if (markersRef.current === snapshot) {
      setDirty(false);
      onTimingSaved?.();
    }
  }, [timingAutosave, markers, pps, decodeState, onTimingChange, onTimingSaved, anchorTimingPatch]);
```

- Seed `dirty` with `useState(false)` (drop `hasDraft`). Keep the debounce effect (`TIMING_DEBOUNCE_MS`) and the unmount flush (`saveTimingRef.current({ silent: true })`): it now just calls `onTimingChange` synchronously during cleanup, which the hook's one-tick-later unmount save picks up. Remove the `savingTiming` state if it's now unused; the debounce effect's `savingTiming` gate goes with it.
- Anchor: replace `persistAnchor`'s two action calls with a pure patch builder. Delete `writeAnchorRef` and `anchorOwner`'s use in writes; keep `anchorOwner` only as the gate for showing the anchor UI.

```ts
  const anchorTimingPatch = useCallback((): Pick<StudioTiming, 'anchor'> => {
    const seconds = anchorRef.current;
    if (seconds == null) return { anchor: null };
    const qn = secondsToQn(
      markerStateToWaypoints(markersRef.current, { includeBeats: 'edited-beats' }).map((w) => ({
        musicalPositionQN: w.musicalPositionQN, videoTimeSeconds: w.videoTimeSeconds,
      })),
      seconds
    );
    return { anchor: { seconds, qn } };
  }, []);

  const persistAnchor = useCallback(() => {
    if (!anchorOwner) return;
    onTimingChange(anchorTimingPatch());
  }, [anchorOwner, onTimingChange, anchorTimingPatch]);
```

  Keep `scheduleAnchorSave`'s 500 ms debounce calling `persistAnchor`.
- Remove the now-unused imports: `saveScoreDocument`, `publishTimeMap`, `setSectionMetronomeAnchor`, `setClassItemMetronomeAnchor`, `queueStudioSave`. Also remove the `publishTarget`-only code that fed `publishTimeMap`. Keep the `publishTarget` prop if other code (anchor ownership, labels) still reads it; otherwise remove it and its three call-site arguments.
- Inspector copy that says timing is "published" when it is saved: search `grep -n "ublish" components/playsense-studio/studio/sync-panel.tsx` and reword any user-visible string that claims students see a change on save, e.g. "Saved to draft". Leave the code comments accurate.

At the call sites, pass `onTimingChange={draft.setTiming}`, and rename `onPublished` to `onTimingSaved`.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean. Then `grep -n "publishTimeMap\|saveScoreDocument\|MetronomeAnchor(" components/playsense-studio/studio/sync-panel.tsx` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/studio/score-section-editor.tsx 'app/admin/playsense-studio/[classItemId]/studio-workspace.tsx' lib/playsense-studio/drafts
git commit -m "Save sync timing and the click anchor to the draft instead of publishing"
```

---

### Task 9: Publish button, popover, dots on the part switch

**Files:**
- Create: `components/playsense-studio/studio/drafts/publish-control.tsx`
- Modify: `studio-workspace.tsx` and `video-sections-workspace.tsx`: render `<PublishControl />` in the app bar, just before the undo/redo cluster (in `video-sections-workspace.tsx`, just before the `appBarEl` slot div)
- Modify: `exercise-studio.tsx`: put `UnpublishedDot`s on the Watch and Exercise buttons
- Modify: `app/globals.css`: add `.st-publish` and its pulse
- Test: `components/playsense-studio/studio/drafts/__tests__/publish-control.test.tsx`

**Interfaces:**
- Consumes: `useStudioDrafts` (Task 5); `getPublishPreview` (Task 4).
- Produces: `PublishControl()`, no props.
  - It shows `N unpublished change(s)` text and a `Publish` button with a count badge. The button gets the `is-pending` class (pulse) when N > 0 and is disabled when N = 0.
  - Clicking it opens a `role="dialog"` popover titled `Publish to students`. It lists the unpublished parts, each with its preview lines, a `Publish` button and a `Discard this draft` button, plus `Publish all` when N ≥ 2.
  - Errors show inline under the part.

- [ ] **Step 1: Write the failing test**

```tsx
// components/playsense-studio/studio/drafts/__tests__/publish-control.test.tsx
// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn(), getPublishPreview: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);
import { StudioDraftsProvider } from '../drafts-context';
import { PublishControl } from '../publish-control';

let root: Root;
let host: HTMLDivElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const btn = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(text))!;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  acts.getPublishPreview.mockResolvedValue({ data: { 'section:a': ['2 bars changed'], 'exercise:ci': ['Timing changed'] } });
  acts.publishStudioDraft.mockResolvedValue({ publishedAt: 'x' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function mount(unpub: [boolean, boolean]) {
  act(() => root.render(
    <StudioDraftsProvider owners={[
      { owner: { kind: 'section', id: 'a' }, label: 'Intro', unpublished: unpub[0] },
      { owner: { kind: 'exercise', id: 'ci' }, label: 'Exercise', unpublished: unpub[1] },
    ]}>
      <PublishControl />
    </StudioDraftsProvider>
  ));
}

describe('PublishControl', () => {
  it('is quiet and disabled with nothing unpublished', () => {
    mount([false, false]);
    expect(btn('Publish').disabled).toBe(true);
    expect(btn('Publish').className).not.toContain('is-pending');
    expect(host.textContent).not.toContain('unpublished');
  });
  it('counts unpublished parts and pulses', () => {
    mount([true, true]);
    expect(host.textContent).toContain('2 unpublished changes');
    expect(btn('Publish').className).toContain('is-pending');
  });
  it('lists each part with what changed, and publishes one', async () => {
    mount([true, true]);
    act(() => btn('Publish').click());
    await flush();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Publish to students');
    expect(dialog.textContent).toContain('Intro');
    expect(dialog.textContent).toContain('2 bars changed');
    expect(dialog.textContent).toContain('Publish all');
    const rowPublish = [...dialog.querySelectorAll('button')].filter((b) => b.textContent === 'Publish')[0];
    await act(async () => { rowPublish.click(); });
    await flush();
    expect(acts.publishStudioDraft).toHaveBeenCalledWith({ kind: 'section', id: 'a' });
    expect(host.textContent).toContain('1 unpublished change');
  });
  it('shows a refused publish next to its part and keeps it unpublished', async () => {
    acts.publishStudioDraft.mockResolvedValue({ error: 'This sync overlaps the section "Verse".' });
    mount([true, false]);
    act(() => btn('Publish').click());
    await flush();
    const rowPublish = [...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Publish') as HTMLButtonElement;
    await act(async () => { rowPublish.click(); });
    await flush();
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('overlaps the section "Verse"');
    expect(host.textContent).toContain('1 unpublished change');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run components/playsense-studio/studio/drafts/__tests__/publish-control.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/playsense-studio/studio/drafts/publish-control.tsx
'use client';

import { Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getPublishPreview } from '@/app/actions/studio-drafts';
import { ownerKey } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export function PublishControl() {
  const { statuses, publish, discard } = useStudioDrafts();
  const parts = Object.values(statuses).filter((s) => s.unpublished);
  const n = parts.length;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void getPublishPreview(parts.map((p) => p.owner)).then((res) => { if (live && res.data) setPreview(res.data); });
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => { live = false; document.removeEventListener('mousedown', onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (n === 0) setOpen(false); }, [n]);

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    setErrors((e) => {
      const next = { ...e };
      if (res.error) next[key] = res.error; else delete next[key];
      return next;
    });
    return !res.error;
  };

  const publishAll = async () => {
    for (const p of parts) {
      const ok = await run(ownerKey(p.owner), () => publish(p.owner));
      if (!ok) break;
    }
  };

  return (
    <div ref={boxRef} className="relative flex items-center gap-2">
      {n > 0 && (
        <span className="hidden text-xs text-muted-foreground md:inline">
          {n === 1 ? '1 unpublished change' : `${n} unpublished changes`}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={n === 0}
        className={`st-publish${n > 0 ? ' is-pending' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Upload className="h-4 w-4" />
        Publish
        {n > 0 && <span className="st-publish-count">{n}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Publish to students" className="st-publish-pop">
          <p className="st-sec-label">Publish to students</p>
          <ul className="flex flex-col gap-2">
            {parts.map((p) => {
              const key = ownerKey(p.owner);
              return (
                <li key={key} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.label}</span>
                    {busy === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <button type="button" className="st-chip" disabled={busy != null}
                      onClick={() => {
                        if (!window.confirm(`Discard the unpublished changes to "${p.label}"? The live version stays as it is.`)) return;
                        void run(key, () => discard(p.owner));
                      }}>
                      Discard this draft
                    </button>
                    <button type="button" className="st-chip is-on" disabled={busy != null}
                      onClick={() => void run(key, () => publish(p.owner))}>
                      Publish
                    </button>
                  </div>
                  <ul className="mt-1.5 text-xs text-muted-foreground">
                    {(preview[key] ?? []).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  {errors[key] && <p className="mt-1.5 text-xs text-destructive">{errors[key]}</p>}
                </li>
              );
            })}
          </ul>
          {n >= 2 && (
            <button type="button" className="st-publish is-pending mt-2 w-full justify-center" disabled={busy != null} onClick={() => void publishAll()}>
              Publish all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: `btn('Publish')` in the test matches the app-bar button by `startsWith('Publish')`. The popover's row buttons have exact text `Publish`. The app-bar button's text is `Publish` plus the count, so the first match is the app-bar button. Keep the app-bar button first in DOM order.

CSS (`app/globals.css`, near `.st-chip`):

```css
.st-publish { display: inline-flex; align-items: center; gap: .4rem; border-radius: .5rem; padding: .45rem .9rem; font-size: .875rem; font-weight: 600; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); transition: opacity .15s; }
.st-publish:disabled { opacity: .45; cursor: not-allowed; }
.st-publish.is-pending { animation: st-publish-pulse 1.8s ease-in-out infinite; }
.st-publish-count { min-width: 1.15rem; border-radius: 9999px; background: hsl(var(--primary-foreground)); color: hsl(var(--primary)); font-size: .7rem; padding: 0 .3rem; text-align: center; }
.st-publish-pop { position: absolute; right: 0; top: calc(100% + 6px); z-index: 60; width: min(360px, calc(100vw - 32px)); border-radius: .75rem; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); padding: .75rem; box-shadow: 0 12px 32px rgb(0 0 0 / .25); }
@keyframes st-publish-pulse { 0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / .45); } 50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); } }
@media (prefers-reduced-motion: reduce) { .st-publish.is-pending { animation: none; } }
```

First check how `--primary` and `--border` are declared (`grep -n "\-\-primary:" app/globals.css`), and match that form (HSL channels vs a full color). The rest of the file's `.st-*` rules show which form is used.

Put `<PublishControl />` in the app bar of `StudioWorkspaceBody` and `VideoSectionsBody`, before the undo/redo buttons and the section editor's portal slot. Inside `ExerciseStudio`, both inner workspaces render it against the shared root context, so it counts both parts.

In `exercise-studio.tsx`, add `{watchUnpublished && <UnpublishedDot />}` inside the Watch button and `{exerciseUnpublished && <UnpublishedDot />}` inside the Exercise button:
- `watchUnpublished` = any status whose `owner.kind === 'section'` is unpublished
- `exerciseUnpublished` = `statuses['exercise:' + classItemId]?.unpublished`

The toggle is built inside the provider, so read the context from a small `PartToggle` component that renders the existing markup.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/drafts 'app/admin/playsense-studio/[classItemId]' app/globals.css
git commit -m "Add the Publish button with what changed per part, and unpublished dots"
```

---

### Task 10: History panel and restore

**Files:**
- Create: `components/playsense-studio/studio/drafts/history-panel.tsx`
- Modify: `score-section-editor.tsx` (portal it into the app bar next to Replace score) and `studio-workspace.tsx` (in the app bar before undo/redo)
- Test: `components/playsense-studio/studio/drafts/__tests__/history-panel.test.tsx`

**Interfaces:**
- Consumes: `listStudioVersions`, `restoreStudioVersion` (Task 3); `useStudioDrafts().notifyAdopt` and `setStatus` (Task 5).
- Produces: `HistoryPanel({ owner }: { owner: StudioDraftOwner })`.
  - It's a `History` chip button (lucide `History` icon) that opens a `role="dialog"` panel titled `History`.
  - The panel lists versions newest first: a `Published`/`Draft` badge, a `Live` badge on the live one, and the time (`new Date(updatedAt).toLocaleString()`).
  - Each row has a `Restore` button. Restore calls `restoreStudioVersion`, then `notifyAdopt(ownerKey(owner), content)`, then `setStatus(owner, { unpublished: true })`, then closes the panel.

- [ ] **Step 1: Write the failing test**

```tsx
// components/playsense-studio/studio/drafts/__tests__/history-panel.test.tsx
// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn(), listStudioVersions: vi.fn(), restoreStudioVersion: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';
import { HistoryPanel } from '../history-panel';

let root: Root;
let host: HTMLDivElement;
let ctx: StudioDraftsValue;
const adopt = vi.fn();
const owner = { kind: 'section' as const, id: 's1' };
function Probe() {
  ctx = useStudioDrafts();
  React.useEffect(() => ctx.register('section:s1', { adopt }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  acts.listStudioVersions.mockResolvedValue({ data: [
    { id: 'd1', kind: 'draft', createdAt: '2026-09-25T10:05:00Z', updatedAt: '2026-09-25T10:06:00Z', isLive: false },
    { id: 'p1', kind: 'published', createdAt: '2026-09-25T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', isLive: true },
  ] });
  acts.restoreStudioVersion.mockResolvedValue({ data: { score: { title: 'Old' }, timing: EMPTY_TIMING, updatedAt: 'x' } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe /><HistoryPanel owner={owner} /></StudioDraftsProvider>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('HistoryPanel', () => {
  it('lists versions with the live one marked', async () => {
    act(() => (host.querySelector('button[title="History"]') as HTMLButtonElement).click());
    await flush();
    const dialog = host.querySelector('[role="dialog"]')!;
    const rows = dialog.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Draft');
    expect(rows[1].textContent).toContain('Published');
    expect(rows[1].textContent).toContain('Live');
  });
  it('restore loads the version as the new draft', async () => {
    act(() => (host.querySelector('button[title="History"]') as HTMLButtonElement).click());
    await flush();
    const restore = [...host.querySelectorAll('[role="dialog"] button')].filter((b) => b.textContent === 'Restore')[1] as HTMLButtonElement;
    await act(async () => { restore.click(); });
    await flush();
    expect(acts.restoreStudioVersion).toHaveBeenCalledWith({ owner, versionId: 'p1' });
    expect(adopt).toHaveBeenCalledWith({ score: { title: 'Old' }, timing: EMPTY_TIMING });
    expect(ctx.statuses['section:s1'].unpublished).toBe(true);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run components/playsense-studio/studio/drafts/__tests__/history-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/playsense-studio/studio/drafts/history-panel.tsx
'use client';

import { History, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { listStudioVersions, restoreStudioVersion, type StudioVersionListItem } from '@/app/actions/studio-drafts';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export function HistoryPanel({ owner }: { owner: StudioDraftOwner }) {
  const { notifyAdopt, setStatus } = useStudioDrafts();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StudioVersionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setRows(null);
    void listStudioVersions(owner).then((res) => {
      if (!live) return;
      if (res.error) setError(res.error); else setRows(res.data ?? []);
    });
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => { live = false; document.removeEventListener('mousedown', onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner.kind, owner.id]);

  const restore = async (id: string) => {
    setBusy(id);
    const res = await restoreStudioVersion({ owner, versionId: id });
    setBusy(null);
    if (res.error || !res.data) { setError(res.error ?? 'Could not restore'); return; }
    notifyAdopt(ownerKey(owner), { score: res.data.score, timing: res.data.timing });
    setStatus(owner, { unpublished: true });
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <button type="button" className="st-chip" title="History" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <History className="h-4 w-4" />
        <span className="hidden lg:inline">History</span>
      </button>
      {open && (
        <div role="dialog" aria-label="History" className="st-publish-pop">
          <p className="st-sec-label">History</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!rows && !error && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
          {rows && (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold uppercase">{r.kind === 'published' ? 'Published' : 'Draft'}</span>
                  {r.isLive && <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase text-primary">Live</span>}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{new Date(r.updatedAt).toLocaleString()}</span>
                  <button type="button" className="st-chip" disabled={busy != null} onClick={() => void restore(r.id)}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

Placement:
- `score-section-editor.tsx`: `<HistoryPanel owner={{ kind: 'section', id: sectionId }} />` right after the `ScoreImportDialog` in the app-bar portal.
- `studio-workspace.tsx` body: `<HistoryPanel owner={draftOwner} />` before the undo button.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`
Expected: PASS, and tsc clean.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/drafts components/playsense-studio/studio/score-section-editor.tsx 'app/admin/playsense-studio/[classItemId]/studio-workspace.tsx'
git commit -m "Add per-part History with restore as a new draft"
```

---

### Task 11: Roadmap, apply the migration (user-gated), browser checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1: Update the roadmap.** Mark "Plan 6 — done <date>" and list the follow-ups this plan deferred:
  - one draft row per owner means two admins editing the same part at once is last-write-wins
  - undoing back to the live content still counts as unpublished
  - `getStudioDrafts` reads owners one at a time
  - the legacy `classItem` time-map branch of `publishTimeMap` still doesn't delete superseded maps

  Commit: `git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md && git commit -m "Mark Studio rework Plan 6 done in the roadmap"`.

- [ ] **Step 2: STOP and ask the user before applying `043_studio_versions.sql`.** Dev and production share the hosted database. With the user's yes:
  1. Check `list_migrations` for gaps first.
  2. Apply the migration with the Supabase MCP `apply_migration` (name `043_studio_versions`, the file's SQL).
  3. Confirm with `list_tables` that `studio_versions` exists with RLS enabled.
  4. Run `get_advisors` (security) and report any new warning.

- [ ] **Step 3: Browser checklist for the user** (Chrome, dev server with the hosted DB; these can't be automated here):
  1. **Student view waits for Publish.** Edit a Watch section's notes and drag a bar; the app bar shows `1 unpublished change` and a pulsing Publish. A student account doesn't see the change yet. Press Publish: the popover lists the section with `N bars changed` and `Timing changed`. Publish it, and the student view updates.
  2. **Draft survives a reload.** Edit, wait for `Draft saved`, reload: the browser warns before leaving, and the Studio reopens on the draft.
  3. **Discard.** Discard this draft returns the editor to the live version.
  4. **History.** History lists the publish (Live) and the drafts. Restore an older one: the editor shows it and the part is unpublished again.
  5. **Exercise and Watch dots.** In an exercise, edit the graded score and a Watch section: both switch buttons show the gold dot. Publish all clears both.
  6. **Overlap refused.** Drag a section so it overlaps another, then Publish: the overlap error shows under that part and nothing changes for students.
  7. **Song.** A song page shows `Visible/Hidden` for visibility and a separate Publish for its score.
