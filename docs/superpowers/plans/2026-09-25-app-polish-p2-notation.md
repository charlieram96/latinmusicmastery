# App Polish — Phase 2: Notation N1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the lesson exercise staff and the watch-mode staff the N1 "Refined" look: played dimming, a spring pop on the active note, a glowing playhead with a beat diamond, a gliding bar band, always-on helpers (note names, beat counts, next-note ring), reworked stacked rows with a gliding follow, a new paged horizontal layout with a slide turn, and a persisted Stacked ↔ Horizontal switch.

**Architecture:**
- All drawing stays in the imperative `StaffRendererImpl` (VexFlow 5, one SVG, direct DOM writes, no React re-renders per frame).
- Every row's SVG content is wrapped in a `g[data-score-row]` and every row's HTML helpers in a `div[data-score-row]`, so rows can be dimmed (stacked) or shown one at a time (paged) without re-engraving.
- The new layout `'paged'` uses the wrapped row plan but draws every row at the same y; only the current row is visible and turns slide it in.
- Pure maths (bars per row, follow target and glide, row states, count marks, note states, page-turn timing, note labels, bar-tail cursor) lives in small tested helpers under `lib/playsense-studio/`.

**Tech Stack:** Next.js app router, React, TypeScript, VexFlow 5, plain CSS (`staff-renderer.css`, `exercise-score.css`), vitest (jsdom for renderer tests; VexFlow runs in jsdom with a stub canvas context).

**Spec:** `docs/superpowers/specs/2026-09-25-app-polish-design.md` §2 (Notation: N1 on the existing renderer). Visual reference: design lab 2 `notation.js` and the `.nx-*` rules in `lab.css` / `workspace.css`.

## Global Constraints

- Scope: the lesson exercise staff (`exercise-score.tsx`) and the watch-mode staff in `PlaysenseStudioPlayer`. The Studio editor strip (`continuous-staff.tsx`) must not change; its tests must still pass.
- Staff lines at 24% of the ink colour. Glyphs have no stroke (Phase 1 already did this).
- Played notes 40% opacity. Active: `--primary`, `drop-shadow(0 0 6px hsl(var(--primary) / .45))`, pop 1 → 1.2 → 1.06 over `--dur-pop` (320ms) with `--ease-spring`.
- Playhead: 3px rounded bar, vertical gradient, 12px primary glow, 9px diamond on top pulsing scale 1.7 → 1 over 260ms on every beat.
- Bar band: `hsl(var(--primary) / .07)`, 10px radius, glides with `--dur-turn`. Replaces "MEASURE 01" labels, dots and rails.
- Note-name chip 20px under each attack (not under tied continuations); current chip fills primary and scales 1.18.
- Beat counts "1 & 2 & 3 & 4 &" under the staff, beats bold, current count primary at scale 1.3; a note's tail runs to the barline when the next note is in the next bar.
- Next-note ring 26px, scale .7 → 1.5 fading, 1s loop, `motion-safe` only.
- Stacked: bars per row `clamp(floor(width / (250 · scale)), 2, 4)`; clef every row; time signature on the first row only; italic bar number at the start of every row after the first; half-ties across row breaks; glide ~7/s so the current row sits at the top; past rows 45%, next rows 88%.
- Paged: one row at a time; the next page slides in from the right (12% + opacity, 420ms `--ease-out`) while the old one slides out left; reduced motion uses a 220ms fade.
- Layout switch Stacked ↔ Horizontal at any time from the staff toolbar, persisted in localStorage.
- Hit/miss colours stay on the highway; the staff shows no judgement colours.
- Every user-facing string goes through `useTranslation()`; keys in both `locales/en.json` and `locales/es.json`, under the new top-level `staff` block only.
- Reduced motion: no pop, no diamond pulse, no ring pulse, no glide (jump), fade page turn.
- Stacked glide and playhead run on rAF with direct DOM writes.
- End every commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Percussion staff (conga fixture):** keys are staff positions, not pitches, so it must show no note-name chips while counts, ring, band and played states still work. Pinned in Task 4 (`percussion shows no note names`).
2. **Tied continuations and chords:** no chip under a tied continuation; a chord shows one chip (its top note). Pinned in Task 1 (`isAttack`) and Task 4 (`no chip under a tied continuation`).
3. **Seeking backwards / looping passes:** played state must clear when time moves back, and a paged turn backwards slides the other way. Pinned in Task 3 (`seeking back clears played`) and Task 1 (`pageTurn back`).
4. **Pausing mid-piece (cursor hidden):** played dimming stays (progress is visible) but there is no active note and no ring. Pinned in Task 3 (`hidden cursor keeps played, drops active`).
5. **Leading/trailing video interludes in paged layout:** an interlude is its own page; the page before the music is the interlude, and the playhead hides there. Pinned in Task 5 (`paged shows the interlude page before the music`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/playsense-studio/notation/staff-n1.ts` | create | `barsPerRow`, `rowStates`, `stackedFollowTarget`, `glide`, `barCounts`, `noteStateAt`, `pageTurn`, `noteLabel`, `isAttack`, `parseStaffLayout` |
| `lib/playsense-studio/notation/__tests__/staff-n1.test.ts` | create | helper tests |
| `lib/playsense-studio/notation-playback.ts` | modify | `scoreCursorAt` runs a note's tail to its barline when the next anchor is in another bar |
| `lib/playsense-studio/notation-layout.ts` | modify | `packScoreRows` / `packLessonScoreRows` accept a `maxPerRow` cap |
| `lib/playsense-studio/__tests__/notation-n1-layout.test.ts` | create | tests for the two changes above |
| `components/playsense-studio/player/notation/renderers/staff-renderer.tsx` | modify | row groups, note states, playhead, band, helpers, stacked glide, paged layout |
| `components/playsense-studio/player/notation/renderers/staff-renderer.css` | modify | N1 styles |
| `components/playsense-studio/player/notation/renderers/__tests__/staff-renderer-n1.test.tsx` | create | jsdom renderer tests |
| `components/playsense-studio/player/notation/staff-layout-switch.tsx` | create | `useStaffLayoutPreference`, `StaffLayoutSwitch` |
| `components/playsense-studio/player/notation/__tests__/staff-layout-switch.test.tsx` | create | persistence + switch tests |
| `components/class-viewer/lesson-viewer/exercise-score.tsx` / `.css` | modify | layout switch replaces Steady/Flow; HUD copy via i18n |
| `components/playsense-studio/player/playsense-studio-player.tsx` | modify (minimal) | persisted layout; horizontal = paged |
| `locales/en.json`, `locales/es.json` | modify | new `staff` block |

---

### Task 1: Pure N1 helpers

**Files:**
- Create: `lib/playsense-studio/notation/staff-n1.ts`
- Test: `lib/playsense-studio/notation/__tests__/staff-n1.test.ts`

**Interfaces:**
- Produces:
  - `barsPerRow(widthPx: number, scale: number): number`
  - `type RowState = 'past' | 'now' | 'next'`; `rowStates(count: number, current: number): RowState[]`
  - `stackedFollowTarget(rowTopPx: number, viewportPx: number, contentPx: number): number`
  - `glide(current: number, target: number, dtSeconds: number, rate?: number): number`
  - `interface CountMark { qn: number; label: string; beat: boolean }`; `barCounts(startQn: number, timeSignature: [number, number], and: string): CountMark[]`
  - `noteStateAt(ms: number, notes: ReadonlyArray<{ ms: number; endMs: number }>): { active: number; played: number }`
  - `interface PageTurn { kind: 'instant' | 'slide' | 'fade'; durationMs: number; direction: 1 | -1; offsetPercent: number }`; `pageTurn(from: number, to: number, reducedMotion: boolean): PageTurn`
  - `type NoteNameStyle = 'letters' | 'solfege'`; `noteLabel(key: string, style: NoteNameStyle): string`
  - `isAttack(previous: { tieToNext: boolean } | undefined, current: { isRest: boolean }): boolean`
  - `type StaffLayoutChoice = 'stacked' | 'horizontal'`; `STAFF_LAYOUT_KEY = 'lmm-staff-layout'`; `parseStaffLayout(raw: string | null): StaffLayoutChoice`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { barCounts, barsPerRow, glide, isAttack, noteLabel, noteStateAt, pageTurn, parseStaffLayout, rowStates, stackedFollowTarget } from '../staff-n1'

describe('barsPerRow', () => {
  it('fits one bar per 250 scaled px, clamped to 2..4', () => {
    expect(barsPerRow(1200, 1)).toBe(4)
    expect(barsPerRow(760, 1)).toBe(3)
    expect(barsPerRow(390, 1.17)).toBe(2)
    expect(barsPerRow(0, 1)).toBe(2)
  })
})
describe('rowStates', () => {
  it('marks rows before, at and after the current one', () => {
    expect(rowStates(4, 1)).toEqual(['past', 'now', 'next', 'next'])
  })
})
describe('stackedFollowTarget', () => {
  it('puts the row at the top, clamped to the scroll range', () => {
    expect(stackedFollowTarget(300, 400, 1000)).toBe(294)
    expect(stackedFollowTarget(0, 400, 1000)).toBe(0)
    expect(stackedFollowTarget(900, 400, 1000)).toBe(600)
    expect(stackedFollowTarget(300, 400, 200)).toBe(0)
  })
})
describe('glide', () => {
  it('eases about 7/s and snaps when close', () => {
    expect(glide(0, 100, 1 / 60)).toBeCloseTo(100 * 7 / 60)
    expect(glide(99.8, 100, 1 / 60)).toBe(100)
    expect(glide(0, 100, 1)).toBe(100)
  })
})
describe('barCounts', () => {
  it('counts eighths in 4/4 with the "and" label', () => {
    expect(barCounts(4, [4, 4], '&').map(c => c.label).join(' ')).toBe('1 & 2 & 3 & 4 &')
    expect(barCounts(4, [4, 4], '&')[1]).toEqual({ qn: 4.5, label: '&', beat: false })
  })
  it('counts only beats in eighth-note meters', () => {
    expect(barCounts(0, [6, 8], '&').map(c => `${c.qn}:${c.label}`)).toEqual(['0:1', '0.5:2', '1:3', '1.5:4', '2:5', '2.5:6'])
  })
})
describe('noteStateAt', () => {
  const notes = [{ ms: 0, endMs: 500 }, { ms: 500, endMs: 1000 }, { ms: 1500, endMs: 2000 }]
  it('finds the sounding note and the played prefix', () => {
    expect(noteStateAt(-10, notes)).toEqual({ active: -1, played: 0 })
    expect(noteStateAt(600, notes)).toEqual({ active: 1, played: 1 })
    expect(noteStateAt(1200, notes)).toEqual({ active: -1, played: 2 })
    expect(noteStateAt(5000, notes)).toEqual({ active: -1, played: 3 })
  })
})
describe('pageTurn', () => {
  it('is instant on first show and for the same page', () => {
    expect(pageTurn(-1, 0, false).kind).toBe('instant')
    expect(pageTurn(2, 2, false).kind).toBe('instant')
  })
  it('slides 12% over 420ms, backwards when going back', () => {
    expect(pageTurn(0, 1, false)).toEqual({ kind: 'slide', durationMs: 420, direction: 1, offsetPercent: 12 })
    expect(pageTurn(3, 1, false).direction).toBe(-1)
  })
  it('fades for 220ms under reduced motion', () => {
    expect(pageTurn(0, 1, true)).toEqual({ kind: 'fade', durationMs: 220, direction: 1, offsetPercent: 0 })
  })
})
describe('noteLabel', () => {
  it('names spelled VexFlow keys in letters or solfege', () => {
    expect(noteLabel('c#/5', 'letters')).toBe('C♯')
    expect(noteLabel('bb/4', 'letters')).toBe('B♭')
    expect(noteLabel('g/4', 'solfege')).toBe('Sol')
    expect(noteLabel('f##/4', 'solfege')).toBe('Fa𝄪')
    expect(noteLabel('nonsense', 'letters')).toBe('')
  })
})
describe('isAttack', () => {
  it('skips rests and tied continuations', () => {
    expect(isAttack(undefined, { isRest: false })).toBe(true)
    expect(isAttack({ tieToNext: true }, { isRest: false })).toBe(false)
    expect(isAttack({ tieToNext: false }, { isRest: true })).toBe(false)
  })
})
describe('parseStaffLayout', () => {
  it('defaults to stacked', () => {
    expect(parseStaffLayout(null)).toBe('stacked')
    expect(parseStaffLayout('junk')).toBe('stacked')
    expect(parseStaffLayout('horizontal')).toBe('horizontal')
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run lib/playsense-studio/notation/__tests__/staff-n1.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** Pure maths for the N1 staff: layout, follow, helpers. Coordinates are rendered px unless named otherwise. */
export type RowState = 'past' | 'now' | 'next'
export type NoteNameStyle = 'letters' | 'solfege'
export type StaffLayoutChoice = 'stacked' | 'horizontal'
export interface CountMark { qn: number; label: string; beat: boolean }
export interface PageTurn { kind: 'instant' | 'slide' | 'fade'; durationMs: number; direction: 1 | -1; offsetPercent: number }

export const STAFF_LAYOUT_KEY = 'lmm-staff-layout'

export function barsPerRow(widthPx: number, scale: number): number {
  if (!(widthPx > 0) || !(scale > 0)) return 2
  return Math.max(2, Math.min(4, Math.floor(widthPx / (250 * scale))))
}

export function rowStates(count: number, current: number): RowState[] {
  return Array.from({ length: count }, (_, k) => k < current ? 'past' : k === current ? 'now' : 'next')
}

export function stackedFollowTarget(rowTopPx: number, viewportPx: number, contentPx: number): number {
  return Math.max(0, Math.min(rowTopPx - 6, Math.max(0, contentPx - viewportPx)))
}

export function glide(current: number, target: number, dtSeconds: number, rate = 7): number {
  if (Math.abs(target - current) < .5) return target
  return current + (target - current) * Math.min(1, Math.max(0, dtSeconds) * rate)
}

export function barCounts(startQn: number, [beats, unit]: [number, number], and: string): CountMark[] {
  const beatQn = 4 / unit
  const marks: CountMark[] = []
  for (let b = 0; b < beats; b++) {
    marks.push({ qn: startQn + b * beatQn, label: String(b + 1), beat: true })
    if (unit <= 4) marks.push({ qn: startQn + (b + .5) * beatQn, label: and, beat: false })
  }
  return marks
}

/** Notes are voice-1 events in time order and never overlap, so ends are sorted too. */
export function noteStateAt(ms: number, notes: ReadonlyArray<{ ms: number; endMs: number }>): { active: number; played: number } {
  let lo = 0, hi = notes.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (notes[mid].endMs <= ms) lo = mid + 1; else hi = mid }
  const active = lo < notes.length && notes[lo].ms <= ms ? lo : -1
  return { active, played: lo }
}

export function pageTurn(from: number, to: number, reducedMotion: boolean): PageTurn {
  const direction = to < from ? -1 : 1
  if (from < 0 || from === to) return { kind: 'instant', durationMs: 0, direction, offsetPercent: 0 }
  return reducedMotion
    ? { kind: 'fade', durationMs: 220, direction, offsetPercent: 0 }
    : { kind: 'slide', durationMs: 420, direction, offsetPercent: 12 }
}

const SOLFEGE: Record<string, string> = { c: 'Do', d: 'Re', e: 'Mi', f: 'Fa', g: 'Sol', a: 'La', b: 'Si' }
const ACCIDENTAL: Record<string, string> = { '': '', '#': '♯', '##': '𝄪', b: '♭', bb: '𝄫', n: '' }

export function noteLabel(key: string, style: NoteNameStyle): string {
  const match = /^([a-g])(##|bb|#|b|n)?\//.exec(key)
  if (!match) return ''
  const base = style === 'solfege' ? SOLFEGE[match[1]] : match[1].toUpperCase()
  return base + ACCIDENTAL[match[2] ?? '']
}

export function isAttack(previous: { tieToNext: boolean } | undefined, current: { isRest: boolean }): boolean {
  return !current.isRest && !previous?.tieToNext
}

export function parseStaffLayout(raw: string | null): StaffLayoutChoice {
  return raw === 'horizontal' ? 'horizontal' : 'stacked'
}
```

- [ ] **Step 4: Run it and see it pass** (same command). Expected: PASS.
- [ ] **Step 5: Commit** — `git add lib/playsense-studio/notation/staff-n1.ts lib/playsense-studio/notation/__tests__/staff-n1.test.ts && git commit -m "Add the pure helpers for the N1 staff"`

---

### Task 2: Bar-tail cursor and a row cap for the packer

**Files:**
- Modify: `lib/playsense-studio/notation-playback.ts` (`ScoreAnchor`, `scoreCursorAt`)
- Modify: `lib/playsense-studio/notation-layout.ts` (`packScoreRows`, `packLessonScoreRows`)
- Test: `lib/playsense-studio/__tests__/notation-n1-layout.test.ts`

**Interfaces:**
- Produces: `ScoreAnchor` gains optional `bar?: number; barEndX?: number`. `packScoreRows(widths, avail, rowStartExtra?, maxPerRow = 3)`, `packLessonScoreRows(widths, avail, interludes, rowStartExtra?, maxPerRow = 3)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { scoreCursorAt } from '../notation-playback'
import { packScoreRows } from '../notation-layout'

describe('scoreCursorAt with bar tails', () => {
  const anchors = [
    { ms: 0, x: 10, system: 0, bar: 1, barEndX: 100 },
    { ms: 1000, x: 60, system: 0, bar: 1, barEndX: 100 },
    { ms: 2000, x: 130, system: 0, bar: 2, barEndX: 200 },
  ]
  it('runs the last note of a bar to its barline, not into the next bar', () => {
    expect(scoreCursorAt(1500, anchors, 3000, [200]).x).toBe(80)
  })
  it('keeps interpolating between notes of the same bar', () => {
    expect(scoreCursorAt(500, anchors, 3000, [200]).x).toBe(35)
  })
  it('behaves as before without bar data', () => {
    const plain = anchors.map(({ ms, x, system }) => ({ ms, x, system }))
    expect(scoreCursorAt(1500, plain, 3000, [200]).x).toBe(95)
  })
})

describe('packScoreRows maxPerRow', () => {
  it('caps a row at the given number of bars', () => {
    expect(packScoreRows([100, 100, 100, 100, 100], 1000, [], 4).map(r => r.widths.length)).toEqual([4, 1])
    expect(packScoreRows([100, 100, 100, 100, 100], 1000, [], 2).map(r => r.widths.length)).toEqual([2, 2, 1])
  })
  it('still never squeezes bars below their width', () => {
    expect(packScoreRows([300, 300, 300], 500, [], 4).map(r => r.widths.length)).toEqual([1, 1, 1])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run lib/playsense-studio/__tests__/notation-n1-layout.test.ts` — Expected: FAIL (the bar-tail case returns 95; the cap case returns `[3, 2]`).

- [ ] **Step 3: Implement**

In `notation-playback.ts`:

```ts
export interface ScoreAnchor { ms: number; x: number; system: number; bar?: number; barEndX?: number }
// inside scoreCursorAt, replace the endX line:
  const crossesBar = b && a.barEndX != null && b.bar != null && b.bar !== a.bar
  const endX = b && b.system === a.system ? (crossesBar ? a.barEndX! : b.x) : (rowEnds[a.system] ?? a.x)
```

In `notation-layout.ts`, add `maxPerRow = 3` as the last parameter of both functions, use `count < maxPerRow` in the loop, and pass it through from `packLessonScoreRows`.

- [ ] **Step 4: Run** the new test plus `npx vitest run lib/playsense-studio` — Expected: PASS (existing notation-playback tests unchanged).
- [ ] **Step 5: Commit** — `git commit -m "Run note tails to the barline and let the row packer take a bar cap"`

---

### Task 3: Rows, note states and the N1 playhead

**Files:**
- Modify: `components/playsense-studio/player/notation/renderers/staff-renderer.tsx`
- Modify: `components/playsense-studio/player/notation/renderers/staff-renderer.css`
- Test: `components/playsense-studio/player/notation/renderers/__tests__/staff-renderer-n1.test.tsx`

**Interfaces:**
- Consumes: `noteStateAt`, `rowStates` (Task 1); `ScoreAnchor.bar/barEndX` (Task 2).
- Produces (DOM contract used by CSS and later tasks):
  - `svg > g[data-score-row="<k>"]` holds every SVG element of row k (staves, notes, beams, ties, spans, repeat text). `data-row-state` is `past | now | next`.
  - `.ps-staff-content > div.ps-staff-row[data-score-row="<k>"]` holds row k's HTML helpers and interludes.
  - `g[data-score-note][data-note-state="upcoming" | "active" | "played"]`.
  - `.ps-staff-playhead` contains `span.ps-staff-playhead-diamond`; a beat change calls `diamond.animate(...)` unless reduced motion.

- [ ] **Step 1: Write the failing test** (jsdom; same canvas stub as `staff-renderer-rows.test.tsx`)

```tsx
// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { StaffRenderer, type StaffRendererProps } from '../staff-renderer'

beforeAll(() => {
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
})

/** Four bars of quarter notes at 120 bpm: each note 500ms, each bar 2000ms. */
function scale(overrides: Partial<ScoreDocument> = {}, events?: (bar: number) => unknown[]): ScoreDocument {
  return {
    schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
    initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [1, 2, 3, 4].map(number => ({ number, voices: [{ number: 1, events: events?.(number) ?? [60, 62, 64, 65].map(midi => ({ kind: 'note', midi, durationQN: 1 })) }] })) }],
    ...overrides,
  } as ScoreDocument
}

let root: Root, host: HTMLDivElement
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const draw = (props: Partial<StaffRendererProps> & { score?: ScoreDocument }) =>
  act(() => { root.render(<StaffRenderer score={scale()} trackIndex={0} currentMs={0} layoutMode="wrapped" {...props} />) })
const states = () => [...host.querySelectorAll('[data-score-note]')].map(n => n.getAttribute('data-note-state'))

describe('note states', () => {
  it('dims played notes and lights the sounding one', () => {
    draw({ currentMs: 1200 })
    expect(states().slice(0, 4)).toEqual(['played', 'played', 'active', 'upcoming'])
  })
  it('seeking back clears played', () => {
    draw({ currentMs: 5000 }); draw({ currentMs: 100 })
    expect(states().filter(s => s === 'played')).toHaveLength(0)
  })
  it('hidden cursor keeps played, drops active', () => {
    draw({ currentMs: 1200, showCursor: false })
    expect(states().slice(0, 4)).toEqual(['played', 'played', 'upcoming', 'upcoming'])
  })
})

describe('rows', () => {
  it('groups each row of the SVG and the helpers', () => {
    draw({ currentMs: 2500 })
    const rows = [...host.querySelectorAll('svg > g[data-score-row]')]
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every(r => r.querySelector('[data-score-note]'))).toBe(true)
    expect(host.querySelectorAll('.ps-staff-row[data-score-row]')).toHaveLength(rows.length)
  })
})

describe('playhead', () => {
  it('has a diamond', () => {
    draw({ currentMs: 0 })
    expect(host.querySelector('.ps-staff-playhead .ps-staff-playhead-diamond')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run** `npx vitest run components/playsense-studio/player/notation/renderers/__tests__/staff-renderer-n1.test.tsx` — Expected: FAIL (no `played`, no row groups, no diamond).

- [ ] **Step 3: Implement**
  - In `build()`, open a row group per system: keep `rowGroups: SVGGElement[]`; before drawing the first placement of system k call `ctx.closeGroup()` for the previous row (if any) and `const g = ctx.openGroup('ps-row') as SVGGElement; g.setAttribute('data-score-row', String(k))`. Close after the loop. Interlude placements still get an (empty) row group so row indices line up.
  - Draw each tie and each span segment inside its own `ctx.openGroup('ps-tie')` and move the result into the owning row (`rowGroups[system].appendChild(group)`): a same-row tie to its row, an outgoing half-tie to the first note's row, an incoming half-tie to the next note's row. Spans: look up the system of `seg.from ?? seg.to` in a `Map<StaveNote, number>` built from `placed`.
  - Repeat-count text is appended to its row group instead of the SVG root.
  - Create one `div.ps-staff-row[data-score-row=k]` (absolute, inset 0, `pointer-events:none`) per row inside `rendererDiv`; interludes mount into their row's div.
  - Replace `updateActiveNote` with `updateNoteStates()`:

```ts
private updateNoteStates(): void {
  if (!this.noteEls.length) return
  const inGap = this.lastPlaybackMs < 0 || this.lastPlaybackMs >= this.gapStartMs
  const { active, played } = this.lastPlaybackMs < 0 ? { active: -1, played: 0 } : noteStateAt(this.lastPlaybackMs, this.hits)
  const shownActive = this.cursorVisible && !inGap ? active : -1
  if (played === this.playedCount && shownActive === this.activeNoteIdx) return
  const lo = Math.min(played, this.playedCount), hi = Math.max(played, this.playedCount)
  for (let k = lo; k < hi; k++) this.noteEls[k]?.group?.setAttribute('data-note-state', k < played ? 'played' : 'upcoming')
  const prev = this.noteEls[this.activeNoteIdx]?.group
  if (prev) prev.setAttribute('data-note-state', this.activeNoteIdx < played ? 'played' : 'upcoming')
  this.noteEls[shownActive]?.group?.setAttribute('data-note-state', 'active')
  this.playedCount = played
  this.activeNoteIdx = shownActive
}
```

  - Hits carry `bar` (measure index) and `barEndX` (`placement.x + placement.width - 8`) so the playhead uses Task 2's bar tails.
  - Playhead: drop the inline 2px width/background/opacity values the CSS overrides; append `span.ps-staff-playhead-diamond`. In `applyLayout`, when the active beat index changes to a real beat and reduced motion is off: `this.diamondEl.animate([{ transform: 'rotate(45deg) scale(1.7)' }, { transform: 'rotate(45deg) scale(1)' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' })`. Guard `typeof el.animate === 'function'` (jsdom).
  - CSS:

```css
.ps-score-engraving [data-score-stave] { color:hsl(var(--playsense-studio-notation) / .24); }
.ps-score-engraving [data-score-note] { transition:color var(--dur-state) ease,opacity .3s ease,filter var(--dur-state) ease; }
.ps-score-engraving [data-score-note][data-note-state=played] { opacity:.4; }
.ps-score-engraving [data-score-note][data-note-state=active] { color:hsl(var(--primary)); filter:drop-shadow(0 0 6px hsl(var(--primary) / .45)); }
.ps-score-engraving [data-score-note] .vf-notehead { transform-box:fill-box; transform-origin:50% 55%; }
@media (prefers-reduced-motion:no-preference) {
  .ps-score-engraving [data-score-note][data-note-state=active] .vf-notehead { animation:ps-note-pop var(--dur-pop) var(--ease-spring) both; }
}
@keyframes ps-note-pop { 0% { transform:scale(1); } 40% { transform:scale(1.2); } 100% { transform:scale(1.06); } }
.ps-score-engraving .ps-staff-playhead { width:3px!important; margin-left:-1.5px; border-radius:3px; opacity:1; background:linear-gradient(180deg,hsl(var(--primary) / .15),hsl(var(--primary)) 30%,hsl(var(--primary)) 70%,hsl(var(--primary) / .15))!important; box-shadow:0 0 12px hsl(var(--primary) / .45); }
.ps-staff-playhead-diamond { position:absolute; top:-9px; left:50%; width:9px; height:9px; margin-left:-4.5px; border-radius:2px; background:hsl(var(--primary)); transform:rotate(45deg); }
.ps-score-engraving [data-score-row] { transition:opacity .35s var(--ease-out); }
```

  The pop scales only the note heads (and rest glyphs, which VexFlow also draws as `.vf-notehead`) so stems stay joined to their beams.

- [ ] **Step 4: Run** the new test and `npx vitest run components/playsense-studio lib/playsense-studio` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Group staff rows, add the played note state and the N1 playhead"`

---

### Task 4: Bar band, row bar numbers and the helpers

**Files:**
- Modify: `staff-renderer.tsx`, `staff-renderer.css`
- Test: `__tests__/staff-renderer-n1.test.tsx` (extend)

**Interfaces:**
- Consumes: `barCounts`, `noteLabel`, `isAttack` (Task 1); row divs (Task 3).
- Produces: new `StaffRendererProps.helpers?: { and: string; noteNames: NoteNameStyle } | false` (default `{ and: '&', noteNames: 'letters' }`; `false` hides all helpers). DOM: `.ps-staff-band` (one per renderer, in `rendererDiv`), `text[data-score-bar-number]` in each later row group, `.ps-staff-name[data-active]` chips, `.ps-staff-count[data-beat][data-active]`, `.ps-staff-next` ring.

- [ ] **Step 1: Write the failing tests** (append)

```tsx
describe('bar band and labels', () => {
  it('replaces the MEASURE labels with one band', () => {
    draw({ currentMs: 2500 })
    expect(host.textContent).not.toMatch(/MEASURE/)
    expect(host.querySelectorAll('.ps-staff-band')).toHaveLength(1)
  })
  it('numbers every row after the first', () => {
    draw({})
    const rows = host.querySelectorAll('svg > g[data-score-row]').length
    expect(host.querySelectorAll('[data-score-bar-number]')).toHaveLength(rows - 1)
  })
})

describe('helpers', () => {
  it('names each attack and lights the current one', () => {
    draw({ currentMs: 600 })
    const chips = [...host.querySelectorAll('.ps-staff-name')]
    expect(chips.slice(0, 4).map(c => c.textContent)).toEqual(['C', 'D', 'E', 'F'])
    expect(chips[1].getAttribute('data-active')).toBe('true')
  })
  it('uses solfege when asked', () => {
    draw({ helpers: { and: 'y', noteNames: 'solfege' } })
    expect(host.querySelector('.ps-staff-name')?.textContent).toBe('Do')
    expect([...host.querySelectorAll('.ps-staff-count')].slice(0, 2).map(c => c.textContent)).toEqual(['1', 'y'])
  })
  it('no chip under a tied continuation', () => {
    const tied = scale({}, () => [{ kind: 'note', midi: 60, durationQN: 2, tieToNext: true }, { kind: 'note', midi: 60, durationQN: 2 }])
    draw({ score: tied })
    expect(host.querySelectorAll('.ps-staff-name')).toHaveLength(4)
  })
  it('counts eighths under every bar', () => {
    draw({})
    expect(host.querySelectorAll('.ps-staff-count')).toHaveLength(32)
  })
  it('rings the next attack while playing', () => {
    draw({ currentMs: 600 })
    expect(host.querySelector('.ps-staff-next')?.hasAttribute('hidden')).toBe(false)
  })
  it('percussion shows no note names', async () => {
    const { CONGA_TUMBAO_FIXTURE } = await import('@/lib/playsense-studio/score-fixtures')
    draw({ score: CONGA_TUMBAO_FIXTURE })
    expect(host.querySelectorAll('.ps-staff-name')).toHaveLength(0)
    expect(host.querySelectorAll('.ps-staff-count').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run** the test file — Expected: FAIL on the new cases.
- [ ] **Step 3: Implement**
  - Delete the `measurePanels` / `measureProgressEl` / SVG `beatLabels` code and their CSS rules.
  - Vertical space (model units, per stave y): `helperTop = max(104, lowestHead + 16)`; names centre `helperTop + 10/scale`; counts centre `helperTop + (names ? 26 : 0)/scale + 8/scale`; `staffFootprint = countsCentre + 14/scale + 4`.
  - Band: `div.ps-staff-band` first child of `rendererDiv` (the SVG gets `position:relative` so it paints over it). On measure change set `transform: translate(x, y)` and `width` from the measure geometry (x inset 2, y from 26 model px above the top line to 26 below the bottom line, all × scale). When the row changes, set `transition:none`, write, force a reflow, then clear the inline transition so the band jumps rows instead of sliding diagonally. Hidden (`opacity:0`) when no measure is active.
  - Bar numbers: for every row after the first (and not an interlude row), an SVG `text[data-score-bar-number]` with the row's first measure number at `(x + 2, y + staffLineTop - 12)` in its row group.
  - Chips: for each voice-1 descriptor with `isAttack(prev, d)` and a non-percussion clef, a `span.ps-staff-name` in its row div at `left = noteheadCentreX × scale`, `top = namesCentre × scale`, label `noteLabel(topKey, style)` where `topKey` is the highest pitch (`keys.at(-1)`). Active while the attack (plus its tied continuations) sounds; `data-past` once it ended.
  - Counts: for each measure, `barCounts(block.cumulativeQN, block.timeSignature, and)`; ms via `qnToTrackMs`, x via `msToCursorPos(ms)` (so tails run to the barline). The current count is the last one at or before the playback time within its bar.
  - Beat pulse uses the current `beat` count (Task 3's diamond).
  - Ring: one `div.ps-staff-next` per renderer in `rendererDiv`, placed on the next attack of the current row (x = notehead centre, y = its highest head); hidden when none, when the cursor is hidden, or during interludes.
  - React wrapper: `helpers` default from `useTranslation()`: `{ and: t('staff.countAnd'), noteNames: locale === 'es' ? 'solfege' : 'letters' }`, falling back to `'&'` when the key is missing (no provider). Remount on a change of `helpers` value (compare by `and + noteNames`).
  - CSS (all `.ps-score-engraving` scoped):

```css
.ps-staff-band { position:absolute; top:0; left:0; border-radius:10px; background:hsl(var(--primary) / .07); pointer-events:none; opacity:0; transition:transform var(--dur-turn) var(--ease-out),width var(--dur-turn) var(--ease-out),opacity .3s; }
.ps-staff-name { position:absolute; transform:translate(-50%,-50%); min-width:20px; height:20px; padding:0 5px; border-radius:6px; display:grid; place-items:center; font:700 11px/1 var(--font-inter),system-ui,sans-serif; background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); transition:transform var(--dur-state) var(--ease-spring),background var(--dur-state),color var(--dur-state),opacity .3s; }
.ps-staff-name[data-active=true] { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); transform:translate(-50%,-50%) scale(1.18); }
.ps-staff-name[data-past=true] { opacity:.4; }
.ps-staff-count { position:absolute; transform:translate(-50%,-50%); font:600 11px/1 var(--font-inter),system-ui,sans-serif; color:hsl(var(--muted-foreground) / .75); transition:color var(--dur-tap),transform var(--dur-tap) var(--ease-spring); }
.ps-staff-count[data-beat=true] { font-weight:800; color:hsl(var(--muted-foreground)); }
.ps-staff-count[data-active=true] { color:hsl(var(--primary)); transform:translate(-50%,-50%) scale(1.3); }
.ps-staff-next { position:absolute; top:0; left:0; width:26px; height:26px; margin:-13px 0 0 -13px; border-radius:50%; border:2px solid hsl(var(--primary)); pointer-events:none; opacity:.6; }
@media (prefers-reduced-motion:no-preference) { .ps-staff-next { animation:ps-next-ring 1s var(--ease-out) infinite; } }
@keyframes ps-next-ring { 0% { transform:scale(.7); opacity:.9; } 100% { transform:scale(1.5); opacity:0; } }
svg [data-score-bar-number] { font:italic 400 11px Georgia,'Times New Roman',serif; fill:hsl(var(--muted-foreground))!important; stroke:none!important; }
```

- [ ] **Step 4: Run** the file and `npx vitest run components/playsense-studio lib/playsense-studio` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add the bar band, row bar numbers and the always-on staff helpers"`

---

### Task 5: Stacked follow and the paged layout

**Files:**
- Modify: `staff-renderer.tsx`, `staff-renderer.css`
- Test: `__tests__/staff-renderer-n1.test.tsx` (extend)

**Interfaces:**
- Consumes: `barsPerRow`, `rowStates`, `stackedFollowTarget`, `glide`, `pageTurn` (Task 1); `packLessonScoreRows(..., maxPerRow)` (Task 2).
- Produces: `StaffLayoutMode = 'scroll' | 'wrapped' | 'paged'`. Paged: `el.dataset.scoreLayoutMode = 'paged'`, row divs/groups carry `data-page-state="current" | "hidden"`.

- [ ] **Step 1: Write the failing tests** (append)

```tsx
describe('stacked', () => {
  it('marks past, now and next rows', () => {
    draw({ currentMs: 2500 })
    const rows = [...host.querySelectorAll('svg > g[data-score-row]')].map(r => r.getAttribute('data-row-state'))
    expect(rows[0]).toBe('past')
    expect(rows[1]).toBe('now')
  })
})

describe('paged', () => {
  it('shows only the current page', () => {
    draw({ layoutMode: 'paged', currentMs: 2500 })
    const pages = [...host.querySelectorAll('svg > g[data-score-row]')].map(r => r.getAttribute('data-page-state'))
    expect(pages.filter(p => p === 'current')).toHaveLength(1)
    expect(pages[1]).toBe('current')
  })
  it('draws every page at the same height (one row tall)', () => {
    draw({ layoutMode: 'paged' })
    const wrappedHeight = (() => { draw({ layoutMode: 'wrapped' }); return host.querySelector('svg')!.getAttribute('height') })()
    draw({ layoutMode: 'paged' })
    expect(Number(host.querySelector('svg')!.getAttribute('height'))).toBeLessThan(Number(wrappedHeight))
  })
  it('paged shows the interlude page before the music', () => {
    draw({ layoutMode: 'paged', currentMs: -500, leadingGapMs: 1000 })
    const current = host.querySelector('.ps-staff-row[data-page-state=current]')
    expect(current?.querySelector('.ps-notation-interlude')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**
  - `computePlan`: the wrapped and paged branches share the row packer with `maxPerRow = barsPerRow(el.clientWidth, this.scale)`. Paged sets every placement's `y = this.staveTop`, `systemPitch = 0`, `stageHeight = staveTop + staffFootprint`. Every place that derived a system from `g.y` uses a stored `system` on `measureGeoms` instead (no divide by `systemPitch`).
  - Paged hit testing: `systemFromY` returns the current page.
  - Paged viewport like scroll (fixed height, no scrollbars, `overflow:hidden`), `rendererDiv` relative, playhead in `rendererDiv`.
  - `applyLayout` for `'wrapped'` and `'paged'` shares the playhead/band/helper code; the only differences:
    - wrapped: compute the current row, set `data-row-state` on row groups/divs when it changes (`rowStates`), and set a glide target `stackedFollowTarget(row * systemPitch * scale, viewportHeight, stageHeight * scale)`. A private rAF loop (`startGlide()`) moves `viewport.scrollTop` with `glide(current, target, dt)` until it arrives; reduced motion or a rebuild jumps. Following stops when `autoFollow` is off. Horizontal `scrollLeft` keeps its existing row reading stops.
    - paged: the page is the row of `lastViewMs`. On change, `pageTurn(prev, next, reduced)`; mark the new page `current` and animate both the old and new row group + row div with WAAPI (`translateX(±offset%)` + opacity, `durationMs`, `cubic-bezier(.22,1,.36,1)`), hiding the old page when the animation finishes (and immediately when `kind === 'instant'`). Only one page is visible at rest.
  - CSS:

```css
.ps-score-engraving [data-page-state=hidden] { visibility:hidden; }
.ps-score-engraving[data-score-layout-mode=wrapped] [data-row-state=past] { opacity:.45; }
.ps-score-engraving[data-score-layout-mode=wrapped] [data-row-state=next] { opacity:.88; }
```

- [ ] **Step 4: Run** the file, `npx vitest run components/playsense-studio lib/playsense-studio`, and the Studio strip tests `npx vitest run components/playsense-studio/studio` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Glide stacked rows to the top and add the paged horizontal layout"`

---

### Task 6: Layout switch, lesson toolbar and watch player

**Files:**
- Create: `components/playsense-studio/player/notation/staff-layout-switch.tsx`
- Test: `components/playsense-studio/player/notation/__tests__/staff-layout-switch.test.tsx`
- Modify: `components/class-viewer/lesson-viewer/exercise-score.tsx`, `exercise-score.css`
- Modify (minimal): `components/playsense-studio/player/playsense-studio-player.tsx`
- Modify: `locales/en.json`, `locales/es.json` (new `staff` block, inserted by a node script)

**Interfaces:**
- Produces: `useStaffLayoutPreference(): [StaffLayoutChoice, (next: StaffLayoutChoice) => void]` (reads `STAFF_LAYOUT_KEY` after mount, writes on change, try/catch around storage); `staffLayoutMode(choice): 'wrapped' | 'paged'`; `<StaffLayoutSwitch value onChange />` (a two-button `role="group"` with `aria-pressed`, labels `t('staff.layout.stacked')` / `t('staff.layout.horizontal')`).
- i18n keys: `staff.countAnd` (`&` / `y`), `staff.layout.label`, `staff.layout.stacked`, `staff.layout.horizontal`, `staff.score`, `staff.bar`, `staff.barAria` (`Bar {bar} of {total}, beat {beat}`), `staff.pass` (`Pass {pass} / {total}`), `staff.follow`, `staff.followOn`, `staff.followOff`, `staff.smaller`, `staff.larger`, `staff.size`, `staff.scoreAria`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StaffLayoutSwitch, useStaffLayoutPreference } from '../staff-layout-switch'

let root: Root, host: HTMLDivElement
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

function Harness() {
  const [layout, setLayout] = useStaffLayoutPreference()
  return <><output>{layout}</output><StaffLayoutSwitch value={layout} onChange={setLayout} /></>
}

describe('staff layout preference', () => {
  it('defaults to stacked and persists a switch', () => {
    act(() => root.render(<Harness />))
    expect(host.querySelector('output')?.textContent).toBe('stacked')
    const [, horizontal] = host.querySelectorAll('button')
    act(() => horizontal.click())
    expect(host.querySelector('output')?.textContent).toBe('horizontal')
    expect(localStorage.getItem('lmm-staff-layout')).toBe('horizontal')
    expect(horizontal.getAttribute('aria-pressed')).toBe('true')
  })
  it('restores the saved choice', () => {
    localStorage.setItem('lmm-staff-layout', 'horizontal')
    act(() => root.render(<Harness />))
    expect(host.querySelector('output')?.textContent).toBe('horizontal')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run components/playsense-studio/player/notation/__tests__/staff-layout-switch.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement**
  - `staff-layout-switch.tsx` with the hook and the switch (lucide `Rows3` / `GalleryHorizontal` icons, text labels hidden under 700px).
  - `exercise-score.tsx`: replace the Steady/Flow group with `<StaffLayoutSwitch>`; the staff gets `layoutMode={staffLayoutMode(layout)}` and always the unrolled reading score (`exerciseReadingScore`) so passes read forward in both layouts; the Follow toggle shows only for stacked; the reading footer shows only for stacked. Strings go through `t('staff.*')`. HUD keeps the bar counter + beat dots (copy "Bar", per the lab).
  - `playsense-studio-player.tsx`: `const [notationChoice, setNotationChoice] = useStaffLayoutPreference()`; `staffLayout = layout === 'split' ? staffLayoutMode(notationChoice) : 'scroll'`; replace the local `NotationLayoutToggle` usage with `<StaffLayoutSwitch>` and delete the local toggle. The legacy stacked page layout keeps the continuous `scroll` + `flow` line and its scrub bar.
  - Locale keys via a node script that inserts only the `staff` block.
- [ ] **Step 4: Run** the new test, `npx vitest run components/class-viewer components/playsense-studio lib/playsense-studio`, `npx tsc --noEmit -p .`, `npx eslint <changed files>` — Expected: PASS / clean.
- [ ] **Step 5: Commit** — `git commit -m "Let students switch the staff between stacked and paged, and remember it"`

---

### Task 7: Phase check

- [ ] Full suite `npx vitest run`, `npx tsc --noEmit -p .`, eslint on changed files.
- [ ] Dev server on 3012; headless Chrome over CDP (port 9612) screenshots of `/playsense-preview/notation` and `/playsense-preview/score`: stacked and paged, dark and light, 1440×900 and 390×844, reduced motion. Temporarily point the notation preview at `paged` too if needed (not committed).
- [ ] Stop the dev server, `npm run build`.
- [ ] One fresh code reviewer (opus) over the branch diff with this Review Focus; fix Critical/Important findings test-first.

## Rulings recorded in this plan

- **Chord symbols:** the score model has no harmony field. `NoteBase.text` is free text that the engraver already draws as an italic annotation; it is not reliably a chord. N1 ships without a chord-symbol slot.
- **Bars per row is a cap:** `clamp(floor(w/(250·scale)),2,4)` caps the row, but a bar never shrinks below its readable width, so a narrow pane (phone) may show one bar per row.
- **Pop scales note heads only:** scaling the whole note group detaches stems from beams.
- **Note names in Spanish use solfege** (Do, Re, Mi…); the count's "and" is "y".
- **Percussion shows no note-name chips** (keys are staff positions, not pitches).
- **Chords show one chip, the top note.**
- **Watch player horizontal = paged**; the continuous `flow` line stays for the legacy stacked page layout.
- **The exercise staff reads the unrolled passes in both layouts** so a paged turn never slides backwards at a loop.
