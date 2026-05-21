# Payment System Phase 1 — Fundamentals Course Type (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a genreless "fundamentals" course type — exactly one per instrument — to the data model and admin tooling, as the foundation for the new per-course payment system.

**Architecture:** Add an `is_fundamentals` flag to `courses` and make `musical_style_id` nullable, guarded by a DB CHECK (fundamentals ⇒ no genre + has instrument; genre course ⇒ has genre) and a partial unique index (one fundamentals per instrument). A small pure validation helper enforces the same rule in the app layer; the admin edit form and the create/update server actions use it. Seed one draft fundamentals course per subscribable instrument.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), TypeScript, vitest (node env), Supabase MCP for applying migrations to the remote project.

**Scope note:** This is Phase 1 of 4 (content model). Billing tables/Stripe, access gating, and subscribe UX are separate plans that depend on this one. Building a brand-new `/admin/courses/new` page is a pre-existing gap and is **out of scope**; fundamentals courses are seeded by migration and managed via the existing edit form.

**Reference spec:** `docs/superpowers/specs/2026-05-21-new-payment-system-design.md`

---

### Task 1: Course-kind validation helper (pure, TDD)

**Files:**
- Create: `lib/courses/fundamentals.ts`
- Test: `lib/courses/__tests__/fundamentals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/courses/__tests__/fundamentals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateCourseKind } from '@/lib/courses/fundamentals'

describe('validateCourseKind', () => {
  it('accepts a genre course with a style', () => {
    expect(
      validateCourseKind({ isFundamentals: false, musicalStyleId: 'style-1', instrument: 'Piano' })
    ).toEqual({ ok: true })
  })

  it('rejects a genre course without a style', () => {
    expect(
      validateCourseKind({ isFundamentals: false, musicalStyleId: null, instrument: 'Piano' })
    ).toEqual({ ok: false, error: 'A genre course must have a musical style.' })
  })

  it('accepts a fundamentals course with an instrument and no style', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: null, instrument: 'Piano' })
    ).toEqual({ ok: true })
  })

  it('rejects a fundamentals course that has a style', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: 'style-1', instrument: 'Piano' })
    ).toEqual({ ok: false, error: 'A fundamentals course cannot have a genre.' })
  })

  it('rejects a fundamentals course without an instrument', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: null, instrument: null })
    ).toEqual({ ok: false, error: 'A fundamentals course must have an instrument.' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/courses/__tests__/fundamentals.test.ts`
Expected: FAIL — cannot resolve `@/lib/courses/fundamentals` (module not found).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/courses/fundamentals.ts`:

```ts
export interface CourseKindInput {
  isFundamentals: boolean
  musicalStyleId: string | null
  instrument: string | null
}

export type CourseKindValidation = { ok: true } | { ok: false; error: string }

/**
 * Enforces the fundamentals/genre invariant:
 * - a fundamentals course is genreless and must name an instrument;
 * - a genre course must have a musical style.
 */
export function validateCourseKind(input: CourseKindInput): CourseKindValidation {
  if (input.isFundamentals) {
    if (input.musicalStyleId) {
      return { ok: false, error: 'A fundamentals course cannot have a genre.' }
    }
    if (!input.instrument) {
      return { ok: false, error: 'A fundamentals course must have an instrument.' }
    }
    return { ok: true }
  }
  if (!input.musicalStyleId) {
    return { ok: false, error: 'A genre course must have a musical style.' }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/courses/__tests__/fundamentals.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/courses/fundamentals.ts lib/courses/__tests__/fundamentals.test.ts
git commit -m "feat(courses): add fundamentals/genre course-kind validation helper"
```

---

### Task 2: Database migration — fundamentals schema

**Files:**
- Create: `supabase/migrations/019_course_fundamentals.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/019_course_fundamentals.sql`:

```sql
-- 019_course_fundamentals.sql
-- Introduce a genreless "fundamentals" course type for the new per-course
-- payment model: exactly one fundamentals course per instrument.

ALTER TABLE courses ALTER COLUMN musical_style_id DROP NOT NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_fundamentals BOOLEAN NOT NULL DEFAULT false;

-- One fundamentals course per instrument.
CREATE UNIQUE INDEX IF NOT EXISTS courses_one_fundamentals_per_instrument
  ON courses (instrument)
  WHERE is_fundamentals;

-- Fundamentals ⇒ genreless + has instrument; genre course ⇒ has a style.
ALTER TABLE courses
  ADD CONSTRAINT courses_kind_valid CHECK (
    (is_fundamentals AND musical_style_id IS NULL AND instrument IS NOT NULL)
    OR (NOT is_fundamentals AND musical_style_id IS NOT NULL)
  );
```

- [ ] **Step 2: Apply the migration to the remote project (Supabase MCP)**

Use the Supabase MCP tool `apply_migration` with `name: "course_fundamentals"` and the SQL above.
Expected: `{ "success": true }`.

- [ ] **Step 3: Verify the schema changed**

Use Supabase MCP `execute_sql`:

```sql
select column_name, is_nullable, data_type
from information_schema.columns
where table_name = 'courses' and column_name in ('musical_style_id', 'is_fundamentals')
order by column_name;
```

Expected: `is_fundamentals` exists (boolean, NOT NULL); `musical_style_id` `is_nullable = 'YES'`.

Then confirm the constraint and index exist:

```sql
select conname from pg_constraint where conrelid = 'public.courses'::regclass and conname = 'courses_kind_valid';
select indexname from pg_indexes where tablename = 'courses' and indexname = 'courses_one_fundamentals_per_instrument';
```

Expected: one row each.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_course_fundamentals.sql
git commit -m "feat(db): add is_fundamentals + nullable genre + one-per-instrument constraint to courses"
```

---

### Task 3: Update generated database types

**Files:**
- Modify: `types/database.ts` (the `courses` table block)

- [ ] **Step 1: Make `musical_style_id` nullable and add `is_fundamentals` in the `Row` type**

In the `courses` table's `Row` object, replace:

```ts
        musical_style_id: string
```

with:

```ts
        musical_style_id: string | null
        is_fundamentals: boolean
```

- [ ] **Step 2: Update the `Insert` type**

In the `courses` table's `Insert` object, replace:

```ts
        musical_style_id: string
```

with:

```ts
        musical_style_id?: string | null
        is_fundamentals?: boolean
```

- [ ] **Step 3: Update the `Update` type**

In the `courses` table's `Update` object, replace:

```ts
        musical_style_id?: string
```

with:

```ts
        musical_style_id?: string | null
        is_fundamentals?: boolean
```

- [ ] **Step 4: Verify types compile**

Run: `rm -rf .next && npm run build`
Expected: `✓ Compiled successfully` and a clean exit (52 static pages generated). If the build surfaces a now-required null check on `musical_style_id` elsewhere, note the file but do not fix unrelated code here — only the `courses` type changed and the rest of Phase 1 handles its own usages.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): courses gains is_fundamentals and nullable musical_style_id"
```

---

### Task 4: Seed one draft fundamentals course per instrument

**Files:**
- Create: `supabase/migrations/020_seed_fundamentals_courses.sql`

- [ ] **Step 1: Write the seed migration**

Create `supabase/migrations/020_seed_fundamentals_courses.sql` (instrument list mirrors `SUBSCRIBABLE_INSTRUMENTS` in `lib/instruments.ts`):

```sql
-- 020_seed_fundamentals_courses.sql
-- One draft (unpublished) genreless fundamentals course per subscribable
-- instrument. Content is authored later via the admin; these rows just need
-- to exist for the billing/access phases to reference.

INSERT INTO courses (title, slug, instrument, is_fundamentals, musical_style_id, teacher_name, is_published, order_index)
VALUES
  ('Bass Fundamentals',             'bass-fundamentals',             'Bass',             true, NULL, 'Latin Music Mastery', false, 0),
  ('Conga Fundamentals',            'conga-fundamentals',            'Conga',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Drums Fundamentals',            'drums-fundamentals',            'Drums',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Guitar Fundamentals',           'guitar-fundamentals',           'Guitar',           true, NULL, 'Latin Music Mastery', false, 0),
  ('Minor Percussion Fundamentals', 'minor-percussion-fundamentals', 'Minor Percussion', true, NULL, 'Latin Music Mastery', false, 0),
  ('Piano Fundamentals',            'piano-fundamentals',            'Piano',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Timbal Fundamentals',           'timbal-fundamentals',           'Timbal',           true, NULL, 'Latin Music Mastery', false, 0),
  ('Tres Fundamentals',             'tres-fundamentals',             'Tres',             true, NULL, 'Latin Music Mastery', false, 0),
  ('Violin Fundamentals',           'violin-fundamentals',           'Violin',           true, NULL, 'Latin Music Mastery', false, 0)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `apply_migration` with `name: "seed_fundamentals_courses"` and the SQL above.
Expected: `{ "success": true }`.

- [ ] **Step 3: Verify the rows exist**

Use Supabase MCP `execute_sql`:

```sql
select instrument, title, is_fundamentals, musical_style_id, is_published
from courses
where is_fundamentals
order by instrument;
```

Expected: 9 rows, one per instrument, `musical_style_id` NULL, `is_published = false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_seed_fundamentals_courses.sql
git commit -m "feat(db): seed one draft fundamentals course per instrument"
```

---

### Task 5: Support fundamentals in the create/update server actions

**Files:**
- Modify: `app/actions/admin.ts` (`createCourse` lines ~118-143, `updateCourse` lines ~145-170)

- [ ] **Step 1: Import the validation helper**

At the top of `app/actions/admin.ts`, add below the existing imports:

```ts
import { validateCourseKind } from '@/lib/courses/fundamentals'
```

- [ ] **Step 2: Update `createCourse` to handle fundamentals + validate**

Replace the body of `createCourse` (the `const data = {...}` block through the `insert`) with:

```ts
  const isFundamentals = formData.get('is_fundamentals') === 'true'
  const instrument = (formData.get('instrument') as string) || null
  const musicalStyleId = isFundamentals ? null : ((formData.get('musical_style_id') as string) || null)

  const kind = validateCourseKind({ isFundamentals, musicalStyleId, instrument })
  if (!kind.ok) {
    throw new Error(kind.error)
  }

  const data = {
    musical_style_id: musicalStyleId,
    is_fundamentals: isFundamentals,
    instrument,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || null,
    teacher_name: (formData.get('teacher_name') as string) || 'Latin Music Mastery',
    teacher_bio: (formData.get('teacher_bio') as string) || null,
    teacher_image_url: (formData.get('teacher_image_url') as string) || null,
    thumbnail_url: (formData.get('thumbnail_url') as string) || null,
    preview_video_url: (formData.get('preview_video_url') as string) || null,
    is_published: formData.get('is_published') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('courses').insert(data)
```

- [ ] **Step 3: Update `updateCourse` the same way**

Replace the body of `updateCourse` (the `const data = {...}` block through the `update`) with:

```ts
  const isFundamentals = formData.get('is_fundamentals') === 'true'
  const instrument = (formData.get('instrument') as string) || null
  const musicalStyleId = isFundamentals ? null : ((formData.get('musical_style_id') as string) || null)

  const kind = validateCourseKind({ isFundamentals, musicalStyleId, instrument })
  if (!kind.ok) {
    throw new Error(kind.error)
  }

  const data = {
    musical_style_id: musicalStyleId,
    is_fundamentals: isFundamentals,
    instrument,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || null,
    teacher_name: (formData.get('teacher_name') as string) || 'Latin Music Mastery',
    teacher_bio: (formData.get('teacher_bio') as string) || null,
    teacher_image_url: (formData.get('teacher_image_url') as string) || null,
    thumbnail_url: (formData.get('thumbnail_url') as string) || null,
    preview_video_url: (formData.get('preview_video_url') as string) || null,
    is_published: formData.get('is_published') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('courses').update(data).eq('id', id)
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/actions/admin.ts
git commit -m "feat(admin): create/update course actions support fundamentals + validate kind"
```

---

### Task 6: Add a "fundamentals" toggle to the course edit form

**Files:**
- Modify: `components/admin/course-edit-form.tsx`
- Modify: `app/admin/courses/[id]/page.tsx` (pass `is_fundamentals` into the form)

- [ ] **Step 1: Pass `is_fundamentals` from the edit page into the form**

In `app/admin/courses/[id]/page.tsx`, find the `course={{ ... }}` object passed to `<CourseEditForm>` and add this property to it (alongside `instrument`):

```tsx
            is_fundamentals: course.is_fundamentals ?? false,
```

(The page selects the full course row, so `course.is_fundamentals` is available.)

- [ ] **Step 2: Update the form's `Course` interface and imports**

In `components/admin/course-edit-form.tsx`, change the `Course` interface so `musical_style_id` is nullable and add `is_fundamentals`:

```ts
interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  musical_style_id: string | null
  teacher_id: string | null
  is_published: boolean | null
  thumbnail_url: string | null
  instrument: string | null
  is_fundamentals: boolean
}
```

And add the validation-helper import below the existing `SUBSCRIBABLE_INSTRUMENTS` import:

```ts
import { validateCourseKind } from '@/lib/courses/fundamentals'
```

- [ ] **Step 3: Add fundamentals + error state and rework the submit handler**

Replace the component's existing state declarations and `handleSubmit` (the block from `const [saving, setSaving]...` through the end of `handleSubmit`) with:

```tsx
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || '')
  const [isFundamentals, setIsFundamentals] = useState(course.is_fundamentals)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const slug = formData.get('slug') as string
    const description = formData.get('description') as string
    const teacherId = formData.get('teacher_id') as string
    const instrumentValue = formData.get('instrument') as string
    const isPublished = formData.get('is_published') === 'on'

    const instrument = instrumentValue === 'auto' ? null : (instrumentValue || null)
    const musicalStyleId = isFundamentals ? null : ((formData.get('musical_style_id') as string) || null)

    const kind = validateCourseKind({ isFundamentals, musicalStyleId, instrument })
    if (!kind.ok) {
      setFormError(kind.error)
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Get teacher name for backward compatibility
      let teacherName = 'Unassigned'
      if (teacherId && teacherId !== 'unassigned') {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', teacherId)
          .single()
        if (teacher) {
          teacherName = teacher.name
        }
      }

      const { error } = await supabase
        .from('courses')
        .update({
          title,
          slug,
          description: description || null,
          musical_style_id: musicalStyleId,
          is_fundamentals: isFundamentals,
          teacher_id: teacherId === 'unassigned' ? null : teacherId,
          teacher_name: teacherName,
          instrument,
          is_published: isPublished,
          thumbnail_url: thumbnailUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', course.id)

      if (error) {
        console.error('Error updating course:', error)
        setFormError(error.message)
        return
      }

      router.push('/admin/courses')
      router.refresh()
    } catch (err) {
      console.error('Error:', err)
      setFormError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 4: Add the fundamentals checkbox and gate the genre selector**

In the "Basic Information" card, replace the entire Musical Style block:

```tsx
            <div className="grid gap-2">
              <Label htmlFor="musical_style_id">Musical Style</Label>
              <Select name="musical_style_id" defaultValue={course.musical_style_id}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {musicalStyles?.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name} ({style.country.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
```

with:

```tsx
            <div className="flex items-center space-x-3 rounded-md border p-3">
              <input
                type="checkbox"
                id="is_fundamentals"
                checked={isFundamentals}
                onChange={(e) => setIsFundamentals(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is_fundamentals" className="font-normal">
                This is the instrument&rsquo;s beginner fundamentals course (no genre)
              </Label>
            </div>

            {!isFundamentals && (
              <div className="grid gap-2">
                <Label htmlFor="musical_style_id">Musical Style</Label>
                <Select name="musical_style_id" defaultValue={course.musical_style_id ?? undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicalStyles?.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name} ({style.country.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
```

- [ ] **Step 5: Surface the validation error near the actions**

In the "Actions" block, immediately before `<div className="flex gap-4">`, add:

```tsx
        {formError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0.

- [ ] **Step 7: Manual verification (dev server)**

Run: `npm run dev`, then as an admin open `/admin/courses` and edit one of the seeded fundamentals courses (e.g. "Piano Fundamentals"):
- The "fundamentals" checkbox is checked and the Musical Style selector is hidden.
- Saving works (no genre required).
- Edit a normal genre course: checkbox unchecked, genre selector shown; unchecking a genre then ticking fundamentals hides the selector and still saves.
- Ticking fundamentals on a course whose instrument is "Auto (from teacher)" (→ null) and saving shows the inline error "A fundamentals course must have an instrument."

- [ ] **Step 8: Commit**

```bash
git add components/admin/course-edit-form.tsx app/admin/courses/[id]/page.tsx
git commit -m "feat(admin): course edit form supports the fundamentals course type"
```

---

## Self-review

**Spec coverage (Phase 1 = "fundamentals course type: schema + admin form + one seeded per instrument"):**
- Schema (nullable genre, `is_fundamentals`, one-per-instrument, kind invariant) → Task 2. ✓
- Types → Task 3. ✓
- One fundamentals per instrument seeded → Task 4. ✓
- Admin form support → Tasks 5 (actions) + 6 (edit form). ✓
- App-layer enforcement of the invariant → Task 1 helper, used in Tasks 5 & 6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `validateCourseKind({ isFundamentals, musicalStyleId, instrument })` signature is identical in the helper (Task 1), the server actions (Task 5), and the form (Task 6). `is_fundamentals` (DB/snake_case) vs `isFundamentals` (TS local) used consistently. `musical_style_id` is nullable everywhere it's now read. ✓

## Out of scope (later phases)
- `instrument_subscriptions` / `course_enrollments` tables, Stripe prices, checkout, webhooks (Phase 2).
- Per-course access gating + RLS rewrite, removal of old tier logic (Phase 3).
- Subscribe / management / pricing UX (Phase 4).
- Authoring actual fundamentals course **content** (lessons) — a content task, not code.
- A dedicated `/admin/courses/new` creation page (pre-existing gap).
