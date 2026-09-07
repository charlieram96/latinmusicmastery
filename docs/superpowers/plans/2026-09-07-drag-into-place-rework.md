# Drag Into Place Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `piece_placement` student input (portal ghost, grab offset, tap/keyboard placement, snap-and-ring grading, faded reveal, viewport-bounded stage) and the admin builder (compose-the-answer canvas with tolerance halos, undo/redo, multi-file aligned import with trim-on-upload, aspect refit, warnings, Fix images) on top of the existing data model.

**Architecture:** Pure, vitest-covered geometry in `lib/quiz/placement.ts` (height, area ↔ centre/tolerance, clamp, drop, frame mapping, aspect refit, swappable, warnings) and pure pixel math in `lib/quiz/image-trim.ts`; the browser-only parts (canvas decode/encode, storage upload) live in `components/admin/piece-placement/builder-import.ts`. The student input is one client component that owns drag state in refs and renders its ghost through a portal. The builder keeps its dialog/canvas/panel split but the canvas now draws pieces as sprites and the dialog owns an undo history on top of the Studio autosave.

**Tech Stack:** Next 16 / React 19, TypeScript, Tailwind v3 tokens + `quiz.module.css` (container queries), Radix Dialog, lucide-react, Supabase storage (`quiz-media` bucket, browser client), vitest (node env). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-drag-into-place-rework-design.md`

## Global Constraints

- No new npm dependencies. No database migration: every new field (`piece.ratio`, `piece.tolerance`, `options.tolerance`, `layer.name`) is optional and read with defaults.
- `lib/quiz/grading.ts` is NOT modified. `isPieceCorrect` (piece centre inside `area`) stays the grading rule; the builder always writes `area`.
- `options_es` keeps the English ids; the builder writes Spanish labels only through `patchLocalizedEntry` / `pruneLocalizedEntries` from `lib/quiz/options-es.ts`.
- Student strings via `useTranslation()` from `@/components/language-provider`; keys under `dashboard.classViewer.quiz.pieces` in BOTH `locales/en.json` and `locales/es.json`. Admin builder strings stay English.
- `locales/*.json` may be edited by another session: add keys with the `add_locale_keys` node snippet in Task 3 Step 1 and confirm `git diff --stat locales/` shows only added lines.
- Colours only from tokens (`text-success`, `text-terracotta`, `ring-success`, `ring-terracotta`, `bg-card`, `bg-raised`, `bg-sunken`, `border-border`, `text-gold`, `text-primary`, `text-muted-foreground`). State rings use `ring-*` (box-shadow), never `outline-*`.
- `lib/quiz/**` and `hooks/**` must run under vitest `node`: no DOM access at module top level; browser-only helpers are guarded or live under `components/`.
- Motion: every transition/animation added is disabled under `@media (prefers-reduced-motion: reduce)` in `quiz.module.css`; the ghost grow is skipped when `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Another session may hold uncommitted edits in this tree (`lesson-sidebar.tsx`, `curriculum-navigator.tsx`, `module-overview-body.tsx`; two one-line edits in `piece-placement-input.tsx` and `quiz.module.css` that Task 3 absorbs). `git status --short` before every commit; `git add` only the files the task lists; never `git checkout --`/stash files the task did not touch.
- The hosted Supabase project is the dev DB. **Fix images** (Task 8) writes storage objects and rewrites `options`; run it on the real question only when the user asks in chat.
- Code style: no semicolons, single quotes, 2-space indent (match `lib/quiz/grading.ts`).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013oruWDUFEK4wyw9EZUhw45
  ```
- Verification commands: `npx vitest run lib/quiz hooks`, `npx tsc --noEmit`, `npm run lint -- --quiet`. Dev server on 3005: `lsof -nP -iTCP:3005 -sTCP:LISTEN` first (another session may already run it; it was running on 2026-09-06), else `nohup npm run dev -- -p 3005 > /tmp/dev3005.log 2>&1 &`. Student URL: `http://localhost:3005/dashboard/course/197b393d-6d41-4147-9802-574919aa51fa/class/aacdccc9-2214-4c2c-b8b4-b08f37939259?item=3`. Builder: `http://localhost:3005/admin/courses/197b393d-6d41-4147-9802-574919aa51fa` → outline "Intro: The Timbal in Son" → item "Assemble your timbales" → "Open builder".

---

## File map

| Path | Responsibility |
|---|---|
| `lib/quiz/placement.ts` (new) | Pure geometry: `pieceHeightPct`, `areaFor`, `centreOf`, `toleranceOf`, `effectiveRatio`, `clampCentre`, `resolveDrop`, `frameToStage`, `refitForAspect`, `swappable`, `pieceWarnings`, `DEFAULT_TOLERANCE` |
| `lib/quiz/composition.ts` | + `readTolerance(options)`; `readPieces` normalises `ratio`/`tolerance`; `BackgroundLayer.name?` |
| `lib/quiz/image-trim.ts` (new) | Pure `alphaBounds`, `boxToPercent`, `scaleToFit`; constants `MAX_SIDE`, `ALPHA_THRESHOLD`, `TRIM_PAD` |
| `lib/quiz/transform.ts` | `resizeRect` gains `boxRatio?: number` (natural-ratio lock) |
| `lib/quiz/__tests__/placement.test.ts`, `image-trim.test.ts`, `history.test.ts` (new); `composition.test.ts`, `transform.test.ts` (extended) | unit tests |
| `hooks/use-history.ts` (new) | `historyReducer<T>` + `useHistory<T>()` |
| `locales/en.json`, `locales/es.json` | new `dashboard.classViewer.quiz.pieces.*` keys |
| `components/class-viewer/lesson-viewer/quiz/quiz.module.css` | stage cap, compact tray, strip `pan-x`, shake/snap keyframes |
| `components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx` | rewritten student input; still exports `CompositionBackground`, `useMeasuredAspect`, `useStageAspect` |
| `components/admin/piece-placement/builder-import.ts` (new) | browser pipeline: `decodeImage`, `trimImage`, `uploadImageBlob`, `measureNatural`, `importPieceFiles`, `fixImages` |
| `components/admin/piece-placement/use-canvas-transform.ts` | + `centre` mode, `onEnd` callback, `boxRatio` pass-through |
| `components/admin/piece-placement/composition-canvas.tsx` | compose-the-answer canvas |
| `components/admin/piece-placement/inspector-pieces.tsx` | drop zone, tolerance slider, rows with warnings |
| `components/admin/piece-placement/inspector-background.tsx` | aspect refit, layers with name/size/Fit to image, multi upload, Fix images, advanced details |
| `components/admin/piece-placement/builder-dialog.tsx` | history, toolbar, question text, tabs, preview, import/fix wiring |
| `components/admin/piece-placement/piece-placement-summary.tsx` | composed-answer thumbnail |
| `components/admin/quiz-builder.tsx:116` | passes `question` to the summary |

---

### Task 1: Pure placement geometry (`lib/quiz/placement.ts`) and composition additions

**Files:**
- Create: `lib/quiz/placement.ts`
- Modify: `lib/quiz/composition.ts` (types + `readPieces` + `readTolerance`)
- Test: `lib/quiz/__tests__/placement.test.ts`, `lib/quiz/__tests__/composition.test.ts`

**Interfaces:**
- Consumes: `PlacementArea`, `PlacementPiece`, `PiecePlacement` from `lib/quiz/grading.ts`; `Background`, `BackgroundLayer` from `lib/quiz/composition.ts`.
- Produces (used by Tasks 3, 6, 7, 8, 9):
  ```ts
  export const DEFAULT_TOLERANCE = 3
  export type Centre = { x: number; y: number }
  export type Box = { x: number; y: number; width: number; height: number }
  export type StageRect = { left: number; top: number; width: number; height: number }
  export function pieceHeightPct(width: number, aspect: number, ratio: number | undefined): number
  export function areaFor(centre: Centre, width: number, height: number, tolerance: number): PlacementArea
  export function centreOf(area: PlacementArea): Centre
  export function toleranceOf(area: PlacementArea, width: number, height: number): number
  export function effectiveRatio(piece: PlacementPiece, aspect: number, tolerance: number): number
  export function clampCentre(centre: Centre, width: number, height: number): Centre
  export function resolveDrop(pointer: Centre, grab: { dx: number; dy: number }, stage: StageRect): Centre | null
  export function frameToStage(frame: Box, layer: Box): { centre: Centre; width: number }
  export function refitForAspect(background: Background, pieces: PlacementPiece[], newAspect: number, tolerance: number): { background: Background; pieces: PlacementPiece[] }
  export function placePiece(piece: PlacementPiece, centre: Centre, width: number, aspect: number, tolerance: number): PlacementPiece
  export function swappable(a: { centre: Centre; area: PlacementArea }, b: { centre: Centre; area: PlacementArea }): boolean
  export type PieceWarning = { code: 'noName' } | { code: 'swappable'; with: number[] } | { code: 'offCanvas' } | { code: 'fullFrame' }
  export function pieceWarnings(pieces: PlacementPiece[], aspect: number, tolerance: number, fullFrameIds?: ReadonlySet<string>): Record<string, PieceWarning[]>
  ```
  and in `composition.ts`: `readTolerance(options: unknown): number`, `BackgroundLayer.name?: string`, `readPieces` keeps `ratio` only when finite > 0 and `tolerance` only when finite ≥ 0.

- [ ] **Step 1: Write the failing tests**

`lib/quiz/__tests__/placement.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { PlacementPiece } from '../grading'
import {
  DEFAULT_TOLERANCE, areaFor, centreOf, clampCentre, effectiveRatio, frameToStage, pieceHeightPct, pieceWarnings, placePiece, refitForAspect, resolveDrop, swappable, toleranceOf,
} from '../placement'

const piece = (over: Partial<PlacementPiece> & { id: string }): PlacementPiece => ({ label: 'x', imageUrl: 'u', width: 10, area: { x: 0, y: 0, width: 10, height: 10 }, ...over })

describe('pieceHeightPct', () => {
  it('scales width by the stage aspect over the sprite ratio', () => {
    expect(pieceHeightPct(10, 4 / 3, 2)).toBeCloseTo(6.6667, 3)
    expect(pieceHeightPct(10, 1, undefined)).toBe(10)
  })
})

describe('areaFor / centreOf / toleranceOf', () => {
  it('round-trips a centre, size and tolerance', () => {
    const area = areaFor({ x: 50, y: 40 }, 20, 10, 3)
    expect(area).toEqual({ x: 37, y: 32, width: 26, height: 16 })
    expect(centreOf(area)).toEqual({ x: 50, y: 40 })
    expect(toleranceOf(area, 20, 10)).toBe(3)
  })
  it('never returns a negative tolerance', () => {
    expect(toleranceOf({ x: 0, y: 0, width: 5, height: 5 }, 20, 10)).toBe(0)
    expect(areaFor({ x: 50, y: 50 }, 10, 10, -4).width).toBe(10)
  })
})

describe('effectiveRatio', () => {
  it('prefers the stored ratio, else derives it from the legacy area', () => {
    expect(effectiveRatio(piece({ id: 'a', ratio: 2 }), 1.6, 3)).toBe(2)
    // area 26 x 16 with tolerance 3 → piece 20 x 10 on a 1.6 stage → ratio = 20 * 1.6 / 10
    expect(effectiveRatio(piece({ id: 'b', width: 20, area: { x: 0, y: 0, width: 26, height: 16 } }), 1.6, 3)).toBeCloseTo(3.2, 5)
    expect(effectiveRatio(piece({ id: 'c', width: 20, area: { x: 0, y: 0, width: 20, height: 0 } }), 1.6, 3)).toBe(1)
  })
})

describe('clampCentre', () => {
  it('keeps the whole sprite inside the stage', () => {
    expect(clampCentre({ x: 2, y: 99 }, 20, 10)).toEqual({ x: 10, y: 95 })
    expect(clampCentre({ x: 50, y: 50 }, 120, 10)).toEqual({ x: 50, y: 50 })
  })
})

describe('resolveDrop', () => {
  const stage = { left: 100, top: 200, width: 400, height: 300 }
  it('maps the grab-corrected pointer to percent', () => {
    expect(resolveDrop({ x: 320, y: 380 }, { dx: 20, dy: 30 }, stage)).toEqual({ x: 50, y: 50 })
  })
  it('returns null outside the stage or for an empty stage', () => {
    expect(resolveDrop({ x: 99, y: 250 }, { dx: 0, dy: 0 }, stage)).toBeNull()
    expect(resolveDrop({ x: 300, y: 250 }, { dx: 0, dy: 0 }, { ...stage, width: 0 })).toBeNull()
  })
})

describe('frameToStage', () => {
  it('maps a file-percent box through the layer rect', () => {
    const r = frameToStage({ x: 25, y: 50, width: 50, height: 20 }, { x: 10, y: 20, width: 40, height: 60 })
    expect(r.centre).toEqual({ x: 30, y: 56 })
    expect(r.width).toBe(20)
  })
})

describe('placePiece', () => {
  it('writes width and an area around the centre', () => {
    const p = placePiece(piece({ id: 'a', ratio: 2 }), { x: 50, y: 50 }, 20, 1, 2)
    expect(p.width).toBe(20)
    expect(p.area).toEqual({ x: 38, y: 43, width: 24, height: 14 })
  })
})

describe('refitForAspect', () => {
  const bg = { color: '#000', aspect: 1, layers: [{ id: 'l', imageUrl: 'u', x: 30, y: 10, width: 40, height: 80, ratio: 0.5 }] }
  const p = placePiece(piece({ id: 'p', ratio: 1 }), { x: 50, y: 50 }, 10, 1, 3)
  it('keeps layer height and natural ratio, and scales pieces with the layer', () => {
    const out = refitForAspect(bg, [p], 2, 3)
    expect(out.background.aspect).toBe(2)
    expect(out.background.layers[0]).toMatchObject({ x: 40, y: 10, width: 20, height: 80 })
    expect(centreOf(out.pieces[0].area)).toEqual({ x: 50, y: 50 })
    expect(out.pieces[0].width).toBe(5)
    expect(out.pieces[0].area.height).toBeCloseTo(10 + 6, 5) // 5 wide * aspect 2 / ratio 1 = 10 tall + 2 * 3
  })
  it('leaves layers without a ratio alone', () => {
    const out = refitForAspect({ ...bg, layers: [{ ...bg.layers[0], ratio: undefined }] }, [p], 2, 3)
    expect(out.background.layers[0]).toMatchObject({ x: 30, width: 40 })
    expect(out.pieces[0].width).toBe(10)
  })
})

describe('swappable', () => {
  it('is true only when each centre sits in the other area', () => {
    const a = { centre: { x: 50, y: 50 }, area: { x: 40, y: 40, width: 20, height: 20 } }
    const b = { centre: { x: 55, y: 55 }, area: { x: 45, y: 45, width: 20, height: 20 } }
    const c = { centre: { x: 90, y: 90 }, area: { x: 0, y: 0, width: 100, height: 100 } }
    expect(swappable(a, b)).toBe(true)
    expect(swappable(a, c)).toBe(false)
  })
})

describe('pieceWarnings', () => {
  it('flags blank names, swappable pairs, off-canvas sprites and full-frame images', () => {
    const a = placePiece(piece({ id: 'a', label: ' ', ratio: 1 }), { x: 50, y: 50 }, 10, 1, 3)
    const b = placePiece(piece({ id: 'b', label: 'B', ratio: 1 }), { x: 52, y: 52 }, 10, 1, 3)
    const c = placePiece(piece({ id: 'c', label: 'C', ratio: 1 }), { x: 2, y: 50 }, 10, 1, DEFAULT_TOLERANCE)
    const w = pieceWarnings([a, b, c], 1, 3, new Set(['c']))
    expect(w.a).toEqual([{ code: 'noName' }, { code: 'swappable', with: [2] }])
    expect(w.b).toEqual([{ code: 'swappable', with: [1] }])
    expect(w.c).toEqual([{ code: 'offCanvas' }, { code: 'fullFrame' }])
  })
})
```

Append to `lib/quiz/__tests__/composition.test.ts`:
```ts
describe('readPieces normalisation', () => {
  it('keeps ratio and tolerance only when they are sane', () => {
    const [p] = readPieces({ pieces: [{ id: 'p', imageUrl: 'u', width: 5, area: { x: 0, y: 0, width: 1, height: 1 }, ratio: 0, tolerance: 2 }] })
    expect(p).not.toHaveProperty('ratio')
    expect(p.tolerance).toBe(2)
    const [q] = readPieces({ pieces: [{ id: 'q', imageUrl: 'u', width: 5, area: { x: 0, y: 0, width: 1, height: 1 }, ratio: 1.5, tolerance: -1 }] })
    expect(q.ratio).toBe(1.5)
    expect(q).not.toHaveProperty('tolerance')
    expect(readPieces({ pieces: [null, 'x'] })).toEqual([])
  })
})

describe('readTolerance', () => {
  it('returns the stored question default or 3', () => {
    expect(readTolerance({ tolerance: 5 })).toBe(5)
    expect(readTolerance({ tolerance: -1 })).toBe(3)
    expect(readTolerance(null)).toBe(3)
  })
})
```
(add `readTolerance` to the import line at the top of that file).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/quiz/__tests__/placement.test.ts lib/quiz/__tests__/composition.test.ts`
Expected: FAIL — `Cannot find module '../placement'` and `readTolerance is not a function`.

- [ ] **Step 3: Implement `composition.ts` additions**

In `lib/quiz/composition.ts`:
- add `name?: string` to `BackgroundLayer` (after `ratio?`), and in `toLayer` keep it: `if (typeof name === 'string' && name.trim()) layer.name = name.trim()` (destructure `name` from `v`).
- replace `readPieces`:
```ts
export function readPieces(options: unknown): PlacementPiece[] {
  const opts = isRecord(options) ? options : {}
  if (!Array.isArray(opts.pieces)) return []
  const out: PlacementPiece[] = []
  for (const v of opts.pieces) {
    if (!isRecord(v)) continue
    const { ratio, tolerance, ...rest } = v
    const piece = { ...rest } as PlacementPiece
    if (isFiniteNumber(ratio) && ratio > 0) piece.ratio = ratio
    if (isFiniteNumber(tolerance) && tolerance >= 0) piece.tolerance = tolerance
    out.push(piece)
  }
  return out
}

/** Question-level default tolerance (percent of stage width) for the builder's halo; `area` is what the grader reads. */
export function readTolerance(options: unknown): number {
  const opts = isRecord(options) ? options : {}
  return isFiniteNumber(opts.tolerance) && opts.tolerance >= 0 ? opts.tolerance : 3
}
```
- in `lib/quiz/grading.ts` DO NOT edit; instead extend the type where it lives: `PlacementPiece` is declared in `grading.ts`. Adding two optional fields to that type is a type-only change with no behaviour change; it is the one allowed edit there:
```ts
export type PlacementPiece = { id: string; label?: string; imageUrl: string; width: number; area: PlacementArea; ratio?: number; tolerance?: number }
```

- [ ] **Step 4: Implement `lib/quiz/placement.ts`**

```ts
import type { PlacementArea, PlacementPiece } from './grading'
import type { Background } from './composition'

/** Pure geometry for piece placement. All numbers are percent of the stage unless noted. */
export const DEFAULT_TOLERANCE = 3

export type Centre = { x: number; y: number }
export type Box = { x: number; y: number; width: number; height: number }
export type StageRect = { left: number; top: number; width: number; height: number }

const r1 = (n: number) => Math.round(n * 1000) / 1000
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const inside = (area: PlacementArea, c: Centre) => c.x >= area.x && c.x <= area.x + area.width && c.y >= area.y && c.y <= area.y + area.height

/** On-stage height of a sprite: width scaled by the stage aspect over the sprite's natural ratio. */
export function pieceHeightPct(width: number, aspect: number, ratio: number | undefined): number {
  return (width * aspect) / (ratio && ratio > 0 ? ratio : 1)
}

export function areaFor(centre: Centre, width: number, height: number, tolerance: number): PlacementArea {
  const t = Math.max(0, tolerance)
  return { x: r1(centre.x - width / 2 - t), y: r1(centre.y - height / 2 - t), width: r1(width + 2 * t), height: r1(height + 2 * t) }
}

export function centreOf(area: PlacementArea): Centre {
  return { x: r1(area.x + area.width / 2), y: r1(area.y + area.height / 2) }
}

export function toleranceOf(area: PlacementArea, width: number, height: number): number {
  return Math.max(0, r1(Math.min((area.width - width) / 2, (area.height - height) / 2)))
}

/** Stored ratio, else the ratio implied by a legacy area (piece centred in its box), else 1. */
export function effectiveRatio(piece: PlacementPiece, aspect: number, tolerance: number): number {
  if (piece.ratio && piece.ratio > 0) return piece.ratio
  const t = piece.tolerance ?? tolerance
  const h = piece.area.height - 2 * Math.min(t, (piece.area.width - piece.width) / 2)
  return h > 0 && piece.width > 0 ? (piece.width * aspect) / h : 1
}

export function clampCentre(centre: Centre, width: number, height: number): Centre {
  const hw = Math.min(50, width / 2), hh = Math.min(50, height / 2)
  return { x: clamp(centre.x, hw, 100 - hw), y: clamp(centre.y, hh, 100 - hh) }
}

/** Pointer (viewport px) minus the grab offset → centre in percent, or null when the centre is off the stage. */
export function resolveDrop(pointer: Centre, grab: { dx: number; dy: number }, stage: StageRect): Centre | null {
  if (stage.width <= 0 || stage.height <= 0) return null
  const cx = pointer.x - grab.dx, cy = pointer.y - grab.dy
  if (cx < stage.left || cx > stage.left + stage.width || cy < stage.top || cy > stage.top + stage.height) return null
  return { x: ((cx - stage.left) / stage.width) * 100, y: ((cy - stage.top) / stage.height) * 100 }
}

/** An object's bounding box in percent of its file, mapped through the layer that file is aligned to. */
export function frameToStage(frame: Box, layer: Box): { centre: Centre; width: number } {
  return {
    centre: { x: r1(layer.x + (layer.width * (frame.x + frame.width / 2)) / 100), y: r1(layer.y + (layer.height * (frame.y + frame.height / 2)) / 100) },
    width: r1((layer.width * frame.width) / 100),
  }
}

export function placePiece(piece: PlacementPiece, centre: Centre, width: number, aspect: number, tolerance: number): PlacementPiece {
  const ratio = effectiveRatio({ ...piece, width }, aspect, tolerance)
  const h = pieceHeightPct(width, aspect, ratio)
  return { ...piece, width: r1(width), area: areaFor(centre, width, h, piece.tolerance ?? tolerance) }
}

/** Change the stage aspect without distorting anything: layers keep height + natural ratio, pieces follow the first layer. */
export function refitForAspect(background: Background, pieces: PlacementPiece[], newAspect: number, tolerance: number): { background: Background; pieces: PlacementPiece[] } {
  const oldAspect = background.aspect ?? newAspect
  const layers = background.layers.map((l) => {
    if (!l.ratio) return l
    const width = r1((l.height * l.ratio) / newAspect)
    const cx = l.x + l.width / 2
    return { ...l, width, x: r1(clamp(cx - width / 2, 0, Math.max(0, 100 - width))) }
  })
  const base = background.layers[0], baseNew = layers[0]
  const kx = base && baseNew && base.ratio && base.width > 0 ? baseNew.width / base.width : 1
  const next = pieces.map((p) => {
    const ratio = effectiveRatio(p, oldAspect, tolerance)
    const c = centreOf(p.area)
    const centre = base && baseNew && base.ratio ? { x: baseNew.x + (c.x - base.x) * kx, y: baseNew.y + (c.y - base.y) } : c
    const width = p.width * kx
    return placePiece({ ...p, ratio }, centre, width, newAspect, tolerance)
  })
  return { background: { ...background, aspect: newAspect, layers }, pieces: next }
}

export function swappable(a: { centre: Centre; area: PlacementArea }, b: { centre: Centre; area: PlacementArea }): boolean {
  return inside(a.area, b.centre) && inside(b.area, a.centre)
}

export type PieceWarning = { code: 'noName' } | { code: 'swappable'; with: number[] } | { code: 'offCanvas' } | { code: 'fullFrame' }

export function pieceWarnings(pieces: PlacementPiece[], aspect: number, tolerance: number, fullFrameIds: ReadonlySet<string> = new Set()): Record<string, PieceWarning[]> {
  const geo = pieces.map((p) => ({ centre: centreOf(p.area), area: p.area, h: pieceHeightPct(p.width, aspect, effectiveRatio(p, aspect, tolerance)) }))
  const out: Record<string, PieceWarning[]> = {}
  pieces.forEach((p, i) => {
    const w: PieceWarning[] = []
    if (!(p.label ?? '').trim()) w.push({ code: 'noName' })
    const swaps = geo.map((g, j) => (j !== i && swappable(geo[i], g) ? j + 1 : 0)).filter(Boolean)
    if (swaps.length) w.push({ code: 'swappable', with: swaps })
    const g = geo[i]
    if (g.centre.x - p.width / 2 < 0 || g.centre.x + p.width / 2 > 100 || g.centre.y - g.h / 2 < 0 || g.centre.y + g.h / 2 > 100) w.push({ code: 'offCanvas' })
    if (fullFrameIds.has(p.id)) w.push({ code: 'fullFrame' })
    out[p.id] = w
  })
  return out
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/quiz`
Expected: all green, including the existing `grading`, `composition`, `transform` suites.

- [ ] **Step 6: Commit**

```bash
git status --short
git add lib/quiz/placement.ts lib/quiz/composition.ts lib/quiz/grading.ts lib/quiz/__tests__/placement.test.ts lib/quiz/__tests__/composition.test.ts
git commit -m "quiz: pure placement geometry (area ↔ centre/tolerance, drop, frame mapping, aspect refit, warnings)"
```

---

### Task 2: Undo history hook (`hooks/use-history.ts`)

**Files:**
- Create: `hooks/use-history.ts`
- Test: `lib/quiz/__tests__/history.test.ts`

**Interfaces:**
- Produces (used by Task 9):
  ```ts
  export type HistoryState<T> = { past: T[]; present: T; future: T[] }
  export type HistoryAction<T> = { type: 'commit'; next: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; present: T }
  export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T>
  export function useHistory<T>(initial: T): { present: T; canUndo: boolean; canRedo: boolean; commit: (next: T) => void; undo: () => T | null; redo: () => T | null; reset: (present: T) => void }
  ```
  `commit` with a `next` deep-equal (by `JSON.stringify`) to `present` is a no-op. The stack keeps at most 100 past entries.

- [ ] **Step 1: Write the failing test**

`lib/quiz/__tests__/history.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { historyReducer, type HistoryState } from '@/hooks/use-history'

const s0: HistoryState<number> = { past: [], present: 0, future: [] }

describe('historyReducer', () => {
  it('commits, undoes and redoes', () => {
    const s1 = historyReducer(s0, { type: 'commit', next: 1 })
    const s2 = historyReducer(s1, { type: 'commit', next: 2 })
    expect(s2).toEqual({ past: [0, 1], present: 2, future: [] })
    const u = historyReducer(s2, { type: 'undo' })
    expect(u).toEqual({ past: [0], present: 1, future: [2] })
    expect(historyReducer(u, { type: 'redo' })).toEqual(s2)
  })
  it('ignores a commit that changes nothing and clears the future on a new commit', () => {
    const s1 = historyReducer(s0, { type: 'commit', next: 0 })
    expect(s1).toBe(s0)
    const u = historyReducer(historyReducer(s0, { type: 'commit', next: 1 }), { type: 'undo' })
    expect(historyReducer(u, { type: 'commit', next: 5 })).toEqual({ past: [0], present: 5, future: [] })
  })
  it('does nothing at the ends and resets', () => {
    expect(historyReducer(s0, { type: 'undo' })).toBe(s0)
    expect(historyReducer(s0, { type: 'redo' })).toBe(s0)
    expect(historyReducer({ past: [1, 2], present: 3, future: [4] }, { type: 'reset', present: 9 })).toEqual({ past: [], present: 9, future: [] })
  })
  it('caps the past at 100 entries', () => {
    let s = s0
    for (let i = 1; i <= 120; i++) s = historyReducer(s, { type: 'commit', next: i })
    expect(s.past).toHaveLength(100)
    expect(s.past[0]).toBe(20)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/quiz/__tests__/history.test.ts`
Expected: FAIL — cannot resolve `@/hooks/use-history`.

- [ ] **Step 3: Implement the hook**

`hooks/use-history.ts`:
```ts
'use client'

import { useCallback, useReducer } from 'react'

export type HistoryState<T> = { past: T[]; present: T; future: T[] }
export type HistoryAction<T> = { type: 'commit'; next: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; present: T }

const LIMIT = 100
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case 'commit': {
      if (same(action.next, state.present)) return state
      const past = [...state.past, state.present]
      return { past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past, present: action.next, future: [] }
    }
    case 'undo': {
      if (state.past.length === 0) return state
      const present = state.past[state.past.length - 1]
      return { past: state.past.slice(0, -1), present, future: [state.present, ...state.future] }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const [present, ...future] = state.future
      return { past: [...state.past, state.present], present, future }
    }
    case 'reset':
      return { past: [], present: action.present, future: [] }
  }
}

/** Undo/redo stack over snapshots. `undo`/`redo` return the snapshot to restore (or null at the ends). */
export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(historyReducer<T>, { past: [], present: initial, future: [] })
  const commit = useCallback((next: T) => dispatch({ type: 'commit', next }), [])
  const reset = useCallback((present: T) => dispatch({ type: 'reset', present }), [])
  const undo = useCallback((): T | null => {
    if (state.past.length === 0) return null
    dispatch({ type: 'undo' })
    return state.past[state.past.length - 1]
  }, [state.past])
  const redo = useCallback((): T | null => {
    if (state.future.length === 0) return null
    dispatch({ type: 'redo' })
    return state.future[0]
  }, [state.future])
  return { present: state.present, canUndo: state.past.length > 0, canRedo: state.future.length > 0, commit, undo, redo, reset }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/quiz/__tests__/history.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-history.ts lib/quiz/__tests__/history.test.ts
git commit -m "hooks: undo/redo history reducer for the piece builder"
```

---

### Task 3: Student input rewrite (`piece-placement-input.tsx`, `quiz.module.css`, locales)

**Files:**
- Modify: `locales/en.json`, `locales/es.json` (keys under `dashboard.classViewer.quiz.pieces`)
- Modify: `components/class-viewer/lesson-viewer/quiz/quiz.module.css` (piece-placement section + keyframes + reduced-motion list)
- Rewrite: `components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx`

**Interfaces:**
- Consumes: Task 1 (`centreOf`, `clampCentre`, `pieceHeightPct`, `resolveDrop`), `readComposition`/`readPieces` (unchanged call sites in `question-input.tsx`).
- Produces: same exports as today so `question-input.tsx`, `composition-canvas.tsx`, `builder-dialog.tsx` and `piece-placement-summary.tsx` keep compiling: `PiecePlacementInput` (same props: `background, pieces, placement, isGraded, onChange, maxHeight?`), `CompositionBackground`, `useMeasuredAspect`, `useStageAspect`.

- [ ] **Step 1: Add the locale keys (both files, additive only)**

Check first: `git status --short locales/` must be empty. Then run:
```bash
add_locale_keys() { node -e '
const fs = require("fs"); const [file, json] = process.argv.slice(1)
const data = JSON.parse(fs.readFileSync(file, "utf8")); const add = JSON.parse(json)
const target = data.dashboard.classViewer.quiz.pieces
for (const [k, v] of Object.entries(add)) if (!(k in target)) target[k] = v
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")' "$1" "$2"; }
add_locale_keys locales/en.json '{"pieceN":"Piece {n}","hintTap":"Drag each piece to where it belongs, or tap one and then tap the stage","tapWhere":"Tap where the {label} goes","selectedAria":"Selected: {label}. Tap the stage to place it.","placedAria":"{label}, placed. Arrow keys nudge it; Backspace returns it to the list.","revealHint":"Faded pieces show where each missing piece belongs. Hover a row in the list to highlight it."}'
add_locale_keys locales/es.json '{"pieceN":"Pieza {n}","hintTap":"Arrastra cada pieza a su lugar, o toca una y luego toca el escenario","tapWhere":"Toca donde va: {label}","selectedAria":"Seleccionada: {label}. Toca el escenario para colocarla.","placedAria":"{label}, colocada. Las flechas la mueven; Retroceso la devuelve a la lista.","revealHint":"Las piezas atenuadas muestran dónde va cada pieza que falta. Pasa el cursor por una fila de la lista para resaltarla."}'
git diff --numstat locales/
```
Expected: each file shows `6 0` (six added lines, zero deleted). If deletions appear, the file was not in `JSON.stringify` format: run `git checkout -- locales/en.json locales/es.json` (they were clean before this step) and insert the six keys by hand after `"wasPlaced"` inside the `"pieces"` object, then re-check the numstat.

- [ ] **Step 2: Replace the piece-placement section of `quiz.module.css`**

Replace everything from `/* ---------- piece placement ---------- */` up to (not including) `/* ---------- focus stage ---------- */` with:
```css
/* ---------- piece placement ---------- */
.pp { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.stageWrap { display: grid; justify-items: center; min-width: 0; }
.stage {
  position: relative;
  /* Height cap: the viewport minus the lesson chrome above the stage, never below 320px.
     The admin preview overrides --stage-maxh with a px value. */
  --stage-maxh-default: max(320px, calc(100dvh - 380px));
  width: min(100%, calc(var(--stage-maxh, var(--stage-maxh-default)) * var(--stage-ratio, 1.6)));
  aspect-ratio: var(--stage-ratio, 1.6);
  overflow: hidden;
  border-radius: 16px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.stageOver { box-shadow: inset 0 0 0 2px hsl(var(--gold-highlight)); }
.stageArmed { cursor: crosshair; }
.tray { display: grid; gap: 10px; min-width: 0; }
.trayList { display: grid; gap: 6px; min-width: 0; }
.tray > * { min-width: 0; max-width: 100%; }
/* pan-x: on the phone strip a horizontal swipe scrolls; a vertical move past the threshold lifts the piece. */
.trayItem { touch-action: pan-x; }
.trayLifted { opacity: 0.35; border-style: dashed; }
.trayDrop { border-color: hsl(var(--terracotta)); box-shadow: inset 0 0 0 1px hsl(var(--terracotta)); }
/* Tray on the left, stage on the right. Explicit grid placement so DOM order
   (stage first, tray second) does not matter. Breakpoint below the panel's
   inner width so the tray never collapses to a bottom strip on desktop. */
@container pp (min-width: 620px) {
  .pp { grid-template-columns: 220px minmax(0, 1fr); gap: 20px; align-items: start; }
  .tray { grid-column: 1; grid-row: 1; position: sticky; top: 20px; }
  .stageWrap { grid-column: 2; grid-row: 1; justify-items: start; }
}
@container pp (max-width: 619px) {
  .tray { order: -1; }
  .trayList { grid-auto-flow: column; grid-auto-columns: 150px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 6px; touch-action: pan-x; }
  .trayItem { scroll-snap-align: start; }
}
.piece { position: absolute; transform: translate(-50%, -50%); touch-action: none; }
.pieceSnap { transition: left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1); }
.pieceOk { animation: ppPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.pieceBad { animation: ppShake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97); }
.reveal { position: absolute; transform: translate(-50%, -50%); }
.revealTag { display: none; }
.reveal:hover .revealTag, .revealHi .revealTag { display: block; }
.reveal:hover, .revealHi { z-index: 40; }
.reveal:hover img, .revealHi img { opacity: 0.85; }
.ghost { position: fixed; left: 0; top: 0; z-index: 1000; pointer-events: none; transform-origin: center; will-change: transform; }
.ghostGrow { transition: scale 140ms ease-out; }

```
Then add these keyframes next to the existing ones (after `@keyframes level`):
```css
@keyframes ppPop { 40% { transform: translate(-50%, -50%) scale(1.06); } 100% { transform: translate(-50%, -50%) scale(1); } }
@keyframes ppShake {
  10%, 90% { transform: translate(calc(-50% - 2px), -50%); }
  20%, 80% { transform: translate(calc(-50% + 3px), -50%); }
  30%, 50%, 70% { transform: translate(calc(-50% - 4px), -50%); }
  40%, 60% { transform: translate(calc(-50% + 4px), -50%); }
}
```
and extend the reduced-motion rule to:
```css
@media (prefers-reduced-motion: reduce) {
  .rise, .pop, .okPulse, .bounceIn, .burstPiece, .levelBar, .pieceOk, .pieceBad { animation: none; }
  .pieceSnap, .ghostGrow { transition: none; }
}
```

- [ ] **Step 3: Rewrite `piece-placement-input.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { FALLBACK_ASPECT, type Background } from '@/lib/quiz/composition'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { centreOf, clampCentre, pieceHeightPct, resolveDrop, type Centre } from '@/lib/quiz/placement'
import styles from './quiz.module.css'

type Placement = Record<string, PiecePlacement> // pieceId -> centre in % of the stage

const DRAG_THRESHOLD_PX = 6
const KEY = 'dashboard.classViewer.quiz.pieces.'

function PieceImage({ piece, label, fit = false, className }: { piece: PlacementPiece; label: string; fit?: boolean; className?: string }) {
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={piece.imageUrl} alt={label} draggable={false} className={cn('pointer-events-none block select-none', fit ? 'h-full w-full object-contain' : 'h-auto w-full', className)} />
  ) : (
    <div className={cn('rounded-lg bg-muted', fit ? 'h-full w-full' : 'aspect-square w-full', className)} />
  )
}

/** Color fill plus positioned image layers. Shared with the admin canvas. */
export function CompositionBackground({ background }: { background: Background }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: background.color }} />
      {background.layers.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.id}
          src={l.imageUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%`, objectFit: 'fill' }}
        />
      ))}
    </>
  )
}

/**
 * Resolve the stage aspect: stored value, else the first layer's natural
 * ratio once it has loaded, else the fallback. `measured` is true only once
 * the aspect is actually known (stored, or the layer image loaded).
 */
export function useMeasuredAspect(background: Background): { aspect: number; measured: boolean } {
  const [loaded, setLoaded] = useState<number | null>(null)
  const first = background.layers[0]?.imageUrl
  useEffect(() => {
    if (background.aspect != null || !first) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) setLoaded(img.naturalWidth / img.naturalHeight)
    }
    img.onerror = () => {} // a broken image never counts as measured
    img.src = first
  }, [background.aspect, first])
  const measured = background.aspect != null || loaded != null
  return { aspect: background.aspect ?? loaded ?? FALLBACK_ASPECT, measured }
}

/** Thin wrapper over useMeasuredAspect for callers that only need the number. */
export function useStageAspect(background: Background): number {
  return useMeasuredAspect(background).aspect
}

/** Natural width/height of sprites that have no stored `ratio`, measured once per image URL. */
function useSpriteRatios(pieces: PlacementPiece[]): Record<string, number> {
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const key = pieces.map((p) => `${p.id}:${p.ratio ?? ''}:${p.imageUrl}`).join('|')
  useEffect(() => {
    let alive = true
    for (const p of pieces) {
      if (p.ratio || !p.imageUrl) continue
      const img = new Image()
      img.onload = () => {
        if (alive && img.naturalWidth > 0 && img.naturalHeight > 0) setRatios((r) => (r[p.id] ? r : { ...r, [p.id]: img.naturalWidth / img.naturalHeight }))
      }
      img.src = p.imageUrl
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return ratios
}

function useReducedMotionFlag(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type DragSession = {
  id: string
  fromTray: boolean
  pointerId: number
  /** grab offset: pointer minus piece centre, viewport px (0 for tray pickups) */
  dx: number
  dy: number
  pxW: number
  pxH: number
  sx: number
  sy: number
  x: number
  y: number
  live: boolean
}

type DragView = { id: string; fromTray: boolean; live: boolean; overStage: boolean; overTray: boolean }

/**
 * Students drag pieces from the tray onto the stage, or tap a piece and then
 * tap the stage. The stage keeps the composition's aspect ratio and is capped
 * by the viewport (--stage-maxh). Correct areas stay hidden until graded; a
 * piece is correct when its centre lands inside its area (isPieceCorrect).
 * After grading, correct pieces snap to their target, wrong ones shake, and
 * every missed piece is shown faded where it belongs.
 */
export function PiecePlacementInput({
  background,
  pieces,
  placement,
  isGraded,
  onChange,
  maxHeight,
}: {
  background: Background
  pieces: PlacementPiece[]
  placement: Placement
  isGraded: boolean
  onChange: (v: Placement) => void
  /** CSS length for the stage's max height (defaults to the viewport minus the lesson chrome; the admin preview passes px). */
  maxHeight?: string
}) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  const measured = useSpriteRatios(pieces)
  const reduced = useReducedMotionFlag()

  const ratioOf = (p: PlacementPiece) => p.ratio ?? measured[p.id] ?? 1
  const heightOf = (p: PlacementPiece) => pieceHeightPct(p.width, aspect, ratioOf(p))
  const labelOf = (p: PlacementPiece, i: number) => (p.label ?? '').trim() || t(KEY + 'pieceN', { n: i + 1 })
  const indexOf = useMemo(() => new Map(pieces.map((p, i) => [p.id, i])), [pieces])
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces])

  const [zOrder, setZOrder] = useState<Record<string, number>>({})
  const zRef = useRef(1)
  const lift = (id: string) => {
    zRef.current += 1
    setZOrder((z) => ({ ...z, [id]: zRef.current }))
  }
  const [armed, setArmed] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragView | null>(null)
  const session = useRef<DragSession | null>(null)
  const lastDropAt = useRef(0)

  // Latest props/derivations for the stable window listeners.
  const latest = useRef({ placement, isGraded, onChange, byId, heightOf })
  latest.current = { placement, isGraded, onChange, byId, heightOf }

  const paintGhost = () => {
    const s = session.current, el = ghostRef.current
    if (!s || !el) return
    el.style.transform = `translate(${s.x - s.dx - s.pxW / 2}px, ${s.y - s.dy - s.pxH / 2}px)`
  }

  const impl = useRef({
    move(e: PointerEvent) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      s.x = e.clientX
      s.y = e.clientY
      if (!s.live) {
        if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < DRAG_THRESHOLD_PX) return
        s.live = true
        setArmed(null)
      }
      const stage = stageRef.current?.getBoundingClientRect()
      const tray = trayRef.current?.getBoundingClientRect()
      const cx = s.x - s.dx, cy = s.y - s.dy
      const overStage = !!stage && cx >= stage.left && cx <= stage.right && cy >= stage.top && cy <= stage.bottom
      const overTray = !s.fromTray && !!tray && s.x >= tray.left && s.x <= tray.right && s.y >= tray.top && s.y <= tray.bottom
      setDrag((d) => (d && d.live && d.overStage === overStage && d.overTray === overTray ? d : { id: s.id, fromTray: s.fromTray, live: true, overStage, overTray }))
      paintGhost()
    },
    up(e: PointerEvent) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      window.removeEventListener('pointermove', stable.current.move)
      window.removeEventListener('pointerup', stable.current.up)
      window.removeEventListener('pointercancel', stable.current.up)
      session.current = null
      setDrag(null)
      const { placement, isGraded, onChange, byId, heightOf } = latest.current
      if (isGraded) return
      if (!s.live) {
        // A press without movement: arm a tray piece for tap-to-place, or bring a placed piece to the front.
        if (s.fromTray) setArmed((a) => (a === s.id ? null : s.id))
        else lift(s.id)
        return
      }
      if (e.type === 'pointercancel') return
      const stage = stageRef.current?.getBoundingClientRect()
      const piece = byId.get(s.id)
      if (!stage || !piece) return
      const centre = resolveDrop({ x: e.clientX, y: e.clientY }, { dx: s.dx, dy: s.dy }, stage)
      const next = { ...placement }
      if (centre) {
        next[s.id] = clampCentre(centre, piece.width, heightOf(piece))
        lift(s.id)
      } else {
        delete next[s.id] // released off the stage → back to the tray
      }
      lastDropAt.current = Date.now()
      onChange(next)
    },
  })
  impl.current.move = impl.current.move // keep the object identity; methods read refs at call time
  const stable = useRef({ move: (e: PointerEvent) => impl.current.move(e), up: (e: PointerEvent) => impl.current.up(e) })

  const startDrag = (e: React.PointerEvent, id: string, fromTray: boolean) => {
    if (isGraded || session.current || e.button !== 0 || !e.isPrimary) return
    const stage = stageRef.current?.getBoundingClientRect()
    const piece = byId.get(id)
    if (!stage || !piece) return
    e.preventDefault()
    const pxW = (stage.width * piece.width) / 100
    let dx = 0, dy = 0
    if (!fromTray) {
      const c = placement[id]
      if (c) {
        dx = e.clientX - (stage.left + (stage.width * c.x) / 100)
        dy = e.clientY - (stage.top + (stage.height * c.y) / 100)
      }
    }
    session.current = { id, fromTray, pointerId: e.pointerId, dx, dy, pxW, pxH: pxW / ratioOf(piece), sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, live: false }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // capture is best-effort; the window listeners still see the pointer
    }
    window.addEventListener('pointermove', stable.current.move)
    window.addEventListener('pointerup', stable.current.up)
    window.addEventListener('pointercancel', stable.current.up)
  }

  // Position the ghost as soon as it mounts, and grow it from the tray thumbnail.
  useEffect(() => {
    if (!drag?.live) return
    paintGhost()
    const el = ghostRef.current
    if (el && drag.fromTray && !reduced) {
      void el.offsetWidth
      el.style.scale = '1'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.live])

  useEffect(() => () => {
    window.removeEventListener('pointermove', stable.current.move)
    window.removeEventListener('pointerup', stable.current.up)
    window.removeEventListener('pointercancel', stable.current.up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const placeAt = (id: string, centre: Centre) => {
    const piece = byId.get(id)
    if (!piece || isGraded) return
    onChange({ ...placement, [id]: clampCentre(centre, piece.width, heightOf(piece)) })
    lift(id)
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (!armed || isGraded || Date.now() - lastDropAt.current < 200) return
    if ((e.target as HTMLElement).closest('[data-piece]')) return
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return
    const id = armed
    setArmed(null)
    placeAt(id, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus())
  }

  const onStageKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && armed && !isGraded) {
      e.preventDefault()
      const id = armed
      setArmed(null)
      placeAt(id, { x: 50, y: 50 })
      requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus())
    } else if (e.key === 'Escape') setArmed(null)
  }

  const onPieceKey = (e: React.KeyboardEvent, id: string) => {
    if (isGraded) return
    const c = placement[id]
    if (!c) return
    const step = e.shiftKey ? 5 : 1
    let next: Centre | null = null
    if (e.key === 'ArrowLeft') next = { x: c.x - step, y: c.y }
    else if (e.key === 'ArrowRight') next = { x: c.x + step, y: c.y }
    else if (e.key === 'ArrowUp') next = { x: c.x, y: c.y - step }
    else if (e.key === 'ArrowDown') next = { x: c.x, y: c.y + step }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      const rest = { ...placement }
      delete rest[id]
      onChange(rest)
      requestAnimationFrame(() => trayRef.current?.querySelector<HTMLElement>(`[data-piece-id="${id}"]`)?.focus())
      return
    }
    if (!next) return
    e.preventDefault()
    placeAt(id, next)
  }

  const placedCount = pieces.filter((p) => placement[p.id]).length
  const unplaced = pieces.filter((p) => !placement[p.id])
  const correct = (p: PlacementPiece) => isGraded && isPieceCorrect(p, placement[p.id])
  const dragPiece = drag ? byId.get(drag.id) : undefined
  const stageStyle = { ['--stage-ratio' as string]: aspect, ...(maxHeight ? { ['--stage-maxh' as string]: maxHeight } : {}) }

  return (
    <div className={styles.ppRoot}>
      <div className={styles.pp}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            tabIndex={0}
            role="group"
            aria-label={t('dashboard.classViewer.quiz.puzzleBackground')}
            onClick={onStageClick}
            onKeyDown={onStageKey}
            className={cn(styles.stage, 'border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold', drag?.live && drag.overStage && styles.stageOver, armed && !isGraded && styles.stageArmed)}
            style={stageStyle}
          >
            <CompositionBackground background={background} />

            {!isGraded && !drag?.live && (placedCount === 0 || armed) && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[45] flex justify-center px-3">
                <span className="max-w-full truncate rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  {armed ? t(KEY + 'tapWhere', { label: labelOf(byId.get(armed)!, indexOf.get(armed) ?? 0) }) : t(KEY + 'hintTap')}
                </span>
              </div>
            )}

            {/* Faded reveal of every missed or unplaced piece at its target, after grading. */}
            {isGraded &&
              pieces.map((p, i) => {
                if (isPieceCorrect(p, placement[p.id])) return null
                const c = centreOf(p.area)
                const label = labelOf(p, i)
                return (
                  <div
                    key={`reveal-${p.id}`}
                    data-reveal={p.id}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%`, zIndex: 5 }}
                    className={cn(styles.reveal, hover === p.id && styles.revealHi)}
                  >
                    <div className="rounded-lg border-2 border-dashed border-success p-0.5">
                      <PieceImage piece={p} label="" className="opacity-40 transition-opacity" />
                    </div>
                    <span className={cn(styles.revealTag, 'absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white')}>{label}</span>
                  </div>
                )
              })}

            {/* Placed pieces, last-touched on top. After grading, correct ones sit on their exact target. */}
            {pieces
              .filter((p) => placement[p.id])
              .sort((a, b) => (zOrder[a.id] ?? 0) - (zOrder[b.id] ?? 0))
              .map((p) => {
                const ok = correct(p)
                const pos = ok ? centreOf(p.area) : placement[p.id]
                const label = labelOf(p, indexOf.get(p.id) ?? 0)
                const lifting = drag?.live && drag.id === p.id
                return (
                  <div
                    key={p.id}
                    data-piece={p.id}
                    role="button"
                    tabIndex={isGraded ? -1 : 0}
                    aria-label={t(KEY + 'placedAria', { label })}
                    title={label}
                    onPointerDown={(e) => startDrag(e, p.id, false)}
                    onKeyDown={(e) => onPieceKey(e, p.id)}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${p.width}%`, zIndex: 10 + (zOrder[p.id] ?? 0) }}
                    className={cn(
                      styles.piece,
                      'drop-shadow-lg focus-visible:outline-none',
                      !isGraded && 'cursor-grab active:cursor-grabbing',
                      lifting && 'invisible',
                      isGraded && styles.pieceSnap,
                      isGraded && (ok ? styles.pieceOk : styles.pieceBad),
                    )}
                  >
                    <div className={cn('rounded-lg', isGraded && (ok ? 'ring-[2.5px] ring-success ring-offset-[3px] ring-offset-card' : 'ring-[2.5px] ring-terracotta ring-offset-[3px] ring-offset-card'), !isGraded && 'focus-visible:ring-2')}>
                      <PieceImage piece={p} label={label} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <aside ref={trayRef} className={styles.tray}>
          <div className={cn('rounded-2xl border border-border bg-card p-3 transition-colors', drag?.live && drag.overTray && styles.trayDrop)}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{t(KEY + 'title')}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{t(KEY + 'placedOf', { placed: placedCount, total: pieces.length })}</span>
            </div>
            <div className={styles.trayList}>
              {unplaced.map((p) => {
                const i = indexOf.get(p.id) ?? 0
                const label = labelOf(p, i)
                const lifted = drag?.live && drag.id === p.id && drag.fromTray
                const isArmed = armed === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-piece-id={p.id}
                    aria-pressed={isArmed}
                    aria-label={isArmed ? t(KEY + 'selectedAria', { label }) : label}
                    onPointerDown={(e) => startDrag(e, p.id, true)}
                    onClick={(e) => {
                      if (e.detail === 0 && !isGraded) setArmed((a) => (a === p.id ? null : p.id))
                    }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover((h) => (h === p.id ? null : h))}
                    className={cn(
                      styles.trayItem,
                      'grid h-[46px] w-full grid-cols-[40px_1fr] items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-raised px-1.5 text-left select-none transition-[transform,border-color,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      !isGraded && 'cursor-grab hover:-translate-y-px hover:border-foreground/20 active:cursor-grabbing',
                      lifted && styles.trayLifted,
                      isArmed && 'border-gold shadow-[0_0_0_3px_hsl(var(--gold-highlight)/0.25)]',
                      isGraded && 'border-terracotta',
                    )}
                  >
                    <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-lg bg-sunken p-1">
                      <PieceImage piece={p} label="" fit />
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-semibold leading-tight">
                      {label}
                      {isGraded && <small className="block text-[11px] font-medium text-muted-foreground">{t(KEY + 'notPlaced')}</small>}
                    </span>
                  </button>
                )
              })}
              {unplaced.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {isGraded ? t(KEY + 'wasPlaced') : t(KEY + 'allPlaced')}
                </div>
              )}
            </div>
            {isGraded && pieces.some((p) => !isPieceCorrect(p, placement[p.id])) && (
              <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">{t(KEY + 'revealHint')}</p>
            )}
          </div>
        </aside>
      </div>

      {/* Drag ghost: portaled to <body> so no transformed ancestor can offset it. */}
      {drag?.live && dragPiece && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={ghostRef}
            aria-hidden
            className={cn(styles.ghost, 'opacity-95 drop-shadow-2xl', !reduced && styles.ghostGrow)}
            style={{ width: session.current?.pxW, scale: drag.fromTray && !reduced ? '0.4' : '1' }}
          >
            <PieceImage piece={dragPiece} label="" />
          </div>,
          document.body,
        )}
    </div>
  )
}
```

Notes for the implementer:
- The `impl`/`stable` pair exists so the window listeners added at drag start are the same function identities removed at drag end, while their bodies read the latest props through `latest.current`. Remove the no-op line `impl.current.move = impl.current.move` if lint complains about self-assignment; the pattern works without it because `impl.current` is created once and its methods only read refs.
- `ring-offset-card` needs `card` in the Tailwind colours (it is: `hsl(var(--card))`).
- The pop/shake keyframes include the base `translate(-50%, -50%)` so the piece does not jump while animating.

- [ ] **Step 4: Typecheck, lint, unit tests**

Run: `npx tsc --noEmit && npm run lint -- --quiet && npx vitest run lib/quiz hooks`
Expected: clean. If `scale` is rejected in the style object, cast: `style={{ width: …, scale: … } as React.CSSProperties}`.

- [ ] **Step 5: Verify in Chrome (student URL, logged in)**

Open the quiz part "Partes de los timbales" and check, each in turn:
1. Drag "Bracket" from the tray onto the stand: the ghost is under the cursor the whole way, it grows from the thumbnail size, the tray row dims but does not move, the stage shows a gold inset ring while over it, the piece lands under the cursor.
2. Drag the placed piece by its corner: it does not jump to the cursor; drop it outside the stage: it returns to the tray; the tray card shows a terracotta ring while over it.
3. Tap a tray row without moving: it gets a gold ring and the hint reads "Toca donde va: …"; tap the stage: the piece lands there.
4. Tab to a tray row, Enter, Tab to the stage, Enter: the piece lands at the centre; arrows nudge it; Backspace returns it.
5. Place the cymbal correctly (over the stand top) and two pieces wrongly, press "Comprobar respuesta": the cymbal glides to its target with a green ring, the wrong ones shake with a terracotta ring, faded pieces appear where the missed ones belong, hovering a tray row highlights its faded piece and shows its name.
6. Window 1728 × 996: the whole stage plus the Check button fit above the fixed footer without scrolling (the stage is capped at `100dvh - 380px`).
7. Console: no errors.

- [ ] **Step 6: Commit**

```bash
git status --short
git add locales/en.json locales/es.json components/class-viewer/lesson-viewer/quiz/quiz.module.css components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx
git commit -m "quiz: piece placement rewrite — portal ghost, grab offset, tap/keyboard placement, snap-and-ring grading, faded reveal, viewport cap"
```
(This commit absorbs the two uncommitted one-line edits another session left in these two files: the stage cap and the left-aligned stage.)

---

### Task 4: Pure image trimming math and the natural-ratio resize lock

**Files:**
- Create: `lib/quiz/image-trim.ts`
- Modify: `lib/quiz/transform.ts` (`resizeRect` gains `boxRatio?`)
- Test: `lib/quiz/__tests__/image-trim.test.ts`, `lib/quiz/__tests__/transform.test.ts`

**Interfaces:**
- Produces (used by Tasks 5, 6):
  ```ts
  export const ALPHA_THRESHOLD = 8, TRIM_PAD = 4, MAX_SIDE = 1024
  export type PixelBox = { x: number; y: number; width: number; height: number }
  export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold?: number, pad?: number): PixelBox | null
  export function boxToPercent(box: PixelBox, width: number, height: number): Box   // Box from placement.ts
  export function scaleToFit(width: number, height: number, maxSide?: number): { width: number; height: number; scale: number }
  // transform.ts
  export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, step: number | null, keepRatio: boolean, boxRatio?: number): Rect
  ```
  `boxRatio` is width/height in **percent units** (natural ratio ÷ stage aspect); when given and `keepRatio` is on, corners set `height = width / boxRatio`.

- [ ] **Step 1: Write the failing tests**

`lib/quiz/__tests__/image-trim.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { alphaBounds, boxToPercent, scaleToFit } from '../image-trim'

/** 4×4 RGBA image with opaque pixels at (1,1),(2,1),(1,2),(2,2). */
function square4() {
  const d = new Uint8ClampedArray(4 * 4 * 4)
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) d[(y * 4 + x) * 4 + 3] = 255
  return d
}

describe('alphaBounds', () => {
  it('finds the opaque box and pads it within the image', () => {
    expect(alphaBounds(square4(), 4, 4, 8, 0)).toEqual({ x: 1, y: 1, width: 2, height: 2 })
    expect(alphaBounds(square4(), 4, 4, 8, 4)).toEqual({ x: 0, y: 0, width: 4, height: 4 })
  })
  it('ignores pixels at or below the threshold and returns null when nothing is opaque', () => {
    const d = square4()
    d[(1 * 4 + 1) * 4 + 3] = 8
    expect(alphaBounds(d, 4, 4, 8, 0)).toEqual({ x: 1, y: 1, width: 2, height: 2 })
    expect(alphaBounds(new Uint8ClampedArray(64), 4, 4)).toBeNull()
  })
})

describe('boxToPercent', () => {
  it('converts pixels to percent of the file', () => {
    expect(boxToPercent({ x: 10, y: 20, width: 30, height: 40 }, 100, 200)).toEqual({ x: 10, y: 10, width: 30, height: 20 })
  })
})

describe('scaleToFit', () => {
  it('shrinks the long side to the cap and never upscales', () => {
    expect(scaleToFit(2000, 1000, 1024)).toEqual({ width: 1024, height: 512, scale: 0.512 })
    expect(scaleToFit(300, 900, 1024)).toEqual({ width: 300, height: 900, scale: 1 })
  })
})
```
Append to `lib/quiz/__tests__/transform.test.ts` inside `describe('resizeRect')`:
```ts
  it('locks corners to an explicit box ratio when one is given', () => {
    expect(resizeRect(start, 'se', 10, 0, null, true, 3)).toEqual({ x: 40, y: 40, width: 30, height: 10 })
    expect(resizeRect(start, 'e', 10, 0, null, true, 3)).toEqual({ x: 40, y: 40, width: 30, height: 10 })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/quiz/__tests__/image-trim.test.ts lib/quiz/__tests__/transform.test.ts` → FAIL (module missing; ratio case returns height 15).

- [ ] **Step 3: Implement**

`lib/quiz/image-trim.ts`:
```ts
import type { Box } from './placement'

/** Pure pixel math for trimming transparent margins off piece images. Browser I/O lives in the admin builder. */
export const ALPHA_THRESHOLD = 8
export const TRIM_PAD = 4
export const MAX_SIDE = 1024

export type PixelBox = { x: number; y: number; width: number; height: number }

/** Bounding box of pixels whose alpha exceeds `threshold`, padded by `pad` px and clamped to the image. Null when fully transparent. */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold = ALPHA_THRESHOLD, pad = TRIM_PAD): PixelBox | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad)
  return { x: left, y: top, width: Math.min(width, x1 + 1 + pad) - left, height: Math.min(height, y1 + 1 + pad) - top }
}

export function boxToPercent(box: PixelBox, width: number, height: number): Box {
  return { x: (box.x / width) * 100, y: (box.y / height) * 100, width: (box.width / width) * 100, height: (box.height / height) * 100 }
}

export function scaleToFit(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}
```
`lib/quiz/transform.ts`: change the signature and the ratio line:
```ts
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, step: number | null, keepRatio: boolean, boxRatio?: number): Rect {
  …
  width = Math.max(MIN_SIZE, snap(width, step))
  if (keepRatio && handle.length === 2) height = boxRatio && boxRatio > 0 ? width / boxRatio : (width * start.height) / start.width
  …
```
and update the doc comment: "With keepRatio on a corner, height follows width at `boxRatio` (width/height in percent units) when given, else at the start ratio."

- [ ] **Step 4: Run the tests** — `npx vitest run lib/quiz` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quiz/image-trim.ts lib/quiz/transform.ts lib/quiz/__tests__/image-trim.test.ts lib/quiz/__tests__/transform.test.ts
git commit -m "quiz: alpha-bounds trimming math and a natural-ratio corner lock"
```

---

### Task 5: Browser import pipeline (`builder-import.ts`)

**Files:**
- Create: `components/admin/piece-placement/builder-import.ts`

**Interfaces:**
- Consumes: Task 4 (`alphaBounds`, `boxToPercent`, `scaleToFit`), Task 1 (`frameToStage`, `placePiece`, `centreOf`, `pieceHeightPct`, `effectiveRatio`), `createClient` from `@/lib/supabase/client`.
- Produces (used by Task 9):
  ```ts
  export type Natural = { width: number; height: number }
  export type Trimmed = { blob: Blob; ext: 'webp' | 'png'; ratio: number; frame: Box; natural: Natural; trimmed: boolean }
  export function fileNameToLabel(name: string): string
  export function measureNatural(url: string): Promise<Natural | null>
  export function fetchBlob(url: string): Promise<Blob>
  export function trimImage(source: Blob): Promise<Trimmed>
  export function uploadImageBlob(name: string, blob: Blob): Promise<string>   // public URL
  export function sameSize(a: Natural | null | undefined, b: Natural | null | undefined): boolean   // ±1 px
  export type ImportedPiece = { id: string; label: string; imageUrl: string; ratio: number; aligned: { centre: Centre; width: number } | null }
  export function importPieceFiles(files: File[], ctx: { questionId: string; base: { rect: Box; natural: Natural } | null; onProgress?: (done: number, total: number) => void }): Promise<ImportedPiece[]>
  export function importLayerFiles(files: File[], ctx: { questionId: string; aspect: number; onProgress?: (done: number, total: number) => void }): Promise<BackgroundLayer[]>
  export function fixImages(input: { questionId: string; background: Background; pieces: PlacementPiece[]; aspect: number; tolerance: number; onProgress?: (done: number, total: number) => void }): Promise<{ background: Background; pieces: PlacementPiece[] }>
  ```
  No unit tests (browser-only: canvas, fetch, storage); `fileNameToLabel` and `sameSize` are covered by Task 9's manual checks. Keep every DOM/canvas call inside the functions (nothing at module top level).

- [ ] **Step 1: Implement**

```ts
'use client'

import { createClient } from '@/lib/supabase/client'
import type { Background, BackgroundLayer } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { alphaBounds, boxToPercent, scaleToFit } from '@/lib/quiz/image-trim'
import { centreOf, effectiveRatio, frameToStage, placePiece, type Box, type Centre } from '@/lib/quiz/placement'

export type Natural = { width: number; height: number }
export type Trimmed = { blob: Blob; ext: 'webp' | 'png'; ratio: number; frame: Box; natural: Natural; trimmed: boolean }
export type ImportedPiece = { id: string; label: string; imageUrl: string; ratio: number; aligned: { centre: Centre; width: number } | null }

const BUCKET = 'quiz-media'
const NEW_PIECE_WIDTH = 20

/** "timbal_bell-2.png" → "Timbal bell 2" */
export function fileNameToLabel(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base ? base[0].toUpperCase() + base.slice(1) : ''
}

export function sameSize(a: Natural | null | undefined, b: Natural | null | undefined): boolean {
  return !!a && !!b && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1
}

export function measureNatural(url: string): Promise<Natural | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.blob()
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.type === type ? b : null), type, quality))
}

/** Crop to the opaque bounds, downscale to MAX_SIDE, encode WebP (PNG when the browser cannot). */
export async function trimImage(source: Blob): Promise<Trimmed> {
  const bmp = await createImageBitmap(source)
  const W = bmp.width, H = bmp.height
  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const sctx = src.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('Canvas is not available')
  sctx.drawImage(bmp, 0, 0)
  const box = alphaBounds(sctx.getImageData(0, 0, W, H).data, W, H) ?? { x: 0, y: 0, width: W, height: H }
  const fit = scaleToFit(box.width, box.height)
  const out = document.createElement('canvas')
  out.width = fit.width
  out.height = fit.height
  out.getContext('2d')!.drawImage(bmp, box.x, box.y, box.width, box.height, 0, 0, fit.width, fit.height)
  bmp.close()
  const webp = await toBlob(out, 'image/webp', 0.85)
  const blob = webp ?? (await toBlob(out, 'image/png', 1))
  if (!blob) throw new Error('Could not encode the image')
  return { blob, ext: webp ? 'webp' : 'png', ratio: box.width / box.height, frame: boxToPercent(box, W, H), natural: { width: W, height: H }, trimmed: box.width < W || box.height < H }
}

export async function uploadImageBlob(name: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: blob.type, cacheControl: '3600', upsert: true })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
}

/** Trim + upload each file; files with the base image's pixel size are placed from their frame position. */
export async function importPieceFiles(
  files: File[],
  ctx: { questionId: string; base: { rect: Box; natural: Natural } | null; onProgress?: (done: number, total: number) => void },
): Promise<ImportedPiece[]> {
  const out: ImportedPiece[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const id = crypto.randomUUID()
    const t = await trimImage(file)
    const imageUrl = await uploadImageBlob(`${ctx.questionId}-piece-${id}-${Date.now()}.${t.ext}`, t.blob)
    const aligned = ctx.base && sameSize(t.natural, ctx.base.natural) ? frameToStage(t.frame, ctx.base.rect) : null
    out.push({ id, label: fileNameToLabel(file.name), imageUrl, ratio: t.ratio, aligned })
    ctx.onProgress?.(i + 1, files.length)
  }
  return out
}

/** New layers land centred at 30% width with their natural ratio. */
export async function importLayerFiles(files: File[], ctx: { questionId: string; aspect: number; onProgress?: (done: number, total: number) => void }): Promise<BackgroundLayer[]> {
  const out: BackgroundLayer[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const id = crypto.randomUUID()
    const t = await trimImage(file)
    const imageUrl = await uploadImageBlob(`${ctx.questionId}-layer-${id}-${Date.now()}.${t.ext}`, t.blob)
    const width = 30
    const height = Math.min(100, (width * ctx.aspect) / t.ratio)
    out.push({ id, imageUrl, name: fileNameToLabel(file.name), ratio: t.ratio, x: 50 - width / 2, y: Math.max(0, 50 - height / 2), width, height })
    ctx.onProgress?.(i + 1, files.length)
  }
  return out
}

/**
 * Re-process every stored image: trim, downscale, upload, and rewrite geometry.
 * The first layer is the base frame. Its corrected full-file rect (height refit
 * from the full file's ratio, centre kept) is what aligned pieces are mapped
 * through; the layer itself is then replaced by its trimmed sub-rect. Pieces
 * whose file size matches the base are re-placed from their frame; others keep
 * their centre and only gain a ratio (and a correct height).
 */
export async function fixImages(input: {
  questionId: string
  background: Background
  pieces: PlacementPiece[]
  aspect: number
  tolerance: number
  onProgress?: (done: number, total: number) => void
}): Promise<{ background: Background; pieces: PlacementPiece[] }> {
  const { questionId, background, pieces, aspect, tolerance, onProgress } = input
  const total = background.layers.length + pieces.length
  let done = 0
  const layers: BackgroundLayer[] = []
  let baseFull: { rect: Box; natural: Natural } | null = null
  for (const l of background.layers) {
    const t = await trimImage(await fetchBlob(l.imageUrl))
    const imageUrl = await uploadImageBlob(`${questionId}-layer-${l.id}-${Date.now()}.${t.ext}`, t.blob)
    // corrected rect for the full file: keep width and centre, height from the full file's ratio
    const fullRatio = t.natural.width / t.natural.height
    const fullH = (l.width * aspect) / fullRatio
    const full: Box = { x: l.x, y: l.y + l.height / 2 - fullH / 2, width: l.width, height: fullH }
    if (!baseFull) baseFull = { rect: full, natural: t.natural }
    // the trimmed image occupies its frame box inside the corrected full rect
    const rect: Box = { x: full.x + (full.width * t.frame.x) / 100, y: full.y + (full.height * t.frame.y) / 100, width: (full.width * t.frame.width) / 100, height: (full.height * t.frame.height) / 100 }
    layers.push({ ...l, imageUrl, ratio: t.ratio, name: l.name ?? fileNameToLabel(l.imageUrl.split('/').pop() ?? ''), ...rect })
    onProgress?.(++done, total)
  }
  const next: PlacementPiece[] = []
  for (const p of pieces) {
    if (!p.imageUrl) {
      next.push(p)
      onProgress?.(++done, total)
      continue
    }
    const t = await trimImage(await fetchBlob(p.imageUrl))
    const imageUrl = await uploadImageBlob(`${questionId}-piece-${p.id}-${Date.now()}.${t.ext}`, t.blob)
    const withRatio = { ...p, imageUrl, ratio: t.ratio }
    if (baseFull && sameSize(t.natural, baseFull.natural)) {
      const m = frameToStage(t.frame, baseFull.rect)
      next.push(placePiece(withRatio, m.centre, m.width, aspect, tolerance))
    } else {
      // keep the centre; the sprite's on-screen width shrinks to the visible part of the old file
      const width = (p.width * t.frame.width) / 100
      next.push(placePiece(withRatio, centreOf(p.area), width, aspect, tolerance))
    }
    onProgress?.(++done, total)
  }
  void effectiveRatio
  return { background: { ...background, layers }, pieces: next }
}
```
Remove the `void effectiveRatio` line and the unused import if lint flags it (it is only there to keep the import list explicit for the reader).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint -- --quiet` → clean.

- [ ] **Step 3: Commit**

```bash
git add components/admin/piece-placement/builder-import.ts
git commit -m "admin: trim-and-upload pipeline for piece images with aligned-set placement and Fix images"
```

---

### Task 6: Compose-the-answer canvas (`composition-canvas.tsx`, `use-canvas-transform.ts`)

**Files:**
- Modify: `components/admin/piece-placement/use-canvas-transform.ts`
- Rewrite: `components/admin/piece-placement/composition-canvas.tsx`

**Interfaces:**
- Consumes: Task 1 (`centreOf`, `pieceHeightPct`, `effectiveRatio`, `PieceWarning`), Task 4 (`resizeRect` with `boxRatio`), `Handles` (unchanged).
- Produces (used by Task 9):
  ```ts
  // use-canvas-transform.ts
  export type TransformSpec =
    | { mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; boxRatio?: number; onChange: (r: Rect) => void }
    | { mode: 'centre'; centre: Centre; onChange: (c: Centre) => void }
    | { mode: 'size'; width: number; onChange: (w: number) => void }
  export function useCanvasTransform(canvasRef, opts: { snap: boolean; onEnd?: (moved: boolean) => void })
  // composition-canvas.tsx
  export type Selection = { kind: 'layer' | 'piece'; id: string } | null
  export function CompositionCanvas(props: {
    background: Background; pieces: PlacementPiece[]; aspect: number; tolerance: number; ratios: Record<string, number>
    selection: Selection; onSelect: (s: Selection) => void
    onLayerRect: (id: string, rect: Rect) => void
    onPieceCentre: (id: string, centre: Centre) => void
    onPieceWidth: (id: string, width: number) => void
    onRemovePiece: (id: string) => void
    onGestureEnd: () => void
    snap: boolean; showGrid: boolean; showHalos: boolean; zoom: 1 | 2
    warnings: Record<string, PieceWarning[]>
    labels: (piece: PlacementPiece, index: number) => string
  })
  ```

- [ ] **Step 1: Extend `use-canvas-transform.ts`**

Replace the file with:
```ts
'use client'

import { useCallback, useRef } from 'react'
import type { Centre } from '@/lib/quiz/placement'
import { SNAP_STEP, clampPieceWidth, moveRect, resizeRect, snap as snapTo, type Handle, type Rect } from '@/lib/quiz/transform'

export type TransformSpec =
  | { mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; boxRatio?: number; onChange: (r: Rect) => void }
  | { mode: 'centre'; centre: Centre; onChange: (c: Centre) => void }
  | { mode: 'size'; width: number; onChange: (w: number) => void }

interface Session {
  spec: TransformSpec
  startX: number
  startY: number
  canvasW: number
  canvasH: number
  moved: boolean
}

/**
 * Pointer-capture drag sessions in canvas-percent space. Call `begin` from a
 * pointerdown on a box, sprite or handle; spread `handlers` on the canvas root
 * (the captured events bubble there). `onEnd(moved)` fires once per session.
 */
export function useCanvasTransform(canvasRef: React.RefObject<HTMLElement | null>, opts: { snap: boolean; onEnd?: (moved: boolean) => void }) {
  const session = useRef<Session | null>(null)
  const lastMoved = useRef(false)
  const step = opts.snap ? SNAP_STEP : null
  const onEnd = useRef(opts.onEnd)
  onEnd.current = opts.onEnd

  const begin = useCallback(
    (e: React.PointerEvent, spec: TransformSpec) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // best-effort; the captured target stays mounted
      }
      const r = canvas.getBoundingClientRect()
      session.current = { spec, startX: e.clientX, startY: e.clientY, canvasW: r.width, canvasH: r.height, moved: false }
    },
    [canvasRef],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = session.current
      if (!s) return
      const dxPx = e.clientX - s.startX
      const dyPx = e.clientY - s.startY
      if (Math.abs(dxPx) + Math.abs(dyPx) > 3) s.moved = true
      if (!s.moved) return
      const dx = (dxPx / s.canvasW) * 100
      const dy = (dyPx / s.canvasH) * 100
      const { spec } = s
      if (spec.mode === 'move') spec.onChange(moveRect(spec.rect, dx, dy, step))
      else if (spec.mode === 'resize') spec.onChange(resizeRect(spec.rect, spec.handle ?? 'se', dx, dy, step, !!spec.keepRatio, spec.boxRatio))
      else if (spec.mode === 'centre') spec.onChange({ x: snapTo(spec.centre.x + dx, step), y: snapTo(spec.centre.y + dy, step) })
      else if (spec.mode === 'size') spec.onChange(clampPieceWidth(spec.width + dx))
    },
    [step],
  )

  const end = useCallback(() => {
    if (!session.current) return
    lastMoved.current = session.current.moved
    const moved = session.current.moved
    session.current = null
    onEnd.current?.(moved)
  }, [])

  const consumeClick = useCallback(() => {
    const moved = lastMoved.current
    lastMoved.current = false
    return moved
  }, [])

  return { begin, handlers: { onPointerMove, onPointerUp: end, onPointerCancel: end }, consumeClick }
}
```

- [ ] **Step 2: Rewrite `composition-canvas.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { centreOf, effectiveRatio, pieceHeightPct, type Centre, type PieceWarning } from '@/lib/quiz/placement'
import type { Rect } from '@/lib/quiz/transform'
import { Handles } from './handles'
import { useCanvasTransform } from './use-canvas-transform'

export type Selection = { kind: 'layer' | 'piece'; id: string } | null

/**
 * The composed answer: colour, image layers, and every piece drawn where it
 * belongs at the size the student sees. Dragging a sprite moves its target;
 * the gold dot changes its width; the dashed halo is the grading tolerance.
 * The canvas fills its container's height (container-type: size on the wrap).
 */
export function CompositionCanvas({
  background,
  pieces,
  aspect,
  tolerance,
  ratios,
  selection,
  onSelect,
  onLayerRect,
  onPieceCentre,
  onPieceWidth,
  onRemovePiece,
  onGestureEnd,
  snap,
  showGrid,
  showHalos,
  zoom,
  warnings,
  labels,
}: {
  background: Background
  pieces: PlacementPiece[]
  aspect: number
  tolerance: number
  ratios: Record<string, number>
  selection: Selection
  onSelect: (s: Selection) => void
  onLayerRect: (id: string, rect: Rect) => void
  onPieceCentre: (id: string, centre: Centre) => void
  onPieceWidth: (id: string, width: number) => void
  onRemovePiece: (id: string) => void
  onGestureEnd: () => void
  snap: boolean
  showGrid: boolean
  showHalos: boolean
  zoom: 1 | 2
  warnings: Record<string, PieceWarning[]>
  labels: (piece: PlacementPiece, index: number) => string
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const tf = useCanvasTransform(canvasRef, { snap, onEnd: (moved) => moved && onGestureEnd() })

  const ratioOf = (p: PlacementPiece) => p.ratio ?? ratios[p.id] ?? effectiveRatio(p, aspect, tolerance)
  const focusPiece = (id: string) => canvasRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus()

  const onPieceKey = (e: React.KeyboardEvent, p: PlacementPiece) => {
    const c = centreOf(p.area)
    const step = e.shiftKey ? 1 : 0.1
    let next: Centre | null = null
    if (e.key === 'ArrowLeft') next = { x: c.x - step, y: c.y }
    else if (e.key === 'ArrowRight') next = { x: c.x + step, y: c.y }
    else if (e.key === 'ArrowUp') next = { x: c.x, y: c.y - step }
    else if (e.key === 'ArrowDown') next = { x: c.x, y: c.y + step }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onRemovePiece(p.id)
      return
    } else if (e.key === 'Escape') {
      onSelect(null)
      return
    }
    if (!next) return
    e.preventDefault()
    onPieceCentre(p.id, { x: Math.round(next.x * 10) / 10, y: Math.round(next.y * 10) / 10 })
    onGestureEnd()
    requestAnimationFrame(() => focusPiece(p.id))
  }

  const fit = `min(100cqw - 48px, calc((100cqh - 48px) * ${aspect}))`
  return (
    <div className="grid h-full min-h-[360px] place-items-center overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.1)_1px,transparent_1px)] bg-[length:16px_16px] p-6 [container-type:size]">
      <div
        ref={canvasRef}
        onClick={(e) => {
          if (tf.consumeClick()) return
          if (e.target === e.currentTarget) onSelect(null)
        }}
        {...tf.handlers}
        className="relative touch-none select-none rounded-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--foreground)/0.15)] [container-type:inline-size]"
        style={{ width: zoom === 2 ? `calc(2 * ${fit})` : fit, aspectRatio: aspect, background: background.color }}
      >
        {background.layers.map((l) => {
          const on = selection?.kind === 'layer' && selection.id === l.id
          const rect: Rect = { x: l.x, y: l.y, width: l.width, height: l.height }
          return (
            <div
              key={l.id}
              className={cn('absolute cursor-move', on && 'ring-[1.5px] ring-primary')}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%` }}
              onPointerDown={(e) => {
                onSelect({ kind: 'layer', id: l.id })
                tf.begin(e, { mode: 'move', rect, onChange: (r) => onLayerRect(l.id, r) })
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              {on && (
                <Handles
                  tone="neutral"
                  onDown={(e, h) => tf.begin(e, { mode: 'resize', rect, handle: h, keepRatio: true, boxRatio: l.ratio ? l.ratio / aspect : undefined, onChange: (r) => onLayerRect(l.id, r) })}
                />
              )}
            </div>
          )
        })}

        {showGrid && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%), repeating-linear-gradient(90deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%)',
            }}
          />
        )}

        {pieces.map((p, i) => {
          const on = selection?.kind === 'piece' && selection.id === p.id
          const c = centreOf(p.area)
          const t = p.tolerance ?? tolerance
          const warn = (warnings[p.id]?.length ?? 0) > 0
          const label = labels(p, i)
          const h = pieceHeightPct(p.width, aspect, ratioOf(p))
          return (
            <div
              key={p.id}
              data-piece={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${label}: drag to move, arrows nudge, Backspace removes`}
              className={cn('group absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none focus-visible:outline-none', on && 'ring-[1.5px] ring-primary ring-offset-1 ring-offset-transparent')}
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%`, height: `${h}%`, zIndex: on ? 30 : 10 + i }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).dataset.sizeHandle) return
                onSelect({ kind: 'piece', id: p.id })
                tf.begin(e, { mode: 'centre', centre: c, onChange: (next) => onPieceCentre(p.id, next) })
              }}
              onKeyDown={(e) => onPieceKey(e, p)}
            >
              {(on || showHalos) && (
                <span aria-hidden className="pointer-events-none absolute rounded-lg border-[1.5px] border-dashed border-terracotta/80 bg-terracotta/[0.07]" style={{ inset: `calc(-1 * ${t}cqw)` }} />
              )}
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              ) : (
                <div className="h-full w-full rounded border-2 border-dashed border-white/50" />
              )}
              <span className={cn('pointer-events-none absolute -left-2 -top-2 grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]', warn ? 'bg-terracotta' : 'bg-primary')}>{i + 1}</span>
              <span className={cn('pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-primary px-1.5 py-0.5 text-[10.5px] font-bold leading-[1.5] text-white group-hover:block', on && 'block')}>{label}</span>
              {on && (
                <span
                  data-size-handle="1"
                  title="Drag to change how big the piece appears to students"
                  onPointerDown={(e) => tf.begin(e, { mode: 'size', width: p.width, onChange: (w) => onPieceWidth(p.id, w) })}
                  className="absolute -bottom-[7px] -right-[7px] z-[4] h-[13px] w-[13px] cursor-nwse-resize rounded-full border-[1.5px] border-white bg-gold shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```
Notes: the sprite box gets an explicit `height` (from the ratio) with `object-fit: fill`, so a wrong stored ratio shows as a visibly distorted sprite instead of a silently wrong hit box; the halo inset uses `cqw` against the canvas (`container-type: inline-size`), so it is a true percent of the stage width. The `data-size-handle` check keeps the gold dot's pointerdown from also starting a move.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — expect errors only in `builder-dialog.tsx` (old props). They are fixed in Task 9. If lint fails on unused imports here, fix them.

- [ ] **Step 4: Commit**

```bash
git add components/admin/piece-placement/use-canvas-transform.ts components/admin/piece-placement/composition-canvas.tsx
git commit -m "admin: compose-the-answer canvas — sprites are the targets, tolerance halos, natural-ratio lock, centre drags"
```

---

### Task 7: Pieces panel (`inspector-pieces.tsx`)

**Files:**
- Rewrite: `components/admin/piece-placement/inspector-pieces.tsx`

**Interfaces:**
- Consumes: `PieceWarning` (Task 1), `readLocalizedField`, `clampPieceWidth`, `Selection` (Task 6).
- Produces (used by Task 9):
  ```ts
  export function warningText(w: PieceWarning): string
  export function InspectorPieces(props: {
    pieces: PlacementPiece[]; optionsEs: LocalizedOptions; selection: Selection; onSelect: (s: Selection) => void
    onPatch: (id: string, patch: Partial<PlacementPiece>) => void      // live, no history entry
    onCentre: (id: string, centre: Centre) => void                      // live
    onCommit: (label: string) => void                                   // history entry for the current state
    onLabelEs: (id: string, label: string) => void
    onRemove: (id: string) => void
    onImport: (files: File[]) => void
    importing: { done: number; total: number } | null; importError: string | null
    tolerance: number; onTolerance: (t: number, commit: boolean) => void
    warnings: Record<string, PieceWarning[]>; labels: (piece: PlacementPiece, index: number) => string
  })
  ```

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { ChevronRight, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { readLocalizedField, type LocalizedOptions } from '@/lib/quiz/options-es'
import { centreOf, type Centre, type PieceWarning } from '@/lib/quiz/placement'
import { clampPieceWidth } from '@/lib/quiz/transform'
import type { Selection } from './composition-canvas'

export function warningText(w: PieceWarning): string {
  switch (w.code) {
    case 'noName':
      return 'No name'
    case 'swappable':
      return `Swappable with #${w.with.join(', #')} · exchanging them still passes; tighten the tolerance or merge them`
    case 'offCanvas':
      return 'Off canvas'
    case 'fullFrame':
      return 'Image is still full-frame · run Fix images (Background tab)'
  }
}

const num = (v: string): number | undefined => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

function Field({ label, value, step = 0.1, onChange, onCommit }: { label: string; value: number; step?: number; onChange: (v: number) => void; onCommit: () => void }) {
  return (
    <label className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
      {label}
      <input
        type="number"
        step={step}
        value={Math.round(value * 10) / 10}
        onChange={(e) => {
          const v = num(e.target.value)
          if (v !== undefined) onChange(v)
        }}
        onBlur={onCommit}
        className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary"
      />
    </label>
  )
}

export function InspectorPieces({
  pieces,
  optionsEs,
  selection,
  onSelect,
  onPatch,
  onCentre,
  onCommit,
  onLabelEs,
  onRemove,
  onImport,
  importing,
  importError,
  tolerance,
  onTolerance,
  warnings,
  labels,
}: {
  pieces: PlacementPiece[]
  optionsEs: LocalizedOptions
  selection: Selection
  onSelect: (s: Selection) => void
  onPatch: (id: string, patch: Partial<PlacementPiece>) => void
  onCentre: (id: string, centre: Centre) => void
  onCommit: (label: string) => void
  onLabelEs: (id: string, label: string) => void
  onRemove: (id: string) => void
  onImport: (files: File[]) => void
  importing: { done: number; total: number } | null
  importError: string | null
  tolerance: number
  onTolerance: (t: number, commit: boolean) => void
  warnings: Record<string, PieceWarning[]>
  labels: (piece: PlacementPiece, index: number) => string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length) onImport(files)
  }

  return (
    <div className="grid content-start gap-3 p-3.5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          pick(e.dataTransfer.files)
        }}
        className={cn('grid gap-1.5 rounded-xl border-[1.5px] border-dashed p-3 text-center text-xs', over ? 'border-primary bg-primary/8' : 'border-foreground/25')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
        {importing ? (
          <span className="font-semibold">Importing {importing.done} of {importing.total}…</span>
        ) : (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 font-semibold text-foreground hover:text-primary">
              <Upload className="h-3.5 w-3.5" /> Drop PNGs here or click to choose
            </button>
            <span className="leading-snug text-muted-foreground">Several at once is fine. Files with the base image’s pixel size are trimmed and placed automatically; others land centred at 20% width.</span>
          </>
        )}
        {importError && <span className="text-destructive">{importError}</span>}
      </div>

      <label className="grid gap-1 text-xs text-muted-foreground">
        <span className="flex justify-between">
          <span>Tolerance for the whole question · the halo around each piece</span>
          <b className="font-mono font-medium text-foreground">{tolerance}%</b>
        </span>
        <input type="range" min={1} max={12} step={0.5} value={tolerance} onChange={(e) => onTolerance(Number(e.target.value), false)} onPointerUp={() => onTolerance(tolerance, true)} onKeyUp={() => onTolerance(tolerance, true)} className="w-full accent-primary" aria-label="Tolerance for the whole question" />
      </label>

      {pieces.map((p, i) => {
        const on = selection?.kind === 'piece' && selection.id === p.id
        const warn = warnings[p.id] ?? []
        const c = centreOf(p.area)
        return (
          <div key={p.id} data-row={p.id} aria-selected={on} onClick={() => onSelect({ kind: 'piece', id: p.id })} className={cn('grid gap-2 rounded-xl border-[1.5px] bg-raised p-2', on ? 'border-primary' : 'border-border')}>
            <div className="grid grid-cols-[22px_40px_1fr_auto] items-center gap-2">
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white', warn.length ? 'bg-terracotta' : 'bg-primary')}>{i + 1}</span>
              <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-lg bg-sunken p-1">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">img</span>
                )}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <Input
                  value={p.label ?? ''}
                  onChange={(e) => onPatch(p.id, { label: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== p.label) onPatch(p.id, { label: v })
                    onCommit('name')
                  }}
                  placeholder="Name (English)"
                  aria-label="Name"
                  className="h-7 border-0 bg-transparent px-0 text-[13px] font-semibold shadow-none focus-visible:ring-0"
                />
                <Input
                  value={readLocalizedField(optionsEs, 'pieces', p.id, 'label')}
                  onChange={(e) => onLabelEs(p.id, e.target.value)}
                  onBlur={() => onCommit('Spanish name')}
                  placeholder="Nombre (Español)"
                  aria-label="Nombre en español"
                  className="h-6 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                />
              </span>
              <span className="grid justify-items-end gap-1">
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={20}
                  value={p.tolerance ?? ''}
                  placeholder={`${tolerance}%`}
                  title="Tolerance for this piece (blank = question default)"
                  aria-label="Tolerance for this piece"
                  onChange={(e) => onPatch(p.id, { tolerance: e.target.value === '' ? undefined : Math.min(20, Math.max(0, Number(e.target.value))) })}
                  onBlur={() => onCommit('tolerance')}
                  className="h-6 w-14 rounded-md border border-border bg-sunken text-center font-mono text-[11px] tabular-nums outline-none focus:border-primary"
                />
                <button
                  type="button"
                  aria-label="Remove piece"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(p.id)
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            {warn.map((w) => (
              <p key={w.code} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-terracotta">
                <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-terracotta text-[9px] font-bold text-white">!</span>
                {warningText(w)}
              </p>
            ))}
            {on && (
              <details className="grid gap-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3 w-3 transition-transform [details[open]>summary>&]:rotate-90" /> Precise values
                </summary>
                <div className="grid grid-cols-3 gap-1.5">
                  <Field label="X" value={c.x} onChange={(v) => onCentre(p.id, { x: v, y: c.y })} onCommit={() => onCommit('position')} />
                  <Field label="Y" value={c.y} onChange={(v) => onCentre(p.id, { x: c.x, y: v })} onCommit={() => onCommit('position')} />
                  <Field label="Size" value={p.width} onChange={(v) => onPatch(p.id, { width: clampPieceWidth(v) })} onCommit={() => onCommit('size')} />
                </div>
              </details>
            )}
          </div>
        )
      })}
      {pieces.length === 0 && <p className="text-center text-xs text-muted-foreground">No pieces yet. Drop the exported part images above.</p>}
      <div className="grid gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="text-gold">How it works</b>
        Every piece sits on the canvas where it belongs, at the size the student sees. Drag it to move, pull the gold dot to resize, use the arrows to nudge. The dashed halo is how far off a student can be and still pass.
      </div>
    </div>
  )
}
```
`labels` is accepted so the row can fall back to "Piece n" for aria; use it for the delete button label: `aria-label={`Remove ${labels(p, i)}`}` (replace the plain "Remove piece").

- [ ] **Step 2: Typecheck** (`npx tsc --noEmit`; only `builder-dialog.tsx` may still fail until Task 9).

- [ ] **Step 3: Commit**

```bash
git add components/admin/piece-placement/inspector-pieces.tsx
git commit -m "admin: pieces panel — multi-file drop, tolerance, EN/ES names, warnings"
```

---

### Task 8: Background panel (`inspector-background.tsx`)

**Files:**
- Rewrite: `components/admin/piece-placement/inspector-background.tsx`

**Interfaces:**
- Produces (used by Task 9):
  ```ts
  export function InspectorBackground(props: {
    background: Background; aspect: number; selection: Selection; onSelect: (s: Selection) => void
    onColor: (color: string, commit: boolean) => void
    onAspect: (aspect: number) => void
    onReorderLayer: (id: string, dir: -1 | 1) => void
    onRemoveLayer: (id: string) => void
    onFitLayer: (id: string) => void
    onAddLayers: (files: File[]) => void; adding: { done: number; total: number } | null
    onFixImages: () => void; fixing: { done: number; total: number } | null; fixError: string | null
    saved: unknown
  })
  ```

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { ArrowDown, ArrowUp, Palette, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { Selection } from './composition-canvas'

const ASPECTS = [
  { label: '16:9', value: 16 / 9 },
  { label: '16:10', value: 1.6 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
]
const SWATCHES = ['#2A1E17', '#1B1B1F', '#0F2A2E', '#3B2F4A', '#6B2E1E', '#F4EDE1', '#FFFFFF']

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
}

const layerName = (l: { name?: string; imageUrl: string }, i: number) => l.name || `Layer ${i + 1}`

export function InspectorBackground({
  background,
  aspect,
  selection,
  onSelect,
  onColor,
  onAspect,
  onReorderLayer,
  onRemoveLayer,
  onFitLayer,
  onAddLayers,
  adding,
  onFixImages,
  fixing,
  fixError,
  saved,
}: {
  background: Background
  aspect: number
  selection: Selection
  onSelect: (s: Selection) => void
  onColor: (color: string, commit: boolean) => void
  onAspect: (aspect: number) => void
  onReorderLayer: (id: string, dir: -1 | 1) => void
  onRemoveLayer: (id: string) => void
  onFitLayer: (id: string) => void
  onAddLayers: (files: File[]) => void
  adding: { done: number; total: number } | null
  onFixImages: () => void
  fixing: { done: number; total: number } | null
  fixError: string | null
  saved: unknown
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = !!adding || !!fixing

  return (
    <div className="grid content-start gap-5 p-3.5">
      <div>
        <Label>Canvas shape · layers and pieces re-fit, nothing distorts</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-pressed={Math.abs(aspect - a.value) < 0.01}
              onClick={() => onAspect(a.value)}
              className={cn(
                'grid place-items-center gap-1 rounded-[9px] border-[1.5px] px-1 py-2 text-[11px] font-bold',
                Math.abs(aspect - a.value) < 0.01 ? 'border-primary bg-primary/8 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <i className="block rounded-[2px] border-[1.5px] border-current" style={{ width: 22, height: 22 / a.value }} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Background colour</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={background.color.toLowerCase() === c.toLowerCase()}
              onClick={() => onColor(c, true)}
              className={cn('aspect-square rounded-lg border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', background.color.toLowerCase() === c.toLowerCase() ? 'border-primary' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <Input value={background.color} onChange={(e) => onColor(e.target.value, false)} onBlur={(e) => onColor(e.target.value, true)} className="h-8 font-mono text-xs" aria-label="Hex colour" />
          <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: background.color }} />
        </div>
      </div>

      <div>
        <Label>
          Image layers <span className="font-medium normal-case tracking-normal">· back → front · the first one is the base frame</span>
        </Label>
        <div className="grid gap-1.5">
          {background.layers.map((l, i) => {
            const on = selection?.kind === 'layer' && selection.id === l.id
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect({ kind: 'layer', id: l.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect({ kind: 'layer', id: l.id })
                }}
                className={cn('grid grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-[10px] border-[1.5px] bg-raised p-2 text-left', on ? 'border-primary' : 'border-border')}
              >
                <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-[7px] bg-sunken p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imageUrl} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0 text-xs font-semibold">
                  <span className="block truncate">{layerName(l, i)}</span>
                  <small className="block text-[11px] font-medium tabular-nums text-muted-foreground">
                    {Math.round(l.width)}% × {Math.round(l.height)}%{l.ratio ? ` · ratio ${l.ratio.toFixed(2)}` : ' · ratio unknown'}
                  </small>
                </span>
                <span className="inline-flex gap-0.5">
                  <button type="button" title="Fit the box to the image's natural ratio" aria-label="Fit to image" disabled={!l.ratio} onClick={(e) => { e.stopPropagation(); onFitLayer(l.id) }} className="h-6 rounded-md px-1.5 text-[10.5px] font-bold text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">Fit</button>
                  <button type="button" aria-label="Send back" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, -1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Bring forward" disabled={i === background.layers.length - 1} onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, 1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete layer" onClick={(e) => { e.stopPropagation(); onRemoveLayer(l.id) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            )
          })}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
              if (files.length) onAddLayers(files)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full justify-start">
            <Upload className="mr-2 h-4 w-4" /> {adding ? `Uploading ${adding.done} of ${adding.total}…` : 'Upload image layers'}
          </Button>
          <p className="text-[11.5px] leading-snug text-muted-foreground">New layers land centred at 30% width at their natural ratio. Drag to move; corners keep the ratio, edges are free.</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="flex items-center gap-1.5 text-gold"><Sparkles className="h-3.5 w-3.5" /> Fix images</b>
        <span>Trims transparent margins off every piece and layer, shrinks them to 1024 px, uploads the new files and rewrites each piece’s size and target from where it sits in its export. Pieces exported at the base image’s size are placed automatically. Originals stay in storage; undo restores the previous data.</span>
        <Button type="button" size="sm" variant="outline" disabled={busy || (background.layers.length === 0)} onClick={onFixImages} className="w-fit">
          {fixing ? `Fixing ${fixing.done} of ${fixing.total}…` : 'Fix images'}
        </Button>
        {fixError && <span className="text-destructive">{fixError}</span>}
      </div>

      <details>
        <summary className="cursor-pointer text-[11.5px] font-bold text-muted-foreground">Advanced · saved data</summary>
        <pre className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border border-border bg-sunken p-3 text-[11px] leading-snug text-muted-foreground">{JSON.stringify(saved, null, 2)}</pre>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/piece-placement/inspector-background.tsx
git commit -m "admin: background panel — aspect refit, named layers with Fit to image, multi upload, Fix images"
```

---

### Task 9: Builder dialog wiring, summary thumbnail, question text

**Files:**
- Rewrite: `components/admin/piece-placement/builder-dialog.tsx`
- Modify: `components/admin/piece-placement/piece-placement-summary.tsx`
- Modify: `components/admin/quiz-builder.tsx:116` (pass `question`)

**Interfaces:**
- Consumes: Tasks 1–8. `BuilderProps` gains `question?: string`.

- [ ] **Step 1: Rewrite `builder-dialog.tsx`**

```tsx
'use client'

import { Eye, Grid3X3, Magnet, Pencil, Redo2, Target, Undo2, ZoomIn } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PiecePlacementInput, useMeasuredAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { useHistory } from '@/hooks/use-history'
import { cn } from '@/lib/utils'
import { readComposition, readPieces, readTolerance, shouldPersistAspect, type Background } from '@/lib/quiz/composition'
import { gradeQuestionScore, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { patchLocalizedEntry, pruneLocalizedEntries, type LocalizedOptions } from '@/lib/quiz/options-es'
import { centreOf, pieceWarnings, placePiece, refitForAspect, type Centre } from '@/lib/quiz/placement'
import type { Rect } from '@/lib/quiz/transform'
import type { QuizQuestion } from '@/types/modules'
import { fixImages, importLayerFiles, importPieceFiles, measureNatural, sameSize, type Natural } from './builder-import'
import { CompositionCanvas, type Selection } from './composition-canvas'
import { InspectorBackground } from './inspector-background'
import { InspectorPieces } from './inspector-pieces'

export interface BuilderProps {
  questionId: string
  /** The question text, shown in the dialog header. */
  question?: string
  options: unknown
  /** Spanish overlay: `{ pieces: [{ id, label }] }` with the same piece ids. */
  optionsEs?: LocalizedOptions
  imageUrl: string
  onChange: (data: { options?: unknown; options_es?: unknown; image_url?: string | null }) => void
}

type Snapshot = { options: unknown; optionsEs: LocalizedOptions }
type Progress = { done: number; total: number } | null
const NEW_PIECE_WIDTH = 20

function Toggle({ on, onClick, icon: Icon, children, title, disabled }: { on?: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} title={title} disabled={disabled} onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40', on ? 'bg-raised text-foreground shadow-sm' : 'text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

/** Natural pixel size per image URL (for aligned-set detection and sprite ratios). */
function useNaturalSizes(urls: string[]): Record<string, Natural> {
  const [sizes, setSizes] = useState<Record<string, Natural>>({})
  const key = urls.join('|')
  useEffect(() => {
    let alive = true
    for (const u of urls) {
      if (!u || sizes[u]) continue
      void measureNatural(u).then((n) => {
        if (alive && n) setSizes((s) => (s[u] ? s : { ...s, [u]: n }))
      })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return sizes
}

/** Student preview inside the dialog: the real input with local state plus Check / Reset. */
function PreviewPane({ background, pieces }: { background: Background; pieces: PlacementPiece[] }) {
  const [placement, setPlacement] = useState<Record<string, PiecePlacement>>({})
  const [graded, setGraded] = useState(false)
  const score = gradeQuestionScore({ question_type: 'piece_placement', options: { pieces } } as unknown as QuizQuestion, placement)
  return (
    <div className="grid gap-3.5 p-5">
      <PiecePlacementInput background={background} pieces={pieces} placement={placement} isGraded={graded} onChange={setPlacement} maxHeight="min(62vh, 640px)" />
      {graded && <FeedbackBanner score={score} />}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { setPlacement({}); setGraded(false) }}>Reset</Button>
        <Button disabled={Object.keys(placement).length === 0 || graded} onClick={() => setGraded(true)}>Check placement</Button>
      </div>
    </div>
  )
}

export function PiecePlacementBuilderDialog({ open, onOpenChange, questionId, question, options, optionsEs = null, imageUrl, onChange }: BuilderProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const tolerance = useMemo(() => readTolerance(options), [options])
  const [tab, setTab] = useState<'background' | 'pieces'>('pieces')
  const [selection, setSelection] = useState<Selection>(pieces[0] ? { kind: 'piece', id: pieces[0].id } : null)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showHalos, setShowHalos] = useState(false)
  const [zoom, setZoom] = useState<1 | 2>(1)
  const [preview, setPreview] = useState(false)
  const [importing, setImporting] = useState<Progress>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [adding, setAdding] = useState<Progress>(null)
  const [fixing, setFixing] = useState<Progress>(null)
  const [fixError, setFixError] = useState<string | null>(null)
  const { aspect, measured } = useMeasuredAspect(background)
  const history = useHistory<Snapshot>({ options, optionsEs })

  const naturals = useNaturalSizes([...background.layers.map((l) => l.imageUrl), ...pieces.map((p) => p.imageUrl)])
  const baseLayer = background.layers[0]
  const baseNatural = baseLayer ? naturals[baseLayer.imageUrl] : undefined
  const ratios = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of pieces) {
      const n = naturals[p.imageUrl]
      if (n) out[p.id] = n.width / n.height
    }
    return out
  }, [pieces, naturals])
  const fullFrameIds = useMemo(() => new Set(pieces.filter((p) => baseNatural && sameSize(naturals[p.imageUrl], baseNatural)).map((p) => p.id)), [pieces, naturals, baseNatural])
  const warnings = useMemo(() => pieceWarnings(pieces, aspect, tolerance, fullFrameIds), [pieces, aspect, tolerance, fullFrameIds])
  const labels = (p: PlacementPiece, i: number) => (p.label ?? '').trim() || `Piece ${i + 1}`

  // ---- writes: every write autosaves through onChange; `commitLabel` also records a history entry
  const record = (options as Record<string, unknown>) ?? {}
  const build = (next: { background?: Background; pieces?: PlacementPiece[]; tolerance?: number }) => ({ ...record, background: next.background ?? background, pieces: next.pieces ?? pieces, tolerance: next.tolerance ?? tolerance })
  const write = (next: { background?: Background; pieces?: PlacementPiece[]; tolerance?: number }, commitLabel?: string, es?: LocalizedOptions) => {
    const nextOptions = build(next)
    onChange({ options: nextOptions, image_url: null, ...(es !== undefined ? { options_es: es } : {}) })
    if (commitLabel) history.commit({ options: nextOptions, optionsEs: es !== undefined ? es : optionsEs })
  }
  const commitNow = () => history.commit({ options, optionsEs })
  const restore = (s: Snapshot) => onChange({ options: s.options, options_es: s.optionsEs, image_url: null })
  const undo = () => { const s = history.undo(); if (s) restore(s) }
  const redo = () => { const s = history.redo(); if (s) restore(s) }

  // Migrated rows carry aspect: null; persist the measured ratio the first time it's actually known.
  useEffect(() => {
    if (shouldPersistAspect({ open, storedAspect: background.aspect, layerCount: background.layers.length, measured })) write({ background: { ...background, aspect } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aspect, measured, background.aspect])

  // ---- pieces
  const withPiece = (id: string, fn: (p: PlacementPiece) => PlacementPiece) => pieces.map((p) => (p.id === id ? fn(p) : p))
  const movePiece = (id: string, centre: Centre) => write({ pieces: withPiece(id, (p) => placePiece(p, centre, p.width, aspect, tolerance)) })
  const sizePiece = (id: string, width: number) => write({ pieces: withPiece(id, (p) => placePiece(p, centreOf(p.area), width, aspect, tolerance)) })
  const patchPiece = (id: string, patch: Partial<PlacementPiece>) =>
    write({
      pieces: withPiece(id, (p) => {
        const merged = { ...p, ...patch }
        if (merged.tolerance === undefined) delete merged.tolerance
        return placePiece(merged, centreOf(p.area), merged.width, aspect, tolerance)
      }),
    })
  const removePiece = (id: string) => {
    const remaining = pieces.filter((p) => p.id !== id)
    const es = pruneLocalizedEntries(optionsEs, 'pieces', remaining.map((p) => p.id))
    write({ pieces: remaining }, 'remove piece', es)
    if (selection?.kind === 'piece' && selection.id === id) setSelection(null)
  }
  const setLabelEs = (id: string, label: string) => onChange({ options_es: patchLocalizedEntry(optionsEs, 'pieces', id, { label }) })
  const setTolerance = (t: number, commit: boolean) => write({ tolerance: t, pieces: pieces.map((p) => placePiece(p, centreOf(p.area), p.width, aspect, t)) }, commit ? 'tolerance' : undefined)

  const importPieces = async (files: File[]) => {
    setImportError(null)
    setImporting({ done: 0, total: files.length })
    try {
      const imported = await importPieceFiles(files, { questionId, base: baseLayer && baseNatural ? { rect: baseLayer, natural: baseNatural } : null, onProgress: (done, total) => setImporting({ done, total }) })
      const added = imported.map((it) => {
        const seed: PlacementPiece = { id: it.id, label: it.label, imageUrl: it.imageUrl, ratio: it.ratio, width: NEW_PIECE_WIDTH, area: { x: 0, y: 0, width: 0, height: 0 } }
        return it.aligned ? placePiece(seed, it.aligned.centre, it.aligned.width, aspect, tolerance) : placePiece(seed, { x: 50, y: 50 }, NEW_PIECE_WIDTH, aspect, tolerance)
      })
      write({ pieces: [...pieces, ...added] }, `import ${added.length} piece${added.length === 1 ? '' : 's'}`)
      if (added[0]) setSelection({ kind: 'piece', id: added[0].id })
      setTab('pieces')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }

  // ---- background
  const setBackground = (patch: Partial<Background>, commitLabel?: string) => write({ background: { ...background, ...patch } }, commitLabel)
  const setLayerRect = (id: string, r: Rect) => setBackground({ layers: background.layers.map((l) => (l.id === id ? { ...l, ...r } : l)) })
  const setAspect = (a: number) => {
    const out = refitForAspect(background, pieces, a, tolerance)
    write({ background: out.background, pieces: out.pieces }, 'canvas shape')
  }
  const fitLayer = (id: string) => {
    const l = background.layers.find((x) => x.id === id)
    if (!l?.ratio) return
    const height = Math.min(100, (l.width * aspect) / l.ratio)
    const y = Math.min(100 - height, Math.max(0, l.y + l.height / 2 - height / 2))
    setBackground({ layers: background.layers.map((x) => (x.id === id ? { ...x, height, y } : x)) }, 'fit layer')
  }
  const reorderLayer = (id: string, dir: -1 | 1) => {
    const i = background.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= background.layers.length) return
    const next = [...background.layers]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBackground({ layers: next }, 'reorder layers')
  }
  const removeLayer = (id: string) => {
    setBackground({ layers: background.layers.filter((l) => l.id !== id) }, 'remove layer')
    if (selection?.kind === 'layer' && selection.id === id) setSelection(null)
  }
  const addLayers = async (files: File[]) => {
    setAdding({ done: 0, total: files.length })
    try {
      const added = await importLayerFiles(files, { questionId, aspect, onProgress: (done, total) => setAdding({ done, total }) })
      setBackground({ layers: [...background.layers, ...added] }, `add ${added.length} layer${added.length === 1 ? '' : 's'}`)
      if (added[0]) setSelection({ kind: 'layer', id: added[0].id })
    } catch (e) {
      setFixError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setAdding(null)
    }
  }
  const runFixImages = async () => {
    setFixError(null)
    setFixing({ done: 0, total: background.layers.length + pieces.length })
    try {
      const out = await fixImages({ questionId, background, pieces, aspect, tolerance, onProgress: (done, total) => setFixing({ done, total }) })
      write({ background: out.background, pieces: out.pieces }, 'fix images')
    } catch (e) {
      setFixError(e instanceof Error ? e.message : 'Fix images failed')
    } finally {
      setFixing(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || preview) return
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  }
  const done = () => {
    history.reset({ options, optionsEs })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} onKeyDown={onKeyDown} className="flex h-[92vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]">
        <DialogTitle className="sr-only">Drag-and-drop builder</DialogTitle>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-sunken px-3.5 py-2.5">
          <div className="mr-auto min-w-0">
            <div className="font-heading text-[13px] font-bold">Drag into place</div>
            {question && <div className="max-w-[46ch] truncate text-xs text-muted-foreground">{question}</div>}
          </div>
          <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
            <Toggle on={!preview} onClick={() => setPreview(false)} icon={Pencil}>Design</Toggle>
            <Toggle on={preview} onClick={() => setPreview(true)} icon={Eye}>Preview as student</Toggle>
          </div>
          {!preview && (
            <>
              <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
                <Toggle onClick={undo} icon={Undo2} disabled={!history.canUndo} title="Undo (⌘Z)">Undo</Toggle>
                <Toggle onClick={redo} icon={Redo2} disabled={!history.canRedo} title="Redo (⇧⌘Z)">Redo</Toggle>
              </div>
              <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
                <Toggle on={showHalos} onClick={() => setShowHalos(!showHalos)} icon={Target} title="Show every piece's tolerance">Tolerance</Toggle>
                <Toggle on={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid3X3}>Grid</Toggle>
                <Toggle on={snap} onClick={() => setSnap(!snap)} icon={Magnet}>Snap</Toggle>
                <Toggle on={zoom === 2} onClick={() => setZoom(zoom === 2 ? 1 : 2)} icon={ZoomIn}>2×</Toggle>
              </div>
            </>
          )}
          <Button size="sm" onClick={done}>Done</Button>
        </div>

        {preview ? (
          <div className="min-h-0 flex-1 overflow-auto"><PreviewPane background={background} pieces={pieces} /></div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
              <CompositionCanvas
                background={background}
                pieces={pieces}
                aspect={aspect}
                tolerance={tolerance}
                ratios={ratios}
                selection={selection}
                onSelect={setSelection}
                onLayerRect={setLayerRect}
                onPieceCentre={movePiece}
                onPieceWidth={sizePiece}
                onRemovePiece={removePiece}
                onGestureEnd={commitNow}
                snap={snap}
                showGrid={showGrid}
                showHalos={showHalos}
                zoom={zoom}
                warnings={warnings}
                labels={labels}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
                <span>Autosaves as you go · {history.canUndo ? 'undo available until Done' : 'nothing to undo yet'}</span>
                <span>← ↑ ↓ → nudge 0.1% · Shift 1% · ⌫ remove · ⌘Z undo</span>
              </div>
            </div>
            <div className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden border-t border-border bg-card md:border-l md:border-t-0">
              <div className="grid grid-cols-2 border-b border-border">
                <button type="button" aria-pressed={tab === 'pieces'} onClick={() => setTab('pieces')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'pieces' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Pieces · {pieces.length}</button>
                <button type="button" aria-pressed={tab === 'background'} onClick={() => setTab('background')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'background' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Background</button>
              </div>
              <div className="min-h-0 overflow-auto">
                {tab === 'background' ? (
                  <InspectorBackground
                    background={background}
                    aspect={aspect}
                    selection={selection}
                    onSelect={setSelection}
                    onColor={(color, commit) => setBackground({ color }, commit ? 'colour' : undefined)}
                    onAspect={setAspect}
                    onReorderLayer={reorderLayer}
                    onRemoveLayer={removeLayer}
                    onFitLayer={fitLayer}
                    onAddLayers={(files) => void addLayers(files)}
                    adding={adding}
                    onFixImages={() => void runFixImages()}
                    fixing={fixing}
                    fixError={fixError}
                    saved={{ image_url: null, options: build({}) }}
                  />
                ) : (
                  <InspectorPieces
                    pieces={pieces}
                    optionsEs={optionsEs}
                    selection={selection}
                    onSelect={setSelection}
                    onPatch={patchPiece}
                    onCentre={movePiece}
                    onCommit={commitNow}
                    onLabelEs={setLabelEs}
                    onRemove={removePiece}
                    onImport={(files) => void importPieces(files)}
                    importing={importing}
                    importError={importError}
                    tolerance={tolerance}
                    onTolerance={setTolerance}
                    warnings={warnings}
                    labels={labels}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Summary thumbnail shows the composed answer**

In `piece-placement-summary.tsx` replace the dashed-box `pieces.map(...)` inside the thumbnail with sprites at their centres:
```tsx
{pieces.map((p) => {
  const c = centreOf(p.area)
  return p.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={p.id} src={p.imageUrl} alt="" draggable={false} className="absolute -translate-x-1/2 -translate-y-1/2 select-none" style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%` }} />
  ) : null
})}
```
and import `centreOf` from `@/lib/quiz/placement`. Also pass the question text through: the summary spreads `{...props}` into the dialog, so no change beyond the import.

- [ ] **Step 3: `quiz-builder.tsx`**

Line 116 becomes:
```tsx
        return <PiecePlacementSummary questionId={questionId} question={question} options={options} optionsEs={optionsEs} imageUrl={imageUrl} onChange={onChange} />
```

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint -- --quiet && npx vitest run lib/quiz hooks` → clean.

- [ ] **Step 5: Verify in Chrome (builder URL)**

Open the builder for "Assemble your timbales" and check, in order, WITHOUT running Fix images:
1. The canvas fills the dialog height; sprites sit where the old target boxes were (their centres), badges numbered, chip on hover, halo on the selected piece; "Tolerance" shows every halo; 2× zooms and scrolls.
2. Drag a sprite: it moves under the cursor; release: the status line says undo is available; ⌘Z puts it back; ⇧⌘Z redoes; the Undo/Redo buttons mirror this.
3. Pull the gold dot: the width changes about the centre; arrows nudge 0.1 %, Shift 1 %.
4. Pieces tab: rows show numbers, thumbnails, EN/ES names; typing a name updates the chip; blur records one history step; a blank name shows "No name"; the bells show "Swappable with …"; per-piece tolerance and the question slider change the halos and re-write `area` (check the Advanced · saved data JSON on the Background tab).
5. Background tab: switching 1:1 → 4:3 keeps the stand's proportions and the pieces on the stand; Fit adjusts a distorted layer's height; the layer row shows a name and ratio.
6. Preview as student: the Tier 1 input with the same data; Check works.
7. Undo everything back to the start (or Done and re-open) so the stored data is unchanged unless the user asked otherwise.

Then ask the user in chat before pressing **Fix images** on the real question.

- [ ] **Step 6: Commit**

```bash
git status --short
git add components/admin/piece-placement/builder-dialog.tsx components/admin/piece-placement/piece-placement-summary.tsx components/admin/quiz-builder.tsx
git commit -m "admin: builder dialog — undo/redo over autosave, aligned import, Fix images, question text, composed summary"
```

---

### Task 10: Verification, review, notes

**Files:** none new (fixes only).

- [ ] **Step 1: Full checks** — `npx vitest run`, `npx tsc --noEmit`, `npm run lint -- --quiet`. Fix anything red.
- [ ] **Step 2: Student flow in Chrome** (Task 3 Step 5 list) and the exam-sheet mode if a quiz uses it (`quiz_settings.mode = 'sheet'` — none does today; skip if none).
- [ ] **Step 3: Independent review** — run the `code-review` skill on the branch diff since `36843e9`; fix confirmed findings; commit as `quiz: review fixes — …`.
- [ ] **Step 4: Fix images on the real question** — only with the user's explicit go-ahead in chat; afterwards report which files were uploaded and what the new `options` geometry is (query `quiz_questions` for `e73f0390-f852-49b6-9722-2ab3488b9ed0`).
- [ ] **Step 5: Memory** — update `dnd-rework-proposal.md` in the memory directory: implemented commits, what was verified live, what was not, whether Fix images ran.
