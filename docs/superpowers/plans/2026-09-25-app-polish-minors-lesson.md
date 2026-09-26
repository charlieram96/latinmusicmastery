# App Polish — deferred minors: Workspace (P3) and Lesson mode (P4)

> Executed inline with superpowers:executing-plans + superpowers:test-driven-development. One commit per item
> (small related items may share one). Worktree `.claude/worktrees/polish-m-lesson`, branch `feat/polish-m-lesson`,
> dev `-p 3022`, CDP 9622.

**Goal:** fix the minors the P3/P4 reviews deferred, each with a failing test first where testable.

**Global constraints:** the common brief (i18n in en+es under our own namespaces, Tailwind gotchas, reduced motion,
no merging). Do not edit staff-renderer, exercise-score, the exercise-workspace bridge, staff-layout-switch, course,
dashboard or path-strip files. `SplitWorkspace` / `useWorkspaceLayout` APIs: additive only.

**Review focus:** (1) W3's re-parented dock must never unmount its React subtree and must not leave the node detached
when the workspace unmounts; (2) L2's "not played" must only apply to a take stopped with Finish take, never to a
take that reached the end; (3) L3's focus move must only fire when focus was inside the bar and got lost, never steal
focus from elsewhere; (4) L9: stable frame value must still call the latest `advance` logic.

## Workspace

| # | Fix | Test (failing first) |
|---|---|---|
| W1 | `useWorkspaceLayout.setLayout` skips the pre-change measurement when the rendered layout would not change; `SplitWorkspace` also drops any measurement left over after a commit where layout/swap/corner did not change. | `split-workspace.test`: pick the active layout, then move the PiP corner via `update` → no FLIP (scale) animation from the stale rect. |
| W2 | PiP double-click ignores targets inside `NO_DRAG`, buttons and `[role=button]` (the tap-to-play overlay is a button). | Double-click the `[data-tap]` button in PiP → layout stays `pip`. |
| W3 | New additive `dock` prop on `SplitWorkspace`: rendered once into a persistent node that is re-parented between a slot under the media (side/stack) and the footer (pip/music). The player passes its transport as `dock`. | A stateful dock child keeps its mount count and state across side → pip → side; the node sits under `.ws-media` then `.ws-footer`. |
| W4 | `ScoreExerciseGame` passes the video as `media` only when the canvas is live (`showCanvas`). | Component test is heavy (engine hooks); covered by a pure `playMediaVisible` helper test + visual check. |
| W5 | Every drag (split, music, PiP) registers its teardown in a ref; unmount runs it. | Start a divider drag, unmount → `window.removeEventListener('pointermove', …)` called for the drag's handler. |
| W6 | Mouse PiP press cancels `selectstart` until pointerup. | pointerdown on the PiP → a `selectstart` on document is `defaultPrevented`; after pointerup it is not. |
| W7 | Remove `lessonView.*` from en/es (grep shows no user). | `grep -rn lessonView` empty outside locales; JSON parses. |

## Lesson mode

| # | Fix | Test |
|---|---|---|
| L1 | `readyChecks().canStart` is false while calibrating, so Start playing is disabled. | `ready-check.test` table row: mode chosen + calibrating → `canStart: false`; component: start disabled while calibrating. |
| L2 | `buildBarResults(exercise, results, { reached })`: events past `reached` (progress 0–1 over all passes, set only when Finish take stopped the take) are not counted; a bar with notes but none reached is `unplayed` (neutral tile, legend entry); `summarizeTake` excludes it. Part done shows the played-only accuracy and replaces the comparison with "Partial take — n of m bars". | `bar-results.test`: stop halfway → trailing bars `unplayed`, excluded from `played`/`clean`; `reached` undefined keeps today's behaviour. `part-done.test`: partial copy. |
| L3 | The action bar owns one persistent `role=status` live region fed from the current `.lx-msg` text (MutationObserver); `ActionMessage` inside a frame no longer creates its own live region. If focus was inside the bar and its element is removed, focus moves to the bar's `[data-primary]` (or first enabled button). | `lesson-action-bar.test`: the live region exists before any claim and updates its text on claim; focus on a claimed button → swap content → focus lands on the new primary. |
| L4 | Top bar parts: `nav` of links with `aria-current="step"` on the active part (CSS switched from `aria-selected`); `lx-streak-big` gets `role="img"`. | `lesson-top-bar.test`, `lesson-done.test`. |
| L5 | In lesson mode the exercise frame height is the stage bottom minus the `.lx-fill` bottom padding (no extra 12 px guess). Pure `lessonStageHeight()` in `lesson-viewport.ts`. | Unit test for the helper; visual check of stage scrollHeight == clientHeight. |
| L6 | `onPrimary` returns early for modified / non-primary clicks. | Shell test: ctrl-click on Finish lesson → not prevented, no celebration. |
| L7 | Paywalled lesson: `ClassViewerLocked` puts Subscribe + Back to course in `<LessonAction>`; the drawer hides the Comments tab when `comments` is null. | Drawer test; locked component test in a frame (buttons in the host). |
| L8 | `celebrationStats(dateKeys, today, added, lessonToday)`: "before" removes today's completions that belong to this lesson (page passes `lessonToday`). | Table: today's only practice came from this lesson → before 4, after 5. |
| L9 | Shell's `advance` is stable (reads latest summary via ref), so the frame value only changes with host/claims. | Shell test: a body probe using `useLessonFrame` doesn't re-render when the drawer opens. |
| L10 | Mixer labels (`mute`, `unmute`, `level`) and session audio errors through `t()`: `lib/play-sense/audio-errors.ts` maps the hooks' known English messages to keys; unknown messages show as-is. | Unit test of the map + a guard test that every mapped message still appears in the hooks' source. |
| L11 | New `getBestAttemptAccuracy(exerciseId)` action (order by accuracy desc, nulls last, limit 1). Part done's baseline = max(saved best, best finished earlier this visit) computed live, so a late arrival still fills the comparison; while it loads the comparison line is hidden. | Pure `takeBaseline()` helper test. |
