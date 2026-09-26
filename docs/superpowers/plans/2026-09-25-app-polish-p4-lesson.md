# App Polish — Phase 4: Lesson (L2 immersive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/dashboard/course/[courseId]/class/[classId]` into the L2 immersive lesson: the dashboard chrome steps aside, a slim hover rail, a top bar with parts, a stage that fills the screen, and an action bar that carries the lesson's main action, plus the Ready check, Part done, Quiz and Lesson done states.

**Architecture:**
- `DashboardLayoutClient` checks the pathname with a pure helper and renders the lesson full-bleed (no rail, header or mobile nav). The URL and the layout tree above it do not change.
- A new client `LessonModeShell` lays out `rail | (top bar / stage / action bar)` with a right-hand drawer. It owns a `LessonFrame` context: the action bar's portal host, a claim registry (so a part can take over the bar and tint it), the workspace-tools host, and `advance()` (next part → celebration → next lesson).
- Parts keep their state where it lives today (the exercise session, the quiz engine) and render their bar content through `<LessonAction>`, a portal into the bar. Outside a lesson (previews, admin) `<LessonAction>` renders inline, so nothing else changes.
- The stage is the lesson's scroll container and carries `data-dashboard-main`, so the existing viewport-fitting code (`SplitWorkspace` bleed, `ExerciseModeFrame`) fits the workspace to the stage without API changes.
- New logic is pure and unit-tested: pathname check, progress summary, part progress, bar-by-bar results, ready checks, celebration stats.

**Tech Stack:** Next.js app router, React 19, TypeScript, Tailwind v3.4 + shadcn/ui (cva, Radix Sheet), lucide-react, framer-motion, vitest (`// @vitest-environment jsdom` + `createRoot`/`act` for components).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` §3.1 (lesson mode shell) and §3.3 (states). §3.2 (workspace) shipped in Phase 3; this phase only moves its switcher and keys play per staff layout. Visual reference: the design lab `lab2/src/lesson.js` + `lesson.css` (`lxFrame`, `lxStage`, `lxAction`).

## Global Constraints

- Keep the design language: Studio Amber tokens, Inter + Montserrat (`font-heading`), dark or light only. Colours are `hsl(var(--x))`.
- Game layer = only existing mechanics: streak, weekly goal (lessons against `WEEK_GOAL` = 6, same count as the dashboard `StreakCard`), achievements. No XP, hearts, lives, levels.
- Chunky button only for the main forward action: Your turn, Start playing, Check, Continue, Next lesson. Others keep existing variants (`chunky-ghost` for Again / Finish take / Back to course).
- Motion tokens: `--ease-out`, `--ease-spring`, `--dur-tap` 120ms, `--dur-state` 180ms, `--dur-pop` 320ms, `--dur-turn` 400ms. Never `duration-[var(--x)]` / `ease-[var(--x)]` (emit nothing); use `[transition-duration:var(--x)]` or the named keys.
- `prefers-reduced-motion`: no confetti, shakes, slides, flips or pulses; every looping/decorative animation is `motion-safe:` (or a CSS `@media (prefers-reduced-motion: reduce)` block). No layout depends on an animation.
- Every user-facing string goes through `useTranslation()` / `getServerTranslator()`; new keys live under `dashboard.classViewer.lessonMode.*` in BOTH `locales/en.json` and `locales/es.json`, inserted by a node script touching only that block. Plurals are `xOne` / `x` with `{count}`.
- The lesson URL does not change. No migrations. The only DB reads added are SELECTs the dashboard already runs (`class_item_progress.completed_at`, `play_sense_attempts` via `getUserAttempts`).
- Phase 2's staff renderer and Phase 3's `SplitWorkspace` / `useWorkspaceLayout` APIs stay stable: additive props only, each with a test.
- Phones (`max-width: 767px`): rail hidden (curriculum in the drawer), parts show only the active label, the action bar stacks with the primary full width, the transport shows pause + BPM only, panels and columns stack.
- Worktree `…/.claude/worktrees/polish-p4-lesson`, branch `feat/polish-p4-lesson`, dev server `-p 3014`, CDP 9614. End commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A lesson with a single item, or zero items.** The top bar shows one part (or none) and the action bar still offers the next lesson / back to course; nothing divides by zero. Pinned in Task 2 (`summarize: zero items`) and Task 3 (`one part renders`).
2. **Leaving lesson mode.** Navigating from the lesson to any other `/dashboard/**` route restores the rail and header; module overview (`/module/…`) and course detail are NOT lesson mode, nor is a nested path under `class/[id]`. Pinned in Task 1 (`isLessonModePath` table).
3. **A part that takes over the action bar unmounts** (student navigates to the next part, quiz resets): the bar must fall back to the lesson's own message + Next, and the tint must clear. Pinned in Task 2 (`claim released on unmount`).
4. **Returning student vs first-timer at the Ready check.** Stored audio mode + saved calibration show green checks immediately; no stored mode shows the Sound panel unchecked and Start playing disabled until a mode is picked; MIDI needs no mic or timing. Pinned in Task 9 (`readyChecks` table).
5. **Bar strip with loops, rests and chords.** `loopCount > 1` folds every pass onto the same bar; a bar with no notes is `rest`, not clean; a missing result counts as missed. Pinned in Task 11 (`buildBarResults`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/dashboard/lesson-mode.ts` (+ test) | create | `isLessonModePath(pathname)` |
| `components/dashboard/dashboard-layout-client.tsx` (+ test) | modify | full-bleed lesson mode |
| `app/dashboard/course/[courseId]/class/[classId]/loading.tsx` | modify | lesson-frame skeleton |
| `lib/courses/lesson-progress-summary.ts` (+ test) | create | pure footer/action-bar state (moved out of `LessonFooter`) |
| `components/class-viewer/lesson-viewer/lesson-footer.tsx` | modify | uses the summary (behaviour unchanged) |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-frame.tsx` (+ test) | create | `LessonFrameProvider`, `useLessonFrame`, `LessonAction`, `ActionMessage` |
| `components/playsense-studio/player/workspace-tools-slot.tsx` (+ test) | create | `WorkspaceToolsSlotProvider`, `WorkspaceToolsPortal` |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-action-bar.tsx` (+ test) | create | default message + primary, claim host, tools host, tone |
| `lib/courses/lesson-parts.ts` (+ test) | create | `partLabels`, `partKind`, `partProgress` |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-top-bar.tsx` (+ test) | create | crumb/title, parts, streak, drawer, close |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-rail.tsx` (+ test) | create | 72→300px hover rail, module ring, lesson nodes, settings |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-drawer.tsx` (+ test) | create | About / Comments / Lessons (phones) sheet |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-mode-shell.tsx` (+ test) | create | frame layout, context, celebration switch |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-mode.css` | create | frame, bar tones, phone rules |
| `app/dashboard/course/[courseId]/class/[classId]/page.tsx` | modify | feeds the new shell; about/comments to drawer |
| `components/playsense-studio/player/playsense-studio-player.tsx` | modify | switcher through the tools portal; section chips |
| `components/playsense-studio/player/section-chips.tsx` (+ test) | create | tap-to-loop section chips |
| `components/class-viewer/lesson-viewer/exercise-view.tsx` | modify | Watch action bar (message + Your turn) |
| `components/class-viewer/lesson-viewer/exercise-score.tsx` | modify | optional controlled staff layout |
| `components/class-viewer/lesson-viewer/exercise-mode-frame.tsx` | modify | lesson mode: no toolbar, fitted |
| `lib/play-sense/ready-check.ts` (+ test) | create | `readyChecks()` |
| `components/class-viewer/lesson-viewer/ready-check.tsx` (+ test) | create | three-panel Ready check |
| `components/class-viewer/lesson-viewer/lesson-transport.tsx` (+ test) | create | action-bar transport + Finish take |
| `lib/play-sense/bar-results.ts` (+ test) | create | `buildBarResults`, `summarizeTake`, `bestPreviousAccuracy` |
| `components/class-viewer/lesson-viewer/part-done.tsx` (+ test) | create | ring, heading, comparison, tiles, bar strip |
| `components/class-viewer/lesson-viewer/score-exercise-game.tsx` | modify | ready → play → part done; play key per staff layout |
| `components/class-viewer/lesson-viewer/quiz/focus-stage.tsx`, `quiz-runner.tsx`, `quiz/results-screen.tsx`, `quiz/quiz.module.css` | modify | two columns, Check/Continue + feedback in the bar |
| `lib/dashboard/lesson-celebration.ts` (+ test) | create | streak / week / milestone before→after |
| `components/class-viewer/lesson-viewer/lesson-mode/lesson-done.tsx` (+ test) | create | celebration |
| `components/class-viewer/class-item-renderer.tsx` | modify | `teacherName` pass-through |
| `components/class-viewer/lesson-viewer/score-exercise-game 2.tsx` | delete | unused Finder duplicate |
| `locales/en.json`, `locales/es.json` | modify | `dashboard.classViewer.lessonMode.*` |

---

### Task 1: Lesson-mode shell bypass

**Ruling (spec open question):** pathname check in `DashboardLayoutClient`, not a layout segment. A segment would need `app/dashboard` split into route groups (every dashboard page moves), which collides with the other phases and risks the parent layout's auth/data. The check is one pure function, unit-tested, and the auth + data in `app/dashboard/layout.tsx` keep running for the lesson.

**Files:** Create `lib/dashboard/lesson-mode.ts`, `lib/dashboard/__tests__/lesson-mode.test.ts`, `components/dashboard/__tests__/dashboard-layout-client.test.tsx`. Modify `components/dashboard/dashboard-layout-client.tsx`, `app/dashboard/course/[courseId]/class/[classId]/loading.tsx`.

**Interfaces:** Produces `isLessonModePath(pathname: string | null): boolean`; in lesson mode the shell renders `<div data-dashboard-shell data-lesson-mode>` with only `children` (the lesson provides its own `data-dashboard-main`).

- [ ] **Step 1: failing tests**

```ts
// lib/dashboard/__tests__/lesson-mode.test.ts
import { describe, expect, it } from 'vitest'
import { isLessonModePath } from '../lesson-mode'
describe('isLessonModePath', () => {
  it.each([
    ['/dashboard/course/c1/class/k1', true],
    ['/dashboard/course/c1/class/k1/', true],
    ['/dashboard/course/c1', false],
    ['/dashboard/course/c1/module/m1', false],
    ['/dashboard/course/c1/class', false],
    ['/dashboard/course/c1/class/k1/extra', false],
    ['/dashboard', false],
    ['', false],
    [null, false],
  ])('%s → %s', (path, expected) => expect(isLessonModePath(path)).toBe(expected))
})
```

```tsx
// components/dashboard/__tests__/dashboard-layout-client.test.tsx (jsdom): mock next/navigation usePathname;
// '/dashboard' renders sidebar + header + [data-dashboard-main]; the lesson path renders children only,
// with [data-lesson-mode] and no [data-dashboard-header] / [data-dashboard-navigation].
```

- [ ] **Step 2:** `npx vitest run lib/dashboard/__tests__/lesson-mode.test.ts components/dashboard/__tests__/dashboard-layout-client.test.tsx` → FAIL (module missing).
- [ ] **Step 3: implement**

```ts
// lib/dashboard/lesson-mode.ts
/** The lesson player takes the whole screen: no dashboard rail, header or tab bar. */
const LESSON_PATH = /^\/dashboard\/course\/[^/]+\/class\/[^/]+\/?$/
export function isLessonModePath(pathname: string | null | undefined): boolean {
  return !!pathname && LESSON_PATH.test(pathname)
}
```

`DashboardLayoutClient`: `const lessonMode = isLessonModePath(usePathname())`; when true return
`<div data-dashboard-shell data-lesson-mode className="h-dvh w-full overflow-hidden bg-background">{children}</div>`.
`loading.tsx` becomes a lesson-frame skeleton (72px rail column on md+, top bar, stage block, action bar) with `motion-safe:animate-pulse`.
- [ ] **Step 4:** tests PASS; `npx tsc --noEmit -p .`.
- [ ] **Step 5:** commit "Render the lesson route full-bleed without the dashboard rail and header".

### Task 2: Lesson frame context, progress summary, action bar

**Files:** Create `lib/courses/lesson-progress-summary.ts` (+ `lib/courses/__tests__/lesson-progress-summary.test.ts`), `components/class-viewer/lesson-viewer/lesson-mode/lesson-frame.tsx`, `lesson-action-bar.tsx`, `components/playsense-studio/player/workspace-tools-slot.tsx`, tests under `components/class-viewer/lesson-viewer/lesson-mode/__tests__/`. Modify `lesson-footer.tsx` to use the summary (existing `lesson-completion.test.tsx` must stay green).

**Interfaces:**
```ts
export interface LessonProgressInput { courseId: string; classId: string; currentIndex: number; totalItems: number; itemIds: string[]
  completedItemIds: string[]; nextClassId: string | null; activeItemId: string | null; activeItemType: string | null; isCompleted: boolean; nextLabel?: string | null }
export type LessonProgressLabel = 'lessonComplete' | 'videoComplete' | 'quizComplete' | 'exerciseComplete' | 'jamComplete' | 'partComplete'
  | 'savingProgress' | 'saveFailed' | 'practiceComplete' | 'questionsComplete' | 'inProgress'
export interface LessonProgressSummary { label: LessonProgressLabel; detail: { key: string; params?: Record<string, string | number> }
  done: boolean; lessonDone: boolean; saving: boolean; error: boolean; completedCount: number
  hasNextPart: boolean; prevHref: string | null; nextHref: string; next: 'part' | 'lesson' | 'course' }
export function summarizeLessonProgress(input: LessonProgressInput, live: { completedItemIds?: string[]; item?: ItemCompletion }): LessonProgressSummary
```
`lesson-frame.tsx`: `LessonFrameProvider({ value, children })`, `useLessonFrame(): LessonFrameValue | null` where
`LessonFrameValue = { actionHost: HTMLElement | null; claim(id: string, claim: { tone: ActionTone } | null): void; advance(): void; teacherName: string | null }`, `ActionTone = 'neutral' | 'success' | 'danger'`,
`<LessonAction tone?>` (portal into `actionHost`, inline `div.lx-action-inline` outside a frame), `<ActionMessage icon title detail tone?>`.
`workspace-tools-slot.tsx`: `WorkspaceToolsSlotProvider({ host, children })`, `WorkspaceToolsPortal({ children })` (inline without a provider; renders nothing until the host mounts).
`LessonActionBar({ progress: LessonProgressInput | null, claims, setHosts, onAdvance })` renders `footer[data-lesson-action-bar][data-tone]` with, left→right: tools host, default message (hidden while claimed) or claim host, retry, primary.

- [ ] **Step 1: failing tests**
  - summary: video complete + has next part → `{ label: 'videoComplete', next: 'part', nextHref: '…?item=1' }`; zero items → `{ done: false, lessonDone: false, next: 'lesson' | 'course', detail partsCompleted 0/0 }`; saving / error / partial (performance only) labels; last part + no next class → `next: 'course'`.
  - frame: `LessonAction` inside a provider portals into the host and the bar hides its default message; on unmount the default returns and `data-tone` goes back to `neutral` (**Review Focus 3**); without a provider it renders inline.
  - tools slot: portal target mounts after the first render; children never render twice.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement; `LessonFooter` becomes a thin view over `summarizeLessonProgress`. The bar's tone animates with `lx-rise-ok` / `lx-rise-bad` (300ms `--ease-out`, `@media (prefers-reduced-motion: reduce) { animation: none }`).
- [ ] **Step 4:** PASS, including `components/class-viewer/lesson-viewer/__tests__/lesson-completion.test.tsx`.
- [ ] **Step 5:** commit "Add the lesson action bar and the frame context parts use to claim it".

### Task 3: LessonTopBar

**Files:** Create `lib/courses/lesson-parts.ts` (+ test), `lesson-mode/lesson-top-bar.tsx` (+ test).

**Interfaces:** `partKind(itemType): 'video' | 'play' | 'quiz' | 'other'`; `partLabels(items, t)` (moved from `lesson-parts-nav.tsx`, which imports it); `partProgress(state: 'done' | 'active' | 'todo', status?: CompletionStatus): number` → done 100, active saving/in-progress 50, active 12, todo 0.
`LessonTopBar({ courseTitle, courseHref, moduleTitle, moduleHref, title, parts: { id; title; item_type }[], activeIndex, completedItemIds, partStatus?, courseId, classId, streak, onOpenDrawer })`.

- [ ] **Step 1: failing tests:** `partProgress` table; the component renders crumb links, `h1` title, one `a[role=tab]` per part with `aria-selected` on the active one and a `[data-part-state=done]` check on completed parts, the underline `style.width` from `partProgress`; **one part renders** (single item); streak pill shows the count; drawer button calls `onOpenDrawer`; Close links to the course.
- [ ] **Step 2–4:** FAIL → implement → PASS. Phones: `.lx-part-label` hidden unless `[aria-selected=true]`; crumb hidden.
- [ ] **Step 5:** commit "Add the lesson top bar with parts, streak and close".

### Task 4: LessonRail

**Files:** Create `lesson-mode/lesson-rail.tsx` (+ test).

**Interfaces:** `LessonRail({ courseHref, moduleTitle, courseTitle, moduleIndex, lessons: RailLesson[] })` with
`RailLesson = { id; title; href; state: 'done' | 'current' | 'upcoming'; paywalled: boolean; kind: PathLessonType; minutes: number | null; number: number }`
(built server-side from `buildPathNodes`, filtered to the current module). Export `LessonRailList` (the nodes list, reused by the drawer on phones).

- [ ] **Step 1: failing tests:** logo link → course; ring label `done/total`; one link per lesson with `data-state`; current node has `aria-current="page"`; paywalled node shows the lock; minutes line omitted when `minutes` is null; settings area contains the theme + language rail toggles; `aside` has `hidden md:flex`.
- [ ] **Step 2–4:** FAIL → implement (72px, `group/rail`, `hover:w-[300px]` overlay with `shadow`, labels fade via `opacity-0 group-hover/rail:opacity-100`, 3D nodes with a 3px bottom shadow, vertical connector) → PASS.
- [ ] **Step 5:** commit "Add the lesson rail".

### Task 5: Drawer

**Files:** Create `lesson-mode/lesson-drawer.tsx` (+ test).

**Interfaces:** `LessonDrawer({ open, onOpenChange, title, description, meta: { duration?: string; level?: string; teacher?: { name; imageUrl } }, comments: ReactNode, commentCount: number, lessons: ReactNode })`; Radix `Sheet` side right, width `min(400px, 92vw)`; tabs About · Comments · Lessons (Lessons tab `md:hidden`).

- [ ] Tests: About shows paragraphs and pills; switching tabs shows the comments slot; Lessons tab button has `md:hidden`. FAIL → implement → PASS → commit "Move About and comments into a lesson drawer".

### Task 6: LessonModeShell + page

**Files:** Create `lesson-mode/lesson-mode-shell.tsx`, `lesson-mode/lesson-mode.css` (+ test). Modify `page.tsx`, `class-item-renderer.tsx` (`teacherName?: string | null` pass-through to `ExerciseView`).

**Interfaces:** `LessonModeShell({ course: { id; title }, module: { id; title; index }, lesson: { id; title }, rail: RailLesson[], parts, progress: LessonProgressInput | null, practice: { dateKeys: string[]; today: string } | null, about, comments, commentCount, teacherName, nextLesson: { title; kind; minutes } | null, body })`.
The shell wraps `LessonProgressProvider` (same key/props as `LessonShell`), provides `LessonFrame` + `WorkspaceToolsSlotProvider`, renders `div[data-lesson-shell][data-lesson-mode]` → rail + `div.lx-main` → top bar, `main[data-dashboard-main][data-lesson-stage]` (scroll container, `px-4 md:px-8 py-4`), action bar; drawer; and `LessonDone` over the stage while celebrating.
`advance()`: next part → `router.push(nextHref)`; last part, lesson complete and something completed this visit → celebrate; else `router.push(nextHref)`.
Page: fetch `class_item_progress.completed_at` rows (the `HeaderStreak` query), `todayKey()`, `dateKeyFor`; build rail lessons with `buildPathNodes`; drop `HeaderTitleOverride` and the body's meta/about/comments block.

- [ ] Tests (jsdom, mock `next/navigation`, actions): renders `[data-lesson-stage][data-dashboard-main]`, rail, top bar, action bar; drawer opens from the top bar; `advance()` pushes the next part href; after the provider reports the last item complete, `advance()` shows `[data-lesson-done]`. FAIL → implement → PASS.
- [ ] Commit "Render lessons in the immersive lesson shell".

### Task 7: Workspace tools in the action bar; play key per staff layout

**Files:** Modify `playsense-studio-player.tsx` (switcher wrapped in `WorkspaceToolsPortal`), `score-exercise-game.tsx` (heading strip's switcher → portal; `useStaffLayoutPreference()` lifted, `useWorkspaceLayout(\`play:${staffLayout}\`, PLAY_WORKSPACE)`), `exercise-score.tsx` (optional `layout` / `onLayoutChange` props; falls back to its own hook).

- [ ] Tests: `exercise-score` with controlled props calls `onLayoutChange` and does not read storage (additive API test); `WorkspaceToolsPortal` test from Task 2 covers the move. Existing `split-workspace` / `exercise-workspace` tests stay green.
- [ ] Commit "Host the workspace switcher in the lesson action bar and key play per staff layout".

### Task 8: Watch state

**Files:** Create `components/playsense-studio/player/section-chips.tsx` (+ test). Modify `playsense-studio-player.tsx` (chips in the staff header when there are 2+ sections; tap → `clock.loadLoop(start, end ?? duration)`; tap the looping chip again → `clearLoop`), `exercise-view.tsx` (watch: `<LessonAction>` with `ActionMessage` "Watch {teacher} play it once" + chunky **Your turn**; the old under-player button remains only outside a frame via the inline fallback).

**Interfaces:** `SectionChips({ sections: { label: string | null; start: number; end: number | null }[], currentSeconds, loop: { a: number | null; b: number | null; enabled: boolean }, onLoop(start, end), onClear() })`.

- [ ] Tests: active chip follows `currentSeconds`; clicking loops that range; clicking the looping chip clears; unlabelled sections get "Section N". `exercise-view.test.tsx` still passes (turn CTA overlay unchanged). Commit "Loop a section from the staff and move Your turn into the action bar".

### Task 9: Ready check

**Files:** Create `lib/play-sense/ready-check.ts` (+ test), `components/class-viewer/lesson-viewer/ready-check.tsx` (+ test). Modify `score-exercise-game.tsx`.

**Interfaces:**
```ts
export type CheckState = 'todo' | 'running' | 'done' | 'skipped'
export interface ReadyInput { audioMode: AudioMode | null; micOpen: boolean; micHeard: boolean; calibrated: boolean; calibrating: boolean; bleConnected: boolean }
export function readyChecks(i: ReadyInput): { sound: CheckState; input: CheckState; timing: CheckState; canStart: boolean }
```
Rules: sound done iff a mode is chosen; input: mic modes → done when heard, running while open, else todo; midi → done; playsense → done when connected; timing: midi → skipped; calibrated → done; calibrating → running; else todo; `canStart` = sound done.
`ReadyCheck({ instrument, audioMode, onMode, inputLevel, micOpen, micHeard, deviceLabel, calibrating, calibrationBeat, totalCalibrationBeats, calibrationError, latencyMs, onCalibrate, bleConnected, onConnectBle, preview: ReactNode, meta })`. The game shows it while `selecting`/`calibrating` until the student first presses **Start playing** (non-preview); auto-opens the mic test once a mic mode is chosen; the action bar shows the summary message + **Start playing** (`chunky-success`).

- [ ] Tests (**Review Focus 4**): table for `readyChecks`; component shows three panels with `[data-check=done]` for a returning student, the mode buttons call `onMode`, the Timing panel's button calls `onCalibrate`, a progress bar while calibrating. Commit "Merge the calibration, input and mic steps into one Ready check".

### Task 10: Playing — transport in the action bar

**Files:** Create `lesson-transport.tsx` (+ test). Modify `score-exercise-game.tsx` (in a frame: `NowPlayingBar` → `<LessonAction><LessonTransport/></LessonAction>`, mixer popover moves into the transport), `exercise-mode-frame.tsx` (in a frame: no toolbar, not immersive, `data-lesson-mode`, fitted to the stage).

**Interfaces:** `LessonTransport({ state, bpm, onStart, onPause, onResume, onRestart, onFinish, click: boolean, onClick, mix?: ReactNode, onWatchDemo? })`.

- [ ] Tests: playing shows Pause + BPM + Finish take; paused shows Resume; selecting shows Start playing (chunky); restart/click buttons call handlers; `[data-transport-extra]` wraps the pills phones hide. Commit "Move the play transport and Finish take into the action bar".

### Task 11: Part done

**Files:** Create `lib/play-sense/bar-results.ts` (+ test), `part-done.tsx` (+ test). Modify `score-exercise-game.tsx` (results → `PartDone`; previous best from `getUserAttempts(exercise.id)` fetched once on mount, not in preview).

**Interfaces:**
```ts
export type BarStatus = 'clean' | 'close' | 'miss' | 'rest'
export interface BarResult { bar: number; status: BarStatus; notes: number; missed: number; early: number; late: number }
export function buildBarResults(exercise: Pick<ExerciseDefinition, 'measures' | 'events'>, results: EventResult[]): BarResult[]
export function summarizeTake(bars: BarResult[]): { clean: number; played: number; missedBars: number[] }
export function bestPreviousAccuracy(attempts: { accuracy: number | null }[]): number | null
```
`eventIndex % events.length` → the event → its `measure`. Bar = `miss` if any miss, else `close` if any `ok` grade or early/late timing on a non-perfect hit, else `clean`; no events → `rest`.
**Ruling:** the engine cannot loop a bar range (it plays whole exercises), so bar tiles are not tappable and there is no "Loop bars" shortcut; each tile carries a tooltip/aria label with its counts. Cost if wrong: two spec affordances missing until the engine grows range playback.
`PartDone({ stats, bars, previousBest, onAgain, onContinue, onWatchDemo?, demo })`: accuracy ring (animated `stroke-dashoffset`, static under reduced motion), eyebrow + heading + comparison line, three stat tiles (clean bars, best combo, time), bar strip + legend; action bar: message "Saved to your progress" + **Again** (`chunky-ghost`) + **Continue** (`chunky`, calls `frame.advance()`; outside a frame the inline fallback shows the same buttons).

- [ ] Tests (**Review Focus 5**): loops fold, rests, missing-as-miss, early/late → close, chords; component: ring `aria-label`, tiles count, comparison copy for first take / improved / below best. Commit "Show a bar-by-bar Part done screen after a take".

### Task 12: Quiz in two columns with the action bar

**Files:** Modify `quiz/focus-stage.tsx`, `quiz-runner.tsx`, `quiz/results-screen.tsx`, `quiz/quiz.module.css` (+ tests in `quiz/__tests__/focus-stage-lesson.test.tsx`).

In a frame: `.lessonFocus` two columns (question left: eyebrow "Question n of m", 24–38px heading, type chip; answers right), tiles 20px padding / 16px text / 2px border / 4px bottom, selection `--info`; Check / Continue move to `<LessonAction tone>` with `ActionMessage` carrying what `FeedbackBanner` said (title, correct answer on a miss, explanation); the in-panel banner and buttons are not rendered. Results screen: its Continue/Retry move to the bar (Continue → `advance()`). Sheet mode keeps its behaviour and gets the frame's spacing. Outside a frame nothing changes.

- [ ] Tests: in a frame the Check button lives in the action host, is disabled until an answer, grading tints the bar `success`/`danger` and shows the explanation; outside a frame the old banner still renders. Commit "Lay out lesson quizzes in two columns with Check in the action bar".

### Task 13: Lesson done celebration

**Files:** Create `lib/dashboard/lesson-celebration.ts` (+ test), `lesson-mode/lesson-done.tsx` (+ test). Wire into the shell (Task 6's `celebrating` state).

**Interfaces:**
```ts
export function celebrationStats(dateKeys: string[], today: string, added: number): {
  streak: { before: number; after: number }; week: { before: number; after: number; goal: number }
  milestones: { key: string; title: string; icon: string; unit: 'lessons' | 'days'; requirement: number; before: number; after: number }[] }
```
Uses `computeStreaks` and `buildPracticeCalendar` on `dateKeys` and on `dateKeys + added × today`; milestones = the next unmet `lessons_*` (count = completions) and `streak_*` from `ACHIEVEMENTS`.
`LessonDone({ stats, lessonTitle, nextLesson, courseHref, nextHref })`: flame + day count flipping in, `WEEK_GOAL` segments with today's popping in, "N of 6 lessons this week", two achievement cards animating their bars from `before` to `after`, next-lesson card, `Confetti`; action bar **Back to course** (`chunky-ghost`) + **Next lesson** (`chunky`, only when there is one).

- [ ] Tests: first completion of the day extends a yesterday streak; second completion same day keeps the streak; week count caps display at goal but reports the true count; milestones pick the next unmet requirement; component renders segments = goal and hides Next lesson when there is none. Commit "Celebrate a finished lesson with streak, weekly goal and achievements".

### Task 14: Cleanup, i18n audit, visual check, build

- [ ] `git rm "components/class-viewer/lesson-viewer/score-exercise-game 2.tsx"` after `grep -rn "score-exercise-game 2"` shows no importer. **Ruling:** it is a tracked Finder duplicate of the game with no importers.
- [ ] Temporary `app/playsense-preview/lesson/` page (dev-only, `notFound()` in production) rendering `LessonModeShell` with fixtures in each state; screenshots desktop 1440×900 / phone 390×844, dark / light, reduced motion via `.superpowers/shot.mjs` on CDP 9614; also `/playsense-preview/score`. Delete the page before committing.
- [ ] `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint <changed files>`, `npm run build` (dev server stopped).
