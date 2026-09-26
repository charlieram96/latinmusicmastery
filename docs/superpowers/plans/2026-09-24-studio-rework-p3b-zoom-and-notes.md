# Studio rework P3b — measure zoom and note editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin Studio a measure zoom for editing notes. It includes:
- keyboard entry (A–G, durations 1–7, rests, dots, tuplets, ties, slurs)
- a floating note toolbar with More ▾ tabs for every mark in the spec
- pitch drag and pencil entry, and voice 1 / voice 2 editing
- span editing that reaches every repeat pass

It also closes the notation follow-ups left over from Plan 3a.

**Architecture:** Behaviour follows the approved v6 prototype, which is the reference implementation. Its functions `enterLetter`, `advanceN`, `applyTuplet`, `addSpan` and `transposeSel` are quoted where relevant. The work is layered:
- **Pure logic:** pitch, rhythm, cursor and key-intent rules live in `lib/playsense-studio/*.ts` modules with full unit tests.
- **Reducer:** new voice-aware actions in `lib/playsense-studio/editor-state.ts`, all going through `withHistory`, so repeat propagation keeps working.
- **UI:** a `MeasureZoom` overlay with its toolbar and menus under `components/playsense-studio/studio/zoom/`. `IntegratedEditor` opens it in place of Plan 3a's placeholder `openMeasure` zoom.

The old one-row insert toolbar is retired at the end.

**Tech Stack:** Next.js 16, React 19, TypeScript, VexFlow 5, lucide-react, vitest + jsdom (no testing-library).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md`: §6 "Measure zoom", §2.3 (full notation), §2.7 (only voice 1 is graded). The prototype of record is v6 (https://claude.ai/artifact/Nr2Mc37Kv1oMYxxUZvYd11). The roadmap is `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`, section "Plan 3b (next)".

## Global Constraints

- **Zoom open** (spec §6):
  - The bar animates up to fill the strip, with its neighbours as dimmed slivers. The slivers are grid columns `minmax(56px, 13%)`, shown at 35% opacity (70% on hover).
  - The waveform zooms so the bar fills 56% of its width: `pps = min(600, W*0.56/span)`.
  - Beats are shaded 1-2-3 (odd beats `rgba(255,255,255,.022)`, each with a 1-based label). A fill meter 8 px tall shows one segment per event and turns red when the bar is over.
- **Zoom timings:**
  - The zoom enters over 340 ms `cubic-bezier(.2,.8,.2,1)` from the bar's rectangle, opacity .3 → 1, and exits over 240 ms `cubic-bezier(.4,0,.8,.4)`.
  - Moving to the next bar slides 40 px over 220 ms ease-out.
  - All of these are instant under `prefers-reduced-motion: reduce`.
- **Note toolbar, in order:**
  1. an info chip
  2. whole, half, quarter, 8th and 16th
  3. dot
  4. rest
  5. tie
  6. a separator
  7. ♭ ♮ ♯
  8. a separator
  9. triplet "3"
  10. More ▾
  11. delete, shown only when a note is selected
- **More ▾ tabs, in order:**
  - **Durations:** 32nd, 64th, double dot, 𝄫, 𝄪.
  - **Tuplets:** 3:2, 5:4, 6:4, 7:8, 3:4. Picking the active one again undoes it.
  - **Marks:** staccato, staccatissimo, tenuto, accent, marcato, fermata; trill, mordent, turn; acciaccatura, appoggiatura.
  - **Dynamics:** ppp pp p mp mf f ff fff fp sfz, plus Crescendo, Diminuendo and Slur.
  - **Text:** an input plus the chips dolce, pizz., arco, div., a tempo, rit., montuno, solo.
  - **Timing:** "Plays at", a ±5 ms nudge, and Reset.
- **Keys inside the zoom:**
  - **Pitch:** A–G enters a note (at the nearest octave to the previous note); ⇧+letter adds it to a chord.
  - **Duration and rhythm:**
    - 1 = 64th, 2 = 32nd, 3 = 16th, 4 = 8th, 5 = quarter, 6 = half, 7 = whole
    - R or 0 = rest
    - `.` cycles dots (0 → 1 → 2 → 0)
    - T = 3:2 triplet
    - `+` = tie
  - **Navigation:**
    - ←/→ walk the cursor, crossing bars; ⇧ extends the selection
    - ↑/↓ = diatonic step; ⇧ = semitone; ⌘ = octave
    - ⌘←/→ = previous/next bar
  - **Other:** S = slur; ⌫/Delete deletes; N = pencil; Esc closes the popover, then the zoom.
  - `[` / `]` already nudge through SyncPanel. K (piano) and MIDI belong to Plan 7.
- **Voice 1 only drives grading** (spec §2.7). Voice 2 is editable in the zoom but never graded: edits to voice 2 must leave `voices[0]` byte-identical.
- **Repeats:** an edit to any pass reaches every pass (spec §6, "Repeats"). That includes the new marks and tuplets (content propagation), and spans (mirrored with `passEventId`).
- **Clicks in the strip never add or change notes** (Plan 3a). Pitch drag moves from the strip into the zoom.
- **Percussion tracks:** A–G does nothing (a flash says "Pick a stroke in the toolbar"). Entry uses the stroke buttons in the note toolbar. Durations, rests, dots, tuplets and ties work as usual.
- **Tests, commits and copy:** component tests use `// @vitest-environment jsdom`, with `createRoot` + `act`, `IS_REACT_ACT_ENVIRONMENT`, and pointer events faked as `MouseEvent` plus `pointerId`. Stub the VexFlow canvas `measureText` as `notation-build-measure.test.ts` does, stub `ResizeObserver`, and stub `requestAnimationFrame` where needed.
  - Run tests with `npx vitest run <path> --exclude '.worktrees/**'`, and `npx tsc --noEmit -p .`.
  - Commits are an imperative sentence with no prefix, followed by a blank line and the executing model's `Co-Authored-By` trailer.
  - NEVER use `git stash`, because the stash stack is shared. Stage only your own files, by path.
  - Use the curly apostrophe (’) in user-facing copy.

## Review Focus

1. **Typing into a full bar never overflows it and never silently drops the note.** An append that doesn't fit is refused, with a flash "m.N is full — shorten a note or pick a smaller value". Tasks 3 and 7 pin this.
2. **Repeats:** editing a mark, tuplet or slur on any pass of a repeat reaches every pass, and the group stays a group. Task 4 pins this.
3. **Grading safety:** a voice-2 edit (enter, delete, transpose, tuplet) leaves `voices[0]` deep-equal to before, so graded content is untouched. Task 3 pins this.
4. **Percussion:** letter keys on a percussion track never create a pitched note. Task 7 pins this.
5. **Text entry:** typing text into the Text tab's input (e.g. "dolce") or the rail's title field never enters notes or moves the cursor. Tasks 7 and 9 pin this.

---

## File map

| File | Responsibility |
|---|---|
| `lib/playsense-studio/pitch.ts` | shared pitch rules: letters, nearest octave, diatonic/semitone/octave steps, names (Task 1) |
| `lib/playsense-studio/rhythm.ts` | written note values, dots, tuplet sounding lengths (Task 2) |
| `lib/playsense-studio/editor-state.ts` | voice-aware note-entry actions (Task 3); marks, tuplets and spans (Task 4) |
| `lib/playsense-studio/note-cursor.ts` | the zoom cursor: position, advance, walk, range (Task 5) |
| `components/playsense-studio/studio/zoom/measure-zoom.tsx`, `zoom-staff.tsx`, `zoom.css` rules in `app/globals.css` | the zoom overlay: layout, slivers, beat bands, fill meter, animations (Task 6) |
| `lib/playsense-studio/zoom-keys.ts`, `components/playsense-studio/studio/zoom/use-zoom-keys.ts` | key → intent mapping and the hook (Task 7) |
| `components/playsense-studio/studio/zoom/note-toolbar.tsx` | the floating note toolbar (Task 8) |
| `components/playsense-studio/studio/zoom/more-popover.tsx` | the More ▾ tabs (Task 9) |
| `lib/playsense-studio/zoom-pointer.ts` + `measure-zoom.tsx` wiring | select, pitch drag, pencil, V1/V2 in the zoom (Task 10) |
| `components/playsense-studio/studio/integrated-editor.tsx` | opens the zoom; retires the old insert toolbar (Tasks 6, 11) |
| `lib/playsense-studio/score-to-vexflow.ts`, `lib/playsense-studio/notation/build-measure.ts` | additive-meter beams, legacy triplet grouping (Task 12) |
| `lib/playsense-studio/notation/spans.ts`, `continuous-staff.tsx`, `lib/playsense-studio/midi-recording.ts` | open slurs at the window edge, ids for MIDI notes (Task 13) |

---

### Task 1: One home for pitch rules

Pitch helpers are duplicated today: `STEP_MAP` and `midiToParts` in `integrated-editor.tsx`, `keyToDiatonic` and `midiToName` in `editable-measure-strip.tsx`, and `STEP_SEMITONE` (private) in `notation/accidentals.ts`. The zoom needs key-aware letter entry, steps, semitones and octaves, so these rules move into one tested module.

**Files:**
- Create: `lib/playsense-studio/pitch.ts`
- Test: `lib/playsense-studio/__tests__/pitch.test.ts`
- Modify: `lib/playsense-studio/notation/accidentals.ts` (export `STEP_SEMITONE`)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (drop the local `STEP_MAP` and `midiToParts`, import them)
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx` (drop the local `midiToName`, import `pitchName`)

**Interfaces — Produces:**

```ts
export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export interface Pitch { midi: number; spelling: { step: Step; alter: -2 | -1 | 0 | 1 | 2 } }
export const STEPS: Step[];
export function staffIndex(step: Step, octave: number): number;             // octave*7 + step index
export function fromStaffIndex(i: number): { step: Step; octave: number };
export function spelledMidi(step: Step, alter: number, octave: number): number;
export function pitchIndex(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number): number;
export function letterPitch(letter: string, nearIndex: number, keyFifths: number): Pitch;
export function letterAbove(letter: string, belowIndex: number, keyFifths: number): Pitch;
export function stepPitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch;
export function semitonePitch(midi: number, dir: 1 | -1, keyFifths: number): Pitch;
export function octavePitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch;
export function pitchName(midi: number, spelling?: Pitch['spelling'], keyFifths?: number): string;  // e.g. 'D♭4'
export function midiToParts(midi: number): { letter: Step; accidental: number; octave: number };   // sharp spelling
export const CLEF_REF_INDEX: Record<'treble' | 'bass' | 'alto' | 'tenor' | 'percussion', number>;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  CLEF_REF_INDEX, fromStaffIndex, letterAbove, letterPitch, midiToParts, octavePitch, pitchIndex, pitchName,
  semitonePitch, staffIndex, stepPitch,
} from '../pitch';

describe('pitch', () => {
  it('staff index round-trips', () => {
    expect(staffIndex('C', 4)).toBe(28);
    expect(fromStaffIndex(30)).toEqual({ step: 'E', octave: 4 });
    expect(fromStaffIndex(-1)).toEqual({ step: 'B', octave: -1 });
  });
  it('a letter lands on the octave nearest the previous note, in the key', () => {
    expect(letterPitch('c', staffIndex('E', 4), 0)).toEqual({ midi: 60, spelling: { step: 'C', alter: 0 } });
    expect(letterPitch('b', staffIndex('C', 4), 0)).toEqual({ midi: 59, spelling: { step: 'B', alter: 0 } });
    expect(letterPitch('f', staffIndex('E', 4), 2)).toEqual({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(letterPitch('B', staffIndex('A', 4), -1)).toEqual({ midi: 70, spelling: { step: 'B', alter: -1 } });
  });
  it('a chord letter goes above the top note', () => {
    expect(letterAbove('e', staffIndex('C', 4), 0)).toEqual({ midi: 64, spelling: { step: 'E', alter: 0 } });
    expect(letterAbove('c', staffIndex('C', 4), 0)).toEqual({ midi: 72, spelling: { step: 'C', alter: 0 } });
  });
  it('steps follow the key; semitones respell by direction; octaves keep the spelling', () => {
    expect(stepPitch(60, undefined, 0, 1)).toEqual({ midi: 62, spelling: { step: 'D', alter: 0 } });
    expect(stepPitch(64, undefined, 2, 1)).toEqual({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(semitonePitch(60, 1, 0)).toEqual({ midi: 61, spelling: { step: 'C', alter: 1 } });
    expect(semitonePitch(62, -1, 0)).toEqual({ midi: 61, spelling: { step: 'D', alter: -1 } });
    expect(semitonePitch(64, 1, 0)).toEqual({ midi: 65, spelling: { step: 'F', alter: 0 } });
    expect(octavePitch(61, { step: 'D', alter: -1 }, 0, 1)).toEqual({ midi: 73, spelling: { step: 'D', alter: -1 } });
  });
  it('indexes and names use the spelling', () => {
    expect(pitchIndex(61, { step: 'D', alter: -1 }, 0)).toBe(staffIndex('D', 4));
    expect(pitchIndex(61, undefined, 0)).toBe(staffIndex('C', 4));
    expect(pitchName(61, { step: 'D', alter: -1 })).toBe('D♭4');
    expect(pitchName(66, undefined, 2)).toBe('F♯4');
    expect(pitchName(60)).toBe('C4');
  });
  it('keeps the stepper helper and clef references', () => {
    expect(midiToParts(61)).toEqual({ letter: 'C', accidental: 1, octave: 4 });
    expect(CLEF_REF_INDEX.treble).toBe(staffIndex('B', 4));
    expect(CLEF_REF_INDEX.bass).toBe(staffIndex('D', 3));
  });
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/pitch.test.ts --exclude '.worktrees/**'`.

- [ ] **Step 3: Implement `pitch.ts`**

```ts
// PlaySense Studio — pitch rules shared by the Studio's note entry: letters
// land on the octave nearest the previous note in the key; ↑/↓ steps follow
// the key; semitones respell by direction (♯ up, ♭ down); octaves keep the
// spelling. Staff index = octave*7 + step (C4 = 28).

import { keyAlter, spellMidi, STEP_SEMITONE } from './notation/accidentals';

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
type Alter = -2 | -1 | 0 | 1 | 2;
export interface Pitch { midi: number; spelling: { step: Step; alter: Alter } }

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const clampMidi = (m: number) => Math.max(0, Math.min(127, m));

export function staffIndex(step: Step, octave: number): number {
  return octave * 7 + STEPS.indexOf(step);
}

export function fromStaffIndex(i: number): { step: Step; octave: number } {
  return { step: STEPS[((i % 7) + 7) % 7], octave: Math.floor(i / 7) };
}

export function spelledMidi(step: Step, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
}

function keyPitch(i: number, keyFifths: number): Pitch {
  const { step, octave } = fromStaffIndex(i);
  const alter = keyAlter(step, keyFifths) as Alter;
  return { midi: clampMidi(spelledMidi(step, alter, octave)), spelling: { step, alter } };
}

export function pitchIndex(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number): number {
  const s = spellMidi(midi, { spelling, keyFifths });
  return staffIndex(s.step as Step, s.octave);
}

export function letterPitch(letter: string, nearIndex: number, keyFifths: number): Pitch {
  const si = STEPS.indexOf(letter.toUpperCase() as Step);
  let best = 4 * 7 + si;
  for (let o = -1; o <= 9; o++) {
    const i = o * 7 + si;
    if (Math.abs(i - nearIndex) < Math.abs(best - nearIndex)) best = i;
  }
  return keyPitch(best, keyFifths);
}

export function letterAbove(letter: string, belowIndex: number, keyFifths: number): Pitch {
  const step = letter.toUpperCase() as Step;
  let i = belowIndex + 1;
  while (fromStaffIndex(i).step !== step) i++;
  return keyPitch(i, keyFifths);
}

export function stepPitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch {
  return keyPitch(pitchIndex(midi, spelling, keyFifths) + dir, keyFifths);
}

export function semitonePitch(midi: number, dir: 1 | -1, keyFifths: number): Pitch {
  const m = clampMidi(midi + dir);
  const s = spellMidi(m, { keyFifths });
  const step = s.step as Step;
  if (s.alter === 0 || keyAlter(step, keyFifths) === s.alter) return { midi: m, spelling: { step, alter: s.alter as Alter } };
  // An accidental outside the key: sharp going up, flat going down.
  const want = dir > 0 ? 1 : -1;
  if (s.alter === want) return { midi: m, spelling: { step, alter: s.alter as Alter } };
  const other = fromStaffIndex(staffIndex(step, s.octave) - want);
  return { midi: m, spelling: { step: other.step, alter: want as Alter } };
}

export function octavePitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch {
  const s = spellMidi(midi, { spelling, keyFifths });
  return { midi: clampMidi(midi + 12 * dir), spelling: { step: s.step as Step, alter: s.alter as Alter } };
}

const ALTER_GLYPH: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export function pitchName(midi: number, spelling?: Pitch['spelling'], keyFifths = 0): string {
  const s = spellMidi(midi, { spelling, keyFifths });
  return `${s.step}${ALTER_GLYPH[s.alter]}${s.octave}`;
}

const SHARP_PARTS: Array<[Step, number]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

export function midiToParts(midi: number): { letter: Step; accidental: number; octave: number } {
  const [letter, accidental] = SHARP_PARTS[((midi % 12) + 12) % 12];
  return { letter, accidental, octave: Math.floor(midi / 12) - 1 };
}

export const CLEF_REF_INDEX = {
  treble: staffIndex('B', 4),
  bass: staffIndex('D', 3),
  alto: staffIndex('C', 4),
  tenor: staffIndex('A', 3),
  percussion: staffIndex('B', 4),
} as const;
```

In `accidentals.ts`, change `const STEP_SEMITONE` to `export const STEP_SEMITONE`.

- [ ] **Step 4: Replace the local copies**
  - `integrated-editor.tsx`: delete the local `STEP_MAP` and the `midiToParts` function at the bottom. Import `midiToParts`, and use `STEP_SEMITONE` from `@/lib/playsense-studio/notation/accidentals` where `STEP_MAP[letter]` was used. The mapping is the same.
  - `editable-measure-strip.tsx`: delete the local `midiToName` and use `pitchName(midi)`. Keep `keyToDiatonic`, which parses VexFlow `'c/5'` keys for percussion and is unrelated.
  - Existing tests must still pass. The stepper's accidental display should be the same, since both helpers spell with sharps.

- [ ] **Step 5: Test, type-check and commit**

```bash
git add lib/playsense-studio/pitch.ts lib/playsense-studio/__tests__/pitch.test.ts lib/playsense-studio/notation/accidentals.ts components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/editable-measure-strip.tsx
git commit -m "Put the Studio's pitch rules in one tested module"
```

---

### Task 2: Written note values

Every event stores its sounding length in `durationQN`. The zoom thinks in written values (whole … 64th) plus dots plus tuplets, so this module converts between the two.

**Files:**
- Create: `lib/playsense-studio/rhythm.ts`
- Test: `lib/playsense-studio/__tests__/rhythm.test.ts`

**Interfaces — Produces:**

```ts
export type NoteValue = 'w' | 'h' | 'q' | '8' | '16' | '32' | '64';
export const VALUE_QN: Record<NoteValue, number>;
export const KEY_VALUE: Record<string, NoteValue>;      // '1'..'7'
export const VALUE_NAME: Record<NoteValue, string>;
export function dotFactor(dots: 0 | 1 | 2): number;
export function soundingQN(value: NoteValue, dots: 0 | 1 | 2, tuplet?: { n: number; m: number } | null): number;
export function valueFromQN(qn: number): NoteValue | null;
export function writtenValue(e: MusicalEvent): NoteValue | null;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { KEY_VALUE, soundingQN, valueFromQN, writtenValue } from '../rhythm';

describe('rhythm', () => {
  it('maps keys 1–7 to 64th … whole', () => {
    expect(Object.entries(KEY_VALUE)).toEqual([['1', '64'], ['2', '32'], ['3', '16'], ['4', '8'], ['5', 'q'], ['6', 'h'], ['7', 'w']]);
  });
  it('sounding length covers dots and tuplets', () => {
    expect(soundingQN('q', 0)).toBe(1);
    expect(soundingQN('q', 1)).toBe(1.5);
    expect(soundingQN('q', 2)).toBe(1.75);
    expect(soundingQN('8', 0, { n: 3, m: 2 })).toBeCloseTo(1 / 3, 9);
    expect(soundingQN('16', 0, { n: 5, m: 4 })).toBeCloseTo(0.2, 9);
  });
  it('recovers the written value from a stored event, legacy flags included', () => {
    const e = (x: Partial<MusicalEvent>) => ({ kind: 'note', midi: 60, durationQN: 1, ...x }) as MusicalEvent;
    expect(writtenValue(e({ durationQN: 1.5, dots: 1 }))).toBe('q');
    expect(writtenValue(e({ durationQN: 0.75, dotted: true }))).toBe('8');
    expect(writtenValue(e({ durationQN: 1 / 3, tuplet: { id: 't', n: 3, m: 2 } }))).toBe('8');
    expect(writtenValue(e({ durationQN: 1 / 3, triplet: true }))).toBe('8');
    expect(writtenValue(e({ durationQN: 0.3 }))).toBeNull();
    expect(valueFromQN(4)).toBe('w');
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `rhythm.ts`**

```ts
// PlaySense Studio — written note values. Events store their sounding length
// (durationQN); the zoom edits written value + dots + tuplet.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';

export type NoteValue = 'w' | 'h' | 'q' | '8' | '16' | '32' | '64';

export const VALUE_QN: Record<NoteValue, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625 };
export const KEY_VALUE: Record<string, NoteValue> = { '1': '64', '2': '32', '3': '16', '4': '8', '5': 'q', '6': 'h', '7': 'w' };
export const VALUE_NAME: Record<NoteValue, string> = { w: 'Whole', h: 'Half', q: 'Quarter', '8': '8th', '16': '16th', '32': '32nd', '64': '64th' };

export function dotFactor(dots: 0 | 1 | 2): number {
  return dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1;
}

export function soundingQN(value: NoteValue, dots: 0 | 1 | 2, tuplet?: { n: number; m: number } | null): number {
  return VALUE_QN[value] * dotFactor(dots) * (tuplet ? tuplet.m / tuplet.n : 1);
}

export function valueFromQN(qn: number): NoteValue | null {
  const hit = (Object.keys(VALUE_QN) as NoteValue[]).find((v) => Math.abs(VALUE_QN[v] - qn) < 1e-6);
  return hit ?? null;
}

export function writtenValue(e: MusicalEvent): NoteValue | null {
  return valueFromQN(e.durationQN / (dotFactor(eventDots(e)) * tupletScale(e)));
}
```

If `tupletScale` doesn't treat the legacy `triplet: true` flag as 2/3, check `accessors.ts`. `eventTuplet` should fold the legacy flag in; if it doesn't, apply `(e.triplet ? 2 / 3 : 1)` when `e.tuplet` is absent, and add a comment saying why.

- [ ] **Step 4: Test and commit**

```bash
git add lib/playsense-studio/rhythm.ts lib/playsense-studio/__tests__/rhythm.test.ts
git commit -m "Convert between written note values and stored lengths"
```

---

### Task 3: Voice-aware note entry in the reducer

**Files:**
- Modify: `lib/playsense-studio/editor-state.ts` (the `EditorAction` union, new cases, helpers)
- Test: `lib/playsense-studio/__tests__/note-entry.test.ts` (new)

**Interfaces — Produces:**

```ts
export interface EventRef { trackIndex: number; measureIndex: number; voice: 0 | 1; eventIndex: number }
export interface EntryAt { trackIndex: number; measureIndex: number; voice: 0 | 1; eventIndex: number | 'end' }

| { type: 'write-event'; at: EntryAt; kind: 'note' | 'rest'; midi?: number; spelling?: Spelling; percussion?: PercussionNotation; value?: NoteValue; dots?: 0 | 1 | 2 }
| { type: 'add-chord-note'; ref: EventRef; midi: number; spelling?: Spelling }
| { type: 'set-events-rhythm'; refs: EventRef[]; value?: NoteValue; dots?: 0 | 1 | 2 }
| { type: 'transpose-events'; refs: EventRef[]; kind: 'step' | 'semi' | 'oct'; dir: 1 | -1; keyFifths: number }
| { type: 'set-events-accidental'; refs: EventRef[]; alter: -2 | -1 | 0 | 1 | 2; keyFifths: number }
| { type: 'set-event-pitches'; ref: EventRef; midis: number[] }
| { type: 'delete-events'; refs: EventRef[] }
```

The rules, which follow v6's `enterLetter`, `enterRest`, `setDuration`, `cycleDots`, `transposeSel`, `setAccidental` and `deleteNote`:
- **`write-event` on an existing event (overwrite):**
  - `kind: 'note'` turns the event into a single note with `midi`, `spelling` and `percussion`. A chord collapses to one note. It keeps `id`, `durationQN`, `dots`, `tuplet`, `tieToNext`, `dynamic` and `text`. A rest that becomes a note gets no articulations.
  - `kind: 'rest'` turns it into a rest. It keeps `id` and the rhythm fields, and drops tie, articulations, ornament and grace.
- **`write-event` at `'end'` (append):**
  - It needs `value`; `dots` defaults to 0.
  - The new event gets `id: newEventId()` and `durationQN = soundingQN(value, dots, null)`, with `dots` stored only when it's above 0.
  - If voice 0 holds only a filler rest, the new event replaces it.
  - If `occupied + durationQN > bar length + QN_EPS`, the reducer returns `state` (refused; Review Focus 1).
  - Writing to `voice: 1` when the bar has no second voice creates `voices[1] = { number: 2, events: [] }`.
- **`add-chord-note`:** a note becomes a chord `{ kind: 'chord', notes: [a, b] }`, sorted by midi, with the note-level fields kept on the chord. A chord gains a note. A duplicate midi is a no-op, and a rest is a no-op.
- **`set-events-rhythm`:**
  - With `value`: each event gets `durationQN = soundingQN(value, dots ?? eventDots(e), null)`, and the tuplet is cleared (`tuplet`, legacy `triplet`).
  - With only `dots`: the written value stays: `durationQN = soundingQN(writtenValue(e), dots, eventTuplet(e))`. An event whose written value is unknown is skipped.
  - `dots` is written to `dots` (deleted when 0), and legacy `dotted` is deleted.
  - Refusals return `state`:
    - a value change on part of a tuplet group, where not every member of that group is in `refs`
    - any bar or voice that would overflow
- **`transpose-events`:** uses `stepPitch`, `semitonePitch` or `octavePitch` on every note of a note or chord, and sets `midi` plus `spelling`. Percussion notes and rests are unchanged.
- **`set-events-accidental`:** for each note, keeps the spelled step and octave (`spellMidi`), sets `alter`, and writes `midi = spelledMidi(step, alter, octave)` and `spelling = { step, alter, showAccidental: 'always' }`. Percussion notes are skipped.
- **`set-event-pitches`:** replaces each note's midi in order (the pitch drag in Task 10) and drops `spelling`/`spellingHint`. The array length must match the note count, otherwise it's a no-op.
- **`delete-events`:** removes the events per bar and voice (highest index first). It drops `voices[1]` when that voice is left empty, and prunes spans (`pruneSpans`).
- Every action goes through `withHistory`, so repeat propagation keeps working.

- [ ] **Step 1: Write the failing tests** (`note-entry.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
import type { Measure, MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const n = (midi: number, durationQN = 1, id = `n${midi}`): MusicalEvent => ({ kind: 'note', midi, durationQN, id });
const bar = (number: number, v0: MusicalEvent[], v1?: MusicalEvent[]): Measure => ({
  number, voices: v1 ? [{ number: 1, events: v0 }, { number: 2, events: v1 }] : [{ number: 1, events: v0 }],
});
const doc = (measures: Measure[], keyFifths = 0): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: keyFifths,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff', measures }],
});
const st = (s: ScoreDocument): EditorState => ({ score: s, past: [], future: [], isDirty: false });
const ev = (s: EditorState, m = 0, v = 0) => s.score.tracks[0].measures[m].voices[v]?.events ?? [];
const at = (measureIndex: number, eventIndex: number | 'end', voice: 0 | 1 = 0) => ({ trackIndex: 0, measureIndex, voice, eventIndex });

describe('write-event', () => {
  it('appends at the end with a fresh id', () => {
    const s = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 62, value: 'q' });
    expect(ev(s).map((e) => [e.kind, (e as { midi?: number }).midi, e.durationQN])).toEqual([['note', 60, 1], ['note', 62, 1]]);
    expect(ev(s)[1].id).toMatch(/^e/);
  });
  it('refuses an append that would overflow the bar (Review Focus 1)', () => {
    const s0 = st(doc([bar(1, [n(60, 2), n(62, 1.5)])]));
    expect(editorReducer(s0, { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 64, value: 'q' })).toBe(s0);
  });
  it('replaces a lone filler rest', () => {
    const s = editorReducer(st(doc([bar(1, [{ kind: 'rest', durationQN: 4 }])])), { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 60, value: 'h' });
    expect(ev(s).map((e) => e.durationQN)).toEqual([2]);
  });
  it('overwrites the pitch but keeps the rhythm and id', () => {
    const s = editorReducer(st(doc([bar(1, [{ ...n(60, 1.5), dots: 1 }])])), { type: 'write-event', at: at(0, 0), kind: 'note', midi: 67, value: 'w' });
    expect(ev(s)[0]).toMatchObject({ kind: 'note', midi: 67, durationQN: 1.5, dots: 1, id: 'n60' });
  });
  it('turns a note into a rest, dropping tie and marks', () => {
    const s = editorReducer(st(doc([bar(1, [{ ...n(60), tieToNext: true, articulations: ['staccato'] }])])), { type: 'write-event', at: at(0, 0), kind: 'rest' });
    expect(ev(s)[0]).toEqual({ kind: 'rest', durationQN: 1, id: 'n60' });
  });
  it('writing to voice 2 creates it and never touches voice 1 (Review Focus 3)', () => {
    const s0 = st(doc([bar(1, [n(60, 4)])]));
    const s1 = editorReducer(s0, { type: 'write-event', at: at(0, 'end', 1), kind: 'note', midi: 48, value: 'h' });
    expect(ev(s1, 0, 1).map((e) => (e as { midi: number }).midi)).toEqual([48]);
    expect(ev(s1, 0, 0)).toEqual(ev(s0, 0, 0));
  });
});

describe('chords, rhythm, pitch and delete', () => {
  it('adds a chord note, sorted, without duplicates', () => {
    const s = editorReducer(st(doc([bar(1, [n(64)])])), { type: 'add-chord-note', ref: { ...at(0, 0), eventIndex: 0 }, midi: 60 });
    expect(ev(s)[0]).toMatchObject({ kind: 'chord', notes: [{ midi: 60 }, { midi: 64 }] });
    const again = editorReducer(s, { type: 'add-chord-note', ref: { ...at(0, 0), eventIndex: 0 }, midi: 60 });
    expect(again).toBe(s);
  });
  it('sets written value and dots, clearing tuplets on a value change', () => {
    const r = { ...at(0, 0), eventIndex: 0 };
    const s1 = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'set-events-rhythm', refs: [r], dots: 2 });
    expect(ev(s1)[0]).toMatchObject({ durationQN: 1.75, dots: 2 });
    const s2 = editorReducer(s1, { type: 'set-events-rhythm', refs: [r], value: '8' });
    expect(ev(s2)[0]).toMatchObject({ durationQN: 0.875, dots: 2 });
  });
  it('refuses a value change on part of a tuplet group', () => {
    const t = { id: 'g', n: 3, m: 2 };
    const s0 = st(doc([bar(1, [{ ...n(60, 1 / 3), tuplet: t }, { ...n(62, 1 / 3), tuplet: t }, { ...n(64, 1 / 3), tuplet: t }, n(65, 3)])]));
    expect(editorReducer(s0, { type: 'set-events-rhythm', refs: [{ ...at(0, 0), eventIndex: 0 }], value: 'q' })).toBe(s0);
  });
  it('transposes by step in the key, by semitone and by octave', () => {
    const r = { ...at(0, 0), eventIndex: 0 };
    const s0 = st(doc([bar(1, [n(64)])], 2));
    expect(ev(editorReducer(s0, { type: 'transpose-events', refs: [r], kind: 'step', dir: 1, keyFifths: 2 }))[0]).toMatchObject({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(ev(editorReducer(s0, { type: 'transpose-events', refs: [r], kind: 'oct', dir: -1, keyFifths: 2 }))[0]).toMatchObject({ midi: 52 });
  });
  it('sets an accidental keeping the step', () => {
    const s = editorReducer(st(doc([bar(1, [n(62)])])), { type: 'set-events-accidental', refs: [{ ...at(0, 0), eventIndex: 0 }], alter: -1, keyFifths: 0 });
    expect(ev(s)[0]).toMatchObject({ midi: 61, spelling: { step: 'D', alter: -1, showAccidental: 'always' } });
  });
  it('deletes across voices, drops an emptied voice 2 and prunes slurs', () => {
    const s0 = st({ ...doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')], [n(48, 4, 'c')])]), spans: [{ id: 's', type: 'slur', from: 'a', to: 'b' }] });
    const s1 = editorReducer(s0, { type: 'delete-events', refs: [{ ...at(0, 0), eventIndex: 1 }, { ...at(0, 0, 1), eventIndex: 0 }] });
    expect(ev(s1).map((e) => e.id)).toEqual(['a']);
    expect(s1.score.tracks[0].measures[0].voices).toHaveLength(1);
    expect(s1.score.spans).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement.** Add `EventRef`, `EntryAt` and the seven actions to the union. Add a local helper next to the existing ones:

```ts
function voiceEvents(track: Track, measureIndex: number, voice: 0 | 1, create = false): MusicalEvent[] | null {
  const m = track.measures[measureIndex];
  if (!m) return null;
  if (!m.voices[voice]) {
    if (!create || voice !== 1) return null;
    m.voices[1] = { number: 2, events: [] };
  }
  return m.voices[voice].events;
}
```

Implement each case on a `clone(state.score)` per the rules above, using:
- `letterPitch`, `stepPitch`, `semitonePitch`, `octavePitch` and `spelledMidi` from `./pitch`
- `soundingQN`, `writtenValue` and `NoteValue` from `./rhythm`
- `spellMidi` from `./notation/accidentals`
- `newEventId` and `pruneSpans` from `./event-ids`
- `isFillerRest`, `occupiedQN`, `measureLengthInQN` and `QN_EPS` from `./time-mapping`
- `effectiveTimeSignatureAt` (already in the file) for the bar length

Finish every case with `return withHistory(state, next)`. For `delete-events`, apply `pruneSpans` to the result of `withHistory`, as `clear-measures` does.

- [ ] **Step 4: Test, type-check and commit.** Run the new file and `npx vitest run lib/playsense-studio --exclude '.worktrees/**'`.

```bash
git add lib/playsense-studio/editor-state.ts lib/playsense-studio/__tests__/note-entry.test.ts
git commit -m "Add voice-aware note entry, chords, rhythm, transposition and deletion to the editor"
```

---

### Task 4: Marks, tuplets and slurs in the reducer

**Files:**
- Modify: `lib/playsense-studio/editor-state.ts`
- Test: `lib/playsense-studio/__tests__/note-marks.test.ts` (new)

**Interfaces — Produces:**

```ts
| { type: 'toggle-events-articulation'; refs: EventRef[]; articulation: Articulation }
| { type: 'set-events-ornament'; refs: EventRef[]; ornament: Ornament | null }
| { type: 'set-events-dynamic'; refs: EventRef[]; dynamic: Dynamic | null }
| { type: 'set-event-text'; ref: EventRef; text: string | null }
| { type: 'toggle-event-grace'; ref: EventRef; slash: boolean; keyFifths: number }
| { type: 'toggle-event-tie'; ref: EventRef }
| { type: 'apply-tuplet'; ref: EventRef; n: number; m: number }
| { type: 'toggle-span'; spanType: 'slur' | 'cresc' | 'dim'; from: EventRef; to?: EventRef }
```

The rules (v6's `editSel`, `toggleGrace`, `toggleTie`, `applyTuplet` and `addSpan`):
- **Articulations** use the array form. Toggling adds or removes the mark in `eventArticulations(e)`. The result is written to `articulations` (deleted when empty), and legacy `articulation` is always deleted. Rests are skipped.
- **Ornament** and **dynamic** are set or cleared. They apply to notes and chords; a dynamic can also sit on a rest.
- **Text** is trimmed to 60 characters. An empty string or `null` deletes it.
- **Grace:**
  - If the event already has a grace with the same `slash`, remove it.
  - Otherwise set `grace = [{ midi, spelling, slash }]`, where the pitch is one diatonic step above the event's top note in the key (`stepPitch(top, topSpelling, keyFifths, 1)`).
  - Rests are skipped.
- **Tie** toggles `tieToNext` on a note or chord.
- **`apply-tuplet`:**
  - If the event is in a tuplet, merge back. The group is the contiguous run in the same voice with the same `tuplet.id`. If `valueFromQN(sum of durationQN)` is a value, the group becomes one event: the first member's content, with that value's `durationQN`, no tuplet and no dots. Otherwise refuse (return `state`).
  - If the event is dotted, refuse.
  - Otherwise `base = valueFromQN(VALUE_QN[writtenValue(e)] / m)`; if that's `null`, refuse. The event is replaced by `n` events, each with `durationQN = VALUE_QN[base] * m / n` and `tuplet: { id: newTupletId(), n, m }`:
    - the first keeps `e`'s id and all its marks
    - the others get fresh ids and copy only the pitch content (note, chord or rest)
- **`toggle-span`:**
  - When `to` is missing or equals `from`:
    - If a span of that type already starts at `from`'s id, remove it.
    - Otherwise use the next event in the same voice (crossing into later bars) as `to`. If there's none, refuse.
  - A span with `to` before `from` in reading order is refused.
  - **Repeat mirroring (Review Focus 2).** If `from`'s bar has a `repeat` tag, apply the same add or remove for every other pass `p`, using `passEventId(fromId, p)` and `passEventId(toId, p)`. Skip a pass when either id doesn't exist in the score.
  - New span ids are `'s' + newEventId().slice(1)`.
  - Spans aren't bar content, so this case edits `next.spans` directly before calling `withHistory`.
- Articulation, ornament, dynamic, text, grace, tie and tuplet changes are bar content, so `withHistory` copies them to every pass.

- [ ] **Step 1: Write the failing tests** (`note-marks.test.ts`, reusing the helpers from `note-entry.test.ts`; copy them in)

```ts
describe('marks', () => {
  const r = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
  it('toggles articulations in the array form, migrating the legacy field', () => {
    const s0 = st(doc([bar(1, [{ ...n(60), articulation: 'accent' }])]));
    const s1 = editorReducer(s0, { type: 'toggle-events-articulation', refs: [r], articulation: 'staccato' });
    expect(ev(s1)[0]).toMatchObject({ articulations: ['accent', 'staccato'] });
    expect(ev(s1)[0]).not.toHaveProperty('articulation');
    const s2 = editorReducer(s1, { type: 'toggle-events-articulation', refs: [r], articulation: 'accent' });
    expect(ev(s2)[0]).toMatchObject({ articulations: ['staccato'] });
  });
  it('sets and clears ornaments, dynamics and text', () => {
    let s = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'set-events-ornament', refs: [r], ornament: 'trill' });
    s = editorReducer(s, { type: 'set-events-dynamic', refs: [r], dynamic: 'mf' });
    s = editorReducer(s, { type: 'set-event-text', ref: r, text: '  dolce  ' });
    expect(ev(s)[0]).toMatchObject({ ornament: 'trill', dynamic: 'mf', text: 'dolce' });
    s = editorReducer(s, { type: 'set-event-text', ref: r, text: '' });
    expect(ev(s)[0]).not.toHaveProperty('text');
  });
  it('toggles a grace note a step above', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 });
    expect(ev(s1)[0]).toMatchObject({ grace: [{ midi: 62, slash: true }] });
    expect(ev(editorReducer(s1, { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 }))[0]).not.toHaveProperty('grace');
  });
});

describe('tuplets', () => {
  const r = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
  it('splits a quarter into a 3:2 group and merges it back', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60, 1, 'q'), n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    const g = ev(s1).slice(0, 3);
    expect(g.map((e) => e.durationQN)).toEqual([1 / 3, 1 / 3, 1 / 3].map((x) => expect.closeTo(x, 9)));
    expect(new Set(g.map((e) => e.tuplet?.id)).size).toBe(1);
    expect(g[0].id).toBe('q');
    const s2 = editorReducer(s1, { type: 'apply-tuplet', ref: { ...r, eventIndex: 1 }, n: 3, m: 2 });
    expect(ev(s2).map((e) => e.durationQN)).toEqual([1, 3]);
    expect(ev(s2)[0]).not.toHaveProperty('tuplet');
  });
  it('makes 5:4 from a quarter and refuses a dotted note', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60, 1), n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 5, m: 4 });
    expect(ev(s1).slice(0, 5).map((e) => e.durationQN)).toEqual(Array(5).fill(expect.closeTo(0.2, 9)));
    const dotted = st(doc([bar(1, [{ ...n(60, 1.5), dots: 1 }, n(62, 2.5)])]));
    expect(editorReducer(dotted, { type: 'apply-tuplet', ref: r, n: 3, m: 2 })).toBe(dotted);
  });
});

describe('slurs', () => {
  it('adds a slur to the next note, then toggles it off', () => {
    const s0 = st(doc([bar(1, [n(60, 2, 'a')]), bar(2, [n(62, 4, 'b')])]));
    const from = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
    const s1 = editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from });
    expect(s1.score.spans).toEqual([expect.objectContaining({ type: 'slur', from: 'a', to: 'b' })]);
    expect(editorReducer(s1, { type: 'toggle-span', spanType: 'slur', from }).score.spans).toEqual([]);
  });
  it('mirrors a slur to every pass of a repeat (Review Focus 2)', () => {
    let s = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    const s1 = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: { trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 0 }, to: { trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 1 } });
    expect(s1.score.spans?.map((x) => [x.from, x.to]).sort()).toEqual([['a', 'b'], ['a~1', 'b~1']]);
    expect(repeatGroups(s1.score.tracks[0])).toHaveLength(1);
  });
  it('a mark on pass 2 reaches pass 1', () => {
    let s = st(doc([bar(1, [n(60, 4, 'a')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'set-events-dynamic', refs: [{ trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 0 }], dynamic: 'p' });
    expect(ev(s, 0)[0]).toMatchObject({ dynamic: 'p' });
    expect(repeatGroups(s.score.tracks[0])).toHaveLength(1);
  });
});
```

Import `repeatGroups` from `../repeats`. Check the id `repeat-measures` gives pass 1 (`a~1`) against Task 13 of Plan 3a (`passEventId`); adjust the expected ids only if that module's scheme differs, and say so in the report.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement** the eight cases per the rules. Reuse `newTupletId` (already in the file), `eventArticulations`/`eventTuplet`/`eventDots` from the accessors, and `passEventId` from `./event-ids`.

- [ ] **Step 4: Test, type-check and commit**

```bash
git add lib/playsense-studio/editor-state.ts lib/playsense-studio/__tests__/note-marks.test.ts
git commit -m "Edit marks, ornaments, dynamics, text, grace notes, tuplets and slurs, reaching every repeat pass"
```

---

### Task 5: The zoom cursor

**Files:**
- Create: `lib/playsense-studio/note-cursor.ts`
- Test: `lib/playsense-studio/__tests__/note-cursor.test.ts`

**Interfaces — Produces:**

```ts
export interface NoteCursor { measureIndex: number; voice: 0 | 1; index: number | 'end'; anchor: number | null }
export interface CursorContext {
  count: number;                                      // bars in the track
  events: (measureIndex: number, voice: 0 | 1) => MusicalEvent[];
  barQN: (measureIndex: number) => number;
}
export function cursorRange(c: NoteCursor): number[];              // selected event indices in c's bar/voice
export function advanceCursor(c: NoteCursor, ctx: CursorContext): NoteCursor;
export function walkCursor(c: NoteCursor, dir: 1 | -1, extend: boolean, ctx: CursorContext): NoteCursor;
export function clampCursor(c: NoteCursor, ctx: CursorContext): NoteCursor;
export function entryReference(c: NoteCursor, ctx: CursorContext, keyFifths: number, fallback: number): number;  // staff index of the note before the cursor
```

The rules (v6's `advanceN`, the ←/→ handler and `refIdx`):
- **`cursorRange`:** returns `[]` at `'end'` with no anchor. Otherwise it returns the inclusive range from the anchor (if set) to the index, where `'end'` counts as the last event.
- **`advanceCursor`**, after an entry:
  - If there's a next event in the bar, move to `index + 1`.
  - Else, if the voice isn't full (`occupiedQN < barQN − QN_EPS`), move to `'end'`.
  - Else, if there's a next bar, move to it: `index` 0 if it has events in that voice, otherwise `'end'`.
  - Else, `'end'`.
  - The anchor is always cleared.
- **`walkCursor`:**
  - The positions are `[0 … len−1, 'end']`. The cursor moves by `dir`.
  - Past the start, it goes to the previous bar's `'end'`. Past the end, it goes to the next bar at index 0, or `'end'` if that bar is empty. At the score's edges it stays put.
  - `extend` sets the anchor to the old index (as a number; `'end'` becomes the last event) the first time, and keeps it after that. Without `extend`, the anchor is cleared.
  - Crossing into another bar always clears the anchor.
- **`clampCursor`:** after edits, an index `≥ len` becomes `'end'`, and a bar index `≥ count` becomes `count − 1`.
- **`entryReference`:** the staff index of the nearest note or chord top before the cursor, searching back through earlier bars of the same voice. Otherwise it returns `fallback` (the clef's reference, `CLEF_REF_INDEX`). It uses `pitchIndex` with each note's spelling.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { advanceCursor, clampCursor, cursorRange, entryReference, walkCursor, type CursorContext } from '../note-cursor';
import { staffIndex } from '../pitch';

const n = (midi: number, d = 1): MusicalEvent => ({ kind: 'note', midi, durationQN: d });
const bars: MusicalEvent[][] = [[n(60), n(62)], [], [n(67, 4)]];
const ctx: CursorContext = { count: 3, events: (m) => bars[m] ?? [], barQN: () => 4 };
const c = (measureIndex: number, index: number | 'end', anchor: number | null = null) => ({ measureIndex, voice: 0 as const, index, anchor });

describe('note cursor', () => {
  it('ranges', () => {
    expect(cursorRange(c(0, 'end'))).toEqual([]);
    expect(cursorRange(c(0, 1))).toEqual([1]);
    expect(cursorRange(c(0, 0, 1))).toEqual([0, 1]);
    expect(cursorRange(c(0, 'end', 0))).toEqual([0, 1]);
  });
  it('advances within a bar, to its end while it has room, then to the next bar', () => {
    expect(advanceCursor(c(0, 0), ctx)).toEqual(c(0, 1));
    expect(advanceCursor(c(0, 1), ctx)).toEqual(c(0, 'end'));
    const full: CursorContext = { ...ctx, events: (m) => (m === 0 ? [n(60, 2), n(62, 2)] : bars[m]) };
    expect(advanceCursor(c(0, 1), full)).toEqual(c(1, 'end'));
    expect(advanceCursor(c(2, 0), ctx)).toEqual(c(2, 'end'));
  });
  it('walks across bars and extends with shift', () => {
    expect(walkCursor(c(0, 'end'), 1, false, ctx)).toEqual(c(1, 'end'));
    expect(walkCursor(c(1, 'end'), 1, false, ctx)).toEqual(c(2, 0));
    expect(walkCursor(c(2, 0), -1, false, ctx)).toEqual(c(1, 'end'));
    expect(walkCursor(c(0, 0), -1, false, ctx)).toEqual(c(0, 0));
    expect(walkCursor(c(0, 0), 1, true, ctx)).toEqual(c(0, 1, 0));
  });
  it('clamps after edits', () => {
    expect(clampCursor(c(0, 5), ctx)).toEqual(c(0, 'end'));
    expect(clampCursor(c(9, 0), ctx)).toEqual(c(2, 0));
  });
  it('finds the reference pitch for a letter, searching back', () => {
    expect(entryReference(c(1, 'end'), ctx, 0, 99)).toBe(staffIndex('D', 4));
    expect(entryReference(c(0, 0), ctx, 0, 99)).toBe(99);
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `note-cursor.ts`** to the rules. Use `occupiedQN` and `QN_EPS` from `./time-mapping` and `pitchIndex` from `./pitch`. For a chord, the "top" is the highest midi.

- [ ] **Step 4: Test and commit**

```bash
git add lib/playsense-studio/note-cursor.ts lib/playsense-studio/__tests__/note-cursor.test.ts
git commit -m "Add the zoom's note cursor: advance, walk, range and entry reference"
```

---

### Task 6: The measure zoom overlay

**Files:**
- Create: `components/playsense-studio/studio/zoom/zoom-staff.tsx` (draws one bar large and reports its layout)
- Create: `components/playsense-studio/studio/zoom/measure-zoom.tsx` (the overlay)
- Test: `components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (zoom state; `openMeasure` opens the zoom; Esc and the measure keys)
- Modify: `app/globals.css` (the `.st-zoom*` rules)

**Interfaces — Produces:**

```ts
// zoom-staff.tsx
export interface ZoomHit { voice: 0 | 1; eventIndex: number; x: number; y: number; w: number; h: number }   // zoom-staff px
export interface ZoomLayout {
  hits: ZoomHit[];
  noteStartX: number; noteEndX: number;              // px, for beat bands
  lineForY: (y: number) => number;                    // stave line (0 = top line), unscaled VexFlow math
  yForLine: (line: number) => number;
}
export function ZoomStaff(props: { item: MeasureStripItem; width: number; height: number; scale: number; spans?: Span[];
  onLayout: (l: ZoomLayout) => void }): JSX.Element

// measure-zoom.tsx
export interface ZoomState { measureIndex: number; cursor: NoteCursor; value: NoteValue; dots: 0 | 1 | 2; pencil: boolean }
export function MeasureZoom(props: {
  items: MeasureStripItem[]; zoom: ZoomState; height: number; spans?: Span[];
  fill: MeasureFill; bpm: number | null; percussion: boolean;
  origin: { left: number; width: number } | null;     // the bar's rect in the strip, for the enter animation
  onVoice: (v: 0 | 1) => void; onNav: (dir: 1 | -1) => void; onClose: () => void;
  onLayout: (l: ZoomLayout) => void;
  children?: ReactNode;                                // toolbar and popovers (Tasks 8–10)
}): JSX.Element
```

The layout and behaviour (spec §6 and v6's `setFocus`, `renderFocus` and `exitFocus`):
- **Placement:** the overlay fills the strip wrapper (`position: absolute; inset: 0; z-index: 46`) with a 3-column grid `minmax(56px, 13%) 1fr minmax(56px, 13%)`.
- **Header row:**
  - `m.N`, `≈{bpm.toFixed(1)} BPM`
  - a `V1 / V2` segmented control (`.st-seg`), shown when the bar has a voice 2 or voice 2 is being edited
  - ‹ › buttons with the titles "Previous bar (⌘←)" and "Next bar (⌘→)"
  - a close button titled "Close (Esc)"
- **Slivers:** each draws its neighbour with `ZoomStaff` at scale 0.7, opacity .35 (.7 on hover), labelled `m.N` in mono 10 px. A click navigates. At the score's edges the sliver is empty.
- **Center:** `ZoomStaff` at scale 1.5, sized to the center column.
- **Beat bands:** there are `ts[0]` bands, spread evenly from `noteStartX` to `noteEndX` (ruling: even spacing, not note-onset spacing). Odd bands have the background `rgba(255,255,255,.022)`, and each band is labelled with its 1-based number in mono 10 px.
- **Fill meter:**
  - It sits under the staff, 8 px tall, with one `<i>` per voice event (for the active voice). Each is sized `durationQN / barQN × 100%`.
  - Rests get `.is-rest`, and the meter gets `.is-over` when `fill.kind === 'over'`. Widths animate over 200 ms.
- **Enter animation:**
  - When `origin` is given, animate the panel `transform` from the bar's rect (`translateX(origin.left) scaleX(origin.width / panelWidth)`) and `opacity` .3 → 1, over 340 ms `cubic-bezier(.2,.8,.2,1)`, using `element.animate`. Skip it when `matchMedia('(prefers-reduced-motion: reduce)').matches` or when `element.animate` doesn't exist (jsdom).
  - Going to another bar animates the center column `translateX(dir*40px)`, opacity .3 → none, over 220 ms ease-out.
  - Close uses the reverse, 240 ms `cubic-bezier(.4,0,.8,.4)`, and then calls `onClose`. That's immediate with reduced motion.
- **`ZoomStaff`:**
  - Draws with `Renderer(host, SVG)`, `ctx.scale(scale, scale)`, a `Stave` at `(4, 30, width/scale − 8)`, and `applyStaveHeader(stave, staveHeader(item, { opening: true, rowStart: false }))`.
  - Then `buildMeasure([item.events, item.voice2Events], item.timeSignature, item.clef)` → `formatMeasure(built, stave.getNoteEndX() − stave.getNoteStartX() − 8)` → `drawMeasure(ctx, stave, built)`.
  - Spans inside the bar go through `drawSpanSegments(ctx, spanSegments(spans, placed))`, then `themeVexflowSvg`.
  - Hits come from `built.notes[0]` (voice 0) and `built.notes[1]` (voice 1), with each bounding box multiplied by `scale`.
  - `lineForY` / `yForLine` wrap `stave.getLineForY(y / scale)` and `stave.getYForLine(line) * scale`.
  - It redraws when `item`, `width`, `height`, `scale` or `spans` change, and clears the host before each draw. The whole draw is wrapped in try/catch, and a failure reports empty hits.

**`IntegratedEditor`:**
- State: `const [zoom, setZoom] = useState<ZoomState | null>(null)`.
- **`openMeasure(index, eventIndex?)`:**
  - Keeps its waveform zoom (56%), selects that bar, and sets `zoom = { measureIndex: index, cursor: { measureIndex: index, voice: 0, index: eventIndex ?? (bar has voice-0 events ? 0 : 'end'), anchor: null }, value: 'q', dots: 0, pencil: false }`.
  - Records `origin` from the bar's current strip x and width.
- **Navigation:**
  - ‹ › and ⌘←/→ (Task 7) move to the neighbour: they zoom the waveform to it and set `zoom.measureIndex` plus the cursor at 0 or `'end'`.
  - Closing sets `zoom = null` and keeps the bar selected.
- **While the zoom is open:**
  - `useMeasureKeys` is disabled (pass `enabled: selected === null && !zoom && editorTab === 'staff'`).
  - The measure bar, the strip footer and the measure popovers are hidden.
- **Bar-level keys:** pressing ⏎ and double-clicking a bar already call `openMeasure`, so both now open the real zoom.
- **Keeping `selected` in step with the cursor:**
  - `selected = { measureIndex, eventIndex }` when the zoom cursor sits on a voice-0 event.
  - `selected = null` otherwise (on `'end'`, or when voice 2 is active).
  - This keeps SyncPanel's selected-note inspector, the `[`/`]` nudge keys and the waveform's note handle working.
- **The `bpm` value** is the same formula as the measure bar's `barBpm`, for one bar. **The `fill` value** is `stripItems[i].fill`.

- [ ] **Step 1: Write the failing test** (`measure-zoom.test.tsx`, jsdom, with the canvas stub)
  - Build 3 strip items from `extractTrackEvents` on a small track. Bar 2 holds `[q C4, q D4, h E4]`. Add `fill` with `measureFill` and neutral timings.
  - Mount `MeasureZoom` with `zoom.measureIndex = 1`.
  - Assert:
    1. The header shows `m.2`.
    2. Both slivers exist, labelled `m.1` and `m.3`.
    3. There are 4 `.st-zoom-band` elements, and the 1st and 3rd have `data-odd="true"`.
    4. The meter has 3 `<i>` segments whose widths are 25%, 25% and 50%.
    5. `onLayout` was called with 3 voice-0 hits.
    6. Clicking the `m.3` sliver calls `onNav(1)`.
    7. With `zoom.measureIndex = 0`, the left sliver is empty.
  - Add an `IntegratedEditor` test (reuse the `render`/`key` helpers from `integrated-editor-measure-bar.test.tsx`):
    - selecting bar 1 and pressing ⏎ shows a `[data-testid="measure-zoom"]` for `m.1`
    - Esc removes it and bar 1 stays selected
    - while it's open, `⌫` does NOT dispatch `delete-measures`

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement** `zoom-staff.tsx` and `measure-zoom.tsx` to the rules above. Give the root `data-testid="measure-zoom"`, bands `className="st-zoom-band"` with `data-odd`, and the meter `className="st-zoom-meter"`. Add this CSS:

```css
.st-zoom { position: absolute; inset: 0; z-index: 46; display: grid; grid-template-columns: minmax(56px, 13%) 1fr minmax(56px, 13%);
  grid-template-rows: 30px 1fr 18px; background: hsl(var(--card)); border-radius: 10px; overflow: hidden; }
.st-zoom-head { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 0 10px; font-size: 12px; }
.st-zoom-sliver { position: relative; opacity: .35; cursor: pointer; transition: opacity .15s; }
.st-zoom-sliver:hover { opacity: .7; }
.st-zoom-sliver-label { position: absolute; top: 2px; left: 6px; font: 10px ui-monospace, monospace; color: hsl(var(--muted-foreground)); }
.st-zoom-center { position: relative; }
.st-zoom-band { position: absolute; top: 0; bottom: 0; pointer-events: none; }
.st-zoom-band[data-odd='true'] { background: rgba(255,255,255,.022); }
.st-zoom-band > span { position: absolute; top: 2px; left: 4px; font: 10px ui-monospace, monospace; color: hsl(var(--muted-foreground)); }
.st-zoom-meter { grid-column: 2; display: flex; gap: 1px; height: 8px; margin: 5px 0; border-radius: 4px; overflow: hidden;
  background: repeating-linear-gradient(135deg, hsl(var(--muted)) 0 4px, transparent 4px 8px); }
.st-zoom-meter > i { display: block; height: 100%; background: hsl(var(--primary)); transition: width .2s cubic-bezier(.2,.8,.2,1); }
.st-zoom-meter > i.is-rest { opacity: .4; }
.st-zoom-meter.is-over > i { background: hsl(var(--destructive)); }
@media (prefers-reduced-motion: reduce) { .st-zoom-meter > i, .st-zoom-sliver { transition: none; } }
```

- [ ] **Step 4: Test, type-check and commit**

```bash
git add components/playsense-studio/studio/zoom components/playsense-studio/studio/integrated-editor.tsx app/globals.css
git commit -m "Open a bar in a measure zoom with slivers, beat bands and a fill meter"
```

---

### Task 7: Keyboard editing in the zoom

**Files:**
- Create: `lib/playsense-studio/zoom-keys.ts` (the pure key → intent map)
- Create: `components/playsense-studio/studio/zoom/use-zoom-editing.ts` (the editing handlers, used by keys and the toolbar)
- Test: `lib/playsense-studio/__tests__/zoom-keys.test.ts`, `components/playsense-studio/studio/zoom/__tests__/zoom-editing.test.tsx`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (use the hook while the zoom is open)

**Interfaces — Produces:**

```ts
// zoom-keys.ts
export type ZoomIntent =
  | { kind: 'letter'; letter: string; chord: boolean }
  | { kind: 'value'; value: NoteValue }
  | { kind: 'rest' } | { kind: 'dots' } | { kind: 'triplet' } | { kind: 'tie' } | { kind: 'slur' } | { kind: 'pencil' }
  | { kind: 'walk'; dir: 1 | -1; extend: boolean } | { kind: 'bar'; dir: 1 | -1 }
  | { kind: 'transpose'; how: 'step' | 'semi' | 'oct'; dir: 1 | -1 }
  | { kind: 'delete'; back: boolean } | { kind: 'close' };
export function zoomIntent(e: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }): ZoomIntent | null;

// use-zoom-editing.ts
export interface ZoomEditing {
  enterLetter(letter: string, chord: boolean): void;
  enterRest(): void;
  enterStroke(midi: number): void;                    // percussion
  setValue(value: NoteValue): void;
  cycleDots(to?: 0 | 1 | 2): void;
  tuplet(n: number, m: number): void;
  toggleTie(): void;
  slur(type: 'slur' | 'cresc' | 'dim'): void;
  transpose(how: 'step' | 'semi' | 'oct', dir: 1 | -1): void;
  accidental(alter: -2 | -1 | 0 | 1 | 2): void;
  articulation(a: Articulation): void; ornament(o: Ornament): void; dynamic(d: Dynamic): void;
  text(t: string | null): void; grace(slash: boolean): void;
  remove(back: boolean): void;
  walk(dir: 1 | -1, extend: boolean): void; bar(dir: 1 | -1): void;
  selectedRefs(): EventRef[]; currentEvent(): MusicalEvent | null;
}
export function useZoomEditing(opts: {
  score: ScoreDocument; dispatch: Dispatch<EditorAction>; trackIndex: number;
  zoom: ZoomState | null; setZoom: (z: ZoomState | null) => void;
  keyFifthsAt: (m: number) => number; clefAt: (m: number) => NotationClef; barQNAt: (m: number) => number;
  percussion: boolean; flash: (msg: string) => void; openBar: (index: number, dir: 1 | -1) => void; close: () => void;
}): ZoomEditing;
```

`zoomIntent` rules:
- Return `null` for anything not listed, and for letters or digits held with ⌥.
- **Pitch keys:** `/^[a-gA-G]$/` gives a letter (with `chord: shiftKey`), unless ⌘ or Ctrl is held.
- **Duration and rhythm keys:**
  - `1`–`7` give a value (`KEY_VALUE`), unless ⌘ or Ctrl is held.
  - `r`, `R` or `0` give a rest.
  - `.` cycles dots.
  - `t`/`T` gives a triplet, `+` a tie, and `s`/`S` a slur.
- **Navigation keys:**
  - ⌘/Ctrl ←/→ moves a bar.
  - ←/→ walk, and ⇧ extends.
  - ↑/↓ transpose: ⌘/Ctrl gives an octave, ⇧ a semitone, otherwise a step.
- **Other keys:**
  - `n`/`N` toggles the pencil.
  - `Backspace` deletes backward (`back: true`), and `Delete` deletes forward (`back: false`).
  - `Escape` closes.

`useZoomEditing` behaviour (v6's `enterLetter`, `enterRest`, `setDuration`, `cycleDots`, `applyTuplet`, `toggleTie`, `addSpan`, `transposeSel`, `setAccidental` and `deleteNote`):
- **Refs:** the cursor's range (`cursorRange`) mapped to `EventRef`s in the zoom's bar and voice. The current event is the one at the cursor, or `null` at `'end'`.
- **`enterLetter`:**
  - On a percussion track, flash `Pick a stroke in the toolbar` and return (Review Focus 4).
  - With `chord`, when a note or chord sits at the cursor or right before it, dispatch `add-chord-note` with `letterAbove(letter, topIndex, key)` and keep the cursor.
  - Otherwise `p = letterPitch(letter, entryReference(cursor, ctx, key, CLEF_REF_INDEX[clef]), key)`:
    - **On an event:** dispatch `write-event` (overwrite) with `p`, then advance the cursor with `advanceCursor`.
    - **At `'end'`:**
      - First predict the fit: `occupiedQN(events) + soundingQN(value, dots) ≤ barQN + QN_EPS`, with a lone filler rest counting as empty.
      - If it doesn't fit, flash `m.${n} is full — shorten a note or pick a smaller value` and dispatch nothing (Review Focus 1).
      - If it fits, dispatch `write-event` at `'end'` with `value` and `dots`. If the bar is now full, advance to the next bar with `advanceCursor`, computed on a context where this bar has the predicted events. Otherwise keep `'end'`.
- **`enterRest`:** the same as `enterLetter`, but with `kind: 'rest'`.
- **`enterStroke(midi)`:** the same with `kind: 'note', midi`. It's the percussion path.
- **`setValue`:**
  - It sets `zoom.value`.
  - When there's a selection, it also dispatches `set-events-rhythm` with `value`. If that would be refused (predict it: part of a tuplet group, or an overflow), flash `Remove the tuplet first, or make room in the bar` instead.
- **`cycleDots(to?)`:** with no selection, it cycles `zoom.dots` (or toggles to `to`). With a selection, it dispatches `set-events-rhythm` with `dots` = the first event's (`eventDots + 1) % 3`, or `to` (0 when it already equals `to`).
- **`tuplet(n, m)`:**
  - At `'end'`, first append a rest of `zoom.value` (if it fits), then apply to it.
  - Otherwise dispatch `apply-tuplet`. On a predicted refusal, flash the exact v6 message:
    - `Tuplets need an undotted note.`
    - `That group doesn’t add up to one note value.`
    - `A {name} can’t be split {n}:{m}. Try a longer note.`
- **`toggleTie`**, **`transpose`** and **`accidental`** dispatch their actions on the selected refs, passing `keyFifthsAt`. A tie on a rest flashes `Select a note to tie from.`
- **`slur(type)`:** dispatches `toggle-span` from the first to the last selected ref. With a single ref, `to` is omitted, which gives next-note/toggle behaviour. If there's no next note, flash `There’s no next note to end on.`
- **Marks:**
  - `articulation`, `ornament`, `dynamic` and `grace` toggle on the selected refs. Picking the value an event already has clears it.
  - `text` applies to the first selected ref.
  - With no selection, they flash `Select a note first.`
- **`remove(back)`:**
  - At `'end'` with `back`, it selects the last event, deletes it, and moves the cursor to `'end'`.
  - Otherwise it deletes the range with `delete-events`, and the cursor becomes `clampCursor({ …cursor, anchor: null })`.
- **`walk` / `bar`:** `walkCursor`. When the cursor changes bar, call `openBar(newIndex, dir)`, which zooms the waveform and plays the slide animation. `bar(dir)` does the same with the cursor at 0 or `'end'`.

The key hook:
- Inside `useZoomEditing`, register a `window` keydown listener while `zoom` is set.
- Ignore the event when `isTypingTarget(e.target)` (Review Focus 5).
- Otherwise map `zoomIntent(e)` to a handler and `preventDefault` when an intent matched. `close` calls `opts.close()`, and `pencil` toggles `zoom.pencil`.
- The ref-reading pattern from `use-measure-keys.ts` avoids stale closures.

- [ ] **Step 1: Write the failing tests**
  - **`zoom-keys.test.ts`:** a table test covering every row of the rules. Include:
    - `{ key: 'F', shiftKey: true }` gives a letter with `chord: true`
    - `{ key: '5' }` gives `value 'q'`
    - `{ key: '7' }` gives `'w'`
    - `{ key: 'ArrowUp', metaKey: true }` gives `transpose oct 1`
    - `{ key: 'ArrowRight', ctrlKey: true }` gives `bar 1`
    - `{ key: 'c', metaKey: true }` gives `null`
    - `{ key: 'x' }` gives `null`
  - **`zoom-editing.test.tsx`:** mount a harness component that runs `useReducer(editorReducer, …)` over a 2-bar 4/4 score, `useState<ZoomState>` opened on bar 1 at `'end'`, and `useZoomEditing` with those. Drive it with window `keydown` events and assert on the reducer's score:
    1. Typing `c` `d` `e` `f` with value q gives four notes C4 D4 E4 F4 in bar 1. The cursor moves to bar 2 `'end'` after the fourth.
    2. Typing `g` into a full bar: the score is unchanged and the flash mock was called with `m.1 is full — shorten a note or pick a smaller value` (Review Focus 1). Make bar 1 full first.
    3. `3` then `r` appends a 16th rest.
    4. `←` then `↑` steps the last note up. `⇧↑` moves it by a semitone, and `⌘↑` by an octave.
    5. `⇧E` on a C adds E to make a chord.
    6. `t` on a quarter makes a 3:2 group.
    7. `+` sets a tie.
    8. `Backspace` at `'end'` deletes the last note.
    9. On a percussion track, `c` doesn't change the score and flashes `Pick a stroke in the toolbar` (Review Focus 4).
    10. A keydown `d` whose target is an `<input>` does nothing (Review Focus 5).

- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement both files.** Wire `useZoomEditing` into `IntegratedEditor`, using its existing flash (`showFlash`) for messages, the zoom state from Task 6, `keyFifthsAt`/`clefAt` from `tracked`, and `barQNAt` from `measureLengthInQN(tracked[m].timeSignature)`.
- [ ] **Step 4: Test, type-check and commit**

```bash
git add lib/playsense-studio/zoom-keys.ts lib/playsense-studio/__tests__/zoom-keys.test.ts components/playsense-studio/studio/zoom components/playsense-studio/studio/integrated-editor.tsx
git commit -m "Type notes, rests, rhythms, chords, ties, slurs and pitch moves in the measure zoom"
```

---

### Task 8: The floating note toolbar

**Files:**
- Create: `components/playsense-studio/studio/zoom/note-toolbar.tsx`
- Test: `components/playsense-studio/studio/zoom/__tests__/note-toolbar.test.tsx`
- Modify: `measure-zoom.tsx` / `integrated-editor.tsx` (render the toolbar inside the zoom; position it)

**Interfaces — Produces:**

```ts
export function NoteToolbar(props: {
  left: number; top: number;                          // zoom-center px; the toolbar centres itself with translateX(-50%)
  info: string;                                       // e.g. 'E4', 'C4 E4 G4', 'rest', 'add'
  value: NoteValue; dots: 0 | 1 | 2; isRest: boolean; tie: boolean; tripletOn: boolean; hasSelection: boolean;
  percussion: { strokes: { midi: number; label: string }[]; current: number | null } | null;
  editing: ZoomEditing; onMore: (anchor: PopoverAnchor) => void;
}): JSX.Element
```

**Contents, in order** (spec §6 and v6's `renderNoteBar`), in a `role="toolbar" aria-label="Note"` with the class `st-fbar`:
1. **Info chip:** `.st-fbar-info`.
2. **Durations:** whole, half, quarter, 8th, 16th. Each has `aria-pressed` when it's the value and the title `{VALUE_NAME} ({key})`, with the key from `KEY_VALUE`. Show the notes as the existing `NoteIcon` SVG glyphs; move `NoteIcon` from `integrated-editor.tsx` into `zoom/note-glyphs.tsx` and import it in both places.
3. **Dot:** `aria-pressed` when dots > 0, and the title `Dot (.)`.
4. **Rest:** `aria-pressed` when `isRest`, and the title `Rest (R)`.
5. **Tie:** `aria-pressed` when `tie`, and the title `Tie (+)`.
6. A separator.
7. **Accidentals:**
   - ♭ ♮ ♯, calling `editing.accidental(-1 | 0 | 1)`, titled `Flat`, `Natural` and `Sharp`.
   - When `percussion` is set, this group is replaced by one button per stroke (label text, `aria-pressed` for `current`, click calling `editing.enterStroke(midi)`).
8. A separator.
9. **Triplet:** an italic "3", `aria-pressed` when `tripletOn`, and the title `Triplet (T)`.
10. **More:** `More ▾`, titled `Everything else`.
11. **Delete:** trash, titled `Delete (⌫)`, shown only when `hasSelection`.

Clicks call the matching `editing.*` handler. Buttons use `onMouseDown={e => e.preventDefault()}` so focus stays out of the toolbar, which keeps the zoom's keys working.

**Position:**
- Place the toolbar under the cursor's note box (from `ZoomLayout.hits`) at `top = hit.y + hit.h + 14`.
- At `'end'`, use `noteEndX`, just after the last note.
- Clamp it inside the center column the same way the measure bar is clamped (measured width, fallback 520).

- [ ] **Step 1: Write the failing test.** Render the toolbar with a mock `editing` (every method a `vi.fn()`) and assert:
  1. The button order by `aria-label` or `title`.
  2. The quarter button is `aria-pressed="true"` when `value: 'q'`.
  3. Clicking ♯ calls `accidental(1)`.
  4. Clicking the 8th button calls `setValue('8')`.
  5. Delete is hidden when `hasSelection: false`.
  6. With `percussion.strokes` of 2 items there are 2 stroke buttons and no ♭♮♯; clicking one calls `enterStroke(midi)`.
  7. `More ▾` calls `onMore`.
- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement** it, and render it in the zoom center. For percussion, the `percStrokes` list is already available (`getPercStrokes(instrument)`).
- [ ] **Step 4: Test, type-check and commit**

```bash
git add components/playsense-studio/studio/zoom components/playsense-studio/studio/integrated-editor.tsx
git commit -m "Float a note toolbar in the measure zoom"
```

---

### Task 9: The More ▾ tabs

**Files:**
- Create: `components/playsense-studio/studio/zoom/more-popover.tsx`
- Test: `components/playsense-studio/studio/zoom/__tests__/more-popover.test.tsx`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (a new optional prop `noteTiming?: NoteTimingProps` passed to the popover)
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (pass `noteTiming`: the same object it builds for `NoteDetails`, when `showSync && selectedOnset`)

**Interfaces — Produces:**

```ts
export type MoreTab = 'durations' | 'tuplets' | 'marks' | 'dynamics' | 'text' | 'timing';
export function MorePopover(props: {
  anchor: PopoverAnchor; tab: MoreTab; onTab: (t: MoreTab) => void; onClose: () => void;
  event: MusicalEvent | null; editing: ZoomEditing; timing?: NoteTimingProps; watchLike: boolean;
}): JSX.Element
```

**Contents** (v6's `openMore`, built on `MeasurePopover` with the title `More`). Tab buttons appear in the order Durations, Tuplets, Marks, Dynamics, Text, Timing. Remember the last tab in `IntegratedEditor` state.
- **Durations:**
  - Buttons: `32nd` (`setValue('32')`), `64th` (`setValue('64')`), `Double dot` (`cycleDots(2)`), `Double flat` (`accidental(-2)`), `Double sharp` (`accidental(2)`).
  - Hint: `32nd and 64th notes, double dot, double flat and double sharp.`
- **Tuplets:**
  - Buttons `3:2 5:4 6:4 7:8 3:4`, each calling `tuplet(n, m)`. The button matching the event's current tuplet has `aria-pressed`, and picking it again undoes it (the reducer merges back).
  - Hint: `Splits the selected note into a group, then type pitches over it. Pick the same one again to undo.`
- **Marks:**
  - An articulation row: Staccato, Staccatissimo, Tenuto, Accent, Marcato, Fermata. Each calls `articulation(...)` and has `aria-pressed` when present.
  - An ornament and grace row: Trill, Mordent, Turn (`ornament`), Acciaccatura (`grace(true)`) and Appoggiatura (`grace(false)`).
- **Dynamics:**
  - A grid `ppp pp p mp mf f ff fff fp sfz` calling `dynamic(...)`, with `aria-pressed` on the current one.
  - A Lines group: `Crescendo` (`slur('cresc')`), `Diminuendo` (`slur('dim')`), `Slur (S)` (`slur('slur')`).
- **Text:**
  - A form with `<input aria-label="Text" placeholder="dolce, pizz., swing…">`, pre-filled with the event's text, and a `Set` button that calls `text(value)`.
  - Chips: `dolce, pizz., arco, div., a tempo, rit., montuno, solo`, each calling `text(chip)`.
  - Typing in the input must never trigger zoom keys (Review Focus 5). `isTypingTarget` covers an `<input>`, and the popover is `role="dialog"`.
- **Timing:**
  - When `timing` is set:
    - `Plays at {formatTime(timing.actualSeconds)}`
    - a nudge stepper: `−5 ms`, `{offset} ms`, `+5 ms`, calling `timing.onNudge(∓5)`
    - `Reset`, calling `timing.onReset`
    - hint: `Nudge moves only this note against the recording.`
  - Otherwise: `Timing is set on the waveform for synced lessons.`
  - "Flex this note" is Plan 4. Don't render it.

- [ ] **Step 1: Write the failing test.** Render each tab with a mock `editing` and assert:
  1. The tab order.
  2. Durations → `Double dot` calls `cycleDots(2)`.
  3. Tuplets → `5:4` calls `tuplet(5, 4)`, and with a 3:2 event `3:2` has `aria-pressed`.
  4. Marks → `Fermata` calls `articulation('fermata')`, and `Acciaccatura` calls `grace(true)`.
  5. Dynamics → `mf` calls `dynamic('mf')`, and `Crescendo` calls `slur('cresc')`.
  6. Text:
     - Submitting `dolce` calls `text('dolce')`, and the chip `div.` calls `text('div.')`.
     - **Review Focus 5:** mount it inside a harness where `useZoomEditing`'s key listener is active, type `d` into the input with a `keydown` on the input, and confirm no note-entry handler ran.
  7. Timing with a `timing` object: `+5 ms` calls `onNudge(5)`. Without one, the fallback text shows.
- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement** it, wire it to the toolbar's More ▾ (`onMore`), and thread `noteTiming` from SyncPanel.
- [ ] **Step 4: Test, type-check and commit**

```bash
git add components/playsense-studio/studio/zoom components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/sync-panel.tsx
git commit -m "Add the More tabs for durations, tuplets, marks, dynamics, text and timing"
```

---

### Task 10: Pointer editing in the zoom

**Files:**
- Create: `lib/playsense-studio/zoom-pointer.ts` (pure: line → staff index, drag steps)
- Test: `lib/playsense-studio/__tests__/zoom-pointer.test.ts`, plus cases in `components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx`
- Modify: `measure-zoom.tsx` (pointer handling in the center; the pencil ghost; V1/V2)
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx` (remove the strip's pitch drag; a note click opens the zoom on that note)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (the strip's note-click handler opens the zoom)

**Interfaces — Produces:**

```ts
export const CLEF_TOP_INDEX: Record<'treble' | 'bass' | 'alto' | 'tenor' | 'percussion', number>;   // staff index of the top line
export function indexForLine(line: number, clef: keyof typeof CLEF_TOP_INDEX): number;             // round to half-lines
export function dragSteps(y0: number, y: number, pxPerStep: number): number;                         // up = positive
```

`pitch.ts` gains `export function keyPitchAt(index: number, keyFifths: number): Pitch`, which exports Task 1's private `keyPitch`. `MeasureZoom` gains these props: `editing: ZoomEditing`, `dispatch: Dispatch<EditorAction>`, `onCursor: (c: NoteCursor) => void`, `clef: NotationClef`, `keyFifths: number`, `percStrokes: PercStroke[] | null`.

`CLEF_TOP_INDEX` is: treble F5 = 38, bass A3 = 26, alto G4 = 32, tenor E4 = 30, percussion F5 = 38. `indexForLine(line, clef) = CLEF_TOP_INDEX[clef] − Math.round(line * 2)` (v6's `pitchAtY`). `dragSteps = Math.round((y0 − y) / pxPerStep)`.

The rules (v6's `focusPointerDown` / `focusPointerMove`):
- **Pointer down on a hit:**
  - Select the note: cursor at that index in the hit's voice. ⇧ extends the cursor range and doesn't start a drag.
  - Otherwise start a pitch drag, but only on a pitched note or chord. Percussion drags snap to strokes, as the strip did before; move that logic here unchanged.
- **Pitch drag:**
  - While dragging: `steps = dragSteps(y0, y, 5 * scale)`. Every note of the chord moves by `steps` diatonic steps in the key: `stepPitch` applied |steps| times.
  - A tooltip shows the new names (`pitchName`), joined by spaces.
  - On release, if anything changed, dispatch `set-event-pitches` for a note or chord (one undo entry).
- **Pencil mode** (`zoom.pencil`):
  - On empty staff space, pointer move shows a gold ghost notehead (`.st-zoom-ghost`, an 11×8 ellipse) at `yForLine(line)` and the pointer x.
  - A click appends a note of the current value at `pitch = keyPitch(indexForLine(lineForY(y), clef))`, using the same fit check and flash as the letter path.
  - Use `fromStaffIndex` plus `keyAlter`, via a small exported helper `keyPitchAt(index, keyFifths)` added to `pitch.ts`.
  - The toolbar gets a pencil toggle after More ▾, titled `Click to add (N)`.
- **V1/V2:**
  - The header `.st-seg` switches `zoom.cursor.voice`, with the cursor at 0 or `'end'`.
  - Hits of the other voice are drawn at 50% opacity and aren't clickable.
  - The V2 button shows when the bar has voice-2 events, or always when the track isn't percussion. That's how a first voice-2 note gets entered.
- **Strip:**
  - Delete the strip's pitch-drag code (`DragState`, `dragTargetMidi`, the drag chip and `onSetPitch`), and move its percussion snapping into `zoom-pointer.ts` as `snapStroke(...)`.
  - A note click in the strip now calls a new prop `onOpenNote(measureIndex, eventIndex)`, which `IntegratedEditor` wires to `openMeasure(measureIndex, eventIndex)`. Bar clicks and drags are unchanged.
  - Update the Plan 3a strip test "click on empty staff never touches notes / never calls onSetPitch": `onSetPitch` no longer exists, so assert that no note-mutating callback exists and that a note click calls `onOpenNote`.

- [ ] **Step 1: Write the failing tests.**
  - `zoom-pointer.test.ts`:
    - `indexForLine(0,'treble') === 38`
    - `indexForLine(2,'treble') === 34` (B4)
    - `indexForLine(4.5,'treble') === 29` (D4)
    - `indexForLine(0,'bass') === 26`
    - `dragSteps(100, 90, 5) === 2`
    - `dragSteps(100, 107, 5) === -1`
    - `keyPitchAt(31, 2)` returns `{ midi: 66 … }`
  - In `measure-zoom.test.tsx`:
    1. A pointerdown/up on a hit selects it (the cursor index is reported through `onCursor`).
    2. A drag of −10 px on a C4 note dispatches `set-event-pitches` with `[64]` (two steps up).
    3. In pencil mode, a click on empty staff dispatches `write-event` at `'end'`.
    4. V2 switches the cursor voice.
  - Adapt the harness to pass `dispatch` and `setZoom`.
- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Test, type-check and commit**

```bash
git add lib/playsense-studio/zoom-pointer.ts lib/playsense-studio/pitch.ts lib/playsense-studio/__tests__ components/playsense-studio/studio
git commit -m "Drag pitches, add notes with the pencil and edit voice 2 in the zoom; strip clicks open the zoom"
```

---

### Task 11: Retire the old insert toolbar

**Files:**
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`
- Modify: existing tests that referenced the old toolbar

**Steps:**
- [ ] **Step 1: Remove the retired UI.**
  - The zoom now covers entry, so remove from `IntegratedEditor`:
    - the insert toolbar block (`st-notebar`: durations, the More popover, modifiers, the pitch stepper and percussion picker, Rest, Add note, capacity, delete)
    - the help line under it
    - their state: `duration`, `pitchLetter`/`pitchAcc`/`pitchOctave`, `dotted`, `triplet`, `articulation`, `insertRest`, `percMidi`, `moreOpen`
    - their handlers: `onDurationClick`, `onPitchPartChange`, `onStrokeClick`, `onToggleRest`, `onToggleDotted`, `onToggleTriplet`, `onToggleTie`, `onArticulationClick`, `handleAddNote`, `insertIntoMeasure`, `capacity`, `applyPitchToSelection`, `applyDurationToSelection`
    - the old note-level keydown effects: the main entry effect, and the Esc/⌫-on-note effect. The zoom's keys replace them.
  - Keep `NoteIcon` (moved in Task 8), the piano-roll tab (it has its own duration state and dispatches `add-note` itself), the MIDI record button and the editor bar.
  - Delete anything that becomes unused. `tsc` and eslint will point it out.
- [ ] **Step 2: Update the footer hint.**
  - With bars selected: `⏎ edit notes · ⌘D duplicate · ⌫ delete · esc deselect`.
  - With nothing selected: `Drag across bars to select · double-click a bar to edit its notes · scroll to zoom`.
  - Update the `ShortcutsPopover` rows: `Double-click or ⏎` now reads `edit the bar's notes`.
  - Add a second group, `In the zoom`, listing the keys from the Global Constraints.
- [ ] **Step 3: Update the tests.** Update or delete the tests that drove the old toolbar or old keys: the ⏎-adds-a-note cases in `integrated-editor-measure-bar.test.tsx` and any `st-notebar` query. On the staff tab ⏎ now opens the zoom; on the Piano-roll tab it does nothing.
- [ ] **Step 4: Verify and commit.** Run `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**'` and `npx tsc --noEmit -p .`.

```bash
git add components/playsense-studio/studio
git commit -m "Retire the old insert toolbar now that the measure zoom handles note entry"
```

---

### Task 12: Beams for additive meters and legacy triplet groups

**Files:**
- Modify: `lib/playsense-studio/notation/build-measure.ts` (`beamGroups`)
- Modify: `lib/playsense-studio/score-to-vexflow.ts` (legacy id-less triplet grouping)
- Test: `lib/playsense-studio/__tests__/notation-build-measure.test.ts`, `lib/playsense-studio/__tests__/notation-descriptors.test.ts`

**Rules:**
- **Additive meters.** `x/8` meters that aren't compound (`x % 3 !== 0`) beam by these groups of eighths: 5 → 3+2, 7 → 2+2+3, 8 → 3+3+2, 10 → 3+3+2+2, 11 → 3+3+3+2. Other `x/8` values beam by quarter, as today.
  - In `beamGroups`, compute the group key from the eighth-index boundaries instead of `Math.floor(qn / beatQN)`.
  - Every other meter's beaming is unchanged.
- **Legacy triplets** (no `tuplet.id`):
  - A group closes when the running sounding position within the bar lands exactly (±1e-6) on a multiple of `unit`. `unit` is `beatQN` when the group's first written value is an eighth or longer, and `beatQN / 2` otherwise.
  - As a safety, a group also closes once its sounding length reaches 2 × `unit`. A non-triplet event, or the end of the bar, also closes it.
  - This replaces the "3 × smallest written value" rule, which split `[8,16,16,8]`.

- [ ] **Step 1: Write the failing tests**
  - `beamGroups` on eight eighths in 7/8, where the first seven are notes, gives groups over indices `[0,1] [2,3] [4,5,6]`. In 5/8: `[0,1,2] [3,4]`. 4/4 and 6/8 are unchanged: keep the existing tests.
  - Legacy triplet groups, given as `extractTrackEvents` tuplet ids per event with only the grouping asserted:
    - `[8,16,16,8]` → one group
    - `[q,8]` → one
    - `[q,q,q]` → one
    - `[8×6]` → two
    - `[16×6]` → two
    - `[q,8,8,…]` → `[q,8]`, then a new group starting at the third
- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run lib/playsense-studio components/playsense-studio/player --exclude '.worktrees/**'`. The student renderer uses the same builder, and its tests must stay green.

```bash
git add lib/playsense-studio
git commit -m "Beam additive eighth meters in their natural groups and group legacy triplets by the beat"
```

---

### Task 13: Plan 3a follow-ups

**Files:**
- Modify: `lib/playsense-studio/notation/spans.ts` (an `openEnds` option)
- Modify: `components/playsense-studio/studio/continuous-staff.tsx` (pass `openEnds: true`)
- Modify: `lib/playsense-studio/midi-recording.ts` (ids for recorded notes)
- Test: `lib/playsense-studio/__tests__/notation-spans.test.ts`, `lib/playsense-studio/__tests__/midi-recording.test.ts`

**Rules:**
- **`openEnds`.** `spanSegments(spans, placed, opts?: { openEnds?: boolean })`: with `openEnds`, a **slur** whose `from` is placed but `to` isn't draws `{ from, to: undefined }`, and a `to`-only slur draws `{ from: undefined, to }`. Both are open curves to the window edge. Hairpins still need both ends.
  - The student renderer doesn't pass the option, so its behaviour is unchanged.
- **MIDI-recorded notes.** Every note, chord and rest event built by `midi-recording.ts` gets `id: newEventId()`.

- [ ] **Step 1: Write the failing tests.**
  - **Spans:**
    - With `openEnds`, a slur with only `from` placed yields one segment with `to: undefined`.
    - A cresc with one end yields nothing.
    - Without the option, a one-end slur yields nothing, as before.
  - **MIDI:** in `midi-recording.test.ts`, every event from the performance → score conversion has a string `id`, and the ids are unique.
- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Test and commit.**

```bash
git add lib/playsense-studio components/playsense-studio/studio/continuous-staff.tsx
git commit -m "Draw slurs that leave the drawn window as open curves and give recorded MIDI notes ids"
```

---

### Task 14: Roadmap, and hand the browser checks to the user

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1: Update the roadmap.**
  - Under `### Plan 3b (next)`, rename the heading to `### Plan 3b — done YYYY-MM-DD`. Mark every item done except:
    - **the one-row transport:** it stays, moved to the Plan 7 list
    - **MIDI/on-screen keys:** these stay in Plan 7
  - Mark `debounce the continuous staff's redraw during zoom` done: it was done in the Plan 3a final fix, which merges redraws per animation frame.
- [ ] **Step 2: Run the full verification.** Run `npx vitest run --exclude '.worktrees/**'` (all must pass) and `npx tsc --noEmit -p .` (it must be clean).

  **The browser checks are handed to the user:** the agent doesn't run a dev server. The user checks these in a video lesson:
  1. Double-click a bar. It zooms in with neighbours on both sides, beat bands and a fill meter. ⌘→ moves to the next bar, and Esc closes the zoom.
  2. Type `c d e f` with 5 (quarter). Four notes appear and the cursor moves on. Typing into a full bar shows the "is full" flash.
  3. Check the pitch moves: ↑/↓ steps in the key, ⇧↑ moves a semitone, ⌘↑ an octave, and ⇧E makes a chord.
  4. Check the rhythm and marks: `t` makes a triplet, `+` a tie and `S` a slur, and More → Dynamics → mf and More → Text → dolce show on the staff.
  5. Drag a note up and down. With the pencil (N), click to add a note.
  6. In V2, enter a note. The student highway (Preview) still grades only voice 1.
  7. Edit a note inside a repeat. Every pass changes.
- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md
git commit -m "Mark Studio rework plan 3b done"
```
