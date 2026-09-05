# Quiz Experience Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the in-lesson quiz as a focused stage with Duolingo-style feedback, a responsive results screen, a viewport-bounded drag-and-drop question with a composed background, and an admin builder that draws layers and target boxes with handles.

**Architecture:** Pure, vitest-covered logic in `lib/quiz/` (engine reducer, composition, sounds, prefs, transform math, labels, settings). Thin hooks in `hooks/` wrap the reducer and the localStorage prefs. Small presentational components in `components/class-viewer/lesson-viewer/quiz/` share one `OptionTile`, one `FeedbackBanner` and a CSS module with container queries; `quiz-runner.tsx` becomes a shell that picks focus/sheet mode and routes to results. The admin builder lives in `components/admin/piece-placement/` and opens in a Radix Dialog.

**Tech Stack:** Next 16 / React 19, TypeScript, Tailwind v3 tokens + one CSS module (native `@container` queries), framer-motion, @dnd-kit (already installed), Radix Dialog/Select, lucide-react, Web Audio (synthesized cues), zod, vitest (node env), Supabase (hosted dev DB).

**Spec:** `docs/superpowers/specs/2026-09-05-quiz-revamp-design.md`

## Global Constraints

- No new npm dependencies.
- `QuizRunner` props stay `{ classItemId; questions; kind? }` plus new optional `settings?: QuizSettings`, `nextHref?: string | null`, `title?: string`.
- `lib/quiz/grading.ts` is NOT modified. New helpers go in new files.
- `markClassItemComplete(classItemId)` is called exactly once when results are shown, in both modes, regardless of score.
- Stable seeded shuffles: `shuffleStable(items, q.id)` for ordering seed order and `shuffleStable(pairs.map(p => p.right), q.id)` for the matching right column, exactly as today.
- Matching answers are `{ [pairId]: rightText }` and ordering answers are `string[]` of item ids, because `gradeQuestion` compares those shapes. Do not switch to right-side ids.
- `options_es` entries keep the English ids; the builder writes labels only through `patchLocalizedEntry` / `pruneLocalizedEntries` from `lib/quiz/options-es.ts`.
- Every student-facing string via `useTranslation()` from `@/components/language-provider`, keys under `dashboard.classViewer.quiz` in BOTH `locales/en.json` and `locales/es.json`. Admin builder strings stay English.
- `locales/*.json` may be edited by another session: merge keys with the `merge_quiz_keys` shell function defined in Task 4 Step 2 (it preserves 2-space formatting). It is a shell function, so paste its definition into each new shell before the locale steps of Tasks 7–16. Confirm `git diff --stat locales/` shows only added lines.
- Colors only from tokens: `text-success`, `text-terracotta`, `text-primary`, `text-gold`, `bg-card`, `bg-raised`, `bg-sunken`, `border-border`, `text-muted-foreground`, `font-heading`. No `green-*`, `red-*`, `amber-*` classes in the quiz folder when done.
- `lib/quiz/**` and `hooks/**` logic must run in vitest `node` environment: no DOM access at module top level (guard `typeof window`).
- Motion under `MotionConfig reducedMotion="user"` (already wraps the runner); `useReducedMotion()` gates burst, confetti, pop and bounce.
- **The hosted Supabase project is production-adjacent.** Writing the migration file is fine; APPLYING migration 039 (Task 3, Step 6) requires the user's explicit go-ahead in chat. Everything else works before it is applied thanks to `readComposition` and `readQuizSettings` defaults.
- Another session has uncommitted edits in `app/dashboard/course/[courseId]/class/[classId]/page.tsx`, `lesson-header.tsx`, `lesson-shell.tsx`, `lesson-sidebar.tsx`, `curriculum-navigator.tsx`. This plan touches only `page.tsx`, with a single-line insertion (Task 15). Run `git status --short` before every commit and `git add` only the files listed in the task.
- Code style: no semicolons, single quotes, 2-space indent (match `lib/quiz/grading.ts`).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013LzY1PYBrQXHnHzYg5DECz
  ```
- Verification commands: `npx vitest run lib/quiz lib/i18n`, `npx tsc --noEmit`, `npm run lint`. Dev server: `lsof -nP -iTCP:3005 -sTCP:LISTEN` first (another session may already run it), else `nohup npm run dev -- -p 3005 &`. Navigate dashboard routes twice in the logged-in Chrome tab (first request to a dynamic route can 404 in Turbopack dev).

---

## File map

| Path | Responsibility |
|---|---|
| `lib/quiz/composition.ts` | `Background` types, `readComposition(options, imageUrl)`, `readPieces(options)`, `legacyLayer` |
| `lib/quiz/quiz-settings.ts` | `QuizSettings`, `readQuizSettings(json)` |
| `lib/quiz/engine.ts` | `seedAnswers`, `initQuizState`, `quizReducer`, `outcomeOf`, `totalScore`, `percentScore`, `cueFor` |
| `lib/quiz/sounds.ts` | `SoundCue`, `CUES`, `scheduleCue(cue, ctx)`, `playCue(cue, enabled)`, `getAudioContext` |
| `lib/quiz/prefs.ts` | `QuizPrefs` schema/defaults/load/save (key `lmm-quiz-prefs`) |
| `lib/quiz/labels.ts` | `userAnswerLabel`, `fullCorrectLabel`, `countCorrectPieces` |
| `lib/quiz/transform.ts` | `Rect`, `Handle`, `moveRect`, `resizeRect`, `snap`, `clampRect`, `clampPieceWidth` |
| `lib/quiz/__tests__/*.test.ts` | unit tests for each of the above |
| `hooks/use-quiz-engine.ts` | `useReducer` over `quizReducer`; `check` returns the score |
| `hooks/use-quiz-prefs.ts` | `useSyncExternalStore` prefs (mirrors `use-tuner-prefs.ts`) |
| `hooks/use-container-width.ts` | ResizeObserver width of a ref |
| `components/ui/button.tsx` | add `terracotta` variant |
| `components/class-viewer/lesson-viewer/quiz/quiz.module.css` | container-query layout + keyframes |
| `components/class-viewer/lesson-viewer/quiz/input-props.ts` | shared `QuestionInputProps` |
| `.../quiz/option-tile.tsx` | tile states incl. `wrong`, `reveal`, `dim`; letter/kbd/burst |
| `.../quiz/burst.tsx`, `.../quiz/streak-chip.tsx`, `.../quiz/type-chip.tsx` | small presentational pieces |
| `.../quiz/audio-prompt.tsx` | play/pause prompt with level bars |
| `.../quiz/choice-tiles.tsx` | multiple_choice + audio_choice tiles; `TrueFalseTiles` |
| `.../quiz/short-answer-input.tsx`, `fill-blank-input.tsx`, `matching-input.tsx`, `ordering-input.tsx` | per-type inputs |
| `.../quiz/piece-placement-input.tsx` | rewritten composition stage + tray |
| `.../quiz/question-input.tsx` | switch delegating to the inputs |
| `.../quiz/feedback-banner.tsx`, `progress-segments.tsx`, `score-ring.tsx`, `confetti.tsx` | updated |
| `.../quiz/question-map.tsx`, `focus-stage.tsx`, `exam-sheet.tsx`, `results-screen.tsx` | layouts |
| `components/class-viewer/lesson-viewer/quiz-runner.tsx` | shell |
| `components/class-viewer/class-item-renderer.tsx` | passes `settings`, `nextHref`, `title` |
| `app/dashboard/course/[courseId]/class/[classId]/page.tsx` | one-line `nextHref` prop |
| `components/admin/course-studio/item-editor.tsx` | Quiz layout select |
| `components/admin/piece-placement/*.tsx` | builder dialog, canvas, handles, inspectors, summary |
| `components/admin/quiz-builder.tsx` | piece_placement case → summary + dialog |
| `components/admin/quiz-questions-editor.tsx`, `components/admin/quiz-question-card.tsx`, `components/admin/question-preview.tsx` | sortable rows + preview |
| `supabase/migrations/039_quiz_settings_and_piece_composition.sql` | column + backfill |
| `types/modules.ts`, `types/database.ts` | types |
| `locales/en.json`, `locales/es.json` | keys |
| Delete | `components/admin/piece-placement-builder.tsx` |

---

## Phase 1 — Data model

### Task 1: Composition helper and types

**Files:**
- Create: `lib/quiz/composition.ts`
- Test: `lib/quiz/__tests__/composition.test.ts`
- Modify: `types/modules.ts:143-155` (PiecePlacementOptions), add `QuizSettings`, `ClassItem.quiz_settings`

**Interfaces:**
- Produces: `Background`, `BackgroundLayer`, `readComposition(options: unknown, imageUrl?: string | null): Background`, `readPieces(options: unknown): PlacementPiece[]`, `legacyLayer(url)`, `DEFAULT_BACKGROUND_COLOR`, `FALLBACK_ASPECT`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/quiz/__tests__/composition.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_BACKGROUND_COLOR, legacyLayer, readComposition, readPieces } from '../composition'

describe('readComposition', () => {
  it('returns the stored background when present', () => {
    const bg = readComposition(
      { background: { color: '#123456', aspect: 1.5, layers: [{ id: 'a', imageUrl: 'u', x: 1, y: 2, width: 30, height: 40 }] }, pieces: [] },
      'ignored.png',
    )
    expect(bg).toEqual({ color: '#123456', aspect: 1.5, layers: [{ id: 'a', imageUrl: 'u', x: 1, y: 2, width: 30, height: 40 }] })
  })
  it('turns a legacy image_url into one full-bleed layer', () => {
    expect(readComposition({ pieces: [] }, 'bg.png')).toEqual({ color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: [legacyLayer('bg.png')] })
    expect(legacyLayer('bg.png')).toEqual({ id: 'legacy', imageUrl: 'bg.png', x: 0, y: 0, width: 100, height: 100 })
  })
  it('gives an empty composition when there is neither', () => {
    expect(readComposition(null, null)).toEqual({ color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: [] })
  })
  it('drops malformed layers and non-positive aspects', () => {
    const bg = readComposition({ background: { color: '', aspect: 0, layers: [{ id: 'x' }, 'junk', { id: 'ok', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, ratio: 2 }] } })
    expect(bg.color).toBe(DEFAULT_BACKGROUND_COLOR)
    expect(bg.aspect).toBeNull()
    expect(bg.layers).toEqual([{ id: 'ok', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, ratio: 2 }])
  })
})

describe('readPieces', () => {
  it('returns the pieces array or []', () => {
    expect(readPieces({ pieces: [{ id: 'p', imageUrl: '', width: 5, area: { x: 0, y: 0, width: 1, height: 1 } }] })).toHaveLength(1)
    expect(readPieces(null)).toEqual([])
    expect(readPieces({ pieces: 'nope' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/quiz/__tests__/composition.test.ts`
Expected: FAIL — cannot resolve `../composition`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/quiz/composition.ts
import type { PlacementPiece } from './grading'

/**
 * A piece-placement background is a composition: a color plus positioned
 * image layers. All geometry is in percent of the composition; `aspect` is
 * width / height. `aspect: null` means "derive from the first layer's natural
 * size at runtime" (rows migrated from the single image_url era).
 */
export type BackgroundLayer = {
  id: string
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
  /** natural width / height of the image, when known (locks corner resizing) */
  ratio?: number
}

export type Background = {
  color: string
  aspect: number | null
  layers: BackgroundLayer[]
}

export const DEFAULT_BACKGROUND_COLOR = '#0A0A0A'
export const FALLBACK_ASPECT = 1.6

export function legacyLayer(imageUrl: string): BackgroundLayer {
  return { id: 'legacy', imageUrl, x: 0, y: 0, width: 100, height: 100 }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function toLayer(v: unknown): BackgroundLayer | null {
  if (!isRecord(v)) return null
  const { id, imageUrl, x, y, width, height, ratio } = v
  if (typeof id !== 'string' || typeof imageUrl !== 'string') return null
  if (![x, y, width, height].every(isFiniteNumber)) return null
  const layer: BackgroundLayer = { id, imageUrl, x: x as number, y: y as number, width: width as number, height: height as number }
  if (isFiniteNumber(ratio) && ratio > 0) layer.ratio = ratio
  return layer
}

/** Normalize any stored `options` (new shape, legacy image_url, or nothing) into a Background. */
export function readComposition(options: unknown, imageUrl?: string | null): Background {
  const opts = isRecord(options) ? options : {}
  const bg = opts.background
  if (isRecord(bg)) {
    const layers = Array.isArray(bg.layers) ? bg.layers.map(toLayer).filter((l): l is BackgroundLayer => l !== null) : []
    const aspect = isFiniteNumber(bg.aspect) && bg.aspect > 0 ? bg.aspect : null
    const color = typeof bg.color === 'string' && bg.color.trim() ? bg.color : DEFAULT_BACKGROUND_COLOR
    return { color, aspect, layers }
  }
  return { color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: imageUrl ? [legacyLayer(imageUrl)] : [] }
}

export function readPieces(options: unknown): PlacementPiece[] {
  const opts = isRecord(options) ? options : {}
  return Array.isArray(opts.pieces) ? (opts.pieces as PlacementPiece[]) : []
}
```

- [ ] **Step 4: Update the types**

In `types/modules.ts`, replace the `PiecePlacementOptions` interface (lines 143-155) with:

```ts
// Piece placement: the background is a COMPOSITION (a color plus positioned
// image layers), students drag pieces anywhere over it, and a piece is correct
// when its center lands inside its hidden `area`. All geometry is in percent
// of the composition; `aspect` is width/height (null = derive from the first
// layer at runtime, for rows migrated from the single image_url era).
export interface PiecePlacementOptions {
  background?: {
    color: string
    aspect: number | null
    layers: { id: string; imageUrl: string; x: number; y: number; width: number; height: number; ratio?: number }[]
  }
  pieces: {
    id: string
    label?: string
    imageUrl: string
    width: number
    area: { x: number; y: number; width: number; height: number }
  }[]
}
```

Add after `ClassItemType`:

```ts
/** Per-quiz presentation settings stored in class_items.quiz_settings (jsonb). */
export type QuizMode = 'focus' | 'sheet'
export interface QuizSettings {
  mode: QuizMode
}
```

Add to `ClassItem` (after `rich_content`):

```ts
  quiz_settings?: QuizSettings | Record<string, unknown> | null
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/quiz/__tests__/composition.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/quiz/composition.ts lib/quiz/__tests__/composition.test.ts types/modules.ts
git commit -m "quiz: composition helper and background/settings types"
```

### Task 2: Quiz settings reader

**Files:**
- Create: `lib/quiz/quiz-settings.ts`
- Test: `lib/quiz/__tests__/quiz-settings.test.ts`

**Interfaces:**
- Produces: `readQuizSettings(json: unknown): QuizSettings`, `DEFAULT_QUIZ_SETTINGS`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/quiz/__tests__/quiz-settings.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_SETTINGS, readQuizSettings } from '../quiz-settings'

describe('readQuizSettings', () => {
  it('defaults to focus mode', () => {
    expect(readQuizSettings(null)).toEqual({ mode: 'focus' })
    expect(readQuizSettings({})).toEqual(DEFAULT_QUIZ_SETTINGS)
    expect(readQuizSettings('garbage')).toEqual(DEFAULT_QUIZ_SETTINGS)
  })
  it('accepts sheet and rejects unknown modes', () => {
    expect(readQuizSettings({ mode: 'sheet' })).toEqual({ mode: 'sheet' })
    expect(readQuizSettings({ mode: 'paged' })).toEqual({ mode: 'focus' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/quiz/__tests__/quiz-settings.test.ts` — FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
// lib/quiz/quiz-settings.ts
import type { QuizSettings } from '@/types/modules'

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { mode: 'focus' }

/** Parse class_items.quiz_settings (jsonb). Anything unrecognized falls back to focus mode. */
export function readQuizSettings(json: unknown): QuizSettings {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return DEFAULT_QUIZ_SETTINGS
  const mode = (json as Record<string, unknown>).mode
  return { mode: mode === 'sheet' ? 'sheet' : 'focus' }
}
```

- [ ] **Step 4: Run test** — `npx vitest run lib/quiz/__tests__/quiz-settings.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quiz/quiz-settings.ts lib/quiz/__tests__/quiz-settings.test.ts
git commit -m "quiz: readQuizSettings for class_items.quiz_settings"
```

### Task 3: Migration 039 and database types

**Files:**
- Create: `supabase/migrations/039_quiz_settings_and_piece_composition.sql`
- Modify: `types/database.ts` (class_items Row/Insert/Update: add `quiz_settings`)
- Modify: `lib/i18n/__tests__/localize-quiz-options.test.ts` (add background case)

- [ ] **Step 1: Write the migration**

```sql
-- 039_quiz_settings_and_piece_composition.sql
-- 1) Per-quiz presentation settings ({"mode": "focus" | "sheet"}), read by
--    lib/quiz/quiz-settings.ts; anything else falls back to focus.
ALTER TABLE public.class_items
  ADD COLUMN IF NOT EXISTS quiz_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) piece_placement backgrounds become a composition
--    { color, aspect, layers: [{ id, imageUrl, x, y, width, height }] } inside
--    options (see lib/quiz/composition.ts). The old single image_url becomes one
--    full-bleed layer. `aspect` stays null because SQL cannot read image
--    dimensions; the student stage measures the layer at runtime and the
--    builder writes the real value on first save. image_url is cleared so the
--    composition is the single source of truth.
UPDATE public.quiz_questions
SET options = jsonb_set(
      coalesce(options, '{"pieces": []}'::jsonb),
      '{background}',
      jsonb_build_object(
        'color', '#0A0A0A',
        'aspect', null,
        'layers', CASE WHEN image_url IS NOT NULL AND btrim(image_url) <> ''
          THEN jsonb_build_array(jsonb_build_object(
                 'id', 'legacy', 'imageUrl', image_url,
                 'x', 0, 'y', 0, 'width', 100, 'height', 100))
          ELSE '[]'::jsonb END)),
    image_url = NULL,
    updated_at = now()
WHERE question_type = 'piece_placement'
  AND (options -> 'background') IS NULL;
```

- [ ] **Step 2: Exercise the migration against a scratch Postgres**

Postgres 14 binaries are in `/usr/local/bin`; a scratch cluster in the scratchpad works (socket dir must be short, use `-k /tmp`). Create stand-in tables and run:

```sql
CREATE SCHEMA public;
CREATE TABLE public.class_items (id serial primary key);
CREATE TABLE public.quiz_questions (id serial primary key, question_type text, options jsonb, image_url text, updated_at timestamptz);
INSERT INTO public.quiz_questions (question_type, options, image_url) VALUES
  ('piece_placement', '{"pieces":[{"id":"p1"}]}', 'https://x/bg.png'),
  ('piece_placement', NULL, NULL),
  ('multiple_choice', '{"choices":[]}', NULL);
\i supabase/migrations/039_quiz_settings_and_piece_composition.sql
SELECT id, options -> 'background' AS bg, image_url FROM public.quiz_questions ORDER BY id;
```

Expected: row 1 has `layers` with one `legacy` layer and `image_url` NULL; row 2 has `layers: []` and `pieces: []`; row 3 untouched (no `background`). Running the script a second time changes nothing (`WHERE (options->'background') IS NULL`).

- [ ] **Step 3: Hand-add the column to `types/database.ts`**

In the `class_items` table block (Row, Insert, Update), add next to `subtitles`:

```ts
          quiz_settings: Json
```
(`Json` in Row; `quiz_settings?: Json` in Insert and Update.) This is overwritten by regeneration after the migration is applied, but keeps `tsc` honest until then.

- [ ] **Step 4: Add the localize regression test**

Append to `lib/i18n/__tests__/localize-quiz-options.test.ts`:

```ts
describe('mergeLocalizedOptions – piece placement composition', () => {
  it('keeps the background composition structural (only piece labels overlay)', () => {
    const en = {
      background: { color: '#0A0A0A', aspect: 1.6, layers: [{ id: 'l1', imageUrl: 'riser.png', x: 20, y: 5, width: 60, height: 30 }] },
      pieces: [{ id: 'p1', label: 'Congas', imageUrl: 'c.png', width: 12, area: { x: 1, y: 2, width: 3, height: 4 } }],
    }
    const es = { pieces: [{ id: 'p1', label: 'Congas (ES)' }] }
    const out = mergeLocalizedOptions(en, es) as typeof en
    expect(out.background).toEqual(en.background)
    expect(out.pieces[0]).toEqual({ ...en.pieces[0], label: 'Congas (ES)' })
  })
})
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/i18n lib/quiz && npx tsc --noEmit` → all PASS, tsc clean.

- [ ] **Step 6: Apply to the hosted dev database — ONLY with the user's explicit go-ahead in chat**

Ask: "Ready to apply migration 039 to the hosted Supabase project (adds `class_items.quiz_settings`, rewrites `piece_placement` rows to the composition shape, clears their `image_url`). Go ahead?" If yes, run the supabase MCP `apply_migration` with the file contents, then `generate_typescript_types` and overwrite `types/database.ts`, then `npx tsc --noEmit`. If not yet, continue with the plan; every later task works without the migration because `readComposition` and `readQuizSettings` default correctly.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/039_quiz_settings_and_piece_composition.sql types/database.ts lib/i18n/__tests__/localize-quiz-options.test.ts
git commit -m "db: quiz_settings column and piece_placement composition backfill (039)"
```

---

## Phase 2 — Drag and drop, student

### Task 4: CSS module, locale merge helper, and the piece-placement stage

**Files:**
- Create: `components/class-viewer/lesson-viewer/quiz/quiz.module.css`
- Rewrite: `components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx`
- Modify: `components/class-viewer/lesson-viewer/quiz/question-input.tsx:137-149` (piece_placement case)
- Modify: `locales/en.json`, `locales/es.json` (keys under `dashboard.classViewer.quiz.pieces`)

**Interfaces:**
- Consumes: `readComposition`, `readPieces`, `FALLBACK_ASPECT`, `Background` (Task 1); `isPieceCorrect`, `PlacementPiece`, `PiecePlacement` from `lib/quiz/grading.ts`.
- Produces: `PiecePlacementInput({ background, pieces, placement, isGraded, onChange, maxHeight? })`, `CompositionBackground({ background })` (reused by the builder canvas), CSS module classes listed below.

- [ ] **Step 1: Create the CSS module**

```css
/* components/class-viewer/lesson-viewer/quiz/quiz.module.css
   Layout that depends on the quiz's own width, not the viewport (the lesson
   column varies with the sidebar). Colors stay in Tailwind tokens. */

/* ---------- containers ---------- */
.root { container: quiz / inline-size; }
.ppRoot { container: pp / inline-size; }

/* ---------- piece placement ---------- */
.pp { display: grid; gap: 16px; }
.stageWrap { display: grid; justify-items: center; }
.stage {
  position: relative;
  width: min(100%, calc(var(--stage-maxh, 62vh) * var(--stage-ratio, 1.6)));
  aspect-ratio: var(--stage-ratio, 1.6);
  overflow: hidden;
  border-radius: 16px;
  touch-action: none;
  user-select: none;
}
.tray { display: grid; gap: 10px; }
.trayList { display: grid; gap: 8px; }
@container pp (min-width: 760px) {
  .pp { grid-template-columns: minmax(0, 1fr) 250px; gap: 20px; align-items: start; }
  .tray { position: sticky; top: 20px; }
}
@container pp (max-width: 759px) {
  .trayList { grid-auto-flow: column; grid-auto-columns: 150px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 6px; }
  .trayItem { scroll-snap-align: start; }
}

/* ---------- focus stage ---------- */
.focus { display: grid; gap: 22px; }
.stageCol { min-width: 0; width: 100%; max-width: 820px; margin: 0 auto; }
.map { display: none; }
.hint { display: none; }
.question { font-size: 20px; }
.panel { padding: 22px; }
@container quiz (min-width: 700px) {
  .question { font-size: 24px; }
  .hint { display: inline-flex; }
  .panel { padding: 30px 32px; }
}
@container quiz (min-width: 1000px) {
  .focus { grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: start; }
  .map { display: block; position: sticky; top: 20px; }
}

/* ---------- exam sheet ---------- */
.sheet { display: grid; gap: 22px; }
.sheetGrid { display: grid; gap: 14px; }
.sheetRail { display: grid; gap: 14px; }
.sheetBar { display: flex; }
@container quiz (min-width: 1000px) {
  .sheet { grid-template-columns: minmax(0, 1fr) 260px; gap: 28px; align-items: start; }
  .sheetRail { position: sticky; top: 20px; }
  .sheetBar { display: none; }
}
@container quiz (min-width: 1180px) {
  .sheetGrid { grid-template-columns: 1fr 1fr; }
  .span { grid-column: 1 / -1; }
}

/* ---------- motion ---------- */
.rise { animation: rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.pop { animation: pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.okPulse { animation: okPulse 700ms ease-out, pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.bounceIn { animation: bounceIn 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 350ms; }
.burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; z-index: 6; }
.burstPiece {
  position: absolute; left: -3px; top: -3px; width: 7px; height: 7px; border-radius: 2px;
  animation: burst 800ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}
.levelBar { animation: level 1.2s ease-in-out infinite; transform-origin: bottom; }

@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.035); } 100% { transform: scale(1); } }
@keyframes okPulse { 0% { box-shadow: 0 0 0 0 hsl(var(--success) / 0.45); } 100% { box-shadow: 0 0 0 14px transparent; } }
@keyframes bounceIn { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes burst {
  0% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(0.5); opacity: 0; }
}
@keyframes level { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }

@media (prefers-reduced-motion: reduce) {
  .rise, .pop, .okPulse, .bounceIn, .burstPiece, .levelBar { animation: none; }
}
```

- [ ] **Step 2: Add the locale keys (EN and ES)**

This is the merge command used by every locale step in this plan. It deep-merges an object into `dashboard.classViewer.quiz` and rewrites the file with the same 2-space formatting.

```bash
merge_quiz_keys() { node -e '
const fs=require("fs"); const [file,json]=process.argv.slice(1); const add=JSON.parse(json);
const j=JSON.parse(fs.readFileSync(file,"utf8"));
const merge=(t,s)=>{for(const [k,v] of Object.entries(s)){ if(v&&typeof v==="object"&&!Array.isArray(v)){ if(!t[k]||typeof t[k]!=="object") t[k]={}; merge(t[k],v);} else t[k]=v; }};
merge(j.dashboard.classViewer.quiz, add);
fs.writeFileSync(file, JSON.stringify(j,null,2)+"\n");
' "$1" "$2"; }

merge_quiz_keys locales/en.json '{"pieces":{"title":"Pieces","placedOf":"{placed} of {total} placed","hint":"Drag each piece to where it belongs","allPlaced":"Everything is placed. Drag a piece off the stage to bring it back here.","notPlaced":"Not placed","wasPlaced":"Every piece was placed."}}'
merge_quiz_keys locales/es.json '{"pieces":{"title":"Piezas","placedOf":"{placed} de {total} colocadas","hint":"Arrastra cada pieza a su lugar","allPlaced":"Todo está colocado. Arrastra una pieza fuera del escenario para devolverla aquí.","notPlaced":"Sin colocar","wasPlaced":"Todas las piezas fueron colocadas."}}'
git diff --stat locales/
```
Expected: only additions in both files. If the diff shows reformatting of unrelated lines, revert (`git checkout -- locales/`) and add the six keys by hand next to `puzzleBackground`.

- [ ] **Step 3: Rewrite the piece-placement input**

```tsx
// components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { FALLBACK_ASPECT, type Background } from '@/lib/quiz/composition'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import styles from './quiz.module.css'

type Placement = Record<string, PiecePlacement> // pieceId -> center in % of the stage

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function PieceImage({ piece }: { piece: PlacementPiece }) {
  const { t } = useTranslation()
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={piece.imageUrl}
      alt={piece.label || t('dashboard.classViewer.quiz.puzzlePiece')}
      className="block h-auto w-full select-none"
      draggable={false}
    />
  ) : (
    <div className="aspect-square w-full rounded-lg bg-muted" />
  )
}

/** Color fill plus positioned image layers. Shared with the admin canvas. */
export function CompositionBackground({ background }: { background: Background }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: background.color }} />
      {background.layers.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.id}
          src={l.imageUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute select-none"
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%`, objectFit: 'fill' }}
        />
      ))}
    </>
  )
}

/** Resolve the stage aspect: stored value, else the first layer's natural ratio, else the fallback. */
export function useStageAspect(background: Background): number {
  const [measured, setMeasured] = useState<number | null>(null)
  const first = background.layers[0]?.imageUrl
  useEffect(() => {
    if (background.aspect || !first) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) setMeasured(img.naturalWidth / img.naturalHeight)
    }
    img.src = first
  }, [background.aspect, first])
  return background.aspect ?? measured ?? FALLBACK_ASPECT
}

/**
 * Students drag pieces from the tray onto the stage. The stage keeps the
 * composition's aspect ratio and is capped by --stage-maxh (62vh by default),
 * so it can never grow past the viewport however wide the lesson column is.
 * Correct areas stay hidden until graded; a piece is correct when its center
 * lands inside its area (isPieceCorrect).
 */
export function PiecePlacementInput({
  background,
  pieces,
  placement,
  isGraded,
  onChange,
  maxHeight,
}: {
  background: Background
  pieces: PlacementPiece[]
  placement: Placement
  isGraded: boolean
  onChange: (v: Placement) => void
  /** CSS length for the stage's max height (default 62vh; the admin preview passes px). */
  maxHeight?: string
}) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  // The dragged piece follows the pointer in viewport px so it can travel
  // between the tray and the stage without being clamped to either.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; width: number } | null>(null)

  const unplaced = pieces.filter((p) => !placement[p.id] && drag?.id !== p.id)
  const placedCount = pieces.filter((p) => placement[p.id]).length

  const startDrag = (e: React.PointerEvent, pieceId: string) => {
    if (isGraded) return
    e.preventDefault()
    const stage = stageRef.current?.getBoundingClientRect()
    const piece = pieces.find((p) => p.id === pieceId)
    if (!stage || !piece) return
    setDrag({ id: pieceId, x: e.clientX, y: e.clientY, width: (stage.width * piece.width) / 100 })
    const onMove = (ev: PointerEvent) => setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return
      const x = ((ev.clientX - r.left) / r.width) * 100
      const y = ((ev.clientY - r.top) / r.height) * 100
      const next = { ...placement }
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) next[pieceId] = { x: clamp(x), y: clamp(y) }
      else delete next[pieceId] // released off the stage → back to the tray
      onChange(next)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const state = (p: PlacementPiece): 'idle' | 'correct' | 'wrong' =>
    !isGraded ? 'idle' : isPieceCorrect(p, placement[p.id]) ? 'correct' : 'wrong'

  return (
    <div className={styles.ppRoot}>
      <div className={styles.pp}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            className={cn(styles.stage, 'border border-border')}
            style={{ ['--stage-ratio' as string]: aspect, ['--stage-maxh' as string]: maxHeight ?? '62vh' }}
            aria-label={t('dashboard.classViewer.quiz.puzzleBackground')}
          >
            <CompositionBackground background={background} />

            {placedCount === 0 && !drag && !isGraded && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-black/45 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                  {t('dashboard.classViewer.quiz.pieces.hint')}
                </span>
              </div>
            )}

            {/* Revealed correct areas for missed or unplaced pieces, after grading. */}
            {isGraded &&
              pieces
                .filter((p) => !isPieceCorrect(p, placement[p.id]))
                .map((p) => (
                  <div
                    key={`area-${p.id}`}
                    style={{ left: `${p.area.x}%`, top: `${p.area.y}%`, width: `${p.area.width}%`, height: `${p.area.height}%` }}
                    className="pointer-events-none absolute rounded-lg border-2 border-dashed border-success bg-success/15"
                  >
                    {p.label && (
                      <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {p.label}
                      </span>
                    )}
                  </div>
                ))}

            {/* Placed pieces (the one being dragged renders as the ghost instead). */}
            {pieces
              .filter((p) => placement[p.id] && drag?.id !== p.id)
              .map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => startDrag(e, p.id)}
                  title={p.label}
                  style={{ left: `${placement[p.id].x}%`, top: `${placement[p.id].y}%`, width: `${p.width}%` }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 touch-none drop-shadow-lg',
                    !isGraded && 'cursor-grab active:cursor-grabbing',
                    state(p) === 'correct' && 'rounded-lg outline outline-[2.5px] outline-offset-[3px] outline-success',
                    state(p) === 'wrong' && 'rounded-lg outline outline-[2.5px] outline-offset-[3px] outline-terracotta',
                  )}
                >
                  <PieceImage piece={p} />
                </div>
              ))}
          </div>
        </div>

        <aside className={styles.tray}>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                {t('dashboard.classViewer.quiz.pieces.title')}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('dashboard.classViewer.quiz.pieces.placedOf', { placed: placedCount, total: pieces.length })}
              </span>
            </div>
            <div className={styles.trayList}>
              {unplaced.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => startDrag(e, p.id)}
                  className={cn(
                    styles.trayItem,
                    'grid grid-cols-[56px_1fr] items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-raised p-2 pr-2.5 touch-none select-none transition-all',
                    !isGraded && 'cursor-grab hover:-translate-y-px hover:border-border-strong active:cursor-grabbing',
                    isGraded && 'border-terracotta',
                  )}
                >
                  <span className="grid h-12 w-14 place-items-center rounded-lg bg-sunken p-1">
                    <PieceImage piece={p} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight">
                    {p.label}
                    {isGraded && <small className="block text-[11px] font-medium text-muted-foreground">{t('dashboard.classViewer.quiz.pieces.notPlaced')}</small>}
                  </span>
                </div>
              ))}
              {unplaced.length === 0 && !drag && (
                <div className="rounded-xl border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {isGraded ? t('dashboard.classViewer.quiz.pieces.wasPlaced') : t('dashboard.classViewer.quiz.pieces.allPlaced')}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Drag ghost: fixed to the viewport so it can cross from tray to stage. */}
      {drag &&
        (() => {
          const p = pieces.find((pc) => pc.id === drag.id)
          if (!p) return null
          return (
            <div
              style={{ left: drag.x, top: drag.y, width: drag.width }}
              className="pointer-events-none fixed z-[1000] -translate-x-1/2 -translate-y-1/2 opacity-95 drop-shadow-2xl"
            >
              <PieceImage piece={p} />
            </div>
          )
        })()}
    </div>
  )
}
```

`hover:border-border-strong` is not a token in this repo; use `hover:border-foreground/20` instead (do that when typing the file).

- [ ] **Step 4: Point question-input at the new props**

Replace the `piece_placement` case in `question-input.tsx` with:

```tsx
    case 'piece_placement': {
      const placement = (answer as Record<string, PiecePlacement>) ?? {}
      return (
        <PiecePlacementInput
          background={readComposition(q.options, q.image_url)}
          pieces={readPieces(q.options)}
          placement={placement}
          isGraded={isGraded}
          onChange={(v) => onChange(v)}
        />
      )
    }
```
and add `import { readComposition, readPieces } from '@/lib/quiz/composition'`; remove the now-unused `PlacementPiece` type import.

- [ ] **Step 5: Typecheck, lint, browser check**

Run: `npx tsc --noEmit && npm run lint`.
Browser: open a lesson with a `piece_placement` question (or author one in Course Studio with the old builder, which still writes `image_url`; `readComposition` turns it into a legacy layer). At a 1440px window the stage must be no taller than ~62% of the viewport, pieces sit in the right-hand tray, dragging onto the stage places them, dragging off returns them, Check reveals dashed areas. Narrow the window below ~760px of quiz width: tray becomes a horizontal strip under the stage.

- [ ] **Step 6: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/quiz.module.css components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx components/class-viewer/lesson-viewer/quiz/question-input.tsx locales/en.json locales/es.json
git commit -m "quiz: viewport-bounded piece placement stage with tray and composed background"
```

---

## Phase 3 — Engine, sound, tiles, feedback, focus stage

### Task 5: Pure quiz engine reducer

**Files:**
- Create: `lib/quiz/engine.ts`
- Test: `lib/quiz/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `gradeQuestionScore`, `shuffleStable`, `OrderItem` from `lib/quiz/grading.ts`; `SoundCue` from Task 6 (type only — create `lib/quiz/sounds.ts` type first or define the union here and re-export; this plan defines `SoundCue` in `engine.ts` and has `sounds.ts` import it).
- Produces: `Outcome`, `outcomeOf(score)`, `QuizState`, `QuizAction`, `seedAnswers(questions)`, `initQuizState(questions)`, `quizReducer(questions)`, `totalScore(questions, graded)`, `percentScore(questions, graded)`, `cueFor(score, streak)`, `SoundCue`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/quiz/__tests__/engine.test.ts
import { describe, expect, it } from 'vitest'
import { cueFor, initQuizState, outcomeOf, percentScore, quizReducer, seedAnswers, totalScore } from '../engine'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q', class_item_id: 'c', order_index: 0, question: 'Q', question_type: 'multiple_choice', options: null,
    correct_answer: null, explanation: null, question_es: null, explanation_es: null, options_es: null,
    audio_url: null, image_url: null, created_at: null, updated_at: null, ...partial,
  }
}
const mc = q({ id: 'mc', options: { choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, correct_answer: 'b' })
const tf = q({ id: 'tf', question_type: 'true_false', correct_answer: 'true' })
const ord = q({ id: 'ord', question_type: 'ordering_sequence', options: { items: [{ id: 'i1', text: '1', correctPosition: 0 }, { id: 'i2', text: '2', correctPosition: 1 }, { id: 'i3', text: '3', correctPosition: 2 }] } })
const questions = [mc, tf, ord]

describe('seedAnswers / initQuizState', () => {
  it('pre-shuffles ordering questions and seeds empty maps for matching and pieces', () => {
    const seeded = seedAnswers([ord, q({ id: 'm', question_type: 'matching_pairs' }), q({ id: 'p', question_type: 'piece_placement' })])
    expect(new Set(seeded.ord as string[])).toEqual(new Set(['i1', 'i2', 'i3']))
    expect(seeded.m).toEqual({})
    expect(seeded.p).toEqual({})
    expect(initQuizState(questions)).toMatchObject({ graded: {}, streak: 0 })
  })
})

describe('quizReducer', () => {
  const reduce = quizReducer(questions)
  it('sets answers and grades once', () => {
    let s = initQuizState(questions)
    s = reduce(s, { type: 'set', id: 'mc', value: 'b' })
    s = reduce(s, { type: 'check', id: 'mc' })
    expect(s.graded.mc).toBe(1)
    const again = reduce(reduce(s, { type: 'set', id: 'mc', value: 'a' }), { type: 'check', id: 'mc' })
    expect(again.graded.mc).toBe(1) // already graded: no re-grade
  })
  it('tracks a streak that resets on a miss', () => {
    let s = initQuizState(questions)
    s = reduce(reduce(s, { type: 'set', id: 'mc', value: 'b' }), { type: 'check', id: 'mc' })
    s = reduce(reduce(s, { type: 'set', id: 'tf', value: 'true' }), { type: 'check', id: 'tf' })
    expect(s.streak).toBe(2)
    s = reduce(reduce(s, { type: 'set', id: 'ord', value: ['i3', 'i2', 'i1'] }), { type: 'check', id: 'ord' })
    expect(s.streak).toBe(0)
    expect(s.graded.ord).toBe(0)
  })
  it('checkMany grades ungraded ids and leaves the streak at 0', () => {
    let s = initQuizState(questions)
    s = reduce(s, { type: 'set', id: 'mc', value: 'b' })
    s = reduce(s, { type: 'checkMany', ids: ['mc', 'tf'] })
    expect(s.graded).toEqual({ mc: 1, tf: 0 })
    expect(s.streak).toBe(0)
  })
  it('reset returns to the initial state', () => {
    let s = initQuizState(questions)
    s = reduce(reduce(s, { type: 'set', id: 'mc', value: 'b' }), { type: 'check', id: 'mc' })
    expect(reduce(s, { type: 'reset' })).toMatchObject({ graded: {}, streak: 0 })
  })
})

describe('scores and cues', () => {
  it('sums and rounds', () => {
    expect(totalScore(questions, { mc: 1, tf: 0.5 })).toBe(1.5)
    expect(percentScore(questions, { mc: 1, tf: 0.5 })).toBe(50)
    expect(percentScore([], {})).toBe(0)
  })
  it('maps outcomes and cues', () => {
    expect(outcomeOf(1)).toBe('ok'); expect(outcomeOf(0.4)).toBe('part'); expect(outcomeOf(0)).toBe('bad')
    expect(cueFor(1, 1)).toBe('ok'); expect(cueFor(1, 3)).toBe('streak'); expect(cueFor(1, 4)).toBe('ok'); expect(cueFor(1, 6)).toBe('streak')
    expect(cueFor(0.5, 9)).toBe('part'); expect(cueFor(0, 9)).toBe('bad')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/quiz/__tests__/engine.test.ts` → FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
// lib/quiz/engine.ts
import { gradeQuestionScore, shuffleStable, type OrderItem } from './grading'
import type { QuizQuestion } from '@/types/modules'

export type Outcome = 'ok' | 'part' | 'bad'
export type SoundCue = 'ok' | 'part' | 'bad' | 'streak' | 'fanfare' | 'soft'

export const outcomeOf = (score: number): Outcome => (score >= 1 ? 'ok' : score > 0 ? 'part' : 'bad')

export interface QuizState {
  answers: Record<string, unknown>
  graded: Record<string, number>
  /** consecutive fully-correct checks in this session; resets on any miss */
  streak: number
}

export type QuizAction =
  | { type: 'set'; id: string; value: unknown }
  | { type: 'check'; id: string }
  | { type: 'checkMany'; ids: string[] }
  | { type: 'reset' }

/** Seed ordering questions with a stable shuffled order so grading always has a defined answer. */
export function seedAnswers(questions: QuizQuestion[]): Record<string, unknown> {
  const init: Record<string, unknown> = {}
  for (const q of questions) {
    if (q.question_type === 'ordering_sequence') {
      const items = ((q.options ?? {}) as Record<string, unknown>).items as OrderItem[] | undefined
      init[q.id] = shuffleStable((items ?? []).map((it) => it.id), q.id)
    } else if (q.question_type === 'piece_placement' || q.question_type === 'matching_pairs') {
      init[q.id] = {}
    }
  }
  return init
}

export function initQuizState(questions: QuizQuestion[]): QuizState {
  return { answers: seedAnswers(questions), graded: {}, streak: 0 }
}

export function quizReducer(questions: QuizQuestion[]) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return (state: QuizState, action: QuizAction): QuizState => {
    switch (action.type) {
      case 'set':
        return { ...state, answers: { ...state.answers, [action.id]: action.value } }
      case 'check': {
        const q = byId.get(action.id)
        if (!q || action.id in state.graded) return state
        const score = gradeQuestionScore(q, state.answers[action.id])
        return { ...state, graded: { ...state.graded, [action.id]: score }, streak: score >= 1 ? state.streak + 1 : 0 }
      }
      case 'checkMany': {
        const graded = { ...state.graded }
        for (const id of action.ids) {
          const q = byId.get(id)
          if (q && !(id in graded)) graded[id] = gradeQuestionScore(q, state.answers[id])
        }
        return { ...state, graded, streak: 0 }
      }
      case 'reset':
        return initQuizState(questions)
    }
  }
}

export function totalScore(questions: QuizQuestion[], graded: Record<string, number>): number {
  return questions.reduce((sum, q) => sum + (graded[q.id] ?? 0), 0)
}

export function percentScore(questions: QuizQuestion[], graded: Record<string, number>): number {
  return questions.length ? Math.round((totalScore(questions, graded) / questions.length) * 100) : 0
}

/** Which cue to play after a check. Every third consecutive hit gets the streak sparkle. */
export function cueFor(score: number, streak: number): SoundCue {
  if (score >= 1) return streak >= 3 && streak % 3 === 0 ? 'streak' : 'ok'
  return score > 0 ? 'part' : 'bad'
}
```

- [ ] **Step 4: Run tests** — `npx vitest run lib/quiz/__tests__/engine.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quiz/engine.ts lib/quiz/__tests__/engine.test.ts
git commit -m "quiz: pure engine reducer with streak and cue selection"
```

### Task 6: Sound cues, preferences, and the two hooks

**Files:**
- Create: `lib/quiz/sounds.ts`, `lib/quiz/prefs.ts`, `hooks/use-quiz-prefs.ts`, `hooks/use-quiz-engine.ts`
- Test: `lib/quiz/__tests__/sounds.test.ts`, `lib/quiz/__tests__/prefs.test.ts`

**Interfaces:**
- Consumes: `SoundCue`, `quizReducer`, `initQuizState`, `QuizState`, `QuizAction` (Task 5); `gradeQuestionScore` (grading).
- Produces: `CUES`, `scheduleCue(cue, ctx): number`, `playCue(cue, enabled): void`, `getAudioContext()`; `QuizPrefs`, `DEFAULT_QUIZ_PREFS`, `QUIZ_PREFS_KEY`, `parseQuizPrefs`, `loadQuizPrefs`, `saveQuizPrefs`; `useQuizPrefs(): [QuizPrefs, (patch) => void]`; `useQuizEngine(questions): { state, setAnswer, check, checkMany, reset }` where `check(id)` returns the score it just recorded and `checkMany(ids)` returns the mean score of those ids.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/quiz/__tests__/sounds.test.ts
import { describe, expect, it } from 'vitest'
import { CUES, scheduleCue, type CueContext } from '../sounds'

function fakeContext() {
  const created = { osc: 0, gain: 0, started: [] as number[] }
  const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
  const ctx: CueContext = {
    currentTime: 1,
    state: 'running',
    destination: {} as AudioNode,
    resume: async () => {},
    createOscillator: () => {
      created.osc++
      return { type: 'sine', frequency: param, connect: () => ({}), start: (t: number) => created.started.push(t), stop: () => {} } as unknown as OscillatorNode
    },
    createGain: () => {
      created.gain++
      return { gain: param, connect: () => ({}) } as unknown as GainNode
    },
  }
  return { ctx, created }
}

describe('CUES', () => {
  it('defines every cue with ascending-or-equal start offsets', () => {
    for (const notes of Object.values(CUES)) {
      expect(notes.length).toBeGreaterThan(0)
      for (let i = 1; i < notes.length; i++) expect(notes[i].at).toBeGreaterThanOrEqual(notes[i - 1].at)
    }
    expect(CUES.ok[0].freq).toBe(1046.5)
  })
})

describe('scheduleCue', () => {
  it('creates one oscillator and gain per note, starting 10ms ahead', () => {
    const { ctx, created } = fakeContext()
    const n = scheduleCue('fanfare', ctx)
    expect(n).toBe(CUES.fanfare.length)
    expect(created.osc).toBe(n)
    expect(created.gain).toBe(n)
    expect(created.started[0]).toBeCloseTo(1.01, 5)
  })
})
```

```ts
// lib/quiz/__tests__/prefs.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_PREFS, QUIZ_PREFS_KEY, loadQuizPrefs, parseQuizPrefs, saveQuizPrefs } from '../prefs'

describe('quiz prefs', () => {
  it('defaults sound on and tolerates junk', () => {
    expect(DEFAULT_QUIZ_PREFS).toEqual({ sound: true })
    expect(parseQuizPrefs(null)).toEqual({ sound: true })
    expect(parseQuizPrefs('{not json')).toEqual({ sound: true })
    expect(parseQuizPrefs('{"sound":"loud"}')).toEqual({ sound: true })
    expect(parseQuizPrefs('{"sound":false}')).toEqual({ sound: false })
  })
  it('round-trips through a storage-like object', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    saveQuizPrefs(storage, { sound: false })
    expect(store.get(QUIZ_PREFS_KEY)).toBe('{"sound":false}')
    expect(loadQuizPrefs(storage)).toEqual({ sound: false })
    expect(loadQuizPrefs(null)).toEqual(DEFAULT_QUIZ_PREFS)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/quiz/__tests__/sounds.test.ts lib/quiz/__tests__/prefs.test.ts` → FAIL, modules missing.

- [ ] **Step 3: Implement sounds**

```ts
// lib/quiz/sounds.ts
import type { SoundCue } from './engine'

export type { SoundCue }

export interface Note {
  freq: number
  /** seconds after the cue start */
  at: number
  /** seconds to decay to silence */
  dur: number
  gain: number
  type: 'sine' | 'triangle'
}

const n = (freq: number, at: number, dur: number, gain = 0.2, type: Note['type'] = 'sine'): Note => ({ freq, at, dur, gain, type })

/** Envelopes from the approved prototype. Short, bright, on the quiet side. */
export const CUES: Record<SoundCue, Note[]> = {
  ok: [n(1046.5, 0, 0.3), n(2093, 0, 0.16, 0.05), n(1568, 0.09, 0.38), n(3136, 0.09, 0.14, 0.04)],
  part: [n(880, 0, 0.3), n(1108.7, 0.1, 0.32)],
  bad: [n(196, 0, 0.26, 0.16, 'triangle'), n(174.6, 0.11, 0.3, 0.14, 'triangle')],
  streak: [n(1318.5, 0, 0.18, 0.12), n(1568, 0.07, 0.18, 0.12), n(2093, 0.14, 0.34, 0.14)],
  fanfare: [n(523.25, 0, 0.45, 0.18), n(659.25, 0.09, 0.45, 0.18), n(783.99, 0.18, 0.45, 0.18), n(1046.5, 0.27, 0.45, 0.18), n(1318.5, 0.36, 0.7, 0.1)],
  soft: [n(523.25, 0, 0.4, 0.14), n(659.25, 0.12, 0.5, 0.11)],
}

export const ATTACK_SECONDS = 0.012
const LEAD_SECONDS = 0.01

/** The slice of AudioContext we touch, so tests can pass a fake. */
export interface CueContext {
  currentTime: number
  state: string
  destination: AudioNode
  resume(): Promise<void>
  createOscillator(): OscillatorNode
  createGain(): GainNode
}

/** Schedule every note of a cue on the given context. Returns the note count. */
export function scheduleCue(cue: SoundCue, ctx: CueContext): number {
  if (ctx.state === 'suspended') void ctx.resume()
  const t0 = ctx.currentTime + LEAD_SECONDS
  for (const note of CUES[cue]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = note.type
    osc.frequency.setValueAtTime(note.freq, t0 + note.at)
    gain.gain.setValueAtTime(0.0001, t0 + note.at)
    gain.gain.exponentialRampToValueAtTime(note.gain, t0 + note.at + ATTACK_SECONDS)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0 + note.at)
    osc.stop(t0 + note.at + note.dur + 0.05)
  }
  return CUES[cue].length
}

let shared: AudioContext | null = null

/** Lazily create one AudioContext per page. Null on the server or when unsupported. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (shared) return shared
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    shared = new Ctor()
  } catch {
    return null
  }
  return shared
}

/** Play a cue if sound is enabled. Safe to call anywhere; silently no-ops without Web Audio. */
export function playCue(cue: SoundCue, enabled: boolean): void {
  if (!enabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  scheduleCue(cue, ctx)
}
```

- [ ] **Step 4: Implement prefs**

```ts
// lib/quiz/prefs.ts
/** Per-student quiz preferences persisted in localStorage. */
import { z } from 'zod'

export const QUIZ_PREFS_KEY = 'lmm-quiz-prefs'

export const quizPrefsSchema = z.object({ sound: z.boolean() })
export type QuizPrefs = z.infer<typeof quizPrefsSchema>
export const DEFAULT_QUIZ_PREFS: QuizPrefs = { sound: true }

export function parseQuizPrefs(raw: string | null): QuizPrefs {
  if (!raw) return DEFAULT_QUIZ_PREFS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_QUIZ_PREFS
    const result = quizPrefsSchema.safeParse({ ...DEFAULT_QUIZ_PREFS, ...(parsed as Record<string, unknown>) })
    return result.success ? result.data : DEFAULT_QUIZ_PREFS
  } catch {
    return DEFAULT_QUIZ_PREFS
  }
}

export function loadQuizPrefs(storage: Pick<Storage, 'getItem'> | null): QuizPrefs {
  if (!storage) return DEFAULT_QUIZ_PREFS
  try {
    return parseQuizPrefs(storage.getItem(QUIZ_PREFS_KEY))
  } catch {
    return DEFAULT_QUIZ_PREFS
  }
}

export function saveQuizPrefs(storage: Pick<Storage, 'setItem'> | null, prefs: QuizPrefs): void {
  if (!storage) return
  try {
    storage.setItem(QUIZ_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // private mode / quota: the preference simply does not persist
  }
}
```

- [ ] **Step 5: Implement the hooks**

```ts
// hooks/use-quiz-prefs.ts
'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_QUIZ_PREFS, loadQuizPrefs, saveQuizPrefs, type QuizPrefs } from '@/lib/quiz/prefs'

/** Same external-store pattern as use-tuner-prefs: SSR renders defaults, the client swaps in stored values without a hydration mismatch. */
let cached: QuizPrefs | null = null
const listeners = new Set<() => void>()

function getSnapshot(): QuizPrefs {
  if (!cached) cached = loadQuizPrefs(typeof window === 'undefined' ? null : window.localStorage)
  return cached
}
function getServerSnapshot(): QuizPrefs {
  return DEFAULT_QUIZ_PREFS
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
function update(patch: Partial<QuizPrefs>): void {
  cached = { ...getSnapshot(), ...patch }
  saveQuizPrefs(typeof window === 'undefined' ? null : window.localStorage, cached)
  listeners.forEach((l) => l())
}

export function useQuizPrefs(): [QuizPrefs, (patch: Partial<QuizPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const set = useCallback((patch: Partial<QuizPrefs>) => update(patch), [])
  return [prefs, set]
}
```

```ts
// hooks/use-quiz-engine.ts
'use client'

import { useCallback, useMemo, useReducer } from 'react'
import { initQuizState, quizReducer, type QuizState } from '@/lib/quiz/engine'
import { gradeQuestionScore } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'

export interface QuizEngine {
  state: QuizState
  setAnswer: (id: string, value: unknown) => void
  /** Grades one question and returns the score it recorded (or the existing one). */
  check: (id: string) => number
  /** Grades several questions at once and returns their mean score. */
  checkMany: (ids: string[]) => number
  reset: () => void
}

export function useQuizEngine(questions: QuizQuestion[]): QuizEngine {
  const reducer = useMemo(() => quizReducer(questions), [questions])
  const [state, dispatch] = useReducer(reducer, questions, initQuizState)
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  const setAnswer = useCallback((id: string, value: unknown) => dispatch({ type: 'set', id, value }), [])
  const check = useCallback(
    (id: string) => {
      if (id in state.graded) return state.graded[id]
      const q = byId.get(id)
      const score = q ? gradeQuestionScore(q, state.answers[id]) : 0
      dispatch({ type: 'check', id })
      return score
    },
    [state, byId],
  )
  const checkMany = useCallback(
    (ids: string[]) => {
      const scores = ids.map((id) => (id in state.graded ? state.graded[id] : gradeQuestionScore(byId.get(id)!, state.answers[id])))
      dispatch({ type: 'checkMany', ids })
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    },
    [state, byId],
  )
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, setAnswer, check, checkMany, reset }
}
```

- [ ] **Step 6: Run tests and typecheck** — `npx vitest run lib/quiz && npx tsc --noEmit` → PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add lib/quiz/sounds.ts lib/quiz/prefs.ts lib/quiz/__tests__/sounds.test.ts lib/quiz/__tests__/prefs.test.ts hooks/use-quiz-prefs.ts hooks/use-quiz-engine.ts
git commit -m "quiz: synthesized sound cues, sound preference, engine and prefs hooks"
```

### Task 7: Burst, streak chip, type chip, tile states, terracotta button

**Files:**
- Create: `.../quiz/burst.tsx`, `.../quiz/streak-chip.tsx`, `.../quiz/type-chip.tsx`, `.../quiz/input-props.ts`
- Rewrite: `.../quiz/option-tile.tsx`
- Modify: `components/ui/button.tsx:11-24` (add `terracotta` variant)
- Modify: `locales/*.json` (`streak.*`)

**Interfaces:**
- Produces: `Burst({ count?, spread? })`; `StreakChip({ count, pop })`; `TypeChip({ type })`; `QuestionInputProps { question: QuizQuestion; answer: unknown; isGraded: boolean; onChange: (v: unknown) => void }`; `TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal' | 'dim'`; `tileState(isCorrect, picked, graded): TileState`; `OptionTile({ letter?, hint?, size?, state, disabled?, onClick?, children })`; Button `variant="terracotta"`.

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"streak":{"inRow":"{count} in a row","onFire":"On fire · {count} in a row"},"tile":{"correct":"Correct","answer":"Answer","yourPick":"Your pick"}}'
merge_quiz_keys locales/es.json '{"streak":{"inRow":"{count} seguidas","onFire":"En racha · {count} seguidas"},"tile":{"correct":"Correcta","answer":"Respuesta","yourPick":"Tu elección"}}'
```

- [ ] **Step 2: Shared props type**

```ts
// components/class-viewer/lesson-viewer/quiz/input-props.ts
import type { QuizQuestion } from '@/types/modules'

export interface QuestionInputProps {
  question: QuizQuestion
  answer: unknown
  isGraded: boolean
  onChange: (v: unknown) => void
}
```

- [ ] **Step 3: Burst, streak chip, type chip**

```tsx
// components/class-viewer/lesson-viewer/quiz/burst.tsx
'use client'

import { useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import styles from './quiz.module.css'

const COLORS = ['hsl(var(--success))', 'hsl(var(--gold-highlight))', 'hsl(var(--primary))', '#F5E6C8']

/** Small confetti burst from the center of its (position: relative) parent. Deterministic, SSR-safe, skipped under reduced motion. */
export function Burst({ count = 14, spread = 64 }: { count?: number; spread?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.35
        const dist = spread * (0.6 + ((i * 7) % 5) / 10)
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 18, rot: (i * 53) % 360, color: COLORS[i % COLORS.length], delay: (i % 3) * 25 }
      }),
    [count, spread],
  )
  if (reduce) return null
  return (
    <span className={styles.burst} aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          className={styles.burstPiece}
          style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--r' as string]: `${p.rot}deg`, background: p.color, animationDelay: `${p.delay}ms` }}
        />
      ))}
    </span>
  )
}
```

```tsx
// components/class-viewer/lesson-viewer/quiz/streak-chip.tsx
'use client'

import { Flame } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import styles from './quiz.module.css'

/** Shows from two correct in a row; gold from four. `pop` replays the scale animation. */
export function StreakChip({ count, pop }: { count: number; pop: boolean }) {
  const { t } = useTranslation()
  if (count < 2) return null
  const hot = count >= 4
  return (
    <span
      key={pop ? `pop-${count}` : `still-${count}`}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-xs font-bold',
        hot ? 'bg-gradient-to-r from-primary/25 to-gold/25 text-gold' : 'bg-primary/15 text-primary',
        pop && styles.pop,
      )}
    >
      <Flame className="h-3.5 w-3.5" />
      {t(hot ? 'dashboard.classViewer.quiz.streak.onFire' : 'dashboard.classViewer.quiz.streak.inRow', { count })}
    </span>
  )
}
```

```tsx
// components/class-viewer/lesson-viewer/quiz/type-chip.tsx
'use client'

import { Ear, Hand, Link2, List, ListOrdered, RectangleHorizontal, ToggleLeft, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import type { QuestionType } from '@/types/modules'

const META: Record<QuestionType, { key: string; icon: LucideIcon }> = {
  multiple_choice: { key: 'dashboard.classViewer.quiz.types.multipleChoice', icon: List },
  true_false: { key: 'dashboard.classViewer.quiz.types.trueFalse', icon: ToggleLeft },
  text_answer: { key: 'dashboard.classViewer.quiz.types.textAnswer', icon: Type },
  audio: { key: 'dashboard.classViewer.quiz.types.audio', icon: Ear },
  audio_choice: { key: 'dashboard.classViewer.quiz.types.audioChoice', icon: Ear },
  piece_placement: { key: 'dashboard.classViewer.quiz.types.piecePlacement', icon: Hand },
  fill_in_blank: { key: 'dashboard.classViewer.quiz.types.fillInBlank', icon: RectangleHorizontal },
  matching_pairs: { key: 'dashboard.classViewer.quiz.types.matchingPairs', icon: Link2 },
  ordering_sequence: { key: 'dashboard.classViewer.quiz.types.orderingSequence', icon: ListOrdered },
}

export function typeIcon(type: QuestionType): LucideIcon {
  return META[type]?.icon ?? List
}

export function TypeChip({ type }: { type: QuestionType }) {
  const { t } = useTranslation()
  const meta = META[type]
  const Icon = meta?.icon ?? List
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary/12 px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
      <Icon className="h-3 w-3" />
      {meta ? t(meta.key) : type}
    </span>
  )
}
```

- [ ] **Step 4: Rewrite OptionTile**

```tsx
// components/class-viewer/lesson-viewer/quiz/option-tile.tsx
'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { Burst } from './burst'
import styles from './quiz.module.css'

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal' | 'dim'

/** Derive a tile's state from whether it is the right answer, whether the student picked it, and whether the question is graded. */
export function tileState(isCorrect: boolean, picked: boolean, graded: boolean): TileState {
  if (!graded) return picked ? 'selected' : 'idle'
  if (isCorrect && picked) return 'correct'
  if (isCorrect) return 'reveal'
  if (picked) return 'wrong'
  return 'dim'
}

/**
 * Large tappable answer tile. `letter` is the A/B/C badge; `hint` is the
 * keyboard key shown on hover; `size="big"` centers a large label (true/false).
 * Correct tiles pulse once and release a small burst; wrong tiles shake.
 */
export function OptionTile({
  letter,
  hint,
  size = 'default',
  state,
  disabled,
  onClick,
  children,
}: {
  letter?: string
  hint?: string
  size?: 'default' | 'big'
  state: TileState
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const isWrong = state === 'wrong'
  const badge =
    state === 'correct' || state === 'reveal' ? <Check className="h-4 w-4" /> : state === 'wrong' ? <X className="h-4 w-4" /> : letter
  const mark =
    state === 'correct'
      ? t('dashboard.classViewer.quiz.tile.correct')
      : state === 'reveal'
        ? t('dashboard.classViewer.quiz.tile.answer')
        : state === 'wrong'
          ? t('dashboard.classViewer.quiz.tile.yourPick')
          : null

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={state === 'selected' || state === 'correct' || state === 'wrong'}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: isWrong ? 0.42 : 0.2 }}
      className={cn(
        'group relative grid w-full items-center gap-3.5 rounded-[14px] border-[1.5px] bg-raised p-3.5 text-left transition-all disabled:cursor-default',
        size === 'big' ? 'grid-cols-1 justify-items-center gap-2 py-5' : 'grid-cols-[36px_1fr_auto]',
        state === 'idle' && 'border-border hover:-translate-y-px hover:border-foreground/20',
        state === 'selected' && 'border-primary bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
        state === 'correct' && cn('border-success bg-success/10', styles.okPulse),
        state === 'wrong' && 'border-terracotta bg-terracotta/10',
        state === 'reveal' && 'border-dashed border-success',
        state === 'dim' && 'border-border opacity-55',
      )}
    >
      {state === 'correct' && <Burst />}
      {(letter || badge) && (
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-[1.5px] font-heading text-sm font-extrabold transition-colors',
            state === 'idle' && 'border-foreground/25 text-muted-foreground',
            state === 'selected' && 'border-primary bg-primary text-primary-foreground',
            state === 'correct' && 'border-success bg-success text-white',
            state === 'wrong' && 'border-terracotta bg-terracotta text-white',
            state === 'reveal' && 'border-success text-success',
            state === 'dim' && 'border-foreground/15 text-muted-foreground',
          )}
        >
          {badge}
        </span>
      )}
      <span className={cn('min-w-0 font-medium leading-snug', size === 'big' ? 'font-heading text-[22px] font-extrabold tracking-[-0.01em]' : 'text-[15px]')}>
        {children}
      </span>
      {mark ? (
        <span
          className={cn(
            'text-[11.5px] font-bold uppercase tracking-[0.04em]',
            state === 'wrong' ? 'text-terracotta' : 'text-success',
          )}
        >
          {mark}
        </span>
      ) : hint && !disabled ? (
        <kbd
          className={cn(
            'grid h-5 min-w-5 place-items-center rounded-[5px] border border-b-2 border-foreground/20 bg-raised px-1.5 text-[10.5px] font-semibold text-muted-foreground transition-opacity',
            size === 'big' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {hint}
        </kbd>
      ) : (
        <span />
      )}
    </motion.button>
  )
}
```

- [ ] **Step 5: Button variant**

In `components/ui/button.tsx`, inside `variant: {` add after `destructive`:

```ts
        terracotta: "bg-terracotta text-white hover:bg-terracotta/90",
```

- [ ] **Step 6: Typecheck and lint** — `npx tsc --noEmit && npm run lint`. `question-input.tsx` still passes `label=` and `state="incorrect"` to `OptionTile`, so tsc will report errors there; fix them in Task 9. For this task's commit, temporarily keep compiling by changing in `question-input.tsx` every `label={LETTERS[i]}` → `letter={LETTERS[i]}` and every `'incorrect'` → `'wrong'` (four places). This is throwaway; Task 9 replaces the file.

- [ ] **Step 7: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/burst.tsx components/class-viewer/lesson-viewer/quiz/streak-chip.tsx components/class-viewer/lesson-viewer/quiz/type-chip.tsx components/class-viewer/lesson-viewer/quiz/input-props.ts components/class-viewer/lesson-viewer/quiz/option-tile.tsx components/class-viewer/lesson-viewer/quiz/question-input.tsx components/ui/button.tsx locales/en.json locales/es.json
git commit -m "quiz: tile states with reveal and burst, streak and type chips, terracotta button"
```

### Task 8: Feedback banner and progress segments

**Files:**
- Rewrite: `.../quiz/feedback-banner.tsx`, `.../quiz/progress-segments.tsx`
- Modify: `locales/*.json` (`feedback.partly`, `feedback.acceptedAnswers`, `feedback.correctAnswer`)
- Modify: `components/class-viewer/lesson-viewer/quiz-runner.tsx:154` (new `ProgressSegments` props) — temporary until Task 13 replaces the file.

**Interfaces:**
- Consumes: `outcomeOf` (Task 5), `Burst` (Task 7).
- Produces: `FeedbackBanner({ score, explanation?, correctAnswer? })`; `ProgressSegments({ questions, graded, current })`.

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"feedback":{"partly":"Partly right · {pct}%","correctAnswer":"Correct answer:","acceptedAnswers":"Accepted answers:"}}'
merge_quiz_keys locales/es.json '{"feedback":{"partly":"Casi · {pct}%","correctAnswer":"Respuesta correcta:","acceptedAnswers":"Respuestas aceptadas:"}}'
```

- [ ] **Step 2: Feedback banner**

```tsx
// components/class-viewer/lesson-viewer/quiz/feedback-banner.tsx
'use client'

import { motion } from 'framer-motion'
import { Check, Minus, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { outcomeOf } from '@/lib/quiz/engine'
import { Burst } from './burst'

/** Graded feedback for a score in [0, 1]. Announced to screen readers via role="status". */
export function FeedbackBanner({
  score,
  explanation,
  correctAnswer,
}: {
  score: number
  explanation?: string | null
  /** Shown on a miss so the student sees the right answer without hunting for it. */
  correctAnswer?: string | null
}) {
  const { t } = useTranslation()
  const tone = outcomeOf(score)
  const title =
    tone === 'ok'
      ? t('dashboard.classViewer.quiz.feedback.correct')
      : tone === 'part'
        ? t('dashboard.classViewer.quiz.feedback.partly', { pct: Math.round(score * 100) })
        : t('dashboard.classViewer.quiz.feedback.incorrect')
  const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'grid grid-cols-[auto_1fr] items-start gap-3 rounded-[14px] border p-4',
        tone === 'ok' && 'border-success/40 bg-success/10',
        tone === 'part' && 'border-primary/40 bg-primary/10',
        tone === 'bad' && 'border-terracotta/40 bg-terracotta/10',
      )}
    >
      <span
        className={cn(
          'relative grid h-7 w-7 place-items-center rounded-[9px] text-white',
          tone === 'ok' && 'bg-success',
          tone === 'part' && 'bg-primary',
          tone === 'bad' && 'bg-terracotta',
        )}
      >
        {tone === 'ok' && <Burst count={10} spread={40} />}
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[13.5px] font-extrabold">{title}</p>
        {tone === 'bad' && correctAnswer && (
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {t('dashboard.classViewer.quiz.feedback.correctAnswer')} <span className="font-semibold text-foreground">{correctAnswer}</span>
          </p>
        )}
        {explanation && <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">{explanation}</p>}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 3: Progress segments**

```tsx
// components/class-viewer/lesson-viewer/quiz/progress-segments.tsx
'use client'

import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/types/modules'

/** One segment per question. Filled segments keep their outcome color so the bar doubles as a scorecard. */
export function ProgressSegments({
  questions,
  graded,
  current,
}: {
  questions: QuizQuestion[]
  graded: Record<string, number>
  current: number
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {questions.map((q, i) => {
          const score = graded[q.id]
          const fill =
            score == null ? (i === current ? 'bg-primary/40' : '') : score >= 1 ? 'bg-success' : score > 0 ? 'bg-primary' : 'bg-terracotta'
          return (
            <div key={q.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]', fill)}
                style={{ transform: fill ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </div>
          )
        })}
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {Math.min(current + 1, questions.length)} / {questions.length}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Keep the current runner compiling**

In `quiz-runner.tsx` line 154 change to `<ProgressSegments questions={ordered} graded={graded} current={index} />` (Task 13 replaces the file).

- [ ] **Step 5: Typecheck and lint** — `npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/feedback-banner.tsx components/class-viewer/lesson-viewer/quiz/progress-segments.tsx components/class-viewer/lesson-viewer/quiz-runner.tsx locales/en.json locales/es.json
git commit -m "quiz: tokenized feedback banner with correct answer, outcome-colored progress"
```

### Task 9: Split question inputs; redesign choice tiles, true/false, audio prompt, short answer

**Files:**
- Create: `.../quiz/choice-tiles.tsx`, `.../quiz/audio-prompt.tsx`, `.../quiz/short-answer-input.tsx`
- Create (verbatim moves, redesigned in Tasks 10–12): `.../quiz/fill-blank-input.tsx`, `.../quiz/matching-input.tsx`, `.../quiz/ordering-input.tsx`
- Rewrite: `.../quiz/question-input.tsx` as a switch
- Modify: `locales/*.json` (`audio.playing`)

**Interfaces:**
- Consumes: `QuestionInputProps` (Task 7), `OptionTile`, `tileState` (Task 7), `readComposition`/`readPieces` (Task 1), `norm`, `Choice`, `AudioChoice` from grading.
- Produces: `ChoiceTiles(props: QuestionInputProps)` for `multiple_choice` and `audio_choice`; `TrueFalseTiles(props)`; `AudioPrompt({ src })`; `ShortAnswerInput(props)`; `FillBlankInput(props)`, `MatchingInput(props)`, `OrderingInput(props)`; `QuestionInput({ question, answer, isGraded, onChange })` unchanged signature.

- [ ] **Step 1: Locale key**

```bash
merge_quiz_keys locales/en.json '{"audio":{"playing":"Playing…"}}'
merge_quiz_keys locales/es.json '{"audio":{"playing":"Reproduciendo…"}}'
```

- [ ] **Step 2: Audio prompt**

```tsx
// components/class-viewer/lesson-viewer/quiz/audio-prompt.tsx
'use client'

import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import styles from './quiz.module.css'

const BARS = 16

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–:––'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Prompt clip player: round play button, level bars that move while playing, duration. */
export function AudioPrompt({ src }: { src: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number>(NaN)
  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (playing) el.pause()
    else void el.play()
  }
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[14px] border border-border bg-sunken px-3.5 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('dashboard.classViewer.quiz.pauseClip') : t('dashboard.classViewer.quiz.playClip')}
        className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />}
      </button>
      <div className="grid h-[26px] grid-cols-[repeat(16,1fr)] items-end gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => (
          <i
            key={i}
            className={cn('block rounded-[2px] bg-gold/75', playing && styles.levelBar)}
            style={{ height: `${[10, 16, 24, 14, 20, 26, 12, 18][i % 8]}px`, animationDelay: `${(i % 4) * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{playing ? t('dashboard.classViewer.quiz.audio.playing') : fmt(duration)}</span>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  )
}
```

- [ ] **Step 3: Choice tiles and true/false**

```tsx
// components/class-viewer/lesson-viewer/quiz/choice-tiles.tsx
'use client'

import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { norm, type AudioChoice, type Choice } from '@/lib/quiz/grading'
import { AudioPrompt } from './audio-prompt'
import type { QuestionInputProps } from './input-props'
import { OptionTile, tileState } from './option-tile'
import styles from './quiz.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** Play/pause control for an audio answer choice. A span, not a button, so it can live inside the tile button. */
function AudioChoicePlayer({ url, label }: { url?: string; label: string }) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause()
    else {
      el.currentTime = 0
      void el.play()
    }
  }
  return (
    <span className="flex items-center gap-3">
      <span
        role="button"
        tabIndex={0}
        aria-label={playing ? t('dashboard.classViewer.quiz.pauseClip') : t('dashboard.classViewer.quiz.playClip')}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e)
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary transition-colors hover:bg-primary/25"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1">{label}</span>
      {url && <audio ref={audioRef} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />}
    </span>
  )
}

/** multiple_choice and audio_choice. Audio choice shows the prompt player above and two columns when wide. */
export function ChoiceTiles({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const isAudio = q.question_type === 'audio_choice'
  const mode = isAudio ? ((opts.optionMode as 'text' | 'audio') ?? 'text') : 'text'
  const choices = ((opts.choices as (Choice | AudioChoice)[]) ?? []).slice(0, LETTERS.length)
  return (
    <div className="grid gap-3.5">
      {isAudio && q.audio_url && <AudioPrompt src={q.audio_url} />}
      <div role="radiogroup" className={cn('grid gap-2.5', isAudio && styles.tilesWide)}>
        {choices.map((c, i) => (
          <OptionTile
            key={c.id}
            letter={LETTERS[i]}
            hint={String(i + 1)}
            state={tileState(q.correct_answer === c.id, answer === c.id, isGraded)}
            disabled={isGraded}
            onClick={() => onChange(c.id)}
          >
            {mode === 'audio' ? (
              <AudioChoicePlayer url={(c as AudioChoice).audioUrl} label={c.text?.trim() || t('dashboard.classViewer.quiz.clip', { n: i + 1 })} />
            ) : (
              c.text
            )}
          </OptionTile>
        ))}
      </div>
    </div>
  )
}

/** true_false as two large cards. T and F keys are handled by the focus stage; the hints show them. */
export function TrueFalseTiles({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const values = [
    { v: 'true', label: t('dashboard.classViewer.quiz.true'), key: 'T' },
    { v: 'false', label: t('dashboard.classViewer.quiz.false'), key: 'F' },
  ]
  const picked = norm(String(answer ?? ''))
  const correct = norm(q.correct_answer ?? '')
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {values.map(({ v, label, key }) => (
        <OptionTile key={v} size="big" letter={key} hint={key} state={tileState(correct === v, picked === v, isGraded)} disabled={isGraded} onClick={() => onChange(v)}>
          {label}
        </OptionTile>
      ))}
    </div>
  )
}
```

Add to `quiz.module.css` under the focus-stage block:

```css
.tilesWide { display: grid; }
@container quiz (min-width: 760px) { .tilesWide { grid-template-columns: 1fr 1fr; } }
```

- [ ] **Step 4: Short answer**

```tsx
// components/class-viewer/lesson-viewer/quiz/short-answer-input.tsx
'use client'

import { Check, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { gradeQuestion } from '@/lib/quiz/grading'
import { AudioPrompt } from './audio-prompt'
import { Burst } from './burst'
import type { QuestionInputProps } from './input-props'

/** text_answer, and audio ("listen and type") which adds the prompt player. */
export function ShortAnswerInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const listen = q.question_type === 'audio'
  const ok = isGraded ? gradeQuestion(q, answer) : null
  return (
    <div className="grid gap-3">
      {listen && q.audio_url && <AudioPrompt src={q.audio_url} />}
      <label
        className={cn(
          'relative flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] bg-raised px-3.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
          ok === null && 'border-foreground/20',
          ok === true && 'border-success',
          ok === false && 'border-terracotta',
        )}
      >
        <input
          value={(answer as string) ?? ''}
          disabled={isGraded}
          onChange={(e) => onChange(e.target.value)}
          placeholder={listen ? t('dashboard.classViewer.quiz.typeWhatYouHear') : t('dashboard.classViewer.quiz.typeYourAnswer')}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {ok === true && <Burst count={10} spread={40} />}
        {ok !== null && (
          <span className={cn('grid h-6 w-6 place-items-center rounded-[7px] text-white', ok ? 'bg-success' : 'bg-terracotta')}>
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          </span>
        )}
        {!isGraded && <kbd className="grid h-5 min-w-5 place-items-center rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold text-muted-foreground">↵</kbd>}
      </label>
      {ok === false && q.correct_answer && (
        <p className="text-[12.5px] text-muted-foreground">
          {t('dashboard.classViewer.quiz.feedback.acceptedAnswers')} <span className="font-semibold text-success">{q.correct_answer}</span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Move fill-blank, matching and ordering out verbatim**

Create `fill-blank-input.tsx`, `matching-input.tsx`, `ordering-input.tsx`, each exporting a component with `QuestionInputProps` whose body is the corresponding `case` block from the current `question-input.tsx` (lines 188-248, 250-286, 288-344) with `q`, `answer`, `isGraded`, `onChange` taken from props and `opts` computed as `(q.options ?? {}) as Record<string, unknown>`. Keep the existing imports each needs (`Input`, `Select*`, `motion`, `cn`, `useTranslation`, grading types). These are pure moves; Tasks 10–12 redesign them.

- [ ] **Step 6: Rewrite question-input as a switch**

```tsx
// components/class-viewer/lesson-viewer/quiz/question-input.tsx
'use client'

import { useTranslation } from '@/components/language-provider'
import { readComposition, readPieces } from '@/lib/quiz/composition'
import type { PiecePlacement } from '@/lib/quiz/grading'
import { ChoiceTiles, TrueFalseTiles } from './choice-tiles'
import { FillBlankInput } from './fill-blank-input'
import type { QuestionInputProps } from './input-props'
import { MatchingInput } from './matching-input'
import { OrderingInput } from './ordering-input'
import { PiecePlacementInput } from './piece-placement-input'
import { ShortAnswerInput } from './short-answer-input'

export function QuestionInput(props: QuestionInputProps) {
  const { t } = useTranslation()
  const { question: q, answer, isGraded, onChange } = props
  switch (q.question_type) {
    case 'multiple_choice':
    case 'audio_choice':
      return <ChoiceTiles {...props} />
    case 'true_false':
      return <TrueFalseTiles {...props} />
    case 'text_answer':
    case 'audio':
      return <ShortAnswerInput {...props} />
    case 'fill_in_blank':
      return <FillBlankInput {...props} />
    case 'matching_pairs':
      return <MatchingInput {...props} />
    case 'ordering_sequence':
      return <OrderingInput {...props} />
    case 'piece_placement':
      return (
        <PiecePlacementInput
          background={readComposition(q.options, q.image_url)}
          pieces={readPieces(q.options)}
          placement={((answer as Record<string, PiecePlacement>) ?? {})}
          isGraded={isGraded}
          onChange={(v) => onChange(v)}
        />
      )
    default:
      return <p className="text-sm text-muted-foreground">{t('dashboard.classViewer.quiz.unsupportedType', { type: q.question_type })}</p>
  }
}
```

Note the prop rename: callers pass `question`, `answer`, `isGraded`, `onChange` exactly as before, so `quiz-runner.tsx` needs no change.

- [ ] **Step 7: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. In the browser: a multiple-choice question shows lettered tiles with the number hint on hover; wrong pick shakes and the right tile outlines dashed; audio choice shows the new player; true/false shows two big cards; short answer shows the accepted answer on a miss.

- [ ] **Step 8: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/ locales/en.json locales/es.json
git commit -m "quiz: per-type input files; new choice tiles, true/false cards, audio prompt, short answer"
```

### Task 10: Fill-in-the-blank redesign

**Files:**
- Rewrite: `.../quiz/fill-blank-input.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/class-viewer/lesson-viewer/quiz/fill-blank-input.tsx
'use client'

import { Fragment } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { norm, type Blank } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

const inputClass =
  'h-[34px] rounded-[9px] border-[1.5px] border-b-2 bg-raised px-2.5 text-center text-[15px] font-semibold outline-none transition-[border-color,box-shadow] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)] disabled:opacity-100'

/** Blanks sit inside the sentence, sized to the answer. A wrong word is struck through with the right one underneath. */
export function FillBlankInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const blanks = (opts.blanks as Blank[]) ?? []
  const text = (opts.text as string) ?? ''
  const given = (answer as Record<string, string>) ?? {}
  const blankById = new Map(blanks.map((b) => [b.id, b]))

  const renderBlank = (b: Blank, key: React.Key) => {
    const val = given[b.id] ?? ''
    const ok = isGraded ? norm(val) === norm(b.answer) : null
    return (
      <span key={key} className="relative mx-1 inline-flex align-baseline">
        <input
          value={val}
          disabled={isGraded}
          aria-label={b.id}
          onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
          style={{ width: `${Math.max(b.answer.length + 3, 7)}ch` }}
          className={cn(
            inputClass,
            ok === null && 'border-foreground/20 border-b-primary focus:border-primary',
            ok === true && 'border-success text-success',
            ok === false && 'border-terracotta text-terracotta line-through',
          )}
        />
        {ok === false && (
          <span className="absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-[11.5px] font-bold leading-none text-success" style={{ marginTop: -4 }}>
            {b.answer}
          </span>
        )}
      </span>
    )
  }

  if (text && /\{\{(\w+)\}\}/.test(text)) {
    const parts = text.split(/(\{\{\w+\}\})/g)
    return (
      <p className="text-[17px] font-medium leading-[2.1]">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\w+)\}\}$/)
          if (!m) return <Fragment key={i}>{part}</Fragment>
          const b = blankById.get(m[1])
          return b ? renderBlank(b, i) : <Fragment key={i}>{part}</Fragment>
        })}
      </p>
    )
  }

  // Fallback: labeled inputs when the text has no placeholders.
  return (
    <div className="grid gap-3">
      {blanks.map((b) => (
        <div key={b.id} className="flex items-center gap-3">
          <span className="min-w-[90px] rounded-lg bg-sunken px-2 py-1 font-mono text-xs">{b.id}</span>
          {renderBlank(b, b.id)}
          <span className="sr-only">{t('dashboard.classViewer.quiz.yourAnswer')}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`; a fill-in question shows pills in the sentence, wrong word struck with the answer below.

- [ ] **Step 3: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/fill-blank-input.tsx
git commit -m "quiz: inline fill-in-the-blank pills with correction underneath"
```

### Task 11: Matching pairs with connector lines

**Files:**
- Create: `hooks/use-container-width.ts`
- Rewrite: `.../quiz/matching-input.tsx`
- Modify: `locales/*.json` (`matching.pickFor`)

**Interfaces:**
- Produces: `useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number]`.
- Answer shape stays `{ [pairId]: rightText }` (what `gradeQuestion` compares).

- [ ] **Step 1: Locale key**

```bash
merge_quiz_keys locales/en.json '{"matching":{"pickFor":"Pick the match for {left}"}}'
merge_quiz_keys locales/es.json '{"matching":{"pickFor":"Elige la pareja de {left}"}}'
```

- [ ] **Step 2: Width hook**

```ts
// hooks/use-container-width.ts
'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** Width of the referenced element, kept current with a ResizeObserver. 0 until measured. */
export function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
```

- [ ] **Step 3: Matching input**

```tsx
// components/class-viewer/lesson-viewer/quiz/matching-input.tsx
'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useContainerWidth } from '@/hooks/use-container-width'
import { cn } from '@/lib/utils'
import { norm, shuffleStable, type Pair } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

const NARROW = 560
type Line = { id: string; x1: number; y1: number; x2: number; y2: number; ok: boolean }

const item =
  'relative flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border-[1.5px] bg-raised px-3.5 py-2.5 text-left text-sm font-medium transition-all disabled:cursor-default'
const port = 'absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 bg-card'

/**
 * Tap a left item, then its partner on the right; a curve connects them.
 * Below 560px the same answer is collected with tap-to-pick chips.
 * Answer shape: { [pairId]: rightText } — exactly what gradeQuestion compares.
 */
export function MatchingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const pairs = useMemo(() => (((q.options ?? {}) as Record<string, unknown>).pairs as Pair[]) ?? [], [q.options])
  const rights = useMemo(() => shuffleStable(pairs.map((p) => p.right), q.id), [pairs, q.id])
  const given = (answer as Record<string, string>) ?? {}
  const [active, setActive] = useState<string | null>(null)
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const [lines, setLines] = useState<Line[]>([])

  const ownerOf = (right: string) => pairs.find((p) => norm(given[p.id] ?? '') === norm(right))?.id
  const okFor = (p: Pair) => norm(given[p.id] ?? '') === norm(p.right)

  const assign = (leftId: string, right: string) => {
    const next: Record<string, string> = { ...given }
    for (const k of Object.keys(next)) if (norm(next[k]) === norm(right)) delete next[k]
    next[leftId] = right
    onChange(next)
    setActive(null)
  }
  const unassign = (leftId: string) => {
    const next = { ...given }
    delete next[leftId]
    onChange(next)
  }

  const measure = useCallback(() => {
    const root = ref.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const out: Line[] = []
    for (const p of pairs) {
      const right = given[p.id]
      if (!right) continue
      const a = root.querySelector<HTMLElement>(`[data-port="L-${p.id}"]`)
      const idx = rights.findIndex((x) => norm(x) === norm(right))
      const b = idx >= 0 ? root.querySelector<HTMLElement>(`[data-port="R-${idx}"]`) : null
      if (!a || !b) continue
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      out.push({ id: p.id, x1: ra.left + ra.width / 2 - r.left, y1: ra.top + ra.height / 2 - r.top, x2: rb.left + rb.width / 2 - r.left, y2: rb.top + rb.height / 2 - r.top, ok: okFor(p) })
    }
    setLines((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, rights, answer, ref])
  useLayoutEffect(() => {
    measure()
  }, [measure, width, isGraded])

  const narrow = width > 0 && width < NARROW
  if (narrow) {
    return (
      <div ref={ref} className="grid gap-3">
        {pairs.map((p) => (
          <div key={p.id} className="grid gap-2 rounded-xl border border-border bg-raised p-3">
            <b className="text-sm">{p.left}</b>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dashboard.classViewer.quiz.matching.pickFor', { left: p.left })}>
              {rights.map((r, i) => {
                const on = norm(given[p.id] ?? '') === norm(r)
                const st = !isGraded ? (on ? 'on' : 'off') : norm(r) === norm(p.right) ? 'ok' : on ? 'bad' : 'off'
                return (
                  <button
                    key={`${r}-${i}`}
                    type="button"
                    disabled={isGraded}
                    aria-pressed={on}
                    onClick={() => (on ? unassign(p.id) : assign(p.id, r))}
                    className={cn(
                      'rounded-full border px-2.5 py-1.5 text-[12.5px] transition-colors',
                      st === 'off' && 'border-foreground/20 text-muted-foreground',
                      st === 'on' && 'border-primary bg-primary/10 text-foreground',
                      st === 'ok' && 'border-success text-success',
                      st === 'bad' && 'border-terracotta text-terracotta',
                    )}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative grid grid-cols-[1fr_56px_1fr] items-stretch gap-y-2.5">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {lines.map((l) => (
          <path
            key={l.id}
            d={`M${l.x1} ${l.y1} C ${l.x1 + 40} ${l.y1}, ${l.x2 - 40} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke={isGraded ? (l.ok ? 'hsl(var(--success))' : 'hsl(var(--terracotta))') : 'hsl(var(--primary))'}
          />
        ))}
      </svg>
      <div className="grid content-start gap-2.5">
        {pairs.map((p, i) => {
          const linked = !!given[p.id]
          const st = isGraded ? (okFor(p) ? 'ok' : 'bad') : active === p.id ? 'active' : linked ? 'linked' : 'idle'
          return (
            <button
              key={p.id}
              type="button"
              disabled={isGraded}
              aria-pressed={active === p.id}
              onClick={() => setActive(active === p.id ? null : p.id)}
              className={cn(
                item,
                st === 'idle' && 'border-border hover:border-foreground/20',
                st === 'active' && 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
                st === 'linked' && 'border-primary/60',
                st === 'ok' && 'border-success bg-success/8',
                st === 'bad' && 'border-terracotta bg-terracotta/8',
              )}
            >
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-foreground/7 font-heading text-[11px] font-extrabold text-muted-foreground">{i + 1}</span>
              {p.left}
              <span data-port={`L-${p.id}`} className={cn(port, '-right-1.5', st === 'idle' ? 'border-foreground/25' : st === 'ok' ? 'border-success bg-success' : st === 'bad' ? 'border-terracotta bg-terracotta' : 'border-primary bg-primary')} />
            </button>
          )
        })}
      </div>
      <div />
      <div className="grid content-start gap-2.5">
        {rights.map((r, i) => {
          const owner = ownerOf(r)
          const ownerOk = owner ? okFor(pairs.find((p) => p.id === owner)!) : false
          const st = isGraded ? (owner ? (ownerOk ? 'ok' : 'bad') : 'idle') : owner ? 'linked' : 'idle'
          return (
            <button
              key={`${r}-${i}`}
              type="button"
              disabled={isGraded || (!active && !owner)}
              aria-label={active ? t('dashboard.classViewer.quiz.matching.pickFor', { left: pairs.find((p) => p.id === active)?.left ?? '' }) + `: ${r}` : r}
              onClick={() => {
                if (active) assign(active, r)
                else if (owner) unassign(owner)
              }}
              className={cn(
                item,
                st === 'idle' && 'border-border enabled:hover:border-foreground/20',
                st === 'linked' && 'border-primary/60',
                st === 'ok' && 'border-success bg-success/8',
                st === 'bad' && 'border-terracotta bg-terracotta/8',
              )}
            >
              <span data-port={`R-${i}`} className={cn(port, '-left-1.5', st === 'idle' ? 'border-foreground/25' : st === 'ok' ? 'border-success bg-success' : st === 'bad' ? 'border-terracotta bg-terracotta' : 'border-primary bg-primary')} />
              {r}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`; tap left then right draws a line; reassigning moves the line; grading colors the lines; narrowing the quiz column below 560px swaps to chips and back.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-container-width.ts components/class-viewer/lesson-viewer/quiz/matching-input.tsx locales/en.json locales/es.json
git commit -m "quiz: matching pairs with connector lines and a chips fallback"
```

### Task 12: Ordering with dnd-kit sortable

**Files:**
- Rewrite: `.../quiz/ordering-input.tsx`
- Modify: `locales/*.json` (`ordering.shouldBe`, `ordering.dragHandle`)

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"ordering":{"shouldBe":"should be #{n}","dragHandle":"Drag to reorder"}}'
merge_quiz_keys locales/es.json '{"ordering":{"shouldBe":"debería ser #{n}","dragHandle":"Arrastra para reordenar"}}'
```

- [ ] **Step 2: Implement**

```tsx
// components/class-viewer/lesson-viewer/quiz/ordering-input.tsx
'use client'

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { OrderItem } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

function Row({
  id,
  index,
  item,
  total,
  isGraded,
  onMove,
}: {
  id: string
  index: number
  item: OrderItem | undefined
  total: number
  isGraded: boolean
  onMove: (from: number, to: number) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: isGraded })
  const ok = isGraded && item?.correctPosition === index
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[auto_30px_1fr_auto] items-center gap-3 rounded-xl border-[1.5px] bg-raised py-2.5 pl-2 pr-3 transition-[border-color,box-shadow]',
        isDragging && 'z-10 border-primary shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)]',
        !isDragging && !isGraded && 'border-border',
        isGraded && (ok ? 'border-success' : 'border-terracotta'),
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isGraded}
        aria-label={t('dashboard.classViewer.quiz.ordering.dragHandle')}
        className="grid h-9 w-7 place-items-center rounded-lg text-muted-foreground disabled:opacity-40 enabled:cursor-grab enabled:active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className={cn(
          'grid h-[30px] w-[30px] place-items-center rounded-[9px] font-heading text-[13px] font-extrabold tabular-nums',
          !isGraded && 'bg-foreground/7 text-muted-foreground',
          isGraded && (ok ? 'bg-success text-white' : 'bg-terracotta text-white'),
        )}
      >
        {index + 1}
      </span>
      <span className="text-[14.5px] font-medium">{item?.text}</span>
      {isGraded ? (
        ok ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
            {t('dashboard.classViewer.quiz.ordering.shouldBe', { n: (item?.correctPosition ?? 0) + 1 })}
          </span>
        )
      ) : (
        <span className="inline-flex gap-0.5">
          <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t('dashboard.classViewer.quiz.moveUp')} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={t('dashboard.classViewer.quiz.moveDown')} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
        </span>
      )}
    </div>
  )
}

/** Drag the handle (or use the buttons / keyboard) to reorder. Answer shape stays string[] of item ids. */
export function OrderingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const items = (((q.options ?? {}) as Record<string, unknown>).items as OrderItem[]) ?? []
  const current = (answer as string[]) ?? items.map((it) => it.id)
  const byId = new Map(items.map((it) => [it.id, it]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const move = (from: number, to: number) => {
    if (to < 0 || to >= current.length || from === to) return
    onChange(arrayMove(current, from, to))
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(current.indexOf(String(active.id)), current.indexOf(String(over.id)))
  }
  return (
    <DndContext id={`order-${q.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={current} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {current.map((id, i) => (
            <Row key={id} id={id} index={i} item={byId.get(id)} total={current.length} isGraded={isGraded} onMove={move} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
```

- [ ] **Step 3: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`; drag rows with the grip, reorder with the buttons, and with the keyboard (focus the handle, Space, arrows, Space). Graded rows show "should be #n".

- [ ] **Step 4: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/ordering-input.tsx locales/en.json locales/es.json
git commit -m "quiz: drag-to-reorder ordering with dnd-kit and keyboard support"
```

### Task 13: Focus stage, question map, and the runner shell

**Files:**
- Create: `.../quiz/question-map.tsx`, `.../quiz/focus-stage.tsx`
- Rewrite: `components/class-viewer/lesson-viewer/quiz-runner.tsx`
- Modify: `locales/*.json` (`continue`, `seeResults`, `questionOf`, `map.*`, `sound.*`, `hints.*`)

**Interfaces:**
- Consumes: `useQuizEngine` (Task 6), `useQuizPrefs` (Task 6), `playCue`, `cueFor`, `outcomeOf`, `percentScore` (Tasks 5–6), `StreakChip`, `TypeChip`, `OptionTile` (Task 7), `FeedbackBanner`, `ProgressSegments` (Task 8), `QuestionInput` (Task 9), `correctAnswerLabel` (grading), existing `ResultsScreen({ kind, questions, graded, onRestart })` (replaced in Task 15).
- Produces: `QuestionMap({ questions, graded, current, onJump })`; `FocusStage({ questions, engine, kindLabel, title?, onFinish })`; `QuizRunner({ classItemId, questions, kind?, settings?, nextHref?, title? })`.

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"continue":"Continue","seeResults":"See results","questionOf":"Question {n} of {total}","map":{"title":"Questions","checked":"Checked"},"sound":{"on":"Sound on","off":"Sound off"},"hints":{"select":"select","check":"check","continue":"continue"}}'
merge_quiz_keys locales/es.json '{"continue":"Continuar","seeResults":"Ver resultados","questionOf":"Pregunta {n} de {total}","map":{"title":"Preguntas","checked":"Revisadas"},"sound":{"on":"Sonido activado","off":"Sonido desactivado"},"hints":{"select":"elegir","check":"comprobar","continue":"continuar"}}'
```

- [ ] **Step 2: Question map**

```tsx
// components/class-viewer/lesson-viewer/quiz/question-map.tsx
'use client'

import { Check, Minus, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { outcomeOf } from '@/lib/quiz/engine'
import type { QuizQuestion } from '@/types/modules'
import { typeIcon } from './type-chip'

/** Sticky rail listing every question with its outcome; click to jump. Hidden below 1000px by the CSS module. */
export function QuestionMap({
  questions,
  graded,
  current,
  onJump,
}: {
  questions: QuizQuestion[]
  graded: Record<string, number>
  current: number
  onJump: (index: number) => void
}) {
  const { t } = useTranslation()
  const checked = questions.filter((q) => q.id in graded).length
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.map.title')}</span>
      <ol className="mt-2.5 grid gap-1">
        {questions.map((q, i) => {
          const score = graded[q.id]
          const tone = score == null ? null : outcomeOf(score)
          const Icon = typeIcon(q.question_type)
          return (
            <li key={q.id}>
              <button
                type="button"
                aria-current={i === current}
                onClick={() => onJump(i)}
                className={cn(
                  'grid w-full grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-[10px] px-2 py-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
                  i === current && 'bg-primary/10 text-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-[7px] border-[1.5px] font-heading text-[11px] font-extrabold',
                    tone === null && (i === current ? 'border-primary text-primary' : 'border-foreground/25 text-muted-foreground'),
                    tone === 'ok' && 'border-success bg-success text-white',
                    tone === 'part' && 'border-primary bg-primary text-white',
                    tone === 'bad' && 'border-terracotta bg-terracotta text-white',
                  )}
                >
                  {tone === null ? i + 1 : tone === 'ok' ? <Check className="h-3 w-3" /> : tone === 'part' ? <Minus className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className="truncate">{q.question}</span>
                <Icon className="h-[13px] w-[13px] opacity-80" />
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mt-3.5 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('dashboard.classViewer.quiz.map.checked')}</span>
        <b className="tabular-nums text-foreground">{checked} / {questions.length}</b>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Focus stage**

```tsx
// components/class-viewer/lesson-viewer/quiz/focus-stage.tsx
'use client'

import { ArrowLeft, ArrowRight, Check, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import type { QuizEngine } from '@/hooks/use-quiz-engine'
import { cn } from '@/lib/utils'
import { cueFor, outcomeOf } from '@/lib/quiz/engine'
import { correctAnswerLabel, hasAnswer } from '@/lib/quiz/grading'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './feedback-banner'
import { ProgressSegments } from './progress-segments'
import { QuestionInput } from './question-input'
import { QuestionMap } from './question-map'
import { StreakChip } from './streak-chip'
import { TypeChip } from './type-chip'
import styles from './quiz.module.css'

const KEY_CHOICE = /^[1-9]$/
const KEY_LETTER = /^[a-h]$/i

/** One question at a time: rise transition, immediate feedback, Check → Continue, streak, sound, question map on wide screens. */
export function FocusStage({
  questions,
  engine,
  kindLabel,
  title,
  onFinish,
}: {
  questions: QuizQuestion[]
  engine: QuizEngine
  kindLabel: string
  title?: string
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useQuizPrefs()
  const [index, setIndex] = useState(0)
  const [pop, setPop] = useState(false)
  const { state } = engine
  const q = questions[index]
  const isGraded = q.id in state.graded
  const score = state.graded[q.id]
  const answer = state.answers[q.id]
  const canCheck = hasAnswer(q, answer)
  const isLast = index === questions.length - 1

  const check = useCallback(() => {
    if (isGraded || !canCheck) return
    const s = engine.check(q.id)
    const streak = s >= 1 ? state.streak + 1 : 0
    playCue(cueFor(s, streak), prefs.sound)
    if (s >= 1) {
      setPop(true)
      window.setTimeout(() => setPop(false), 520)
    }
  }, [engine, q.id, isGraded, canCheck, state.streak, prefs.sound])

  const next = useCallback(() => {
    if (isLast) onFinish()
    else setIndex((i) => i + 1)
  }, [isLast, onFinish])

  // Keyboard: 1-9 / a-h pick a choice, T / F for true-false, Enter checks then continues, arrows move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isGraded) next()
        else check()
        return
      }
      if (inField) return
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
      else if (e.key === 'ArrowRight' && isGraded) next()
      else if (!isGraded && (q.question_type === 'multiple_choice' || q.question_type === 'audio_choice')) {
        const choices = ((q.options ?? {}) as { choices?: { id: string }[] }).choices ?? []
        const idx = KEY_CHOICE.test(e.key) ? Number(e.key) - 1 : KEY_LETTER.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1
        if (idx >= 0 && idx < choices.length) engine.setAnswer(q.id, choices[idx].id)
      } else if (!isGraded && q.question_type === 'true_false') {
        if (e.key.toLowerCase() === 't') engine.setAnswer(q.id, 'true')
        if (e.key.toLowerCase() === 'f') engine.setAnswer(q.id, 'false')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, isGraded, index, check, next, engine])

  const continueVariant = !isGraded ? 'default' : outcomeOf(score) === 'ok' ? 'success' : outcomeOf(score) === 'part' ? 'default' : 'terracotta'

  return (
    <div className={styles.focus}>
      <div className={styles.stageCol}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{kindLabel}</span>
            {title && <h3 className="font-heading text-[15px] font-bold">{title}</h3>}
          </div>
          <div className="flex items-center gap-2.5">
            <StreakChip count={state.streak} pop={pop} />
            <button
              type="button"
              aria-pressed={prefs.sound}
              aria-label={t(prefs.sound ? 'dashboard.classViewer.quiz.sound.on' : 'dashboard.classViewer.quiz.sound.off')}
              onClick={() => setPrefs({ sound: !prefs.sound })}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-raised text-muted-foreground transition-colors hover:text-foreground"
            >
              {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          <div className="basis-full sm:basis-[260px]">
            <ProgressSegments questions={questions} graded={state.graded} current={index} />
          </div>
        </div>

        <div className={cn('relative overflow-hidden rounded-[20px] border border-border bg-card', styles.panel)}>
          <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-36 h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--gold-highlight)/0.12),transparent_70%)]" />
          <div key={q.id} className={cn('relative grid gap-5', styles.rise)}>
            <div className="grid gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-heading text-xs font-bold tabular-nums text-muted-foreground">{t('dashboard.classViewer.quiz.questionOf', { n: index + 1, total: questions.length })}</span>
                <TypeChip type={q.question_type} />
              </div>
              <h3 className={cn('font-heading font-extrabold leading-[1.25] tracking-[-0.015em]', styles.question)}>{q.question}</h3>
            </div>
            <QuestionInput question={q} answer={answer} isGraded={isGraded} onChange={(v) => engine.setAnswer(q.id, v)} />
            {isGraded && <FeedbackBanner score={score} explanation={q.explanation} correctAnswer={correctAnswerLabel(q) || null} />}
          </div>

          <div className="relative mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-xl">
              <ArrowLeft className="h-4 w-4" /> {t('dashboard.pages.modules.previous')}
            </Button>
            <span className={cn(styles.hint, 'items-center gap-1.5 text-xs text-muted-foreground')}>
              {(q.question_type === 'multiple_choice' || q.question_type === 'audio_choice') && !isGraded && (
                <>
                  <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">1</kbd>–
                  <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">{((q.options ?? {}) as { choices?: unknown[] }).choices?.length ?? 4}</kbd>
                  {t('dashboard.classViewer.quiz.hints.select')} ·
                </>
              )}
              <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">↵</kbd>
              {t(isGraded ? 'dashboard.classViewer.quiz.hints.continue' : 'dashboard.classViewer.quiz.hints.check')}
            </span>
            {!isGraded ? (
              <Button size="lg" disabled={!canCheck} onClick={check} className="rounded-xl px-7">
                <Check className="h-4 w-4" /> {t('dashboard.classViewer.quiz.checkAnswer')}
              </Button>
            ) : (
              <Button size="lg" variant={continueVariant} onClick={next} className="rounded-xl px-7">
                {isLast ? t('dashboard.classViewer.quiz.seeResults') : t('dashboard.classViewer.quiz.continue')} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className={styles.map}>
        <QuestionMap questions={questions} graded={state.graded} current={index} onJump={setIndex} />
      </aside>
    </div>
  )
}
```

`Button`'s `variant` prop type must include `'success'`. Add to `components/ui/button.tsx` next to `terracotta`:

```ts
        success: "bg-success text-white hover:bg-success/90",
```

- [ ] **Step 4: Runner shell**

```tsx
// components/class-viewer/lesson-viewer/quiz-runner.tsx
'use client'

import { MotionConfig } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { markClassItemComplete } from '@/app/actions/progress'
import { useQuizEngine } from '@/hooks/use-quiz-engine'
import type { QuizQuestion, QuizSettings } from '@/types/modules'
import { FocusStage } from './quiz/focus-stage'
import { ResultsScreen } from './quiz/results-screen'
import styles from './quiz/quiz.module.css'

interface QuizRunnerProps {
  classItemId: string
  questions: QuizQuestion[]
  /** Label shown in the header — "Quiz" or "Exercise". */
  kind?: 'Quiz' | 'Exercise'
  /** Per-quiz presentation settings (class_items.quiz_settings). Exercises always use focus mode. */
  settings?: QuizSettings
  /** Where "Continue to next part" goes; omitted when this is the last part. */
  nextHref?: string | null
  /** The class item title, shown above the stage. */
  title?: string
}

/** Shell: owns the engine and the finished flag, picks the layout mode, marks completion once. */
export function QuizRunner({ classItemId, questions, kind = 'Quiz', settings, nextHref = null, title }: QuizRunnerProps) {
  const { t } = useTranslation()
  const kindLabel = t(kind === 'Exercise' ? 'dashboard.pages.modules.exercise' : 'dashboard.pages.modules.quiz')
  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions])
  const engine = useQuizEngine(ordered)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (finished) void markClassItemComplete(classItemId).catch(() => {})
  }, [finished, classItemId])

  const restart = () => {
    engine.reset()
    setFinished(false)
  }

  if (ordered.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card py-10 text-center text-muted-foreground">
        {t('dashboard.classViewer.quiz.noQuestions', { kind: kindLabel.toLowerCase() })}
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root}>
        {finished ? (
          <ResultsScreen kind={kindLabel} questions={ordered} graded={engine.state.graded} onRestart={restart} />
        ) : (
          <FocusStage questions={ordered} engine={engine} kindLabel={kindLabel} title={title} onFinish={() => setFinished(true)} />
        )}
      </div>
    </MotionConfig>
  )
}
```

`settings` and `nextHref` are accepted now and used in Tasks 15–16 (results and exam sheet). Keep the unused-variable lint quiet by referencing them: `void settings; void nextHref` is not acceptable style — instead pass them through already: `<ResultsScreen ... />` gains `nextHref` in Task 15 and the mode switch lands in Task 16; until then prefix with an eslint-disable comment on the destructuring line: `// eslint-disable-next-line @typescript-eslint/no-unused-vars` (removed in Task 16).

- [ ] **Step 5: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. Play a whole quiz: rise transition between questions, chime + burst + green Continue on correct, thud + shake + terracotta Continue on wrong, streak chip from two in a row (gold at four), sound toggle persists across reload, question map on a wide window, keyboard shortcuts work, results appear after the last question, completion is recorded (check the lesson footer marks the part done after reload).

- [ ] **Step 6: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz-runner.tsx components/class-viewer/lesson-viewer/quiz/focus-stage.tsx components/class-viewer/lesson-viewer/quiz/question-map.tsx components/ui/button.tsx locales/en.json locales/es.json
git commit -m "quiz: focus stage with question map, streak, sound and colored Continue; runner becomes a shell"
```

---

## Phase 4 — Results

### Task 14: Review labels helper

**Files:**
- Create: `lib/quiz/labels.ts`
- Test: `lib/quiz/__tests__/labels.test.ts`

**Interfaces:**
- Produces: `userAnswerLabel(q, answer): string`, `fullCorrectLabel(q): string`, `countCorrectPieces(q, answer): { correct: number; total: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/quiz/__tests__/labels.test.ts
import { describe, expect, it } from 'vitest'
import { countCorrectPieces, fullCorrectLabel, userAnswerLabel } from '../labels'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q', class_item_id: 'c', order_index: 0, question: 'Q', question_type: 'multiple_choice', options: null,
    correct_answer: null, explanation: null, question_es: null, explanation_es: null, options_es: null,
    audio_url: null, image_url: null, created_at: null, updated_at: null, ...partial,
  }
}

describe('userAnswerLabel', () => {
  it('names choices, echoes text, joins structured answers', () => {
    const mc = q({ options: { choices: [{ id: 'a', text: 'Four' }, { id: 'b', text: 'Five' }] }, correct_answer: 'b' })
    expect(userAnswerLabel(mc, 'a')).toBe('Four')
    expect(userAnswerLabel(mc, 'zzz')).toBe('')
    expect(userAnswerLabel(q({ question_type: 'text_answer' }), 'claves')).toBe('claves')
    const fill = q({ question_type: 'fill_in_blank', options: { text: '{{a}} and {{b}}', blanks: [{ id: 'a', answer: 'guajeo' }, { id: 'b', answer: 'clave' }] } })
    expect(userAnswerLabel(fill, { a: 'tumbao' })).toBe('tumbao, —')
    const match = q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'p1', left: 'Congas', right: 'Marcha' }, { id: 'p2', left: 'Bongó', right: 'Martillo' }] } })
    expect(userAnswerLabel(match, { p1: 'Martillo' })).toBe('Congas → Martillo · Bongó → —')
    const ord = q({ question_type: 'ordering_sequence', options: { items: [{ id: 'i1', text: 'Intro', correctPosition: 0 }, { id: 'i2', text: 'Coda', correctPosition: 1 }] } })
    expect(userAnswerLabel(ord, ['i2', 'i1'])).toBe('Coda → Intro')
  })
})

describe('fullCorrectLabel', () => {
  it('covers every type the review list shows', () => {
    expect(fullCorrectLabel(q({ options: { choices: [{ id: 'b', text: 'Five' }] }, correct_answer: 'b' }))).toBe('Five')
    expect(fullCorrectLabel(q({ question_type: 'true_false', correct_answer: 'true' }))).toBe('true')
    expect(fullCorrectLabel(q({ question_type: 'fill_in_blank', options: { text: '', blanks: [{ id: 'a', answer: 'guajeo' }, { id: 'b', answer: 'clave' }] } }))).toBe('guajeo, clave')
    expect(fullCorrectLabel(q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'p1', left: 'Congas', right: 'Marcha' }] } }))).toBe('Congas → Marcha')
    expect(fullCorrectLabel(q({ question_type: 'ordering_sequence', options: { items: [{ id: 'i2', text: 'Coda', correctPosition: 1 }, { id: 'i1', text: 'Intro', correctPosition: 0 }] } }))).toBe('Intro → Coda')
    expect(fullCorrectLabel(q({ question_type: 'piece_placement', options: { pieces: [] } }))).toBe('')
  })
})

describe('countCorrectPieces', () => {
  it('counts centers inside areas', () => {
    const pp = q({ question_type: 'piece_placement', options: { pieces: [
      { id: 'a', imageUrl: '', width: 10, area: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', imageUrl: '', width: 10, area: { x: 50, y: 50, width: 10, height: 10 } },
    ] } })
    expect(countCorrectPieces(pp, { a: { x: 5, y: 5 }, b: { x: 5, y: 5 } })).toEqual({ correct: 1, total: 2 })
    expect(countCorrectPieces(pp, undefined)).toEqual({ correct: 0, total: 2 })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/quiz/__tests__/labels.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/quiz/labels.ts
import { correctAnswerLabel, isPieceCorrect, type AudioChoice, type Blank, type Choice, type OrderItem, type Pair, type PiecePlacement, type PlacementPiece } from './grading'
import type { QuizQuestion } from '@/types/modules'

const DASH = '—'

/** What the student answered, as one line for the results review. Empty string when nothing usable. */
export function userAnswerLabel(q: QuizQuestion, answer: unknown): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
      return ((opts.choices as Choice[]) ?? []).find((c) => c.id === answer)?.text ?? ''
    case 'audio_choice': {
      const choices = (opts.choices as AudioChoice[]) ?? []
      const i = choices.findIndex((c) => c.id === answer)
      return i < 0 ? '' : choices[i].text?.trim() || `Clip ${i + 1}`
    }
    case 'true_false':
    case 'text_answer':
    case 'audio':
      return typeof answer === 'string' ? answer : ''
    case 'fill_in_blank': {
      const given = (answer as Record<string, string>) ?? {}
      return ((opts.blanks as Blank[]) ?? []).map((b) => given[b.id] || DASH).join(', ')
    }
    case 'matching_pairs': {
      const given = (answer as Record<string, string>) ?? {}
      return ((opts.pairs as Pair[]) ?? []).map((p) => `${p.left} → ${given[p.id] || DASH}`).join(' · ')
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      return ((answer as string[]) ?? []).map((id) => items.find((it) => it.id === id)?.text ?? '?').join(' → ')
    }
    default:
      return ''
  }
}

/** The full correct answer for the review list (grading's correctAnswerLabel only covers choice types). */
export function fullCorrectLabel(q: QuizQuestion): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
    case 'audio_choice':
      return correctAnswerLabel(q)
    case 'true_false':
    case 'text_answer':
    case 'audio':
      return q.correct_answer ?? ''
    case 'fill_in_blank':
      return ((opts.blanks as Blank[]) ?? []).map((b) => b.answer).join(', ')
    case 'matching_pairs':
      return ((opts.pairs as Pair[]) ?? []).map((p) => `${p.left} → ${p.right}`).join(' · ')
    case 'ordering_sequence':
      return [...(((opts.items as OrderItem[]) ?? []))].sort((a, b) => a.correctPosition - b.correctPosition).map((it) => it.text).join(' → ')
    default:
      return ''
  }
}

export function countCorrectPieces(q: QuizQuestion, answer: unknown): { correct: number; total: number } {
  const pieces = (((q.options ?? {}) as Record<string, unknown>).pieces as PlacementPiece[]) ?? []
  const placed = (answer as Record<string, PiecePlacement>) ?? {}
  return { correct: pieces.filter((p) => isPieceCorrect(p, placed[p.id])).length, total: pieces.length }
}
```

- [ ] **Step 4: Run tests** — PASS. **Step 5: Commit**

```bash
git add lib/quiz/labels.ts lib/quiz/__tests__/labels.test.ts
git commit -m "quiz: answer and correct-answer labels for the results review"
```

### Task 15: Responsive results screen and the next-part link

**Files:**
- Rewrite: `.../quiz/score-ring.tsx`, `.../quiz/confetti.tsx`, `.../quiz/results-screen.tsx`
- Modify: `components/class-viewer/lesson-viewer/quiz-runner.tsx` (pass `answers`, `nextHref`)
- Modify: `components/class-viewer/class-item-renderer.tsx` (`nextHref`, `title` props; pass to both `QuizRunner` mounts)
- Modify: `app/dashboard/course/[courseId]/class/[classId]/page.tsx:219` (one-line `nextHref` prop) — **another session's file; targeted single-line edit only**
- Modify: `locales/*.json`

**Interfaces:**
- Consumes: `useContainerWidth` (Task 11), `percentScore`, `outcomeOf` (Task 5), `playCue` + `useQuizPrefs` (Task 6), `userAnswerLabel`, `fullCorrectLabel`, `countCorrectPieces` (Task 14), `TypeChip` (Task 7).
- Produces: `ScoreRing({ pct, size?, stroke? })`; `Confetti({ count? })`; `ResultsScreen({ kind, questions, answers, graded, onRestart, nextHref? })`.

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"results":{"complete":"{kind} complete","continueNext":"Continue to next part","reviewMissed":"Review {count} missed","nothingMissed":"Nothing missed. Every answer was right.","piecesPlaced":"{correct} of {total} pieces in the right spot","stats":{"correct":"correct","partly":"partly right","missed":"missed"},"score":"score"},"review":{"title":"Review","titleAll":"Every question, with the answer","all":"All","missed":"Missed · {count}","youSaid":"You said","answer":"Answer"}}'
merge_quiz_keys locales/es.json '{"results":{"complete":"{kind} completado","continueNext":"Continuar a la siguiente parte","reviewMissed":"Revisar {count} falladas","nothingMissed":"Nada que revisar. Todas las respuestas fueron correctas.","piecesPlaced":"{correct} de {total} piezas en su lugar","stats":{"correct":"correctas","partly":"casi","missed":"falladas"},"score":"puntaje"},"review":{"title":"Revisión","titleAll":"Todas las preguntas, con su respuesta","all":"Todas","missed":"Falladas · {count}","youSaid":"Respondiste","answer":"Respuesta"}}'
```

- [ ] **Step 2: Score ring and confetti**

```tsx
// components/class-viewer/lesson-viewer/quiz/score-ring.tsx
'use client'

import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/language-provider'

/** SVG ring that counts up to `pct`. The number scales with the ring (26% of its size) so small rings never overflow. */
export function ScoreRing({ pct, size = 156, stroke = 13 }: { pct: number; size?: number; stroke?: number }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const [display, setDisplay] = useState(reduce ? pct : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(pct)
      return
    }
    const controls = animate(0, pct, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setDisplay(Math.round(v)) })
    return () => controls.stop()
  }, [pct, reduce])

  const offset = circumference - (display / 100) * circumference
  const tone = pct >= 80 ? 'hsl(var(--success))' : pct >= 50 ? 'hsl(var(--primary))' : 'hsl(var(--terracotta))'

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--foreground) / 0.09)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute grid justify-items-center leading-none">
        <span className="font-heading font-black tabular-nums tracking-[-0.03em]" style={{ fontSize: Math.round(size * 0.26) }}>
          {display}%
        </span>
        <span className="mt-1 font-semibold uppercase tracking-[0.1em] text-muted-foreground" style={{ fontSize: Math.max(8, Math.round(size * 0.07)) }}>
          {t('dashboard.classViewer.quiz.results.score')}
        </span>
      </div>
    </div>
  )
}
```

```tsx
// components/class-viewer/lesson-viewer/quiz/confetti.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['hsl(var(--gold-highlight))', 'hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--terracotta))', '#F5E6C8']

/** Deterministic framer-motion confetti (SSR-safe). Skipped under reduced motion. */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: ((i * 71) % 100) + (((i * 37) % 11) - 5) / 10,
        delay: ((i * 53) % 45) / 100,
        duration: 1.6 + ((i * 29) % 90) / 100,
        rotate: (i * 91) % 360,
        color: COLORS[i % COLORS.length],
        size: 6 + ((i * 17) % 8),
      })),
    [count],
  )
  if (reduce) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
          initial={{ y: '-12%', opacity: 0, rotate: 0 }}
          animate={{ y: '120%', opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Results screen**

```tsx
// components/class-viewer/lesson-viewer/quiz/results-screen.tsx
'use client'

import { ArrowRight, Check, ChevronDown, Minus, RotateCcw, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useContainerWidth } from '@/hooks/use-container-width'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import { cn } from '@/lib/utils'
import { outcomeOf, percentScore, totalScore } from '@/lib/quiz/engine'
import { countCorrectPieces, fullCorrectLabel, userAnswerLabel } from '@/lib/quiz/labels'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { Confetti } from './confetti'
import { ScoreRing } from './score-ring'
import { TypeChip } from './type-chip'
import styles from './quiz.module.css'

const REPORT_MIN_WIDTH = 960
type Filter = 'all' | 'missed'

function useTier(pct: number, kind: string) {
  const { t } = useTranslation()
  const headline =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.perfect')
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.greatWork')
        : pct >= 50
          ? t('dashboard.classViewer.quiz.results.niceEffort')
          : t('dashboard.classViewer.quiz.results.keepPracticing')
  const sub =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.nailedIt', { kind: kind.toLowerCase() })
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.gettingHang')
        : t('dashboard.classViewer.quiz.results.reviewAndRetry')
  return { headline, sub }
}

function Stats({ questions, graded }: { questions: QuizQuestion[]; graded: Record<string, number> }) {
  const { t } = useTranslation()
  const correct = questions.filter((q) => (graded[q.id] ?? 0) >= 1).length
  const missed = questions.filter((q) => (graded[q.id] ?? 0) === 0).length
  const partly = questions.length - correct - missed
  const cell = (n: number, label: string, tone: string) => (
    <div className="grid gap-0.5 rounded-xl border border-border bg-sunken p-3 text-center">
      <b className={cn('font-heading text-xl font-extrabold tabular-nums', tone)}>{n}</b>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </div>
  )
  return (
    <div className="grid w-full max-w-[520px] grid-cols-3 gap-2.5">
      {cell(correct, t('dashboard.classViewer.quiz.results.stats.correct'), 'text-success')}
      {cell(partly, t('dashboard.classViewer.quiz.results.stats.partly'), 'text-primary')}
      {cell(missed, t('dashboard.classViewer.quiz.results.stats.missed'), 'text-terracotta')}
    </div>
  )
}

function FilterChips({ filter, setFilter, missed }: { filter: Filter; setFilter: (f: Filter) => void; missed: number }) {
  const { t } = useTranslation()
  const chip = (f: Filter, label: string) => (
    <button
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      className={cn('rounded-full border px-2.5 py-1.5 text-xs transition-colors', filter === f ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center gap-2">
      {chip('all', t('dashboard.classViewer.quiz.review.all'))}
      {chip('missed', t('dashboard.classViewer.quiz.review.missed', { count: missed }))}
    </div>
  )
}

function ReviewList({
  questions,
  answers,
  graded,
  filter,
  openAll,
}: {
  questions: QuizQuestion[]
  answers: Record<string, unknown>
  graded: Record<string, number>
  filter: Filter
  openAll: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const list = questions.filter((q) => filter === 'all' || (graded[q.id] ?? 0) < 1)
  if (list.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.classViewer.quiz.results.nothingMissed')}</p>
  return (
    <div className="grid gap-2">
      {list.map((q) => {
        const score = graded[q.id] ?? 0
        const tone = outcomeOf(score)
        const i = questions.indexOf(q)
        const isOpen = openAll || open === q.id
        const said = q.question_type === 'piece_placement' ? t('dashboard.classViewer.quiz.results.piecesPlaced', countCorrectPieces(q, answers[q.id])) : userAnswerLabel(q, answers[q.id])
        const right = q.question_type === 'true_false' ? t(fullCorrectLabel(q) === 'true' ? 'dashboard.classViewer.quiz.true' : 'dashboard.classViewer.quiz.false') : fullCorrectLabel(q)
        const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
        return (
          <div key={q.id} className="overflow-hidden rounded-[14px] border border-border bg-card">
            <button
              type="button"
              onClick={() => !openAll && setOpen(isOpen ? null : q.id)}
              className={cn('grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left', !openAll && 'hover:bg-foreground/3')}
            >
              <span className={cn('grid h-[26px] w-[26px] place-items-center rounded-lg text-white', tone === 'ok' && 'bg-success', tone === 'part' && 'bg-primary', tone === 'bad' && 'bg-terracotta')}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium">
                {i + 1}. {q.question}
                <span className="mt-1 block"><TypeChip type={q.question_type} /></span>
              </span>
              {!openAll && <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />}
            </button>
            {isOpen && (
              <div className={cn('grid gap-1.5 px-4 pb-4 pl-[54px] text-[13.5px] leading-relaxed', styles.rise)}>
                {tone !== 'ok' && said && (
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <span className="pt-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t('dashboard.classViewer.quiz.review.youSaid')}</span>
                    <b className={cn('font-semibold', q.question_type !== 'piece_placement' && 'text-terracotta line-through')}>{said}</b>
                  </div>
                )}
                {right && (
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <span className="pt-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t('dashboard.classViewer.quiz.review.answer')}</span>
                    <b className="font-semibold text-success">{right}</b>
                  </div>
                )}
                {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
                {!right && !q.explanation && tone === 'ok' && <p className="text-muted-foreground">{t('dashboard.classViewer.quiz.results.noDetails')}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * End of quiz. Report card (two columns, every answer expanded) when the quiz
 * is at least 960px wide; hero ring with a collapsible review below that.
 */
export function ResultsScreen({
  kind,
  questions,
  answers,
  graded,
  onRestart,
  nextHref = null,
}: {
  kind: string
  questions: QuizQuestion[]
  answers: Record<string, unknown>
  graded: Record<string, number>
  onRestart: () => void
  nextHref?: string | null
}) {
  const { t } = useTranslation()
  const [prefs] = useQuizPrefs()
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const [filter, setFilter] = useState<Filter>('all')
  const total = totalScore(questions, graded)
  const pct = percentScore(questions, graded)
  const { headline, sub } = useTier(pct, kind)
  const missed = questions.filter((q) => (graded[q.id] ?? 0) < 1).length
  const wide = width >= REPORT_MIN_WIDTH
  const scoreLabel = Number.isInteger(total) ? String(total) : total.toFixed(1)

  useEffect(() => {
    playCue(pct >= 70 ? 'fanfare' : 'soft', prefs.sound)
    // play once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = (column: boolean) => (
    <div className={cn('flex flex-wrap justify-center gap-2.5', column && 'w-full flex-col')}>
      {nextHref && (
        <Button asChild size="lg" className={cn('rounded-xl', column && 'w-full')}>
          <Link href={nextHref}>
            {t('dashboard.classViewer.quiz.results.continueNext')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {!wide && missed > 0 && (
        <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setFilter('missed')}>
          {t('dashboard.classViewer.quiz.results.reviewMissed', { count: missed })}
        </Button>
      )}
      <Button variant="outline" size="lg" className={cn('rounded-xl', column && 'w-full')} onClick={onRestart}>
        <RotateCcw className="h-4 w-4" /> {t('dashboard.classViewer.quiz.results.tryAgain')}
      </Button>
    </div>
  )

  const summary = (ringSize: number) => (
    <>
      {pct >= 80 && <Confetti />}
      <span className="font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.results.complete', { kind })}</span>
      <ScoreRing pct={pct} size={ringSize} />
      <h2 className={cn('font-heading text-[28px] font-black tracking-[-0.02em]', styles.bounceIn)}>{headline}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
      <p className="text-sm font-semibold">
        <span className="text-primary">{scoreLabel}</span>
        <span className="text-muted-foreground"> / {questions.length} {t('dashboard.classViewer.quiz.results.correct')}</span>
      </p>
      <Stats questions={questions} graded={graded} />
    </>
  )

  return (
    <div ref={ref}>
      {wide ? (
        <div className="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-[18px]">
          <div className="sticky top-5 grid gap-3.5">
            <div className="relative grid justify-items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card p-6 text-center">
              {summary(132)}
              <div className="mt-3 w-full">{actions(true)}</div>
            </div>
          </div>
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="mr-auto font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.review.titleAll')}</span>
              <FilterChips filter={filter} setFilter={setFilter} missed={missed} />
            </div>
            <ReviewList questions={questions} answers={answers} graded={graded} filter={filter} openAll />
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="relative grid justify-items-center gap-2 overflow-hidden rounded-3xl border border-border bg-card p-6 text-center sm:p-9">
            {summary(156)}
            <div className="mt-3">{actions(false)}</div>
          </div>
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="mr-auto font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.review.title')}</span>
              <FilterChips filter={filter} setFilter={setFilter} missed={missed} />
            </div>
            <ReviewList questions={questions} answers={answers} graded={graded} filter={filter} openAll={false} />
          </div>
        </div>
      )}
    </div>
  )
}
```

If `Button` does not accept `asChild` (check `components/ui/button.tsx` for `Slot`), render the link as `<Link href={nextHref} className={cn(buttonVariants({ size: 'lg' }), 'rounded-xl')}>` importing `buttonVariants` from the same file.

- [ ] **Step 4: Plumb `answers` and `nextHref` through the runner**

In `quiz-runner.tsx` change the results mount to:

```tsx
<ResultsScreen kind={kindLabel} questions={ordered} answers={engine.state.answers} graded={engine.state.graded} onRestart={restart} nextHref={nextHref} />
```
and remove the temporary eslint-disable for `nextHref` (keep it for `settings` until Task 16).

- [ ] **Step 5: Renderer and page**

In `class-item-renderer.tsx`:
- Add to `ClassItemRendererProps`: `nextHref?: string | null` and inside `item`: `quiz_settings?: unknown`.
- Destructure: `export async function ClassItemRenderer({ item, playerLayout = 'stack', nextHref = null }: ClassItemRendererProps)`.
- Both `QuizRunner` mounts gain `title={item.title} nextHref={nextHref}`.

In `page.tsx` line 219, change the single JSX line to:

```tsx
          <ClassItemRenderer item={activeItem} userId={user.id} playerLayout="split" nextHref={activeIndex < items.length - 1 ? `/dashboard/course/${courseId}/class/${classId}?item=${activeIndex + 1}` : nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : null} />
```
(`nextClassId` is declared at line 178, before `body`. Confirm with `git diff app/dashboard/course/[courseId]/class/[classId]/page.tsx` that only this one line changed besides the other session's existing hunks; if the other session's edits moved this line, apply the same one-line change wherever `<ClassItemRenderer` is now.)

- [ ] **Step 6: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. Finish a quiz at a wide window: report card with expanded review, sticky left card, fanfare, confetti at ≥80; narrow the window: hero ring + collapsible review, "Review n missed" filters the list; Continue goes to the next part; Try again restarts; the ring number fits at both sizes.

- [ ] **Step 7: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/score-ring.tsx components/class-viewer/lesson-viewer/quiz/confetti.tsx components/class-viewer/lesson-viewer/quiz/results-screen.tsx components/class-viewer/lesson-viewer/quiz-runner.tsx components/class-viewer/class-item-renderer.tsx "app/dashboard/course/[courseId]/class/[classId]/page.tsx" locales/en.json locales/es.json
git commit -m "quiz: responsive results (report card / hero ring), review with answers, next-part link"
```
(Before `git add` of `page.tsx`, run `git diff "app/dashboard/course/[courseId]/class/[classId]/page.tsx"`. If it contains the other session's unrelated hunks, stage only yours with `git add -p` and pick the single `nextHref` hunk.)

---

## Phase 5 — Exam sheet mode and the per-quiz setting

### Task 16: Exam sheet

**Files:**
- Create: `.../quiz/exam-sheet.tsx`
- Modify: `components/class-viewer/lesson-viewer/quiz-runner.tsx` (mode switch)
- Modify: `locales/*.json` (`sheet.*`)

**Interfaces:**
- Consumes: `QuizEngine` (Task 6), `QuestionInput`, `FeedbackBanner`, `TypeChip`, `ScoreRing`, `outcomeOf`, `percentScore`, `hasAnswer`, `fullCorrectLabel`, `playCue`, `useQuizPrefs`.
- Produces: `ExamSheet({ questions, engine, kindLabel, title?, nextHref?, onSubmit, onRestart })`.

- [ ] **Step 1: Locale keys**

```bash
merge_quiz_keys locales/en.json '{"sheet":{"intro":"{count} questions. Answer in any order; nothing is graded until you submit.","scored":"Scored {pct}%. Every card now shows the right answer and why.","submitAll":"Submit all answers","answeredOf":"{answered} of {total} answered","unanswered":"{count} still unanswered. You can submit anyway.","answered":"Answered","unansweredLabel":"Unanswered","correct":"Correct","partly":"Partly right","missed":"Missed"}}'
merge_quiz_keys locales/es.json '{"sheet":{"intro":"{count} preguntas. Responde en cualquier orden; nada se califica hasta que envíes.","scored":"Puntaje {pct}%. Cada tarjeta muestra ahora la respuesta correcta y por qué.","submitAll":"Enviar todas las respuestas","answeredOf":"{answered} de {total} respondidas","unanswered":"{count} sin responder. Puedes enviar de todos modos.","answered":"Respondida","unansweredLabel":"Sin responder","correct":"Correcta","partly":"Casi","missed":"Fallada"}}'
```

- [ ] **Step 2: Implement**

```tsx
// components/class-viewer/lesson-viewer/quiz/exam-sheet.tsx
'use client'

import { ArrowRight, Check, Minus, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import type { QuizEngine } from '@/hooks/use-quiz-engine'
import { cn } from '@/lib/utils'
import { outcomeOf, percentScore } from '@/lib/quiz/engine'
import { hasAnswer } from '@/lib/quiz/grading'
import { fullCorrectLabel } from '@/lib/quiz/labels'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './feedback-banner'
import { QuestionInput } from './question-input'
import { ScoreRing } from './score-ring'
import { TypeChip } from './type-chip'
import styles from './quiz.module.css'

const SPANS = new Set(['matching_pairs', 'ordering_sequence', 'fill_in_blank', 'audio_choice', 'piece_placement'])
type Filter = 'all' | 'missed'

/** Every question on one sheet; graded on submit; cards turn into their reviewed state in place. */
export function ExamSheet({
  questions,
  engine,
  kindLabel,
  title,
  nextHref = null,
  onSubmit,
  onRestart,
}: {
  questions: QuizQuestion[]
  engine: QuizEngine
  kindLabel: string
  title?: string
  nextHref?: string | null
  onSubmit: () => void
  onRestart: () => void
}) {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useQuizPrefs()
  const [submitted, setSubmitted] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const { state } = engine
  const answered = questions.filter((q) => hasAnswer(q, state.answers[q.id])).length
  const pct = percentScore(questions, state.graded)
  const missed = questions.filter((q) => (state.graded[q.id] ?? 0) < 1).length

  const submit = () => {
    const mean = engine.checkMany(questions.map((q) => q.id))
    setSubmitted(true)
    playCue(mean >= 0.7 ? 'fanfare' : 'soft', prefs.sound)
    onSubmit()
  }
  const restart = () => {
    setSubmitted(false)
    setFilter('all')
    onRestart()
  }
  const jump = (id: string) => document.getElementById(`sq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const statusLabel = (q: QuizQuestion) => {
    if (!submitted) return t(hasAnswer(q, state.answers[q.id]) ? 'dashboard.classViewer.quiz.sheet.answered' : 'dashboard.classViewer.quiz.sheet.unansweredLabel')
    const tone = outcomeOf(state.graded[q.id] ?? 0)
    return t(tone === 'ok' ? 'dashboard.classViewer.quiz.sheet.correct' : tone === 'part' ? 'dashboard.classViewer.quiz.sheet.partly' : 'dashboard.classViewer.quiz.sheet.missed')
  }
  const shown = questions.filter((q) => filter === 'all' || (state.graded[q.id] ?? 0) < 1)

  const jumpGrid = (
    <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1.5">
      {questions.map((q, i) => {
        const g = state.graded[q.id]
        const tone = submitted ? outcomeOf(g ?? 0) : hasAnswer(q, state.answers[q.id]) ? 'done' : 'todo'
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => jump(q.id)}
            className={cn(
              'grid h-[34px] place-items-center rounded-[9px] border-[1.5px] font-heading text-xs font-extrabold transition-colors',
              tone === 'todo' && 'border-border text-muted-foreground',
              tone === 'done' && 'border-primary text-foreground',
              tone === 'ok' && 'border-success bg-success/12 text-success',
              tone === 'part' && 'border-primary bg-primary/12 text-primary',
              tone === 'bad' && 'border-terracotta bg-terracotta/12 text-terracotta',
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={styles.sheet}>
      <div>
        <div className="mb-4 grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{kindLabel}</span>
            <button
              type="button"
              aria-pressed={prefs.sound}
              aria-label={t(prefs.sound ? 'dashboard.classViewer.quiz.sound.on' : 'dashboard.classViewer.quiz.sound.off')}
              onClick={() => setPrefs({ sound: !prefs.sound })}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-raised text-muted-foreground transition-colors hover:text-foreground"
            >
              {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          {title && <h3 className="font-heading text-[22px] font-extrabold tracking-[-0.015em]">{title}</h3>}
          <p className="text-[13.5px] text-muted-foreground">
            {submitted ? t('dashboard.classViewer.quiz.sheet.scored', { pct }) : t('dashboard.classViewer.quiz.sheet.intro', { count: questions.length })}
          </p>
        </div>
        {submitted && (
          <div className="mb-3.5 flex gap-2">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={cn('rounded-full border px-2.5 py-1.5 text-xs', filter === 'all' ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground')}>{t('dashboard.classViewer.quiz.review.all')}</button>
            <button type="button" aria-pressed={filter === 'missed'} onClick={() => setFilter('missed')} className={cn('rounded-full border px-2.5 py-1.5 text-xs', filter === 'missed' ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground')}>{t('dashboard.classViewer.quiz.review.missed', { count: missed })}</button>
          </div>
        )}
        <div className={styles.sheetGrid}>
          {shown.map((q) => {
            const i = questions.indexOf(q)
            const g = state.graded[q.id]
            const tone = submitted ? outcomeOf(g ?? 0) : null
            const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
            return (
              <section
                key={q.id}
                id={`sq-${q.id}`}
                className={cn(
                  'grid gap-3.5 rounded-2xl border bg-card p-4.5 transition-colors',
                  SPANS.has(q.question_type) && styles.span,
                  tone === null && 'border-border',
                  tone === 'ok' && 'border-success/45',
                  tone === 'part' && 'border-primary/45',
                  tone === 'bad' && 'border-terracotta/45',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'grid h-[26px] w-[26px] place-items-center rounded-lg font-heading text-xs font-extrabold tabular-nums',
                      tone === null && 'bg-foreground/7 text-muted-foreground',
                      tone === 'ok' && 'bg-success text-white',
                      tone === 'part' && 'bg-primary text-white',
                      tone === 'bad' && 'bg-terracotta text-white',
                    )}
                  >
                    {tone === null ? i + 1 : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <TypeChip type={q.question_type} />
                  <span className={cn('ml-auto text-[11.5px] font-bold uppercase tracking-[0.04em]', tone === null && 'text-muted-foreground', tone === 'ok' && 'text-success', tone === 'part' && 'text-primary', tone === 'bad' && 'text-terracotta')}>
                    {statusLabel(q)}
                  </span>
                </div>
                <h4 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{q.question}</h4>
                <QuestionInput question={q} answer={state.answers[q.id]} isGraded={submitted} onChange={(v) => engine.setAnswer(q.id, v)} />
                {submitted && <FeedbackBanner score={g ?? 0} explanation={q.explanation} correctAnswer={fullCorrectLabel(q) || null} />}
              </section>
            )
          })}
        </div>
        {!submitted && (
          <div className={cn(styles.sheetBar, 'mt-3.5 items-center justify-between gap-3 rounded-[14px] border border-border bg-sunken px-3.5 py-3')}>
            <span className="text-[13px] tabular-nums text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.answeredOf', { answered, total: questions.length })}</span>
            <Button onClick={submit} className="rounded-xl">{t('dashboard.classViewer.quiz.sheet.submitAll')}</Button>
          </div>
        )}
      </div>

      <aside className={styles.sheetRail}>
        <div className="rounded-2xl border border-border bg-card p-4.5">
          {!submitted ? (
            <>
              <div className="flex items-center gap-3.5">
                <ScoreRing pct={(answered / Math.max(1, questions.length)) * 100} size={64} stroke={7} />
                <div>
                  <span className="block font-heading text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{answered} / {questions.length}</span>
                  <small className="text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.answered').toLowerCase()}</small>
                </div>
              </div>
              {jumpGrid}
              <Button onClick={submit} className="mt-3.5 w-full rounded-xl">{t('dashboard.classViewer.quiz.sheet.submitAll')}</Button>
              {answered < questions.length && <p className="mt-2 text-center text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.unanswered', { count: questions.length - answered })}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3.5">
                <ScoreRing pct={pct} size={72} stroke={8} />
                <div>
                  <span className="block font-heading text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{pct}%</span>
                  <small className="text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.results.score')}</small>
                </div>
              </div>
              {jumpGrid}
              <div className="mt-3.5 grid gap-2.5">
                {nextHref && (
                  <Button asChild className="w-full rounded-xl">
                    <Link href={nextHref}>{t('dashboard.classViewer.quiz.results.continueNext')} <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                )}
                <Button variant="outline" className="w-full rounded-xl" onClick={restart}>
                  <RotateCcw className="h-4 w-4" /> {t('dashboard.classViewer.quiz.results.tryAgain')}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
```

`p-4.5` is not a default Tailwind spacing; use `p-[18px]`.

- [ ] **Step 3: Mode switch in the runner**

In `quiz-runner.tsx`, import `ExamSheet` and replace the JSX inside `styles.root`:

```tsx
        {mode === 'sheet' ? (
          <ExamSheet questions={ordered} engine={engine} kindLabel={kindLabel} title={title} nextHref={nextHref} onSubmit={() => setFinished(true)} onRestart={restart} />
        ) : finished ? (
          <ResultsScreen kind={kindLabel} questions={ordered} answers={engine.state.answers} graded={engine.state.graded} onRestart={restart} nextHref={nextHref} />
        ) : (
          <FocusStage questions={ordered} engine={engine} kindLabel={kindLabel} title={title} onFinish={() => setFinished(true)} />
        )}
```
with, above the return: `const mode = kind === 'Quiz' && settings?.mode === 'sheet' ? 'sheet' : 'focus'`. Remove the eslint-disable comment from Task 13. In `restart`, keep `setFinished(false)` so a resubmitted sheet re-marks completion (the effect only fires on the false→true edge).

- [ ] **Step 4: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. Temporarily force `mode = 'sheet'` locally to test until Task 17 lands the setting: two columns at ≥1180px, span cards, jump grid, submit with unanswered allowed, cards flip to graded with banners, filter Missed, Continue/Try again in the rail, mobile bar below 1000px. Revert the forced mode before committing.

- [ ] **Step 5: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/exam-sheet.tsx components/class-viewer/lesson-viewer/quiz-runner.tsx locales/en.json locales/es.json
git commit -m "quiz: exam sheet mode with submit-at-end grading"
```

### Task 17: Quiz layout setting in Course Studio and the renderer

**Files:**
- Modify: `components/admin/course-studio/item-editor.tsx` (QUIZ block; imports)
- Modify: `components/class-viewer/class-item-renderer.tsx` (pass `settings`)

- [ ] **Step 1: Renderer passes settings**

In `class-item-renderer.tsx` add `import { readQuizSettings } from '@/lib/quiz/quiz-settings'` and on the QUIZ mount only: `settings={readQuizSettings(item.quiz_settings)}`. (EXERCISE always focus.)

- [ ] **Step 2: Item editor select**

Add imports: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'` and `import { readQuizSettings } from '@/lib/quiz/quiz-settings'`.

Inside the `item.item_type === 'QUIZ'` block, before `<div className="space-y-3"><SectionLabel>Questions</SectionLabel>`, insert:

```tsx
          <div className="grid gap-1.5">
            <SectionLabel>Quiz layout</SectionLabel>
            <Select
              value={readQuizSettings(item.quiz_settings).mode}
              onValueChange={(v) => {
                const quiz_settings = { mode: v === 'sheet' ? 'sheet' : 'focus' }
                onPatched({ quiz_settings })
                queue({ quiz_settings })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="focus">Focus stage — one question at a time, graded as you go</SelectItem>
                <SelectItem value="sheet">Exam sheet — every question on one page, graded on submit</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Exercises always use the focus stage.</p>
          </div>
```

Until migration 039 is applied, saving this select fails with a Postgres "column quiz_settings does not exist" error surfaced by the save-status tracker; that is expected and is the reason Task 3 Step 6 exists.

- [ ] **Step 3: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. With the migration applied: set a quiz to Exam sheet in Course Studio, reload the student lesson, see the sheet; set back to Focus, see the stage.

- [ ] **Step 4: Commit**

```bash
git add components/admin/course-studio/item-editor.tsx components/class-viewer/class-item-renderer.tsx
git commit -m "studio: per-quiz layout setting wired to the runner"
```

---

## Phase 6 — Drag-and-drop builder (admin)

### Task 18: Transform math

**Files:**
- Create: `lib/quiz/transform.ts`
- Test: `lib/quiz/__tests__/transform.test.ts`

**Interfaces:**
- Produces: `Rect`, `Handle`, `HANDLES`, `SNAP_STEP`, `MIN_SIZE`, `snap(v, step)`, `clampRect(r)`, `moveRect(start, dx, dy, step)`, `resizeRect(start, handle, dx, dy, step, keepRatio)`, `clampPieceWidth(w)`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/quiz/__tests__/transform.test.ts
import { describe, expect, it } from 'vitest'
import { clampPieceWidth, clampRect, moveRect, resizeRect, snap } from '../transform'

const start = { x: 40, y: 40, width: 20, height: 10 }

describe('snap', () => {
  it('rounds to the step, or to a tenth when unsnapped', () => {
    expect(snap(41.2, 2.5)).toBe(42.5)
    expect(snap(41.24, null)).toBe(41.2)
  })
})

describe('clampRect', () => {
  it('keeps the rect inside 0..100 and above the minimum size', () => {
    expect(clampRect({ x: 95, y: -5, width: 20, height: 1 })).toEqual({ x: 80, y: 0, width: 20, height: 2 })
  })
})

describe('moveRect', () => {
  it('translates and clamps', () => {
    expect(moveRect(start, 10, -50, null)).toEqual({ x: 50, y: 0, width: 20, height: 10 })
    expect(moveRect(start, 100, 0, null)).toEqual({ x: 80, y: 40, width: 20, height: 10 })
  })
})

describe('resizeRect', () => {
  it('grows from the east and south edges', () => {
    expect(resizeRect(start, 'e', 5, 0, null, false)).toEqual({ x: 40, y: 40, width: 25, height: 10 })
    expect(resizeRect(start, 's', 0, 4, null, false)).toEqual({ x: 40, y: 40, width: 20, height: 14 })
  })
  it('keeps the opposite edge fixed when pulling west or north', () => {
    expect(resizeRect(start, 'w', 5, 0, null, false)).toEqual({ x: 45, y: 40, width: 15, height: 10 })
    expect(resizeRect(start, 'n', 0, -5, null, false)).toEqual({ x: 40, y: 35, width: 20, height: 15 })
  })
  it('locks the ratio on corners when asked', () => {
    const r = resizeRect(start, 'se', 10, 0, null, true)
    expect(r.width).toBe(30)
    expect(r.height).toBe(15)
    const nw = resizeRect(start, 'nw', -10, 0, null, true)
    expect(nw).toEqual({ x: 30, y: 35, width: 30, height: 15 })
  })
  it('never collapses below the minimum size', () => {
    expect(resizeRect(start, 'e', -30, 0, null, false).width).toBe(2)
  })
  it('snaps to the grid', () => {
    expect(resizeRect(start, 'e', 1.1, 0, 2.5, false).width).toBe(20)
    expect(resizeRect(start, 'e', 1.3, 0, 2.5, false).width).toBe(22.5)
  })
})

describe('clampPieceWidth', () => {
  it('stays within 3..60 with one decimal', () => {
    expect(clampPieceWidth(1)).toBe(3)
    expect(clampPieceWidth(99)).toBe(60)
    expect(clampPieceWidth(12.34)).toBe(12.3)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/quiz/__tests__/transform.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/quiz/transform.ts
/** Pure geometry for the composition canvas. Everything is percent of the canvas (0..100). */
export type Rect = { x: number; y: number; width: number; height: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const SNAP_STEP = 2.5
export const MIN_SIZE = 2
export const PIECE_WIDTH_MIN = 3
export const PIECE_WIDTH_MAX = 60

/** Round to the grid step; with no step, round to a tenth of a percent. */
export function snap(v: number, step: number | null): number {
  return step ? Math.round(v / step) * step : Math.round(v * 10) / 10
}

export function clampRect(r: Rect): Rect {
  const width = Math.min(100, Math.max(MIN_SIZE, r.width))
  const height = Math.min(100, Math.max(MIN_SIZE, r.height))
  return { x: Math.min(100 - width, Math.max(0, r.x)), y: Math.min(100 - height, Math.max(0, r.y)), width, height }
}

export function moveRect(start: Rect, dx: number, dy: number, step: number | null): Rect {
  return clampRect({ ...start, x: snap(start.x + dx, step), y: snap(start.y + dy, step) })
}

/**
 * Resize from a handle. West/north handles keep the opposite edge fixed.
 * With keepRatio on a corner, height follows width at the start ratio.
 */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, step: number | null, keepRatio: boolean): Rect {
  let width = start.width
  let height = start.height
  if (handle.includes('e')) width = start.width + dx
  if (handle.includes('w')) width = start.width - dx
  if (handle.includes('s')) height = start.height + dy
  if (handle.includes('n')) height = start.height - dy
  width = Math.max(MIN_SIZE, snap(width, step))
  if (keepRatio && handle.length === 2) height = (width * start.height) / start.width
  height = Math.max(MIN_SIZE, snap(height, step))
  const x = handle.includes('w') ? start.x + start.width - width : start.x
  const y = handle.includes('n') ? start.y + start.height - height : start.y
  return clampRect({ x: snap(x, step), y: snap(y, step), width, height })
}

export function clampPieceWidth(w: number): number {
  return Math.min(PIECE_WIDTH_MAX, Math.max(PIECE_WIDTH_MIN, Math.round(w * 10) / 10))
}
```

- [ ] **Step 4: Run tests** — PASS. **Step 5: Commit**

```bash
git add lib/quiz/transform.ts lib/quiz/__tests__/transform.test.ts
git commit -m "quiz: pure move/resize/snap math for the composition canvas"
```

### Task 19: Handles and the canvas transform hook

**Files:**
- Create: `components/admin/piece-placement/handles.tsx`, `components/admin/piece-placement/use-canvas-transform.ts`

**Interfaces:**
- Consumes: `Rect`, `Handle`, `HANDLES`, `SNAP_STEP`, `moveRect`, `resizeRect`, `clampPieceWidth` (Task 18).
- Produces: `Handles({ onDown, tone? })`; `useCanvasTransform(canvasRef, snap: boolean): { begin, handlers, consumeClick }` where `begin(e, spec)` with `spec` one of `{ mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; onChange: (r: Rect) => void }` or `{ mode: 'size'; width: number; onChange: (w: number) => void }`; `handlers` = `{ onPointerMove, onPointerUp, onPointerCancel }` to spread on the canvas root; `consumeClick()` returns true (once) when the last gesture actually dragged, so click-to-place can ignore it.

- [ ] **Step 1: Hook**

```ts
// components/admin/piece-placement/use-canvas-transform.ts
'use client'

import { useCallback, useRef } from 'react'
import { SNAP_STEP, clampPieceWidth, moveRect, resizeRect, type Handle, type Rect } from '@/lib/quiz/transform'

export type TransformSpec =
  | { mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; onChange: (r: Rect) => void }
  | { mode: 'size'; width: number; onChange: (w: number) => void }

interface Session {
  spec: TransformSpec
  startX: number
  startY: number
  canvasW: number
  canvasH: number
  moved: boolean
}

/**
 * Pointer-capture drag sessions in canvas-percent space. Call `begin` from a
 * pointerdown on a box or handle; spread `handlers` on the canvas root (the
 * captured events bubble there). Pattern from
 * components/playsense-studio/studio/editable-measure-strip.tsx.
 */
export function useCanvasTransform(canvasRef: React.RefObject<HTMLElement | null>, snap: boolean) {
  const session = useRef<Session | null>(null)
  const lastMoved = useRef(false)
  const step = snap ? SNAP_STEP : null

  const begin = useCallback(
    (e: React.PointerEvent, spec: TransformSpec) => {
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // capture is best-effort; window-level fallbacks are not needed because the captured target stays mounted
      }
      const r = canvas.getBoundingClientRect()
      session.current = { spec, startX: e.clientX, startY: e.clientY, canvasW: r.width, canvasH: r.height, moved: false }
    },
    [canvasRef],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = session.current
      if (!s) return
      const dxPx = e.clientX - s.startX
      const dyPx = e.clientY - s.startY
      if (Math.abs(dxPx) + Math.abs(dyPx) > 3) s.moved = true
      const dx = (dxPx / s.canvasW) * 100
      const dy = (dyPx / s.canvasH) * 100
      const { spec } = s
      if (spec.mode === 'move') spec.onChange(moveRect(spec.rect, dx, dy, step))
      else if (spec.mode === 'resize') spec.onChange(resizeRect(spec.rect, spec.handle ?? 'se', dx, dy, step, !!spec.keepRatio))
      else spec.onChange(clampPieceWidth(spec.width + dx))
    },
    [step],
  )

  const end = useCallback(() => {
    lastMoved.current = !!session.current?.moved
    session.current = null
  }, [])

  const consumeClick = useCallback(() => {
    const moved = lastMoved.current
    lastMoved.current = false
    return moved
  }, [])

  return { begin, handlers: { onPointerMove, onPointerUp: end, onPointerCancel: end }, consumeClick }
}
```

- [ ] **Step 2: Handles**

```tsx
// components/admin/piece-placement/handles.tsx
'use client'

import { cn } from '@/lib/utils'
import { HANDLES, type Handle } from '@/lib/quiz/transform'

const POS: Record<Handle, string> = {
  nw: '-left-1.5 -top-1.5 cursor-nwse-resize',
  n: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-1.5 -top-1.5 cursor-nesw-resize',
  e: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-right-1.5 -bottom-1.5 cursor-nwse-resize',
  s: 'left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize',
  sw: '-left-1.5 -bottom-1.5 cursor-nesw-resize',
  w: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
}

/** Eight resize handles for an absolutely positioned box. `tone="neutral"` is used for image layers. */
export function Handles({ onDown, tone = 'primary' }: { onDown: (e: React.PointerEvent, handle: Handle) => void; tone?: 'primary' | 'neutral' }) {
  return (
    <>
      {HANDLES.map((h) => (
        <span
          key={h}
          data-handle={h}
          onPointerDown={(e) => onDown(e, h)}
          className={cn(
            'absolute z-[3] h-[11px] w-[11px] rounded-[3px] border-[1.5px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]',
            tone === 'primary' ? 'border-primary' : 'border-foreground',
            POS[h],
          )}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`. **Step 4: Commit**

```bash
git add components/admin/piece-placement/handles.tsx components/admin/piece-placement/use-canvas-transform.ts
git commit -m "admin: canvas transform hook with pointer capture and resize handles"
```

### Task 20: Composition canvas

**Files:**
- Create: `components/admin/piece-placement/composition-canvas.tsx`

**Interfaces:**
- Consumes: `Background`, `BackgroundLayer` (Task 1), `PlacementPiece`, `useStageAspect` (Task 4), `useCanvasTransform`, `Handles` (Task 19), `Rect` (Task 18).
- Produces: `type Selection = { kind: 'layer' | 'piece'; id: string } | null`; `CompositionCanvas({ background, pieces, selection, onSelect, onLayerRect, onPieceArea, onPieceWidth, snap, showGrid })`.

- [ ] **Step 1: Implement**

```tsx
// components/admin/piece-placement/composition-canvas.tsx
'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import type { Rect } from '@/lib/quiz/transform'
import { useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { Handles } from './handles'
import { useCanvasTransform } from './use-canvas-transform'

export type Selection = { kind: 'layer' | 'piece'; id: string } | null

const BASE_HEIGHT_PX = 500

/**
 * The editable composition: color, draggable/resizable image layers, and one
 * draggable/resizable target box per piece with the piece ghost centered in
 * it. Clicking empty canvas moves the selected piece's box there.
 */
export function CompositionCanvas({
  background,
  pieces,
  selection,
  onSelect,
  onLayerRect,
  onPieceArea,
  onPieceWidth,
  snap,
  showGrid,
}: {
  background: Background
  pieces: PlacementPiece[]
  selection: Selection
  onSelect: (s: Selection) => void
  onLayerRect: (id: string, rect: Rect) => void
  onPieceArea: (id: string, rect: Rect) => void
  onPieceWidth: (id: string, width: number) => void
  snap: boolean
  showGrid: boolean
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  const tf = useCanvasTransform(canvasRef, snap)
  const selectedPiece = selection?.kind === 'piece' ? pieces.find((p) => p.id === selection.id) : undefined

  const onCanvasClick = (e: React.MouseEvent) => {
    if (tf.consumeClick()) return
    if (e.target !== e.currentTarget) return
    if (!selectedPiece) {
      onSelect(null)
      return
    }
    const r = canvasRef.current!.getBoundingClientRect()
    const a = selectedPiece.area
    const x = ((e.clientX - r.left) / r.width) * 100 - a.width / 2
    const y = ((e.clientY - r.top) / r.height) * 100 - a.height / 2
    onPieceArea(selectedPiece.id, { ...a, x: Math.min(100 - a.width, Math.max(0, x)), y: Math.min(100 - a.height, Math.max(0, y)) })
  }

  return (
    <div className="grid min-h-[380px] place-items-center bg-[radial-gradient(hsl(var(--foreground)/0.1)_1px,transparent_1px)] bg-[length:16px_16px] p-6">
      <div
        ref={canvasRef}
        onClick={onCanvasClick}
        {...tf.handlers}
        className="relative touch-none select-none rounded-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--foreground)/0.15)]"
        style={{ width: `min(100%, ${BASE_HEIGHT_PX * aspect}px)`, aspectRatio: aspect, background: background.color }}
      >
        {background.layers.map((l) => {
          const on = selection?.kind === 'layer' && selection.id === l.id
          const rect: Rect = { x: l.x, y: l.y, width: l.width, height: l.height }
          return (
            <div
              key={l.id}
              className={cn('absolute cursor-move', on && 'outline outline-[1.5px] outline-primary')}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%` }}
              onPointerDown={(e) => {
                onSelect({ kind: 'layer', id: l.id })
                tf.begin(e, { mode: 'move', rect, onChange: (r) => onLayerRect(l.id, r) })
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              {on && <Handles tone="neutral" onDown={(e, h) => tf.begin(e, { mode: 'resize', rect, handle: h, keepRatio: true, onChange: (r) => onLayerRect(l.id, r) })} />}
            </div>
          )
        })}

        {showGrid && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%), repeating-linear-gradient(90deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%)',
            }}
          />
        )}

        {pieces.map((p, i) => {
          const on = selection?.kind === 'piece' && selection.id === p.id
          const a = p.area
          return (
            <div
              key={p.id}
              className={cn(
                'absolute cursor-move rounded-md border-[1.5px] border-dashed border-primary/55 bg-primary/8',
                on && 'border-solid border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]',
              )}
              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, zIndex: on ? 5 : 2 }}
              onPointerDown={(e) => {
                onSelect({ kind: 'piece', id: p.id })
                tf.begin(e, { mode: 'move', rect: a, onChange: (r) => onPieceArea(p.id, r) })
              }}
            >
              <span className="absolute -top-[22px] left-0 whitespace-nowrap rounded-[5px] bg-primary px-1.5 py-0.5 text-[10.5px] font-bold leading-[1.5] text-white">
                {p.label || `Piece ${i + 1}`}
              </span>
              {/* Ghost: the piece at its student size, centered in the box. The gold dot resizes it. */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${(p.width / a.width) * 100}%` }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" draggable={false} className="block h-auto w-full select-none opacity-50" />
                ) : (
                  <div className="aspect-square w-full rounded border-2 border-dashed border-white/50" />
                )}
                {on && (
                  <span
                    title="Drag to change how big the piece appears to students"
                    onPointerDown={(e) => tf.begin(e, { mode: 'size', width: p.width, onChange: (w) => onPieceWidth(p.id, w) })}
                    className="pointer-events-auto absolute -bottom-[7px] -right-[7px] z-[4] h-[13px] w-[13px] cursor-nwse-resize rounded-full border-[1.5px] border-white bg-gold shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                  />
                )}
              </div>
              {on && <Handles onDown={(e, h) => tf.begin(e, { mode: 'resize', rect: a, handle: h, onChange: (r) => onPieceArea(p.id, r) })} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. **Step 3: Commit**

```bash
git add components/admin/piece-placement/composition-canvas.tsx
git commit -m "admin: composition canvas with draggable layers and target boxes"
```

### Task 21: Background and pieces inspectors

**Files:**
- Create: `components/admin/piece-placement/inspector-background.tsx`, `components/admin/piece-placement/inspector-pieces.tsx`

**Interfaces:**
- Consumes: `Background`, `BackgroundLayer` (Task 1), `PlacementPiece`, `Selection` (Task 20), `QuizMediaUpload` (`components/admin/quiz-media-upload.tsx`), `readLocalizedField` (`lib/quiz/options-es.ts`), `clampPieceWidth` (Task 18).
- Produces: `InspectorBackground({ questionId, background, selection, onSelect, onChange })` where `onChange(patch: Partial<Background>)`; `InspectorPieces({ questionId, pieces, optionsEs, selection, onSelect, onPatch, onLabelEs, onAdd, onRemove })`.

- [ ] **Step 1: Background inspector**

```tsx
// components/admin/piece-placement/inspector-background.tsx
'use client'

import { ArrowDown, ArrowUp, Palette, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Background, BackgroundLayer } from '@/lib/quiz/composition'
import { QuizMediaUpload } from '../quiz-media-upload'
import type { Selection } from './composition-canvas'

const ASPECTS = [
  { label: '16:9', value: 16 / 9 },
  { label: '16:10', value: 1.6 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
]
const SWATCHES = ['#2A1E17', '#1B1B1F', '#0F2A2E', '#3B2F4A', '#6B2E1E', '#F4EDE1', '#FFFFFF']

/** Read an image's natural ratio so a new layer lands at a sensible size with its corners ratio-locked. */
function measure(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined)
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
}

export function InspectorBackground({
  questionId,
  background,
  selection,
  onSelect,
  onChange,
}: {
  questionId: string
  background: Background
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (patch: Partial<Background>) => void
}) {
  const aspect = background.aspect ?? 1.6
  const setLayers = (layers: BackgroundLayer[]) => onChange({ layers })

  const addLayer = async (url: string) => {
    if (!url) return
    const ratio = await measure(url)
    const width = 30
    const height = Math.min(100, ratio ? (width * aspect) / ratio : width)
    const layer: BackgroundLayer = { id: crypto.randomUUID(), imageUrl: url, x: 50 - width / 2, y: Math.max(0, 50 - height / 2), width, height, ...(ratio ? { ratio } : {}) }
    setLayers([...background.layers, layer])
    onSelect({ kind: 'layer', id: layer.id })
  }
  const reorder = (id: string, dir: -1 | 1) => {
    const i = background.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= background.layers.length) return
    const next = [...background.layers]
    ;[next[i], next[j]] = [next[j], next[i]]
    setLayers(next)
  }
  const remove = (id: string) => {
    setLayers(background.layers.filter((l) => l.id !== id))
    if (selection?.kind === 'layer' && selection.id === id) onSelect(null)
  }

  return (
    <div className="grid content-start gap-5 p-3.5">
      <div>
        <Label>Canvas shape</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-pressed={Math.abs(aspect - a.value) < 0.01}
              onClick={() => onChange({ aspect: a.value })}
              className={cn(
                'grid place-items-center gap-1 rounded-[9px] border-[1.5px] px-1 py-2 text-[11px] font-bold',
                Math.abs(aspect - a.value) < 0.01 ? 'border-primary bg-primary/8 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <i className="block rounded-[2px] border-[1.5px] border-current" style={{ width: 22, height: 22 / a.value }} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Background color</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={background.color.toLowerCase() === c.toLowerCase()}
              onClick={() => onChange({ color: c })}
              className={cn('aspect-square rounded-lg border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', background.color.toLowerCase() === c.toLowerCase() ? 'border-primary' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <Input value={background.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 font-mono text-xs" aria-label="Hex color" />
          <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: background.color }} />
        </div>
      </div>

      <div>
        <Label>
          Image layers <span className="font-medium normal-case tracking-normal">· back → front</span>
        </Label>
        <div className="grid gap-1.5">
          {background.layers.map((l, i) => {
            const on = selection?.kind === 'layer' && selection.id === l.id
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect({ kind: 'layer', id: l.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect({ kind: 'layer', id: l.id })
                }}
                className={cn('grid grid-cols-[34px_1fr_auto] items-center gap-2.5 rounded-[10px] border-[1.5px] bg-raised p-2 text-left', on ? 'border-primary' : 'border-border')}
              >
                <span className="grid h-[30px] w-[34px] place-items-center overflow-hidden rounded-[7px] bg-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="text-xs font-semibold">
                  Layer {i + 1}
                  <small className="block text-[11px] font-medium tabular-nums text-muted-foreground">{Math.round(l.width)}% × {Math.round(l.height)}%</small>
                </span>
                <span className="inline-flex gap-0.5">
                  <button type="button" aria-label="Send back" disabled={i === 0} onClick={(e) => { e.stopPropagation(); reorder(l.id, -1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Bring forward" disabled={i === background.layers.length - 1} onClick={(e) => { e.stopPropagation(); reorder(l.id, 1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete layer" onClick={(e) => { e.stopPropagation(); remove(l.id) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            )
          })}
          <QuizMediaUpload key={background.layers.length} kind="image" slug={`${questionId}-layer-${background.layers.length}`} value="" onChange={(url) => void addLayer(url)} compact />
          <p className="text-[11.5px] leading-snug text-muted-foreground">New layers land centered at 30% width. Drag to move; pull a corner to resize (ratio locked).</p>
        </div>
      </div>
    </div>
  )
}
```

The `key={background.layers.length}` on the uploader resets it to its empty "Upload" state after each add.

- [ ] **Step 2: Pieces inspector**

```tsx
// components/admin/piece-placement/inspector-pieces.tsx
'use client'

import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { readLocalizedField, type LocalizedOptions } from '@/lib/quiz/options-es'
import { clampPieceWidth } from '@/lib/quiz/transform'
import { QuizMediaUpload } from '../quiz-media-upload'
import type { Selection } from './composition-canvas'

const FIELDS: { label: string; key: 'x' | 'y' | 'width' | 'height' }[] = [
  { label: 'X', key: 'x' },
  { label: 'Y', key: 'y' },
  { label: 'W', key: 'width' },
  { label: 'H', key: 'height' },
]

export function InspectorPieces({
  questionId,
  pieces,
  optionsEs,
  selection,
  onSelect,
  onPatch,
  onLabelEs,
  onAdd,
  onRemove,
}: {
  questionId: string
  pieces: PlacementPiece[]
  optionsEs: LocalizedOptions
  selection: Selection
  onSelect: (s: Selection) => void
  onPatch: (id: string, patch: Partial<PlacementPiece>) => void
  onLabelEs: (id: string, label: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="grid content-start gap-3 p-3.5">
      {pieces.map((p, i) => {
        const on = selection?.kind === 'piece' && selection.id === p.id
        return (
          <div key={p.id} aria-selected={on} onClick={() => onSelect({ kind: 'piece', id: p.id })} className={cn('grid gap-2 rounded-xl border-[1.5px] bg-raised p-2.5', on ? 'border-primary' : 'border-border')}>
            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
              <span className="grid h-[34px] w-10 place-items-center overflow-hidden rounded-lg bg-sunken">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">img</span>
                )}
              </span>
              <span className="min-w-0">
                <Input value={p.label ?? ''} onChange={(e) => onPatch(p.id, { label: e.target.value })} placeholder={`Piece ${i + 1} label`} className="h-7 border-0 bg-transparent px-0 text-[13px] font-semibold shadow-none focus-visible:ring-0" aria-label="Piece label" />
                <small className="block text-[11px] tabular-nums text-muted-foreground">size {p.width}% · target {Math.round(p.area.width)}×{Math.round(p.area.height)}%</small>
              </span>
              <button type="button" aria-label="Delete piece" onClick={(e) => { e.stopPropagation(); onRemove(p.id) }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {on && (
              <>
                <QuizMediaUpload kind="image" slug={`${questionId}-piece-${p.id}`} value={p.imageUrl} onChange={(url) => onPatch(p.id, { imageUrl: url })} compact />
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ES</span>
                  <Input value={readLocalizedField(optionsEs, 'pieces', p.id, 'label')} onChange={(e) => onLabelEs(p.id, e.target.value)} placeholder={`Etiqueta de la pieza ${i + 1} (Español, opcional)`} className="h-8 border-dashed text-xs" />
                </div>
                <details className="grid gap-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-3 w-3 transition-transform [details[open]>summary>&]:rotate-90" /> Precise values
                  </summary>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FIELDS.map((f) => (
                      <label key={f.key} className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
                        {f.label}
                        <input type="number" step="0.1" value={Math.round(p.area[f.key] * 10) / 10} onChange={(e) => onPatch(p.id, { area: { ...p.area, [f.key]: Number(e.target.value) } })} className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary" />
                      </label>
                    ))}
                    <label className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
                      Size
                      <input type="number" step="0.1" value={p.width} onChange={(e) => onPatch(p.id, { width: clampPieceWidth(Number(e.target.value)) })} className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary" />
                    </label>
                  </div>
                </details>
              </>
            )}
          </div>
        )
      })}
      <button type="button" onClick={onAdd} className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-foreground/25 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add piece
      </button>
      <div className="grid gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="text-gold">How to position</b>
        Select a piece, then drag its box on the canvas or click an empty spot to jump it there. Pull the square handles to resize the target. The gold dot on the faded piece sets how big the piece appears to students.
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`. **Step 4: Commit**

```bash
git add components/admin/piece-placement/inspector-background.tsx components/admin/piece-placement/inspector-pieces.tsx
git commit -m "admin: background and pieces inspectors for the composition builder"
```

### Task 22: Builder dialog, summary card, and removal of the old builder

**Files:**
- Create: `components/admin/piece-placement/builder-dialog.tsx`, `components/admin/piece-placement/piece-placement-summary.tsx`
- Modify: `components/admin/quiz-builder.tsx:11,120-129` (import + piece_placement case)
- Delete: `components/admin/piece-placement-builder.tsx`

**Interfaces:**
- Consumes: everything from Tasks 19–21, `readComposition`, `readPieces` (Task 1), `useStageAspect`, `PiecePlacementInput`, `CompositionBackground` (Task 4), `patchLocalizedEntry`, `pruneLocalizedEntries` (options-es), `gradeQuestionScore` (grading), `FeedbackBanner` (Task 8), Radix `Dialog*` from `components/ui/dialog.tsx`.
- Produces: `PiecePlacementBuilderDialog({ open, onOpenChange, questionId, options, optionsEs, imageUrl, onChange })`; `PiecePlacementSummary({ questionId, options, optionsEs, imageUrl, onChange })` with the exact prop shape the old builder had, so `quiz-builder.tsx` swaps one component for another.

- [ ] **Step 1: Builder dialog**

```tsx
// components/admin/piece-placement/builder-dialog.tsx
'use client'

import { Eye, Grid3X3, Pencil, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PiecePlacementInput, useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { cn } from '@/lib/utils'
import { readComposition, readPieces, type Background } from '@/lib/quiz/composition'
import { gradeQuestionScore, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { patchLocalizedEntry, pruneLocalizedEntries, type LocalizedOptions } from '@/lib/quiz/options-es'
import type { Rect } from '@/lib/quiz/transform'
import type { QuizQuestion } from '@/types/modules'
import { CompositionCanvas, type Selection } from './composition-canvas'
import { InspectorBackground } from './inspector-background'
import { InspectorPieces } from './inspector-pieces'

export interface BuilderProps {
  questionId: string
  options: unknown
  /** Spanish overlay: `{ pieces: [{ id, label }] }` with the same piece ids. */
  optionsEs?: LocalizedOptions
  imageUrl: string
  onChange: (data: { options?: unknown; options_es?: unknown; image_url?: string | null }) => void
}

function Toggle({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold', on ? 'bg-raised text-foreground shadow-sm' : 'text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

/** Student preview inside the dialog: the real input with local state plus Check / Reset. */
function PreviewPane({ background, pieces }: { background: Background; pieces: PlacementPiece[] }) {
  const [placement, setPlacement] = useState<Record<string, PiecePlacement>>({})
  const [graded, setGraded] = useState(false)
  const score = gradeQuestionScore({ question_type: 'piece_placement', options: { pieces } } as unknown as QuizQuestion, placement)
  return (
    <div className="grid gap-3.5 p-5">
      <PiecePlacementInput background={background} pieces={pieces} placement={placement} isGraded={graded} onChange={setPlacement} maxHeight="420px" />
      {graded && <FeedbackBanner score={score} />}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { setPlacement({}); setGraded(false) }}>Reset</Button>
        <Button disabled={Object.keys(placement).length === 0 || graded} onClick={() => setGraded(true)}>Check placement</Button>
      </div>
    </div>
  )
}

export function PiecePlacementBuilderDialog({ open, onOpenChange, questionId, options, optionsEs = null, imageUrl, onChange }: BuilderProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const [tab, setTab] = useState<'background' | 'pieces'>('pieces')
  const [selection, setSelection] = useState<Selection>(pieces[0] ? { kind: 'piece', id: pieces[0].id } : null)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [preview, setPreview] = useState(false)
  const aspect = useStageAspect(background)

  const write = (next: { background?: Background; pieces?: PlacementPiece[] }) =>
    onChange({ options: { ...((options as Record<string, unknown>) ?? {}), background: next.background ?? background, pieces: next.pieces ?? pieces }, image_url: null })

  // Migrated rows carry aspect: null; persist the measured ratio the first time the builder sees one.
  useEffect(() => {
    if (open && background.aspect == null && background.layers.length > 0 && aspect) write({ background: { ...background, aspect } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aspect, background.aspect])

  const setBackground = (patch: Partial<Background>) => write({ background: { ...background, ...patch } })
  const setLayerRect = (id: string, r: Rect) => setBackground({ layers: background.layers.map((l) => (l.id === id ? { ...l, ...r } : l)) })
  const patchPiece = (id: string, patch: Partial<PlacementPiece>) => write({ pieces: pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const addPiece = () => {
    const id = crypto.randomUUID()
    write({ pieces: [...pieces, { id, label: '', imageUrl: '', width: 15, area: { x: 40, y: 40, width: 20, height: 15 } }] })
    setSelection({ kind: 'piece', id })
    setTab('pieces')
  }
  const removePiece = (id: string) => {
    const remaining = pieces.filter((p) => p.id !== id)
    onChange({ options: { ...((options as Record<string, unknown>) ?? {}), background, pieces: remaining }, options_es: pruneLocalizedEntries(optionsEs, 'pieces', remaining.map((p) => p.id)), image_url: null })
    if (selection?.kind === 'piece' && selection.id === id) setSelection(null)
  }
  const setLabelEs = (id: string, label: string) => onChange({ options_es: patchLocalizedEntry(optionsEs, 'pieces', id, { label }) })

  const saved = useMemo(() => JSON.stringify({ image_url: null, options: { background, pieces: pieces.length > 1 ? [pieces[0], `… ${pieces.length - 1} more`] : pieces } }, null, 2), [background, pieces])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[96vw] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]">
        <DialogTitle className="sr-only">Drag-and-drop builder</DialogTitle>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-sunken px-3.5 py-2.5">
          <span className="mr-auto font-heading text-[13px] font-bold">Drag into place</span>
          <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
            <Toggle on={!preview} onClick={() => setPreview(false)} icon={Pencil}>Design</Toggle>
            <Toggle on={preview} onClick={() => setPreview(true)} icon={Eye}>Preview as student</Toggle>
          </div>
          {!preview && (
            <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
              <Toggle on={snap} onClick={() => setSnap(!snap)} icon={Target}>Snap</Toggle>
              <Toggle on={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid3X3}>Grid</Toggle>
            </div>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>

        {preview ? (
          <div className="min-h-0 flex-1 overflow-auto"><PreviewPane background={background} pieces={pieces} /></div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid min-h-0 grid-rows-[1fr_auto] overflow-auto">
              <CompositionCanvas background={background} pieces={pieces} selection={selection} onSelect={setSelection} onLayerRect={setLayerRect} onPieceArea={(id, r) => patchPiece(id, { area: r })} onPieceWidth={(id, w) => patchPiece(id, { width: w })} snap={snap} showGrid={showGrid} />
              <details className="px-4 pb-3.5">
                <summary className="cursor-pointer text-[11.5px] font-bold text-muted-foreground">What gets saved (live)</summary>
                <pre className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border border-border bg-sunken p-3 text-[11.5px] leading-snug text-muted-foreground">{saved}</pre>
              </details>
            </div>
            <div className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden border-t border-border bg-card md:border-l md:border-t-0">
              <div className="grid grid-cols-2 border-b border-border">
                <button type="button" aria-pressed={tab === 'background'} onClick={() => setTab('background')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'background' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Background</button>
                <button type="button" aria-pressed={tab === 'pieces'} onClick={() => setTab('pieces')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'pieces' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Pieces · {pieces.length}</button>
              </div>
              <div className="min-h-0 overflow-auto">
                {tab === 'background' ? (
                  <InspectorBackground questionId={questionId} background={background} selection={selection} onSelect={setSelection} onChange={setBackground} />
                ) : (
                  <InspectorPieces questionId={questionId} pieces={pieces} optionsEs={optionsEs} selection={selection} onSelect={setSelection} onPatch={patchPiece} onLabelEs={setLabelEs} onAdd={addPiece} onRemove={removePiece} />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Summary card shown in the question form**

```tsx
// components/admin/piece-placement/piece-placement-summary.tsx
'use client'

import { Maximize2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CompositionBackground, useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { readComposition, readPieces } from '@/lib/quiz/composition'
import { PiecePlacementBuilderDialog, type BuilderProps } from './builder-dialog'

/** Replaces the inline form: a thumbnail of the composition, a piece count, and the button that opens the full-width builder. */
export function PiecePlacementSummary(props: BuilderProps) {
  const { options, imageUrl } = props
  const [open, setOpen] = useState(false)
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const aspect = useStageAspect(background)
  const missingImages = pieces.filter((p) => !p.imageUrl).length
  return (
    <div className="grid gap-2">
      <Label>Stage &amp; pieces</Label>
      <div className="grid grid-cols-[120px_1fr] items-center gap-3.5 rounded-xl border border-border bg-raised p-3">
        <div className="relative overflow-hidden rounded-lg border border-border" style={{ aspectRatio: aspect }}>
          <CompositionBackground background={background} />
          {pieces.map((p) => (
            <span key={p.id} className="absolute rounded-[2px] border border-dashed border-primary/70" style={{ left: `${p.area.x}%`, top: `${p.area.y}%`, width: `${p.area.width}%`, height: `${p.area.height}%` }} />
          ))}
        </div>
        <div className="grid gap-1.5 text-xs text-muted-foreground">
          <span>
            <b className="text-foreground">{pieces.length}</b> {pieces.length === 1 ? 'piece' : 'pieces'} · <b className="text-foreground">{background.layers.length}</b> {background.layers.length === 1 ? 'image layer' : 'image layers'}
            {missingImages > 0 && <span className="text-terracotta"> · {missingImages} without an image</span>}
          </span>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
            <Maximize2 className="h-3.5 w-3.5" /> Open builder
          </Button>
        </div>
      </div>
      <PiecePlacementBuilderDialog open={open} onOpenChange={setOpen} {...props} />
    </div>
  )
}
```

- [ ] **Step 3: Swap the builder in quiz-builder.tsx and delete the old file**

Line 11: replace `import { PiecePlacementBuilder } from './piece-placement-builder'` with `import { PiecePlacementSummary } from './piece-placement/piece-placement-summary'`. In `renderOptionsBuilder`, the `piece_placement` case becomes:

```tsx
      case 'piece_placement':
        return <PiecePlacementSummary questionId={questionId} options={options} optionsEs={optionsEs} imageUrl={imageUrl} onChange={onChange} />
```

Then `git rm components/admin/piece-placement-builder.tsx`. Grep for other imports of the old builder: `grep -rn "piece-placement-builder" components app lib` must return nothing.

- [ ] **Step 4: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`. In Course Studio open a QUIZ with a piece_placement question: the summary card shows the composition; Open builder opens the dialog; add a layer (upload an image) and drag/resize it with ratio lock; select a piece, drag its box, pull handles, click empty canvas to jump the box, drag the gold dot to change size; precise values round-trip with decimals; Snap/Grid toggles; Preview as student places and grades pieces; Done closes; reload the studio and the composition is unchanged (autosave persisted via `quiz-questions-editor`); the student lesson shows the same composition. Open a legacy question (old `image_url` only, if the migration is not yet applied): it shows one full layer; after the first change its saved JSON carries `aspect`.

- [ ] **Step 5: Commit**

```bash
git add components/admin/piece-placement/builder-dialog.tsx components/admin/piece-placement/piece-placement-summary.tsx components/admin/quiz-builder.tsx
git rm -q components/admin/piece-placement-builder.tsx
git commit -m "admin: full-width drag-and-drop builder dialog replaces the numeric form"
```

---

## Phase 7 — Editor extras

### Task 23: Drag-to-reorder question cards

**Files:**
- Create: `components/admin/quiz-question-card.tsx`
- Modify: `components/admin/quiz-questions-editor.tsx` (sortable list; remove ↑/↓)

**Interfaces:**
- Consumes: `QuizBuilder` (existing), `QUESTION_TYPE_LABELS` (moved into the card file and re-exported), `reorderQuizQuestions` (existing action).
- Produces: `QuizQuestionCard({ question, index, onPatch, onRemove, previewOpen, onTogglePreview, children? })` — a `useSortable` row; `QuestionPreview` (Task 24) is rendered by the editor as `children` when `previewOpen`.

- [ ] **Step 1: Card**

```tsx
// components/admin/quiz-question-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { QuestionType, QuizQuestion } from '@/types/modules'
import { QuizBuilder } from './quiz-builder'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  text_answer: 'Text Answer',
  true_false: 'True/False',
  matching_pairs: 'Matching Pairs',
  fill_in_blank: 'Fill in the Blank',
  ordering_sequence: 'Ordering/Sequence',
  audio: 'Audio Response',
  audio_choice: 'Audio — Listen & Choose',
  piece_placement: 'Drag into place',
}

/** One sortable question row: grip, index, type select, the builder form, and an optional preview pane (children). */
export function QuizQuestionCard({
  question: q,
  index,
  onPatch,
  onRemove,
  previewOpen,
  onTogglePreview,
  children,
}: {
  question: QuizQuestion
  index: number
  onPatch: (patch: Partial<QuizQuestion>) => void
  onRemove: () => void
  previewOpen: boolean
  onTogglePreview: () => void
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('space-y-4 rounded-lg border border-border bg-card p-4', isDragging && 'z-10 border-primary shadow-lg')}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <button type="button" {...attributes} {...listeners} title="Drag to reorder" aria-label="Drag to reorder" className="grid h-7 w-6 cursor-grab place-items-center rounded text-muted-foreground/60 hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </button>
          Question {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" aria-pressed={previewOpen} onClick={onTogglePreview}>
            {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Preview
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onRemove} aria-label="Delete question">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Question Type</Label>
        <Select
          value={q.question_type}
          onValueChange={(v) => onPatch({ question_type: v as QuestionType, options: null, options_es: null, correct_answer: '', audio_url: null, image_url: null })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuizBuilder
        questionId={q.id}
        questionType={q.question_type}
        question={q.question}
        questionEs={q.question_es ?? ''}
        options={q.options}
        optionsEs={q.options_es}
        correctAnswer={q.correct_answer ?? ''}
        audioUrl={q.audio_url ?? ''}
        imageUrl={q.image_url ?? ''}
        explanation={q.explanation ?? ''}
        explanationEs={q.explanation_es ?? ''}
        onChange={(data) => onPatch(data as Partial<QuizQuestion>)}
      />

      {previewOpen && children}
    </div>
  )
}
```

- [ ] **Step 2: Editor uses the sortable card**

In `quiz-questions-editor.tsx`:
- Replace the lucide import with `import { Plus, Loader2 } from 'lucide-react'`; remove the `Label`, `Select*` imports and the local `QUESTION_TYPE_LABELS`; add:
  ```ts
  import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
  import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
  import { QuizQuestionCard } from './quiz-question-card'
  ```
- Replace `move` with:
  ```ts
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [previewId, setPreviewId] = useState<string | null>(null)
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = questions.findIndex((q) => q.id === active.id)
    const to = questions.findIndex((q) => q.id === over.id)
    const reindexed = arrayMove(questions, from, to).map((q, i) => ({ ...q, order_index: i }))
    setQuestions(reindexed)
    await track(reorderQuizQuestions(classItemId, reindexed.map((q) => q.id)))
  }
  ```
- Replace the `<div className="space-y-5">{questions.map(...)}</div>` block with:
  ```tsx
  <DndContext id={`quiz-dnd-${classItemId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-5">
        {questions.map((q, index) => (
          <QuizQuestionCard
            key={q.id}
            question={q}
            index={index}
            onPatch={(patch) => patchQuestion(q.id, patch)}
            onRemove={() => removeQuestion(q.id)}
            previewOpen={previewId === q.id}
            onTogglePreview={() => setPreviewId(previewId === q.id ? null : q.id)}
          />
        ))}
      </div>
    </SortableContext>
  </DndContext>
  ```
  (`children` for the preview pane are added in Task 24.)

- [ ] **Step 3: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`; drag a question by its grip, order persists after reload; keyboard: focus grip, Space, ArrowDown, Space.

- [ ] **Step 4: Commit**

```bash
git add components/admin/quiz-question-card.tsx components/admin/quiz-questions-editor.tsx
git commit -m "studio: drag-to-reorder quiz questions with dnd-kit"
```

### Task 24: Student preview with EN/ES toggle

**Files:**
- Create: `components/admin/question-preview.tsx`
- Modify: `components/admin/quiz-questions-editor.tsx` (render the preview as the card's children)

**Interfaces:**
- Consumes: `QuestionInput`, `FeedbackBanner`, `TypeChip` (student components), `localizeRow`, `QUIZ_FIELDS` (`lib/i18n/localize.ts`), `gradeQuestionScore`, `hasAnswer`, `fullCorrectLabel`, `seedAnswers` (Task 5).
- Produces: `QuestionPreview({ question })`.

- [ ] **Step 1: Implement**

```tsx
// components/admin/question-preview.tsx
'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { QuestionInput } from '@/components/class-viewer/lesson-viewer/quiz/question-input'
import { TypeChip } from '@/components/class-viewer/lesson-viewer/quiz/type-chip'
import quizStyles from '@/components/class-viewer/lesson-viewer/quiz/quiz.module.css'
import { QUIZ_FIELDS, localizeRow } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'
import { seedAnswers } from '@/lib/quiz/engine'
import { gradeQuestionScore, hasAnswer } from '@/lib/quiz/grading'
import { fullCorrectLabel } from '@/lib/quiz/labels'
import type { QuizQuestion } from '@/types/modules'

/**
 * Renders the real student component for one question beside the form.
 * ES applies the same overlay the lesson page applies (localizeRow on a clone),
 * so admins see exactly what the Spanish overlay produces.
 */
export function QuestionPreview({ question }: { question: QuizQuestion }) {
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const shown = useMemo(() => {
    if (lang === 'en') return question
    const clone = JSON.parse(JSON.stringify(question)) as Record<string, unknown>
    localizeRow(clone, 'es', QUIZ_FIELDS)
    return clone as unknown as QuizQuestion
  }, [question, lang])
  const [answer, setAnswer] = useState<unknown>(() => seedAnswers([question])[question.id])
  const [graded, setGraded] = useState(false)
  const reset = () => {
    setAnswer(seedAnswers([question])[question.id])
    setGraded(false)
  }
  return (
    <div className={cn(quizStyles.root, 'grid gap-3 rounded-xl border border-dashed border-foreground/25 bg-sunken p-3.5')}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        <span>Student preview</span>
        <span className="inline-flex gap-0.5 rounded-md border border-border p-0.5">
          {(['en', 'es'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); reset() }} className={cn('rounded px-2 py-0.5 text-[10.5px] font-bold uppercase', lang === l ? 'bg-raised text-foreground' : 'text-muted-foreground')}>
              {l}
            </button>
          ))}
        </span>
      </div>
      <div className="grid gap-3.5 rounded-[14px] border border-border bg-card p-4">
        <div className="flex items-center gap-2"><TypeChip type={shown.question_type} /></div>
        <h4 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{shown.question}</h4>
        <QuestionInput question={shown} answer={answer} isGraded={graded} onChange={setAnswer} />
        {graded && <FeedbackBanner score={gradeQuestionScore(shown, answer)} explanation={shown.explanation} correctAnswer={fullCorrectLabel(shown) || null} />}
        <div className="flex justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>Reset</Button>
          <Button type="button" size="sm" disabled={graded || !hasAnswer(shown, answer)} onClick={() => setGraded(true)}>Check answer</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render it from the editor**

In `quiz-questions-editor.tsx`, import `QuestionPreview` and pass it as children of `QuizQuestionCard`:

```tsx
          >
            <QuestionPreview question={q} />
          </QuizQuestionCard>
```
(The card renders children only when `previewOpen`.) Note: the preview shows the question exactly as saved, so a `piece_placement` question's preview runs the real stage with `maxHeight` default 62vh inside the drawer; that is acceptable because the drawer scrolls.

- [ ] **Step 3: Typecheck, lint, browser** — `npx tsc --noEmit && npm run lint`; toggle Preview on a question, answer and check it in EN, switch to ES and see the `_es` strings.

- [ ] **Step 4: Commit**

```bash
git add components/admin/question-preview.tsx components/admin/quiz-questions-editor.tsx
git commit -m "studio: student preview with EN/ES toggle beside each question"
```

---

## Phase 8 — i18n guard and verification

### Task 25: Translation-key guard test and remaining strings

**Files:**
- Create: `lib/i18n/__tests__/quiz-keys.test.ts`
- Modify: `locales/*.json` only if the test finds gaps

- [ ] **Step 1: Write the test**

```ts
// lib/i18n/__tests__/quiz-keys.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

// Every quiz translation key referenced in the student quiz components must
// resolve to a string in BOTH dictionaries. This is the class of bug behind the
// "Try again" button once rendering its own key path.
const ROOTS = ['components/class-viewer/lesson-viewer/quiz', 'components/class-viewer/lesson-viewer/quiz-runner.tsx']
const KEY_RE = /'(dashboard\.classViewer\.quiz\.[A-Za-z0-9_.]+)'/g

function files(path: string): string[] {
  const full = join(process.cwd(), path)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full).flatMap((f) => files(join(path, f)))
}
function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict)
}

describe('quiz translation keys', () => {
  const keys = new Set<string>()
  for (const f of ROOTS.flatMap(files)) {
    if (!/\.(tsx?|css)$/.test(f)) continue
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(KEY_RE)) keys.add(m[1])
  }
  it('finds keys to check', () => {
    expect(keys.size).toBeGreaterThan(30)
  })
  it.each([...keys].sort())('%s resolves in en and es', (key) => {
    expect(typeof resolve(en, key), `en:${key}`).toBe('string')
    expect(typeof resolve(es, key), `es:${key}`).toBe('string')
  })
})
```

If `tsconfig.json` lacks `"resolveJsonModule": true`, add it (Next's default config includes it).

- [ ] **Step 2: Run** — `npx vitest run lib/i18n/__tests__/quiz-keys.test.ts`. Every failure names a missing key; add it to both locale files with `merge_quiz_keys` (Task 4 Step 2) and re-run until green.

- [ ] **Step 3: Confirm no raw palette classes remain**

Run: `grep -rnE "\b(green|red|amber)-[0-9]{3}\b" components/class-viewer/lesson-viewer/quiz components/class-viewer/lesson-viewer/quiz-runner.tsx` → no output.

- [ ] **Step 4: Full suite** — `npx vitest run && npx tsc --noEmit && npm run lint` → all green.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/__tests__/quiz-keys.test.ts locales/en.json locales/es.json
git commit -m "i18n: guard test for quiz translation keys"
```

### Task 26: Migration application, type regeneration, and browser verification

**Files:** `types/database.ts` (regenerated), memory notes.

- [ ] **Step 1: Apply migration 039 (needs the user's explicit go-ahead if not already given in Task 3)**

Use the supabase MCP `apply_migration` with the contents of `supabase/migrations/039_quiz_settings_and_piece_composition.sql`, then `generate_typescript_types` → overwrite `types/database.ts` → `npx tsc --noEmit`. Verify with `execute_sql`:

```sql
select id, image_url, options->'background' as bg from quiz_questions where question_type = 'piece_placement';
select column_name from information_schema.columns where table_name = 'class_items' and column_name = 'quiz_settings';
```
Expected: every piece_placement row has a `bg` with `layers` (one `legacy` layer where an image existed), `image_url` is null; the column exists.

- [ ] **Step 2: Browser matrix (Chrome, `localhost:3005`, logged in as admin)**

Check each; fix and re-commit anything that fails.

| Area | Check |
|---|---|
| Focus stage | 1440px: question map on the right, stage ≤ 820px; 1024px: no map; 390px (device mode): stacks, buttons full width |
| Feedback | Correct: chime, pop, burst, green Continue. Wrong: thud, shake, dashed reveal ~400ms later, terracotta Continue. Partial (piece placement): amber banner with % |
| Streak | Chip at 2, gold at 4, sparkle at 3 and 6, resets on a miss |
| Sound toggle | Off → no cues; persists after reload (`lmm-quiz-prefs` in localStorage) |
| Keyboard | 1–4 / a–d, T / F, Enter, ← → |
| Types | All nine through idle → answered → check → correct and wrong; matching chips fallback below 560px; ordering drag + keyboard |
| Results | ≥960px report card with expanded review; below: hero + collapsible list; fanfare ≥70%, confetti ≥80%; ring number fits at 132 and 156; Continue goes to the next part; Try again restarts; completion recorded (footer shows done after reload) |
| Exam sheet | Course Studio → Quiz layout → Exam sheet; two columns ≥1180px, span cards, jump grid, submit with unanswered, filters, rail actions |
| Piece placement | 2560px window with a 2:3 composition: stage height ≤ 62vh; drop-back; graded reveal; phone strip |
| Builder | Open builder → layers add/move/resize/reorder/delete; boxes move/resize/click-to-place; size dot; precise values; Snap/Grid; Preview grades; Done; reload shows same data; legacy question gains `aspect` on first edit |
| Studio | Drag-reorder questions; keyboard reorder; Preview EN/ES |
| Reduced motion | OS setting on: no burst/confetti/pop/bounce; ring lands instantly; sound still follows the toggle |
| Dark / light, EN / ES | Every screen above in both themes and both languages; no raw key paths visible |

- [ ] **Step 3: Update memory**

Update `~/.claude/projects/-Users-charlieramirez-dev-latinmusicmastery/memory/quiz-revamp.md`: implementation shipped (commit range), migration applied (date), what was verified, what was not.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "db: regenerate types after migration 039"
```
