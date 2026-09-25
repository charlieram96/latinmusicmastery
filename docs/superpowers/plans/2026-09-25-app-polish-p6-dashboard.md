# App Polish — Phase 6: Dashboard D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard home the D1 polish: chunky primary buttons, a compact "Your path" card, a streak + calendar card and poster-style recommendations, plus the two deferred Phase 1 minors (chunky sizes, the home wrapper's stacking context).

**Architecture:**
- The path data comes from a new pure helper `lib/dashboard/your-path.ts`, fed by the rows `app/dashboard/page.tsx` already loads (two extra columns in the existing select, no extra query). It calls `buildPathNodes` + `pathWindow` from `lib/courses/path-nodes.ts` and hands `YourPathCard` a ready slice for desktop and for phones.
- `StreakCard` replaces `PracticeCalendar` on the home rail only (the progress page keeps `PracticeCalendar`). Its data is unchanged: `computeStreaks` + `buildPracticeCalendar` + `WEEK_GOAL`.
- `RecommendedSection` keeps its filters and reasons and swaps its featured + list layout for 4:5 poster cards.
- The chunky sizes are cva `compoundVariants`, so non-chunky sizes are untouched.

**Tech Stack:** Next.js app router, React, TypeScript, Tailwind v3.4 + shadcn (cva + tailwind-merge), lucide-react, vitest (jsdom for components).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` §5 (Dashboard: D1), §1.1 (chunky sizes). Lab reference: `lab2/src/dash-app.js` variant `d1` (`pathCard()`, `streakCard()`, `recommended()`) and the `.dh-rp-*`, `.dh-streak*`, `.dh-path*` rules in `dash-app.css`.

## Global Constraints

- Change only `app/dashboard/page.tsx`, `components/dashboard/home/*`, `components/ui/button.tsx`, the new `lib/dashboard/your-path.ts` and the `dashboard.pages.home.*` locale keys. Do NOT edit `components/course/path-strip.tsx` or `lib/courses/path-nodes.ts` (Phase 5 owns them this round).
- Chunky sizes, verbatim from the spec: `sm` (8px 14px, 12px text), `default` (12px 22px, 14px text), `lg` larger.
- Chunky buttons only on Resume lesson (ContinueCard), Watch review (FeedbackCard), View plans (UpgradeCard) and the poster Preview. Secondary actions keep their variants.
- "Your path": PathStrip `size="compact"`, `pathWindow(nodes, { before: 2, after: 3 })`; header "Your path · Module N · {title}" + "Course map" link; 5 nodes on phones.
- Streak card: 1.6s flame flicker, `prefers-reduced-motion` off; weekly goal in LESSONS against `WEEK_GOAL`; 5-week heatmap, day letters, today outlined, "5 weeks ago … Today" axis.
- Posters: 4:5, `minmax(190px, 1fr)` grid; hover lift 4px, art zoom 6%, play button, chunky Preview slides up; phone: snap carousel at 62% card width, Preview always visible.
- Every looping or decorative motion is `motion-safe:` (or wrapped in `prefers-reduced-motion: no-preference`); nothing depends on an animation for layout.
- No `duration-[var(..)]`/`ease-[var(..)]` classes; use named keys (`duration-pop`, `ease-smooth`) or arbitrary properties.
- Every string through `useTranslation()`, keys in `locales/en.json` and `locales/es.json`, plurals as `xOne` / `x`.
- No XP, hearts, levels, pinned rail, system theme, or max-width container on the dashboard.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Continue course whose current lesson sits in a later module** (module 3 of 4): the header must name that module ("Module 3 · …"), not module 1, and the checkpoint shown must be module 3's. Pinned in Task 2 (`names the module that holds the current lesson`).
2. **A finished course** (every lesson done): no current node, the slice ends at the last lesson + its checkpoint, the card still renders. Pinned in Task 2 (`finished course anchors on the last lesson`).
3. **Unsorted rows from Supabase** (sections and classes come back in insertion order, not `order_index`): the path must follow `order_index`. Pinned in Task 2 (`orders sections and classes by order_index`).
4. **Weekly goal overshoot and zero**: 9 lessons against a goal of 6 fills all 6 segments and says "Reached"; 0 lessons shows 6 empty segments. Pinned in Task 4 (`caps the goal segments`).
5. **Today early in the week** (Sunday/Monday): the "Today" axis label sits under today's column and the "5 weeks ago" label never collides with it. Pinned in Task 4 (`puts Today under today's column`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `components/ui/button.tsx` | modify | chunky `sm` / `default` / `lg` sizes as compound variants |
| `components/ui/__tests__/button.test.ts` | modify | size contract |
| `lib/dashboard/your-path.ts` | create | home rows → `PathSectionInput` → windowed path + module header |
| `lib/dashboard/__tests__/your-path.test.ts` | create | helper tests |
| `components/dashboard/home/your-path-card.tsx` | create | the "Your path" card |
| `components/dashboard/home/streak-card.tsx` + `streak-card.module.css` | create | streak + goal + heatmap card, flame flicker |
| `components/dashboard/home/recommended-section.tsx` | modify | poster grid / phone carousel |
| `components/dashboard/home/continue-card.tsx`, `feedback-card.tsx`, `upgrade-card.tsx` | modify | chunky primary actions |
| `components/dashboard/home/__tests__/*.test.tsx` | create | component tests (jsdom) |
| `app/dashboard/page.tsx` | modify | select `item_type` + section titles, build the path, mount the new cards, stacking-context ruling |
| `locales/en.json`, `locales/es.json` | modify | `dashboard.pages.home.path.*`, `.streak.*`, `.recommended.previewCta`, `.recommended.lessonsOne` |

---

### Task 1: Chunky button sizes

**Files:** Modify `components/ui/button.tsx`, `components/ui/__tests__/button.test.ts`

**Interfaces:** Produces `buttonVariants({ variant: 'chunky*', size: 'sm' | 'default' | 'lg' })` with padding-based sizing; other variants unchanged.

- [ ] **Step 1: Write the failing test** (append to `button.test.ts`)

```ts
describe('chunky sizes', () => {
  const tones = ['chunky', 'chunky-success', 'chunky-danger', 'chunky-ghost'] as const
  const has = (cls: string, token: string) => cls.split(/\s+/).includes(token)

  it('sm is 8px 14px with 12px text and no fixed height', () => {
    const cls = buttonVariants({ variant: 'chunky', size: 'sm' })
    for (const t of ['h-auto', 'px-[14px]', 'py-2', 'text-xs', 'has-[>svg]:px-[14px]']) expect(has(cls, t)).toBe(true)
    for (const t of ['h-9', 'px-4', 'has-[>svg]:px-3']) expect(has(cls, t)).toBe(false)
  })
  it('default is 12px 22px with 14px text', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    for (const t of ['h-auto', 'px-[22px]', 'py-3', 'text-sm']) expect(has(cls, t)).toBe(true)
    for (const t of ['h-10', 'px-5']) expect(has(cls, t)).toBe(false)
  })
  it('lg is larger: 14px 28px with 16px text', () => {
    const cls = buttonVariants({ variant: 'chunky', size: 'lg' })
    for (const t of ['h-auto', 'px-7', 'py-3.5', 'text-base']) expect(has(cls, t)).toBe(true)
    expect(has(cls, 'h-11')).toBe(false)
  })
  it('applies to every chunky tone', () => {
    for (const v of tones) expect(has(buttonVariants({ variant: v, size: 'sm' }), 'px-[14px]')).toBe(true)
  })
  it('non-chunky sizes are unchanged', () => {
    expect(buttonVariants({ size: 'sm' })).toContain('h-9 gap-1.5 px-4 text-xs')
    expect(buttonVariants({ variant: 'outline', size: 'lg' })).toContain('h-11 px-6')
  })
})
```

- [ ] **Step 2:** `npx vitest run components/ui/__tests__/button.test.ts` → FAIL (`h-auto` missing).
- [ ] **Step 3: Implement** — in `baseButtonVariants` add:

```ts
const CHUNKY_VARIANTS = ['chunky', 'chunky-success', 'chunky-danger', 'chunky-ghost'] as const
// ...
compoundVariants: [
  { variant: [...CHUNKY_VARIANTS], size: 'sm', class: 'h-auto gap-1.5 px-[14px] py-2 text-xs has-[>svg]:px-[14px]' },
  { variant: [...CHUNKY_VARIANTS], size: 'default', class: 'h-auto px-[22px] py-3 text-sm has-[>svg]:px-[22px]' },
  { variant: [...CHUNKY_VARIANTS], size: 'lg', class: 'h-auto px-7 py-3.5 text-base has-[>svg]:px-7' },
],
```
(`buttonVariants` already runs the output through tailwind-merge, so the compound classes replace the shared `h-*`/`px-*`.)
- [ ] **Step 4:** re-run → PASS. Probe emitted CSS for `px-[14px]`, `has-[>svg]:px-[14px]`, `py-3.5` with postcss + tailwind (`content: [{ raw }]`).
- [ ] **Step 5: Commit** `Give chunky buttons their own sizes`

### Task 2: Your-path helper

**Files:** Create `lib/dashboard/your-path.ts`, `lib/dashboard/__tests__/your-path.test.ts`

**Interfaces:**
- Consumes `buildPathNodes`, `pathWindow`, `PathItem`, `PathSectionInput` from `lib/courses/path-nodes.ts`; `byOrder`, `courseHref` from `lib/dashboard/course-progress.ts`.
- Produces:

```ts
export interface YourPathItemRow { id: string; order_index?: number | null; item_type?: string | null; video_duration_seconds: number | null }
export interface YourPathClassRow { id: string; title: string; order_index: number | null; items: YourPathItemRow[] | null }
export interface YourPathSectionRow { id: string; title?: string | null; order_index: number | null; classes: YourPathClassRow[] | null }
export interface YourPath { courseHref: string; moduleNumber: number; moduleTitle: string; items: PathItem[]; phoneItems: PathItem[] }
export function yourPathFor(course: { id: string; slug: string | null; course_sections: YourPathSectionRow[] | null }, completed: Set<string>, currentClassId: string | null): YourPath | null
```

- [ ] **Step 1: Failing tests** — cases: orders sections and classes by `order_index`; names the module that holds the current lesson (module 3 of 4, title + number, checkpoint is that module's); desktop slice = 2 done + current + 3 next + gap + checkpoint; phone slice has exactly 5 nodes (1 before, current, 2 after, checkpoint) and no gap; finished course anchors on the last lesson with no current; a course with no lessons → `null`; hrefs use the slug; item types come through (`EXERCISE` → `play`).
- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3: Implement**

```ts
export function yourPathFor(course, completed, currentClassId): YourPath | null {
  const sections = [...(course.course_sections ?? [])].sort(byOrder).map((s) => ({
    id: s.id,
    title: s.title ?? '',
    classes: [...(s.classes ?? [])].sort(byOrder).map((c) => {
      const items = [...(c.items ?? [])].sort(byOrder)
      return {
        id: c.id, title: c.title, totalItems: items.length,
        completedItems: items.filter((it) => completed.has(it.id)).length,
        items: items.map((it) => ({ item_type: it.item_type ?? '', video_duration_seconds: it.video_duration_seconds })),
      }
    }),
  }))
  const nodes = buildPathNodes(course.slug || course.id, sections, currentClassId)
  if (!nodes.some((n) => n.kind === 'lesson')) return null
  const items = pathWindow(nodes, { before: 2, after: 3 })
  const phoneItems = pathWindow(nodes, { before: 1, after: 2 }).filter((i) => i.kind !== 'gap')
  const anchor = items.find((i) => i.kind === 'lesson' && i.state === 'current') ?? [...items].reverse().find((i) => i.kind === 'lesson')
  const moduleIndex = anchor && anchor.kind === 'lesson' ? anchor.moduleIndex : 0
  return { courseHref: courseHref(course), moduleNumber: moduleIndex + 1, moduleTitle: sections[moduleIndex]?.title ?? '', items, phoneItems }
}
```
(`order_index` is optional on items, so `byOrder` gets a nullable field; widen with `order_index: it.order_index ?? null`.)
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `Add the home "Your path" data helper`

### Task 3: YourPathCard + page wiring

**Files:** Create `components/dashboard/home/your-path-card.tsx`, `components/dashboard/home/__tests__/your-path-card.test.tsx`; modify `app/dashboard/page.tsx`, locales.

**Interfaces:** `YourPathCard({ path }: { path: YourPath | null })`. Locale keys `dashboard.pages.home.path.{title,module,courseMap}`.

- [ ] **Step 1: Failing test** (jsdom; mock `language-provider`, `next/link`, and `@/components/course/path-strip` to a stub that prints `size` and item ids): renders nothing for `null`; header has `path.title`, `path.module(3,Groove)`, and a "Course map" link to `courseHref`; one compact strip with the desktop items (`hidden md:block`) and one with the phone items (`md:hidden`).
- [ ] **Step 2:** run → FAIL (module not found).
- [ ] **Step 3: Implement** the card: header row (route chip, `h2`, muted "· Module N · title" hidden below `sm`, "Course map" link right) with `relative z-10` so it stays clickable over the strip's empty top band; two `PathStrip size="compact"` with `-mt-4 -mb-3` to reclaim the strip's unused top/bottom band.
- [ ] **Step 4:** page.tsx: add `title, title_es` to `course_sections(...)` and `item_type` to `class_items(...)` in the enrollments select; localize section titles; in the continue block call `yourPathFor(course, completed, cls.id)`; render `<YourPathCard path={yourPath} />` at the top of the left column (right under the hero, as in the lab).
- [ ] **Step 5:** locale keys via a node script (EN: `Your path`, `Module {n} · {title}`, `Course map`; ES: `Tu camino`, `Módulo {n} · {title}`, `Mapa del curso`).
- [ ] **Step 6:** run tests + `npx tsc --noEmit -p .` → PASS. **Commit** `Add the Your path card to the dashboard home`

### Task 4: Streak + calendar card

**Files:** Create `components/dashboard/home/streak-card.tsx`, `streak-card.module.css`, `__tests__/streak-card.test.tsx`; modify `app/dashboard/page.tsx`, locales.

**Interfaces:** `StreakCard({ cells, weekDone, weekGoal, streak, bestStreak })` — same props as `PracticeCalendar`. Exported pure `heatAxis(cells: CalendarCell[]): { todayColumn: number; showStart: boolean }` (1-based column; `showStart` when `todayColumn >= 3`).

- [ ] **Step 1: Failing tests:** big number uses `streak.days(12)` / `streak.daysOne(1)`; best line; caps the goal segments (`weekGoal` segments, `min(done, goal)` filled, "Reached" when done ≥ goal, "to go" otherwise, 0 → none filled); heatmap has 35 cells + 7 day letters, today's cell has the outline class; puts Today under today's column (`heatAxis` for a Friday → 6/true, Monday → 2/false, Sunday → 1/false); the flame animates only when the streak is live, and only through the module class (no inline animation).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Flame: lucide `Flame` 44px, `fill-primary/20`, class `styles.flicker` when `streak > 0`. CSS module:

```css
@keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.06, .96) rotate(-3deg); } 60% { transform: scale(.97, 1.05) rotate(2deg); } }
@media (prefers-reduced-motion: no-preference) {
  .flicker { animation: flicker 1.6s ease-in-out infinite; transform-origin: 50% 90%; }
}
```
Goal row "Weekly goal · N of G lessons" + "K to go"/"Reached"; `weekGoal` segments. Heatmap: day letters row, 7-col grid of `cells` (level colours as today, future = inset ring, today = `outline outline-2 outline-offset-1 outline-primary`), axis row from `heatAxis`.
- [ ] **Step 4:** page.tsx: swap `PracticeCalendar` for `StreakCard` (progress page keeps `PracticeCalendar`).
- [ ] **Step 5:** locale keys `streak.{title,days,daysOne,best,bestOne,weeklyGoal,goalProgress,toGo,reached,heatLabel,fiveWeeksAgo,today,cell,cellOne}`. Run tests → PASS. **Commit** `Replace the home practice calendar with the streak card`

### Task 5: Chunky primary actions

**Files:** Modify `continue-card.tsx`, `feedback-card.tsx`, `upgrade-card.tsx`; create `__tests__/chunky-actions.test.tsx`.

- [ ] **Step 1: Failing test:** Resume link has `rounded-[14px]` + `shadow-[0_4px_0_hsl(var(--primary-deep))]`, Course details does not; Watch review chunky, Send a new clip not; View plans chunky.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** `variant="chunky"` (Resume: default size, 44px tall to match the `lg` "Course details"; Watch review + View plans: `size="sm"`). Empty-state "Browse courses" and "Send a clip" stay as they are (not in the spec's list).
- [ ] **Step 4:** run → PASS. **Commit** `Use chunky buttons for the home's primary actions`

### Task 6: Poster recommendations

**Files:** Modify `recommended-section.tsx`; create `__tests__/recommended-section.test.tsx`; locales (`recommended.previewCta`, `recommended.lessonsOne`).

- [ ] **Step 1: Failing test:** renders up to 4 `[data-poster]` links with `aspect-[4/5]`; each shows reason, title, teacher initials, instrument chip and lesson count (`lessonsOne` for 1); the Preview is a chunky span inside the link (no nested interactive element), aria-hidden; the list container is a snap carousel below `md` (`snap-x`, cards `w-[62%]`) and the `minmax(190px,1fr)` grid from `md`; the hover lift and art zoom are `motion-safe:`; filters still filter.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** the poster (cover image or `coverStyle` gradient + `InstrumentGlyph`, stripe + bottom scrim, style word 56px at 20% opacity, `GlassChip`s, play disc, body, Preview in a `grid-rows-[0fr]→[1fr]` reveal so hidden padding doesn't leak).
- [ ] **Step 4:** run → PASS. **Commit** `Turn the home recommendations into poster cards`

### Task 7: Home stacking context ruling

- [ ] Verify: header `fixed z-40`, rail `z-50`, mobile nav `z-40`, `PageBackground` `fixed z-0`; every home overlay (Radix menus, tooltips) is portaled or stays inside its card. Keep `relative z-[1]` (content must paint above the fixed z-0 background; a z-auto wrapper would drop any stray negative-z child behind the shell's background). Add a comment in page.tsx. Commit with the Task 3/4 page edits.

### Final: full suite, tsc, eslint, build, visual check (temporary preview page, deleted before commit), review.
