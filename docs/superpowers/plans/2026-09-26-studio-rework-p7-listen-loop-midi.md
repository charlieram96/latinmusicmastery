# Studio Rework P7 — Listen, Loop, MIDI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Studio the admin can hear the written score, synthesised in step with the recording (Recording / Score / Both). They can loop the selected bars at 100%, 75% or 50% speed with pitch kept, see the loop on the waveform, and enter notes in the measure zoom from a MIDI keyboard or on-screen keys.

**Architecture:**
- **Score synth.** A score synth engine (`lib/playsense-studio/score-synth.ts`) mirrors the proven `ClickTrack`: Web Audio notes are scheduled a short horizon ahead against the video element's media time, and re-anchored on seeks and rate changes. Its note list is built from the score and the sync markers (timeline time, with nudges) and converted to media time through the flex map, so it matches the note overlay exactly. A `useScoreSynth` hook mirrors `useVideoClickTrack`.
- **Hear, loop and speed.** These are SyncPanel wiring over the existing clock loop and the speed menu.
- **MIDI entry.** A small `useMidiInput` hook feeds a 45 ms chord grouper, which calls the zoom's existing `enterPitch`, `add-chord-note` and `enterStroke` paths.

**Tech Stack:** Web Audio API, Web MIDI API, React 19, TypeScript, vitest (+ jsdom; no testing-library).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` §10. The roadmap entry is "Plan 7".

## Global Constraints

- **Git rules:**
  - Never run `git stash` in any form.
  - Stage only your files, by path.
  - Commit messages are imperative with no prefix, then a blank line and the `Co-Authored-By` trailer.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**'`. Typecheck: `npx tsc --noEmit -p .`. Lint: `npx eslint --no-cache <files>`, with no new issues against the base.
  - Component tests use `// @vitest-environment jsdom` plus `createRoot` and `act`.
- **Synth sound:**
  - Pitched notes: a triangle oscillator at the note's frequency, with a 4 ms linear attack to the peak. The peak holds until the note's end, then decays exponentially to 0.001 over 80 ms.
  - The peak is 0.25 for voice 1 and 0.12 for voice 2, times the Score volume.
  - Tied notes are merged into one long note. Rests are silent. Chord notes sound together.
  - Grace notes are skipped.
  - Percussion: a 30 ms white-noise burst through a bandpass filter at 1800 Hz, peak 0.3.
- **Synth timing:**
  - A note's start = `noteTime(markers, onsetQN)` (timeline, including nudges), converted to media with `flexMap.toMedia`. Its end = the grid time of `onsetQN + duration`, converted the same way.
  - Scheduling uses a lookahead of 25 ms per tick and a 0.12 s horizon, like `ClickTrack`. Notes whose start is already past are dropped, never played late.
- **Hear:**
  - A segmented control `Hear` with `Recording` / `Score` / `Both`, in the SyncPanel context bar (not inside the shared TransportBar).
  - Recording mutes the synth.
  - Score sets the video element's `muted` (keeping the admin's own mute choice for when they go back to Recording or Both) and enables the synth.
  - Both enables the synth and unmutes the video, unless the admin muted it.
  - The choice is stored in `localStorage` under `playsense-studio:hear`, defaulting to `Recording`.
- **Loop:**
  - `L` toggles a loop on the selected bars when the strip has a selection and focus isn't in a text field. It reuses `loopMeasures`.
  - The loop speed chip `Loop speed` offers `100%` / `75%` / `50%` and calls the existing `onDisplayedRateChange`.
  - Whenever the rate is set from the Studio, the element gets `preservesPitch = true`.
  - The waveform draws the loop as a bracket: a translucent band in the theme's gold at 12% alpha between the timeline loop A and B, with 2 px edges.
- **MIDI entry:**
  - In the measure zoom, `K` toggles the `Keys` panel. The first time, it requests Web MIDI with `requestMIDIAccess({ sysex: false })` and listens on every input.
  - A note-on (status 0x9n with velocity above 0) enters the pitch, spelled by the key signature in force (`spellMidi(midi, { keyFifths })`).
  - Note-ons within 45 ms of the first form a chord: the first is entered, and the rest are added with `add-chord-note` on the event just entered.
  - Percussion scores map through `gmToStrokeMidi` and `enterStroke`, so there are no chords there.
  - **On-screen keys:** 2 octaves (C to B, twice), black and white keys, with `◀ Octave` / `Octave ▶` buttons (range C1..C7) and a label `C4–B5` showing the current range. Clicking a key enters the pitch the same way.
  - If `requestMIDIAccess` is missing or refused, the panel shows `No MIDI keyboard — use the keys below`.

## Decisions this plan makes

1. **The transport layout.** It stays as it is (two rows). TransportBar is shared with the student player, so Hear and Loop speed go in the Studio's context bar instead. The roadmap's "one-row transport" item moves to a follow-up.
2. **MIDI ids.** The roadmap item "MIDI-recorded notes get event ids only on the next open" is already fixed (commit 0a3df76). This plan records that in the roadmap.
3. **Where Hear lives.** Hear is Studio-only. Students don't get a Score mode in this plan.
4. **The spike page.** `app/(dev)/flex-spike` stays until the user reports the device results. That's the user's follow-up.

## Review Focus

1. **The synth stays in step with the overlay** across a nudge and a flex segment. A note's scheduled media time equals `flexMap.toMedia(noteTime)`. Test: Task 1.
2. **Score mode with the admin's own mute:** switching back to Recording restores the admin's mute choice. Test: Task 2.
3. **L while typing** in a text field doesn't loop. Test: Task 3.
4. **A MIDI chord at 45 ms** is one chord, and 60 ms apart gives two notes. Test: Task 4.
5. **A refused MIDI permission** shows the fallback text, and the on-screen keys still work. Test: Task 5.

---

### Task 1: The score synth engine (notes and scheduling)

**Files:**
- Create: `lib/playsense-studio/score-synth.ts`
- Test: `lib/playsense-studio/__tests__/score-synth.test.ts`

**Interfaces:**

```ts
export interface SynthNote { start: number; end: number; midi: number; voice: 1 | 2; percussion: boolean }
/** Timeline notes for the active track: voice 1 and 2, ties merged, rests/graces skipped, chords expanded. */
export function scoreSynthNotes(score: ScoreDocument, trackIndex: number, markers: MarkerState): SynthNote[]
/** Same notes with start/end converted to MEDIA seconds through the flex map. */
export function toMediaNotes(notes: SynthNote[], flex: FlexMap): SynthNote[]
export class ScoreSynth {
  constructor(ctxFactory?: () => AudioContext)
  setNotes(notes: SynthNote[]): void          // media seconds, sorted by start
  setVolume(v: number): void                  // 0..1
  start(mediaNow: number, rate: number): void // schedule from mediaNow at playback rate
  reanchor(mediaNow: number, rate: number): void
  teardown(): void                            // silence scheduled notes (gain bus to 0), stop the tick
  close(): void
}
```

- **Building the notes.** Walk the track's measures and voices, and collect each note's start QN and duration QN. Use the helpers that `noteTicks` / `collectOnsets` rely on in `components/playsense-studio/sync/marker-model.ts` and `lib/playsense-studio/note-onsets.ts` (read them).
- **Ties.** When an event has `tieToNext` (or a chord note's own tie), extend the matching pitch on the next event instead of starting a new note.
- **Voices and chords.** Voice 2 comes from the measure's second voice, if present. Chords expand to one note per pitch.
- **Scheduling.** Model it on `lib/playsense-studio/click-track.ts` (`TICK_MS`, `HORIZON_SEC`, a gain bus per run, dropping notes that are already past). Each note uses the envelope from Global Constraints. Percussion uses a noise buffer.
- **Tests:**
  - A 4/4 bar of four quarter notes at 120 bpm, with markers from 0 s, gives starts 0, 0.5, 1, 1.5 and ends 0.5, 1, 1.5, 2.
  - A tie across the bar line merges into one note.
  - A nudge of +0.02 on beat 2 moves that start to 0.52 (the end is unchanged).
  - Voice 2 notes come out with `voice: 2`.
  - Rests and graces are skipped.
  - `toMediaNotes` with a flex map `[p(0,0,a), p(1,1.2), p(4,4,a)]` sends a timeline start of 1.2 to media 1.0.
  - Scheduling, with a fake AudioContext recording `start(time)` calls: after `start(0.9, 1)`, one tick schedules the notes whose media start is in [0.9, 1.02]. A note at 0.85 isn't scheduled. `teardown` ramps the bus gain to 0.

- [ ] Steps: failing tests, then implement, then run the tests and tsc. **Commit:** `Add a score synth that schedules the written notes against the recording`.

---

### Task 2: Hear Recording, Score or Both in the Studio

**Files:**
- Create: `components/playsense-studio/player/state/use-score-synth.ts`, modelled on `use-video-click-track.ts`:
  - same element listeners (play/playing/seeked/ratechange start; seeking/pause/ended/waiting/stalled tear down)
  - `smoothRateChanges` re-anchors
  - a drift check
  - notes set imperatively and keyed by a hash of start/midi
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - `hear` state from localStorage
  - the `Hear` segmented control in the context bar (showSync only)
  - compute `synthNotes = toMediaNotes(scoreSynthNotes(score, activeTrack, markers), flexMap)`
  - `useScoreSynth({ videoRef, notes: synthNotes, enabled: hear !== 'recording', volume, smoothRateChanges: !flexMap.isIdentity })`
  - apply the video mute from `hear === 'score' || adminMuted`
- Tests:
  - `components/playsense-studio/player/state/__tests__/use-score-synth.test.tsx`, following the click-track test's fakes: it starts on play and tears down on pause.
  - A pure `hearMute(hear, adminMuted)` helper test for Review Focus 2.

- [ ] Steps: failing tests, then implement, then the full suite, tsc and eslint. **Commit:** `Hear the recording, the score or both in the Studio`.

---

### Task 3: Looping with L, loop speed with preserved pitch, and a loop bracket on the waveform

**Files:**
- Modify: `components/playsense-studio/studio/measure/use-measure-keys.ts` (or wherever the strip's key handler lives): `L` calls `onLoopMeasures(selectionStart, selectionEnd)`. Pass the callback through.
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - The `Loop speed` chip (`100%` / `75%` / `50%`), shown while a loop is active, calls `onDisplayedRateChange(0.75)` and so on.
  - Every Studio-initiated rate change sets `video.preservesPitch = true`, plus the vendor variants where present. The flex hook already handles its own case.
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx`: a new optional prop `loop?: { a: number; b: number } | null` (timeline). It draws the bracket, and SyncPanel passes the timeline loop.
- Modify: `components/playsense-studio/player/transport/transport-bar.tsx`: change the loop hint text to `Loop the selected bars with L, or drag on the staff`. It's a copy change only; the student player's text is shared, and this wording works for both.
- Tests:
  - a key test: L with a selection calls `onLoopMeasures`, and in a text input it doesn't (Review Focus 3)
  - the canvas draws the bracket (use the existing recording-context canvas test pattern in `waveform-canvas-warp.test.tsx`)
  - a pure `applyStudioRate(video, rate)` helper test that sets `playbackRate` and `preservesPitch`

- [ ] Steps: failing tests, then implement, then the full suite, tsc and eslint. **Commit:** `Loop bars with L at a chosen speed and show the loop on the waveform`.

---

### Task 4: MIDI input and chord grouping

**Files:**
- Create: `lib/playsense-studio/midi-chords.ts`: `class ChordGrouper { constructor(onNote: (midi) => void, onChordNote: (midi) => void, windowMs = 45); noteOn(midi: number, atMs: number): void }`. The first note in a window calls `onNote`, and later notes within 45 ms of that first note call `onChordNote`.
- Create: `hooks/use-midi-input.ts`: `useMidiInput(enabled: boolean, onNoteOn: (midi, atMs) => void): { status: 'idle' | 'ready' | 'unavailable' }`.
  - It requests access once, when first enabled, and listens on every input (and on inputs added later via `onstatechange`).
  - It parses note-on messages (status & 0xf0 === 0x90 with velocity above 0).
  - It detaches its listeners when disabled or unmounted.
  - A missing API or a rejection gives `'unavailable'`.
- Tests:
  - `midi-chords.test.ts`: notes at 0 and 30 ms make a chord; notes at 0 and 60 ms make two notes; three notes within 45 ms make one chord of three (Review Focus 4).
  - `hooks/__tests__/use-midi-input.test.tsx`: mock `navigator.requestMIDIAccess` as the existing `use-studio-midi-recorder.test.tsx` does. Cover note-on parsing, ignoring velocity 0, `unavailable` on rejection, and detaching on disable.

- [ ] Steps: failing tests, then implement, then the full suite and tsc. **Commit:** `Read MIDI keyboards and group notes played together into chords`.

---

### Task 5: The Keys panel in the measure zoom

**Files:**
- Create: `components/playsense-studio/studio/zoom/keys-panel.tsx`:
  - The on-screen keyboard (2 octaves, octave shift, the range label).
  - The MIDI status line: `MIDI keyboard ready`, or the Global Constraints fallback text.
  - Props: `onPitch(midi)`, `onChordPitch(midi)`, `percussion`, `status`, `octave`, `onOctave(delta)`.
- Modify: `components/playsense-studio/studio/zoom/use-zoom-editing.ts` and `lib/playsense-studio/zoom-keys.ts`:
  - `K` toggles `keysOpen`.
  - Wire `useMidiInput(keysOpen, grouper.noteOn)`.
  - The grouper's `onNote` calls `enterPitch(midi, spellMidi(midi, { keyFifths: keyFifthsAt(bar) }).spelling)` for a pitched score, or `enterStroke(gmToStrokeMidi(midi, instrument))` for percussion.
  - `onChordNote` dispatches `add-chord-note` on the event just entered, pitched only. Percussion treats it as another stroke.
  - The on-screen keys call the same functions (a key click always counts as a new note).
- Modify: `components/playsense-studio/studio/zoom/measure-zoom.tsx`: render the Keys panel under the zoom staff when it's open.
- Tests:
  - A zoom-editing test: K opens the panel. A MIDI note-on (with the mocked `requestMIDIAccess`) enters a note with key spelling: in F major, MIDI 70 is spelled B♭. Two note-ons 20 ms apart give one chord.
  - On a percussion score, a GM note maps to a stroke.
  - With refused access, the fallback text shows and an on-screen key click still enters a note (Review Focus 5).

- [ ] Steps: failing tests, then implement, then the full suite, tsc and eslint. **Commit:** `Enter notes from a MIDI keyboard or on-screen keys in the measure zoom`.

---

### Task 6: Roadmap and browser checklist

- [ ] **Roadmap:**
  - Add "### Plan 7 — done <date>": what shipped, the rulings, and the follow-ups (the one-row transport restyle; students don't get Hear).
  - Mark the MIDI-ids item done (0a3df76).
  - Note that the flex-spike page is to be deleted after the user reports the device results.
  - Commit.
- [ ] **Browser checklist:**
  1. **Hear.** Set Hear to Score on a Watch section: the synth plays the notes in step with the bar lines, and the video is silent. Both mixes them, and Recording restores it.
  2. **Loop speed.** Select 2 bars and press L: the loop bracket shows, and playback loops. At 75% and 50% the pitch is unchanged.
  3. **MIDI.** In the zoom, press K and play a MIDI keyboard: notes are entered with the key's spelling, and chords played together land as chords. Without a keyboard, the on-screen keys work.
