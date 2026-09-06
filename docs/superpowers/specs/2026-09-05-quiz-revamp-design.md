# Quiz Experience Revamp — Design

**Date:** 2026-09-05
**Branch:** `feat/compas`
**Status:** Approved in conversation (pending spec review)
**Prototype of record:** https://claude.ai/code/artifact/e7ae4958-8197-48ba-ae4d-66e374862aba (round 2)
**Supersedes:** the gamification and motion sections of
`docs/superpowers/specs/2026-06-22-quiz-ui-redesign-design.md`. That spec's
hard constraints on props, grading, completion and stable shuffles still hold.

## Goal

Make the in-lesson quiz feel like part of the lesson rather than a form at
the end of it: a focused question stage with a question map on wide screens,
Duolingo-style feedback (chime, pop, small burst, colored Continue) on the
app's warm palette, a results screen that uses wide screens, a drag-and-drop
question that can never outgrow the viewport, and an admin builder where the
background is composed from a color plus positioned image layers and target
boxes are drawn with handles instead of typed percentages.

## Decisions (locked by the user on 2026-09-05)

| Topic | Decision |
|---|---|
| Layout mode | **Focus stage** by default; **Exam sheet** available per quiz via a Course Studio setting. Paged pairs dropped. |
| Question types | All nine redesigns from the prototype's section 2 approved as-is. |
| Transition | **Rise** (fade + 10px lift), direction-neutral. |
| Tone | **Playful**: per-question sound and small burst on correct, streak chip, colored Continue button, fanfare and confetti at results. Visual ground stays the app's calm dark/light tokens. |
| Results | One responsive component: **report card** (two columns) at ≥ 960px container width, **hero ring** below that. |
| Attempts / best score | Follow-up, not this round. UI leaves room for it (no placeholder shipped). |
| Drag-and-drop data | New `background` composition object; **migrate every existing `piece_placement` row** to it. |
| Builder location | **Full-width dialog** opened from the question form, not the 660px studio drawer. |
| Editor extras | Drag-to-reorder questions and a per-question student preview with EN/ES toggle. |

## Hard constraints (unchanged from the June spec)

- `QuizRunner` props stay `{ classItemId: string; questions: QuizQuestion[]; kind?: 'Quiz' | 'Exercise' }`,
  plus two new optional props: `settings?: QuizSettings` (see Data) and
  `nextHref?: string | null` (see Results).
- `lib/quiz/grading.ts` behavior is unchanged for every type. Piece
  placement geometry stays in percent of the composition, so `isPieceCorrect`
  is untouched.
- `markClassItemComplete(classItemId)` is still called once when the results
  screen is reached, in both modes, regardless of score.
- Stable seeded shuffles for `matching_pairs` right column and
  `ordering_sequence` initial order are preserved.
- `options_es` contract (`lib/quiz/options-es.ts`): entry ids in the Spanish
  overlay must equal the English ids; the new builder writes labels through
  `patchLocalizedEntry` / `pruneLocalizedEntries` exactly as today.
- Every user-visible string goes through `useTranslation()` with keys under
  `dashboard.classViewer.quiz.*` in both `locales/en.json` and `locales/es.json`.
  A test asserts that every `t('…')` key used in `components/class-viewer/lesson-viewer/quiz*/**`
  resolves to a string in both dictionaries (this is the class of bug behind
  the "Try again" regression fixed in `2cf6f21`).
- The legacy `components/exercise-quiz.tsx` / `app/exercises/[exerciseId]`
  path is out of scope and untouched.

## Architecture

### Student side — `components/class-viewer/lesson-viewer/quiz/`

`quiz-runner.tsx` becomes a thin shell: it picks the mode from `settings.mode`
(`'focus'` default, `'sheet'`), owns the engine, routes to results, and calls
completion. Everything else is a focused component:

| File | Responsibility |
|---|---|
| `use-quiz-engine.ts` (in `hooks/`) | React hook over a pure reducer in `lib/quiz/engine.ts`: `answers`, `graded`, `streak`, `setAnswer`, `check(id)`, `checkMany(ids)`, `reset()`. The reducer is unit-tested; the hook is a thin wrapper. |
| `focus-stage.tsx` | Header (overline `Quiz · course`, title, `StreakChip`, `ProgressSegments`), the question panel with the rise transition, footer (Previous · keyboard hint · Check / Continue), and the `QuestionMap` rail at ≥ 1000px container width. Existing hotkeys (1–9 / a–h, T / F, Enter, ← →) move here. |
| `exam-sheet.tsx` | All questions on one sheet; 2 columns at ≥ 1180px with `matching_pairs`, `ordering_sequence`, `fill_in_blank`, `audio_choice`, `piece_placement` spanning both. Sticky rail: answered ring, jump grid, Submit all (allowed with unanswered questions, count shown). After submit: cards show outcome, `FeedbackBanner` inline, All / Missed filter, rail shows score + Continue + Try again. |
| `question-map.tsx` | Numbered list of questions with outcome state and type icon; click jumps. Hidden below 1000px. |
| `progress-segments.tsx` | Keeps outcome color per segment (success / primary for partial / terracotta), current segment at 40% primary. |
| `type-chip.tsx` | Type label + lucide icon, keys `quiz.types.*` (existing). |
| `question-input.tsx` | Unchanged switch; per-type inputs move to their own files below. |
| `option-tile.tsx` | States `idle · selected · correct · wrong · reveal · dim`. Letter badge becomes ✓ / ✕ when graded; keyboard hint `kbd` on hover; `Burst` rendered inside on `correct`. Drives multiple choice, true/false (`big` variant, T / F keys) and audio choice. |
| `audio-prompt.tsx` | Replaces the bare `<audio controls>`: round play/pause button, animated level bars while playing, duration. `AudioChoicePlayer` for `optionMode: 'audio'` options is kept. |
| `short-answer-input.tsx` | `text_answer` and `audio` (with `AudioPrompt` on top). Graded state icon inside the field; on miss, "Accepted answers: …" (first two). |
| `fill-blank-input.tsx` | Inline pill inputs sized `max(answer.length + 3, 7)ch`; wrong word struck through with the correct word under it. Falls back to labeled inputs if a `{{id}}` is missing from the text (existing behavior). |
| `matching-input.tsx` | Two columns; tap left then right to connect; SVG connector lines measured from port elements with a `ResizeObserver`; graded lines colored by outcome. Below 560px container width: stacked rows with tap-to-pick chips (same value shape). |
| `ordering-input.tsx` | dnd-kit sortable (`PointerSensor` distance 8 + `KeyboardSensor`, `verticalListSortingStrategy`, `arrayMove`) with a grip handle; up/down buttons remain for keyboard and as a fallback. Graded rows show "should be #n". |
| `piece-placement-input.tsx` | Rewritten; see "Drag and drop, student". |
| `feedback-banner.tsx` | Tones `ok · part · bad`; icon tile with `Burst` on `ok`; on `bad` shows "Correct answer: …" via `correctAnswerLabel`; explanation below. `role="status"` so screen readers announce it. |
| `results-screen.tsx` | Responsive report/hero; see "Results". |
| `score-ring.tsx` | Count-up 900ms ease-out; number font size = 26% of ring size, label 7% (fixes the overflow the user reported). |
| `confetti.tsx` | Palette from tokens (gold, primary, success, terracotta, cream), 70 pieces, only at ≥ 80%. |
| `burst.tsx` (new) | 14 squares radiating from the center of its parent, 800ms, palette colors. Skipped under reduced motion. |
| `streak-chip.tsx` (new) | Flame + "n in a row" from 2; gold "On fire" at 4; pops on increment. Session-only state. |
| `quiz.module.css` (new) | Container-query layout rules (`@container` is native CSS; Tailwind v3 has no plugin installed). The quiz root sets `container-type: inline-size`. Tailwind handles everything that is not width-dependent. |

Semantic colors everywhere: `success`, `primary` (partial), `terracotta`.
No raw `green-*` / `red-*` / `amber-*` classes remain in the quiz folder.

#### Feedback and sound (playful tone)

- **Check** (primary) → on correct: tile pops (scale 1 → 1.035 → 1, 500ms
  spring), `okpulse` ring, `Burst` from the tile, `FeedbackBanner` rises,
  chime plays, button becomes **Continue** in `success`. On partial (piece
  placement only): banner in `primary`, two-note "part" sound, button
  `primary`. On wrong: tile shakes (existing keyframes) in `terracotta`, the
  correct tile outlines itself as `reveal` ~380ms later, low thud plays,
  button becomes **Continue** in `terracotta`. Last question: **See results**.
- **Streak:** increments on each fully correct check, resets on any miss.
  Every third hit plays the "streak" sparkle instead of the chime.
- **Results:** fanfare at ≥ 70%, soft two-note at lower scores; headline
  bounces in after the ring; confetti at ≥ 80%.
- **Sound engine:** `lib/quiz/sounds.ts` synthesizes all six cues with Web
  Audio (sine/triangle oscillators with a 12ms attack and exponential decay),
  using the prototype's envelopes:
  - `ok`: 1046.5 Hz (0.30s) + 2093 Hz sparkle, then 1568 Hz (0.38s) + 3136 Hz at +90ms
  - `part`: 880 Hz, 1108.7 Hz at +100ms
  - `bad`: 196 Hz and 174.6 Hz at +110ms, triangle, quieter
  - `streak`: 1318.5 → 1568 → 2093 Hz, 70ms apart
  - `fanfare`: C5 E5 G5 C6 90ms apart, E6 tail
  - `soft`: C5 then E5 at +120ms
  The `AudioContext` is created lazily on the first Check tap (that gesture
  unlocks audio on iOS). No audio assets ship; swapping to files later means
  changing one module.
- **Sound preference:** `hooks/use-quiz-prefs.ts`, localStorage key
  `lmm-quiz-prefs` `{ sound: boolean }`, default `true`. A speaker toggle
  button sits in the quiz header (both modes), `aria-pressed`, keys
  `quiz.sound.on` / `quiz.sound.off`.
- **Reduced motion:** all framer-motion under `MotionConfig reducedMotion="user"`;
  `useReducedMotion()` gates `Burst`, `Confetti`, the tile pop and the
  headline bounce. Sound is not motion and follows only the sound toggle.

#### Results

One `ResultsScreen` with two layouts chosen by container width:

- **Report card (≥ 960px):** left column card (sticky): overline, ring
  (132px), tiered headline (existing `results.*` copy), sub, stat strip
  (correct / partly right / missed), actions stacked: **Continue to next
  part** (primary), **Try again** (outline). Right column: review list with
  every row expanded: "You said" (struck, terracotta) when not fully correct,
  "Answer" (success), explanation. All / Missed filter chips above.
- **Hero ring (< 960px):** ring (156px) centered, headline, sub, stat strip,
  actions row (Try again · Review missed · Continue to next part), then the
  collapsible review list with filters. "Review missed" sets the filter.
- **Continue to next part** needs the next href. `ClassItemRenderer` computes
  it with the same rule `lesson-footer.tsx` uses (`?item=index+1`, else the
  next class, else none) and passes `nextHref` into `QuizRunner`; the button is
  omitted when there is no next part.
- Copy for `piece_placement` in the review list: "n of m pieces in the right
  spot" (new key `results.piecesPlaced`).

### Drag and drop, student

Data (see Data section) is a composition, not one image:

```ts
export interface PiecePlacementOptions {
  background: {
    color: string            // CSS hex
    aspect: number | null    // width / height; null = derive from first layer's natural size
    layers: { id: string; imageUrl: string; x: number; y: number; width: number; height: number; ratio?: number }[]
  }
  pieces: { id: string; label?: string; imageUrl: string; width: number; area: { x: number; y: number; width: number; height: number } }[]
}
```

- **Stage:** `aspect-ratio: aspect`, `width: min(100%, calc(62vh * aspect))`,
  centered, `overflow: hidden`, `touch-action: none`. This is the fix for the
  300vh stage: height is bounded by the viewport, width follows. When
  `aspect` is `null`, the component measures the first layer image's natural
  ratio on load (16/10 until then).
- **Layers:** color fill, then each layer absolutely positioned by percent.
- **Layout:** stage left, tray right (250px, sticky) at ≥ 760px container
  width; below that the tray becomes a horizontal snap-scroll strip under the
  stage. Tray thumbnails are a fixed 56×48; only on-stage pieces scale with
  the stage (`width: piece.width%`).
- **Drag:** pointer events with pointer capture; a fixed-position ghost sized
  to the on-stage width follows the pointer; release inside the stage sets the
  center in percent, release outside returns the piece to the tray. "n of m
  placed" counter; hint overlay until the first piece lands.
- **Graded:** correct pieces get a `success` outline, wrong a `terracotta`
  outline, unplaced tray items are marked; each missed or unplaced target is
  revealed as a dashed `success` box with its label. Partial credit is
  unchanged.
- `lib/quiz/composition.ts` (new, pure): `readComposition(options, imageUrl)`
  returns a normalized `background` for any row, treating a missing
  `background` plus legacy `image_url` as one full-bleed layer. Both the
  student input and the builder read through it, so nothing breaks for a row
  created between deploy and migration.
- Known limitation, out of scope: placement is pointer-only. A keyboard
  placement mode is a follow-up.

### Drag and drop, builder (admin)

Replaces `components/admin/piece-placement-builder.tsx` with
`components/admin/piece-placement/`:

| File | Responsibility |
|---|---|
| `builder-dialog.tsx` | Radix `Dialog` (`components/ui/dialog.tsx`) at `w-[96vw] max-w-[1200px] h-[90vh]`, opened by an **Open builder** button in the question form. Toolbar: Design / Preview toggle, Snap, Grid, Done. Layout: canvas left, 300px inspector right (stacked below 900px). |
| `composition-canvas.tsx` | Renders the composition at `aspect`; layers are draggable and resizable (corner handles keep `ratio`, edge handles are free); target boxes are draggable with 8 handles and a label tag; the faded piece ghost is centered in its box with a gold size handle that sets `piece.width`; click on empty canvas centers the selected piece's box there (existing behavior kept). Optional 5% grid overlay. |
| `transform-box.tsx` + `lib/quiz/transform.ts` | The handle set and the pure move/resize/snap math (percent space, clamp 0–100, min 2%, snap 2.5%, ratio lock on corners). Pointer capture per the pattern in `components/playsense-studio/studio/editable-measure-strip.tsx:335-381`. |
| `inspector-background.tsx` | Canvas shape presets (16:9, 16:10, 4:3, 1:1), color swatches + hex input, layer list back→front with reorder and delete, **Add image layer** (uses `QuizMediaUpload kind="image"`; on upload the natural size is read to set `ratio` and an initial 30%-wide centered box). |
| `inspector-pieces.tsx` | Piece rows: thumbnail, label, Spanish label (writes `options_es` through `patchLocalizedEntry`), replace image, delete, **Add piece**. Selected row shows a collapsible "Precise values" with X / Y / W / H / Size at step 0.1 (the current `Math.round` is removed). |
| Preview | Renders the real `PiecePlacementInput` with local state plus Check / Reset, so the admin sees exactly what students see. |

Saving goes through the same `onChange({ options, options_es, image_url: null })`
callback into `quiz-questions-editor.tsx`'s debounced autosave; Done closes
the dialog. A "What gets saved" disclosure showing the live JSON is kept from
the prototype because it doubles as documentation for content authors.

### Editor extras — `components/admin/quiz-questions-editor.tsx` and `item-editor.tsx`

- Question rows become a dnd-kit sortable list (same sensor setup as
  `course-studio/class-canvas.tsx`, plus `KeyboardSensor`), calling the
  existing `reorderQuizQuestions` action. The ↑/↓ buttons are removed.
- Each row gets a **Preview** toggle rendering `QuestionInput` read-only with
  an EN / ES switch; ES uses `mergeLocalizedOptions` from `lib/i18n/localize.ts`
  client-side so the overlay is exercised exactly as on the student side.
- QUIZ items get a **Quiz layout** select (Focus stage / Exam sheet) in
  `item-editor.tsx`, writing `class_items.quiz_settings.mode`. EXERCISE items
  always use focus mode.

## Data and migrations

**Migration `039_quiz_settings_and_piece_composition.sql`:**

1. `ALTER TABLE public.class_items ADD COLUMN IF NOT EXISTS quiz_settings jsonb NOT NULL DEFAULT '{}'::jsonb;`
2. Backfill every `piece_placement` row that has no `background`:
   ```sql
   UPDATE public.quiz_questions
   SET options = jsonb_set(
         coalesce(options, '{"pieces": []}'::jsonb),
         '{background}',
         jsonb_build_object(
           'color', '#0A0A0A',
           'aspect', null,
           'layers', CASE WHEN image_url IS NOT NULL
             THEN jsonb_build_array(jsonb_build_object('id', 'legacy', 'imageUrl', image_url, 'x', 0, 'y', 0, 'width', 100, 'height', 100))
             ELSE '[]'::jsonb END)),
       image_url = NULL
   WHERE question_type = 'piece_placement' AND (options -> 'background') IS NULL;
   ```
   `aspect` is `null` because SQL cannot read image dimensions; the student
   component derives it from the layer at runtime, and the builder writes the
   measured value on the first save of each migrated question. `image_url`
   stays as a column for other uses but is no longer read for `piece_placement`.
3. Regenerate `types/database.ts` after applying (hosted Supabase is the dev
   DB; see the dev-environment notes).

**Types (`types/modules.ts`):** `PiecePlacementOptions` gains `background`;
new `QuizSettings { mode?: 'focus' | 'sheet' }`; `ClassItem` gains
`quiz_settings: QuizSettings`.

**Localization:** `mergeLocalizedOptions` only overlays id-matched string
fields, so `background` is structural and untouched; `options_es` never
carries layers. Covered by a new case in
`lib/i18n/__tests__/localize-quiz-options.test.ts`.

**i18n keys (EN + ES), all under `dashboard.classViewer.quiz`:** `continue`,
`seeResults`, `checkAnswer` (existing), `previous` (reuse existing),
`sound.on`, `sound.off`, `streak.inRow` (`{count}`), `streak.onFire` (`{count}`),
`map.title`, `map.checked`, `sheet.intro` (`{count}`), `sheet.submitAll`,
`sheet.answeredOf` (`{answered}`, `{total}`), `sheet.unanswered` (`{count}`),
`sheet.answered`, `sheet.unansweredLabel`, `sheet.scored` (`{pct}`),
`review.all`, `review.missed` (`{count}`), `review.youSaid`, `review.answer`,
`results.continueNext`, `results.reviewMissed` (`{count}`), `results.stats.correct`,
`results.stats.partly`, `results.stats.missed`, `results.piecesPlaced`
(`{placed}`, `{total}`), `results.nothingMissed`, `feedback.partly` (`{pct}`),
`feedback.acceptedAnswers`, `pieces.title`, `pieces.placedOf`, `pieces.hint`,
`pieces.allPlaced`, `pieces.notPlaced`, `pieces.wasPlaced`,
`ordering.shouldBe` (`{n}`), `audio.play`, `audio.pause`, `audio.playing`.
Admin builder strings stay English like the rest of Course Studio.

## Visual rules

- Cards: `rounded-2xl border border-border bg-card`; the question panel is
  `rounded-[20px]` with one radial gold glow bleeding off the bottom-right
  corner (tuner idiom). Overlines: `font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold`.
- Measures: focus stage column max 820px, question map 280px; exam sheet rail
  260px; results report left column 340px.
- Question text: `font-heading font-extrabold tracking-[-0.015em]`, 20px,
  24px at ≥ 700px container width.
- Tiles: `rounded-[14px] border-[1.5px]`, 36px letter badge `rounded-[10px]`,
  hover lift 1px, `whileTap` scale 0.98.
- Buttons: existing `Button` variants plus a `terracotta` variant added to
  `components/ui/button.tsx` (`bg-terracotta text-white`).
- Numbers `tabular-nums`. Icons lucide, 16px inline, 12–14px in chips.

## Accessibility

- Tiles are `role="radio"` inside `role="radiogroup"`; graded tiles are
  disabled but keep their state text ("Correct", "Answer", "Your pick").
- `FeedbackBanner` is `role="status"`; the results headline is an `h2`.
- Ordering: dnd-kit keyboard sensor plus visible up/down buttons on focus.
- Matching: connector SVG is `aria-hidden`; each right item is a button with
  the left label in its `aria-label` when linked; chips fallback is fully
  keyboard operable.
- Sound toggle and Snap/Grid toggles use `aria-pressed`. Focus rings follow
  the app's `focus-visible:ring-[3px] ring-ring/50` convention.
- Reduced motion honored as described; the wrong-answer reveal delay is kept
  (it is a timing, not an animation).

## Testing

**Unit (vitest):**
- `lib/quiz/__tests__/engine.test.ts`: reducer transitions for answers,
  graded, streak increment/reset, `checkMany`, `reset`.
- `lib/quiz/__tests__/composition.test.ts`: `readComposition` for new shape,
  legacy `image_url` only, neither, and `aspect: null`.
- `lib/quiz/__tests__/transform.test.ts`: move clamp, each of the 8 resize
  handles, ratio lock, snap, min size, size-handle clamp 3–60.
- `lib/quiz/__tests__/sounds.test.ts`: cue table shape and a no-op when
  `AudioContext` is unavailable or the preference is off.
- `lib/i18n/__tests__/quiz-keys.test.ts`: every `t('…')` key in the quiz
  components resolves to a string in EN and ES.
- Existing `grading.test.ts`, `options-es.test.ts`, `localize-quiz-options.test.ts`
  keep passing; the last one gains the `background` structural case.

**Browser verification (Chrome, dev server, hosted dev DB):**
- Both modes at 390 / 1024 / 1440px, dark and light, EN and ES.
- Every question type through idle → answered → check → correct and wrong.
- Sound toggle persists across reloads; no sound with the toggle off; cues
  play on Check, streak, results.
- OS reduce-motion on: no burst, confetti, pop or bounce; ring lands instantly.
- Piece placement: a tall (2:3) composition never exceeds the viewport at
  2560px wide; drop-back to tray; graded reveal; phone strip scrolls.
- Builder dialog: add/move/resize/reorder/delete layers; move/resize target
  boxes; size handle; precise values round-trip; preview grades; autosave
  persists and reload shows the same composition; a migrated legacy question
  opens, shows its old image as a full layer, and saves `aspect`.
- Course Studio: reorder questions by drag and by keyboard; preview EN/ES;
  Quiz layout select switches the student mode.
- Migration applied on the hosted dev DB against at least one real
  `piece_placement` row; `types/database.ts` regenerated.

## Rollout order (each step shippable)

1. Types, `composition.ts`, migration 039, regenerated DB types.
2. Student piece placement rewrite (fixes the 300vh bug on its own).
3. Tiles, feedback, sounds, streak, focus stage, question map, rise transition.
4. Results screen (responsive) and `nextHref` plumbing.
5. Exam sheet + `quiz_settings` select in Course Studio.
6. Builder dialog.
7. Editor extras (sortable rows, preview).
8. i18n sweep, key test, browser verification pass.

## Out of scope / follow-ups

- `quiz_attempts` table, best score, attempt history (user: "yes, as a follow-up").
- Multi-file drop zone for layers and pieces.
- Keyboard placement mode for drag-and-drop.
- Replacing synthesized cues with recorded audio files.
- The legacy `components/exercise-quiz.tsx` surface.
