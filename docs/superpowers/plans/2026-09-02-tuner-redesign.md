# Tuner Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/dashboard/tuner` with an MPM pitch engine in an AudioWorklet, instrument/tuning courses, manual string targeting, reference tones, a session log, and the approved prototype's layout.

**Architecture:** Pure, vitest-covered logic in `lib/tuner/` (engine, tracker, instruments, prefs, store). A plain-JS worklet in `public/audio-worklets/` runs the same `mpm` function off the main thread; `hooks/use-tuner-engine.ts` wires mic → worklet → tracker → external store. Small presentational components in `components/tuner/` subscribe to the store with `useSyncExternalStore`; the page owns prefs, targeting, and the session log.

**Tech Stack:** Next 16 / React 19, TypeScript, Tailwind (existing tokens), Radix Select/Popover, Lucide, Framer Motion, Web Audio (AudioWorklet), vitest (node env), zod.

**Spec:** `docs/superpowers/specs/2026-09-02-tuner-redesign-design.md`

## Global Constraints

- No new npm dependencies. No database changes.
- Every user-facing string via `useTranslation()` from `@/components/language-provider`, keys under `dashboard.pages.tuner` in BOTH `locales/en.json` and `locales/es.json`.
- `locales/*.json` are being edited by another session: modify only the `dashboard.pages.tuner` object with a targeted span replacement; never reformat or rewrite the whole file.
- Colors only from existing tokens: `text-primary`, `text-gold`, `text-terracotta`, `text-success`, `bg-card`, `bg-raised`, `bg-sunken`, `border-border`, `text-muted-foreground`, `font-heading`.
- `lib/tuner/**` must run in vitest `node` environment: no DOM, no Web Audio imports.
- `getUserMedia` audio constraints: `echoCancellation: false, noiseSuppression: false, autoGainControl: false`.
- Commit after each task; `git add` only the files listed in that task (the tree has unrelated changes from other sessions).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CqDWJxmwaJDXjogW3r6mnS
  ```

---

## File map

| Path | Responsibility |
|---|---|
| `lib/tuner/note-math.ts` | MIDI/Hz/cents math, note naming (letters/solfège), transposition |
| `lib/tuner/pitch-engine.ts` | `mpm()` McLeod Pitch Method (pure, plain-JS body) |
| `lib/tuner/pitch-tracker.ts` | `PitchTracker`: median → hysteresis → EMA → hold → lock |
| `lib/tuner/instruments.ts` | instruments, tunings, courses, nearest-course helpers |
| `lib/tuner/sensitivity.ts` | RMS/clarity presets |
| `lib/tuner/prefs.ts` | `TunerPrefs` schema, defaults, load/save |
| `lib/tuner/tuner-store.ts` | external store for per-frame values |
| `lib/tuner/__tests__/*.test.ts` | unit tests |
| `public/audio-worklets/pitch-detector-processor.js` | AudioWorklet processor (copy of `mpm`) |
| `hooks/use-tuner-engine.ts` | mic + worklet/fallback + tracker → store |
| `hooks/use-reference-tone.ts` | oscillator reference tones |
| `hooks/use-tuner-prefs.ts` | prefs state persisted to localStorage |
| `components/tuner/instrument-chips.tsx` | instrument tablist |
| `components/tuner/tuning-select.tsx` | tuning dropdown |
| `components/tuner/note-display.tsx` | glyph + written line + verdict pill |
| `components/tuner/tuning-meter.tsx` | canvas needle/strobe meter |
| `components/tuner/readouts.tsx` | cents + Hz readouts |
| `components/tuner/listen-button.tsx` | start/stop button + hint |
| `components/tuner/input-panel.tsx` | device select + status + level meter |
| `components/tuner/string-pads.tsx` | course pads (rewrite) |
| `components/tuner/reference-tone-card.tsx` | A4 + keyboard + octave |
| `components/tuner/session-card.tsx` | progress + log |
| `components/tuner/tuner-settings-popover.tsx` | settings |
| `components/tuner/tuner-tips.tsx` | tips strip + Play Sense link |
| `app/dashboard/tuner/page.tsx` | composition + state |
| Delete | `hooks/use-pitch-detection.ts`, `lib/tuner/tuner-utils.ts`, `components/tuner/{strobe-meter,note-readout,signal-waveform,tuner-settings,tuner-explainer}.tsx` |

Shared verdict helper (used by several components), lives in `note-math.ts`:
`verdictFor(cents: number, tol: number): 'ok' | 'warn' | 'bad'` → `|c| ≤ tol` ok, `≤ 15` warn, else bad.

---

### Task 1: note-math

**Files:**
- Create: `lib/tuner/note-math.ts`
- Test: `lib/tuner/__tests__/note-math.test.ts`

**Interfaces (produces):**
```ts
export type NoteNames = 'letters' | 'solfege'
export const LETTERS: readonly string[]  // 'C','C♯',…
export const SOLFEGE: readonly string[]  // 'Do','Do♯',…
export function midiToHz(midi: number, a4?: number): number
export function hzToMidiFloat(hz: number, a4?: number): number
export function centsBetween(hz: number, targetHz: number): number
export function nameToMidi(name: string): number          // 'E2' | 'F#4' | 'Bb3' | 'B0'
export function noteParts(midi: number, names: NoteNames): { base: string; acc: '' | '♯'; oct: number; pc: number }
export function noteLabel(midi: number, names: NoteNames): string   // 'F♯4' | 'Fa♯4'
export function verdictFor(cents: number, tol: number): 'ok' | 'warn' | 'bad'
export function formatCents(cents: number): string        // '+12' | '−3' | '0'
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/tuner/__tests__/note-math.test.ts
import { describe, it, expect } from 'vitest'
import { midiToHz, hzToMidiFloat, centsBetween, nameToMidi, noteParts, noteLabel, verdictFor, formatCents } from '../note-math'

describe('note-math', () => {
  it('maps A4 and E2 at 440 and 442', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6)
    expect(midiToHz(40)).toBeCloseTo(82.4069, 3)
    expect(midiToHz(69, 442)).toBe(442)
  })
  it('round-trips hz → midi', () => {
    expect(hzToMidiFloat(440)).toBeCloseTo(69, 9)
    expect(hzToMidiFloat(261.6256)).toBeCloseTo(60, 3)
  })
  it('computes signed cents', () => {
    expect(centsBetween(440, 440)).toBe(0)
    expect(centsBetween(443, 440)).toBeCloseTo(11.8, 1)
    expect(centsBetween(437, 440)).toBeLessThan(0)
  })
  it('parses note names with sharps, flats and low octaves', () => {
    expect(nameToMidi('E2')).toBe(40)
    expect(nameToMidi('F#4')).toBe(66)
    expect(nameToMidi('Bb3')).toBe(58)
    expect(nameToMidi('B0')).toBe(23)
  })
  it('splits parts in letters and solfège', () => {
    expect(noteParts(66, 'letters')).toEqual({ base: 'F', acc: '♯', oct: 4, pc: 6 })
    expect(noteParts(67, 'solfege')).toEqual({ base: 'Sol', acc: '', oct: 4, pc: 7 })
    expect(noteLabel(40, 'solfege')).toBe('Mi2')
    expect(noteLabel(61, 'letters')).toBe('C♯4')
  })
  it('classifies verdicts and formats cents', () => {
    expect(verdictFor(2.9, 3)).toBe('ok')
    expect(verdictFor(-8, 3)).toBe('warn')
    expect(verdictFor(30, 3)).toBe('bad')
    expect(formatCents(12.4)).toBe('+12')
    expect(formatCents(-2.6)).toBe('−3')
    expect(formatCents(0.2)).toBe('0')
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/tuner` → fails (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/tuner/note-math.ts
export type NoteNames = 'letters' | 'solfege'
export const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
export const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'] as const
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function midiToHz(midi: number, a4 = 440): number { return a4 * Math.pow(2, (midi - 69) / 12) }
export function hzToMidiFloat(hz: number, a4 = 440): number { return 69 + 12 * Math.log2(hz / a4) }
export function centsBetween(hz: number, targetHz: number): number { return 1200 * Math.log2(hz / targetHz) }
export function nameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim())
  if (!m) throw new Error(`Bad note name: ${name}`)
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (parseInt(m[3], 10) + 1) * 12 + PC[m[1].toUpperCase()] + acc
}
export function noteParts(midi: number, names: NoteNames) {
  const pc = ((midi % 12) + 12) % 12
  const raw = (names === 'solfege' ? SOLFEGE : LETTERS)[pc]
  const acc: '' | '♯' = raw.endsWith('♯') ? '♯' : ''
  return { base: acc ? raw.slice(0, -1) : raw, acc, oct: Math.floor(midi / 12) - 1, pc }
}
export function noteLabel(midi: number, names: NoteNames): string {
  const p = noteParts(midi, names); return `${p.base}${p.acc}${p.oct}`
}
export function verdictFor(cents: number, tol: number): 'ok' | 'warn' | 'bad' {
  const a = Math.abs(cents); return a <= tol ? 'ok' : a <= 15 ? 'warn' : 'bad'
}
export function formatCents(cents: number): string {
  const r = Math.round(cents); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r)
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add lib/tuner/note-math.ts lib/tuner/__tests__/note-math.test.ts && git commit -m "tuner: note math helpers"`

---

### Task 2: pitch-engine (MPM)

**Files:**
- Create: `lib/tuner/pitch-engine.ts`
- Test: `lib/tuner/__tests__/pitch-engine.test.ts`, helper `lib/tuner/__tests__/synth.ts`

**Interfaces (produces):**
```ts
export interface PitchReading { hz: number; clarity: number }
export const MPM_DEFAULTS = { minHz: 27, maxHz: 1400, kMax: 0.93, bufferSize: 4096 } as const
export function mpm(buf: Float32Array, sampleRate: number, minHz: number, maxHz: number, kMax: number): PitchReading | null
```
Rule: the body of `mpm` is plain JS (no type annotations inside the function; the signature carries types via a JSDoc-free wrapper: declare `function mpmImpl(buf, sampleRate, minHz, maxHz, kMax)` between `// @mpm-begin` and `// @mpm-end` markers with `// @ts-nocheck`-free code using only untyped params — TS infers `any`, which is allowed here via an explicit `/* eslint-disable @typescript-eslint/no-explicit-any */` on the file). Export `mpm` as a typed wrapper around `mpmImpl`. Task 6's test compares the text between the markers with the worklet's copy.

- [ ] **Step 1: Test helper**

```ts
// lib/tuner/__tests__/synth.ts
export function synth(hz: number, partials: number[] = [1, 0.5, 0.25], sr = 48000, n = 4096, amp = 0.5): Float32Array {
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    let v = 0
    partials.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * hz * (k + 1) * t) })
    b[i] = v * amp
  }
  return b
}
export function noise(n = 4096, amp = 0.3, seed = 1): Float32Array {
  let s = seed; const b = new Float32Array(n)
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; b[i] = ((s / 4294967296) * 2 - 1) * amp }
  return b
}
```

- [ ] **Step 2: Failing tests**

```ts
// lib/tuner/__tests__/pitch-engine.test.ts
import { describe, it, expect } from 'vitest'
import { mpm, MPM_DEFAULTS as D } from '../pitch-engine'
import { synth, noise } from './synth'
const run = (b: Float32Array) => mpm(b, 48000, D.minHz, D.maxHz, D.kMax)

describe('mpm', () => {
  it('finds G3 with harmonics', () => { const r = run(synth(196)); expect(r?.hz).toBeCloseTo(196, 0); expect(r!.clarity).toBeGreaterThan(0.9) })
  it('finds E1 even when harmonics dominate (no octave error)', () => {
    const r = run(synth(41.2, [0.5, 0.9, 0.7, 0.4])); expect(r?.hz).toBeCloseTo(41.2, 0)
  })
  it('finds E6', () => { expect(run(synth(1318.5, [1]))?.hz).toBeCloseTo(1318.5, 0) })
  it('finds A4 at 442 within 0.5 Hz', () => { expect(Math.abs(run(synth(442))!.hz - 442)).toBeLessThan(0.5) })
  it('returns null for silence and low clarity noise', () => {
    expect(run(new Float32Array(4096))).toBeNull()
    const r = run(noise()); expect(r === null || r.clarity < 0.6).toBe(true)
  })
})
```

- [ ] **Step 3: Run** — fails (module not found).

- [ ] **Step 4: Implement**

```ts
// lib/tuner/pitch-engine.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PitchReading { hz: number; clarity: number }
export const MPM_DEFAULTS = { minHz: 27, maxHz: 1400, kMax: 0.93, bufferSize: 4096 } as const

// @mpm-begin
// McLeod Pitch Method: normalized square difference + key-max peak picking.
// Plain JS on purpose: this block is copied verbatim into
// public/audio-worklets/pitch-detector-processor.js (guarded by a test).
function mpmImpl(buf: any, sampleRate: any, minHz: any, maxHz: any, kMax: any): any {
  const n = buf.length
  const maxTau = Math.min(n >> 1, Math.floor(sampleRate / minHz))
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz))
  const W = n - maxTau
  const prefix = new Float32Array(n + 1)
  const nsdf = new Float32Array(maxTau + 2)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + buf[i] * buf[i]
  if (prefix[n] === 0) return null
  for (let tau = 1; tau <= maxTau; tau++) {
    let r = 0
    for (let i = 0; i < W; i++) r += buf[i] * buf[i + tau]
    const m = prefix[W] + (prefix[W + tau] - prefix[tau])
    nsdf[tau] = m > 0 ? (2 * r) / m : 0
  }
  let tau = 1
  while (tau < maxTau && nsdf[tau] > 0) tau++
  const peaks = []
  let inPeak = false, pMax = 0, pTau = 0
  for (; tau < maxTau; tau++) {
    const v = nsdf[tau]
    if (v > 0) {
      if (!inPeak) { inPeak = true; pMax = v; pTau = tau }
      else if (v > pMax) { pMax = v; pTau = tau }
    } else if (inPeak) { if (pTau >= minTau) peaks.push([pTau, pMax]); inPeak = false }
  }
  if (inPeak && pTau >= minTau) peaks.push([pTau, pMax])
  if (!peaks.length) return null
  let g = 0
  for (let i = 0; i < peaks.length; i++) if (peaks[i][1] > g) g = peaks[i][1]
  const thr = kMax * g
  let chosen = peaks[0]
  for (let i = 0; i < peaks.length; i++) if (peaks[i][1] >= thr) { chosen = peaks[i]; break }
  const t = chosen[0]
  const a = nsdf[t - 1], b = nsdf[t], c = nsdf[t + 1]
  const d = a - 2 * b + c
  const shift = d !== 0 ? (0.5 * (a - c)) / d : 0
  return { hz: sampleRate / (t + shift), clarity: b }
}
// @mpm-end

export function mpm(buf: Float32Array, sampleRate: number, minHz: number, maxHz: number, kMax: number): PitchReading | null {
  return mpmImpl(buf, sampleRate, minHz, maxHz, kMax)
}
```
Note: the worklet copy strips the `: any` annotations; Task 6's sync test normalizes both texts by removing `: any` before comparing.

- [ ] **Step 5: Run tests** — PASS.
- [ ] **Step 6: Commit** — `git add lib/tuner/pitch-engine.ts lib/tuner/__tests__/pitch-engine.test.ts lib/tuner/__tests__/synth.ts && git commit -m "tuner: MPM pitch engine"`

---

### Task 3: pitch-tracker

**Files:**
- Create: `lib/tuner/pitch-tracker.ts`
- Test: `lib/tuner/__tests__/pitch-tracker.test.ts`

**Interfaces (produces):**
```ts
export interface TunerFrame { hz: number; midi: number; cents: number; clarity: number; held: boolean; locked: boolean; justLocked: boolean }
export interface TrackOptions { holdMs: number; tolCents: number; targetMidi: number | null }
export class PitchTracker {
  push(reading: PitchReading | null, nowMs: number, a4: number, o: TrackOptions): TunerFrame | null
  reset(): void
}
```
Constants: median window 5, hysteresis 3 frames or > 1.5 semitones, EMA α 0.4, lock after 450 ms.

- [ ] **Step 1: Failing tests**

```ts
// lib/tuner/__tests__/pitch-tracker.test.ts
import { describe, it, expect } from 'vitest'
import { PitchTracker } from '../pitch-tracker'
import { midiToHz } from '../note-math'
const O = { holdMs: 1000, tolCents: 3, targetMidi: null }
const feed = (t: PitchTracker, midiF: number, n: number, start = 0, step = 33) => {
  let f = null; for (let i = 0; i < n; i++) f = t.push({ hz: midiToHz(midiF), clarity: 0.95 }, start + i * step, 440, O); return f!
}

describe('PitchTracker', () => {
  it('reports note and cents', () => {
    const f = feed(new PitchTracker(), 40 - 0.2, 6)
    expect(f.midi).toBe(40); expect(f.cents).toBeCloseTo(-20, 0); expect(f.held).toBe(false)
  })
  it('ignores two stray frames but switches after three', () => {
    const t = new PitchTracker(); feed(t, 40, 6)
    t.push({ hz: midiToHz(41), clarity: 0.95 }, 300, 440, O)
    const two = t.push({ hz: midiToHz(41), clarity: 0.95 }, 333, 440, O)
    expect(two!.midi).toBe(40)
    feed(t, 41, 4, 366)
    expect(t.push({ hz: midiToHz(41), clarity: 0.95 }, 600, 440, O)!.midi).toBe(41)
  })
  it('holds the last frame within holdMs then clears', () => {
    const t = new PitchTracker(); feed(t, 45, 6)
    const held = t.push(null, 500, 440, O); expect(held?.held).toBe(true); expect(held?.midi).toBe(45)
    expect(t.push(null, 1300, 440, O)).toBeNull()
  })
  it('locks after 450ms in the window, justLocked once', () => {
    const t = new PitchTracker(); const frames = []
    for (let i = 0; i < 20; i++) frames.push(t.push({ hz: midiToHz(45.01), clarity: 0.95 }, i * 50, 440, O)!)
    expect(frames[5].locked).toBe(false)
    expect(frames.filter((f) => f.justLocked).length).toBe(1)
    expect(frames[19].locked).toBe(true)
  })
  it('pins the note in manual mode and allows cents beyond ±50', () => {
    const t = new PitchTracker()
    const f = feed(t, 39, 6) // sounding D#2 while targeting E2
    const m = t.push({ hz: midiToHz(39), clarity: 0.95 }, 300, 440, { ...O, targetMidi: 40 })
    expect(m!.midi).toBe(40); expect(m!.cents).toBeLessThan(-50)
    expect(f.midi).toBe(39)
  })
})
```

- [ ] **Step 2: Run** — fails.

- [ ] **Step 3: Implement**

```ts
// lib/tuner/pitch-tracker.ts
import type { PitchReading } from './pitch-engine'
import { hzToMidiFloat } from './note-math'

export interface TunerFrame { hz: number; midi: number; cents: number; clarity: number; held: boolean; locked: boolean; justLocked: boolean }
export interface TrackOptions { holdMs: number; tolCents: number; targetMidi: number | null }

const MEDIAN = 5, HYSTERESIS_FRAMES = 3, JUMP_SEMITONES = 1.5, EMA = 0.4, LOCK_MS = 450

export class PitchTracker {
  private hist: number[] = []
  private stable: number | null = null
  private cand: number | null = null
  private candN = 0
  private ema: number | null = null
  private last: TunerFrame | null = null
  private lastT = 0
  private lockSince = 0
  private locked = false
  private lockedFor: number | null = null

  reset(): void {
    this.hist = []; this.stable = null; this.cand = null; this.candN = 0; this.ema = null
    this.last = null; this.lastT = 0; this.lockSince = 0; this.locked = false; this.lockedFor = null
  }

  push(reading: PitchReading | null, nowMs: number, a4: number, o: TrackOptions): TunerFrame | null {
    if (!reading) {
      if (this.last && nowMs - this.lastT < o.holdMs) return { ...this.last, held: true, locked: false, justLocked: false }
      this.reset(); return null
    }
    this.hist.push(reading.hz); if (this.hist.length > MEDIAN) this.hist.shift()
    const med = [...this.hist].sort((x, y) => x - y)[this.hist.length >> 1]
    const mf = hzToMidiFloat(med, a4)
    let midi = Math.round(mf)
    if (o.targetMidi != null) { if (this.stable !== o.targetMidi) this.ema = null; this.stable = o.targetMidi }
    else if (this.stable == null) this.stable = midi
    else if (midi !== this.stable) {
      if (this.cand === midi) this.candN++; else { this.cand = midi; this.candN = 1 }
      if (this.candN >= HYSTERESIS_FRAMES || Math.abs(mf - this.stable) > JUMP_SEMITONES) {
        this.stable = midi; this.ema = null; this.lockSince = 0; this.locked = false; this.lockedFor = null; this.cand = null; this.candN = 0
      }
    } else { this.cand = null; this.candN = 0 }
    const raw = (mf - this.stable) * 100
    this.ema = this.ema == null ? raw : this.ema + (raw - this.ema) * EMA
    const cents = this.ema
    let justLocked = false
    if (Math.abs(cents) <= o.tolCents) {
      if (!this.lockSince) this.lockSince = nowMs
      if (!this.locked && nowMs - this.lockSince >= LOCK_MS) { this.locked = true; justLocked = this.lockedFor !== this.stable; this.lockedFor = this.stable }
    } else { this.lockSince = 0; this.locked = false }
    this.last = { hz: med, midi: this.stable, cents, clarity: reading.clarity, held: false, locked: this.locked, justLocked }
    this.lastT = nowMs
    return this.last
  }
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git add lib/tuner/pitch-tracker.ts lib/tuner/__tests__/pitch-tracker.test.ts && git commit -m "tuner: pitch tracker with hysteresis, hold and lock"`

---

### Task 4: instruments + sensitivity

**Files:**
- Create: `lib/tuner/instruments.ts`, `lib/tuner/sensitivity.ts`
- Test: `lib/tuner/__tests__/instruments.test.ts`

**Interfaces (produces):**
```ts
export type InstrumentId = 'guitar' | 'bass' | 'tres' | 'cuatro' | 'ukulele' | 'violin' | 'chromatic'
export interface Tuning { id: string; nameKey: string; courses: string[][] }   // nameKey under dashboard.pages.tuner.tunings
export interface Instrument { id: InstrumentId; nameKey: string; tunings: Tuning[] }
export const TUNER_INSTRUMENTS: Instrument[]
export function getInstrument(id: InstrumentId): Instrument
export function getTuning(inst: Instrument, tuningId: string): Tuning   // falls back to first
export function courseMidis(t: Tuning): number[][]
export function targetMidis(t: Tuning): number[]                        // unique, sorted
export function nearestCourse(courses: number[][], hz: number, a4: number): number   // index or -1
export function courseTargetMidi(course: number[], hz: number | null, a4: number): number
export const AUTO_HIGHLIGHT_CENTS = 75
// sensitivity.ts
export type Sensitivity = 'low' | 'med' | 'high'
export const SENSITIVITY_PRESETS: Record<Sensitivity, { rms: number; clarity: number }>
```
Data (verbatim from spec): guitar standard/dropd/half/dadgad/openg; bass standard/five/dropd; tres do/re; cuatro pr; ukulele std/lowg; violin std; chromatic any (courses `[]`). Tuning nameKeys: `guitar.standard`, `guitar.dropD`, `guitar.halfDown`, `guitar.dadgad`, `guitar.openG`, `bass.standard`, `bass.five`, `bass.dropD`, `tres.do`, `tres.re`, `cuatro.pr`, `ukulele.standard`, `ukulele.lowG`, `violin.standard`, `chromatic.any`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { TUNER_INSTRUMENTS, getInstrument, getTuning, courseMidis, targetMidis, nearestCourse, courseTargetMidi } from '../instruments'
import { SENSITIVITY_PRESETS } from '../sensitivity'
import { midiToHz } from '../note-math'

describe('instruments', () => {
  it('every course name parses', () => {
    for (const i of TUNER_INSTRUMENTS) for (const t of i.tunings) expect(() => courseMidis(t)).not.toThrow()
  })
  it('tres afinación en Do has an octave course', () => {
    const t = getTuning(getInstrument('tres'), 'do'); expect(courseMidis(t)[0]).toEqual([55, 67])
    expect(targetMidis(t)).toEqual([55, 60, 64, 67])
  })
  it('picks the nearest course and the nearer note in an octave course', () => {
    const c = courseMidis(getTuning(getInstrument('tres'), 'do'))
    expect(nearestCourse(c, midiToHz(66.8), 440)).toBe(0)
    expect(courseTargetMidi(c[0], midiToHz(66.8), 440)).toBe(67)
    expect(courseTargetMidi(c[0], null, 440)).toBe(55)
  })
  it('falls back to the first tuning for an unknown id', () => {
    expect(getTuning(getInstrument('guitar'), 'nope').id).toBe('standard')
  })
  it('exposes three sensitivity presets', () => {
    expect(SENSITIVITY_PRESETS.med).toEqual({ rms: 0.01, clarity: 0.88 })
  })
})
```

- [ ] **Step 2: Run** — fails. **Step 3: Implement** the data tables and helpers (nearestCourse = min |cents| over all notes of all courses; courseTargetMidi = note in the course minimizing |cents|, first note when hz null). **Step 4: PASS.**
- [ ] **Step 5: Commit** — `git add lib/tuner/instruments.ts lib/tuner/sensitivity.ts lib/tuner/__tests__/instruments.test.ts && git commit -m "tuner: instruments, tunings, sensitivity presets"`

---

### Task 5: prefs + store

**Files:**
- Create: `lib/tuner/prefs.ts`, `lib/tuner/tuner-store.ts`
- Test: `lib/tuner/__tests__/prefs.test.ts`, `lib/tuner/__tests__/tuner-store.test.ts`

**Interfaces (produces):**
```ts
// prefs.ts
export const PREFS_KEY = 'lmm-tuner-prefs'
export const tunerPrefsSchema = z.object({ instrument, tuning: z.string(), a4: z.number().int().min(415).max(466), sensitivity, tolerance: z.union([z.literal(1), z.literal(3), z.literal(5)]), names, transpose: z.union([0,2,7,9]), holdSec: z.union([0,1,2]), meter: z.enum(['needle','strobe']) })
export type TunerPrefs = z.infer<typeof tunerPrefsSchema>
export const DEFAULT_PREFS: TunerPrefs   // guitar/standard/440/med/3/letters/0/1/needle
export function parsePrefs(raw: string | null): TunerPrefs     // invalid → DEFAULT_PREFS (partial objects merge over defaults)
export function loadPrefs(storage: Pick<Storage,'getItem'> | null): TunerPrefs
export function savePrefs(storage: Pick<Storage,'setItem'> | null, p: TunerPrefs): void   // swallows errors
// tuner-store.ts
export interface TunerSnapshot { frame: TunerFrame | null; level: number; clip: boolean }
export function createTunerStore(): { getSnapshot(): TunerSnapshot; subscribe(cb: () => void): () => void; set(next: TunerSnapshot): void; reset(): void }
export const EMPTY_SNAPSHOT: TunerSnapshot
```

- [ ] **Step 1: Failing tests**

```ts
// prefs.test.ts
import { describe, it, expect } from 'vitest'
import { parsePrefs, DEFAULT_PREFS, loadPrefs, savePrefs } from '../prefs'
describe('prefs', () => {
  it('returns defaults for null, garbage and wrong shapes', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ a4: 9999 }))).toEqual(DEFAULT_PREFS)
  })
  it('merges a partial object over defaults', () => {
    expect(parsePrefs(JSON.stringify({ a4: 442, names: 'solfege' }))).toEqual({ ...DEFAULT_PREFS, a4: 442, names: 'solfege' })
  })
  it('loads and saves through a storage-like object, swallowing errors', () => {
    const mem: Record<string, string> = {}
    savePrefs({ setItem: (k, v) => { mem[k] = v } }, { ...DEFAULT_PREFS, a4: 441 })
    expect(loadPrefs({ getItem: (k) => mem[k] ?? null }).a4).toBe(441)
    expect(() => savePrefs({ setItem: () => { throw new Error('quota') } }, DEFAULT_PREFS)).not.toThrow()
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS)
  })
})
// tuner-store.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createTunerStore, EMPTY_SNAPSHOT } from '../tuner-store'
describe('tuner-store', () => {
  it('notifies subscribers and returns stable snapshots', () => {
    const s = createTunerStore(); const cb = vi.fn(); const off = s.subscribe(cb)
    const next = { ...EMPTY_SNAPSHOT, level: 0.5 }; s.set(next)
    expect(cb).toHaveBeenCalledTimes(1); expect(s.getSnapshot()).toBe(next)
    off(); s.reset(); expect(cb).toHaveBeenCalledTimes(1); expect(s.getSnapshot()).toBe(EMPTY_SNAPSHOT)
  })
})
```

- [ ] **Step 2: Run** — fails. **Step 3: Implement.** **Step 4: PASS.**
- [ ] **Step 5: Commit** — `git add lib/tuner/prefs.ts lib/tuner/tuner-store.ts lib/tuner/__tests__/prefs.test.ts lib/tuner/__tests__/tuner-store.test.ts && git commit -m "tuner: prefs schema and frame store"`

---

### Task 6: AudioWorklet processor + sync test

**Files:**
- Create: `public/audio-worklets/pitch-detector-processor.js`
- Test: `lib/tuner/__tests__/worklet-sync.test.ts`

Processor contract: `registerProcessor('pitch-detector-processor', …)`. Config defaults `{ rms: 0.01, clarity: 0.88, minHz: 27, maxHz: 1400, kMax: 0.93, bufferSize: 4096, hop: 1024 }`; `port.onmessage` handles `{ type: 'config', rms?, clarity? }`. Ring buffer of `bufferSize`; every `hop` new samples: assemble a linear 4096 window (oldest → newest), compute `rms` and `peak`; if `rms >= config.rms` run `mpm`; post `{ hz: number|null, clarity: number, rms, peak }` where `hz` is null when gated or `clarity < config.clarity`. `process()` returns `true` always; copies `inputs[0][0]` (mono) when present.

- [ ] **Step 1: Failing sync test**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const between = (s: string) => s.split('// @mpm-begin')[1].split('// @mpm-end')[0]
const norm = (s: string) => s.replace(/: any/g, '').replace(/\s+/g, ' ').trim()
describe('worklet sync', () => {
  it('worklet mpm equals lib mpm', () => {
    const lib = readFileSync(path.resolve(__dirname, '../pitch-engine.ts'), 'utf8')
    const wk = readFileSync(path.resolve(__dirname, '../../../public/audio-worklets/pitch-detector-processor.js'), 'utf8')
    expect(norm(between(wk))).toBe(norm(between(lib)))
  })
})
```

- [ ] **Step 2: Run** — fails (worklet missing). **Step 3: Write the worklet** (copy the marker block verbatim minus `: any`). **Step 4: PASS.**
- [ ] **Step 5: Commit** — `git add public/audio-worklets/pitch-detector-processor.js lib/tuner/__tests__/worklet-sync.test.ts && git commit -m "tuner: pitch detector AudioWorklet"`

---

### Task 7: engine + reference-tone + prefs hooks

**Files:**
- Create: `hooks/use-tuner-engine.ts`, `hooks/use-reference-tone.ts`, `hooks/use-tuner-prefs.ts`

**Interfaces (produces):**
```ts
// use-tuner-engine.ts
export type EngineStatus = 'idle' | 'starting' | 'listening' | 'error'
export type EngineErrorKind = 'denied' | 'notfound' | 'busy' | 'unsupported' | 'unknown'
export interface AudioDevice { id: string; label: string }
export function useTunerEngine(opts: { a4: number; holdMs: number; tolCents: number; sensitivity: Sensitivity; targetMidi: number | null; onFrame?: (f: TunerFrame) => void }): {
  status: EngineStatus; errorKind: EngineErrorKind | null; devices: AudioDevice[]; deviceId: string | null; deviceLabel: string
  start: (deviceId?: string) => Promise<void>; stop: () => void; setDevice: (id: string) => void; resetTracker: () => void
  store: TunerStore; getAudioContext: () => AudioContext
}
export function useTunerFrame(store: TunerStore): TunerSnapshot   // useSyncExternalStore wrapper
// use-reference-tone.ts
export function useReferenceTone(getCtx: () => AudioContext): { play: (hz: number) => void; stop: () => void; playing: boolean; playingHz: number | null }
// use-tuner-prefs.ts
export function useTunerPrefs(): [TunerPrefs, (patch: Partial<TunerPrefs>) => void]   // loads once on mount, saves on change
```
Engine details: opts are mirrored into refs so the message handler always reads fresh values; the worklet path uses `audioContext.audioWorklet.addModule('/audio-worklets/pitch-detector-processor.js')` then `new AudioWorkletNode(ctx, 'pitch-detector-processor')`; on failure fall back to `AnalyserNode` (fftSize 4096) polled with `requestAnimationFrame` throttled to 33 ms using `mpm` from `lib/tuner/pitch-engine`. Level = `min(1, rms * 9)` smoothed 50/50; clip = `peak > 0.98`. `visibilitychange`: if hidden for 60 s while listening → `stop()`. Cleanup on unmount. `onFrame` is called for every non-null frame (page uses `justLocked`).

- [ ] **Step 1: Implement all three hooks.** No unit tests (browser APIs); verified in Task 13.
- [ ] **Step 2: `npx tsc --noEmit -p tsconfig.json` clean for these files; `npx eslint hooks/use-tuner-engine.ts hooks/use-reference-tone.ts hooks/use-tuner-prefs.ts` clean.**
- [ ] **Step 3: Commit** — `git add hooks/use-tuner-engine.ts hooks/use-reference-tone.ts hooks/use-tuner-prefs.ts && git commit -m "tuner: engine, reference tone and prefs hooks"`

---

### Task 8: i18n keys

**Files:**
- Modify: `locales/en.json` (`dashboard.pages.tuner` object only), `locales/es.json` (same)

Replace the `"tuner": { … }` object under `dashboard.pages` via a script that finds the exact span (brace matching from the `"tuner": {` that follows `"pages": {`) and substitutes new JSON text, leaving every other byte untouched. New key tree (values in en; es translated):

```
title, subtitle, brand ("LMM Tuner"),
instruments: { guitar, bass, tres ("Tres cubano"), cuatro, ukulele, violin, chromatic }
tunings: { guitar: {standard, dropD, halfDown, dadgad, openG}, bass: {standard, five, dropD}, tres: {do, re}, cuatro: {pr}, ukulele: {standard, lowG}, violin: {standard}, chromatic: {any} }
status: { ready, listening, inTune, slightlyFlat, slightlySharp, flat, sharp }
readout: { cents, detected, target ("target {hz} Hz"), tighten ("tighten to raise"), loosen ("loosen to lower"), hold ("hold it there"), locked ("locked in"), overFlat ("more than 50¢ flat"), overSharp }
written: { sounds ("Sounds {note} at concert pitch"), tuningTo ("Tuning to {notes}"), holding ("holding last note") }
listen: { start ("Start tuning"), stop ("Listening… tap to stop"), hintIdle, hintLive }
input: { label ("Input"), defaultDevice ("Default microphone"), off, offHelp ("Nothing is recorded or uploaded. Audio stays on this device."), on, onHelp ("{device} · audio never leaves this device"), unavailable }
strings: { title ("Open strings"), auto, manual, inTune, done, chromaticHint, play ("Play this string") }
errors: { denied, notFound, busy, unsupported, unknown, tryAgain }
meter: { needle, strobe, flat, sharp }
settings: { title, sensitivity, sensitivityHelp, low, med, high, window, windowHelp, names, namesHelp, letters ("C D E"), solfege ("Do Re Mi"), transpose, transposeHelp, concert, hold, holdHelp, off }
reference: { title ("Reference tone"), a4 ("A4 frequency"), lower, raise, play ("Play {note}"), stop ("Stop {note}"), octave, help }
session: { title ("This session"), clear, progress ("{done}/{total} strings in tune"), allSet ("all set"), notesLocked ("{count} notes locked in tune"), empty ("Notes you lock in tune show up here."), justNow, secondsAgo ("{n}s ago"), minutesAgo ("{n} min ago"), hoursAgo ("{n} h ago") }
tips: { meterTitle, meterBody, centsTitle, centsBody, orderTitle, orderBody, keepPracticing, openPlaySense }
```
Remove old keys `chromatic, chromaticHint, openStrings, target, startTuner, stopTuner, micAccessDenied, micAccessHelp, micError, tryAgain, signal.*, guide.*, settings.reference*, settings.sensitivityLevels` (they only had tuner callers). Check with `grep -rn "pages.tuner" app components --include=*.tsx` that nothing outside the tuner uses them (the sidebar uses `dashboard.nav.tuner`, not this block).

- [ ] **Step 1: Write the replacement script (scratchpad), run it, `node -e "require('./locales/en.json'); require('./locales/es.json')"` to validate JSON.**
- [ ] **Step 2: `git diff --stat locales/` shows only the tuner block changed beyond the other session's pre-existing edits** (compare against `git diff` taken before the edit).
- [ ] **Step 3: Commit only the hunks in the tuner block** — `git add -p` is interactive and unavailable; instead: the other session's edits are in *other* keys, so stage with `git add locales/en.json locales/es.json` is NOT acceptable. Use `git diff locales/en.json > pre.patch` before editing; after editing, produce the tuner-only patch with `git diff` limited by `--function-context`? Simplest reliable method: write the tuner block change, then `git stash push -- locales/` is forbidden (other session). **Decision:** do not commit locale files separately; commit them in Task 12 together with the page once the other session's hunks are checked, and note in the commit message that only the `dashboard.pages.tuner` block is intended. If unrelated hunks are still present at Task 12, ask the user before committing the locale files.

---

### Task 9: Components A — chips, tuning select, note display, readouts, listen button

**Files:**
- Create: `components/tuner/instrument-chips.tsx`, `components/tuner/tuning-select.tsx`, `components/tuner/note-display.tsx`, `components/tuner/readouts.tsx`, `components/tuner/listen-button.tsx`

**Interfaces (produces):**
```tsx
<InstrumentChips value: InstrumentId onChange(id) />
<TuningSelect instrument: Instrument value: string onChange(id) />            // returns null when < 2 tunings
<NoteDisplay frame: TunerFrame|null active: boolean names: NoteNames transpose: number tol: number a4: number manualCourse: number[]|null />
<Readouts frame a4 tol />
<ListenButton status: EngineStatus onToggle() hint: 'idle'|'live' />
```
Styling from the prototype: chips `h-[34px] rounded-[9px] border bg-raised text-muted-foreground`, selected `border-primary text-primary bg-primary/10`; glyph `font-heading font-black tracking-[-0.04em] text-[108px] sm:text-[140px]`, ok → `text-success`, otherwise `text-foreground`, held → `opacity-55`; pill `rounded-full border px-3.5 h-[30px] text-[12px] font-semibold uppercase tracking-[0.08em]` with ok `bg-success/15 text-success border-success/35`, warn `bg-primary/15 text-primary border-primary/35`, bad `bg-terracotta/15 text-terracotta border-terracotta/40`, idle `bg-raised text-muted-foreground border-border`. Listen button: `h-12 min-w-[260px] rounded-xl font-heading font-bold text-[13px] uppercase tracking-[0.12em] bg-gradient-to-b from-[hsl(var(--gold-highlight))] to-[hsl(38_58%_48%)] text-[#1C1405] shadow-[0_10px_30px_-12px_hsl(var(--gold-highlight)/0.7)]`; live: `bg-raised text-foreground border border-border` with a pulsing terracotta dot (Framer Motion, disabled under reduced motion).

- [ ] **Step 1: Implement the five components.** Use `AnimatePresence` for the glyph key change (spring 320/24) like today's `note-readout.tsx`.
- [ ] **Step 2: `npx tsc --noEmit` + `npx eslint components/tuner` clean.**
- [ ] **Step 3: Commit** — `git add components/tuner/instrument-chips.tsx components/tuner/tuning-select.tsx components/tuner/note-display.tsx components/tuner/readouts.tsx components/tuner/listen-button.tsx && git commit -m "tuner: note display, readouts, chips, listen button"`

---

### Task 10: Components B — meter, input panel, string pads

**Files:**
- Create: `components/tuner/tuning-meter.tsx`, `components/tuner/input-panel.tsx`
- Rewrite: `components/tuner/string-pads.tsx`

**Interfaces (produces):**
```tsx
<TuningMeter store: TunerStore mode: 'needle'|'strobe' tol: number onModeChange(m) />
<InputPanel status devices deviceId deviceLabel onDeviceChange(id) store errorKind onRetry() />
<StringPads courses: number[][] tuningName: string auto: boolean manual: number|null onSelect(i|null) done: Set<number> store a4 tol names onPlay(i) playingCourse: number|null />
```
Meter: canvas reads `store.getSnapshot()` inside its own rAF loop (no React re-render). Needle easing `needle += (target − needle) × min(1, dt × 14)`; colour from `verdictFor(needle, tol)`; glow eased `dt × 8`; ticks every 2 cents (major at 10, tall at 0/±50); zone bar gradient terracotta→primary→success; in-tune window fill; needle line + triangle head with `shadowBlur`; >50 cents overflow text. Strobe: bands at y 8/46, stripe widths 28 and 7, phase advances `(cents/50) × 260 px/s`, frozen when `|needle| ≤ tol`. Colours via `getComputedStyle(root).getPropertyValue('--success')` etc. → `hsl(${v})`, cached 400 ms. Reduced motion: no easing, no strobe motion. Mode toggle sits top-right (two small buttons).

Input panel: 10-segment level bars (heights 6→22 px), last three `hot`; `clip` → all red. Status icon/text by `status` and `errorKind`; error state shows the i18n error and a Try again button.

String pads: pad per course; sub-label `G3 · G4` for doubled courses; `near` (auto and within `AUTO_HIGHLIGHT_CENTS`, else manual index), `target` (manual), `done`; deviation text `♭ 12¢` / `♯ 4¢` / `in tune`; play button `absolute top-1.5 right-1.5`, visible on hover/focus and while playing. Pad click toggles manual select; Auto/Manual segmented control in the header row. Chromatic (no courses) renders the dashed hint instead.

- [ ] **Step 1: Implement.** **Step 2: tsc + eslint clean.**
- [ ] **Step 3: Commit** — `git add components/tuner/tuning-meter.tsx components/tuner/input-panel.tsx components/tuner/string-pads.tsx && git commit -m "tuner: meter canvas, input panel, string pads"`

---

### Task 11: Components C — reference tone, session, settings, tips

**Files:**
- Create: `components/tuner/reference-tone-card.tsx`, `components/tuner/session-card.tsx`, `components/tuner/tuner-settings-popover.tsx`, `components/tuner/tuner-tips.tsx`

**Interfaces (produces):**
```tsx
<ReferenceToneCard a4 onA4Change(n) names refPc: number refOct: number onRefChange(pc, oct) playing: boolean onToggle() />
export interface LogEntry { id: number; midi: number; hz: number; cents: number; t: number }
<SessionCard courses: number[][] done: Set<number> log: LogEntry[] names transpose tol onClear() />
<TunerSettingsPopover prefs: TunerPrefs onChange(patch) />     // Radix Popover; trigger is the sliders icon button
<TunerTips />                                                   // three tips + Link to /dashboard/play-sense
```
Session card: "time ago" re-renders every 15 s via a `useEffect` interval; progress bar `bg-success`; chromatic shows `notesLocked`.

- [ ] **Step 1: Implement.** **Step 2: tsc + eslint clean.**
- [ ] **Step 3: Commit** — `git add components/tuner/reference-tone-card.tsx components/tuner/session-card.tsx components/tuner/tuner-settings-popover.tsx components/tuner/tuner-tips.tsx && git commit -m "tuner: reference tone, session, settings, tips"`

---

### Task 12: Page assembly, deletions, build

**Files:**
- Rewrite: `app/dashboard/tuner/page.tsx`
- Delete: `hooks/use-pitch-detection.ts`, `lib/tuner/tuner-utils.ts`, `components/tuner/strobe-meter.tsx`, `components/tuner/note-readout.tsx`, `components/tuner/signal-waveform.tsx`, `components/tuner/tuner-settings.tsx`, `components/tuner/tuner-explainer.tsx`
- Modify: `locales/en.json`, `locales/es.json` (from Task 8)

Page state: `prefs` (hook), `auto` + `manual` course, `done: Set<number>`, `log: LogEntry[]`, `refPc/refOct`, `playingCourse`. Derived: `instrument`, `tuning`, `courses`, `targetMidi` (manual → `courseTargetMidi(course, lastHz)`, else null). Engine `onFrame`: when `justLocked`, resolve course (auto → `nearestCourse` if the locked midi is in it; manual → `manual`), add to `done`, unshift log (cap 12). Instrument/tuning change → reset auto/manual/done, `resetTracker()`. Keyboard: `Space` toggle (ignore when target is a control), `↑/↓` A4, `←/→` manual cycle, handled in a `keydown` listener on `window`. Layout per spec.

- [ ] **Step 1: Write the page; delete the old files; `grep -rn "use-pitch-detection\|tuner-utils\|strobe-meter\|note-readout\|signal-waveform\|tuner-explainer\|tuner-settings'" app components hooks lib` returns nothing.**
- [ ] **Step 2: `npx vitest run` all green; `npx tsc --noEmit`; `npx eslint app/dashboard/tuner components/tuner hooks lib/tuner`; `npm run build` succeeds.**
- [ ] **Step 3: Verify locale hunks: `git diff locales/en.json` — if hunks outside `dashboard.pages.tuner` exist they belong to the other session: stop and ask the user whether to include them. Otherwise commit.**
- [ ] **Step 4: Commit** — `git add app/dashboard/tuner/page.tsx locales/en.json locales/es.json && git rm -q hooks/use-pitch-detection.ts lib/tuner/tuner-utils.ts components/tuner/strobe-meter.tsx components/tuner/note-readout.tsx components/tuner/signal-waveform.tsx components/tuner/tuner-settings.tsx components/tuner/tuner-explainer.tsx && git commit -m "tuner: rebuild page on the new engine and components"`

---

### Task 13: Manual QA in the browser

- [ ] **Step 1: `nohup npm run dev -- -p 3005 &`; open `http://localhost:3005/dashboard/tuner` (Chrome is logged in).**
- [ ] **Step 2: Screenshot idle state, dark and light.** Check: layout matches the prototype, no console errors, worklet loaded (`console.warn` absent).
- [ ] **Step 3: Start tuning; play the reference A4 from the card into the mic (or hum): note reads A4, cents stable, level bars move. Switch device if more than one exists.**
- [ ] **Step 4: Instruments: Tres shows octave course; Chromatic hides pads; settings solfège renders `Mi2`; transposition B♭ shows "Sounds … at concert pitch".**
- [ ] **Step 5: Permission denied path (Chrome site settings → block mic) shows the denied copy and Try again.**
- [ ] **Step 6: Mobile width (375 px) single column, chips scroll, no horizontal page scroll.**
- [ ] **Step 7: Fix anything found, re-run `npx vitest run`, commit fixes with `tuner:` prefix.**
