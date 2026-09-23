# Studio Rework P1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the data and timing foundations the Studio rework needs:
- prove Flex video playback works on real devices
- extend the score model with full single-staff notation
- fix the duration bugs in the renderer and both importers
- make the student engine honour tempo and meter changes

**Architecture:**
- The model change is **additive**. New optional fields sit next to the legacy ones (`dotted`, `triplet`, `articulation`, `spellingHint`), and accessor functions prefer the new field and fall back to the old. Nothing that reads the model today breaks.
- The engine gains an optional per-measure `grid` (start times plus seconds per quarter note). It is built from the score and used wherever it exists. Hand-authored exercises keep today's uniform path.

**Tech Stack:** TypeScript, Next.js 16, zod, VexFlow 5, vitest (jsdom for DOM parsers), Web Audio / HTMLVideoElement.

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` (§4, §7 gate, §8 engine note). Roadmap: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`.

## Global Constraints

- One instrument per score: MusicXML import keeps staff 1 of the first part only (spec §2.2).
- At most 2 voices per measure. MusicXML voices beyond the second are dropped.
- `durationQN` is always the real length, including dots (×1.5, ×1.75) and tuplets (×m/n).
- `schemaVersion` stays `1`. Legacy fields remain valid. When a legacy field can express a value (1 dot → `dotted: true`, 3:2 → `triplet: true`), writers set it too.
- Tempo in the score is quarter notes per minute. The engine's `bpm` is beats of the meter's denominator per minute (`engineBpm = tempo / beatLengthInQN(ts)`, already in `score-to-exercise.ts`).
- Branch `playsense`. Run tests with `npx vitest run <path> --exclude '.worktrees/**'`.
- Commit messages follow the repo style: an imperative sentence, no prefix.

## Review Focus

1. **Scores saved before this plan** (legacy `dotted`/`triplet`/`articulation` only) must render and time exactly as before. Pinned in Task 2 (accessor fallbacks) and Task 7 (a uniform score's timestamps match the old formula).
2. **A MusicXML tuplet with no `<tuplet type="start">` bracket** (many exporters omit it) must still group by counting notes. Pinned in Task 5.
3. **A mixed-value triplet** (a quarter plus an eighth under one bracket) must be one group, not two. Pinned in Task 5.
4. **Malformed new fields in stored JSON** (tuplet `n: 1`, an unknown dynamic) must be rejected by `parseScoreDocument` with a validation error, not crash the renderer. Pinned in Task 2.
5. **A backing track placed after a mid-piece tempo change** must land at the right engine second. Pinned in Task 7.

---

### Task 1: Flex-video spike (throwaway, go/no-go for spec §7)

**Files:**
- Create: `app/(dev)/flex-spike/page.tsx`

**Interfaces:** Nothing from this task is used by later tasks. The result is written into spec §7.

- [ ] **Step 1: Write the spike page**

```tsx
'use client'
// THROWAWAY spike for spec §7. It plays a local video through a synthetic flex
// map by changing playbackRate per 2-second segment, trims drift with a small
// rate correction instead of seeking, and reports the worst drift. Delete it
// once the spec records the result.
import { useEffect, useRef, useState } from 'react'

const RATES = [1, 1.04, 0.96, 1.02, 0.97]
const SEG = 2 // seconds of timeline per segment

function expectedMediaTime(elapsed: number, start: number): number {
  let media = start
  for (let i = 0, t = 0; t < elapsed; i++, t += SEG) media += Math.min(SEG, elapsed - t) * RATES[i % RATES.length]
  return media
}

export default function FlexSpike() {
  const video = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [worst, setWorst] = useState(0)
  const [seeks, setSeeks] = useState(0)

  useEffect(() => {
    const v = video.current
    if (!v || !src) return
    ;(v as HTMLVideoElement & { preservesPitch: boolean }).preservesPitch = true
    let raf = 0, t0 = 0, media0 = 0
    const onPlay = () => { t0 = performance.now(); media0 = v.currentTime; setWorst(0) }
    const onSeeking = () => setSeeks(n => n + 1)
    const tick = () => {
      if (!v.paused && t0) {
        const elapsed = (performance.now() - t0) / 1000
        const want = expectedMediaTime(elapsed, media0)
        const drift = v.currentTime - want
        const segRate = RATES[Math.floor(elapsed / SEG) % RATES.length]
        const trim = Math.max(-0.03, Math.min(0.03, -drift * 0.5))
        const rate = segRate * (1 + trim)
        if (Math.abs(v.playbackRate - rate) > 0.001) v.playbackRate = rate
        setWorst(w => Math.max(w, Math.abs(drift)))
      }
      raf = requestAnimationFrame(tick)
    }
    v.addEventListener('play', onPlay)
    v.addEventListener('seeking', onSeeking)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); v.removeEventListener('play', onPlay); v.removeEventListener('seeking', onSeeking) }
  }, [src])

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 720 }}>
      <h1>Flex video spike</h1>
      <input type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)) }} />
      {src && <video ref={video} src={src} controls playsInline style={{ width: '100%' }} />}
      <p>Worst drift: <b>{Math.round(worst * 1000)} ms</b> · seeks during play: <b>{seeks}</b></p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{typeof navigator !== 'undefined' ? navigator.userAgent : ''}</p>
      <p style={{ fontSize: 12 }}>Pass: worst drift under 60 ms, no seeks after pressing play, no audible clicks or pitch change when the rate switches every 2 s.</p>
    </main>
  )
}
```

- [ ] **Step 2: Run it**

Run `npm run dev -- -p 3007` (port 3000 clashes on this machine) and open `http://localhost:3007/flex-spike`. Load a 60-second lesson video (any demo video from Supabase storage, downloaded) and play it through.

- [ ] **Step 3: Test on the three targets and record results**

Test Safari on macOS, Safari on iOS (open the dev server over the LAN IP, e.g. `http://192.168.x.x:3007/flex-spike`), and Chrome. For each, note the worst drift, the seek count, and whether the rate switches are audible. Append the results to the end of spec §7 like this:

```markdown
- **Spike result (YYYY-MM-DD):** Safari macOS: NN ms / 0 seeks / clean · iOS 18 Safari: … · Chrome: … → **go** or **no-go (audio-only flex fallback)**
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dev)/flex-spike/page.tsx" docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md
git commit -m "Spike flex video playback rates and record the device results"
```

---

### Task 2: Additive score-model fields and accessors

**Files:**
- Modify: `components/playsense-studio/shared/score-model/types.ts`
- Modify: `components/playsense-studio/shared/score-model/serialization.ts`
- Create: `components/playsense-studio/shared/score-model/accessors.ts`
- Test: `lib/playsense-studio/__tests__/score-model-additions.test.ts`

**Interfaces — Produces:**
- types: `Articulation`, `Ornament`, `Dynamic`, `Clef`, `Spelling`, `Tuplet`, `GraceNote`, `Span`
- new optional fields: on `NoteBase` (`id`, `dots`, `tuplet`, `articulations`, `ornament`, `dynamic`, `text`, `grace`), `spelling` on notes, `Measure` (`clef`, `repeatStart`, `repeatEnd`, `volta`, `endBarline: 'double'`), `ScoreDocument.spans`
- accessors:
  - `eventDots(e): 0 | 1 | 2`
  - `eventTuplet(e): { id?: string; n: number; m: number } | null`
  - `tupletScale(e): number`
  - `eventArticulations(e): Articulation[]`
  - `parseSpellingHint(hint?: string): Spelling | null`
  - `eventSpelling(n: { spelling?: Spelling; spellingHint?: string }): Spelling | null`
  - `ensureEventIds(score: ScoreDocument, makeId: () => string): ScoreDocument`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseScoreDocument, ScoreDocumentValidationError } from '@/components/playsense-studio/shared/score-model/serialization'
import type { MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import {
  ensureEventIds, eventArticulations, eventDots, eventSpelling, eventTuplet, parseSpellingHint, tupletScale,
} from '@/components/playsense-studio/shared/score-model/accessors'

function score(events: MusicalEvent[], extra: Partial<ScoreDocument> = {}): ScoreDocument {
  return {
    schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 96, initialTimeSignature: [3, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'Violin', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [{ number: 1, voices: [{ number: 1, events }] }] }],
    ...extra,
  }
}

describe('score model additions', () => {
  it('round-trips every new field through parseScoreDocument', () => {
    const input = score([
      { kind: 'note', id: 'a', midi: 71, durationQN: 1.75, dots: 2, articulations: ['staccato', 'fermata'], ornament: 'trill', dynamic: 'mp', text: 'dolce',
        grace: [{ midi: 73, slash: true }], spelling: { step: 'B', alter: 0, showAccidental: 'always' } },
      { kind: 'note', id: 'b', midi: 76, durationQN: 0.2, tuplet: { id: 't1', n: 5, m: 4 } },
      { kind: 'chord', id: 'c', durationQN: 1.05, notes: [{ midi: 64, spelling: { step: 'E', alter: 0 } }, { midi: 67 }] },
    ], { spans: [{ id: 's1', type: 'slur', from: 'a', to: 'b' }, { id: 's2', type: 'cresc', from: 'a', to: 'c' }] })
    input.tracks[0].measures[0] = { ...input.tracks[0].measures[0], clef: 'alto', repeatStart: true, repeatEnd: true, volta: '1.', endBarline: 'double' }
    expect(parseScoreDocument(JSON.parse(JSON.stringify(input)))).toEqual(input)
  })

  it('rejects malformed new fields instead of passing them to the renderer', () => {
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, tuplet: { id: 't', n: 1, m: 1 } }]))).toThrow(ScoreDocumentValidationError)
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, dynamic: 'loud' as never }]))).toThrow(ScoreDocumentValidationError)
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, dots: 3 as never }]))).toThrow(ScoreDocumentValidationError)
  })

  it('reads legacy fields through the accessors', () => {
    const legacy: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1 / 3, dotted: false, triplet: true, articulation: 'accent', spellingHint: 'Bb' }
    expect(eventDots({ kind: 'rest', durationQN: 1.5, dotted: true })).toBe(1)
    expect(eventTuplet(legacy)).toEqual({ n: 3, m: 2 })
    expect(tupletScale(legacy)).toBeCloseTo(2 / 3, 12)
    expect(eventArticulations(legacy)).toEqual(['accent'])
    expect(eventSpelling(legacy as { spellingHint?: string })).toEqual({ step: 'B', alter: -1 })
  })

  it('prefers new fields over legacy ones', () => {
    const both: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1.75, dotted: true, dots: 2, triplet: true, tuplet: { id: 'x', n: 5, m: 4 }, articulation: 'accent', articulations: ['tenuto'] }
    expect(eventDots(both)).toBe(2)
    expect(eventTuplet(both)).toEqual({ id: 'x', n: 5, m: 4 })
    expect(eventArticulations(both)).toEqual(['tenuto'])
  })

  it('parses spelling hints', () => {
    expect(parseSpellingHint('C#')).toEqual({ step: 'C', alter: 1 })
    expect(parseSpellingHint('ebb')).toEqual({ step: 'E', alter: -2 })
    expect(parseSpellingHint('Fx')).toEqual({ step: 'F', alter: 2 })
    expect(parseSpellingHint('H')).toBeNull()
    expect(parseSpellingHint(undefined)).toBeNull()
  })

  it('assigns missing event ids without mutating or touching existing ones', () => {
    const input = score([{ kind: 'note', id: 'keep', midi: 60, durationQN: 1 }, { kind: 'rest', durationQN: 2 }])
    const before = JSON.stringify(input)
    let n = 0
    const out = ensureEventIds(input, () => `new${++n}`)
    expect(JSON.stringify(input)).toBe(before)
    expect(out.tracks[0].measures[0].voices[0].events.map(e => e.id)).toEqual(['keep', 'new1'])
    expect(ensureEventIds(out, () => 'never')).toBe(out)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run lib/playsense-studio/__tests__/score-model-additions.test.ts --exclude '.worktrees/**'`
Expected: FAIL. The module `accessors` can't be found, and the type errors surface at run time.

- [ ] **Step 3: Add the types** (in `types.ts`, below the `DefaultView` type)

```ts
export type Articulation = 'staccato' | 'staccatissimo' | 'tenuto' | 'accent' | 'marcato' | 'fermata';
export type Ornament = 'trill' | 'mordent' | 'turn';
export type Dynamic = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'fp' | 'sfz';
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion';

/** Written pitch spelling. `showAccidental: 'always'` forces a courtesy accidental. */
export interface Spelling {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  alter: -2 | -1 | 0 | 1 | 2;
  showAccidental?: 'auto' | 'always';
}

/** n notes in the time of m (a triplet is 3:2). Events of one group share `id`. */
export interface Tuplet { id: string; n: number; m: number }

export interface GraceNote { midi: number; spelling?: Spelling; slash: boolean }

/** A line between two events, referenced by event id. */
export interface Span { id: string; type: 'slur' | 'cresc' | 'dim'; from: string; to: string }
```

Add `spans?: Span[];` to `ScoreDocument` after `tracks`.

In `Measure`, change `endBarline` and add the new fields:

```ts
  endBarline?: 'single' | 'final' | 'double';
  clef?: Clef;
  /** Notated repeat signs (display only; written-out passes live in `repeat`). */
  repeatStart?: boolean;
  repeatEnd?: boolean;
  volta?: '1.' | '2.';
```

At the end of `NoteBase`, add:

```ts
  /** Stable id for spans, nudges and flex. Assigned by ensureEventIds. */
  id?: string;
  /** Supersedes `dotted`: read with eventDots(). */
  dots?: 1 | 2;
  /** Supersedes `triplet`: read with eventTuplet(). */
  tuplet?: Tuplet;
  /** Supersedes `articulation`: read with eventArticulations(). */
  articulations?: Articulation[];
  ornament?: Ornament;
  dynamic?: Dynamic;
  text?: string;
  grace?: GraceNote[];
```

Add `spelling?: Spelling;` to `Note` (after `spellingHint`) and to the element type of `Chord.notes`.

- [ ] **Step 4: Add the zod schemas** (`serialization.ts`)

Above `noteBaseShape`, add:

```ts
const spellingSchema = z.object({
  step: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  alter: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]),
  showAccidental: z.enum(['auto', 'always']).optional(),
});
```

At the end of `noteBaseShape`, add:

```ts
  id: z.string().min(1).optional(),
  dots: z.union([z.literal(1), z.literal(2)]).optional(),
  tuplet: z.object({ id: z.string().min(1), n: z.number().int().min(2).max(15), m: z.number().int().min(1).max(16) }).optional(),
  articulations: z.array(z.enum(['staccato', 'staccatissimo', 'tenuto', 'accent', 'marcato', 'fermata'])).max(6).optional(),
  ornament: z.enum(['trill', 'mordent', 'turn']).optional(),
  dynamic: z.enum(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz']).optional(),
  text: z.string().min(1).max(60).optional(),
  grace: z.array(z.object({ midi: z.number().int().min(0).max(127), spelling: spellingSchema.optional(), slash: z.boolean() })).min(1).max(4).optional(),
```

Add `spelling: spellingSchema.optional(),` to `noteSchema` and to the chord `notes` element object.

In `measureSchema`, replace the `endBarline` line and add the new fields:

```ts
  endBarline: z.enum(['single', 'final', 'double']).optional(),
  clef: z.enum(['treble', 'bass', 'alto', 'tenor', 'percussion']).optional(),
  repeatStart: z.boolean().optional(),
  repeatEnd: z.boolean().optional(),
  volta: z.enum(['1.', '2.']).optional(),
```

In `scoreDocumentSchema`, after `tracks`, add:

```ts
  spans: z.array(z.object({ id: z.string().min(1), type: z.enum(['slur', 'cresc', 'dim']), from: z.string().min(1), to: z.string().min(1) })).optional(),
```

- [ ] **Step 5: Write the accessors** (`accessors.ts`)

```ts
// Read the score model's notation fields whether a score was saved before the
// additive fields existed (legacy `dotted`, `triplet`, `articulation`,
// `spellingHint`) or after. New code reads through these, never the raw fields.
import type { Articulation, MusicalEvent, ScoreDocument, Spelling } from './types';

export function eventDots(e: MusicalEvent): 0 | 1 | 2 {
  return e.dots ?? (e.dotted ? 1 : 0);
}

export function eventTuplet(e: MusicalEvent): { id?: string; n: number; m: number } | null {
  if (e.tuplet) return e.tuplet;
  return e.triplet ? { n: 3, m: 2 } : null;
}

/** Factor the tuplet applies to the written value (3:2 → 2/3). */
export function tupletScale(e: MusicalEvent): number {
  const t = eventTuplet(e);
  return t ? t.m / t.n : 1;
}

export function eventArticulations(e: MusicalEvent): Articulation[] {
  if (e.articulations) return e.articulations;
  return e.articulation ? [e.articulation] : [];
}

const HINT = /^([A-Ga-g])(bb|b|##|#|x)?$/;
const ALTER: Record<string, Spelling['alter']> = { bb: -2, b: -1, '#': 1, '##': 2, x: 2 };

export function parseSpellingHint(hint?: string): Spelling | null {
  const m = hint ? HINT.exec(hint.trim()) : null;
  if (!m) return null;
  return { step: m[1].toUpperCase() as Spelling['step'], alter: m[2] ? ALTER[m[2]] : 0 };
}

export function eventSpelling(n: { spelling?: Spelling; spellingHint?: string }): Spelling | null {
  return n.spelling ?? parseSpellingHint(n.spellingHint);
}

/** Give every event an id. Returns the same object when nothing was missing. */
export function ensureEventIds(score: ScoreDocument, makeId: () => string): ScoreDocument {
  const missing = score.tracks.some(t => t.measures.some(m => m.voices.some(v => v.events.some(e => !e.id))));
  if (!missing) return score;
  return {
    ...score,
    tracks: score.tracks.map(t => ({
      ...t,
      measures: t.measures.map(m => ({
        ...m,
        voices: m.voices.map(v => ({ ...v, events: v.events.map(e => (e.id ? e : { ...e, id: makeId() })) })),
      })),
    })),
  };
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run lib/playsense-studio/__tests__/score-model-additions.test.ts --exclude '.worktrees/**'`
Expected: PASS (6 tests).

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "endBarline|score-model" | head`
Expected: no output. If a `switch` on `endBarline` is now non-exhaustive, add a `case 'double':` that behaves like `'single'` in that file (the Studio renders the double barline in Plan 2).

- [ ] **Step 7: Run the whole model-dependent suite**

Run: `npx vitest run lib/playsense-studio lib/play-sense components/playsense-studio --exclude '.worktrees/**'`
Expected: all pass. Every addition is optional, so existing fixtures are unaffected.

- [ ] **Step 8: Commit**

```bash
git add components/playsense-studio/shared/score-model lib/playsense-studio/__tests__/score-model-additions.test.ts
git commit -m "Extend the score model with dots, tuplets, marks, spelling and spans"
```

---

### Task 3: Render triplets and other tuplets with the right note value

**Files:**
- Modify: `lib/playsense-studio/score-to-vexflow.ts:32-60` (`vexflowDurationCode`) and `:268-270` (its only caller, in `extractTrackEvents`)
- Test: `lib/playsense-studio/__tests__/vexflow-duration-code.test.ts`

**Interfaces:**
- Consumes: `eventDots`, `tupletScale` from Task 2.
- Produces: `vexflowDurationCode(durationQN: number, dots?: number | boolean, tupletScale?: number): string`. The boolean form is kept for compatibility.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { vexflowDurationCode } from '../score-to-vexflow'

describe('vexflowDurationCode', () => {
  it('keeps plain and dotted values', () => {
    expect(vexflowDurationCode(1)).toBe('q')
    expect(vexflowDurationCode(1.5, true)).toBe('q')
    expect(vexflowDurationCode(0.75, 1)).toBe('8')
  })
  it('undoes a double dot', () => {
    expect(vexflowDurationCode(1.75, 2)).toBe('q')
    expect(vexflowDurationCode(0.875, 2)).toBe('8')
  })
  it('undoes the tuplet scaling so a triplet eighth is drawn as an eighth', () => {
    expect(vexflowDurationCode(1 / 3, 0, 2 / 3)).toBe('8')      // was '16' before the fix
    expect(vexflowDurationCode(2 / 3, 0, 2 / 3)).toBe('q')      // quarter-note triplet
    expect(vexflowDurationCode(0.2, 0, 4 / 5)).toBe('16')       // quintuplet sixteenth
    expect(vexflowDurationCode(0.125 * 8 / 7, 0, 8 / 7)).toBe('32') // 7:8 thirty-second
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/playsense-studio/__tests__/vexflow-duration-code.test.ts --exclude '.worktrees/**'`
Expected: FAIL on the double-dot and tuplet cases.

- [ ] **Step 3: Implement**

Replace the function header and the `base` line:

```ts
export function vexflowDurationCode(durationQN: number, dots: number | boolean = 0, tupletScale = 1): string {
  // Undo the dot (×1.5 or ×1.75) and the tuplet (×m/n) to get the written value.
  const count = dots === true ? 1 : dots === false ? 0 : dots;
  const dotFactor = count >= 2 ? 1.75 : count === 1 ? 1.5 : 1;
  const base = durationQN / dotFactor / (tupletScale || 1);
```

Update the doc comment's last two lines to: `Dots and tuplets are undone here; the caller still adds Dot modifiers and tuplet brackets.`

In `extractTrackEvents`, change the call and add the import:

```ts
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';
// …
      const durationCode = vexflowDurationCode(event.durationQN, eventDots(event), tupletScale(event));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/playsense-studio --exclude '.worktrees/**'`
Expected: all pass, including the existing notation tests.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/score-to-vexflow.ts lib/playsense-studio/__tests__/vexflow-duration-code.test.ts
git commit -m "Draw triplet and other tuplet notes with their written value"
```

---

### Task 4: PDF import stores real dotted and triplet lengths

**Files:**
- Modify: `lib/playsense-studio/pdf/recognized-score.ts` (`convertEvent`, around line 110)
- Test: `lib/playsense-studio/__tests__/recognized-score.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: `effectiveDurationQN` from `lib/playsense-studio/time-mapping.ts` (exists).
- Produces: nothing new. Events come out with a real `durationQN`, as the rest of the app expects.

- [ ] **Step 1: Write the failing test** (append to the test file; it reuses the file's `note` and `rest` helpers)

```ts
describe('toScoreDocuments — dotted and triplet lengths', () => {
  it('stores the real length so the bar adds up', () => {
    const out: RecognitionOutput = { pieces: [{
      title: 'x', initialTempo: 96, timeSignature: [3, 4], keyFifths: 0,
      tracks: [{ displayName: 'Violin', instrument: 'staff', repeats: [], measures: [
        { timeSignature: null, voices: [{ events: [note({ midi: 71, durationQN: 1, dotted: true }), note({ midi: 69, durationQN: 0.5 }), note({ midi: 67, durationQN: 1 })] }] },
        { timeSignature: null, voices: [{ events: [rest(1), note({ midi: 65, durationQN: 0.5, triplet: true }), note({ midi: 67, durationQN: 0.5, triplet: true }), note({ midi: 69, durationQN: 0.5, triplet: true }), rest(1)] }] },
      ] }],
    }] }
    const [score] = toScoreDocuments(out, { title: 'x' })
    const [m1, m2] = score.tracks[0].measures
    expect(m1.voices[0].events[0]).toMatchObject({ durationQN: 1.5, dotted: true })
    expect(m1.voices[0].events.reduce((s, e) => s + e.durationQN, 0)).toBeCloseTo(3, 9)
    expect(m2.voices[0].events[1].durationQN).toBeCloseTo(1 / 3, 9)
    expect(m2.voices[0].events.reduce((s, e) => s + e.durationQN, 0)).toBeCloseTo(3, 9)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/playsense-studio/__tests__/recognized-score.test.ts --exclude '.worktrees/**'`
Expected: FAIL. `durationQN` is `1` where `1.5` is expected.

- [ ] **Step 3: Implement**

Add `import { effectiveDurationQN } from '../time-mapping';` and change the first two lines of `convertEvent`:

```ts
function convertEvent(instrument: Instrument, event: RecognizedEvent): MusicalEvent | null {
  if (!positive(event.durationQN)) return null;
  // The model returns the written value plus flags (see the prompt); the app stores the real length.
  const durationQN = effectiveDurationQN(event.durationQN, { dotted: event.dotted, triplet: event.triplet });
  const base = { durationQN, ...(event.dotted ? { dotted: true } : {}), ...(event.triplet ? { triplet: true } : {}) };
```

- [ ] **Step 4: Run the PDF tests**

Run: `npx vitest run lib/playsense-studio/__tests__/recognized-score.test.ts lib/playsense-studio/__tests__/pdf-import.test.ts lib/playsense-studio/__tests__/pdf-recognize.test.ts --exclude '.worktrees/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/pdf/recognized-score.ts lib/playsense-studio/__tests__/recognized-score.test.ts
git commit -m "Store real dotted and triplet lengths from PDF recognition"
```

---

### Task 5: MusicXML import — tuplets, ties, two voices, staff 1, spelling

**Files:**
- Modify: `lib/playsense-studio/parsers/musicxml.ts` (the loop in `parsePartMeasures`, lines ~235–305, plus a new helper `readSpelling`)
- Test: `lib/playsense-studio/__tests__/musicxml-import.test.ts`

**Interfaces:**
- Consumes: `Spelling`, `Tuplet` (Task 2).
- Produces: `parsePartMeasures` still returns `Measure[]`; Task 6 changes that. Imported events carry `tuplet`, `dots`, `tieToNext`, `spelling`, and legacy `dotted`/`triplet` where they can express the value. Measures can hold 2 voices.

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseMusicXmlString } from '../parsers/musicxml'

const doc = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
<part id="P1">${measures}</part></score-partwise>`
const attrs = (div: number, beats = 3) => `<attributes><divisions>${div}</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
const note = (o: { step: string; oct: number; type: string; dur: number; voice?: string; alter?: number; extra?: string; staff?: number }) =>
  `<note><pitch><step>${o.step}</step>${o.alter != null ? `<alter>${o.alter}</alter>` : ''}<octave>${o.oct}</octave></pitch><duration>${o.dur}</duration><voice>${o.voice ?? '1'}</voice><type>${o.type}</type>${o.extra ?? ''}${o.staff ? `<staff>${o.staff}</staff>` : ''}</note>`
const tm = (a: number, n: number) => `<time-modification><actual-notes>${a}</actual-notes><normal-notes>${n}</normal-notes></time-modification>`
const events = (xml: string, m = 0, v = 0) => parseMusicXmlString(doc(xml)).tracks[0].measures[m].voices[v].events

describe('MusicXML import — rhythm and voices', () => {
  it('reads triplet eighths as one 3:2 group of real length 1/3', () => {
    const ev = events(`<measure number="1">${attrs(6)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 6 })}` +
      ['F', 'G', 'A'].map(s => note({ step: s, oct: 4, type: 'eighth', dur: 2, extra: tm(3, 2) })).join('') +
      `${note({ step: 'B', oct: 4, type: 'quarter', dur: 6 })}</measure>`)
    expect(ev.slice(1, 4).map(e => e.durationQN)).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(ev[1]).toMatchObject({ triplet: true, tuplet: { n: 3, m: 2 } })
    expect(new Set(ev.slice(1, 4).map(e => e.tuplet!.id)).size).toBe(1)
    expect(ev.reduce((s, e) => s + e.durationQN, 0)).toBeCloseTo(3, 9)
  })

  it('groups by counting when the exporter omits tuplet brackets, and starts a new group after n notes', () => {
    const six = ['C', 'D', 'E', 'F', 'G', 'A'].map(s => note({ step: s, oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) })).join('')
    const ev = events(`<measure number="1">${attrs(6)}${six}${note({ step: 'B', oct: 4, type: 'quarter', dur: 6 })}</measure>`)
    expect(ev[0].tuplet!.id).toBe(ev[2].tuplet!.id)
    expect(ev[3].tuplet!.id).not.toBe(ev[2].tuplet!.id)
  })

  it('keeps a mixed-value bracketed triplet as one group', () => {
    const start = '<notations><tuplet type="start"/></notations>', stop = '<notations><tuplet type="stop"/></notations>'
    const ev = events(`<measure number="1">${attrs(6)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4, extra: tm(3, 2) + start })}${note({ step: 'D', oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) + stop })}${note({ step: 'E', oct: 5, type: 'half', dur: 12 })}</measure>`)
    expect(ev[0].durationQN).toBeCloseTo(2 / 3, 9)
    expect(ev[0].tuplet!.id).toBe(ev[1].tuplet!.id)
  })

  it('reads a quintuplet and a double dot', () => {
    const q = ['E', 'D', 'C', 'B', 'A'].map(s => note({ step: s, oct: 5, type: '16th', dur: 4, extra: tm(5, 4) })).join('')
    const ev = events(`<measure number="1">${attrs(20)}${note({ step: 'D', oct: 6, type: 'quarter', dur: 35, extra: '<dot/><dot/>' })}${note({ step: 'C', oct: 6, type: '16th', dur: 5 })}</measure>`)
    expect(ev[0]).toMatchObject({ durationQN: 1.75, dots: 2 })
    expect(ev[0].dotted).toBeFalsy()
    const ev2 = events(`<measure number="1">${attrs(20)}${q}${note({ step: 'G', oct: 5, type: 'half', dur: 40 })}</measure>`)
    expect(ev2[0]).toMatchObject({ tuplet: { n: 5, m: 4 } })
    expect(ev2[0].durationQN).toBeCloseTo(0.2, 9)
    expect(ev2[0].triplet).toBeFalsy()
  })

  it('reads ties', () => {
    const ev = events(`<measure number="1">${attrs(4)}${note({ step: 'G', oct: 5, type: 'half', dur: 12, extra: '<dot/><tie type="start"/>' })}</measure>`)
    expect(ev[0]).toMatchObject({ tieToNext: true, dotted: true, durationQN: 3 })
  })

  it('splits a second voice using backup instead of appending it', () => {
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${note({ step: 'B', oct: 4, type: 'half', dur: 12, extra: '<dot/>' })}<backup><duration>12</duration></backup>` +
      ['G', 'G', 'G'].map(s => note({ step: s, oct: 4, type: 'quarter', dur: 4, voice: '2' })).join('') + `</measure>`))
    const m = score.tracks[0].measures[0]
    expect(m.voices).toHaveLength(2)
    expect(m.voices[0].events).toHaveLength(1)
    expect(m.voices[1]).toMatchObject({ number: 2 })
    expect(m.voices[1].events).toHaveLength(3)
  })

  it('turns <forward> into a rest in that voice and ignores staff 2', () => {
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4, staff: 1 })}<forward><duration>8</duration><voice>1</voice></forward>${note({ step: 'C', oct: 3, type: 'half', dur: 8, staff: 2, voice: '5' })}</measure>`))
    const v = score.tracks[0].measures[0].voices
    expect(v).toHaveLength(1)
    expect(v[0].events.map(e => e.kind)).toEqual(['note', 'rest'])
    expect(v[0].events[1].durationQN).toBe(2)
  })

  it('keeps written spelling and courtesy accidentals', () => {
    const ev = events(`<measure number="1">${attrs(4)}${note({ step: 'B', oct: 4, alter: -1, type: 'quarter', dur: 4 })}${note({ step: 'E', oct: 5, type: 'quarter', dur: 4, extra: '<accidental cautionary="yes">natural</accidental>' })}${note({ step: 'F', oct: 5, alter: 2, type: 'quarter', dur: 4 })}</measure>`)
    expect(ev[0]).toMatchObject({ midi: 70, spelling: { step: 'B', alter: -1 } })
    expect(ev[1]).toMatchObject({ spelling: { step: 'E', alter: 0, showAccidental: 'always' } })
    expect(ev[2]).toMatchObject({ midi: 79, spelling: { step: 'F', alter: 2 } })
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run lib/playsense-studio/__tests__/musicxml-import.test.ts --exclude '.worktrees/**'`
Expected: FAIL. Durations don't include tuplets, there's no `tuplet`/`spelling`, and voice 2 is appended to voice 1.

- [ ] **Step 3: Add the spelling helper** (below `pitchToMidi`)

```ts
function readSpelling(noteEl: Element): Spelling | undefined {
  const pitch = noteEl.querySelector(':scope > pitch');
  const step = pitch?.querySelector('step')?.textContent?.trim();
  if (!step || !/^[A-G]$/.test(step)) return undefined;
  const alter = Math.max(-2, Math.min(2, Math.round(Number(pitch?.querySelector('alter')?.textContent ?? 0)))) as Spelling['alter'];
  const acc = noteEl.querySelector(':scope > accidental');
  const courtesy = acc && (acc.getAttribute('cautionary') === 'yes' || acc.getAttribute('parentheses') === 'yes');
  return { step: step as Spelling['step'], alter, ...(courtesy ? { showAccidental: 'always' as const } : {}) };
}
```

Extend the type import to include `Spelling` and `Tuplet`.

- [ ] **Step 4: Replace the per-measure event loop**

In `parsePartMeasures`, replace everything from `const events: MusicalEvent[] = [];` down to (but not including) `out.push({` with the following. Then change the `out.push` argument's `voices: [voice],` to `voices,`.

```ts
    // Events are bucketed by MusicXML <voice>, so <backup> needs no handling.
    // Only staff 1 is kept (one instrument, one staff), and at most two voices.
    const byVoice = new Map<string, MusicalEvent[]>();
    const eventsFor = (id: string) => {
      let list = byVoice.get(id);
      if (!list) { list = []; byVoice.set(id, list); }
      return list;
    };
    const openTuplet = new Map<string, { id: string; left: number; bracketed: boolean }>();
    let lastVoice = '1';

    for (const el of Array.from(m.children) as Element[]) {
      if (el.tagName === 'forward') {
        const voiceId = el.querySelector(':scope > voice')?.textContent?.trim() ?? lastVoice;
        const qn = Number(el.querySelector(':scope > duration')?.textContent ?? '0') / divisions;
        if (qn > 0) eventsFor(voiceId).push({ kind: 'rest', durationQN: qn } satisfies Rest);
        continue;
      }
      if (el.tagName !== 'note') continue;
      const noteEl = el;
      if (noteEl.querySelector(':scope > grace')) continue; // grace notes: handled in the marks pass
      const staff = noteEl.querySelector(':scope > staff')?.textContent?.trim();
      if (staff && staff !== '1') continue;
      const voiceId = noteEl.querySelector(':scope > voice')?.textContent?.trim() ?? '1';
      lastVoice = voiceId;
      const events = eventsFor(voiceId);

      const isChordContinuation = noteEl.querySelector(':scope > chord') !== null;
      const isRest = noteEl.querySelector(':scope > rest') !== null;
      const durationQN = Number(noteEl.querySelector(':scope > duration')?.textContent ?? '0') / divisions;
      const typeEl = noteEl.querySelector(':scope > type')?.textContent?.trim();
      const dots = Math.min(2, noteEl.querySelectorAll(':scope > dot').length) as 0 | 1 | 2;
      const tmEl = noteEl.querySelector(':scope > time-modification');
      const actual = Number(tmEl?.querySelector('actual-notes')?.textContent ?? 0);
      const normal = Number(tmEl?.querySelector('normal-notes')?.textContent ?? 0);
      const inTuplet = actual > 1 && normal > 0;
      const dotFactor = dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1;
      // Prefer <type> (reliable across engravings); fall back to the tick length,
      // which already includes dots and tuplet scaling.
      const finalDurationQN = typeEl && TYPE_TO_QN[typeEl] !== undefined
        ? TYPE_TO_QN[typeEl] * dotFactor * (inTuplet ? normal / actual : 1)
        : durationQN;
      const tieStart = noteEl.querySelector(':scope > tie[type="start"]') !== null;

      if (isChordContinuation) {
        const prev = events[events.length - 1];
        if (prev && (prev.kind === 'note' || prev.kind === 'chord')) {
          const pitch = isRest ? null : noteToPitch(noteEl, midiCtx);
          if (pitch !== null) {
            const spelling = readSpelling(noteEl);
            const member = { ...pitch, ...(spelling ? { spelling } : {}), ...(tieStart ? { tieToNext: true } : {}) };
            if (prev.kind === 'note') {
              const { kind: _k, midi, spellingHint, percussion, spelling: prevSpelling, tieToNext, ...rest } = prev;
              const chord: Chord = {
                ...rest, kind: 'chord',
                notes: [{ midi, spellingHint, percussion, ...(prevSpelling ? { spelling: prevSpelling } : {}), ...(tieToNext ? { tieToNext } : {}) }, member],
              };
              events[events.length - 1] = chord;
            } else {
              prev.notes.push(member);
            }
          }
        }
        continue;
      }

      // Tuplet grouping: explicit <tuplet type="start"> brackets win; otherwise count n notes.
      let tuplet: Tuplet | undefined;
      if (inTuplet) {
        const bracketStart = noteEl.querySelector(':scope > notations > tuplet[type="start"]') !== null;
        let open = openTuplet.get(voiceId);
        if (!open || bracketStart || (!open.bracketed && open.left <= 0)) {
          open = { id: `t${idx + 1}-${voiceId}-${events.length}`, left: actual, bracketed: bracketStart };
          openTuplet.set(voiceId, open);
        }
        open.left--;
        tuplet = { id: open.id, n: actual, m: normal };
        if (noteEl.querySelector(':scope > notations > tuplet[type="stop"]')) openTuplet.delete(voiceId);
      } else {
        openTuplet.delete(voiceId);
      }

      const rhythm = {
        durationQN: finalDurationQN,
        dotted: dots === 1,
        ...(dots === 2 ? { dots: 2 as const } : {}),
        ...(tuplet ? { tuplet } : {}),
        ...(tuplet && tuplet.n === 3 && tuplet.m === 2 ? { triplet: true } : {}),
      };

      if (isRest) {
        events.push({ kind: 'rest', ...rhythm } satisfies Rest);
      } else {
        const pitch = noteToPitch(noteEl, midiCtx);
        if (pitch === null) continue;
        const spelling = readSpelling(noteEl);
        events.push({
          kind: 'note', ...pitch, ...rhythm,
          ...(spelling ? { spelling } : {}),
          ...(tieStart ? { tieToNext: true } : {}),
        } satisfies Note);
      }
    }

    const voiceIds = Array.from(byVoice.keys()).slice(0, 2);
    const voices: Voice[] = voiceIds.length
      ? voiceIds.map((id, i) => ({ number: i + 1, events: byVoice.get(id)! }))
      : [{ number: 1, events: [] }];
```

- [ ] **Step 5: Run the new tests and the percussion import tests**

Run: `npx vitest run lib/playsense-studio/__tests__/musicxml-import.test.ts lib/playsense-studio/__tests__/percussion-import.test.ts --exclude '.worktrees/**'`
Expected: PASS. If a percussion test fails because a `dotted: false` event now has other shape changes, update only its `toEqual` to `toMatchObject`; its intent (strokes and positions) must still hold.

- [ ] **Step 6: Commit**

```bash
git add lib/playsense-studio/parsers/musicxml.ts lib/playsense-studio/__tests__/musicxml-import.test.ts
git commit -m "Import MusicXML tuplets, ties, second voices and pitch spelling"
```

---

### Task 6: MusicXML import — grace notes, articulations, ornaments, dynamics, words, hairpins, slurs

**Files:**
- Modify: `lib/playsense-studio/parsers/musicxml.ts`
- Test: `lib/playsense-studio/__tests__/musicxml-import.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: Task 5's loop, and `Span`, `Articulation`, `Ornament`, `Dynamic`, `GraceNote` (Task 2).
- Produces: `parsePartMeasures(part, initialTimeSignature, instrument, instrumentGm, ids: { next(): string }): { measures: Measure[]; spans: Span[] }`. Every imported event gets an `id` from `ids.next()`, and `parseMusicXmlString` sets `score.spans` when there are any.

- [ ] **Step 1: Write the failing tests** (append; reuses Task 5's helpers)

```ts
describe('MusicXML import — marks', () => {
  const dir = (inner: string, voice = '1') => `<direction placement="below"><direction-type>${inner}</direction-type><voice>${voice}</voice></direction>`

  it('reads articulations, ornaments and fermatas', () => {
    const ev = events(`<measure number="1">${attrs(4)}` +
      note({ step: 'A', oct: 4, type: 'quarter', dur: 4, extra: '<notations><articulations><staccato/><accent/></articulations></notations>' }) +
      note({ step: 'B', oct: 4, type: 'quarter', dur: 4, extra: '<notations><articulations><strong-accent/><tenuto/></articulations><ornaments><trill-mark/></ornaments></notations>' }) +
      note({ step: 'C', oct: 5, type: 'quarter', dur: 4, extra: '<notations><fermata/><ornaments><inverted-mordent/></ornaments></notations>' }) + `</measure>`)
    expect(ev[0].articulations).toEqual(['staccato', 'accent'])
    expect(ev[1]).toMatchObject({ articulations: ['marcato', 'tenuto'], ornament: 'trill' })
    expect(ev[2]).toMatchObject({ articulations: ['fermata'], ornament: 'mordent' })
  })

  it('attaches grace notes to the next note without taking time', () => {
    const grace = `<note><grace slash="yes"/><pitch><step>C</step><alter>1</alter><octave>6</octave></pitch><voice>1</voice><type>eighth</type></note>`
    const ev = events(`<measure number="1">${attrs(4)}${grace}${note({ step: 'D', oct: 6, type: 'half', dur: 8, extra: '<dot/>' })}</measure>`)
    expect(ev).toHaveLength(1)
    expect(ev[0].grace).toEqual([{ midi: 85, spelling: { step: 'C', alter: 1 }, slash: true }])
  })

  it('puts dynamics and words on the next note of their voice', () => {
    const ev = events(`<measure number="1">${attrs(4)}${dir('<dynamics><mp/></dynamics>')}${dir('<words>div.</words>')}${note({ step: 'B', oct: 4, type: 'half', dur: 8 })}${note({ step: 'D', oct: 5, type: 'quarter', dur: 4 })}</measure>`)
    expect(ev[0]).toMatchObject({ dynamic: 'mp', text: 'div.' })
    expect(ev[1].dynamic).toBeUndefined()
  })

  it('turns wedges and slurs into spans between event ids, across barlines', () => {
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}${dir('<wedge type="crescendo"/>')}${note({ step: 'F', oct: 4, type: 'quarter', dur: 4, extra: '<notations><slur type="start" number="1"/></notations>' })}${note({ step: 'G', oct: 4, type: 'half', dur: 8 })}${dir('<wedge type="stop"/>')}</measure>` +
      `<measure number="2">${note({ step: 'A', oct: 4, type: 'half', dur: 12, extra: '<dot/><notations><slur type="stop" number="1"/></notations>' })}</measure>`))
    const [m1, m2] = score.tracks[0].measures
    const [f, g] = m1.voices[0].events
    const a = m2.voices[0].events[0]
    expect(f.id && g.id && a.id).toBeTruthy()
    expect(score.spans).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'cresc', from: f.id, to: g.id }),
      expect.objectContaining({ type: 'slur', from: f.id, to: a.id }),
    ]))
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run lib/playsense-studio/__tests__/musicxml-import.test.ts --exclude '.worktrees/**'`
Expected: FAIL in the 4 new tests. The grace note is currently skipped, and there are no marks or spans.

- [ ] **Step 3: Implement the marks pass**

1. Add the tables and helper near `TYPE_TO_QN`:

```ts
const ARTIC: Record<string, Articulation> = { staccato: 'staccato', staccatissimo: 'staccatissimo', tenuto: 'tenuto', accent: 'accent', 'strong-accent': 'marcato' };
const ORN: Record<string, Ornament> = { 'trill-mark': 'trill', mordent: 'mordent', 'inverted-mordent': 'mordent', turn: 'turn', 'inverted-turn': 'turn' };
const DYN = new Set<Dynamic>(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz']);

function readMarks(noteEl: Element): { articulations?: Articulation[]; ornament?: Ornament } {
  const arts = Array.from(noteEl.querySelectorAll(':scope > notations > articulations > *')).map(a => ARTIC[a.tagName]).filter(Boolean);
  if (noteEl.querySelector(':scope > notations > fermata')) arts.push('fermata');
  const orn = Array.from(noteEl.querySelectorAll(':scope > notations > ornaments > *')).map(o => ORN[o.tagName]).find(Boolean);
  return { ...(arts.length ? { articulations: arts } : {}), ...(orn ? { ornament: orn } : {}) };
}
```

2. Change `parsePartMeasures`:
   - Add the parameter `ids: { next(): string }` and return `{ measures: out, spans }`.
   - At the top, declare:
     ```ts
     const spans: Span[] = [];
     const openSlurs = new Map<string, string>();
     let openWedge: { type: 'cresc' | 'dim'; from?: string } | null = null;
     let lastEventId: string | undefined;
     ```
   - At the top of each measure, declare:
     ```ts
     const pendingGrace = new Map<string, GraceNote[]>();
     const pendingDir = new Map<string, { dynamic?: Dynamic; text?: string }>();
     ```

3. In the child loop, before `if (el.tagName !== 'note') continue;`, handle directions:

```ts
      if (el.tagName === 'direction') {
        const voiceId = el.querySelector(':scope > voice')?.textContent?.trim() ?? '1';
        const p = pendingDir.get(voiceId) ?? {};
        const dyn = el.querySelector('direction-type > dynamics > *')?.tagName as Dynamic | undefined;
        if (dyn && DYN.has(dyn)) p.dynamic = dyn;
        const words = el.querySelector('direction-type > words')?.textContent?.trim();
        if (words) p.text = words.slice(0, 60);
        pendingDir.set(voiceId, p);
        const wedge = el.querySelector('direction-type > wedge')?.getAttribute('type');
        if (wedge === 'crescendo' || wedge === 'diminuendo') openWedge = { type: wedge === 'crescendo' ? 'cresc' : 'dim' };
        if (wedge === 'stop' && openWedge?.from && lastEventId && lastEventId !== openWedge.from) {
          spans.push({ id: ids.next(), type: openWedge.type, from: openWedge.from, to: lastEventId });
          openWedge = null;
        }
        continue;
      }
```

4. Delete `if (noteEl.querySelector(':scope > grace')) continue;`. Insert this grace collector immediately after `lastVoice = voiceId;` and before `const events = eventsFor(voiceId);`, so a grace note never creates an empty voice:

```ts
      if (noteEl.querySelector(':scope > grace')) {
        const midi = pitchToMidi(noteEl);
        if (midi !== null) {
          const spelling = readSpelling(noteEl);
          const list = pendingGrace.get(voiceId) ?? [];
          list.push({ midi, ...(spelling ? { spelling } : {}), slash: noteEl.querySelector(':scope > grace')!.getAttribute('slash') === 'yes' });
          pendingGrace.set(voiceId, list);
        }
        continue;
      }
```

5. Give every pushed rest and note an id and its marks, and consume pending state. Replace the `if (isRest) {…} else {…}` block with:

```ts
      const id = ids.next();
      if (isRest) {
        events.push({ kind: 'rest', id, ...rhythm } satisfies Rest);
      } else {
        const pitch = noteToPitch(noteEl, midiCtx);
        if (pitch === null) continue;
        const spelling = readSpelling(noteEl);
        const dirs = pendingDir.get(voiceId); pendingDir.delete(voiceId);
        const grace = pendingGrace.get(voiceId); pendingGrace.delete(voiceId);
        events.push({
          kind: 'note', id, ...pitch, ...rhythm, ...readMarks(noteEl),
          ...(spelling ? { spelling } : {}),
          ...(tieStart ? { tieToNext: true } : {}),
          ...(dirs?.dynamic ? { dynamic: dirs.dynamic } : {}),
          ...(dirs?.text ? { text: dirs.text } : {}),
          ...(grace?.length ? { grace } : {}),
        } satisfies Note);
        for (const s of Array.from(noteEl.querySelectorAll(':scope > notations > slur'))) {
          const num = s.getAttribute('number') ?? '1';
          if (s.getAttribute('type') === 'start') openSlurs.set(num, id);
          else if (s.getAttribute('type') === 'stop' && openSlurs.has(num)) { spans.push({ id: ids.next(), type: 'slur', from: openSlurs.get(num)!, to: id }); openSlurs.delete(num); }
        }
        if (openWedge && !openWedge.from) openWedge.from = id;
      }
      lastEventId = id;
```

   Also add `id: ids.next()` to the `<forward>` rest.

6. In `parseMusicXmlString`:
   - Create `let seq = 0; const ids = { next: () => \`x${++seq}\` };` before the parts loop.
   - Call `const { measures, spans } = parsePartMeasures(part, initialTimeSignature, info.instrument, info.instrumentGm, ids);`.
   - Collect `allSpans.push(...spans)`, with `const allSpans: Span[] = [];` declared next to `tracks`.
   - Add `...(allSpans.length ? { spans: allSpans } : {}),` to the returned score object.

   Extend the type imports with `Articulation, Ornament, Dynamic, GraceNote, Span`.

- [ ] **Step 4: Run the MusicXML and percussion tests**

Run: `npx vitest run lib/playsense-studio/__tests__/musicxml-import.test.ts lib/playsense-studio/__tests__/percussion-import.test.ts --exclude '.worktrees/**'`
Expected: PASS. Imported percussion events now carry `id`. If a percussion `toEqual` fails only because of `id`, switch that assertion to `toMatchObject`.

- [ ] **Step 5: Confirm the imported score validates**

Add to the marks `describe`:

```ts
  it('produces a document that parseScoreDocument accepts', async () => {
    const { parseScoreDocument } = await import('@/components/playsense-studio/shared/score-model/serialization')
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${dir('<dynamics><f/></dynamics>')}${note({ step: 'E', oct: 5, type: 'quarter', dur: 4, extra: '<notations><slur type="start"/></notations>' })}${note({ step: 'G', oct: 5, type: 'half', dur: 8, extra: '<notations><slur type="stop"/></notations>' })}</measure>`))
    expect(() => parseScoreDocument(JSON.parse(JSON.stringify(score)))).not.toThrow()
  })
```

Run the same command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/playsense-studio/parsers/musicxml.ts lib/playsense-studio/__tests__/musicxml-import.test.ts lib/playsense-studio/__tests__/percussion-import.test.ts
git commit -m "Import grace notes, articulations, dynamics, words, hairpins and slurs from MusicXML"
```

---

### Task 7: Engine honours tempo and meter changes

**Files:**
- Modify: `lib/play-sense/types.ts` (`ExerciseDefinition`)
- Modify: `lib/play-sense/exercise-utils.ts` (`beatToTimestamp`, `generateExpectedTimestamps`, `getExerciseDuration`, plus a new `getLoopDuration`)
- Modify: `lib/play-sense/score-to-exercise.ts` (build the grid)
- Modify: `lib/play-sense/backing-track-timing.ts` (use the grid)
- Modify: `lib/play-sense/fretboard-utils.ts:102` (pass the grid)
- Modify: `hooks/use-exercise-session.ts:231,749` (use `getLoopDuration`)
- Modify: `components/class-viewer/lesson-viewer/score-exercise-game.tsx:133` (pass the grid)
- Test: `lib/play-sense/__tests__/exercise-grid.test.ts`, `lib/play-sense/__tests__/backing-track-timing.test.ts` (add a case)

**Interfaces — Produces:**

```ts
// lib/play-sense/types.ts
export interface ExerciseGrid {
  /** Seconds from beat 1 of measure 1 to the start of each measure; length measures + 1 (last = one loop). */
  measureStartSec: number[]
  /** Quarter notes from the start to each measure; same length as measureStartSec. */
  measureStartQN: number[]
  /** Seconds per quarter note in each measure; length measures. */
  secPerQN: number[]
  /** Quarter notes per engine beat (the meter's denominator unit) in each measure; length measures. */
  beatQN: number[]
}
// ExerciseDefinition gains: grid?: ExerciseGrid
// exercise-utils: beatToTimestamp(event, bpm, ts, loopIndex?, totalMeasures?, swing?, grid?) ; getLoopDuration(exercise): number
// score-to-exercise: exported buildExerciseGrid(score, track): ExerciseGrid
// backing-track-timing: EngineGrid gains grid?: ExerciseGrid
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { scoreToExerciseDefinition, buildExerciseGrid } from '../score-to-exercise'
import { generateExpectedTimestamps, getExerciseDuration, getLoopDuration } from '../exercise-utils'
import type { ScoreDocument, MusicalEvent } from '@/components/playsense-studio/shared/score-model/types'
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

const q = (midi: number, durationQN = 1): MusicalEvent => ({ kind: 'note', midi, durationQN })

// Bars 1–2: 4/4 at ♩=120 (2 s each). Bar 3: 6/8 at ♩=90 (3 qn × 0.667 s = 2 s).
const changing: ScoreDocument = {
  schemaVersion: 1, title: 'x', sourceFormat: 'native', initialTempo: 120, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'guitar', displayName: 'g', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, voices: [{ number: 1, events: [q(60), q(62), q(64), q(65)] }] },
    { number: 2, voices: [{ number: 1, events: [q(67, 4)] }] },
    { number: 3, timeSignature: [6, 8], tempoChange: 90, voices: [{ number: 1, events: [q(60, 1.5), q(64, 1.5)] }] },
  ] }],
}

describe('exercise grid (tempo and meter changes)', () => {
  it('builds measure starts in seconds and quarter notes', () => {
    const g = buildExerciseGrid(changing, changing.tracks[0])
    expect(g.measureStartSec).toEqual([0, 2, 4, 6])
    expect(g.measureStartQN).toEqual([0, 4, 8, 11])
    expect(g.beatQN).toEqual([1, 1, 0.5])
    expect(g.secPerQN[2]).toBeCloseTo(60 / 90, 12)
  })

  it('times notes after the change on the new tempo and meter', () => {
    const ex = scoreToExerciseDefinition(changing)
    const t = generateExpectedTimestamps(ex).map(e => e.timestamp)
    expect(t.slice(0, 5)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(t[5]).toBeCloseTo(4, 9)
    expect(t[6]).toBeCloseTo(4 + 1.5 * (60 / 90), 9) // dotted-quarter later, at ♩=90
    expect(getExerciseDuration(ex)).toBeCloseTo(6, 9)
    expect(getLoopDuration(ex)).toBeCloseTo(6, 9)
  })

  it('gives a uniform score the same timestamps as the old formula', () => {
    const ex = scoreToExerciseDefinition(GUITAR_LICK_FIXTURE)
    const withGrid = generateExpectedTimestamps(ex).map(e => e.timestamp)
    const legacy = generateExpectedTimestamps({ ...ex, grid: undefined }).map(e => e.timestamp)
    expect(withGrid).toHaveLength(legacy.length)
    withGrid.forEach((v, i) => expect(v).toBeCloseTo(legacy[i], 9))
    expect(getLoopDuration(ex)).toBeCloseTo(getLoopDuration({ ...ex, grid: undefined }), 9)
  })
})
```

Also append to `lib/play-sense/__tests__/backing-track-timing.test.ts`:

```ts
describe('timelineToEngineSeconds with a tempo change', () => {
  it('uses the grid when the exercise has one', async () => {
    const { timelineToEngineSeconds } = await import('../backing-track-timing')
    const grid = { measureStartSec: [0, 2, 4, 6], measureStartQN: [0, 4, 8, 11], secPerQN: [0.5, 0.5, 60 / 90], beatQN: [1, 1, 0.5] }
    const map = { toMusicalPosition: (s: number) => s } // pretend video seconds == qn
    // 9.5 qn is 1.5 qn into bar 3 (♩=90): 4 s + 1.5 × 0.667 s = 5 s
    expect(timelineToEngineSeconds(9.5, map, { bpm: 120, timeSignature: [4, 4], grid })).toBeCloseTo(5, 9)
    // before the start: extrapolate with bar 1's tempo
    expect(timelineToEngineSeconds(-2, map, { bpm: 120, timeSignature: [4, 4], grid })).toBeCloseTo(-1, 9)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run lib/play-sense/__tests__/exercise-grid.test.ts lib/play-sense/__tests__/backing-track-timing.test.ts --exclude '.worktrees/**'`
Expected: FAIL. `buildExerciseGrid` and `getLoopDuration` don't exist.

- [ ] **Step 3: Add the type** (`lib/play-sense/types.ts`)

Paste the `ExerciseGrid` interface from **Interfaces** above `ExerciseDefinition`, and add this field inside `ExerciseDefinition`:

```ts
  /** Per-measure timing for scores with tempo or meter changes. Absent for hand-authored exercises. */
  grid?: ExerciseGrid
```

- [ ] **Step 4: Build the grid** (`lib/play-sense/score-to-exercise.ts`)

```ts
export function buildExerciseGrid(score: ScoreDocument, track: Track): ExerciseGrid {
  const measureStartSec = [0], measureStartQN = [0], secPerQN: number[] = [], beatQN: number[] = []
  let ts = score.initialTimeSignature
  let tempo = score.initialTempo
  for (const m of track.measures) {
    if (m.timeSignature) ts = m.timeSignature
    if (m.tempoChange) tempo = m.tempoChange
    const spq = 60 / tempo
    const bar = measureLengthInQN(ts)
    secPerQN.push(spq)
    beatQN.push(beatLengthInQN(ts))
    measureStartSec.push(measureStartSec[measureStartSec.length - 1] + bar * spq)
    measureStartQN.push(measureStartQN[measureStartQN.length - 1] + bar)
  }
  return { measureStartSec, measureStartQN, secPerQN, beatQN }
}
```

Import `ExerciseGrid` from `./types`. In the final `return` of `scoreToExerciseDefinition`, add `grid: buildExerciseGrid(score, track),`.

- [ ] **Step 5: Use the grid in `exercise-utils.ts`**

In `beatToTimestamp`, add the parameter `grid?: ExerciseGrid` (import the type) after `swing`, and put this at the top of the body:

```ts
  if (grid) {
    const i = Math.min(Math.max(event.measure - 1, 0), grid.secPerQN.length - 1)
    const beatSec = grid.beatQN[i] * grid.secPerQN[i]
    const loopLen = grid.measureStartSec[grid.measureStartSec.length - 1]
    let t = loopIndex * loopLen + grid.measureStartSec[i] + (event.beat - 1) * beatSec
    if (swing > 0 && Math.abs(((event.beat - 1) % 1) - 0.5) < 0.01) t += (swing / 100) * beatSec * 0.5
    return t
  }
```

In `generateExpectedTimestamps`, pass `exercise.grid` as the 7th argument. Change `expectedDurationSec` to:

```ts
        expectedDurationSec: event.duration * (exercise.grid
          ? exercise.grid.beatQN[event.measure - 1] * exercise.grid.secPerQN[event.measure - 1]
          : beatDuration),
```

Replace `getExerciseDuration` and add `getLoopDuration`:

```ts
/** One pass of the exercise, in seconds. */
export function getLoopDuration(exercise: ExerciseDefinition): number {
  if (exercise.grid) return exercise.grid.measureStartSec[exercise.grid.measureStartSec.length - 1]
  return (exercise.measures * exercise.timeSignature[0] * 60) / exercise.bpm
}

/** Total exercise duration in seconds (including all loops). */
export function getExerciseDuration(exercise: ExerciseDefinition): number {
  return getLoopDuration(exercise) * exercise.loopCount
}
```

- [ ] **Step 6: Pass the grid to every caller**

- `lib/play-sense/fretboard-utils.ts:102`: add `exercise.grid` as the 7th argument to `beatToTimestamp(`. If fewer than 6 arguments are passed today, add `undefined` for the missing ones first.
- `hooks/use-exercise-session.ts`:
  - Import `getLoopDuration`.
  - Replace line ~231's `(exercise.measures * exercise.timeSignature[0] * 60) / exercise.bpm` with `getLoopDuration(exercise)`.
  - Replace lines ~747–749 (`beatsPerMeasure`/`singleLoopBeats`/`singleLoopDurationRef.current = …`) with `singleLoopDurationRef.current = getLoopDuration(exercise)`. Keep `const beatsPerMeasure = exercise.timeSignature[0]`, since the count-in still uses it.
- `lib/play-sense/backing-track-timing.ts`:
  - Add `grid?: ExerciseGrid` to `EngineGrid`.
  - In `timelineToEngineSeconds`, right after `const quarterNotes = map.toMusicalPosition(timelineSeconds); if (!Number.isFinite(quarterNotes)) return 0;`, insert:

```ts
  if (grid.grid) {
    const g = grid.grid
    const last = g.secPerQN.length - 1
    if (quarterNotes < 0) return quarterNotes * g.secPerQN[0]
    let i = 0
    while (i < last && quarterNotes >= g.measureStartQN[i + 1]) i++
    return g.measureStartSec[i] + (quarterNotes - g.measureStartQN[i]) * g.secPerQN[i]
  }
```

  Also delete the "KNOWN LIMITATION" paragraph from the header comment.
- `components/class-viewer/lesson-viewer/score-exercise-game.tsx:133`: change `{ bpm: exercise.bpm, timeSignature: exercise.timeSignature }` to `{ bpm: exercise.bpm, timeSignature: exercise.timeSignature, grid: exercise.grid }`, and add `exercise.grid` to that `useMemo`'s dependency list (line ~140).

- [ ] **Step 7: Run the engine, hook and highway suites**

Run: `npx vitest run lib/play-sense hooks components/class-viewer components/play-sense --exclude '.worktrees/**'`
Expected: all pass.

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "exercise-utils|score-to-exercise|backing-track-timing|fretboard-utils|use-exercise-session|score-exercise-game" | head`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add lib/play-sense hooks/use-exercise-session.ts components/class-viewer/lesson-viewer/score-exercise-game.tsx
git commit -m "Time graded exercises through tempo and meter changes"
```

---

### Task 8: Plan-level verification

**Files:** none new.

- [ ] **Step 1: Full test run and type check**

Run: `npx vitest run --exclude '.worktrees/**'`
Expected: every suite passes.

Run: `npx tsc --noEmit -p .`
Expected: no new errors in any file this plan touched.

- [ ] **Step 2: Browser check (Chrome MCP, dev server on port 3007, hosted dev DB)**

1. Open a live EXERCISE lesson (e.g. "Cáscara – Right Hand") as a student. Play it: the notes and count-in are unchanged, and the count-in click is audible.
2. In the Studio, import a MusicXML file with triplets and a second voice, e.g. export the reference-image excerpt from MuseScore. Confirm the triplets draw as eighths with a "3" and the bars add up.

- [ ] **Step 3: Record the plan result in the roadmap**

Add under "Plan 1" in the roadmap: `**Done YYYY-MM-DD**, with the spike result and any follow-ups found.`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md
git commit -m "Mark Studio rework foundation plan complete"
```
