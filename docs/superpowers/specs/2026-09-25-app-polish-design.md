# App Polish (Duolingo feel) — Design

**Date:** 2026-09-25
**Routes:** `/dashboard` (home), `/dashboard/course/[courseId]` (course detail), `/dashboard/course/[courseId]/class/[classId]` (lesson), and the staff shown in lessons.
**Status:** Approved in conversation across four rounds of the design lab.
**Prototype of record:** LMM Design Lab 2, version 4: https://claude.ai/artifact/C2TSUaq8JyWrTQbSJyHstW. Each surface is on its own tab; the "Today" variants show the current app for comparison.

## Goal

Make the app cleaner and more fun without changing its design language. Studio Amber, Inter + Montserrat, dark or light only and the hover rail all stay. The target feel is Duolingo for musicians: chunky pressable buttons, a visible lesson path, rewarding motion and celebrations, and a lesson screen that uses all of the available space. The staff (notation) gets the most attention.

## Locked decisions

These were picked by the user from the lab. Later work must not re-open them.

- **Game layer:** only mechanics that already exist: streak, weekly goal, practice calendar, achievements. No XP, hearts, lives or leagues.
- **No skill-level adaptation.** Every student sees the same staff helpers: note names, beat counts and the next-note ring.
- **Backgrounds:** faint musical background on the dashboard home only. Every other page stays plain.
- **Notation:** N1 "Refined". Stacked rows are the default, horizontal pages with a slide turn are the alternative, and the student can switch at any time. The 3D highway stays the app's stage highway, unchanged.
- **Lesson:** L2 "Immersive". The lesson takes the whole screen with a slim lesson rail, video and staff fill the stage, and every video + staff (+ highway) view can be resized and re-laid-out with animation.
- **Course detail:** C3 "Hybrid". A horizontal lesson path under the hero with no card around it, a compact syllabus below, and every section the page has today.
- **Dashboard:** D1. The shipped home with a light polish: chunky primary buttons, a compact "Your path" card, the streak + calendar card and poster-style recommendations.

## 1. Shared foundations

### 1.1 Chunky button
- Add a `chunky` variant to `components/ui/button.tsx`.
- Look:
  - Filled primary, `border-radius: 14px`, a 4px solid bottom shadow in `--primary-deep`.
  - Uppercase Montserrat 800, `letter-spacing: .02em`.
  - On press it moves down 4px and the shadow collapses (120ms ease-out).
- Tones: `default` (amber), `success`, `danger` and `ghost` (card fill with a 2px inset border and a border-coloured bottom shadow).
- Sizes: `sm` (8px 14px, 12px text), `default` (12px 22px, 14px text), `lg`.
- Disabled: muted fill and muted text.
- Use it only for the main forward action on a screen: Continue, Resume, Your turn, Start playing, Check, Next lesson, Preview on a poster. Everything else keeps the existing variants.

### 1.2 Motion tokens
Add these to `app/globals.css` `:root` and expose them in `tailwind.config.js` as `transitionTimingFunction` / `transitionDuration` keys:

| Token | Value | Used for |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | most movement |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | pops, check marks, snapping |
| `--dur-tap` | 120ms | button press, tile select |
| `--dur-state` | 180ms | colour and state changes |
| `--dur-pop` | 320ms | active note, combo, badges |
| `--dur-turn` | 360–440ms | page turns, drawers, layout changes |

`prefers-reduced-motion` turns off particles, shakes and slides; page turns become a 220ms fade.

### 1.3 Page background (dashboard only)
- Add a `PageBackground` component at `components/dashboard/page-background.tsx`.
- It draws an absolutely positioned SVG behind the scrolling content, and it does not scroll with it:
  - three bundles of five wavy staff lines
  - about 16 scattered Bravura note glyphs
  - a 2-3 clave figure
  - a soft amber radial glow in the top right
- Opacity is about 6–8% in both themes, using one ink token per theme.
- Mount it in the dashboard home only.
- Implementation note from the lab: don't use a sticky layer with `margin-bottom: -100%`, because percentage margins resolve against the width. Wrap `main` in a positioned box and put the layer behind it.

### 1.4 Glyph stroke fix
- `app/globals.css` forces `stroke: currentColor !important` on SVG `text` and `tspan` inside `.playsense-studio-notation`.
- VexFlow 5 draws glyphs as text, so this rule adds a 1px outline that makes noteheads heavy.
- Fix: change the text selectors to `stroke: none !important`, keeping the fill rule. Check the Studio editor strip and the PDF import preview for regressions.

### 1.5 Path strip (shared by course detail and dashboard)
- **Pure helper `lib/courses/path-nodes.ts`**
  - Input: the course structure (modules → lessons, the progress per lesson, the current lesson).
  - Output: an ordered list of nodes `{ kind: 'lesson' | 'checkpoint', state: 'done' | 'current' | 'locked', lessonId?, moduleIndex, title, types, minutes, href }`.
  - A `checkpoint` node closes each module and links to that module's overview page (`moduleOverviewHref`). It is not a new quiz.
  - Unit-test it with vitest.
- **Component `components/course/path-strip.tsx`**, horizontal:
  - Nodes: 56px circular 3D buttons, 6px bottom shadow.
    - Done: amber with a check.
    - Current: amber with a play icon and a 1.6s ring pulse, plus a bobbing "CONTINUE · N min" bubble above it.
    - Locked: muted, showing its lesson-type icon (video, play along, quiz).
    - Checkpoint: a trophy chest, gold when the module is complete.
  - Connectors are wavy (small sine offset per node): solid amber up to the current node, dashed after it.
  - Each node's title sits under it, clamped to 2 lines. Hover or focus shows a small card with the lesson number, state, title, types and minutes.
  - The strip auto-scrolls to the current node on mount and has left/right arrow buttons.
  - Props select a window around the current lesson (`from`, `to`) so the dashboard can show a short slice.

## 2. Notation: N1 on the existing renderer

All of this goes into `components/playsense-studio/player/notation/renderers/staff-renderer.tsx` and `staff-renderer.css`. Scope is only the lesson exercise staff (`exercise-score.tsx`) and the watch-mode staff in `PlaysenseStudioPlayer`. The Studio editor is out.

### 2.1 Look
- Staff lines at 24% of the ink colour (today 30%). Glyphs have no stroke (§1.4).
- **Note states:** today there are `upcoming` and `active`. Add `played`.
  - Played notes dim to 40% opacity.
  - Active notes turn `--primary` with a `drop-shadow(0 0 6px primary/.45)`, and pop on entry with a spring: scale 1 → 1.2 → 1.06 over 320ms.
- **Playhead:** a 3px rounded bar with a vertical gradient and a 12px primary glow, with a 9px diamond on top. The diamond pulses (scale 1.7 → 1, 260ms) on every beat.
- **Current bar:** a soft band (`primary/.07`, 10px radius) behind the bar being played. It glides to the next bar with `--dur-turn`. It replaces the "MEASURE 01" labels and the per-measure dots/rails.
- **Chord symbols:** Montserrat 700, 13px, above the first note of a bar, shown only when the score provides them. Otherwise nothing is shown in that slot. See Open questions.

### 2.2 Helpers (always on)
- **Note names:** a 20px chip under each attack (not under tied continuations). The current chip fills primary and scales 1.18.
- **Beat counts:** "1 & 2 & 3 & 4 &" under the staff. Beats are bold and the current count turns primary at scale 1.3. When the next note is in the next bar, a note's tail runs to the barline, so counts at the end of a bar don't bunch up.
- **Next-note ring:** a 26px primary ring pulses (scale .7 → 1.5, fading out, 1s loop) on the next attack.

### 2.3 Layouts
- **Stacked (default)** is the existing `wrapped` mode, reworked:
  - 4 bars per row, fewer when the pane is narrow: `clamp(floor(width / (250 · scale)), 2, 4)`.
  - A clef on every row, the time signature on the first row only, and an italic bar number at the start of every row after the first.
  - A tie that crosses a row break draws a half-tie on both sides.
  - Follow: the view glides (exponential ease, about 7/s) so the current row sits at the top. Past rows dim to 45% and upcoming rows sit at 88%.
- **Horizontal (paged):** one row at a time. At the row boundary the next page slides in from the right (12% offset + opacity, 420ms `--ease-out`) while the old page slides out left. Reduced motion uses a 220ms fade.
  - This replaces today's `scroll` + `measure` "steady" behaviour (instant jump plus fade).
  - Continuous `flow` scrolling can stay available for the watch player if it's still used there.
- **Switching:** the student can switch Stacked ↔ Horizontal at any time from the staff toolbar. The choice persists per student in localStorage, like the existing layout preferences.

### 2.4 Highway and feedback
- The stage highway (`components/play-sense/stage-highway/*`) doesn't change.
- Hit and miss feedback stays on the highway; the staff shows no judgement colours in N1.
- The staff HUD keeps the bar counter and the beat dots, and drops any score/combo duplicated by the highway's HUD.

## 3. Lesson: L2 immersive

### 3.1 Lesson mode shell
- On `/dashboard/course/[courseId]/class/[classId]`, the dashboard rail and header don't render. `DashboardLayoutClient` checks the route (or a layout segment flag) and renders the page full-bleed.
- The lesson frame is `rail | main`. Main is split into a top bar, the stage and an action bar.
- **LessonRail** replaces `lesson-sidebar.tsx`:
  - 72px wide; on hover it expands to 300px over the page, like the dashboard rail.
  - Top: the logo (back to the course), then the module progress ring with the module title and course.
  - Then each lesson as a 3D node on a vertical connector (done, current, locked) with its title, type and minutes.
  - Bottom: lesson settings.
  - Hidden on phones.
- **LessonTopBar** replaces `lesson-header.tsx` and `lesson-parts-nav.tsx`:
  - Left: the crumb (course › module) and the lesson title.
  - Centre: the parts (Demo · Your turn · Check). Each has an icon and a 3px progress underline; done parts show a check, and the active part is tinted primary.
  - Right: the streak pill, the "About & comments" button (opens the drawer) and Close.
- **LessonActionBar** replaces `lesson-footer.tsx`:
  - A full-width bar with a 2px top border.
  - Left: a message (badge icon, bold line, detail) or the play transport (pause, BPM, loop range, click, mix).
  - Right: the chunky primary action.
  - Answer feedback tints the bar success or danger with a 300ms slide-up, replacing today's `FeedbackBanner` placement.
  - It also hosts the workspace layout switcher (§3.2) when a workspace is on screen.
  - Auto-completion, save states and "Up next" keep today's logic from `lesson-progress-context.tsx`.
- **Drawer:** "About this lesson" (description, meta pills) and Comments (the existing `CommentsSection`) move out of the page body into a right-side drawer.

### 3.2 Workspace (video · staff · highway)
- Extend `components/playsense-studio/player/split-workspace.tsx` into one workspace for every lesson view that pairs the teacher video with the staff. It replaces the lesson's use of `ExerciseWorkspace` and of the split `PlaysenseStudioPlayer`.
- **Regions:** media (the video) and music (the staff, and while playing the highway below it with its own horizontal divider).
- **Layouts:**
  - **side:** media | music.
  - **stack:** media over music.
  - **pip:** music fills the stage and the video floats in a corner.
  - **music only:** no video.
  - **swap:** reverses the order.
  - Defaults: watch = side (44/56), play = pip (video at 24% width, bottom right).
- **Divider:**
  - A 16px hit area with a grip that grows and turns primary on hover or drag.
  - Snaps at 33⅓ / 50 / 66⅔% within ±2.2%, and shows a % pill while dragging.
  - Clamped to 22–78%.
  - Double-click resets with a 360ms grid transition. Arrow keys nudge it by 2%.
- **PiP:**
  - Drag from anywhere on the video (except its controls). It tilts slightly while dragged.
  - On release it springs to the nearest corner (440ms `--ease-spring`).
  - Resize it from the inner corner handle: 18–50% of the width, 180px minimum.
  - Double-click switches back to side.
- **Animation:** switching layouts animates both regions with FLIP (translate + scale, 440ms `--ease-out`). A region that appears fades and scales in from .92. Reduced motion skips it.
- **Persistence:** layout, split %, music split %, corner and PiP size are stored in localStorage per view kind (`watch`, `play`, and per staff layout).
- **Phones:** side becomes stack, and the switcher hides the side option.
- The staff re-lays out after a resize (debounced ~90ms on width changes, not on height). The highway follows its host size.

### 3.3 States
- **Watch (Demo part):**
  - The workspace shows the video and the staff.
  - Section chips (from the score's sections) sit in the staff HUD; tapping one loops that section.
  - The video scrub bar follows the score position.
  - Action bar: "Watch {teacher} play it once" and **Your turn**.
- **Ready check:**
  - The calibration wizard, audio-mode prompt and mic test in `score-exercise-game.tsx` become one full-width screen with three tall panels.
    - Sound: speakers or headphones.
    - Microphone: a live level meter and the device name.
    - Timing: four clicks, the measured latency and a progress bar.
  - Each panel runs by itself and pops a green check when it's done. Any of them can be changed.
  - A "What you'll play" strip shows a static staff preview.
  - Action bar: **Start playing** (success tone).
  - Existing logic and storage are reused; only the order and presentation change. Returning students with a saved calibration see the checks already green.
- **Playing:**
  - The workspace in pip: staff (stacked by default) over the highway, video floating.
  - The action bar holds the transport and a **Finish take** ghost button.
- **Part done:**
  - A large accuracy ring (animated fill), a heading and a line comparing the take to the previous best.
  - Three stat tiles: clean bars, best combo, time.
  - A full-width **bar-by-bar strip** with one tile per bar coloured clean, early/late or missed; tapping a tile loops that bar.
  - A "Loop bars N and M" shortcut for the missed bars.
  - The strip is derived from the per-note judgements the scorer already produces (see Open questions).
- **Quiz (Check part):**
  - `FocusStage` in two columns: question on the left (eyebrow, 24–38px heading, prompt, an optional staff excerpt and clave figure), answer tiles on the right.
  - Tiles are large (20px padding, 16px text, 2px border, 4px bottom border). The selection is blue, correct is green, and a wrong answer shakes.
  - Check / Continue lives in the action bar.
  - Sheet mode and the other question inputs keep their behaviour and get the same spacing.
- **Lesson done:**
  - A full-width celebration: the streak flame with the day count flipping in, the weekly goal segments with today's lesson popping in (lessons against `WEEK_GOAL`, the same count as the dashboard card), the "N of 6 lessons this week" line, achievement progress cards (e.g. Rising Star, Monthly Master) animating from the previous value, and a next-lesson card.
  - Confetti uses the existing `Confetti` component.
  - Action bar: **Back to course** (ghost) and **Next lesson**.
- **Phones:**
  - The parts show only the active label, and the action bar stacks with the primary action full width.
  - The transport shows only pause and BPM.
  - Panels and columns stack.

## 4. Course detail: C3 hybrid

Rework `app/dashboard/course/[courseId]/course-detail-view.tsx` (and the phone bottom bar in `components/course/mobile-course-bar.tsx`). The background is plain.

- **Keep** every section and all copy that ships today:
  - Back link.
  - Badges (style, instrument, country, level dot), title, teacher row with View Profile, Watch preview, main CTA.
  - Module list, What you'll master, Requirements, instructor card.
  - Sticky summary card (cover and preview button, progress ring "Lesson X of Y", time left, 2×2 stats, CTA, "In your plan", included checklist).
  - Preview dialog.
- **Add "Your path"** under the hero:
  - A heading ("Your path · N of M lessons done") with arrow buttons, then the full-course `PathStrip` (§1.5) laid directly on the page with no card, border or panel.
  - Module boundaries show their checkpoint chest and a module flag.
- **Syllabus becomes compact:**
  - The current module shows the lessons from two before to two after the current one, with "Show all N lessons".
  - Other modules are collapsed with their progress segments.
  - Each module title links to the module overview page. This restores the link that the syllabus-first redesign dropped.
- The primary CTAs use the chunky button.
- **Phones:** the path strip scrolls horizontally with snap, the summary card collapses into the bottom bar (ring, "Lesson X of Y", Go), and the hover cards become tap-to-show.

## 5. Dashboard: D1

Change only what's listed in `app/dashboard/page.tsx` and `components/dashboard/home/*`. Everything else stays as shipped.

- **Faint background** (§1.3).
- **Chunky buttons** on Resume lesson (in `ContinueCard`), Watch review (`FeedbackCard`) and View plans (`UpgradeCard`). Secondary actions don't change.
- **"Your path" card:**
  - A new `YourPathCard` right under `ContinueCard`, about 160px tall on desktop.
  - It shows `PathStrip` sliced to the last two done lessons, the current one, the next three, a "N more" gap and the module checkpoint.
  - Header: "Your path · Module N · {title}" and a "Course map" link to the course page.
  - On phones it shows 5 nodes, smaller.
- **Streak + calendar card** replaces `PracticeCalendar` in the right rail:
  - A big animated flame (a gentle 1.6s flicker, off under reduced motion), "{N} days" and the best streak.
  - The weekly goal as segments in lessons against `WEEK_GOAL`, matching the existing logic in `lib/dashboard/practice-calendar.ts`.
  - The 5-week heatmap with day letters and today outlined, and a "5 weeks ago … Today" axis.
  - The data still comes from `lib/dashboard/streak.ts` and `lib/dashboard/practice-calendar.ts`.
- **Recommended for you** becomes poster cards in `RecommendedSection`:
  - A grid of 4:5 cards (`minmax(190px, 1fr)`), each with full cover art, the style word as large faint type, glass chips for the instrument and lesson count, the reason line, the title and the teacher with initials.
  - Hover: lift 4px, zoom the art 6%, show a play button, slide up a chunky **Preview**.
  - On phones it becomes a horizontal snap carousel at 62% card width with the Preview button always visible.
  - Reuse the cover generator from `lib/course-covers.ts` and `course-poster.tsx` where they fit.

## Out of scope
- The Studio editor staff, the PlaySense practice page and the other dashboard sub-pages.
- XP, hearts, leagues, a mascot, level-based helpers and the "fun" background.
- Changing the stage highway.

## Build order
Each phase gets its own implementation plan and ships on its own.

1. **Foundations:** chunky button, motion tokens, glyph stroke fix, `PageBackground`, `path-nodes` helper + `PathStrip`.
2. **Notation N1:** played state, playhead, bar band, helpers, stacked follow and half-ties, paged slide, layout switch.
3. **Workspace:** the extended `SplitWorkspace` (layouts, snap, PiP, FLIP, persistence), swapped into the watch and play views.
4. **Lesson mode:** shell bypass, rail, top bar, action bar, drawer, Ready check, Part done, Quiz layout, Lesson done.
5. **Course detail C3.**
6. **Dashboard D1.**

## Testing
- **Vitest for the pure logic:**
  - `path-nodes` (node order, states, checkpoints, windowing)
  - workspace math (snap, clamp, nearest corner, PiP size)
  - the stacked follow target
  - bars-per-row
  - the bar-by-bar result builder
- Update the existing `split-workspace.test.tsx`.
- **Browser checks** for each phase, in both themes, at desktop and phone widths, with reduced motion on. The Chrome extension has been unreliable on this machine; when it doesn't connect, fall back to headless Chrome over CDP as in the lab.
- **Performance:** the stacked glide and the playhead run on requestAnimationFrame with direct DOM writes (no React re-renders), as the renderer already does. Check that they hold 60fps at 140 BPM while the highway runs.

## Open questions (to settle in the phase plans, not blockers)
- **Chord symbols:** does the score model carry them (`NoteBase.text`, or a harmony field)? If not, N1 ships without them and the slot stays empty.
- **Per-bar results:** confirm the scorer exposes per-note judgements the Part done strip can group by bar. If it only has totals, the strip needs a small scorer change.
- **Lesson-mode shell bypass:** decide between a pathname check in `DashboardLayoutClient` and moving the lesson route into its own layout segment. The route URL must not change.
