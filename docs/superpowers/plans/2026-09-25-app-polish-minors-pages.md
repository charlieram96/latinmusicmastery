# App Polish — deferred minors: course detail, path strip, dashboard home

> Executed inline with superpowers:executing-plans + TDD. Branch `feat/polish-m-pages` from `playsense` 0bed137.
> Sources: deferred minors of `2026-09-25-app-polish-p5-course.md` and `2026-09-25-app-polish-p6-dashboard.md`.
> Spec: `docs/superpowers/specs/2026-09-25-app-polish-design.md` (binding).

## Global Constraints
- Every user-facing string through `t()`, keys in both `locales/en.json` and `locales/es.json`, added by a small node
  script that touches only `dashboard.pages.course.*` / `dashboard.pages.home.*`.
- No `duration-[var(--x)]` / `ease-[var(--x)]`; decorative motion behind `motion-safe:`.
- Do not touch lesson-mode, split-workspace, staff renderer, exercise-score, score-exercise-game.
- Temporary preview pages for screenshots are deleted before committing.

## Review Focus
- Empty (0-item) lessons: never current, never block "finished", never a checkpoint blocker; path and syllabus agree.
- Path node hrefs for non-students match syllabus rows (free lessons open, others go to subscribe).
- PathStrip keyboard/touch modality, Escape, and the compact portal card (position, close on scroll, focus).
- Poster grid: exactly 1/2/4 columns (never 3) and the CSS actually emitted.
- Weekly goal text above the goal in both StreakCard and GreetingRow.

## Tasks

### Task 1 — Path nodes: one source of truth, empty lessons, href rule (C2, C3)
`lib/courses/path-nodes.ts`: a lesson with `totalItems === 0` is *empty*: never picked as the fallback current lesson,
ignored when deciding a finished course and a done checkpoint (a module of only empty lessons stays upcoming).
The fallback current lesson is the first non-empty unfinished lesson (the same rule as the server's `nextClassId`).
Input classes may carry `href`, used instead of `classHref`.
Tests (`lib/courses/__tests__/path-nodes.test.ts`): empty lesson before the next unfinished one is not current;
course whose non-empty lessons are all done has no current lesson and done checkpoints; explicit `href` wins.

### Task 2 — Course page (C1, C2, C3, C4, C7)
`course-detail-view.tsx`:
- C1: finished (`totalItems > 0 && completedItems >= totalItems`) shows a chunky "Review course" link to lesson 1 and
  the progress line says "Completed"; "Coming soon" stays only for a course with nothing to open.
- C2/C3: one `lessonHref(cls)` used by syllabus rows and path nodes; path gets `nextClassId`.
- C4: `MobileCourseBar` gets `stacked` (action on its own full-width row) used when locked; page bottom padding grows.
- C7: Show all button gets `aria-controls` pointing at the module's lesson list (always rendered, `hidden` when empty).
Tests: `course-detail-view.test.tsx`, `mobile-course-bar.test.tsx`.

### Task 3 — Syllabus window keeps 5 rows at module edges (C9)
`syllabusWindow` shifts the window inside the module so it shows `2*radius+1` rows when the module has that many.
Tests: `syllabus-window.test.ts` (first, last, middle, short module).

### Task 4 — PathStrip (C5, C6, C8, C10)
- C5: Escape closes hover/focus cards too (document keydown while any card is open).
- C6: any keydown on the document resets the touch modality, so Tab focus shows cards again after a touch.
- C8: with `showArrows`, the card's right edge is clamped clear of the arrow pair.
- C10: compact cards render in a portal on `document.body`, `position: fixed` from the node's rect, flipping below the
  node near the top of the viewport; they close on any scroll/resize. They can no longer be clipped by an ancestor.
Tests: `components/course/__tests__/path-strip.test.tsx`.

### Task 5 — Your path card (D1, D2, D3)
- D1: the "Module N · title" line shows on phones on its own line.
- D2: an untitled module shows "Module N" with no separator (new key `moduleOnly`).
- D3: phone slice keeps the gap: when lessons are hidden, 1 before + current + 1 after + gap + checkpoint (5 slots).
Tests: `your-path-card.test.tsx`, `lib/dashboard/__tests__/your-path.test.ts`.

### Task 6 — Recommended posters and section ids (D4, D5, D7)
- D4: the play disc's scale runs only under `motion-safe:`.
- D5: poster grid is 2 columns below an 800px container and 4 at or above it, never 3 (clamp-based track min).
- D7: `SectionHeader` takes `id`; Recommended, Your courses and Feedback pass their `home-*` ids.
Tests: `recommended-section.test.tsx` (+ a tailwind probe for D5), a section-header check.

### Task 7 — Weekly goal above the goal (D6)
Shared `weeklyGoalText(t, done, goal)`: at or below the goal "{done} of {goal} lessons"; above it
"{goal} of {goal} lessons · +{extra} extra". Used by StreakCard and GreetingRow.
Tests: `streak-card.test.tsx`, a GreetingRow test.

### Finish
Temporary preview pages for course page + dashboard home, screenshots desktop/phone × dark/light + reduced motion,
deleted after. Full suite, tsc, eslint, `npm run build`. One fresh opus reviewer on the branch.
