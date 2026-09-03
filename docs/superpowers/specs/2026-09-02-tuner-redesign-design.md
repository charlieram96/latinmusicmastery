# Tuner Redesign — Design

**Date:** 2026-09-02
**Route:** `/dashboard/tuner` (`app/dashboard/tuner/page.tsx`)
**Status:** Approved (pending spec review)
**Prototype of record:** https://claude.ai/code/artifact/0f6dd1d8-c6ce-46dd-99aa-13f41a137dee

## Goal

Replace the current tuner with one that is accurate, stable, and complete: a
better pitch engine, real instrument/tuning support for the instruments Latin
music students actually play (guitar, bass, tres cubano, cuatro, ukulele,
violin, and anything chromatic), reference tones, a per-string checklist and
session log, and a layout that matches the approved prototype using the app's
existing design tokens.

## Why the current tuner fails

- `hooks/use-pitch-detection.ts` uses plain normalized autocorrelation, which
  latches onto harmonics and flips octaves on low strings.
- The reading blanks the instant a note decays, so the meter flickers.
- No note hysteresis: a string 40 cents flat reads as the neighbouring note.
- No reference tones, no manual string targeting, no device selection.

## Locked decisions

- **Engine:** McLeod Pitch Method (NSDF + key-max peak picking + parabolic
  interpolation) running in an **AudioWorklet**, with an AnalyserNode
  main-thread fallback when `addModule` fails.
- **Post-processing:** 5-sample median → note hysteresis (3 consecutive frames
  or > 1.5 semitones jump) → cents EMA (α = 0.4) → decay hold → lock detector
  (inside the in-tune window for 450 ms).
- **Instruments and tunings** (courses listed low → high; doubled strings are
  one course):
  - Guitar: Standard, Drop D, Half step down, DADGAD, Open G
  - Bass: Standard 4, 5-string (B0 E1 A1 D2 G2), Drop D
  - Tres cubano: Afinación en Do (G3·G4, C4·C4, E4·E4), Afinación en Re
    (A3·A4, D4·D4, F♯4·F♯4)
  - Cuatro puertorriqueño: B2·B3, E3·E4, A3·A3, D4·D4, G4·G4
  - Ukulele: Standard (G4 C4 E4 A4), Low G
  - Violin: G3 D4 A4 E5
  - Chromatic: no strings; targets nearest semitone. Piano is handled here
    (no dedicated Piano chip — **default chosen, user did not object**).
- **String targeting:** Auto (nearest course, highlighted only within ±75 cents)
  or Manual (tap a pad; cents are computed against that course, choosing the
  nearer note for octave courses). `←`/`→` cycle manual strings.
- **Meter:** Needle is the default; Strobe is a toggle (**default chosen**).
  Strobe has two bands, the fine band runs at 4× speed; both freeze when locked.
- **Reference tones:** A4 stepper 415–466 Hz with presets 432/440/442/444; a
  12-note keyboard with octave 2–5; a play button on every string pad
  (auto-stops after 3 s). Timbre: additive periodic wave (harmonics
  1, .45, .22, .11, .05) with a 20 ms attack and 150 ms release.
- **Session card:** per-string "in tune" checklist with a progress bar and a
  log of locked notes (note, Hz, cents, time ago), max 12 entries, **per
  session only, no persistence** (**default chosen**; a Supabase table can be
  added later without changing the UI).
- **Settings popover:** sensitivity (low/med/high), in-tune window (±1/±3/±5
  cents, default ±3), note names (C D E / Do Re Mi), transposition (Concert,
  B♭ = +2, E♭ = +9, F = +7), hold last note (off/1 s/2 s).
- **Persisted preferences** (localStorage, key `lmm-tuner-prefs`): instrument,
  tuning, A4, sensitivity, tolerance, note names, transposition, hold, meter
  mode. Never persisted: mic state, readings, log.
- **Bottom strip:** three short tips (read the meter, cents and Hz, tune down
  then up) plus a "Keep practicing → Play Sense" card (**default chosen: keep
  the strip**). The mockup's Interval Trainer / Chord Finder / Scale Explorer
  cards are dropped because those tools do not exist.
- **Icons:** Lucide, matching the sidebar (`Guitar`, `Music2`, `AudioLines`,
  `Mic`, `MicOff`, `Volume2`, `Clock`, `SlidersHorizontal`, `Lightbulb`,
  `Gauge`, `Waves`, `Ear`, `Drum`).
- **Privacy copy:** the status box always states audio never leaves the device.

## Hard constraints

- Route, sidebar entry, and dashboard quick action keep pointing at
  `/dashboard/tuner`.
- Every user-facing string goes through `useTranslation` with entries in both
  `locales/en.json` and `locales/es.json` under `dashboard.pages.tuner`.
- Works in light and dark theme using existing tokens only (`--primary`,
  `--gold-highlight`, `--terracotta`, `--success`, `--card`, `--border`,
  `--muted-foreground`, `font-heading` = Montserrat). No new colors.
- No new npm dependencies. Framer Motion, Radix (Select, Popover, Tooltip),
  Lucide, and Tailwind are already available.
- No database changes.
- Pure logic lives in `lib/tuner/` and must run under vitest's `node`
  environment (no DOM, no Web Audio imports).
- `getUserMedia` requests `echoCancellation: false, noiseSuppression: false,
  autoGainControl: false` (processing destroys pitch accuracy).

## Architecture

### `lib/tuner/` (pure, tested)

- `note-math.ts` — keep and extend today's `tuner-utils.ts` helpers:
  `midiToHz`, `hzToMidiFloat`, `centsBetween`, `nameToMidi`, `noteParts(midi,
  names)` → `{ base, acc, oct, pc }` for letters or solfège, `noteLabel`,
  `transposeForDisplay(midi, semitones)`.
- `pitch-engine.ts` — `mpm(buffer, sampleRate, minHz, maxHz, kMax) →
  { hz, clarity } | null`. Fixed correlation window `W = n − maxTau` so NSDF is
  comparable across lags; skips the τ≈0 lobe; only lags ≥ `minTau` count as
  peaks. Range 27–1400 Hz, `kMax = 0.93`, buffer 4096 samples. The same source
  is copied verbatim into the worklet (see below) — write the body in plain
  JS syntax (no imports, no inline type annotations; types live on a separate
  declaration) so the copy stays a pure duplicate, guarded by a test that both
  files contain identical `mpm` bodies.
- `pitch-tracker.ts` — `class PitchTracker` with `push(reading | null, nowMs,
  a4, { holdMs, tolCents, targetMidi })` → `Frame | null` where
  `Frame = { hz, midi, cents, clarity, held, locked, justLocked }`. Behaviour
  as in Locked decisions. `reset()` on instrument/tuning/target change.
- `instruments.ts` — `TUNER_INSTRUMENTS` with `id`, `icon`, i18n key, and
  `tunings[] { id, nameKey, courses: string[][] }`; `courseMidis`,
  `nearestCourse(courses, hz, a4)`, `courseTargetMidi(course, hz, a4)`,
  `targetMidis`.
- `sensitivity.ts` — `SENSITIVITY_PRESETS` (`rms`, `clarity`): low
  0.02/0.93, med 0.01/0.88, high 0.004/0.80.
- `prefs.ts` — `TunerPrefs` type, defaults, `loadPrefs()/savePrefs()` with
  try/catch around localStorage and schema validation with zod.

Delete `lib/tuner/tuner-utils.ts` after moving its callers (only the tuner
components use it).

### Audio layer

- `public/audio-worklets/pitch-detector-processor.js` — plain JS
  `AudioWorkletProcessor` (same conventions as
  `onset-detector-processor.js`). Accumulates input into a 4096-sample ring,
  every 1024 samples (≈ 21 ms at 48 kHz) computes RMS, peak, and — if RMS ≥
  the configured gate — `mpm`. Posts `{ hz, clarity, rms, peak }` (hz `null`
  when gated or below clarity). Accepts `{ type: 'config', rms, clarity }`
  messages.
- `hooks/use-tuner-engine.ts` (replaces `use-pitch-detection.ts`):
  - `start(deviceId?)`: `getUserMedia` → `AudioContext` (created in the gesture)
    → 25 Hz high-pass `BiquadFilter` → worklet node. If `addModule` throws,
    fall back to `AnalyserNode` (fftSize 4096) polled at ≤ 30 Hz on the main
    thread with the same `mpm` from `lib/tuner/pitch-engine.ts`.
  - After permission, `enumerateDevices()` → `audioinput` list and the active
    track's label; `setDevice(id)` restarts the graph.
  - Feeds every worklet message through `PitchTracker` and writes the result to
    a small external store (`lib/tuner/tuner-store.ts`: `getSnapshot`,
    `subscribe`). Components that need per-frame values use
    `useSyncExternalStore`; the page does not re-render per frame.
  - Exposes `{ status: 'idle' | 'starting' | 'listening' | 'error', error,
    devices, deviceId, start, stop, setDevice, setSensitivity, setTarget,
    reset }`.
  - Stops tracks and closes the context on unmount and on `stop()`.
- `hooks/use-reference-tone.ts` — shares the engine's `AudioContext` (creates
  one if the mic is off); `play(hz)`, `stop()`, `playing`, `retune(hz)`.

### Components (`components/tuner/`)

Replace the current set. One file per unit, each ≤ ~200 lines:

- `instrument-chips.tsx` — role=tablist of instruments.
- `tuning-select.tsx` — Radix Select; hidden when an instrument has one tuning.
- `note-display.tsx` — glyph (Montserrat 900, `text-[140px]` desktop /
  `text-[108px]` mobile, accidental and octave as smaller spans), the
  transposition/manual-target line, and the verdict pill (`in-tune` /
  `slightly-flat|sharp` / `flat|sharp` / `listening` / `ready`). Uses
  `aria-live="polite"`.
- `tuning-meter.tsx` — canvas; needle and strobe modes; eased needle
  (`dt × 14`), colour follows the eased position; respects
  `prefers-reduced-motion` (no easing, no strobe motion); ResizeObserver +
  DPR-aware; reads colours from CSS variables.
- `readouts.tsx` — cents (signed, coloured) with guidance sub-line
  ("tighten to raise" / "loosen to lower" / "hold it there" / "locked in"),
  detected Hz with target Hz.
- `listen-button.tsx` — gold gradient "Start tuning"; live state with pulsing
  dot "Listening… tap to stop". `Space` toggles (when focus is not in a control).
- `input-panel.tsx` — device select + status box (off / on with device label /
  error) + 10-segment level meter (last three segments red; all red on clip).
- `string-pads.tsx` — rewrite: course pads with sub-label for doubled strings,
  auto/manual toggle, near/target/done states, per-pad play button.
- `reference-tone-card.tsx` — A4 stepper + presets, play/stop button that
  names the note, 12-note keyboard, octave chips, help line.
- `session-card.tsx` — progress bar, log rows, Clear.
- `tuner-settings-popover.tsx` — Radix Popover with the five segmented options.
- `tuner-tips.tsx` — the three tips and the Play Sense link card.

Remove: `strobe-meter.tsx`, `note-readout.tsx`, `signal-waveform.tsx`,
`tuner-settings.tsx`, `tuner-explainer.tsx`.

### Page (`app/dashboard/tuner/page.tsx`)

Owns `prefs` (via `useTunerPrefs`), `auto/manual` target, session `log` and
`done` set, and wires the engine, tracker target, and reference tone. Layout:
`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]`; the main card holds header
row (brand + tuning select + settings), instrument chips row, stage
(note-display, meter, readouts, listen button, hint), input panel, string pads;
the right column holds reference-tone and session cards; the tips strip spans
both columns. Mobile: single column, chips scroll horizontally, listen button
full width. Keep `loading.tsx`.

## Data flow

```
mic → HPF 25 Hz → worklet (RMS gate → MPM → clarity gate)
    → { hz, clarity, rms, peak } @ ~45 Hz
    → PitchTracker (median → hysteresis → EMA → hold → lock)
    → tuner-store snapshot { frame, level, clip }
    → note-display / readouts / meter / string-pads via useSyncExternalStore
    → on frame.justLocked: page appends log entry, marks course done
```

## Error handling

- `NotAllowedError` → "Microphone access was blocked. Allow it in your
  browser's site settings, then try again." with a Try again button.
- `NotFoundError` → "No microphone found. Connect one and try again."
- `NotReadableError` → "Another app is using the microphone. Close it and
  try again."
- Worklet load failure → silent fallback to AnalyserNode; log a `console.warn`.
- No Web Audio (`AudioContext` missing) → error state with copy explaining the
  browser is unsupported.
- Tab hidden for > 60 s while listening → stop the mic (battery, privacy) and
  show the idle state.

## Accessibility

- All controls are real `<button>`/`<select>` elements with labels; keyboard:
  `Space` start/stop, `↑/↓` A4 ±1, `←/→` manual string, `Esc` closes settings.
- Note glyph region is `aria-live="polite"` and announces "E2, in tune" style
  text (visually hidden) at most once per note change.
- Colour is never the only signal: pill text, arrows, and pad text carry state.
- `prefers-reduced-motion` disables the pulse, strobe motion, and needle easing.

## i18n

New keys under `dashboard.pages.tuner`: instruments (7) and tuning names
(14), verdict pill labels, readout guidance lines, status box copy, settings
labels and option names, reference-tone card, session card, tips, keyboard
hints, error messages. Existing keys that survive: `title`, `subtitle`,
`status.*`, `micAccessDenied`, `micAccessHelp`, `micError`, `tryAgain`,
`settings.reference`, `settings.sensitivity*`. Remove keys for deleted
components (`guide.*`, `signal.*`, `chromaticHint`, `openStrings`).

## Testing

`lib/tuner/__tests__/` under vitest (node):

- `pitch-engine.test.ts` — synthetic G3 (196 Hz with harmonics), E1 (41.2 Hz
  with strong 2nd/3rd harmonics), E6 (1318.5 Hz), silence, white noise → each
  within ±0.5 Hz or `null`; harmonic-heavy E1 must not report E2.
- `pitch-tracker.test.ts` — hysteresis (2 stray frames do not switch note, 3
  do), hold (returns held frame within `holdMs`, null after), lock after
  450 ms inside the window, `justLocked` fires once per note episode, manual
  `targetMidi` pins the note and yields cents beyond ±50.
- `instruments.test.ts` — every tuning's course names parse to MIDI; nearest
  course and octave-course target selection; ±75 cent cap.
- `note-math.test.ts` — solfège names, accidentals, transposition display.
- `worklet-sync.test.ts` — the `mpm` body in `pitch-engine.ts` equals the
  copy in `public/audio-worklets/pitch-detector-processor.js`.
- `prefs.test.ts` — invalid stored JSON falls back to defaults.

Manual QA checklist (documented in the plan): guitar low E and high E, bass
E1, tres octave course, transposition with a B♭ instrument, device switch,
permission denied, light/dark, mobile width, reduced motion.

## Out of scope

- Persisting the session log to Supabase.
- Piano-specific mode, MIDI input, polyphonic tuning.
- iOS app tuner.
- Interval Trainer / Chord Finder / Scale Explorer tools from the mockup.
