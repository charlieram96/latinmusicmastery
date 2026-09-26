# Studio Rework P5 — Exercise and Jam, Graded Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graded parts (the exercise's play-along and jam sessions) run on the score's tempo clock:
- **One number places the media.** Bar 1's position in the media sets where the play-along video or jam track sits. The admin drags or Auto-aligns it.
- **The student game.** It counts in 1 or 2 bars (counting down). It optionally pre-rolls the video. The video follows the clock with a gentle rate trim instead of re-seeking every 0.35 s.
- **Grid-driven timing.** The metronome and the highway beat lines follow the per-bar tempo and meter grid.
- **Backing tracks** are placed by their musical position.
- **Jam sessions** get a Studio entry and a graded student view.

**Architecture:**
- **New columns.** Three additive `class_items` columns (`play_bar1_seconds`, `play_count_in_bars`, `play_preroll`) hold the play settings. They are edited through the Plan 6 draft (a `play` field in the draft timing) and written live on Publish.
- **The shared grid.** `ExerciseGrid` (from Plan 1) is the one clock. It gains confirmed tempo marks and helpers for beat times, and the metronome, highway, backing placement, video follow and Studio all read it.
- **Admin workspace.** The graded workspace reuses SyncPanel in a new `graded` mode. The bar lines are computed from the grid plus bar 1 and can't be dragged. Dragging the exercise block moves bar 1, with snapping to hits. Auto-align and a "k/n notes on a hit" readout sit alongside.
- **Student preview.** The real student game runs in a Studio dialog.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (additive migration), Web Audio, vitest (+ jsdom; no testing-library).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` §8 "Exercise and Jam (graded)". The roadmap entry is "Plan 5".

## Global Constraints

- **Git rules:**
  - Never run `git stash` in any form. Use `git show HEAD:<path>` to compare.
  - Stage only your files, by path.
  - Commit messages are imperative with no prefix, then a blank line and the `Co-Authored-By` trailer.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**'`. Typecheck: `npx tsc --noEmit -p .`. Lint: `npx eslint --no-cache <files>`, with no new issues against the base (compare from stdin).
  - Component tests use `// @vitest-environment jsdom` plus `createRoot` and `act`.
- **Migration `044_play_settings.sql`** (additive only):
  - `play_bar1_seconds numeric`, nullable.
  - `play_count_in_bars smallint not null default 1 check (play_count_in_bars between 1 and 2)`.
  - `play_preroll boolean not null default true`.
  - **Backfill** `play_bar1_seconds` from the first waypoint (the lowest `musical_position_qn`) of each item's `exercise_time_map_id`. Model it on 042's anchor backfill.
  - Keep `exercise_time_map_id` for now.
- **Draft timing for graded owners (EXERCISE and JAM_SESSION):**
  - Optional `play: { bar1Seconds: number | null; countInBars: 1 | 2; preroll: boolean }`.
  - Publish writes the three columns (only when they changed). It never publishes a time map for a graded owner.
- **The clock:**
  - bar t (media seconds) = `bar1 + grid.measureStartSec[i]`.
  - A bar's length = `grid.measureStartQN` span × `grid.secPerQN[i]`.
  - Tempo marks (`Measure.tempoChange`) count only when `score.tempoMarksConfirmed === true`. Otherwise every bar uses `initialTempo`, as today.
- **Count-in:**
  - Length = `countInBars` × bar 1's beats (the meter numerator), at bar 1's beat length.
  - The display counts DOWN: N … 1.
  - The count-in clicks are always audible (as today).
- **Pre-roll:**
  - On: the video starts at `bar1 − countInSeconds`, clamped to the trim-in point. If that clamp cuts off some pre-roll, the video waits and starts when the clock reaches the clamped point.
  - Off: the video waits at bar 1 and starts when the count-in ends.
- **Following the clock:**
  - Expected media time = `bar1 + (engineSeconds mod loopSeconds)`.
  - Each frame, `rate = clamp(1 + (expected − actual) × 0.5, 0.97, 1.03)` times the student's speed.
  - It hard-seeks only when the drift exceeds 0.5 s, or at a loop wrap.
  - The trim is a clamp.
- **Backing tracks** are placed from `position_qn` through the grid: engine seconds = `gridSecondsAtQN(position_qn)`. The trims stay as they are. If `position_qn` is null, fall back to today's `timelineToEngineSeconds`.
- **The graded Studio:**
  - Bar lines can't be dragged.
  - Dragging the exercise block (the sections lane) or the waveform shifts bar 1. It snaps the first graded onset onto a hit within 8 px (`SNAP_PX`), and ⌘ skips the snap.
  - Auto-align picks the bar 1 that puts the most graded onsets within 30 ms of a hit (one-to-one), searching ±2 s around the current bar 1, then the nearest to the current value.
- **Exact copy:**
  - Context bar: `Auto-align`, `Count-in` with a segmented `1 bar` / `2 bars`, and a `Pre-roll video` toggle.
  - Readout: `<k>/<n> notes on a hit`.
  - Preview chip: `Student preview`.
  - Copy notes: the menu button `Copy notes from a Watch section`, with a confirm `Replace the exercise notes with "<section title>"? You can undo this.`
  - Studio notice when there are no hits: `Re-analyze audio to find the hits`, reusing P4a's.
- **Jam sessions:**
  - The media is `class_items.audio_url`, and the whole score is graded.
  - They use the same `play_*` columns.
  - Their Studio page is the graded workspace.

## Decisions this plan makes

1. **Graded owners stop publishing time maps.** Bar 1 replaces the exercise drag map for placing the media. `exercise_time_map_id` stays read-only for older code, and the backfill preserves the placement of live exercises.
2. **The Studio preview is the real student game** (`ScoreExerciseGame` in its existing `preview` mode) in a dialog, fed the draft's score and play settings. There is no separate simulated preview, so the preview can never drift from what students see.
3. **The 3-2-1.** The student count-in counts down in the existing highway count-in display. No new overlay component is added.
4. **Jam completion** keeps the current `['media']` requirement. Grading is shown, but it doesn't gate completion.
5. **The metronome anchor** (P2/P6) doesn't apply to graded parts: the graded click comes from the grid. The anchor columns are left untouched.

## Review Focus

1. **Existing live exercises play the same after the backfill.** The same placement for bar 1 and the same click tempo. The one difference: the count-in counts down, and pre-roll is on by default. Test: Task 1 (backfill SQL, read by a test) and Task 4 (the follow maths reproduces the old placement when bar 1 equals the old first waypoint).
2. **A score with no confirmed tempo marks** keeps a uniform tempo: the grid equals today's grid. Test: Task 2.
3. **Pre-roll near the start of the video.** When `bar1 − countIn` < trim-in, the video starts at trim-in, late, instead of seeking before the file. Test: Task 4.
4. **Loops.** At a loop wrap the video seeks back to bar 1 once, with no rate spike. Test: Task 4.
5. **Only on publish.** A jam session or exercise with an unpublished `play` change shows as unpublished, and publishing writes only the columns. Test: Task 5.

---

### Task 1: The play settings migration and data plumbing

**Files:**
- Create: `supabase/migrations/044_play_settings.sql`
- Modify: `types/database.ts`: add the three `class_items` columns.
- Modify: `app/actions/playsense-studio.ts`:
  - `ExerciseMedia` gains `play: { bar1Seconds: number | null; countInBars: 1 | 2; preroll: boolean }`.
  - `getExerciseMedia` selects the new columns. For a `JAM_SESSION` item it uses `audio_url` as the media URL and skips the exercise video columns.
  - Add `setPlaySettings({ classItemId, bar1Seconds, countInBars, preroll })`, admin-only, which updates the three columns.
- Tests: `lib/playsense-studio/drafts/__tests__/migration-044.test.ts`, which reads the SQL: the column definitions, the check constraint, and a backfill that uses the lowest `musical_position_qn`. Also an action test for `setPlaySettings` (admin check, and it validates 1..2), using the fake Supabase from `lib/playsense-studio/drafts/__tests__/fake-supabase.ts`.

- [ ] **Step 1:** Write the failing tests.
- [ ] **Step 2:** Write the migration:

```sql
-- 044_play_settings.sql — Studio rework P5: graded play-along placement.
ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS play_bar1_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS play_count_in_bars SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS play_preroll BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE class_items DROP CONSTRAINT IF EXISTS class_items_play_count_in_valid;
ALTER TABLE class_items ADD CONSTRAINT class_items_play_count_in_valid
  CHECK (play_count_in_bars BETWEEN 1 AND 2);

-- Bar 1 of existing play-alongs: the first waypoint of their exercise time map.
UPDATE class_items ci
SET play_bar1_seconds = w.video_time_seconds
FROM score_time_waypoints w
WHERE ci.exercise_time_map_id IS NOT NULL
  AND ci.play_bar1_seconds IS NULL
  AND w.time_map_id = ci.exercise_time_map_id
  AND w.musical_position_qn = (
    SELECT MIN(w2.musical_position_qn) FROM score_time_waypoints w2 WHERE w2.time_map_id = ci.exercise_time_map_id
  );
```

- [ ] **Step 3:** Implement the types, `getExerciseMedia` and `setPlaySettings`. Run the tests and tsc.
- [ ] **Step 4: Commit:** `Add play-along settings to class items`.

**The controller applies the migration** to the hosted database after this task passes review. The user authorised additive migrations for this run (2026-09-26 directive). Implementers never touch the database.

---

### Task 2: The grid learns tempo marks and gets helpers

**Files:**
- Modify: `lib/play-sense/score-to-exercise.ts`: `buildExerciseGrid` honours `m.tempoChange` (quarter-note BPM from that measure on) only when `score.tempoMarksConfirmed === true`. Update its doc comment.
- Modify: `lib/play-sense/exercise-utils.ts`: `beatToTimestamp`'s grid lookup maps `event.measure` to an index safely, clamping to a valid index instead of reading `undefined` when numbers don't match index + 1.
- Create: `lib/play-sense/grid.ts`:

```ts
import type { ExerciseGrid } from './types'
export function gridLoopSeconds(g: ExerciseGrid): number            // g.measureStartSec[last]
export function gridSecondsAtQN(g: ExerciseGrid, qn: number): number // piecewise by measure; beyond the end extrapolates with the last secPerQN
export function gridQNAtSeconds(g: ExerciseGrid, s: number): number  // inverse
/** Every beat of one pass: seconds from bar 1, whether it's a downbeat, its measure index. */
export function gridBeats(g: ExerciseGrid): Array<{ seconds: number; downbeat: boolean; measure: number }>
/** Count-in beats before bar 1: bars × bar 1's numerator, spaced at bar 1's beat length; seconds are NEGATIVE (before bar 1). */
export function gridCountIn(g: ExerciseGrid, bars: 1 | 2, beatsPerBar: number): number[]
```

- Tests: `lib/play-sense/__tests__/grid.test.ts` and extend `exercise-grid.test.ts`:
  - **Unconfirmed:** a score with `tempoChange` values but `tempoMarksConfirmed` unset produces the same grid as before (a uniform `secPerQN`).
  - **Confirmed:** 4/4 at 120 with a tempo change to 60 at bar 3 gives bar 3 starting at 4 s, and bar 4 at 8 s.
  - **Round trip:** `gridSecondsAtQN` / `gridQNAtSeconds` invert each other across a tempo change.
  - **`gridBeats`** for [4/4, 6/8] gives 4 beats, then 6 eighth-beats. Downbeats are at the measure starts.
  - **`gridCountIn(g, 2, 4)`** at 120 bpm gives `[-4, -3.5, …, -0.5]`.
  - **Beyond the end:** `beatToTimestamp` with a measure number beyond the grid doesn't return NaN.

- [ ] Steps: failing tests, then implement, then run the full suite and tsc. **Commit:** `Honour confirmed tempo marks in the grid and add grid helpers`.

---

### Task 3: The metronome, count-in and highway follow the grid

**Files:**
- Modify: `hooks/use-metronome.ts`:
  - Add an optional `grid?: ExerciseGrid` and `countInBars?: 1 | 2`.
  - With a grid, the count-in uses `gridCountIn`, and exercise clicks are scheduled from `gridBeats(grid)`, looping by `gridLoopSeconds`. The visual current beat follows the grid.
  - Without a grid, behaviour is unchanged.
- Modify: `hooks/use-exercise-session.ts`:
  - Pass `grid` and `countInBars` (a new option on the session, default 1).
  - `countInDuration` comes from the grid's count-in.
  - `countdownBeat` counts DOWN (N … 1) during the count-in.
- Modify: `components/play-sense/stage-highway/StageRenderer.ts`: beat-line positions come from `gridBeats`, with bright lines on downbeats, when the exercise has a grid. Otherwise the uniform lines stay as today.
- Tests:
  - `hooks/__tests__/use-metronome-grid.test.ts`: fake AudioContext and timers. Record the scheduled click times. Grid [4/4 at 120, then 4/4 at 60 (confirmed)] gives clicks at 0, .5, 1, 1.5, 2, 3, 4, 5 s after the exercise starts, with downbeats at 0 and 2. The count-in of 2 bars schedules 8 clicks before it.
  - A test that the session's count-in display runs 4, 3, 2, 1: extract a pure helper `countdownFor(elapsed, countInBeats, beatSec)`.
  - A pure `beatLinePositions(grid, windowStart, windowEnd)` from the renderer, tested.

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Schedule the metronome, count-in and beat lines from the grid`.

---

### Task 4: The student game follows the clock

**Files:**
- Create: `lib/play-sense/play-follow.ts`, pure:

```ts
export interface PlayMedia { bar1: number; trimIn: number; trimOut: number | null; countInSeconds: number; preroll: boolean; loopSeconds: number }
/** Media time the video should show at engine time e (e < 0 during the count-in). null = hold paused. */
export function expectedMediaTime(m: PlayMedia, e: number): { media: number; playing: boolean }
/** Rate for the element: userSpeed × clamp(1 + (expected − actual) × 0.5, 0.97, 1.03); returns { rate, seekTo } where seekTo is set when |drift| > 0.5 s. */
export function followRate(expected: number, actual: number, userSpeed: number): { rate: number; seekTo: number | null }
```

- Rules for `expectedMediaTime`:
  - **Count-in** (e < 0):
    - With pre-roll, media = `max(trimIn, bar1 + e)` and playing = `bar1 + e >= trimIn`. Before that it holds at trimIn.
    - Without pre-roll, it holds at bar1 (not playing).
  - **After** (e ≥ 0): media = `bar1 + (e mod loopSeconds)`, clamped to [trimIn, trimOut], with playing = true.
- Modify: `components/class-viewer/lesson-viewer/score-exercise-game.tsx`:
  - It gets `play` settings (bar1, countInBars, preroll) through `exerciseVideo`.
  - It replaces the 0.35 s re-seek effect with a rAF loop using `expectedMediaTime` plus `followRate`, and applies the rate and seeks.
  - It passes `countInBars` into the session.
  - It places backing tracks from `positionQn` through `gridSecondsAtQN` when present.
  - When `bar1` is null it falls back to trimIn as bar 1.
- Modify: `components/class-viewer/class-item-renderer.tsx`: pass `media.play` through.
- Tests: `lib/play-sense/__tests__/play-follow.test.ts`:
  - The count-in with pre-roll.
  - The count-in without pre-roll.
  - **Review Focus 3:** a pre-roll clamp at trim-in.
  - **Review Focus 4:** a loop wrap with a single seek.
  - The rate clamp.
  - **Review Focus 1:** when bar1 equals the old first waypoint and the map was uniform, `expectedMediaTime` matches the old `videoMap.toVideoTime` placement within 1 ms.

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Let the play-along follow the exercise clock with a gentle rate trim`.

---

### Task 5: Draft and publish for graded owners

**Files:**
- Modify: `lib/playsense-studio/drafts/timing.ts`: `studioTimingSchema` gains an optional `play` (the zod object with the constraints above).
- Modify: `lib/playsense-studio/drafts/server.ts` `resolveOwner`:
  - EXERCISE **and JAM_SESSION** items return `target: 'graded'`, a new value, with `liveTimeMapId: null` and `anchorKind: null`.
  - `loadLiveContent` fills `timing.play` from the columns.
- Modify: `app/actions/studio-drafts.ts` `publishStudioDraft`:
  - For `target === 'graded'`, skip `publishTimeMap`. Call `setPlaySettings` when `diffParts(...).play` is true. Save the score as usual.
- Modify: `lib/playsense-studio/drafts/changes.ts`: `diffParts` gains `play`, and `summarizeChanges` adds `Play-along timing changed`.
- Modify: `lib/playsense-studio/drafts/seed.ts` `workspaceSeed`: for an exercise or jam, `timing.play` seeds from `exerciseMedia.play`. The waypoints stay empty for graded owners.
- Tests (extend the existing draft tests):
  - publish for a graded owner writes the columns and never calls `publishTimeMap`
  - a play-only change counts as unpublished and publishes
  - the seed picks `play` up
  - `resolveOwner` returns graded for EXERCISE and JAM_SESSION

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Draft and publish the play-along settings for graded parts`.

---

### Task 6: The graded Studio workspace

**Files:**
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - A new mode `'graded'` with props `play`, `onPlayChange(patch)` and `gradedOnsets: number[]` (the graded onsets in seconds from bar 1, from `generateExpectedTimestamps` of the draft score's exercise definition for one loop).
  - In graded mode:
    - The markers are seeded from `buildWaypoints(score, …)` shifted by bar 1, and marker drags are disabled.
    - A sections-lane block, "Exercise", spans bar 1 … bar 1 + loop. Dragging it, or dragging the waveform background, shifts bar 1 by the delta. It snaps with `snapSectionShift(firstOnsetMedia, delta, hits, SNAP_PX/pps)` unless ⌘ is held. It calls `onPlayChange({ bar1Seconds })`.
    - The context bar shows `Auto-align` (disabled without hits, with P4a's title), the `Count-in` 1/2 segmented control, the `Pre-roll video` toggle, and `<k>/<n> notes on a hit`.
    - Flex, Auto-place bars and the anchor are hidden.
- Create: `lib/playsense-studio/auto-align.ts`:

```ts
/** Candidate bar-1 values = h − onset for every (hit h, onset) pair with h within ±2 s of current + onset; score = one-to-one matches within 30 ms; best score, ties → nearest current. null when no candidate matches ≥ 3 onsets. */
export function autoAlign(onsets: number[], hits: number[], current: number): number | null
export function onHitCount(onsets: number[], hits: number[], bar1: number): { k: number; n: number }
```

- Modify: `app/admin/playsense-studio/[classItemId]/studio-workspace.tsx`: in exercise mode, the "Sync video" stage uses SyncPanel `mode="graded"`, wired to `draft.timing.play` via `draft.setTiming({ play })`. The backing lanes compute `position_qn` from the grid in graded mode (`gridQNAtSeconds(grid, media − bar1)`) instead of the drag map. Pass a function prop, e.g. `mediaToQN` to BackingLanesPanel.
- Tests:
  - `lib/playsense-studio/__tests__/auto-align.test.ts`:
    - onsets [0, .5, 1, 1.5] against hits [3.2, 3.7, 4.2, 4.7] with current 3.0 gives 3.2
    - noise-only gives null
    - `onHitCount` counts correctly
  - A BackingLanesPanel test that `mediaToQN` is used for `position_qn` when given.

- [ ] Steps: failing tests, then implement, then the full suite, tsc and eslint. **Commit:** `Add the graded Studio view: bar 1 drag, Auto-align, count-in and pre-roll`.

---

### Task 7: The Student preview, and copying notes from a Watch section

**Files:**
- Create: `components/playsense-studio/studio/student-preview-dialog.tsx`:
  - A modal (a `role="dialog"` overlay, closed by Esc and the close button) rendering `ScoreExerciseGame` in `preview` mode.
  - It takes the exercise built from the draft score (`scoreToExerciseDefinition`), `exerciseVideo` built from the current media and `draft.timing.play`, and the backing tracks.
- Modify: `studio-workspace.tsx`: a `Student preview` chip in the app bar for exercise and jam, which opens the dialog.
- Create: `lib/playsense-studio/copy-section.ts`: `copySectionScore(source: ScoreDocument, target: ScoreDocument): ScoreDocument`:
  - it takes the source's track 0 measures and spans
  - it strips `repeat`, `repeatStart`, `repeatEnd` and `volta` from every measure
  - it gives fresh ids via `reidMeasures`
  - it keeps the target's title, instrument track meta and `initialTempo`, and takes the source's `initialTimeSignature` and `initialKeyFifths`
  - it prunes the spans
- Modify: `exercise-studio.tsx` → `StudioWorkspace`: pass the Watch sections (already in state) as `copySources: Array<{ id; title; score }>` (use the draft score when a draft exists).
  - The `Copy notes from a Watch section` menu, shown in the exercise score stage, lists them.
  - The confirm text is from Global Constraints.
  - Applying it dispatches `apply-structural-score` (undoable) with `copySectionScore(source, state.score)`.
- Tests:
  - `copy-section.test.ts`: the repeat tags are gone, the ids are fresh and unique, the spans point into the copy, and the target's title is kept.
  - A dialog test: it renders the game stub with the exercise and play props, and closes on Esc.

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Preview the exercise as a student and copy notes from a Watch section`.

---

### Task 8: Jam sessions in the Studio and graded for students

**Files:**
- Modify: `app/admin/playsense-studio/[classItemId]/page.tsx`:
  - `JAM_SESSION` routes to the graded workspace: `StudioWorkspace mode="exercise"` with owner classItem. `exerciseMedia` comes from `getExerciseMedia`, which uses `audio_url` for jams (Task 1).
  - The drafts load for the `exercise` owner kind.
  - With no score, it shows `StudioSetup`.
- Modify: `components/admin/course-studio/item-editor.tsx`: the JAM_SESSION editor also renders `PlaysenseStudioScoreAttach` (the Studio link), as EXERCISE does.
- Modify: `studio-workspace.tsx`:
  - For a jam, the ExerciseMediaPanel's video upload is hidden and replaced by the text `Jam track: set in the course editor`. Backing lanes stay.
  - Add a `jam` flag derived from a new prop `itemType`.
- Modify: `components/class-viewer/class-item-renderer.tsx`: JAM_SESSION with a score renders `ScoreExerciseGame` (graded), with `exerciseVideo` from `getExerciseMedia` (the jam audio as media). Without a score it keeps the existing audio or player path.
- Tests:
  - a page-routing unit (if the page is testable; otherwise a small pure `studioModeFor(itemType)` helper with tests)
  - the renderer picks the game for a jam with a score (mock heavy children, as existing renderer tests do, if any; otherwise test a pure selector)

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Give jam sessions a graded Studio and a graded student view`.

---

### Task 9: Roadmap and browser checklist

- [ ] **Roadmap:** add "### Plan 5 — done <date>" with what shipped, the rulings and the follow-ups. Commit.
- [ ] **Browser checklist** for the user:
  1. **Live exercise.** Open a live exercise as a student. It counts in 4-3-2-1, and the video pre-rolls into bar 1 and stays in step, with no visible re-seek jumps. Set 2 bars and pre-roll off in the Studio, publish, and check again.
  2. **Studio.**
     - Drag the Exercise block: it snaps its first note to a hit.
     - Auto-align lands the notes, and the readout shows k/n.
     - Student preview plays exactly what students get.
  3. **Tempo marks.** On a score with a confirmed tempo change, the click and the highway slow down at that bar.
  4. **Copy notes** from a Watch section into the exercise, then undo.
  5. **Jam session.** The course editor links to the Studio, the jam is graded for the student, and the placement comes from bar 1.
