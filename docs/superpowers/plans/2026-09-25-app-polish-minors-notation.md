# App Polish — Notation deferred minors

> Short fix plan for the deferred minors of Phase 2 (N1 notation). Executed inline with TDD.

**Base:** `playsense` 0bed137 (all six polish phases merged). Branch `feat/polish-m-notation`.

**Global Constraints:** as the Phase 2 plan (`2026-09-25-app-polish-p2-notation.md`). Studio strip untouched. No new
locale keys unless needed (reuse `staff.*`). Do not edit `split-workspace.*`, lesson shell files or `score-exercise-game.tsx`.

**Review Focus**
1. Paged turns: overlays (playhead, band, ring, loop markers) must never show at the new page's positions before the page arrives, and must end at their normal opacity (hidden cursor stays hidden).
2. Voice 2 and rests: states for every voice; a sounding rest is never lit; seeking back clears voice-2 played state.
3. Bar numbers with repeats: the engraved number and the HUD agree for passes and for collapsed written-out repeats.
4. Removing the old Layout menu must leave the lesson's workspace switcher as the only (and a reachable) layout control.

---

### Task 1: Renderer note states for every voice, rests never lit, no double dimming (items 4, 5, 6)
- Test (`staff-renderer-n1.test.tsx`): a score with a voice-2 line — voice-2 notes turn `played` / `active` with time and clear on seek back; a sounding rest stays `upcoming` (never `active`) and becomes `played` after it ends; the CSS resets played notes and past chips inside a `past` stacked row to full (row) opacity.
- Fix: note lanes (voice 1, voice 2) each with their own played/active bookkeeping; a rest is never shown active; CSS `[data-row-state=past] [data-note-state=played] { opacity:1 }` (and past chips).

### Task 2: Paged interlude clicks and overlay turns (items 2, 3)
- Test: paged on the leading-interlude page, a click on the staff (outside the interlude box) fires no seek; a paged turn fades in the playhead, band, ring and loop markers (WAAPI stub) with an opacity-0 start.
- Fix: `xToTimePosition` returns null on a row with no notes (interlude/blank); pointer-up and hover skip. `showPage` fades the overlays in over the turn (hidden for the first half, implicit end keyframe keeps their own opacity).

### Task 3: Remove the followMode 'measure' path (item 10)
- No new test (dead-code removal, no caller passes `followMode`); existing renderer tests guard scroll follow.
- Remove `StaffFollowMode`, the `followMode` prop/mount argument/`setFollowMode`, `data-follow-mode`, the steady-reading branch and the scroll `readingStops`.

### Task 4: Paged row centred in a tall pane (item 9)
- Test: paged container gets `height:100%` with a `min-height` of the stage; CSS centres the viewport (`margin-block:auto`) in paged mode only.
- Fix: renderer sizing + CSS; watch player gives the paged staff the flex column like stacked.

### Task 5: Test gaps (item 8)
- Tests: chord chip names the top note; a paged backwards turn slides the other way (`translateX(-12%)` in); the trailing-interlude page shows after the music.

### Task 6: Bar numbers restart per pass and match the HUD (item 7)
- Test (`exercise-reading-score.test.ts`): numbers restart each pass; a collapsed written-out repeat numbers its later passes like its first, so the projected bars read 1..n per pass. `exercise-score-layout.test.tsx`: the HUD shows the active bar's engraved number.
- Fix: `exerciseReadingScore` numbers by display position within the pass; the HUD reads `measure.number`; the renderer's repeat-count lookup matches hits by bar index, not number (numbers now repeat across passes).

### Task 7: Watch player re-follow for rows layouts (item 1)
- Test: `StaffRefollowButton` renders nothing while following and calls `onFollow` when not; `staffNeedsRefollow(layout, following)` is true only for `wrapped`/`paged` when not following.
- Fix: the button sits beside the staff layout switch in the watch player's music header.

### Task 8: Drop the old ExerciseScore Layout menu and dead bridge parts (item 11)
- Test: inside the workspace bridge the score renders no "Score layout" trigger; still reports vertical/horizontal from the workspace.
- Fix: remove the popover + its CSS; the bridge keeps `position`, `stacked`, `scoreId` only (drop `setPosition`, `resetSize`, `layoutForScorePosition`).

### Task 9: Phase check
- Full suite, tsc, eslint on changed files; screenshots of `/playsense-preview/notation` and `/playsense-preview/score` (dev 3021, CDP 9621); `npm run build`; one fresh opus reviewer.
