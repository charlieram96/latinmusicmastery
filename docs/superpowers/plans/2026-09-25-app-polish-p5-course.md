# App Polish — Phase 5: Course detail C3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the course detail page into the approved C3 "Hybrid": a full-course lesson path under the hero, a compact syllabus, chunky primary CTAs and a phone bottom bar that carries the summary, while keeping every section and all copy that ships today.

**Architecture:**
- Path data comes from `buildPathNodes` (`lib/courses/path-nodes.ts`), fed from the `sections` the page already gets from `getCourseStructureForStudent` (each class carries `items` with `item_type` and `video_duration_seconds`, so nothing new is threaded through `page.tsx`).
- `PathStrip` (`components/course/path-strip.tsx`) gains module flags, tap-to-show cards on touch, mandatory snap on phones and the Phase 1 deferred minors.
- The syllabus window is a pure helper next to the view (`app/dashboard/course/[courseId]/syllabus-window.ts`).
- The progress ring moves to `components/course/progress-ring.tsx` so the view and the phone bar share it.

**Tech Stack:** Next.js (app router), React, TypeScript, Tailwind v3.4 + shadcn/ui, lucide-react, vitest (`// @vitest-environment jsdom` for component tests).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` §4 Course detail (and §1.5 Path strip). Visual reference: design lab 2 `course-app.js` variant `cx2` + `course-app.css`.

## Global Constraints

- Background stays plain on the course page (no `PageBackground`, no faint staff, no glow).
- Keep every section and all copy that ships today: back link; badges (fundamentals, style, instrument, country, level dot); title; teacher row with View Profile; Watch preview; main CTA; module list; What You'll Master; Requirements; instructor card; sticky summary card (cover + preview button, ring "Lesson X of Y", time left, 2×2 stats, CTA, "In your plan", included checklist); preview dialog; add-to-plan error.
- Chunky variants only for the main forward action (Continue lesson / Start the course / Subscribe to Unlock / Add to my plan / Go). Everything else keeps its existing variant.
- Every user-facing string through `useTranslation()`, keys in both `locales/en.json` and `locales/es.json`, under `dashboard.pages.course.*`. Plurals are two keys (`xOne` / `x`).
- Looping or decorative motion uses `motion-safe:`; nothing depends on an animation for layout.
- No `duration-[var(--x)]` / `ease-[var(--x)]` classes (they emit nothing).
- `PathStrip` is also used by Phase 6 at `size="compact"` with no flags: new behaviour is opt-in or neutral for that use.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Touch tap on a path node** must not navigate on the first tap (it shows the card with a "Go to lesson" link); a second tap on the same node, or the link, navigates; mouse clicks always navigate at once. Pinned in Task 2 (`first tap shows the card…`, `mouse click navigates at once`).
2. **Switching courses client-side** (same number of nodes, same current index) must re-run the scroll-to-current effect. Pinned in Task 2 (`re-scrolls when the items change identity`).
3. **Current lesson at the edge of its module** (first or last) shows only the lessons that exist (no negative slice), and a module with ≤ 5 lessons shows no "Show all" button. Pinned in Task 3 (`clamps at module edges`, `no toggle when the window covers the module`).
4. **No current lesson** (finished course, or an empty course with `nextClassId === null`): every module is collapsed and the heading still reads "N of M lessons done". Pinned in Task 3 (`nothing current collapses every module`) and Task 4 (`finished course`).
5. **Locked course** (not a student, next lesson not free): the phone bar's action is the subscribe link, not a "Go" into a lesson. Pinned in Task 5 (`locked shows the subscribe action`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `locales/en.json`, `locales/es.json` | modify | new `dashboard.pages.course.path.*` / `syllabus.*` keys; `path.types.quiz` → "Cuestionario" |
| `lib/__tests__/course-locale-keys.test.ts` | create | the new keys exist in both locales; Spanish type terms match the course namespace |
| `components/course/path-strip.tsx` | modify | flags, tap-to-show, phone snap, re-scroll on identity change |
| `components/course/__tests__/path-strip.test.tsx` | modify | tests for the above + geometry check |
| `components/course/progress-ring.tsx` | create | `ProgressRing` (moved from the view) |
| `app/dashboard/course/[courseId]/syllabus-window.ts` | create | `syllabusWindow`, `lessonSegments` |
| `app/dashboard/course/[courseId]/__tests__/syllabus-window.test.ts` | create | helper tests |
| `app/dashboard/course/[courseId]/course-detail-view.tsx` | modify | C3 layout |
| `app/dashboard/course/[courseId]/__tests__/course-detail-view.test.tsx` | create | view tests (jsdom) |
| `components/course/mobile-course-bar.tsx` | modify | ring + "Lesson X of Y" + action |
| `components/course/__tests__/mobile-course-bar.test.tsx` | create | bar tests |

`page.tsx` needs no change: `sections[].classes[].items` already carries `item_type` / `video_duration_seconds` (`getCourseStructureForStudent` selects `class_items (*)`).

---

### Task 1: Locale keys

**Files:** Modify `locales/en.json`, `locales/es.json`; Test `lib/__tests__/course-locale-keys.test.ts`.

**Interfaces — Produces** (all under `dashboard.pages.course`):
`path.heading` "Your path" / "Tu camino"; `path.doneOfOne` "{done} of {total} lesson done" / "{done} de {total} lección hecha"; `path.doneOf` "{done} of {total} lessons done" / "{done} de {total} lecciones hechas"; `path.module` "Module {n}" / "Módulo {n}"; `path.goToLesson` "Go to lesson" / "Ir a la lección"; `syllabus.showAll` "Show all {count} lessons" / "Ver las {count} lecciones"; `syllabus.showFewer` "Show fewer" / "Ver menos"; `syllabus.go` "Go" / "Ir"; es `path.types.quiz` → "Cuestionario".

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

const get = (o: unknown, path: string) => path.split('.').reduce<any>((a, k) => a?.[k], o)
const KEYS = ['path.heading', 'path.doneOfOne', 'path.doneOf', 'path.module', 'path.goToLesson', 'syllabus.showAll', 'syllabus.showFewer', 'syllabus.go']

describe('course page locale keys', () => {
  it.each(KEYS)('%s exists in en and es', (k) => {
    expect(typeof get(en, `dashboard.pages.course.${k}`)).toBe('string')
    expect(typeof get(es, `dashboard.pages.course.${k}`)).toBe('string')
  })
  it('Spanish path types use the same terms as the course item types', () => {
    const c = get(es, 'dashboard.pages.course')
    expect(c.path.types.quiz).toBe(c.itemTypes.QUIZ)
    expect(c.path.types.video).toBe(c.itemTypes.VIDEO)
  })
})
```

- [ ] **Step 2:** `npx vitest run lib/__tests__/course-locale-keys.test.ts` → FAIL (keys missing, quiz "Quiz").
- [ ] **Step 3:** Insert the keys with a node script that edits only `dashboard.pages.course.path` / `.syllabus` and re-serialises with 2-space indent (check `git diff --stat` touches only those lines).
- [ ] **Step 4:** Test passes.
- [ ] **Step 5:** Commit "Add course page path and syllabus strings; Spanish quiz type reads Cuestionario".

Ruling (recorded): the brief asked for "Vídeo", but `es.json` spells it "Video" in 3 of 4 places, including `dashboard.pages.course.itemTypes.VIDEO` in the same namespace (Latin American usage). `types.video` stays "Video"; only `types.quiz` changes to "Cuestionario".

---

### Task 2: PathStrip — deferred minors, module flags, tap-to-show, phone snap

**Files:** Modify `components/course/path-strip.tsx`, `components/course/__tests__/path-strip.test.tsx`.

**Interfaces — Produces:** `PathStrip` props gain `showModuleFlags?: boolean` (default false). Behaviour otherwise unchanged for existing callers.

- [ ] **Step 1: Failing tests** (append to the existing describe; helpers `tap(el)`, `mouseClick(el)` dispatch `pointerdown` with a defined `pointerType` then a cancelable `click`, returning `defaultPrevented`):

```tsx
const pointer = (el: Element, type: string, pointerType: string) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'pointerType', { value: pointerType })
  act(() => { el.dispatchEvent(ev) })
}
const click = (el: Element) => {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
  act(() => { el.dispatchEvent(ev) })
  return ev.defaultPrevented
}

it('wave y positions are whole pixels and the svg matches the track height (compact)', () => {
  act(() => root.render(<PathStrip items={ITEMS} ariaLabel="p" size="compact" />))
  for (const n of host.querySelectorAll<HTMLElement>('[data-path-node]')) expect(Number.isInteger(parseFloat(n.style.top))).toBe(true)
  const track = host.querySelector('[data-path-scroller] > div') as HTMLElement
  expect(host.querySelector('svg')?.getAttribute('height')).toBe(String(parseFloat(track.style.height)))
})

it('re-scrolls when the items change identity with the same length and current index', () => {
  const sets: number[] = []
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', { configurable: true, get: () => 0, set: (v: number) => { sets.push(v) } })
  render()
  const other = ITEMS.map((i) => ({ ...i, id: `x-${i.id}` })) as PathItem[]
  render(other)
  expect(sets).toHaveLength(2)
  delete (HTMLElement.prototype as { scrollLeft?: number }).scrollLeft
})

it('first tap on a touch device shows the card with a Go link instead of navigating', () => {
  render()
  const link = host.querySelector('a[href="/l/c"]')!
  pointer(link, 'pointerdown', 'touch')
  expect(click(link)).toBe(true)
  const tip = host.querySelector('[role="tooltip"]') as HTMLElement
  expect(tip.textContent).toContain('Lesson c')
  expect(tip.querySelector('a[href="/l/c"]')?.textContent).toContain('dashboard.pages.course.path.goToLesson')
  pointer(link, 'pointerdown', 'touch')
  expect(click(link)).toBe(false) // second tap navigates
})

it('mouse click navigates at once', () => {
  render()
  const link = host.querySelector('a[href="/l/c"]')!
  pointer(link, 'pointerdown', 'mouse')
  expect(click(link)).toBe(false)
})

it('a tapped card closes on a tap outside the strip', () => {
  render()
  const link = host.querySelector('a[href="/l/c"]')!
  pointer(link, 'pointerdown', 'touch'); click(link)
  pointer(document.body, 'pointerdown', 'touch')
  expect(host.querySelector('[role="tooltip"]')).toBeNull()
})

it('touch compatibility mouse events do not open the hover card', () => {
  render()
  const node = host.querySelectorAll<HTMLElement>('[data-path-node]')[2]
  pointer(node.querySelector('a')!, 'pointerdown', 'touch')
  act(() => { node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
  expect(host.querySelector('[role="tooltip"]')).toBeNull()
})

it('module flags mark where each module starts and link to its overview', () => {
  const two: PathItem[] = [
    lesson('a', 1, 'done'), { kind: 'checkpoint', id: 'cp0', moduleIndex: 0, moduleTitle: 'Welcome', state: 'done', href: '/m/0' },
    { ...lesson('b', 2, 'current'), moduleIndex: 1 } as PathItem, { kind: 'checkpoint', id: 'cp1', moduleIndex: 1, moduleTitle: 'Rhythm', state: 'upcoming', href: '/m/1' },
  ]
  act(() => root.render(<PathStrip items={two} ariaLabel="p" showModuleFlags />))
  const flags = [...host.querySelectorAll('[data-path-flag]')]
  expect(flags.map((f) => f.textContent)).toEqual(['dashboard.pages.course.path.module(1)Welcome', 'dashboard.pages.course.path.module(2)Rhythm'])
  expect(flags[1].getAttribute('href')).toBe('/m/1')
})

it('no flags unless asked', () => {
  render()
  expect(host.querySelector('[data-path-flag]')).toBeNull()
})
```

- [ ] **Step 2:** `npx vitest run components/course/__tests__/path-strip.test.tsx` → the new tests FAIL (geometry test may already pass: that minor is verified, not changed).
- [ ] **Step 3: Implement** in `path-strip.tsx`:
  - `const itemsKey = items.map((i) => i.id).join('|')`; scroll effect deps `[currentIndex, STEP, itemsKey]`.
  - `TOP = showModuleFlags ? 140 : 116` (a 20px flag row above the bubble's highest reach: min y 122 − 34 − 52 − 6 = 30).
  - Flags: for each lesson item whose `moduleIndex` differs from the previous lesson item's, render `<Link data-path-flag href={checkpoint.href}>` at `left: max(0, x − 30)`, `top: 0`, one line: amber uppercase "Module N" + title, `max-width: 2·STEP − 24`, truncated; muted border when every lesson in the module is upcoming. Title and href come from the module's checkpoint; without one it's a plain `span`.
  - Tap-to-show: `touch = useRef(false)`; node wrapper `onPointerDown={(e) => { touch.current = e.pointerType !== 'mouse' }}`, `onPointerEnter` resets it for a real mouse, `onKeyDown` resets it; `onMouseEnter`/`onFocus` show the card only when `!touch.current`; `onMouseLeave`/`onBlur` hide it only when not pinned. The lesson Link's `onClick`: when `touch.current` and the card isn't pinned on this node, `preventDefault()` and pin the card. The pinned card is `pointer-events-auto` and ends with a `Link` "Go to lesson". An effect while pinned closes it on `pointerdown` outside the card and outside any node, and on Escape. Scrolling closes it (existing).
  - Phone snap: scroller `max-md:[scroll-snap-type:x_mandatory]`.
- [ ] **Step 4:** tests pass; `npx tsc --noEmit -p .`; `npx eslint components/course/path-strip.tsx`.
- [ ] **Step 5:** Commit "PathStrip: module flags, tap-to-show cards on touch, phone snap, re-scroll on new items".

Ruling: first tap on touch pins the card (with a "Go to lesson" link); a second tap on the same node navigates. Checkpoints have no card, so they navigate on the first tap.

---

### Task 3: Syllabus window helper

**Files:** Create `app/dashboard/course/[courseId]/syllabus-window.ts` + `__tests__/syllabus-window.test.ts`.

**Interfaces — Produces:**
```ts
export function syllabusWindow(classIds: string[], currentId: string | null, radius?: number): { visible: string[]; collapsible: boolean }
export type Segment = 'done' | 'current' | 'upcoming'
export function lessonSegments(classes: { id: string; totalItems: number; completedItems: number }[], currentId: string | null): { state: Segment; fraction: number }[]
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { lessonSegments, syllabusWindow } from '../syllabus-window'

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
describe('syllabusWindow', () => {
  it('shows two before and two after the current lesson', () => {
    expect(syllabusWindow(ids, 'e')).toEqual({ visible: ['c', 'd', 'e', 'f', 'g'], collapsible: true })
  })
  it('clamps at module edges', () => {
    expect(syllabusWindow(ids, 'a').visible).toEqual(['a', 'b', 'c'])
    expect(syllabusWindow(ids, 'h').visible).toEqual(['f', 'g', 'h'])
  })
  it('no toggle when the window covers the module', () => {
    expect(syllabusWindow(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual({ visible: ['a', 'b', 'c', 'd', 'e'], collapsible: false })
  })
  it('nothing current collapses every module', () => {
    expect(syllabusWindow(ids, null)).toEqual({ visible: [], collapsible: true })
    expect(syllabusWindow(ids, 'elsewhere')).toEqual({ visible: [], collapsible: true })
    expect(syllabusWindow([], null)).toEqual({ visible: [], collapsible: false })
  })
})

describe('lessonSegments', () => {
  it('one segment per lesson, the current one filled by item progress', () => {
    expect(lessonSegments([
      { id: 'a', totalItems: 2, completedItems: 2 },
      { id: 'b', totalItems: 4, completedItems: 1 },
      { id: 'c', totalItems: 0, completedItems: 0 },
    ], 'b')).toEqual([{ state: 'done', fraction: 1 }, { state: 'current', fraction: 0.25 }, { state: 'upcoming', fraction: 0 }])
  })
})
```

- [ ] **Step 2:** FAIL (module missing).
- [ ] **Step 3: Implement**

```ts
export function syllabusWindow(classIds: string[], currentId: string | null, radius = 2) {
  const i = currentId === null ? -1 : classIds.indexOf(currentId)
  const visible = i === -1 ? [] : classIds.slice(Math.max(0, i - radius), i + radius + 1)
  return { visible, collapsible: visible.length < classIds.length }
}
export type Segment = 'done' | 'current' | 'upcoming'
export function lessonSegments(classes: { id: string; totalItems: number; completedItems: number }[], currentId: string | null) {
  return classes.map((c) => {
    const done = c.totalItems > 0 && c.completedItems >= c.totalItems
    if (c.id === currentId && !done) return { state: 'current' as const, fraction: c.totalItems > 0 ? c.completedItems / c.totalItems : 0 }
    return done ? { state: 'done' as const, fraction: 1 } : { state: 'upcoming' as const, fraction: 0 }
  })
}
```

- [ ] **Step 4:** pass. **Step 5:** Commit "Add the compact syllabus window helper".

---

### Task 4: Course detail view (C3)

**Files:** Create `components/course/progress-ring.tsx`; modify `app/dashboard/course/[courseId]/course-detail-view.tsx`; test `app/dashboard/course/[courseId]/__tests__/course-detail-view.test.tsx`.

**Interfaces:**
- Consumes: `buildPathNodes(courseId, PathSectionInput[], currentClassId)`, `PathStrip({ items, ariaLabel, showArrows, showModuleFlags })`, `syllabusWindow`, `lessonSegments`, `Button` variant `chunky`.
- Produces: `ProgressRing({ pct, size? })`; `MobileCourseBar` new props (Task 5).

Layout (lab `cx2`): a two-column grid `lg:grid-cols-[minmax(0,1fr)_360px]` whose left column holds back link, header (badges, title, teacher row, CTAs), phone stats row (`lg:hidden`, the four summary stats), **Your path** (`<section aria-labelledby>`: `h2` "Your path" + muted "N of M lessons done", then `PathStrip items={pathNodes} showArrows showModuleFlags` with the arrows in the heading row, no card), description, compact syllabus, details; the right column is the sticky summary card (unchanged content). Syllabus per module: number, title `Link` to `moduleOverviewHref` (kept), "N lessons · status", segment bar, description, rows from `syllabusWindow` (all rows when expanded), and a toggle button "Show all N lessons" / "Show fewer" (`aria-expanded`) when `collapsible`. Primary CTA uses `variant="chunky"`.

- [ ] **Step 1: Failing tests** (mocks: `next/link`, `next/image`, language provider `t(key, params) → key(params…)`, `@/app/actions/billing`, `HeaderTitleOverride`, `EnterCourseModeButton` rendering `<button data-variant={variant}>`):

```tsx
it('renders Your path with the done count and the full-course strip', …
  // heading text contains 'path.heading' and 'path.doneOf(1,7)'; strip has 7 lesson links + 2 checkpoints
it('current module shows current ±2 lessons and a Show all toggle', …
  // module 2 of the fixture has 6 lessons, current is its 4th: rows 2..6 visible, toggle 'syllabus.showAll(6)'; click → 6 rows, 'syllabus.showFewer'
it('other modules are collapsed with progress segments and a title link to the overview', …
  // module 1 has 0 rows visible, 1 done segment; title link href '/dashboard/course/son/module/s1'
it('primary CTAs are chunky', … // every EnterCourseModeButton mock has data-variant="chunky"
it('finished course: all modules collapsed, heading still counts', …
it('keeps every section heading that ships today', … // whatYoullMaster.heading, requirements.heading, yourInstructor, included items
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** pass + tsc + eslint. **Step 5:** Commit "Course detail: C3 hybrid layout with the lesson path and a compact syllabus".

---

### Task 5: Phone bottom bar

**Files:** Modify `components/course/mobile-course-bar.tsx`; test `components/course/__tests__/mobile-course-bar.test.tsx`.

**Interfaces — Produces:**
```ts
interface MobileCourseBarProps { progressPercentage: number; title: string; subtitle?: string | null; action: React.ReactNode }
```
The view passes `title` = the summary card's "Lesson X of Y" / Completed / Not started line, `subtitle` = current lesson title, and `action` = a chunky `sm` Go button (`EnterCourseModeButton`, `aria-label` "Continue lesson") when unlocked, else the same primary CTA at `sm` (subscribe / add to plan / coming soon).

- [ ] **Step 1: Failing tests:** renders ring with `{pct}%`, the title and subtitle, and the action node; `locked shows the subscribe action` (view-level test in Task 4's file: with `locked` the bar contains the subscribe link, no Go).
- [ ] **Steps 2–5:** fail → implement (`fixed inset-x-0 bottom-0 lg:hidden`, `ProgressRing size={44}`, text column `min-w-0 flex-1` truncating) → pass → commit "Phone course bar carries the summary: ring, lesson X of Y and Go".

---

### Task 6: Visual check, build

- [ ] Temporary `app/playsense-preview/course-detail/page.tsx` (dev-only `notFound()` gate) rendering `CourseDetailView` with the real Son Cubano Timbal structure (read-only SELECT) and fixture progress. Screenshot desktop 1440×900 and phone 390×844, dark and light, reduced motion, hover card and a tapped card. Delete the page; don't commit it.
- [ ] `npx vitest run`, `npx tsc --noEmit -p .`, `npm run build`.
