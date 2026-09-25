# App Polish — Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared building blocks the later phases use: the chunky button, motion tokens, the notation glyph-stroke fix, the lesson-path data helper and `PathStrip` component, and the dashboard's faint background.

**Architecture:**
- Tokens live in `app/globals.css` and are exposed through `tailwind.config.js`.
- The chunky button is new cva variants on the existing shadcn `Button`.
- Path data is a pure, unit-tested helper (`lib/courses/path-nodes.ts`), drawn by a client component (`components/course/path-strip.tsx`).
- The background art is a pure, seeded generator (`lib/dashboard/page-background.ts`), drawn by `components/dashboard/page-background.tsx` and mounted only on the dashboard home.

**Tech Stack:** Next.js (app router), React, TypeScript, Tailwind v3.4 + shadcn/ui (cva), lucide-react, vitest (node env by default, `// @vitest-environment jsdom` for component tests).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` (§1 Shared foundations). The visual reference is the LMM Design Lab 2 artifact, v4: https://claude.ai/artifact/C2TSUaq8JyWrTQbSJyHstW (Dashboard and Course detail tabs).

## Global Constraints

- Keep the design language: Studio Amber tokens, Inter + Montserrat (`font-heading`), dark or light only. Colour values are bare HSL channels used as `hsl(var(--x))`.
- No XP, hearts or skill-level variation. Nothing in this phase adds game mechanics.
- Motion tokens, verbatim from the spec:
  - `--ease-out: cubic-bezier(.22,1,.36,1)`
  - `--ease-spring: cubic-bezier(.34,1.56,.64,1)`
  - `--dur-tap: 120ms`
  - `--dur-state: 180ms`
  - `--dur-pop: 320ms`
  - `--dur-turn: 400ms`
- `prefers-reduced-motion` turns off pulses, bobbing and drifting. Use Tailwind `motion-safe:` for every looping animation.
- Every user-facing string goes through `useTranslation()`, with keys added to both `locales/en.json` and `locales/es.json`. Plurals are two keys (`xOne` / `x`) with `{count}`.
- The background only appears on `/dashboard` (home). Every other page stays plain.
- Work on branch `feat/app-polish`, created from `playsense`. Create it with the superpowers:using-git-worktrees skill; the user runs parallel sessions on the main checkout.
- Dev server: `npm run dev -- -p 3006` (port 3000 is taken). The dev DB is the hosted Supabase project.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A course whose module has zero lessons.** The helper must emit no nodes for that module, and in particular no orphan checkpoint. Pinned in Task 3 (`skips empty modules`).
2. **A lesson with zero items (`totalItems === 0`)** must not count as done (0/0), or the current lesson would skip past it. Pinned in Task 3 (`0-item lessons are not done`).
3. **A finished course (every lesson done)** has no current node. Every checkpoint is done, and the strip scrolls to its end rather than the start. Pinned in Task 3 (`finished course has no current`) and Task 4 (`scrolls to the end when nothing is current`).
4. **A stale `currentClassId`** (the lesson was deleted or belongs to another course) must fall back to the first unfinished lesson instead of producing no current node. Pinned in Task 3 (`unknown current id falls back`).
5. **Reduced motion:** the current node's pulse and the bubble's bob must stop. Pinned in Task 4 (`looping animations are motion-safe`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/globals.css` | modify | `--primary-deep`, `--success-deep`, `--danger-deep` (both themes); motion tokens; glyph `stroke: none` fix |
| `tailwind.config.js` | modify | `primary.deep`, `success.deep`, `danger.deep` colours; `ease-smooth`/`ease-spring` timing; `duration-tap/state/pop/turn`; `bob`, `ring-pulse` keyframes |
| `components/ui/button.tsx` | modify | `chunky`, `chunky-success`, `chunky-danger`, `chunky-ghost` variants |
| `components/ui/__tests__/button.test.ts` | create | variant class contract |
| `lib/courses/path-nodes.ts` | create | `buildPathNodes`, `pathWindow`, types |
| `lib/courses/__tests__/path-nodes.test.ts` | create | helper tests |
| `components/course/path-strip.tsx` | create | horizontal path UI |
| `components/course/__tests__/path-strip.test.tsx` | create | component tests (jsdom) |
| `locales/en.json`, `locales/es.json` | modify | `dashboard.pages.course.path.*` keys |
| `lib/dashboard/page-background.ts` | create | seeded art generator |
| `lib/dashboard/__tests__/page-background.test.ts` | create | generator tests |
| `components/dashboard/page-background.tsx` | create | fixed, faint SVG layer |
| `app/dashboard/page.tsx` | modify | mount `PageBackground`, lift content above it |

---

### Task 1: Tokens and the chunky button

**Files:**
- Modify: `app/globals.css` (the `:root` block starting line 13 and the `.dark` block starting line 81)
- Modify: `tailwind.config.js` (`theme.extend`)
- Modify: `components/ui/button.tsx`
- Test: `components/ui/__tests__/button.test.ts`

**Interfaces:**
- Produces: `buttonVariants({ variant: 'chunky' | 'chunky-success' | 'chunky-danger' | 'chunky-ghost', size })`, and `<Button variant="chunky">`.
- Produces Tailwind utilities: `bg-primary-deep` (as `primary.deep`), `ease-smooth`, `ease-spring`, `duration-tap`, `duration-state`, `duration-pop`, `duration-turn`, `animate-bob`, `animate-ring-pulse`.

- [ ] **Step 1: Write the failing test**

Create `components/ui/__tests__/button.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buttonVariants } from '../button'

describe('chunky button variants', () => {
  it('chunky has the 3D bottom edge, press-down and heading type', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    expect(cls).toContain('shadow-[0_4px_0_hsl(var(--primary-deep))]')
    expect(cls).toContain('active:translate-y-[4px]')
    expect(cls).toContain('active:shadow-none')
    expect(cls).toContain('font-heading')
    expect(cls).toContain('uppercase')
    // the base press-shrink must not fight the press-down
    expect(cls).not.toContain('active:scale-[0.98]')
  })

  it('tones use their own deep edge colour', () => {
    expect(buttonVariants({ variant: 'chunky-success' })).toContain('shadow-[0_4px_0_hsl(var(--success-deep))]')
    expect(buttonVariants({ variant: 'chunky-danger' })).toContain('shadow-[0_4px_0_hsl(var(--danger-deep))]')
    expect(buttonVariants({ variant: 'chunky-ghost' })).toContain('shadow-[0_4px_0_hsl(var(--border)),inset_0_0_0_2px_hsl(var(--border))]')
  })

  it('disabled chunky buttons lose the edge and look muted', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    expect(cls).toContain('disabled:bg-muted')
    expect(cls).toContain('disabled:text-muted-foreground')
    expect(cls).toContain('disabled:shadow-[0_4px_0_hsl(var(--border))]')
  })

  it('existing variants are unchanged', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary text-primary-foreground')
    expect(buttonVariants({ variant: 'default' })).toContain('active:scale-[0.98]')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run components/ui/__tests__/button.test.ts`
Expected: FAIL. The chunky assertions fail because the variant doesn't exist yet (cva returns only the base classes).

- [ ] **Step 3: Add the tokens to `app/globals.css`**

In the light `:root` block, directly after `--info: 210 80% 44%;`, add:

```css
    --primary-deep: 24 80% 40%;
    --success-deep: 145 55% 27%;
    --danger-deep: 0 65% 36%;

    /* Motion (theme-independent) */
    --ease-out: cubic-bezier(.22, 1, .36, 1);
    --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
    --dur-tap: 120ms;
    --dur-state: 180ms;
    --dur-pop: 320ms;
    --dur-turn: 400ms;
```

In the `.dark` block, directly after `--info: 210 85% 66%;`, add:

```css
    --primary-deep: 26 75% 38%;
    --success-deep: 145 50% 32%;
    --danger-deep: 0 55% 42%;
```

- [ ] **Step 4: Expose them in `tailwind.config.js`**

In `theme.extend.colors`, replace the `primary`, `success` and `danger` entries with:

```js
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          deep: "hsl(var(--primary-deep))",
        },
```
```js
        success: { DEFAULT: "hsl(var(--success))", deep: "hsl(var(--success-deep))" },
        warning: "hsl(var(--warning))",
        danger: { DEFAULT: "hsl(var(--danger))", deep: "hsl(var(--danger-deep))" },
```

Also in `theme.extend`, add these next to the existing `keyframes` and `animation` objects. Merge into those objects; don't create second copies.

```js
      transitionTimingFunction: {
        smooth: 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        tap: 'var(--dur-tap)',
        state: 'var(--dur-state)',
        pop: 'var(--dur-pop)',
        turn: 'var(--dur-turn)',
      },
```
In `keyframes` add:
```js
        bob: { '0%, 100%': { transform: 'translate(-50%, 0)' }, '50%': { transform: 'translate(-50%, -6px)' } },
        'ring-pulse': { '0%': { transform: 'scale(.85)', opacity: '.9' }, '100%': { transform: 'scale(1.45)', opacity: '0' } },
```
In `animation` add:
```js
        bob: 'bob 1.6s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 1.6s cubic-bezier(.22,1,.36,1) infinite',
```

- [ ] **Step 5: Add the variants to `components/ui/button.tsx`**

Add these entries to `variants.variant` after `ondark`:

```ts
        /** The playful primary action: 3D bottom edge that sinks on press. One per screen. */
        chunky: CHUNKY_BASE + " bg-primary text-primary-foreground shadow-[0_4px_0_hsl(var(--primary-deep))] hover:brightness-105",
        "chunky-success": CHUNKY_BASE + " bg-success text-white shadow-[0_4px_0_hsl(var(--success-deep))] hover:brightness-105",
        "chunky-danger": CHUNKY_BASE + " bg-danger text-white shadow-[0_4px_0_hsl(var(--danger-deep))] hover:brightness-105",
        "chunky-ghost": CHUNKY_BASE + " bg-card text-foreground shadow-[0_4px_0_hsl(var(--border)),inset_0_0_0_2px_hsl(var(--border))] hover:bg-accent",
```

Above `const buttonVariants`, add:

```ts
const CHUNKY_BASE =
  // Arbitrary values (not the duration-tap / ease-smooth shorthands) so tailwind-merge
  // recognises them and drops the base `duration-200`; unknown named keys would survive the merge.
  "rounded-[14px] font-heading font-extrabold uppercase tracking-[0.02em] transition-[transform,box-shadow,filter] duration-[var(--dur-tap)] ease-[var(--ease-out)] " +
  "active:scale-100 active:translate-y-[4px] active:shadow-none " +
  "disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-[0_4px_0_hsl(var(--border))]"
```

cva concatenates the base string and the variant string without merging, so the base `active:scale-[0.98]` would still be present. Fix it in the `Button` function, which already runs `cn()` (tailwind-merge): conflicting `active:scale-*` classes resolve to the last one. Change the base-string handling of `buttonVariants` so the test (which calls `buttonVariants` directly) sees merged output. Wrap the export:

```ts
const baseButtonVariants = cva(/* existing base string */, { /* existing config with the new variants */ })

function buttonVariants(...args: Parameters<typeof baseButtonVariants>) {
  return cn(baseButtonVariants(...args))
}
```

Rename the existing `const buttonVariants = cva(` to `const baseButtonVariants = cva(`, add the wrapper above, and keep `export { Button, buttonVariants }`. `Button` keeps calling `cn(buttonVariants({ variant, size, className }))`, which still works. `VariantProps<typeof buttonVariants>` must become `VariantProps<typeof baseButtonVariants>`.

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx vitest run components/ui/__tests__/button.test.ts`
Expected: 4 passed.

- [ ] **Step 7: Type-check and lint the touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "components/ui/button|tailwind" ; npx eslint components/ui/button.tsx components/ui/__tests__/button.test.ts`
Expected: no output from either command (pre-existing errors elsewhere don't matter here).

- [ ] **Step 8: Commit**

```bash
git add app/globals.css tailwind.config.js components/ui/button.tsx components/ui/__tests__/button.test.ts
git commit -m "Add motion tokens and the chunky button variants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Stop outlining notation glyphs

**Files:**
- Modify: `app/globals.css` (the `.playsense-studio-notation svg …` rule around lines 236–246)

**Interfaces:**
- Consumes: nothing. Produces: no API, a visual change only.

VexFlow 5 draws clefs, noteheads, rests, accidentals and time signatures as SVG `<text>`. The current rule forces `stroke: currentColor !important` on `text`/`tspan`, which adds a 1px outline and makes every glyph look bold. Paths, lines and rects (staff lines, stems, beams, ties) keep their stroke.

- [ ] **Step 1: Split the rule**

Replace:

```css
.playsense-studio-notation svg path,
.playsense-studio-notation svg rect,
.playsense-studio-notation svg line,
.playsense-studio-notation svg circle,
.playsense-studio-notation svg ellipse,
.playsense-studio-notation svg polygon,
.playsense-studio-notation svg polyline,
.playsense-studio-notation svg text,
.playsense-studio-notation svg tspan {
  fill: currentColor !important;
  stroke: currentColor !important;
}
```

with:

```css
.playsense-studio-notation svg path,
.playsense-studio-notation svg rect,
.playsense-studio-notation svg line,
.playsense-studio-notation svg circle,
.playsense-studio-notation svg ellipse,
.playsense-studio-notation svg polygon,
.playsense-studio-notation svg polyline {
  fill: currentColor !important;
  stroke: currentColor !important;
}
/* VexFlow 5 draws glyphs (noteheads, clefs, rests) as text: fill only, or
   a 1px outline makes every glyph look bold. */
.playsense-studio-notation svg text,
.playsense-studio-notation svg tspan {
  fill: currentColor !important;
  stroke: none !important;
}
```

- [ ] **Step 2: Check for rules that relied on a text stroke**

Run: `grep -n "stroke" app/globals.css components/playsense-studio/player/notation/renderers/staff-renderer.css | grep -i "text\|label\|beat\|repeat"`
Expected: every text-targeting rule already sets `stroke:none!important` (measure labels, beat numbers, repeat counts). If one sets a visible stroke on text, leave it; it has higher specificity and still wins.

- [ ] **Step 3: Look at it in the browser**

Start `npm run dev -- -p 3006` and open `http://localhost:3006/playsense-preview/notation`. Compare against `git stash`-ed main behaviour, or a screenshot taken first. Check:
- Noteheads, clefs and time signatures are lighter, with no outline, in both themes.
- Staff lines, stems, beams, ties and slurs look unchanged.
- The Studio editor strip (open any score in PlaySense Studio at `/admin/play-sense/<id>`) and the PDF-import preview still render with no missing glyphs.

If the Chrome extension doesn't connect, use headless Chrome over CDP (see the lab's `shot.mjs` pattern in memory `design-lab-2`).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Draw notation glyphs without an outline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lesson-path data helper

**Files:**
- Create: `lib/courses/path-nodes.ts`
- Test: `lib/courses/__tests__/path-nodes.test.ts`

**Interfaces:**
- Consumes: `moduleOverviewHref(courseId, sectionId)`, `classHref(courseId, classId)`, `videoDurationSeconds(items)` from `lib/courses/structure.ts`.
- Produces:
```ts
export type PathLessonType = 'video' | 'play' | 'quiz' | 'other'
export type PathState = 'done' | 'current' | 'upcoming'
export interface PathLessonNode { kind: 'lesson'; id: string; number: number; moduleIndex: number; title: string; state: PathState; types: PathLessonType[]; minutes: number | null; href: string }
export interface PathCheckpointNode { kind: 'checkpoint'; id: string; moduleIndex: number; moduleTitle: string; state: 'done' | 'upcoming'; href: string }
export type PathNode = PathLessonNode | PathCheckpointNode
export interface PathGap { kind: 'gap'; id: string; count: number }
export type PathItem = PathNode | PathGap
export interface PathSectionInput { id: string; title: string; classes: { id: string; title: string; totalItems: number; completedItems: number; items?: { item_type: string; video_duration_seconds: number | null }[] }[] }
export function buildPathNodes(courseId: string, sections: PathSectionInput[], currentClassId: string | null): PathNode[]
export function pathWindow(nodes: PathNode[], opts: { before: number; after: number }): PathItem[]
```
`PathSectionInput` matches the enriched sections that `getCourseStructureForStudent` returns (the same shape `toSidebarSections` accepts), so pages can pass them straight in.

- [ ] **Step 1: Write the failing tests**

Create `lib/courses/__tests__/path-nodes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPathNodes, pathWindow, type PathSectionInput } from '../path-nodes'

const cls = (id: string, done: number, total: number, items: { item_type: string; video_duration_seconds: number | null }[] = []) =>
  ({ id, title: `Lesson ${id}`, totalItems: total, completedItems: done, items })

const COURSE: PathSectionInput[] = [
  { id: 's1', title: 'Welcome', classes: [
    cls('a', 2, 2, [{ item_type: 'VIDEO', video_duration_seconds: 300 }, { item_type: 'QUIZ', video_duration_seconds: null }]),
    cls('b', 1, 3, [{ item_type: 'VIDEO', video_duration_seconds: 610 }, { item_type: 'EXERCISE', video_duration_seconds: null }, { item_type: 'VIDEO', video_duration_seconds: 50 }]),
    cls('c', 0, 1, [{ item_type: 'JAM_SESSION', video_duration_seconds: null }]),
  ] },
  { id: 's2', title: 'Rhythm', classes: [cls('d', 0, 1)] },
]

describe('buildPathNodes', () => {
  it('emits lessons in order with a checkpoint closing each module', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    expect(nodes.map((n) => n.kind === 'lesson' ? n.id : `cp:${n.moduleIndex}`)).toEqual(['a', 'b', 'c', 'cp:0', 'd', 'cp:1'])
  })

  it('numbers lessons across modules and links them', () => {
    const nodes = buildPathNodes('son', COURSE, null).filter((n) => n.kind === 'lesson')
    expect(nodes.map((n) => n.number)).toEqual([1, 2, 3, 4])
    expect(nodes[1]).toMatchObject({ href: '/dashboard/course/son/class/b', moduleIndex: 0 })
  })

  it('marks done lessons, then the first unfinished lesson as current', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['done', 'current', 'upcoming', 'upcoming'])
  })

  it('an explicit current lesson wins over progress', () => {
    const nodes = buildPathNodes('son', COURSE, 'c')
    expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['done', 'upcoming', 'current', 'upcoming'])
  })

  it('unknown current id falls back to the first unfinished lesson', () => {
    const nodes = buildPathNodes('son', COURSE, 'deleted-lesson')
    expect(nodes.find((n) => n.state === 'current')).toMatchObject({ id: 'b' })
  })

  it('0-item lessons are not done', () => {
    const nodes = buildPathNodes('son', [{ id: 's', title: 'S', classes: [cls('x', 0, 0), cls('y', 1, 1)] }], null)
    expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['current', 'done'])
  })

  it('finished course has no current and every checkpoint is done', () => {
    const done: PathSectionInput[] = [{ id: 's', title: 'S', classes: [cls('x', 1, 1), cls('y', 2, 2)] }]
    const nodes = buildPathNodes('son', done, null)
    expect(nodes.some((n) => n.state === 'current')).toBe(false)
    expect(nodes.at(-1)).toMatchObject({ kind: 'checkpoint', state: 'done' })
  })

  it('a checkpoint is done only when every lesson in its module is done', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    const cps = nodes.filter((n) => n.kind === 'checkpoint')
    expect(cps.map((n) => n.state)).toEqual(['upcoming', 'upcoming'])
    expect(cps[0]).toMatchObject({ href: '/dashboard/course/son/module/s1', moduleTitle: 'Welcome' })
  })

  it('collects distinct lesson types in item order and rounds video minutes', () => {
    const b = buildPathNodes('son', COURSE, null).find((n) => n.kind === 'lesson' && n.id === 'b')
    expect(b).toMatchObject({ types: ['video', 'play'], minutes: 11 })
    const c = buildPathNodes('son', COURSE, null).find((n) => n.kind === 'lesson' && n.id === 'c')
    expect(c).toMatchObject({ types: ['play'], minutes: null })
  })

  it('skips empty modules', () => {
    const nodes = buildPathNodes('son', [{ id: 'e', title: 'Empty', classes: [] }, ...COURSE], null)
    expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ kind: 'lesson', id: 'a', moduleIndex: 1 })
  })
})

describe('pathWindow', () => {
  const long: PathSectionInput[] = [{ id: 'm', title: 'M', classes: Array.from({ length: 12 }, (_, i) => cls(`l${i}`, i < 6 ? 1 : 0, 1)) }]
  const nodes = buildPathNodes('son', long, null) // current = l6

  it('keeps `before` lessons, the current, `after` lessons, a gap, then the module checkpoint', () => {
    const w = pathWindow(nodes, { before: 2, after: 3 })
    expect(w.map((n) => n.kind === 'lesson' ? n.id : n.kind)).toEqual(['l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'gap', 'checkpoint'])
    expect(w.find((n) => n.kind === 'gap')).toMatchObject({ count: 2 })
  })

  it('no gap when the window reaches the checkpoint', () => {
    const w = pathWindow(nodes, { before: 2, after: 10 })
    expect(w.some((n) => n.kind === 'gap')).toBe(false)
    expect(w.at(-1)).toMatchObject({ kind: 'checkpoint' })
  })

  it('with nothing current, windows the end of the course', () => {
    const finished = buildPathNodes('son', [{ id: 'm', title: 'M', classes: [cls('x', 1, 1), cls('y', 1, 1), cls('z', 1, 1)] }], null)
    const w = pathWindow(finished, { before: 1, after: 3 })
    expect(w.map((n) => n.kind === 'lesson' ? n.id : n.kind)).toEqual(['y', 'z', 'checkpoint'])
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run lib/courses/__tests__/path-nodes.test.ts`
Expected: FAIL with "Failed to resolve import ../path-nodes".

- [ ] **Step 3: Implement `lib/courses/path-nodes.ts`**

```ts
// Pure helpers for the Duolingo-style lesson path (course detail + dashboard).
// No React or Supabase imports so everything here is unit-testable.

import { classHref, moduleOverviewHref, videoDurationSeconds } from './structure'

export type PathLessonType = 'video' | 'play' | 'quiz' | 'other'
export type PathState = 'done' | 'current' | 'upcoming'

export interface PathLessonNode {
  kind: 'lesson'
  id: string
  /** 1-based position across the whole course. */
  number: number
  moduleIndex: number
  title: string
  state: PathState
  types: PathLessonType[]
  /** Rounded video minutes, or null when the lesson has no timed video. */
  minutes: number | null
  href: string
}

export interface PathCheckpointNode {
  kind: 'checkpoint'
  id: string
  moduleIndex: number
  moduleTitle: string
  state: 'done' | 'upcoming'
  href: string
}

export type PathNode = PathLessonNode | PathCheckpointNode

export interface PathGap {
  kind: 'gap'
  id: string
  count: number
}

export type PathItem = PathNode | PathGap

export interface PathSectionInput {
  id: string
  title: string
  classes: {
    id: string
    title: string
    totalItems: number
    completedItems: number
    items?: { item_type: string; video_duration_seconds: number | null }[]
  }[]
}

const TYPE_OF: Record<string, PathLessonType> = {
  VIDEO: 'video',
  EXERCISE: 'play',
  JAM_SESSION: 'play',
  QUIZ: 'quiz',
}

const isDone = (c: { totalItems: number; completedItems: number }) =>
  c.totalItems > 0 && c.completedItems >= c.totalItems

/** One node per lesson plus a checkpoint closing each non-empty module. */
export function buildPathNodes(
  courseId: string,
  sections: PathSectionInput[],
  currentClassId: string | null
): PathNode[] {
  const all = sections.flatMap((s) => s.classes)
  const known = currentClassId !== null && all.some((c) => c.id === currentClassId)
  const currentId = known ? currentClassId : all.find((c) => !isDone(c))?.id ?? null

  const nodes: PathNode[] = []
  let number = 0
  sections.forEach((section, moduleIndex) => {
    if (section.classes.length === 0) return
    for (const c of section.classes) {
      number += 1
      const types: PathLessonType[] = []
      for (const item of c.items ?? []) {
        const t = TYPE_OF[item.item_type] ?? 'other'
        if (!types.includes(t)) types.push(t)
      }
      const seconds = videoDurationSeconds(c.items)
      nodes.push({
        kind: 'lesson',
        id: c.id,
        number,
        moduleIndex,
        title: c.title,
        state: c.id === currentId ? 'current' : isDone(c) ? 'done' : 'upcoming',
        types,
        minutes: seconds > 0 ? Math.round(seconds / 60) : null,
        href: classHref(courseId, c.id),
      })
    }
    nodes.push({
      kind: 'checkpoint',
      id: `checkpoint-${section.id}`,
      moduleIndex,
      moduleTitle: section.title,
      state: section.classes.every(isDone) ? 'done' : 'upcoming',
      href: moduleOverviewHref(courseId, section.id),
    })
  })
  return nodes
}

/**
 * A short slice of the path for compact cards: `before` lessons, the current
 * one, `after` lessons, then (if any lessons were skipped) a gap, then the
 * checkpoint of the current module. With nothing current, the slice ends at
 * the last node of the course.
 */
export function pathWindow(nodes: PathNode[], opts: { before: number; after: number }): PathItem[] {
  if (nodes.length === 0) return []
  let anchor = nodes.findIndex((n) => n.state === 'current')
  if (anchor === -1) {
    // Finished: anchor on the last lesson.
    for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].kind === 'lesson') { anchor = i; break }
  }
  const anchorNode = nodes[anchor]
  const moduleIndex = anchorNode.moduleIndex
  const checkpointIndex = nodes.findIndex((n, i) => i > anchor && n.kind === 'checkpoint' && n.moduleIndex === moduleIndex)

  const out: PathItem[] = []
  let lessonsBefore = 0
  let start = anchor
  for (let i = anchor - 1; i >= 0 && lessonsBefore < opts.before; i--) {
    start = i
    if (nodes[i].kind === 'lesson') lessonsBefore += 1
  }
  let end = anchor
  let lessonsAfter = 0
  for (let i = anchor + 1; i < nodes.length && lessonsAfter < opts.after; i++) {
    if (i === checkpointIndex) break
    end = i
    if (nodes[i].kind === 'lesson') lessonsAfter += 1
  }
  for (let i = start; i <= end; i++) out.push(nodes[i])
  if (checkpointIndex !== -1) {
    const hidden = nodes.slice(end + 1, checkpointIndex).filter((n) => n.kind === 'lesson').length
    if (hidden > 0) out.push({ kind: 'gap', id: `gap-${moduleIndex}`, count: hidden })
    out.push(nodes[checkpointIndex])
  }
  return out
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run lib/courses/__tests__/path-nodes.test.ts`
Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/courses/path-nodes.ts lib/courses/__tests__/path-nodes.test.ts
git commit -m "Add the lesson path helper for the Duolingo-style path

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: PathStrip component and its strings

**Files:**
- Create: `components/course/path-strip.tsx`
- Modify: `locales/en.json`, `locales/es.json` (add `dashboard.pages.course.path`)
- Test: `components/course/__tests__/path-strip.test.tsx`

**Interfaces:**
- Consumes: `PathItem`, `PathLessonNode`, `PathCheckpointNode`, `PathLessonType` from `@/lib/courses/path-nodes`; `useTranslation` from `@/components/language-provider`; `cn` from `@/lib/utils`.
- Produces: `export function PathStrip(props: { items: PathItem[]; size?: 'default' | 'compact'; showArrows?: boolean; className?: string; ariaLabel: string })`.

Geometry, matching the lab:
- Nodes are `STEP` apart horizontally (118px default, 104px compact) with a wavy vertical offset `sin(i · 1.1) · 18px`.
- Lesson nodes are 56×52px (compact 46×42) circles with a 6px bottom shadow. Checkpoints are rounded squares.
- The track has a top padding of 84px, so the "Continue" bubble and hover cards fit inside the scroller; `overflow-x: auto` also clips vertically.

- [ ] **Step 1: Add the strings**

Run this from the repo root (edits both JSON files in place, keeping 2-space indent):

```bash
node -e '
const fs = require("fs");
const add = (file, path) => { const j = JSON.parse(fs.readFileSync(file, "utf8")); j.dashboard.pages.course.path = path; fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n"); };
add("locales/en.json", { continue: "Continue", start: "Start", minutes: "{n} min", lessonN: "Lesson {n}", checkpoint: "Module {n} checkpoint", moreOne: "{count} more", more: "{count} more", prev: "Earlier lessons", next: "Later lessons", state: { done: "Done", current: "Up next", upcoming: "Coming up" }, types: { video: "Video", play: "Play along", quiz: "Quiz", other: "Reading" } });
add("locales/es.json", { continue: "Continuar", start: "Empezar", minutes: "{n} min", lessonN: "Lección {n}", checkpoint: "Punto de control del módulo {n}", moreOne: "{count} más", more: "{count} más", prev: "Lecciones anteriores", next: "Lecciones siguientes", state: { done: "Hecha", current: "Sigue", upcoming: "Próximamente" }, types: { video: "Video", play: "Tocar", quiz: "Quiz", other: "Lectura" } });
'
git diff --stat locales/
```
Expected: both files change. Check that `git diff locales/en.json` shows only the added `path` block. If the whole file reformats, the original indent differed: revert and add the block by hand instead.

- [ ] **Step 2: Write the failing component test**

Create `components/course/__tests__/path-strip.test.tsx`:

```tsx
// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathItem } from '@/lib/courses/path-nodes'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${Object.values(params).join(',')})` : key,
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

import { PathStrip } from '../path-strip'

const lesson = (id: string, number: number, state: 'done' | 'current' | 'upcoming'): PathItem =>
  ({ kind: 'lesson', id, number, moduleIndex: 0, title: `Lesson ${id}`, state, types: ['video'], minutes: 12, href: `/l/${id}` })
const ITEMS: PathItem[] = [
  lesson('a', 1, 'done'), lesson('b', 2, 'current'), lesson('c', 3, 'upcoming'),
  { kind: 'gap', id: 'g', count: 4 },
  { kind: 'checkpoint', id: 'cp', moduleIndex: 0, moduleTitle: 'Welcome', state: 'upcoming', href: '/m/1' },
]

let root: Root
let host: HTMLDivElement
const scrollBy = vi.fn()

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Element.prototype.scrollBy = scrollBy as unknown as Element['scrollBy']
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); scrollBy.mockReset() })

const render = (items = ITEMS) => act(() => root.render(<PathStrip items={items} ariaLabel="Your path" showArrows />))

describe('PathStrip', () => {
  it('renders one link per lesson and checkpoint, marking the current step', () => {
    render()
    const links = [...host.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/l/a', '/l/b', '/l/c', '/m/1'])
    expect(host.querySelector('[aria-current="step"]')?.getAttribute('href')).toBe('/l/b')
  })

  it('shows the continue bubble with minutes on the current node only', () => {
    render()
    const bubbles = host.querySelectorAll('[data-path-bubble]')
    expect(bubbles).toHaveLength(1)
    expect(bubbles[0].textContent).toContain('dashboard.pages.course.path.continue')
    expect(bubbles[0].textContent).toContain('dashboard.pages.course.path.minutes(12)')
  })

  it('renders the gap count', () => {
    render()
    expect(host.textContent).toContain('dashboard.pages.course.path.more(4)')
  })

  it('arrow buttons scroll the track', () => {
    render()
    const next = host.querySelector('button[aria-label="dashboard.pages.course.path.next"]') as HTMLButtonElement
    act(() => next.click())
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('looping animations are motion-safe', () => {
    render()
    const animated = [...host.querySelectorAll('[class*="animate-"]')]
    expect(animated.length).toBeGreaterThan(0)
    for (const el of animated) {
      for (const c of el.className.split(/\s+/).filter((x) => x.includes('animate-'))) expect(c.startsWith('motion-safe:')).toBe(true)
    }
  })

  it('scrolls to the end when nothing is current', () => {
    const done = ITEMS.map((i) => (i.kind === 'lesson' ? { ...i, state: 'done' as const } : i))
    render(done)
    const scroller = host.querySelector('[data-path-scroller]') as HTMLDivElement
    expect(scroller.dataset.anchor).toBe('end')
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run components/course/__tests__/path-strip.test.tsx`
Expected: FAIL with "Failed to resolve import ../path-strip".

- [ ] **Step 4: Implement `components/course/path-strip.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleHelp, FileText, Music, Play, Trophy, Video } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { PathItem, PathLessonType } from '@/lib/courses/path-nodes'

const T = 'dashboard.pages.course.path'
const TYPE_ICON: Record<PathLessonType, typeof Video> = { video: Video, play: Music, quiz: CircleHelp, other: FileText }

interface PathStripProps {
  items: PathItem[]
  size?: 'default' | 'compact'
  showArrows?: boolean
  className?: string
  ariaLabel: string
}

/**
 * Horizontal Duolingo-style lesson path: 3D nodes on a wavy connector,
 * solid up to the current lesson, dotted after. Scrolls itself so the current
 * lesson (or the end, once the course is finished) is in view.
 */
export function PathStrip({ items, size = 'default', showArrows = false, className, ariaLabel }: PathStripProps) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const compact = size === 'compact'
  const STEP = compact ? 104 : 118
  const TOP = 84
  const WAVE = 18
  const hasCurrent = items.some((i) => i.kind !== 'gap' && i.state === 'current')

  const pos = items.map((_, i) => ({ x: 44 + i * STEP, y: TOP + Math.sin(i * 1.1) * WAVE }))
  const width = 44 * 2 + (items.length - 1) * STEP
  const currentIndex = items.findIndex((i) => i.kind !== 'gap' && i.state === 'current')
  // The connector is solid up to the current lesson (or everything, once finished).
  const solidUntil = currentIndex === -1 ? items.length - 1 : currentIndex

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = currentIndex === -1 ? el.scrollWidth : pos[currentIndex].x - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, items.length])

  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth * 0.8), behavior: 'smooth' })

  return (
    <div className={cn('relative', className)} role="group" aria-label={ariaLabel}>
      {showArrows && (
        <div className="absolute right-0 top-0 z-10 flex gap-2">
          <button type="button" aria-label={t(`${T}.prev`)} onClick={() => scroll(-1)} className="grid size-9 place-items-center rounded-lg border border-border bg-card shadow-card hover:bg-accent">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label={t(`${T}.next`)} onClick={() => scroll(1)} className="grid size-9 place-items-center rounded-lg border border-border bg-card shadow-card hover:bg-accent">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      <div
        ref={scroller}
        data-path-scroller
        data-anchor={hasCurrent ? 'current' : 'end'}
        className="overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [scroll-snap-type:x_proximity]"
      >
        <div className="relative" style={{ width, height: TOP + (compact ? 96 : 110) }}>
          <svg aria-hidden className="absolute inset-0 overflow-visible" width={width} height={TOP + 110}>
            {pos.slice(1).map((b, k) => {
              const a = pos[k]
              const mx = (a.x + b.x) / 2
              const solid = k + 1 <= solidUntil
              return (
                <path
                  key={k}
                  d={`M${a.x} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={compact ? 6 : 8}
                  strokeDasharray={solid ? undefined : '2 14'}
                  className={solid ? 'stroke-primary' : 'stroke-border'}
                />
              )
            })}
          </svg>

          {items.map((item, i) => {
            const { x, y } = pos[i]
            if (item.kind === 'gap') {
              return (
                <span key={item.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" style={{ left: x, top: y }}>
                  {t(item.count === 1 ? `${T}.moreOne` : `${T}.more`, { count: item.count })}
                </span>
              )
            }
            const isLesson = item.kind === 'lesson'
            const current = item.state === 'current'
            const done = item.state === 'done'
            const nodeSize = compact ? 'h-[42px] w-[46px]' : 'h-[52px] w-[56px]'
            const label = isLesson ? item.title : t(`${T}.checkpoint`, { n: item.moduleIndex + 1 })
            const Icon = isLesson ? (done ? Check : current ? Play : TYPE_ICON[item.types[0] ?? 'other']) : Trophy
            return (
              <div key={item.id} className="group absolute" style={{ left: x, top: y, scrollSnapAlign: 'center' }}>
                {current && isLesson && (
                  <div data-path-bubble className="pointer-events-none absolute bottom-[calc(100%+34px)] left-1/2 z-[2] grid justify-items-center whitespace-nowrap rounded-xl border-2 border-border bg-card px-3 py-1.5 text-[13px] font-extrabold text-primary shadow-lift motion-safe:animate-bob group-hover:opacity-0 group-focus-within:opacity-0">
                    <span className="uppercase">{t(`${T}.continue`)}</span>
                    {item.minutes !== null && <span className="text-[11px] font-semibold text-muted-foreground">{t(`${T}.minutes`, { n: item.minutes })}</span>}
                  </div>
                )}
                <Link
                  href={item.href}
                  aria-label={isLesson ? `${t(`${T}.lessonN`, { n: item.number })}: ${item.title}` : label}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center transition-[transform,box-shadow] duration-tap ease-smooth active:translate-y-[calc(-50%+6px)]',
                    nodeSize,
                    isLesson ? 'rounded-full' : 'rounded-[18px]',
                    done || current
                      ? isLesson ? 'bg-primary text-primary-foreground shadow-[0_6px_0_hsl(var(--primary-deep))]' : 'bg-gradient-to-br from-gold to-primary text-white shadow-[0_6px_0_hsl(var(--primary-deep))]'
                      : isLesson ? 'bg-muted text-muted-foreground shadow-[0_6px_0_hsl(var(--border))]' : 'bg-gold/20 text-gold shadow-[0_6px_0_hsl(var(--border))]',
                    current && 'ring-8 ring-primary/15',
                    'active:shadow-none'
                  )}
                >
                  {current && <span aria-hidden className="absolute -inset-2 rounded-full border-[3px] border-primary/60 motion-safe:animate-ring-pulse" />}
                  <Icon className={cn(compact ? 'size-5' : 'size-6', done && isLesson && 'stroke-[3]')} />
                </Link>
                <span className={cn('absolute left-0 top-[34px] line-clamp-2 w-[110px] -translate-x-1/2 text-center text-[11px] leading-tight', current ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>
                  {label}
                </span>
                {isLesson && (
                  <div role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+34px)] left-1/2 z-[3] w-52 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-left opacity-0 shadow-pop transition-opacity duration-state group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{t(`${T}.lessonN`, { n: item.number })}</span>
                      <span className={cn(done && 'text-success', current && 'text-primary')}>{t(`${T}.state.${item.state}`)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.types.map((ty) => t(`${T}.types.${ty}`)).join(' · ')}
                      {item.minutes !== null && ` · ${t(`${T}.minutes`, { n: item.minutes })}`}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run components/course/__tests__/path-strip.test.tsx`
Expected: 6 passed.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "path-strip|path-nodes" ; npx eslint components/course/path-strip.tsx components/course/__tests__/path-strip.test.tsx`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/course/path-strip.tsx components/course/__tests__/path-strip.test.tsx locales/en.json locales/es.json
git commit -m "Add the PathStrip lesson path component

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Faint dashboard background

**Files:**
- Create: `lib/dashboard/page-background.ts`
- Test: `lib/dashboard/__tests__/page-background.test.ts`
- Create: `components/dashboard/page-background.tsx`
- Modify: `app/dashboard/page.tsx` (the `return (` block at the end of the page component, around line 398)

**Interfaces:**
- Produces:
```ts
export interface BackgroundArt { width: number; height: number; staves: string[]; notes: BackgroundNote[]; clave: { cx: number; cy: number }[] }
export interface BackgroundNote { x: number; y: number; scale: number; rotate: number; kind: 'quarter' | 'eighth' | 'beamed' }
export function buildBackgroundArt(seed: number, width?: number, height?: number): BackgroundArt
export function PageBackground(): JSX.Element   // components/dashboard/page-background.tsx
```

The layer is `position: fixed`, sits under the header and right of the 64px rail, and is `pointer-events: none` and `aria-hidden`. The page content wrapper gets `relative z-[1]` so it paints above the layer.

- [ ] **Step 1: Write the failing generator test**

Create `lib/dashboard/__tests__/page-background.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildBackgroundArt } from '../page-background'

describe('buildBackgroundArt', () => {
  it('is deterministic for a seed', () => {
    expect(buildBackgroundArt(3)).toEqual(buildBackgroundArt(3))
    expect(buildBackgroundArt(3)).not.toEqual(buildBackgroundArt(4))
  })

  it('draws three staves of five lines each', () => {
    const art = buildBackgroundArt(3)
    expect(art.staves).toHaveLength(15)
    for (const d of art.staves) expect(d.startsWith('M')).toBe(true)
  })

  it('scatters 16 notes inside the canvas', () => {
    const art = buildBackgroundArt(3, 1600, 1200)
    expect(art.notes).toHaveLength(16)
    for (const n of art.notes) {
      expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThanOrEqual(1600)
      expect(n.y).toBeGreaterThanOrEqual(0); expect(n.y).toBeLessThanOrEqual(1200)
      expect(Math.abs(n.rotate)).toBeLessThanOrEqual(20)
    }
  })

  it('draws a 2-3 son clave: five strokes, grouped 2 then 3', () => {
    const { clave } = buildBackgroundArt(3)
    expect(clave).toHaveLength(5)
    const gaps = clave.slice(1).map((c, i) => c.cx - clave[i].cx)
    expect(gaps[1]).toBeGreaterThan(gaps[0]) // the break between the 2 side and the 3 side
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/dashboard/__tests__/page-background.test.ts`
Expected: FAIL with "Failed to resolve import ../page-background".

- [ ] **Step 3: Implement `lib/dashboard/page-background.ts`**

```ts
// Seeded art for the dashboard's faint background: wavy staves, scattered
// note shapes and a 2-3 clave figure. Pure so it renders identically on the
// server and the client (no hydration mismatch) and can be unit-tested.

export interface BackgroundNote {
  x: number
  y: number
  scale: number
  rotate: number
  kind: 'quarter' | 'eighth' | 'beamed'
}

export interface BackgroundArt {
  width: number
  height: number
  staves: string[]
  notes: BackgroundNote[]
  clave: { cx: number; cy: number }[]
}

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number) => Math.round(n * 10) / 10

export function buildBackgroundArt(seed: number, width = 1600, height = 1200): BackgroundArt {
  const r = mulberry32(seed)
  const staves: string[] = []
  const bundles: [number, number, number][] = [[0.15, 38, 0], [0.47, 54, 2.1], [0.8, 30, 4.2]]
  for (const [fy, amp, phase] of bundles) {
    for (let line = 0; line < 5; line++) {
      const y0 = height * fy + line * 9
      let d = `M-50 ${round(y0)}`
      for (let x = 0; x <= width + 100; x += 50) d += ` L${x} ${round(y0 + Math.sin(x / 260 + phase) * amp)}`
      staves.push(d)
    }
  }
  const kinds: BackgroundNote['kind'][] = ['quarter', 'eighth', 'beamed']
  const notes: BackgroundNote[] = Array.from({ length: 16 }, () => ({
    x: round(r() * width),
    y: round(r() * height),
    scale: round(0.8 + r() * 0.9),
    rotate: round((r() - 0.5) * 40),
    kind: kinds[Math.floor(r() * kinds.length)],
  }))
  // 2-3 son clave: two strokes, a longer rest, then three.
  const cx0 = width * 0.11
  const clave = [0, 46, 138, 184, 230].map((dx) => ({ cx: round(cx0 + dx), cy: round(height - 140) }))
  return { width, height, staves, notes, clave }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/dashboard/__tests__/page-background.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Implement `components/dashboard/page-background.tsx`**

```tsx
import { buildBackgroundArt, type BackgroundNote } from '@/lib/dashboard/page-background'

const ART = buildBackgroundArt(3)

function Note({ n }: { n: BackgroundNote }) {
  const t = `translate(${n.x} ${n.y}) rotate(${n.rotate}) scale(${n.scale})`
  if (n.kind === 'beamed') {
    return (
      <g transform={t}>
        <ellipse cx="0" cy="0" rx="7" ry="5" transform="rotate(-20)" />
        <ellipse cx="26" cy="-4" rx="7" ry="5" transform="rotate(-20 26 -4)" />
        <path d="M6 -2 V-34 M32 -6 V-38" fill="none" strokeWidth="2" />
        <path d="M6 -34 L32 -38 L32 -32 L6 -28 Z" />
      </g>
    )
  }
  return (
    <g transform={t}>
      <ellipse cx="0" cy="0" rx="7" ry="5" transform="rotate(-20)" />
      <path d="M6 -2 V-34" fill="none" strokeWidth="2" />
      {n.kind === 'eighth' && <path d="M6 -34 C14 -28 18 -22 14 -12" fill="none" strokeWidth="2" />}
    </g>
  )
}

/**
 * Faint musical backdrop for the dashboard home: wavy staff lines, scattered
 * notes, a 2-3 clave and a warm glow. Fixed behind the scrolling content, so
 * it never scrolls away; purely decorative.
 */
export function PageBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 top-[var(--header-h)] z-0 overflow-hidden md:left-16">
      <div className="absolute -right-[10%] -top-[20%] h-[80%] w-[70%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent)]" />
      <svg className="absolute inset-0 h-full w-full text-foreground" viewBox={`0 0 ${ART.width} ${ART.height}`} preserveAspectRatio="xMidYMid slice">
        <g className="opacity-[0.07]" fill="none" stroke="currentColor" strokeWidth="1.2">
          {ART.staves.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g className="opacity-[0.06]" fill="currentColor" stroke="currentColor">
          {ART.notes.map((n, i) => <Note key={i} n={n} />)}
        </g>
        <g className="opacity-[0.08]" fill="none" stroke="currentColor" strokeWidth="2">
          {ART.clave.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r="11" />)}
        </g>
      </svg>
    </div>
  )
}
```

- [ ] **Step 6: Mount it on the dashboard home**

In `app/dashboard/page.tsx`, add the import next to the other `components/dashboard/home` imports:

```ts
import { PageBackground } from '@/components/dashboard/page-background'
```

Then change the start of the render from:

```tsx
  return (
    <div className="w-full space-y-6 lg:space-y-8">
```

to:

```tsx
  return (
    <>
    <PageBackground />
    <div className="relative z-[1] w-full space-y-6 lg:space-y-8">
```

and close the fragment after the final `</div>` of the return: the last lines become `    </div>\n    </>\n  )`.

- [ ] **Step 7: Check it in the browser**

With `npm run dev -- -p 3006` running, sign in and open `http://localhost:3006/dashboard`. Check:
- The staff lines, notes and clave are barely visible behind the cards in dark and light. Cards and text are fully readable.
- Scrolling the page doesn't move the background.
- The header, rail hover and account menu still paint above it.
- `/dashboard/my-courses` and `/dashboard/course/<any>` show no background.
- Phone width (DevTools device mode, 390px): the layer starts under the header and covers the full width, and the bottom tab bar is above it.

- [ ] **Step 8: Commit**

```bash
git add lib/dashboard/page-background.ts lib/dashboard/__tests__/page-background.test.ts components/dashboard/page-background.tsx app/dashboard/page.tsx
git commit -m "Add the faint musical background to the dashboard home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Phase check

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites pass, including the 4 new files (27 new tests). If any other suite fails, run it again on the base branch (`git stash; npm test -- <file>`) to confirm the failure isn't caused by this phase before moving on.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: the build succeeds. Tailwind emits the new utilities without warnings about `transitionDuration` keys.

- [ ] **Step 3: Visual pass**

On the dev server, drop a temporary `<Button variant="chunky">Continue</Button>` into any dev-only page, e.g. `app/playsense-preview/notation/page.tsx`. Press it and confirm:
- It sinks 4px and the edge disappears.
- Keyboard focus shows the ring.
- `disabled` looks muted.

Remove the temporary button without committing it. `PathStrip` gets its first real use in Phase 5 (course detail); it's fully covered by tests here.

- [ ] **Step 4: Report**

Summarize for the user: commits made, test counts, anything that looked off in the visual passes (especially Task 2's glyph change in the Studio editor).
