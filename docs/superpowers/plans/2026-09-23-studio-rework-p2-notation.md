# Studio Rework P2 — Notation Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw everything the score model now stores in both the student score and the Studio measure strip:
- double dots, any n:m tuplet, and grace notes
- all articulations, ornaments, dynamics and text
- slurs and hairpins
- key signatures, and accidentals that follow them (naturals, courtesy accidentals, double sharps and flats)
- the bass, alto and tenor clefs
- a second voice

**Architecture:** The pipeline stays pure data first, then VexFlow.
1. `extractTrackEvents` produces richer `VexEventDescriptor`s. A new pure accidental engine and a pure beam grouper feed it.
2. One shared VexFlow builder (`lib/playsense-studio/notation/build-measure.ts`) turns descriptors into notes, tuplets and beams. It replaces the two diverging `descriptorToStaveNote` copies (student renderer and Studio strip).
3. A span pass (`notation/spans.ts`) draws slurs and hairpins, including across line breaks.

Descriptor changes are additive. Existing fields keep their meaning, so `note-onsets.ts`, the iOS generator and the tests keep working.

**Tech Stack:** TypeScript, React 19, VexFlow 5.0.0 (named imports from `'vexflow'`, full bundle with embedded Bravura), vitest (node by default; `// @vitest-environment jsdom` per file).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` (§4.2, §5, §11). Roadmap: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md` (Plan 2 and "Carried forward from Plan 1").

## Global Constraints

- Only voice 1 drives playback highlighting, hit-testing, cursor mapping and grading (spec §2.7). Voice 2 is drawn for display only.
- Accidental rules (spec §4.2):
  - Show an accidental when a pitch's alteration differs from what the key signature plus earlier accidentals in the same bar imply for that step and octave.
  - `showAccidental: 'always'` forces one.
  - A note tied from the previous note at the same pitch shows none.
- Spelling precedence: `spelling` beats `spellingHint`, which beats the key-based default (`midiToKeyString`).
- Default clef is unchanged: `'percussion'` for percussion instruments, otherwise `'treble'`. `Measure.clef` overrides from that measure onward.
- A slur or hairpin whose `from === to`, or whose ends can't be found, is not drawn (roadmap "carried forward").
- The continuous single-SVG Studio strip (spec §5 bullet 3) moves to Plan 3, which rebuilds the strip. P2 keeps one SVG per measure, so spans in the strip draw within a measure only. Task 7 records this in the roadmap.
- Colours: every new glyph must come out black before `themeVexflowSvg` runs (no explicit colours), so the theme recolours it.
- Run tests with `npx vitest run <path> --exclude '.worktrees/**'`. Commit messages are an imperative sentence with no prefix.

## Review Focus

1. **Scores saved before P1:** legacy `dotted` / `triplet` / `articulation` only, no key signature drawn today. They must still draw correctly, and legacy triplets must now get a 3:2 bracket in both renderers. Pinned in Task 2 (legacy triplet grouping) and Task 3.
2. **A B♭ in F major** must no longer draw a redundant flat, now that the key signature is drawn. A B♮ in F major must draw a natural. Pinned in Task 1.
3. **A measure whose voice-1 events overfill or underfill the bar** must still render (non-strict voice), not throw and blank the measure. Pinned in Task 3.
4. **A second voice in only some measures** must not shift voice-1 note indices used by highlighting and hit boxes. Pinned in Tasks 5 and 6 (voice-1 notes stay `notes[0]`).
5. **A slur that crosses a line break** in the wrapped student layout must draw as two partial curves, not a line across the page. Pinned in Task 4.

---

### Task 1: Pure accidental engine and spelled keys

**Files:**
- Create: `lib/playsense-studio/notation/accidentals.ts`
- Test: `lib/playsense-studio/__tests__/notation-accidentals.test.ts`

**Interfaces — Produces:**

```ts
export type AccidentalCode = '#' | 'b' | 'n' | '##' | 'bb'
export interface SpelledPitch { step: Spelling['step']; alter: Spelling['alter']; octave: number; showAccidental?: 'auto' | 'always' }
export function spellMidi(midi: number, opts: { spelling?: Spelling; spellingHint?: string; keyFifths: number }): SpelledPitch
export function keyAlter(step: Spelling['step'], keyFifths: number): -1 | 0 | 1
export function vexKey(p: SpelledPitch): string            // 'bb/4', 'f##/5', 'c/4'
export function keySignatureName(keyFifths: number): string // VexFlow key spec: 'C', 'F', 'Bb', 'D', …
export function createAccidentalMemory(keyFifths: number): { code(p: SpelledPitch, opts?: { tiedFromSame?: boolean }): AccidentalCode | null }
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { createAccidentalMemory, keyAlter, keySignatureName, spellMidi, vexKey } from '../notation/accidentals'

describe('spellMidi', () => {
  it('prefers explicit spelling, then the hint, then the key', () => {
    expect(spellMidi(70, { spelling: { step: 'A', alter: 1 }, spellingHint: 'Bb', keyFifths: 0 })).toEqual({ step: 'A', alter: 1, octave: 4 })
    expect(spellMidi(70, { spellingHint: 'Bb', keyFifths: 2 })).toEqual({ step: 'B', alter: -1, octave: 4 })
    expect(spellMidi(70, { keyFifths: -1 })).toMatchObject({ step: 'B', alter: -1, octave: 4 })
    expect(spellMidi(70, { keyFifths: 2 })).toMatchObject({ step: 'A', alter: 1, octave: 4 })
  })
  it('handles octave crossings and double accidentals', () => {
    expect(spellMidi(60, { spelling: { step: 'B', alter: 1 }, keyFifths: 0 })).toEqual({ step: 'B', alter: 1, octave: 3 })   // B#3 = C4
    expect(spellMidi(59, { spelling: { step: 'C', alter: -1 }, keyFifths: 0 })).toEqual({ step: 'C', alter: -1, octave: 4 })  // Cb4 = B3
    expect(spellMidi(79, { spelling: { step: 'F', alter: 2 }, keyFifths: 0 })).toEqual({ step: 'F', alter: 2, octave: 5 })
    expect(spellMidi(64, { spelling: { step: 'E', alter: 0, showAccidental: 'always' }, keyFifths: 0 })).toEqual({ step: 'E', alter: 0, octave: 4, showAccidental: 'always' })
  })
})

describe('keys and signatures', () => {
  it('builds VexFlow keys', () => {
    expect(vexKey({ step: 'B', alter: -1, octave: 4 })).toBe('bb/4')
    expect(vexKey({ step: 'F', alter: 2, octave: 5 })).toBe('f##/5')
    expect(vexKey({ step: 'C', alter: 0, octave: 4 })).toBe('c/4')
  })
  it('knows the key signature', () => {
    expect(keyAlter('B', -1)).toBe(-1)
    expect(keyAlter('F', 2)).toBe(1)
    expect(keyAlter('C', 2)).toBe(1)
    expect(keyAlter('G', 2)).toBe(0)
    expect(keySignatureName(0)).toBe('C')
    expect(keySignatureName(-2)).toBe('Bb')
    expect(keySignatureName(3)).toBe('A')
  })
})

describe('createAccidentalMemory', () => {
  it('shows nothing the key signature already implies, and a natural when it is cancelled', () => {
    const m = createAccidentalMemory(-1) // F major
    expect(m.code({ step: 'B', alter: -1, octave: 4 })).toBeNull()
    expect(m.code({ step: 'B', alter: 0, octave: 4 })).toBe('n')
    expect(m.code({ step: 'B', alter: 0, octave: 4 })).toBeNull()      // remembered within the bar
    expect(m.code({ step: 'B', alter: 0, octave: 5 })).toBe('n')       // other octave is separate
  })
  it('remembers accidentals within the bar and forces courtesy ones', () => {
    const m = createAccidentalMemory(0)
    expect(m.code({ step: 'E', alter: -1, octave: 5 })).toBe('b')
    expect(m.code({ step: 'E', alter: -1, octave: 5 })).toBeNull()
    expect(m.code({ step: 'E', alter: 0, octave: 5 })).toBe('n')
    expect(m.code({ step: 'F', alter: 2, octave: 5 })).toBe('##')
    expect(m.code({ step: 'D', alter: -2, octave: 4 })).toBe('bb')
    expect(m.code({ step: 'A', alter: 0, octave: 4, showAccidental: 'always' })).toBe('n')
  })
  it('does not repeat the accidental on a note tied from the same pitch', () => {
    const m = createAccidentalMemory(0)
    expect(m.code({ step: 'F', alter: 1, octave: 4 }, { tiedFromSame: true })).toBeNull()
    expect(m.code({ step: 'F', alter: 1, octave: 4 })).toBeNull()      // and it is remembered
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run lib/playsense-studio/__tests__/notation-accidentals.test.ts --exclude '.worktrees/**'`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/playsense-studio/notation/accidentals.ts`)

```ts
// Spell pitches and decide which accidentals to print (spec §4.2): the key
// signature plus accidentals remembered within the bar, per step and octave.
import type { Spelling } from '@/components/playsense-studio/shared/score-model/types'
import { parseSpellingHint } from '@/components/playsense-studio/shared/score-model/accessors'
import { midiToKeyString } from '../score-to-vexflow'

export type AccidentalCode = '#' | 'b' | 'n' | '##' | 'bb'
export interface SpelledPitch { step: Spelling['step']; alter: Spelling['alter']; octave: number; showAccidental?: 'auto' | 'always' }

const STEP_SEMITONE: Record<Spelling['step'], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ALTER_TEXT: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
const ALTER_CODE: Record<number, AccidentalCode> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' }
const SHARP_ORDER = 'FCGDAEB'
const FLAT_ORDER = 'BEADGCF'
const KEY_NAMES: Record<number, string> = { [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' }

function octaveFor(midi: number, step: Spelling['step'], alter: number): number {
  return Math.floor((midi - alter - STEP_SEMITONE[step]) / 12) - 1
}

export function spellMidi(midi: number, opts: { spelling?: Spelling; spellingHint?: string; keyFifths: number }): SpelledPitch {
  const s = opts.spelling ?? parseSpellingHint(opts.spellingHint)
  if (s) {
    return { step: s.step, alter: s.alter, octave: octaveFor(midi, s.step, s.alter), ...(s.showAccidental ? { showAccidental: s.showAccidental } : {}) }
  }
  const key = midiToKeyString(midi, { keyFifths: opts.keyFifths }) // e.g. 'bb/4', 'c#/5'
  const m = /^([a-g])(#|b)?\/(-?\d+)$/.exec(key)!
  const step = m[1].toUpperCase() as Spelling['step']
  const alter = (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) as Spelling['alter']
  return { step, alter, octave: Number(m[3]) }
}

export function keyAlter(step: Spelling['step'], keyFifths: number): -1 | 0 | 1 {
  if (keyFifths > 0) return SHARP_ORDER.slice(0, keyFifths).includes(step) ? 1 : 0
  if (keyFifths < 0) return FLAT_ORDER.slice(0, -keyFifths).includes(step) ? -1 : 0
  return 0
}

export function vexKey(p: SpelledPitch): string {
  return `${p.step.toLowerCase()}${ALTER_TEXT[p.alter]}/${p.octave}`
}

export function keySignatureName(keyFifths: number): string {
  return KEY_NAMES[Math.max(-7, Math.min(7, Math.round(keyFifths)))]
}

export function createAccidentalMemory(keyFifths: number) {
  const seen = new Map<string, number>()
  return {
    code(p: SpelledPitch, opts: { tiedFromSame?: boolean } = {}): AccidentalCode | null {
      const slot = `${p.step}${p.octave}`
      const expected = seen.has(slot) ? seen.get(slot)! : keyAlter(p.step, keyFifths)
      seen.set(slot, p.alter)
      if (opts.tiedFromSame) return null
      if (p.alter !== expected || p.showAccidental === 'always') return ALTER_CODE[p.alter]
      return null
    },
  }
}
```

- [ ] **Step 4: Run tests** — same command. Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/notation/accidentals.ts lib/playsense-studio/__tests__/notation-accidentals.test.ts
git commit -m "Spell pitches and choose accidentals from the key signature and the bar"
```

---

### Task 2: Richer descriptors from `extractTrackEvents`, plus the reference fixture

**Files:**
- Modify: `lib/playsense-studio/score-to-vexflow.ts` (`VexEventDescriptor` at ~193–226, `extractTrackEvents` at ~236–346)
- Modify: `lib/playsense-studio/score-fixtures.ts` (add `REFERENCE_EXCERPT_FIXTURE`, and add it to `FIXTURES`)
- Test: `lib/playsense-studio/__tests__/notation-descriptors.test.ts`

**Interfaces:**
- Consumes (Task 1): `spellMidi`, `vexKey`, `createAccidentalMemory`, `AccidentalCode`. Consumes the P1 accessors: `eventDots`, `eventTuplet`, `eventArticulations`.
- Produces:

```ts
export type NotationClef = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'
export interface GraceDescriptor { keys: string[]; accidentals: Array<AccidentalCode | null>; slash: boolean }
// VexEventDescriptor — existing fields keep their meaning; `accidentals` widens to AccidentalCode | null.
//   New: dots: 0|1|2; tuplet: { id: string; n: number; m: number } | null; articulations: Articulation[];
//        ornament?: Ornament; dynamic?: Dynamic; text?: string; grace?: GraceDescriptor[]; id?: string; voice: 1 | 2
// extractTrackEvents block — existing fields kept; clef widens to NotationClef.
//   New: voice2Events: VexEventDescriptor[]; keyFifths: number; keyChanged: boolean; clefChanged: boolean
export const REFERENCE_EXCERPT_FIXTURE: ScoreDocument
```

- [ ] **Step 1: Add the fixture** (`score-fixtures.ts`, before `FIXTURES`; also add `REFERENCE_EXCERPT: REFERENCE_EXCERPT_FIXTURE` to `FIXTURES`)

```ts
/** The violin line from the reference image (spec §2.3), extended to show every
 * mark P2 must draw. 3/4, F major after bar 3, ♩ = 96. */
export const REFERENCE_EXCERPT_FIXTURE: ScoreDocument = {
  schemaVersion: 1, title: 'Reference excerpt', sourceFormat: 'native', initialTempo: 96, initialTimeSignature: [3, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'staff', displayName: 'Violin', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, voices: [{ number: 1, events: [
      { kind: 'rest', id: 'r1', durationQN: 1 },
      { kind: 'note', id: 'n1', midi: 65, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 }, dynamic: 'mp' },
      { kind: 'note', id: 'n2', midi: 67, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 } },
      { kind: 'note', id: 'n3', midi: 69, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 } },
      { kind: 'note', id: 'n4', midi: 71, durationQN: 0.25 },
      { kind: 'note', id: 'n5', midi: 72, durationQN: 0.25 },
      { kind: 'note', id: 'n6', midi: 73, durationQN: 0.25, spelling: { step: 'D', alter: -1 } },
      { kind: 'note', id: 'n7', midi: 75, durationQN: 0.25, spelling: { step: 'E', alter: -1 } },
    ] }] },
    { number: 2, voices: [{ number: 1, events: [
      { kind: 'note', id: 'n8', midi: 76, durationQN: 1, spelling: { step: 'E', alter: 0, showAccidental: 'always' }, dynamic: 'f' },
      { kind: 'note', id: 'n9', midi: 79, durationQN: 1 },
      { kind: 'rest', id: 'r2', durationQN: 0.5 },
      { kind: 'note', id: 'n10', midi: 84, durationQN: 0.5, articulation: 'staccato' },   // legacy field on purpose
    ] }] },
    { number: 3, keyFifths: -1, voices: [{ number: 1, events: [
      { kind: 'note', id: 'n11', midi: 86, durationQN: 1, grace: [{ midi: 85, spelling: { step: 'C', alter: 1 }, slash: true }] },
      { kind: 'note', id: 'n12', midi: 88, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n13', midi: 86, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n14', midi: 84, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n15', midi: 82, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n16', midi: 81, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n17', midi: 79, durationQN: 1, ornament: 'trill', articulations: ['fermata'] },
    ] }] },
    { number: 4, voices: [
      { number: 1, events: [
        { kind: 'note', id: 'n18', midi: 71, durationQN: 1.75, dots: 2, spelling: { step: 'B', alter: 0 }, text: 'dolce' },
        { kind: 'note', id: 'n19', midi: 69, durationQN: 0.25 },
        { kind: 'chord', id: 'n20', durationQN: 1, articulations: ['accent', 'tenuto'], notes: [{ midi: 70 }, { midi: 74 }] },
      ] },
      { number: 2, events: [
        { kind: 'note', id: 'v2a', midi: 62, durationQN: 2 },
        { kind: 'rest', id: 'v2b', durationQN: 1 },
      ] },
    ] },
    { number: 5, clef: 'bass', endBarline: 'final', voices: [{ number: 1, events: [
      { kind: 'note', id: 'n21', midi: 53, durationQN: 3, dots: undefined, dotted: true, dynamic: 'ff', articulations: ['marcato'] },
    ] }] },
  ] }],
  spans: [
    { id: 's1', type: 'cresc', from: 'n1', to: 'n7' },
    { id: 's2', type: 'slur', from: 'n8', to: 'n9' },
    { id: 's3', type: 'slur', from: 'n10', to: 'n11' },
    { id: 's4', type: 'dim', from: 'n12', to: 'n17' },
  ],
}
```

(Bar 5's `dots: undefined, dotted: true` is deliberate: it is a legacy-style dotted half, 3 QN.)

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { extractTrackEvents } from '../score-to-vexflow'
import { REFERENCE_EXCERPT_FIXTURE as F, GUITAR_LICK_FIXTURE } from '../score-fixtures'
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization'
import type { Track } from '@/components/playsense-studio/shared/score-model/types'

const blocks = () => extractTrackEvents(F.tracks[0], F.initialTimeSignature, F.initialKeyFifths)

describe('richer descriptors', () => {
  it('the fixture is a valid score', () => {
    expect(() => parseScoreDocument(JSON.parse(JSON.stringify(F)))).not.toThrow()
  })
  it('carries dots, tuplets, marks and ids', () => {
    const [b1, b2, b3, b4, b5] = blocks()
    expect(b1.events[1]).toMatchObject({ id: 'n1', durationCode: '8', tuplet: { id: 't1', n: 3, m: 2 }, dynamic: 'mp', voice: 1 })
    expect(b3.events[1]).toMatchObject({ durationCode: '16', tuplet: { id: 't2', n: 5, m: 4 } })
    expect(b3.events[0].grace).toEqual([{ keys: ['c#/6'], accidentals: ['#'], slash: true }])
    expect(b3.events[6]).toMatchObject({ ornament: 'trill', articulations: ['fermata'] })
    expect(b4.events[0]).toMatchObject({ dots: 2, dotted: true, durationCode: 'q', text: 'dolce' })
    expect(b4.events[2].articulations).toEqual(['accent', 'tenuto'])
    expect(b5.events[0]).toMatchObject({ dots: 1, durationCode: 'h', dynamic: 'ff', articulations: ['marcato'] })
    expect(b2.events[3]).toMatchObject({ articulation: 'staccato', articulations: ['staccato'] }) // legacy field read through the accessor
  })
  it('applies the accidental rules and key changes', () => {
    const [b1, b2, b3, b4] = blocks()
    expect(b1.events[6]).toMatchObject({ keys: ['db/5'], accidentals: ['b'] })
    expect(b2.events[0]).toMatchObject({ keys: ['e/5'], accidentals: ['n'] })   // courtesy natural
    expect(b3).toMatchObject({ keyFifths: -1, keyChanged: true })
    expect(b3.events[4]).toMatchObject({ keys: ['bb/5'], accidentals: [null] })   // Bb5 is in F major
    expect(b4.events[0]).toMatchObject({ keys: ['b/4'], accidentals: ['n'] })     // B natural in F major
    expect(b4.keyChanged).toBe(false)
  })
  it('splits voice 2 out and places rests per clef and voice', () => {
    const [, , , b4, b5] = blocks()
    expect(b4.events).toHaveLength(3)
    expect(b4.voice2Events.map(e => e.voice)).toEqual([2, 2])
    expect(b4.voice2Events[1]).toMatchObject({ isRest: true, keys: ['f/4'] })
    expect(b5).toMatchObject({ clef: 'bass', clefChanged: true })
  })
  it('groups legacy triplets without ids into runs of three', () => {
    const legacy: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [{ number: 1, voices: [{ number: 1, events: [
      ...[60, 62, 64, 65, 67, 69].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 / 3, triplet: true })),
      { kind: 'rest' as const, durationQN: 2 },
    ] }] }] }
    const ev = extractTrackEvents(legacy, [4, 4], 0)[0].events
    expect(ev[0].tuplet).toMatchObject({ n: 3, m: 2 })
    expect(ev[0].tuplet!.id).toBe(ev[2].tuplet!.id)
    expect(ev[3].tuplet!.id).not.toBe(ev[2].tuplet!.id)
    expect(ev[6].tuplet).toBeNull()
  })
  it('leaves an old 4/4 score unchanged apart from the new fields', () => {
    const [b] = extractTrackEvents(GUITAR_LICK_FIXTURE.tracks[0], GUITAR_LICK_FIXTURE.initialTimeSignature, 0)
    expect(b.events.map(e => [e.keys, e.durationCode, e.dotted, e.triplet])).toMatchSnapshot()
    expect(b).toMatchObject({ clef: 'treble', keyFifths: 0, keyChanged: false, voice2Events: [] })
  })
})
```

- [ ] **Step 3: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/notation-descriptors.test.ts --exclude '.worktrees/**'`. Expected: FAIL on the new fields.

- [ ] **Step 4: Implement**

In `score-to-vexflow.ts`:

1. Extend the imports:
   ```ts
   import { eventArticulations, eventDots, eventTuplet, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';
   import type { Articulation, Dynamic, Ornament } from '@/components/playsense-studio/shared/score-model/types';
   import { createAccidentalMemory, spellMidi, vexKey, type AccidentalCode } from './notation/accidentals';
   ```
   `notation/accidentals.ts` imports `midiToKeyString` from this file. That circular import is safe because both sides only use each other inside functions, not at module top level.

2. Add these types, and extend `VexEventDescriptor` (keep every existing field):
   ```ts
   export type NotationClef = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion';
   export interface GraceDescriptor { keys: string[]; accidentals: Array<AccidentalCode | null>; slash: boolean }
   // inside VexEventDescriptor:
     accidentals: Array<AccidentalCode | null>;   // was '#' | 'b' | null
     dots: 0 | 1 | 2;
     tuplet: { id: string; n: number; m: number } | null;
     articulations: Articulation[];
     ornament?: Ornament;
     dynamic?: Dynamic;
     text?: string;
     grace?: GraceDescriptor[];
     id?: string;
     voice: 1 | 2;
   ```

3. Add rest positions:
   ```ts
   const REST_KEY: Record<NotationClef, string> = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3', percussion: 'b/4' };
   const REST_KEY_V1: Record<NotationClef, string> = { treble: 'e/5', bass: 'g/3', alto: 'f/4', tenor: 'd/4', percussion: 'e/5' };
   const REST_KEY_V2: Record<NotationClef, string> = { treble: 'f/4', bass: 'a/2', alto: 'g/3', tenor: 'e/3', percussion: 'f/4' };
   ```

4. Rewrite `extractTrackEvents` so its per-voice event loop becomes a local function `describeVoice(events, voiceNo, twoVoices)`. Keep the return shape and add the new block fields (return-type annotation included).
   - **Running state:** `clef` (percussion instrument → `'percussion'`; otherwise `measure.clef ?? previous ?? 'treble'`) and `keyFifths` (`measure.keyFifths ?? previous ?? the keyFifths argument`). Set `keyChanged` and `clefChanged` when the measure sets a value that differs from the previous one; never on measure 1.
   - **Accidental memory:** one `createAccidentalMemory(keyFifths)` per measure, shared by voice 1 then voice 2.
   - **Pitched notes and chords:**
     - Spell with `spellMidi(midi, { spelling, spellingHint, keyFifths })`.
     - Set `keys` with `vexKey`.
     - Accidentals come from `memory.code(p, { tiedFromSame })`. `tiedFromSame` is true when the previous event in this voice, across barlines, had `tieToNext` (or, for a chord member, that note had `tieToNext`) and includes the same MIDI pitch.
     - Percussion keeps its current path (`percussionNotation`, `accidentals: [null]`).
   - **Rests:** use `keys: [twoVoices ? (voiceNo === 1 ? REST_KEY_V1 : REST_KEY_V2)[clef] : REST_KEY[clef]]`.
   - **New fields:**
     - `dots: eventDots(event)`
     - `dotted: eventDots(event) >= 1` (keep the legacy field meaningful)
     - `articulations: event.kind === 'rest' ? [] : eventArticulations(event)`
     - `ornament`, `dynamic`, `text`, `id` copied through
     - `voice: voiceNo`
     - `grace`: each grace note is spelled, and its accidental is decided against the key only, with no bar memory (`keyAlter`-based: show when `alter !== keyAlter(step, keyFifths)`)
   - **Tuplet:** `eventTuplet(event)` with an id. When the event has no id (legacy `triplet: true`), assign `legacy-${measure.number}-${voiceNo}-${k}`, where `k` increments every 3 consecutive legacy triplet events in that voice. Any non-triplet event resets the run.
   - **Voices:** `events` = the voice-1 descriptors (unchanged), and `voice2Events` = the voice-2 descriptors, or `[]` when voice 2 is missing or empty.
   - Keep `triplet: event.triplet ?? false` and `articulation: …` exactly as today, for existing consumers.

- [ ] **Step 5: Run the new test** (writes the snapshot on first run), then the existing notation, recording and percussion tests:

```bash
npx vitest run lib/playsense-studio/__tests__/notation-descriptors.test.ts lib/playsense-studio/__tests__/notation-pitch.test.ts lib/playsense-studio/__tests__/midi-recording.test.ts lib/playsense-studio/__tests__/midi-recording-placement.test.ts lib/playsense-studio/__tests__/percussion-import.test.ts lib/playsense-studio/__tests__/note-onsets.test.ts components/playsense-studio --exclude '.worktrees/**'
```

Expected: PASS. If an existing assertion expected a sharp or flat that the key signature now covers (e.g. `accidentals: ['b']` for B♭ in a flat key), update that assertion to the key-signature-aware value. List each change in your report. Nothing else may change.

- [ ] **Step 6: Type check** — `npx tsc --noEmit -p . 2>&1 | grep -E "score-to-vexflow|accidentals|score-fixtures" | head` must print nothing. If the widened `accidentals` or `clef` type breaks a consumer in `staff-renderer.tsx`, `editable-measure-strip.tsx` or `integrated-editor.tsx`, widen that consumer's local type annotation only (Tasks 5–6 rewrite those consumers).

- [ ] **Step 7: Commit**

```bash
git add lib/playsense-studio/score-to-vexflow.ts lib/playsense-studio/score-fixtures.ts lib/playsense-studio/__tests__
git commit -m "Describe every notation mark, key change, clef and second voice for the renderers"
```

---

### Task 3: One shared VexFlow builder

**Files:**
- Create: `lib/playsense-studio/notation/build-measure.ts`
- Test: `lib/playsense-studio/__tests__/notation-build-measure.test.ts`

**Interfaces:**
- Consumes (Task 2): `VexEventDescriptor`, `NotationClef`; `createStaveNote` from `lib/playsense-studio/percussion-stave-note.ts`.
- Produces:

```ts
export function beamGroups(ds: VexEventDescriptor[], ts: [number, number]): number[][]
export function descriptorToStaveNote(d: VexEventDescriptor, opts: { clef: NotationClef; stem?: 'up' | 'down' | 'auto' }): StaveNote
export interface BuiltMeasure { voices: Voice[]; notes: StaveNote[][]; beams: Beam[]; tuplets: Tuplet[] }
export function buildMeasure(voices: VexEventDescriptor[][], ts: [number, number], clef: NotationClef): BuiltMeasure | null
export function formatMeasure(b: BuiltMeasure, width: number): void
export function drawMeasure(ctx: RenderContext, stave: Stave, b: BuiltMeasure): void
```

`notes[0]` is always voice 1's notes, parallel to its descriptors. That holds even when voice 1 is empty and voice 2 isn't: `buildMeasure` then returns `notes[0] = []` and adds no voice-1 `Voice`.

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { extractTrackEvents } from '../score-to-vexflow'
import { REFERENCE_EXCERPT_FIXTURE as F } from '../score-fixtures'
import { beamGroups, buildMeasure, descriptorToStaveNote, formatMeasure } from '../notation/build-measure'

beforeAll(() => {
  // VexFlow measures annotation text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
})

const blocks = () => extractTrackEvents(F.tracks[0], F.initialTimeSignature, F.initialKeyFifths)
const mods = (n: { getModifiers(): { getCategory(): string }[] }, cat: string) => n.getModifiers().filter(m => m.getCategory() === cat).length

describe('beamGroups', () => {
  it('beams per beat and keeps tuplets whole', () => {
    const [b1, b2, b3] = blocks()
    expect(beamGroups(b1.events, [3, 4])).toEqual([[1, 2, 3], [4, 5, 6, 7]])
    expect(beamGroups(b2.events, [3, 4])).toEqual([])       // an eighth alone after a rest isn't beamed
    expect(beamGroups(b3.events, [3, 4])).toEqual([[1, 2, 3, 4, 5]])
  })
})

describe('descriptorToStaveNote', () => {
  it('attaches dots, accidentals, articulations, ornaments, dynamics, text and grace notes', () => {
    const [b1, , b3, b4] = blocks()
    const dd = descriptorToStaveNote(b4.events[0], { clef: 'treble' })
    expect(mods(dd, 'Dot')).toBe(2)
    expect(mods(dd, 'Accidental')).toBe(1)
    expect(mods(dd, 'Annotation')).toBe(1)
    expect(mods(descriptorToStaveNote(b4.events[2], { clef: 'treble' }), 'Articulation')).toBe(2)
    const tr = descriptorToStaveNote(b3.events[6], { clef: 'treble' })
    expect(mods(tr, 'Ornament')).toBe(1)
    expect(mods(tr, 'Articulation')).toBe(1)
    expect(mods(descriptorToStaveNote(b3.events[0], { clef: 'treble' }), 'GraceNoteGroup')).toBe(1)
    expect(mods(descriptorToStaveNote(b1.events[1], { clef: 'treble' }), 'Annotation')).toBe(1) // mp
  })
})

describe('buildMeasure', () => {
  it('makes tuplets that scale ticks, and formats without throwing', () => {
    const [b1, , b3] = blocks()
    const m1 = buildMeasure([b1.events], [3, 4], 'treble')!
    expect(m1.tuplets).toHaveLength(1)
    expect(m1.beams).toHaveLength(2)
    const quarter = m1.notes[0][0].getTicks().value() // the quarter rest
    expect(m1.notes[0][1].getTicks().value()).toBeCloseTo(quarter / 3, 6)
    expect(() => formatMeasure(m1, 300)).not.toThrow()
    const m3 = buildMeasure([b3.events], [3, 4], 'treble')!
    expect(m3.tuplets).toHaveLength(1)
    expect(m3.notes[0][1].getTicks().value()).toBeCloseTo(quarter / 5, 6)
  })
  it('stems two voices apart and keeps voice 1 at notes[0]', () => {
    const [, , , b4] = blocks()
    const m = buildMeasure([b4.events, b4.voice2Events], [3, 4], 'treble')!
    expect(m.voices).toHaveLength(2)
    expect(m.notes[0]).toHaveLength(3)
    expect(m.notes[0][1].getStemDirection()).toBe(1)
    expect(m.notes[1][0].getStemDirection()).toBe(-1)
    expect(() => formatMeasure(m, 300)).not.toThrow()
  })
  it('renders an overfull or empty-voice measure instead of throwing', () => {
    const [b1, b2] = blocks()
    expect(() => formatMeasure(buildMeasure([[...b1.events, ...b2.events]], [3, 4], 'treble')!, 300)).not.toThrow()
    expect(buildMeasure([[]], [3, 4], 'treble')).toBeNull()
    expect(buildMeasure([[], b1.events], [3, 4], 'treble')!.notes[0]).toEqual([])
  })
})
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/notation-build-measure.test.ts --exclude '.worktrees/**'`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/playsense-studio/notation/build-measure.ts`)

```ts
// The one place descriptors become VexFlow objects. The student renderer and
// the Studio strip both build notes, tuplets and beams here, so they can't drift.
import {
  Accidental, Annotation, Articulation, Beam, Dot, Formatter, GraceNote, GraceNoteGroup, Modifier, Ornament,
  type RenderContext, type Stave, type StaveNote, Tuplet, Voice,
} from 'vexflow'
import type { Articulation as ArticulationKind, Dynamic, Ornament as OrnamentKind } from '@/components/playsense-studio/shared/score-model/types'
import { createStaveNote } from '../percussion-stave-note'
import type { NotationClef, VexEventDescriptor } from '../score-to-vexflow'

const ARTIC: Record<ArticulationKind, string> = { staccato: 'a.', staccatissimo: 'av', tenuto: 'a-', accent: 'a>', marcato: 'a^', fermata: 'a@a' }
const ORN: Record<OrnamentKind, string> = { trill: 'tr', mordent: 'mordent', turn: 'turn' }
const DYN: Record<Dynamic, string> = { ppp: '', pp: '', p: '', mp: '', mf: '', f: '', ff: '', fff: '', fp: '', sfz: '' }
const BEAMABLE = new Set(['8', '16', '32', '64', '128'])

/** Beam per beat (a dotted quarter in compound meters); tuplet groups stay whole. */
export function beamGroups(ds: VexEventDescriptor[], ts: [number, number]): number[][] {
  const [num, den] = ts
  const beatQN = den === 8 && num % 3 === 0 ? 1.5 : den === 2 ? 2 : den === 8 ? 1 : 4 / den
  const groups: number[][] = []
  let run: number[] = []
  let runKey: string | null = null
  const end = () => { if (run.length > 1) groups.push(run); run = []; runKey = null }
  ds.forEach((d, i) => {
    const qn = (d.beatInMeasure - 1) * (4 / den)
    const key = d.tuplet ? `T${d.tuplet.id}` : `B${Math.floor(qn / beatQN + 1e-9)}`
    if (!d.isRest && BEAMABLE.has(d.durationCode)) {
      if (runKey !== key) end()
      run.push(i)
      runKey = key
    } else {
      end()
    }
  })
  end()
  return groups
}

export function descriptorToStaveNote(d: VexEventDescriptor, opts: { clef: NotationClef; stem?: 'up' | 'down' | 'auto' }): StaveNote {
  const stem = opts.stem ?? 'auto'
  const note = createStaveNote({
    keys: d.keys,
    clef: opts.clef,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
    dots: d.dots,
    ...(stem === 'up' ? { stemDirection: 1 } : stem === 'down' ? { stemDirection: -1 } : { autoStem: true }),
    ...(d.noteType && !d.isRest ? { type: d.noteType } : {}),
  }, d.percussion)
  for (let i = 0; i < d.dots; i++) Dot.buildAndAttach([note], { all: true })
  d.accidentals.forEach((acc, i) => { if (acc) note.addModifier(new Accidental(acc), i) })
  if (!d.isRest) {
    const up = note.getStemDirection() === 1
    d.articulations.forEach(a => {
      const art = new Articulation(ARTIC[a])
      art.setPosition(a === 'fermata' ? Modifier.Position.ABOVE : up ? Modifier.Position.BELOW : Modifier.Position.ABOVE)
      note.addModifier(art, 0)
    })
    if (d.ornament) note.addModifier(new Ornament(ORN[d.ornament]), 0)
    if (d.grace?.length) {
      const graces = d.grace.map(g => {
        const gn = new GraceNote({ keys: g.keys, duration: '8', slash: g.slash, clef: opts.clef })
        g.accidentals.forEach((acc, i) => { if (acc) gn.addModifier(new Accidental(acc), i) })
        return gn
      })
      note.addModifier(new GraceNoteGroup(graces, true), 0)
    }
  }
  if (d.dynamic) {
    const a = new Annotation(DYN[d.dynamic])
    a.setFont('Bravura', 30)
    a.setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
    note.addModifier(a, 0)
  }
  if (d.text) {
    const a = new Annotation(d.text)
    a.setFont('Georgia, serif', 12, 'normal', 'italic')
    a.setVerticalJustification(Annotation.VerticalJustify.TOP)
    note.addModifier(a, 0)
  }
  return note
}

export interface BuiltMeasure { voices: Voice[]; notes: StaveNote[][]; beams: Beam[]; tuplets: Tuplet[] }

export function buildMeasure(voiceDescriptors: VexEventDescriptor[][], ts: [number, number], clef: NotationClef): BuiltMeasure | null {
  const two = voiceDescriptors.length > 1 && voiceDescriptors[1].length > 0
  if (!voiceDescriptors.some(v => v.length)) return null
  const out: BuiltMeasure = { voices: [], notes: [], beams: [], tuplets: [] }
  voiceDescriptors.forEach((ds, vi) => {
    const notes = ds.map(d => descriptorToStaveNote(d, { clef, stem: two ? (vi === 0 ? 'up' : 'down') : 'auto' }))
    out.notes.push(notes)
    if (!notes.length) return
    // Tuplets first: they rescale the notes' ticks, which the voice and formatter read.
    let start = 0
    while (start < ds.length) {
      const t = ds[start].tuplet
      if (!t) { start++; continue }
      let end = start
      while (end + 1 < ds.length && ds[end + 1].tuplet?.id === t.id) end++
      const group = notes.slice(start, end + 1)
      const beamed = ds.slice(start, end + 1).every(d => !d.isRest && BEAMABLE.has(d.durationCode))
      out.tuplets.push(new Tuplet(group, { numNotes: t.n, notesOccupied: t.m, bracketed: !beamed, ratioed: false }))
      start = end + 1
    }
    beamGroups(ds, ts).forEach(ix => out.beams.push(new Beam(ix.map(i => notes[i]))))
    const voice = new Voice({ numBeats: ts[0], beatValue: ts[1] })
    voice.setStrict(false)
    voice.addTickables(notes)
    out.voices.push(voice)
  })
  return out
}

export function formatMeasure(b: BuiltMeasure, width: number): void {
  new Formatter().joinVoices(b.voices).format(b.voices, Math.max(40, width))
}

export function drawMeasure(ctx: RenderContext, stave: Stave, b: BuiltMeasure): void {
  b.voices.forEach(v => v.draw(ctx, stave))
  b.beams.forEach(beam => beam.setContext(ctx).draw())
  b.tuplets.forEach(t => t.setContext(ctx).draw())
}
```

If `StaveNoteStruct` rejects `dots`, or VexFlow 5 already applies the dot glyphs from `dots` (the test's `Dot` count of 2 would then read 4), fix it and keep the test's expectation: exactly `d.dots` Dot modifiers per key, and ticks that include the dots. Record what you found in the report.

- [ ] **Step 4: Run tests** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/notation/build-measure.ts lib/playsense-studio/__tests__/notation-build-measure.test.ts
git commit -m "Build every measure's notes, tuplets and beams in one shared place"
```

---

### Task 4: Slur and hairpin spans

**Files:**
- Create: `lib/playsense-studio/notation/spans.ts`
- Test: `lib/playsense-studio/__tests__/notation-spans.test.ts`

**Interfaces — Produces:**

```ts
export interface PlacedNote { id?: string; note: StaveNote; system: number; hasDynamic?: boolean }
export interface SpanSegment { type: 'slur' | 'cresc' | 'dim'; from?: StaveNote; to?: StaveNote; fromHasDynamic?: boolean }
export function spanSegments(spans: Span[] | undefined, placed: PlacedNote[]): SpanSegment[]
export function drawSpanSegments(ctx: RenderContext, segments: SpanSegment[]): void
```

`placed` is in reading order: measure by measure, voice 1 then voice 2.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import type { StaveNote } from 'vexflow'
import { spanSegments, type PlacedNote } from '../notation/spans'

const n = (id: string, system = 0, hasDynamic = false): PlacedNote => ({ id, system, hasDynamic, note: { id } as unknown as StaveNote })

describe('spanSegments', () => {
  const placed = [n('a', 0, true), n('b'), n('c'), n('d', 1), n('e', 1)]
  it('draws a span within one system as one segment', () => {
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'c' }], placed)).toEqual([
      { type: 'cresc', from: placed[0].note, to: placed[2].note, fromHasDynamic: true },
    ])
  })
  it('splits a slur across a line break into two open curves', () => {
    expect(spanSegments([{ id: 's', type: 'slur', from: 'b', to: 'e' }], placed)).toEqual([
      { type: 'slur', from: placed[1].note, to: undefined, fromHasDynamic: false },
      { type: 'slur', from: undefined, to: placed[4].note },
    ])
  })
  it('splits a hairpin at the last and first notes of each system', () => {
    expect(spanSegments([{ id: 's', type: 'dim', from: 'b', to: 'e' }], placed)).toEqual([
      { type: 'dim', from: placed[1].note, to: placed[2].note, fromHasDynamic: false },
      { type: 'dim', from: placed[3].note, to: placed[4].note },
    ])
  })
  it('skips spans that are degenerate, reversed or point at missing notes', () => {
    expect(spanSegments([
      { id: '1', type: 'slur', from: 'b', to: 'b' },
      { id: '2', type: 'slur', from: 'c', to: 'a' },
      { id: '3', type: 'cresc', from: 'x', to: 'c' },
    ], placed)).toEqual([])
    expect(spanSegments(undefined, placed)).toEqual([])
  })
})
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/notation-spans.test.ts --exclude '.worktrees/**'`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/playsense-studio/notation/spans.ts`)

```ts
// Slurs and hairpins (ScoreDocument.spans) resolved to drawn notes, split where
// a span crosses a line break. Ties stay with the renderers (scoreTieIndices).
import { Curve, Modifier, type RenderContext, type StaveNote, StaveHairpin } from 'vexflow'
import type { Span } from '@/components/playsense-studio/shared/score-model/types'

export interface PlacedNote { id?: string; note: StaveNote; system: number; hasDynamic?: boolean }
export interface SpanSegment { type: 'slur' | 'cresc' | 'dim'; from?: StaveNote; to?: StaveNote; fromHasDynamic?: boolean }

export function spanSegments(spans: Span[] | undefined, placed: PlacedNote[]): SpanSegment[] {
  if (!spans?.length) return []
  const index = new Map<string, number>()
  placed.forEach((p, i) => { if (p.id && !index.has(p.id)) index.set(p.id, i) })
  const out: SpanSegment[] = []
  for (const s of spans) {
    const ia = index.get(s.from), ib = index.get(s.to)
    if (ia === undefined || ib === undefined || ia >= ib) continue
    const a = placed[ia], b = placed[ib]
    if (a.system === b.system) { out.push({ type: s.type, from: a.note, to: b.note, fromHasDynamic: !!a.hasDynamic }); continue }
    if (s.type === 'slur') {
      out.push({ type: 'slur', from: a.note, to: undefined, fromHasDynamic: !!a.hasDynamic })
      out.push({ type: 'slur', from: undefined, to: b.note })
      continue
    }
    const lastOfA = [...placed].reverse().find(p => p.system === a.system)!
    const firstOfB = placed.find(p => p.system === b.system)!
    if (lastOfA.note !== a.note) out.push({ type: s.type, from: a.note, to: lastOfA.note, fromHasDynamic: !!a.hasDynamic })
    if (firstOfB.note !== b.note) out.push({ type: s.type, from: firstOfB.note, to: b.note })
  }
  return out
}

export function drawSpanSegments(ctx: RenderContext, segments: SpanSegment[]): void {
  for (const seg of segments) {
    try {
      if (seg.type === 'slur') {
        new Curve(seg.from, seg.to, { thickness: 2, cps: [{ x: 0, y: 12 }, { x: 0, y: 12 }] }).setContext(ctx).draw()
      } else if (seg.from && seg.to) {
        const hp = new StaveHairpin({ firstNote: seg.from, lastNote: seg.to }, seg.type === 'cresc' ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC)
        hp.setContext(ctx).setPosition(Modifier.Position.BELOW)
        hp.setRenderOptions({ height: 8, yShift: 4, leftShiftPx: seg.fromHasDynamic ? -26 : 0, rightShiftPx: 0 })
        hp.draw()
      }
    } catch {
      // A span VexFlow can't place (e.g. notes without a stave yet) is skipped, never fatal.
    }
  }
}
```

- [ ] **Step 4: Run tests** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/notation/spans.ts lib/playsense-studio/__tests__/notation-spans.test.ts
git commit -m "Draw slurs and hairpins, split cleanly across line breaks"
```

---

### Task 5: Student score uses the shared builder

**Files:**
- Modify: `components/playsense-studio/player/notation/renderers/staff-renderer.tsx`:
  - imports (22–56)
  - ledger headroom regex (~479–489)
  - per-placement drawing (~572–624)
  - ties and spans after drawing (~626–638)
  - the local `descriptorToStaveNote`/`formatMeasureVoice` (~1476–1520)
- Test: `components/playsense-studio/player/notation/renderers/__tests__/staff-renderer.test.ts` (add cases)

**Interfaces:**
- Consumes: `buildMeasure`, `formatMeasure`, `drawMeasure` (Task 3); `spanSegments`, `drawSpanSegments`, `PlacedNote` (Task 4); `keySignatureName` (Task 1); the block fields `voice2Events`, `keyFifths`, `keyChanged`, `clefChanged` (Task 2).
- Produces: `formatMeasureVoice(events, timeSignature, justifyWidth, clef?)` keeps its exported signature and return shape `{ vexNotes, voice, beams } | null`. It is now a thin wrapper over the builder (the `.worktrees/sheet-music-export` branch still imports it).

- [ ] **Step 1: Write the failing tests** (append to the existing test file)

```ts
import { REFERENCE_EXCERPT_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

describe('formatMeasureVoice with the shared builder', () => {
  it('draws the triplet as eighths under a 3:2 tuplet and keeps one StaveNote per voice-1 event', () => {
    const [b1] = extractTrackEvents(REFERENCE_EXCERPT_FIXTURE.tracks[0], [3, 4], 0)
    const laid = formatMeasureVoice(b1.events, b1.timeSignature, 300, b1.clef)!
    expect(laid.vexNotes).toHaveLength(b1.events.length)
    expect(laid.vexNotes[1].getDuration()).toBe('8')
    expect(laid.beams).toHaveLength(2)
  })
})
```

If this test file runs in node and annotations need a canvas, add `// @vitest-environment jsdom` and the `beforeAll` canvas stub from Task 3 to the top of the file.

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run components/playsense-studio/player/notation/renderers/__tests__/staff-renderer.test.ts --exclude '.worktrees/**'`. Expected: FAIL. The old builder has no tuplet or custom beams.

- [ ] **Step 3: Implement**

1. **Imports.** Drop `Accidental`, `Articulation`, `Dot` and `Beam` from the `'vexflow'` import if they become unused. Add:
   ```ts
   import { buildMeasure, drawMeasure, formatMeasure } from '@/lib/playsense-studio/notation/build-measure';
   import { drawSpanSegments, spanSegments, type PlacedNote } from '@/lib/playsense-studio/notation/spans';
   import { keySignatureName } from '@/lib/playsense-studio/notation/accidentals';
   ```
2. **Ledger headroom regex** (~line 481): change `/^([a-g])(?:#|b)?\/(-?\d+)$/` to `/^([a-g])(?:##|bb|#|b)?\/(-?\d+)$/`, and include `block.voice2Events` keys in the same scan.
3. **Per placement:**
   - Stave header: `if (p.showHeader) { stave.addClef(block.clef); if (block.keyFifths) stave.addKeySignature(keySignatureName(block.keyFifths)); stave.addTimeSignature(\`${ts[0]}/${ts[1]}\`) }`.
   - On non-header measures: `if (block.clefChanged) stave.addClef(block.clef)` and `if (block.keyChanged) stave.addKeySignature(keySignatureName(block.keyFifths))`.
   - Replace the `formatMeasureVoice` call with:
     ```ts
     const built = buildMeasure([block.events, block.voice2Events], block.timeSignature, block.clef);
     if (!built) continue;
     formatMeasure(built, Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 12));
     drawMeasure(ctx, stave, built);
     block.events.forEach((d, idx) => { allNotes.push({ vexNote: built.notes[0][idx], descriptor: d, system: p.system }); });
     block.events.forEach((d, idx) => placed.push({ id: d.id, note: built.notes[0][idx], system: p.system, hasDynamic: !!d.dynamic }));
     (block.voice2Events ?? []).forEach((d, idx) => placed.push({ id: d.id, note: built.notes[1][idx], system: p.system, hasDynamic: !!d.dynamic }));
     ```
     Declare `const placed: PlacedNote[] = []` next to `allNotes`. The justify width now comes from the stave, so header modifiers such as key signatures of any length never overlap the notes. Remove the old `justify` arithmetic.
   - Add the first measure's key-signature width to the layout's first-measure allowance: in `computePlan`, where `FIRST_MEASURE_EXTRA_WIDTH` is added, also add `Math.abs(firstBlockKeyFifths) * 10`. `firstBlockKeyFifths` is `measureBlocks[0]?.keyFifths ?? 0`; pass it in however the function's call site allows.
4. **Spans:** after the existing tie loop, add `drawSpanSegments(ctx, spanSegments(score.spans, placed));`. `score` is the (repeat-projected) score passed to `mount`.
5. **Remove** the file-local `descriptorToStaveNote`, and replace `formatMeasureVoice` with:
   ```ts
   export function formatMeasureVoice(events: VexEventDescriptor[], timeSignature: [number, number], justifyWidth: number, clef: NotationClef = 'treble') {
     const built = buildMeasure([events], timeSignature, clef);
     if (!built || !built.notes[0].length) return null;
     formatMeasure(built, justifyWidth);
     return { vexNotes: built.notes[0], voice: built.voices[0], beams: built.beams };
   }
   ```
   Import `NotationClef` from score-to-vexflow.

- [ ] **Step 4: Run the renderer tests and the notation suite**

Run: `npx vitest run components/playsense-studio/player lib/playsense-studio --exclude '.worktrees/**'`
Expected: PASS.

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "staff-renderer|build-measure|spans" | head` — must print nothing.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/player/notation/renderers
git commit -m "Draw the student score with the shared builder, key signatures, spans and a second voice"
```

---

### Task 6: Studio strip uses the shared builder

**Files:**
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx`:
  - `MeasureStripItem` (49–63)
  - `MiniStave` (910–1024)
  - the local note builder and `ARTICULATION_CODE` (1026–1046)
  - its imports
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (strip items, ~405–418)

**Interfaces:**
- Consumes: Tasks 1–3, plus the block fields `voice2Events`, `keyFifths`, `keyChanged`, `clefChanged`.
- Produces: `MeasureStripItem` gains `voice2Events: VexEventDescriptor[]`, `keyFifths: number`, `keyChanged: boolean`, `clefChanged: boolean`. `clef` widens to `NotationClef`.

- [ ] **Step 1: Wire the items** (`integrated-editor.tsx`): in the `out.push({...})` for strip items, add `voice2Events: tracked[i].voice2Events, keyFifths: tracked[i].keyFifths, keyChanged: tracked[i].keyChanged, clefChanged: tracked[i].clefChanged,`.

- [ ] **Step 2: Update `MiniStave`**
   - Add props `voice2Events`, `keyFifths`, `keyChanged`, `clefChanged`, and pass them from where `MiniStave` is rendered for an item.
   - Header: `if (isFirst) { stave.addClef(clef); if (keyFifths) stave.addKeySignature(keySignatureName(keyFifths)); stave.addTimeSignature(...) } else { if (clefChanged) stave.addClef(clef); if (keyChanged) stave.addKeySignature(keySignatureName(keyFifths)) }`.
   - Replace the build/format/draw block and the whole triplet `run`/`flushRun` block with:
     ```ts
     const built = buildMeasure([events, voice2Events ?? []], timeSignature, clef);
     if (built) {
       formatMeasure(built, Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 8));
       drawMeasure(ctx, stave, built);
       const vexNotes = built.notes[0];
       // …the existing tie code (intra-measure and partial ties), unchanged, now using vexNotes…
       drawSpanSegments(ctx, spanSegments(spansForMeasure, vexNotes.map((note, i) => ({ id: events[i].id, note, system: 0, hasDynamic: !!events[i].dynamic }))));
       const hits = vexNotes.map((n, i) => { const bb = n.getBoundingBox(); return { eventIndex: i, x: bb.getX(), y: bb.getY(), w: bb.getW(), h: bb.getH() }; });
       onHitsReady(measureIndex, hits);
     }
     ```
   - `spansForMeasure`: add a `spans?: Span[]` prop to `MiniStave` and pass the score's `spans`, threaded from `integrated-editor.tsx` through the strip's props. Spans whose ends fall outside this measure are skipped naturally, because `spanSegments` can't find their ids. That is the accepted P2 limitation: cross-bar slurs in the strip wait for Plan 3's continuous strip.
   - Keep the surrounding `try { … } catch {}` as today.
- [ ] **Step 3: Remove** the file-local `descriptorToStaveNote`, `ARTICULATION_CODE`, and the now-unused VexFlow imports (`Accidental`, `Articulation`, `Beam`, `Dot`, `Tuplet`, `Voice`, `Formatter` if unused). Import `buildMeasure`, `drawMeasure` and `formatMeasure` from `@/lib/playsense-studio/notation/build-measure`, `spanSegments` and `drawSpanSegments` from `@/lib/playsense-studio/notation/spans`, and `keySignatureName` from `@/lib/playsense-studio/notation/accidentals`.

- [ ] **Step 4: Verify**

Run: `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**'` — PASS.

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "editable-measure-strip|integrated-editor" | head` — must print nothing.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/editable-measure-strip.tsx components/playsense-studio/studio/integrated-editor.tsx
git commit -m "Draw the Studio measure strip with the shared builder"
```

---

### Task 7: Preview page, roadmap and verification

**Files:**
- Modify: `app/playsense-preview/notation/page.tsx` (show the reference fixture as well)
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1: Show the reference excerpt on the preview page.**
   - Read `page.tsx` and `notation-preview.tsx` first. The page currently passes a conga fixture into `NotationPreview`, which renders `StaffRenderer` in scroll and wrapped layouts.
   - Render a second `NotationPreview` below it for `REFERENCE_EXCERPT_FIXTURE`, with a heading "Reference excerpt (every mark P2 draws)".
   - If `NotationPreview` takes more than a score prop, mirror what the page passes for the conga fixture.

- [ ] **Step 2: Roadmap.**
   - Under "## Plan 2", add: `**Done YYYY-MM-DD.** Shared builder (notation/build-measure.ts), accidental engine, spans, key signatures, clefs, voice 2 (display only). The continuous single-SVG Studio strip moved to Plan 3 (the strip is rebuilt there); until then strip spans draw within a measure.`
   - Under "## Plan 3", "Measure strip", add: `- one continuous SVG across the visible range (moved from Plan 2), so slurs and hairpins cross barlines in the strip`.
   - In "Carried forward from Plan 1", mark the three P2 items done.

- [ ] **Step 3: Full verification**
   - Run: `npx vitest run --exclude '.worktrees/**'` — every suite passes.
   - Run: `npx tsc --noEmit -p .` — clean.
   - Human check (hand off; no dev server): open `/playsense-preview/notation` and look at the reference excerpt. Expect:
     - a 3:2 bracket and a 5:4 bracket
     - the mp/f/ff glyphs and the crescendo/diminuendo hairpins
     - slurs, the grace note, the trill and fermata
     - a double-dotted quarter and the "dolce" text
     - the F-major key signature from bar 3 with a natural on B
     - the stems-down second voice in bar 4
     - the bass clef in bar 5

- [ ] **Step 4: Commit**

```bash
git add app/playsense-preview/notation docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md
git commit -m "Preview the reference excerpt and mark the notation rendering plan complete"
```
