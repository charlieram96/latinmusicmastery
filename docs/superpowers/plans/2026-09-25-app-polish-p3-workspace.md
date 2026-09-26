# App Polish — Phase 3: Workspace (video · staff · highway) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One adjustable workspace for every lesson view that pairs the teacher video with the staff: regions media + music (staff, plus the highway below it while playing), layouts side / stack / pip / music only + swap, a snapping divider, a draggable and resizable PiP, FLIP layout animation and per-view persistence — swapped into the watch (video | staff) and play (staff + highway, floating video) views.

**Architecture:**
- The maths (clamp, snap, pointer → split, nearest corner, PiP resize, swap, phone layout, persistence schema) is a pure, unit-tested module: `lib/playsense-studio/workspace-layout.ts`.
- State lives in a small controller hook, `useWorkspaceLayout(kind, defaults)` (`components/playsense-studio/player/use-workspace-layout.ts`), so the layout switcher can be rendered anywhere (Phase 4 moves it into the lesson action bar) while the workspace itself stays where it is.
- `components/playsense-studio/player/split-workspace.tsx` is rewritten as the workspace shell (`SplitWorkspace`) plus the switcher (`WorkspaceLayoutSwitcher`). Geometry is CSS grid driven by data attributes and CSS variables (`split-workspace.css`); drags write CSS variables directly and commit to React state on release, so the staff and highway do not re-render per pointer move. The DOM order never changes between layouts, so the `<video>` element, the staff renderer and the highway canvas are never remounted.
- Watch: `PlaysenseStudioPlayer`'s `layout="split"` renders `SplitWorkspace` (media = video + transport, music = staff pane). Play: `ScoreExerciseGame` renders `SplitWorkspace` (media = its existing muted `<video>`, music = `ExerciseScore`, highway = the stage). `ExerciseWorkspace` is deleted; `exercise-workspace.tsx` keeps only the `useExerciseWorkspace` context that `exercise-score.tsx` (Phase 2's file) still reads, bridged to the new controller.

**Tech Stack:** Next.js (app router), React 19, TypeScript, Tailwind v3.4 + plain component CSS (as `exercise-workspace.css` already does), lucide-react, vitest (`// @vitest-environment jsdom` for component tests, `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` §3.2 (Workspace). Visual reference: design lab 2 `workspace.js` + `.ws-*` rules in `workspace.css`, and `lxMountWorkspace` in `lesson.js`.

## Global Constraints

- Keep the design language: Studio Amber tokens, dark or light only, colours as `hsl(var(--x))`.
- Motion tokens from Phase 1: `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-spring: cubic-bezier(.34,1.56,.64,1)`, `--dur-state: 180ms`, `--dur-pop: 320ms`. Tailwind: never `duration-[var(--x)]` / `ease-[var(--x)]`; use the named keys (`duration-pop`, `ease-spring`).
- Divider: 16px hit area; snaps at 33⅓ / 50 / 66⅔ % within ±2.2 %; clamped 22–78 %; % pill while dragging; double-click resets with a 360 ms grid transition; arrow keys ±2 %.
- PiP: drag anywhere except its controls, slight tilt while dragged, spring to the nearest corner (440 ms `--ease-spring`), resize from the inner corner 18–50 % of the width with a 180 px minimum, double-click → side.
- FLIP layout animation: translate + scale, 440 ms `--ease-out`; a region that appears fades and scales in from .92. Reduced motion: no animation at all.
- Defaults: watch = side, media 44 %; play = pip, 24 % width, bottom right.
- Persistence: layout, split %, music split %, corner and PiP size in localStorage per view kind (`watch:<staff layout>`, `play`).
- Phones (≤ 767 px): side renders as stack and the switcher hides the side option.
- Every user-facing string goes through `useTranslation()`, keys in both `locales/en.json` and `locales/es.json`, under a new top-level `lessonWorkspace` block inserted by a node script.
- File ownership: do NOT edit `staff-renderer.tsx/.css`, `exercise-score.tsx/.css` (Phase 2), lesson shell/header/footer/sidebar/parts-nav (Phase 4), `components/course/path-strip.tsx`, dashboard or course files.
- Transport, loops, sections, tempo, click track, subtitles, overlays and the play session keep their behaviour.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; plain messages, no prefixes.

## Review Focus

1. **Corrupt or old localStorage** (`"{"`, `{"layout":"diagonal","split":"x"}`, a split of 95) must fall back per field to the defaults/clamped values, never crash or produce an unusable split. Pinned in Task 1 (`parse falls back per field`).
2. **Swapping** must keep the video the same size (split is always the media share), and swapping from music-only must bring the video back beside the staff. Pinned in Task 1 (`swap keeps the media share`).
3. **A tap on the PiP** (e.g. the watch video's tap-to-play button, or a click on the video) must not be swallowed by the drag: movement under 4 px is a click, not a drag. Pinned in Task 3 (`a tap on the pip is not a drag`).
4. **The `<video>` must never remount** when the layout changes (the watch clock and the play sync hold a ref to it). Pinned in Task 3 (`keeps the same media node across layouts`).
5. **Reduced motion** must skip the FLIP animation entirely. Pinned in Task 3 (`reduced motion skips FLIP`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/playsense-studio/workspace-layout.ts` | create | types, defaults, clamp/snap/pointer maths, nearest corner, PiP resize, swap, phone layout, persistence schema |
| `lib/playsense-studio/__tests__/workspace-layout.test.ts` | create | helper tests |
| `components/playsense-studio/player/use-workspace-layout.ts` | create | controller hook (state, hydration, save, phone media query, FLIP hook-in) |
| `components/playsense-studio/player/__tests__/use-workspace-layout.test.tsx` | create | hook tests |
| `components/playsense-studio/player/split-workspace.tsx` | rewrite | `SplitWorkspace` shell + `WorkspaceLayoutSwitcher` |
| `components/playsense-studio/player/split-workspace.css` | create | `.ws-*` layout, divider, PiP, phone, reduced motion |
| `components/playsense-studio/player/__tests__/split-workspace.test.tsx` | rewrite | shell + switcher tests |
| `components/playsense-studio/player/playsense-studio-player.tsx` | modify | watch split layout → `SplitWorkspace`; drop the video/score view toggle and orientation toggle |
| `components/class-viewer/lesson-viewer/video-info-split.tsx` | modify | no-score video lesson → new API (side / stack only) |
| `components/class-viewer/lesson-viewer/score-exercise-game.tsx` | modify | play view → `SplitWorkspace` (video pip, staff, highway) |
| `components/class-viewer/lesson-viewer/exercise-workspace.tsx` | rewrite | only the `useExerciseWorkspace` bridge for `exercise-score.tsx` |
| `components/class-viewer/lesson-viewer/exercise-workspace.css` | rewrite | exercise-specific rules inside the workspace |
| `components/class-viewer/lesson-viewer/__tests__/exercise-workspace.test.ts` | create | bridge mapping tests |
| `components/class-viewer/lesson-viewer/exercise-mode-frame.tsx` | modify | drop the Video toggle (music-only layout replaces it) |
| `components/class-viewer/lesson-viewer/exercise-mode.css` | modify | heading visibility attribute rename |
| `lib/playsense-studio/exercise-layout.ts` + its test | delete | only `ExerciseWorkspace` used them |
| `locales/en.json`, `locales/es.json` | modify | `lessonWorkspace.*` |

---

### Task 1: Workspace maths helper

**Files:**
- Create: `lib/playsense-studio/workspace-layout.ts`
- Test: `lib/playsense-studio/__tests__/workspace-layout.test.ts`

**Interfaces:**
- Produces: `WorkspaceLayout = 'side'|'stack'|'pip'|'music'`, `PipCorner = 'tl'|'tr'|'bl'|'br'`, `WorkspaceState { layout, split, musicSplit, corner, pipWidth, swap }`, `WORKSPACE_LAYOUTS`, `SPLIT_BOUNDS {min:22,max:78}`, `MUSIC_SPLIT_BOUNDS {min:25,max:80}`, `PIP_WIDTH_BOUNDS {min:18,max:50}`, `WATCH_WORKSPACE`, `PLAY_WORKSPACE`, `clamp`, `snapSplit`, `splitFromPointer(pointer, start, extent, bounds?)`, `nudgeSplit(value, delta, bounds?)`, `leadingSplit(split, swap)`, `nearestCorner(point, box)`, `resizePipWidth(startPct, dxPx, corner, boxWidth)`, `effectiveLayout(layout, narrow)`, `swapWorkspace(state)`, `workspaceStorageKey(kind)`, `parseWorkspaceState(raw, defaults, layouts?)`, `serializeWorkspaceState(state)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  PLAY_WORKSPACE, WATCH_WORKSPACE, effectiveLayout, leadingSplit, nearestCorner, nudgeSplit,
  parseWorkspaceState, resizePipWidth, serializeWorkspaceState, snapSplit, splitFromPointer,
  swapWorkspace, workspaceStorageKey, MUSIC_SPLIT_BOUNDS,
} from '../workspace-layout'

describe('split maths', () => {
  it('snaps within ±2.2 of a third, a half and two thirds', () => {
    expect(snapSplit(48)).toBe(50)
    expect(snapSplit(52.2)).toBe(50)
    expect(snapSplit(52.3)).toBe(52.3)
    expect(snapSplit(31.5)).toBeCloseTo(33.333, 2)
    expect(snapSplit(68.8)).toBeCloseTo(66.667, 2)
  })
  it('turns a pointer into a clamped, snapped, rounded share', () => {
    expect(splitFromPointer(100 + 470, 100, 1000)).toBe(50)
    expect(splitFromPointer(100 + 440, 100, 1000)).toBe(44)
    expect(splitFromPointer(100 + 50, 100, 1000)).toBe(22)
    expect(splitFromPointer(100 + 990, 100, 1000)).toBe(78)
    expect(splitFromPointer(100 + 330, 100, 1000)).toBe(33.3)
    expect(splitFromPointer(0, 0, 0)).toBe(50)
    expect(splitFromPointer(10, 0, 100, MUSIC_SPLIT_BOUNDS)).toBe(25)
  })
  it('nudges by the step and stays in bounds', () => {
    expect(nudgeSplit(44, 2)).toBe(46)
    expect(nudgeSplit(77, 2)).toBe(78)
    expect(nudgeSplit(23, -2)).toBe(22)
  })
  it('reads the leading region share from the media share', () => {
    expect(leadingSplit(44, false)).toBe(44)
    expect(leadingSplit(44, true)).toBe(56)
    expect(leadingSplit(leadingSplit(33.3, true), true)).toBe(33.3)
  })
})

describe('picture in picture', () => {
  const box = { left: 0, top: 0, width: 1000, height: 600 }
  it('picks the nearest corner by the centre of the dropped video', () => {
    expect(nearestCorner({ x: 900, y: 500 }, box)).toBe('br')
    expect(nearestCorner({ x: 100, y: 500 }, box)).toBe('bl')
    expect(nearestCorner({ x: 900, y: 100 }, box)).toBe('tr')
    expect(nearestCorner({ x: 100, y: 100 }, box)).toBe('tl')
  })
  it('grows from the inner corner and clamps to 18–50 %', () => {
    expect(resizePipWidth(24, -100, 'br', 1000)).toBe(34)
    expect(resizePipWidth(24, 100, 'bl', 1000)).toBe(34)
    expect(resizePipWidth(24, 100, 'tr', 1000)).toBe(18)
    expect(resizePipWidth(24, -900, 'br', 1000)).toBe(50)
    expect(resizePipWidth(24, 50, 'br', 0)).toBe(24)
  })
})

describe('layouts', () => {
  it('shows side as stack on phones', () => {
    expect(effectiveLayout('side', true)).toBe('stack')
    expect(effectiveLayout('pip', true)).toBe('pip')
    expect(effectiveLayout('side', false)).toBe('side')
  })
  it('swap keeps the media share and brings the video back from music only', () => {
    expect(swapWorkspace(WATCH_WORKSPACE)).toEqual({ ...WATCH_WORKSPACE, swap: true })
    expect(swapWorkspace({ ...WATCH_WORKSPACE, layout: 'music' })).toEqual({ ...WATCH_WORKSPACE, layout: 'side', swap: true })
    expect(swapWorkspace(PLAY_WORKSPACE).corner).toBe('bl')
    expect(swapWorkspace({ ...PLAY_WORKSPACE, corner: 'tl' }).corner).toBe('tr')
  })
  it('defaults: watch side 44, play pip 24 % bottom right', () => {
    expect(WATCH_WORKSPACE).toMatchObject({ layout: 'side', split: 44 })
    expect(PLAY_WORKSPACE).toMatchObject({ layout: 'pip', pipWidth: 24, corner: 'br' })
  })
})

describe('persistence', () => {
  it('keys per view kind', () => {
    expect(workspaceStorageKey('watch:wrapped')).toBe('lmm-workspace:watch:wrapped')
  })
  it('round-trips', () => {
    const s = { ...PLAY_WORKSPACE, split: 60, corner: 'tl' as const, swap: true }
    expect(parseWorkspaceState(serializeWorkspaceState(s), WATCH_WORKSPACE)).toEqual(s)
  })
  it('parse falls back per field', () => {
    expect(parseWorkspaceState(null, WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    expect(parseWorkspaceState('{', WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    expect(parseWorkspaceState('[1]', WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    const odd = JSON.stringify({ layout: 'diagonal', split: 'x', musicSplit: 99, corner: 'mid', pipWidth: 5, swap: 'yes' })
    expect(parseWorkspaceState(odd, WATCH_WORKSPACE)).toEqual({ ...WATCH_WORKSPACE, musicSplit: 80, pipWidth: 18 })
    expect(parseWorkspaceState(JSON.stringify({ split: 95 }), WATCH_WORKSPACE).split).toBe(78)
  })
  it('drops a layout the view does not offer', () => {
    const raw = JSON.stringify({ ...WATCH_WORKSPACE, layout: 'pip' })
    expect(parseWorkspaceState(raw, WATCH_WORKSPACE, ['side', 'stack']).layout).toBe('side')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/playsense-studio/__tests__/workspace-layout.test.ts`
Expected: FAIL (cannot resolve `../workspace-layout`).

- [ ] **Step 3: Write minimal implementation**

```ts
/** Geometry and persistence for the lesson workspace (video · staff · highway). Pure. */

export type WorkspaceLayout = 'side' | 'stack' | 'pip' | 'music'
export type PipCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface WorkspaceState {
  layout: WorkspaceLayout
  /** % of the stage given to the media (video) region in side and stack. */
  split: number
  /** % of the music region given to the staff when the highway sits below it. */
  musicSplit: number
  /** PiP corner. */
  corner: PipCorner
  /** PiP width as % of the stage width. */
  pipWidth: number
  /** Music first (left of / above the video); in PiP swap mirrors the corner. */
  swap: boolean
}

export interface Bounds { min: number; max: number }

export const WORKSPACE_LAYOUTS: readonly WorkspaceLayout[] = ['side', 'stack', 'pip', 'music']
export const PIP_CORNERS: readonly PipCorner[] = ['tl', 'tr', 'bl', 'br']
export const SPLIT_BOUNDS: Bounds = { min: 22, max: 78 }
export const MUSIC_SPLIT_BOUNDS: Bounds = { min: 25, max: 80 }
export const PIP_WIDTH_BOUNDS: Bounds = { min: 18, max: 50 }
export const SNAP_POINTS = [100 / 3, 50, 200 / 3] as const
export const SNAP_RANGE = 2.2
export const SPLIT_STEP = 2

export const WATCH_WORKSPACE: WorkspaceState = { layout: 'side', split: 44, musicSplit: 54, corner: 'br', pipWidth: 24, swap: false }
export const PLAY_WORKSPACE: WorkspaceState = { layout: 'pip', split: 46, musicSplit: 54, corner: 'br', pipWidth: 24, swap: false }

const round1 = (v: number) => Math.round(v * 10) / 10
export const clamp = (v: number, b: Bounds) => Math.min(b.max, Math.max(b.min, v))

export function snapSplit(value: number): number {
  for (const point of SNAP_POINTS) if (Math.abs(value - point) <= SNAP_RANGE) return point
  return value
}

/** Pointer position along the stage → leading-region share (clamped, snapped, 0.1 %). */
export function splitFromPointer(pointer: number, start: number, extent: number, bounds: Bounds = SPLIT_BOUNDS): number {
  if (!(extent > 0)) return clamp(50, bounds)
  return round1(snapSplit(clamp(((pointer - start) / extent) * 100, bounds)))
}

export function nudgeSplit(value: number, delta: number, bounds: Bounds = SPLIT_BOUNDS): number {
  return round1(clamp(value + delta, bounds))
}

/** Share of the leading (left / top) region for a media share. Its own inverse. */
export function leadingSplit(split: number, swap: boolean): number {
  return swap ? round1(100 - split) : split
}

export function nearestCorner(point: { x: number; y: number }, box: { left: number; top: number; width: number; height: number }): PipCorner {
  const v = point.y < box.top + box.height / 2 ? 't' : 'b'
  const h = point.x < box.left + box.width / 2 ? 'l' : 'r'
  return `${v}${h}` as PipCorner
}

/** The resize handle sits on the inner corner, so a right-hand PiP grows leftwards. */
export function resizePipWidth(startPct: number, dxPx: number, corner: PipCorner, boxWidth: number): number {
  if (!(boxWidth > 0)) return startPct
  const grow = corner.endsWith('r') ? -dxPx : dxPx
  return round1(clamp(startPct + (grow / boxWidth) * 100, PIP_WIDTH_BOUNDS))
}

export function effectiveLayout(layout: WorkspaceLayout, narrow: boolean): WorkspaceLayout {
  return narrow && layout === 'side' ? 'stack' : layout
}

const MIRROR: Record<PipCorner, PipCorner> = { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' }
export function swapWorkspace(state: WorkspaceState): WorkspaceState {
  if (state.layout === 'pip') return { ...state, corner: MIRROR[state.corner] }
  if (state.layout === 'music') return { ...state, layout: 'side', swap: !state.swap }
  return { ...state, swap: !state.swap }
}

export const workspaceStorageKey = (kind: string) => `lmm-workspace:${kind}`

export function parseWorkspaceState(raw: string | null | undefined, defaults: WorkspaceState,
  layouts: readonly WorkspaceLayout[] = WORKSPACE_LAYOUTS): WorkspaceState {
  let value: unknown = null
  try { value = raw ? JSON.parse(raw) : null } catch { value = null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults }
  const o = value as Record<string, unknown>
  const num = (x: unknown, b: Bounds, fallback: number) =>
    typeof x === 'number' && Number.isFinite(x) ? round1(clamp(x, b)) : fallback
  return {
    layout: layouts.includes(o.layout as WorkspaceLayout) ? o.layout as WorkspaceLayout : defaults.layout,
    split: num(o.split, SPLIT_BOUNDS, defaults.split),
    musicSplit: num(o.musicSplit, MUSIC_SPLIT_BOUNDS, defaults.musicSplit),
    corner: PIP_CORNERS.includes(o.corner as PipCorner) ? o.corner as PipCorner : defaults.corner,
    pipWidth: num(o.pipWidth, PIP_WIDTH_BOUNDS, defaults.pipWidth),
    swap: typeof o.swap === 'boolean' ? o.swap : defaults.swap,
  }
}

export function serializeWorkspaceState(s: WorkspaceState): string {
  return JSON.stringify({ v: 1, layout: s.layout, split: s.split, musicSplit: s.musicSplit, corner: s.corner, pipWidth: s.pipWidth, swap: s.swap })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/playsense-studio/__tests__/workspace-layout.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/workspace-layout.ts lib/playsense-studio/__tests__/workspace-layout.test.ts
git commit -m "Add the lesson workspace layout maths"
```

---

### Task 2: Controller hook

**Files:**
- Create: `components/playsense-studio/player/use-workspace-layout.ts`
- Test: `components/playsense-studio/player/__tests__/use-workspace-layout.test.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces:
```ts
export interface WorkspaceController {
  kind: string
  state: WorkspaceState          // stored choice
  layout: WorkspaceLayout        // what renders (side → stack on phones)
  narrow: boolean
  layouts: readonly WorkspaceLayout[]
  defaults: WorkspaceState
  setLayout(layout: WorkspaceLayout): void   // FLIP-captured
  swap(): void                               // FLIP-captured
  update(patch: Partial<WorkspaceState>): void  // no FLIP (drags, keys, resets)
  /** Set by <SplitWorkspace>: measures the regions right before a layout change. */
  beforeLayoutChangeRef: { current: (() => void) | null }
}
export function useWorkspaceLayout(kind: string, defaults: WorkspaceState, options?: { layouts?: readonly WorkspaceLayout[] }): WorkspaceController
export const PHONE_QUERY = '(max-width: 767px)'
```

- [ ] **Step 1: Write the failing test** — jsdom; a probe component renders the hook and exposes the controller. Cases:
  - starts from the defaults on the first render, then hydrates from `localStorage['lmm-workspace:watch:wrapped']`;
  - `update({split: 60})` saves the serialized state under the kind's key;
  - changing `kind` re-reads that kind's stored state;
  - `setLayout('stack')` calls `beforeLayoutChangeRef.current` before the state changes, and ignores a layout not in `layouts`;
  - `swap()` from pip mirrors the corner and saves;
  - with `matchMedia('(max-width: 767px)')` matching, `layout` is `stack` while `state.layout` stays `side`;
  - a throwing `localStorage` does not break it.

- [ ] **Step 2: Run it to see it fail** — `npx vitest run components/playsense-studio/player/__tests__/use-workspace-layout.test.tsx`.

- [ ] **Step 3: Implement**

```ts
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORKSPACE_LAYOUTS, effectiveLayout, parseWorkspaceState, serializeWorkspaceState, swapWorkspace,
  workspaceStorageKey, type WorkspaceLayout, type WorkspaceState } from '@/lib/playsense-studio/workspace-layout'

export const PHONE_QUERY = '(max-width: 767px)'
// ...interface as above...
export function useWorkspaceLayout(kind, defaults, { layouts = WORKSPACE_LAYOUTS } = {}) {
  const [state, setState] = useState(defaults)
  const [narrow, setNarrow] = useState(false)
  const beforeLayoutChangeRef = useRef<(() => void) | null>(null)
  const kindRef = useRef(kind)
  kindRef.current = kind
  // defaults/layouts are read once per kind: callers pass module constants.
  useEffect(() => {
    let raw: string | null = null
    try { raw = localStorage.getItem(workspaceStorageKey(kind)) } catch { /* storage blocked */ }
    setState(parseWorkspaceState(raw, defaults, layouts))
  }, [kind])
  useEffect(() => {
    const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null
    if (!mq) return
    const sync = () => setNarrow(mq.matches)
    sync(); mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  const commit = useCallback((next: (s: WorkspaceState) => WorkspaceState) => setState(prev => {
    const value = next(prev)
    try { localStorage.setItem(workspaceStorageKey(kindRef.current), serializeWorkspaceState(value)) } catch { /* session only */ }
    return value
  }), [])
  const setLayout = useCallback((layout) => {
    if (!layouts.includes(layout)) return
    beforeLayoutChangeRef.current?.()
    commit(s => ({ ...s, layout }))
  }, [commit, layouts])
  const swap = useCallback(() => { beforeLayoutChangeRef.current?.(); commit(swapWorkspace) }, [commit])
  const update = useCallback((patch) => commit(s => ({ ...s, ...patch })), [commit])
  return useMemo(() => ({ kind, state, layout: effectiveLayout(state.layout, narrow), narrow, layouts, defaults,
    setLayout, swap, update, beforeLayoutChangeRef }), [...])
}
```
(Side effects inside a state updater run twice under StrictMode; writing the same value twice is harmless.)

- [ ] **Step 4: Run to pass.** - [ ] **Step 5: Commit** `Add the workspace layout controller hook`.

---

### Task 3: The workspace shell and layout switcher

**Files:**
- Rewrite: `components/playsense-studio/player/split-workspace.tsx`
- Create: `components/playsense-studio/player/split-workspace.css`
- Rewrite: `components/playsense-studio/player/__tests__/split-workspace.test.tsx`
- Modify: `locales/en.json`, `locales/es.json` (`lessonWorkspace` block)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
```ts
export interface SplitWorkspaceProps {
  controller: WorkspaceController
  media?: ReactNode        // omitted → music only, nothing to lay out
  music: ReactNode         // the staff pane
  highway?: ReactNode      // below the staff, own horizontal divider
  overlay?: ReactNode      // absolute layer over the whole stage
  frame?: 'card' | 'bleed' | 'fill'   // card = bordered, ≤ initialHeight; bleed = fitted to the viewport above the lesson footer; fill = parent sizes it
  initialHeight?: number   // card only, default 560
  className?: string
}
export function SplitWorkspace(props: SplitWorkspaceProps): JSX.Element
export function WorkspaceLayoutSwitcher(props: { controller: WorkspaceController; className?: string }): JSX.Element | null
```
- DOM contract (tests and CSS rely on it): frame `[data-lesson-workspace]` > `.ws[data-layout][data-swap][data-corner]` > `.ws-media` (if media), `.ws-div[role=separator]` (if media), `.ws-music` > `.ws-staff` (+ `.ws-div2[role=separator]` + `.ws-highway` if highway); `.ws-pip-resize` inside `.ws-media`. Elements marked `[data-ws-nodrag]` (and inputs, links, sliders) never start a PiP drag.
- CSS variables on `.ws`: `--ws-lead` (leading region %, from `leadingSplit`), `--ws-staff` (music split %), `--ws-pipw` (PiP width %).
- Strings: `lessonWorkspace.layout` (group label), `.side`, `.stack`, `.pip`, `.music`, `.swap`, `.resize`, `.resizeMusic`, `.resizeHint`, `.movePip`, `.resizePip`.

- [ ] **Step 1: Write the failing tests** (jsdom; stub `ResizeObserver`, `getBoundingClientRect` → 1000×600 at 0,0, `matchMedia`, `Element.prototype.animate` spy):
  - `fits the workspace to the viewport on mount` (bleed; kept from the old suite);
  - `renders the watch default: side with the divider at 44 %` (`data-layout=side`, `--ws-lead: 44`, separator `aria-valuenow=44`);
  - `divider drag snaps and clamps, and commits on release` (pointerdown on `.ws-div`, move to x=488 → pill `50%`, `--ws-lead: 50`; release → saved split 50; move to x=900 → 78);
  - `arrow keys nudge by 2 and double-click resets` (ArrowRight → 46; dblclick → 44 and `.ws-anim` class present);
  - `swap puts music first and keeps the media share` (`data-swap=true`, `--ws-lead: 56`);
  - `keeps the same media node across layouts` (the `<video>` node is identical after side → stack → pip → music);
  - `pip drag springs to the nearest corner` (layout pip; pointerdown on media at (900,500), move to (100,100) → transform includes `rotate(`; release → `data-corner=tl`);
  - `a tap on the pip is not a drag` (pointerdown/up with 2 px movement; corner unchanged; the button's click still fires);
  - `pip resize from the inner corner` (pointerdown on `.ws-pip-resize`, move −100 px → `--ws-pipw: 34`);
  - `double-click on the pip goes back to side`;
  - `FLIP animates both regions for 440 ms` and `reduced motion skips FLIP` (`animate` spy calls);
  - `music divider appears with the highway` (`.ws-div2` present, `--ws-staff: 54`);
  - switcher: `shows four layouts and swap, marks the active one`, `hides side on phones`, `renders nothing without media layouts to choose` (controller with `layouts=['music']`), `side/stack only when the view offers only those`.

- [ ] **Step 2: Run to fail.** `npx vitest run components/playsense-studio/player/__tests__/split-workspace.test.tsx`

- [ ] **Step 3: Implement** the shell (height fitting kept from the old component, minus the knob), the divider/PiP pointer handlers (window listeners; CSS variables written directly while dragging; one `controller.update` on release; 4 px drag threshold on the PiP with a one-shot capture-phase click swallow after a real drag), FLIP (`controller.beforeLayoutChangeRef` measures both regions; a layout effect keyed on layout/swap/corner plays `el.animate` translate+scale 440 ms `cubic-bezier(.22,1,.36,1)`, or a .92 fade-scale-in for a region that had no box; skipped when `prefers-reduced-motion: reduce`), the PiP spring (`cubic-bezier(.34,1.56,.64,1)`, 440 ms) and the switcher (sliding amber indicator measured from the pressed button; `side` hidden when `controller.narrow`). CSS follows lab `.ws-*`: 16 px divider track, grip 4×44 → 72 + primary ring on hover/focus/drag, % pill, 12 px music divider, PiP `width: min(100% - 32px, max(180px, pipw%))` with 16 px insets (58 px from the top), `.ws-anim` grid transition 360 ms, phone PiP min 140 px, reduced motion kills transitions.

- [ ] **Step 4: Add the strings** with a node script that inserts only the `lessonWorkspace` block after `lessonView` in both locale files.

- [ ] **Step 5: Run to pass; `npx tsc --noEmit -p .`; eslint the files.** (The watch player and video-info-split still use the old API at this point — Task 4 lands in the same commit if tsc needs it.)

- [ ] **Step 6: Commit** `Rebuild SplitWorkspace as the adjustable lesson workspace`.

---

### Task 4: Watch view and the no-score video lesson

**Files:**
- Modify: `components/playsense-studio/player/playsense-studio-player.tsx` (split branch, `lessonView` state, header)
- Modify: `components/class-viewer/lesson-viewer/video-info-split.tsx`
- Test: `components/class-viewer/lesson-viewer/__tests__/video-info-split.test.tsx`

**Interfaces:** Consumes `SplitWorkspace`, `WorkspaceLayoutSwitcher`, `useWorkspaceLayout`, `WATCH_WORKSPACE`.

- Player: `const workspace = useWorkspaceLayout(\`watch:${notationLayout}\`, WATCH_WORKSPACE)`. media = `VideoStage` (+ `TransportBar` below it in side/stack, wrapped in `[data-ws-nodrag]`); in pip / music the transport moves under the staff (as the old score-only view did). music = the existing header (title, meta, `WorkspaceLayoutSwitcher`, `NotationLayoutToggle`) + zoom layer + staff + scrub. `overlayEl` stays over the whole workspace. The `lessonView` state and `lmm-lesson-view` storage go (video-only is not a spec layout; music-only replaces score-only).
- VideoInfoSplit: `useWorkspaceLayout('video-info', { ...WATCH_WORKSPACE, split: 55 }, { layouts: ['side', 'stack'] })`, frame `card`, switcher in the "About this lesson" header.
- Test: VideoInfoSplit renders the video in `.ws-media` and a switcher offering only side and stack (+ swap).

- [ ] Steps: failing test → run → implement → run → tsc/eslint → run `exercise-view.test.tsx` → commit `Use the workspace for the watch view and the no-score video lesson`.

---

### Task 5: Play view

**Files:**
- Modify: `components/class-viewer/lesson-viewer/score-exercise-game.tsx`
- Rewrite: `components/class-viewer/lesson-viewer/exercise-workspace.tsx`, `exercise-workspace.css`
- Create: `components/class-viewer/lesson-viewer/__tests__/exercise-workspace.test.ts`
- Modify: `exercise-mode-frame.tsx` (drop the Video toggle), `exercise-mode.css` (`data-has-tracks` → `data-has-tools`)
- Delete: `lib/playsense-studio/exercise-layout.ts`, `lib/playsense-studio/__tests__/exercise-layout.test.ts`

**Interfaces:**
```ts
// exercise-workspace.tsx
export type ScorePosition = 'left' | 'top' | 'right'
export function scorePositionFor(state: WorkspaceState, layout: WorkspaceLayout): ScorePosition
export function layoutForScorePosition(position: ScorePosition): Partial<WorkspaceState>
export function ExerciseScoreWorkspaceBridge(props: { controller: WorkspaceController; children: ReactNode }): JSX.Element
export function useExerciseWorkspace(): { position; setPosition; stacked; resetSize; scoreId } | null   // unchanged shape
```
Mapping: stack → `top`; side + swap → `left`; everything else → `right` (keeps the wrapped reading). `setPosition('left')` → side + swap, `'right'` → side, `'top'` → stack, no swap.

- Game: `useWorkspaceLayout('play', PLAY_WORKSPACE)`; `<SplitWorkspace frame="fill" media={exerciseVideo && <video ref={videoRef} …/>} music={showCanvas && score ? <ExerciseScore …/> : stage} highway={showCanvas && score ? stage : undefined} overlay={audio-mode + playsense-test overlays}/>`. The same `videoRef` element as before (no second player); its sync effect is untouched. The stage loses its fixed heights and fills its region. The switcher renders in the game heading, which now shows when there are backing tracks or a video (`data-has-tools`).
- Test: the mapping both ways.

- [ ] Steps: failing test → run → implement → run full lesson-viewer tests → tsc/eslint → commit `Use the workspace for the play view`.

---

### Task 6: Visual check, build, phase check

- [ ] Temporary `app/playsense-preview/workspace/page.tsx` (dev-only `notFound()` gate): watch = `PlaysenseStudioPlayer layout="split" readOnly` with `/videos/band-performing.mp4` and the conga fixture; play = `ScoreExerciseGame preview` with an `exerciseVideo` of the same file. A `?view=watch|play` switch.
- [ ] Headless screenshots via `.superpowers/shot.mjs` (CDP 9613, dev server 3013): side, stack, pip (each corner), music only, swap, mid-drag (pill), watch + play, dark + light, phone 390×844, reduced motion.
- [ ] Delete the preview page. `npx vitest run`, `npx tsc --noEmit -p .`, eslint on touched files, stop the dev server, `npm run build`.
- [ ] Final review (one fresh reviewer on the branch diff with this Review Focus); fix Critical/Important with a failing test first.
