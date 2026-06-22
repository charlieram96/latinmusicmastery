# Quiz UI Redesign — Design

**Date:** 2026-06-22
**Component:** `components/class-viewer/lesson-viewer/quiz-runner.tsx`
**Status:** Approved (pending spec review)

## Goal

Completely redesign the in-course quiz UI so it looks much nicer and more
intuitive. Vibrant and playful (Duolingo/Kahoot energy) while staying on-brand
with the app's warm amber/Latin palette. The quiz stays inline as a card in the
lesson flow.

## Locked decisions

- **Scope:** Rethink the experience — not just a re-skin. Focused vertical
  stage, question-type-specific micro-interactions, animated transitions.
- **Aesthetic:** Vibrant & playful, on-brand amber, works in light + dark.
- **Container:** Stays inline as a single redesigned card in the lesson flow.
- **Feedback timing:** Immediate per question — keep the Check Answer → Next
  flow with per-question feedback.
- **Gamification:** Celebratory animated results screen. **Not** doing: streak
  counter, XP/score-pop, sound/haptics.
- **Keyboard shortcuts:** Yes — `1`–`4`/`A`–`D` to pick, `Enter` to check/next,
  `←`/`→` to navigate.
- **Confetti:** Only on high scores (≥ 80%) at the results screen.

## Hard constraints (must not change)

These keep the component a drop-in replacement for both `Quiz` and `Exercise`:

- **Props unchanged:** `{ classItemId: string; questions: QuizQuestion[]; kind?: 'Quiz' | 'Exercise' }`.
- **Data types unchanged:** `QuizQuestion`, `QuestionType`, all `*Options`
  shapes in `types/modules.ts`.
- **Grading logic unchanged:** the `gradeQuestion` behavior for all 7 question
  types is preserved exactly (multiple_choice, true_false, text_answer, audio,
  fill_in_blank, matching_pairs, ordering_sequence).
- **Completion unchanged:** still calls `markClassItemComplete(classItemId)` once
  the student reaches the end.
- **Stable shuffle** behavior preserved (seeded by question id) for
  matching_pairs right-choices and ordering_sequence seed order.

## Architecture

Rewrite `quiz-runner.tsx` in place as presentation/interaction only. Extract
focused sub-components within the file (or co-located files) to keep each unit
small:

- `QuizRunner` — top-level state machine (index, answers, graded, finished),
  unchanged grading + completion wiring, keyboard handling.
- `ProgressSegments` — segmented top bar (one segment per question; filled =
  answered/graded, current = glowing) + `Question N / total` counter.
- `QuestionStage` — animated question container (framer-motion `AnimatePresence`,
  horizontal slide/fade on next/prev), question text + type badge chip.
- `QuestionInput` (per-type widgets) — see below.
- `FeedbackBanner` — slide-up correct/incorrect banner with icon + explanation.
- `ActionFooter` — Previous (ghost) + morphing primary button
  (Check Answer → Next/Finish).
- `ResultsScreen` — animated score ring, scaled headline, per-question review
  (expandable rows), Try Again.
- `Confetti` — self-contained framer-motion particle burst (no new dependency).

## Visual language

- Amber primary as the energy color. Answer options are large `rounded-2xl`
  tappable tiles with a letter badge (A/B/C/D), hover lift, and a press scale
  on tap.
- Selected = amber ring + tint + filled badge.
- Generous spacing, larger type, soft shadows. Uses existing HSL design tokens
  (`primary`, `card`, `muted`, `border`, success/destructive) so light/dark both
  work. Reuses existing `Card`, `Button`, `Input` primitives where they fit.

## Per-question-type micro-interactions

- **multiple_choice:** lettered tiles (A/B/C/D), single column, hover lift.
- **true_false:** two big side-by-side tiles with ✓ / ✗ icons.
- **fill_in_blank:** render the prose with inline input "chips" sitting in the
  sentence (replacing `{{blank}}` placeholders) instead of a separate
  id-labeled list. Falls back to labeled inputs if a blank isn't found in text.
- **matching_pairs:** left items as cards, right answers via an upgraded,
  color-accented picker (built on the existing `Select`). Same answer shape
  (`Record<left_id, chosen_right_text>`).
- **ordering_sequence:** polished rows with grip handle + number medallion,
  up/down controls, animated reorder via framer `layout`. Same answer shape
  (array of item ids).
- **text_answer / audio:** large focused input with a clear label/placeholder.

## Feedback (immediate, per question)

On Check Answer:
- The chosen tile animates to green (correct) or red (incorrect).
- On a wrong answer, the correct tile also highlights green, and the wrong tile
  gets a gentle shake.
- A `FeedbackBanner` slides up: icon + "Correct!" / "Not quite right" +
  `explanation` (if present).
- The primary button morphs from **Check Answer** into **Next** / **Finish**.
- Inputs become disabled (read-only) once graded, matching current behavior.

## Results screen

- Animated SVG **score ring** that counts up to the percentage.
- Headline scaled to performance: e.g. ≥ 90% "Perfect!" / ≥ 70% "Great work!" /
  else "Keep practicing".
- **Confetti burst** only when score ≥ 80%.
- Per-question review list: ✓/✗ per row; tapping a row expands the question text,
  the correct answer, and the explanation.
- **Try Again** button (resets state, same as current `handleRestart`).

## Accessibility & input

- Option tiles are real focusable buttons with `aria-pressed` / selected state.
- Keyboard: `1`–`4` / `A`–`D` select an option, `Enter` checks then advances,
  `←` / `→` navigate previous/next (where allowed).
- Respects `prefers-reduced-motion`: animations degrade to instant/none.

## Tech

- Use `framer-motion` (v12, already installed) for transitions, layout
  animations, feedback, confetti, score-ring count-up.
- No new dependencies. No backend/schema/server-action changes.

## Out of scope

- The score-driven exercise *play* component (staff / rhythm highway) — only the
  comprehension `QuizRunner` is redesigned.
- Admin quiz authoring UI.
- Any change to `quiz_questions` data model or grading rules.

## Testing / verification

- Manually exercise each of the 7 question types (correct + incorrect paths),
  the results screen at varying scores (incl. ≥ 80% confetti), Try Again,
  keyboard navigation, and light/dark themes.
- Confirm `markClassItemComplete` still fires at finish.
- Confirm it renders correctly for both `kind="Quiz"` and `kind="Exercise"`.
