# PlaySense Studio rework — roadmap

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md`
**Prototype of record:** https://claude.ai/artifact/Nr2Mc37Kv1oMYxxUZvYd11 (v6)

The spec covers seven subsystems, so it ships as seven plans. Each plan leaves the app working and releasable on its own.

- **Plan 1** is written in full: `2026-09-23-studio-rework-p1-foundation.md`.
- **Plans 2–7** are outlined below. Each gets its own detailed plan (writing-plans) just before it starts, written against the code as it stands after the plans before it.

## Order and dependencies

```
P1 Foundation ─► P2 Notation rendering ─► P3 Studio shell & editing ─► P6 Drafts & history
                                                   │                        │
                                                   ├──────────► P4 Watch timing & Flex
                                                   └──────────► P5 Exercise & Jam (graded)
                                                                            └► P7 Listen, loop, MIDI
```

P6 comes before P4 and P5 because it changes every save path. Doing it once, before the timing features add more save paths, avoids redoing them.

## Plan 1 — Foundation (detailed plan exists)

**Done 2026-09-23** on feat/studio-rework-p1. Full suite: 967 passing (101 files); tsc clean. Pending, needs a human: Flex spike device results (Task 1, Step 3), and the two browser checks from Task 8 Step 2 (a live exercise plays unchanged with an audible count-in; a MusicXML import with triplets and a second voice draws correctly). Follow-ups recorded: renderers draw dots from legacy `dotted` only (double dots invisible until Plan 2); voice 2 ignored downstream until Plans 2–3; tempo marks honoured only after Plan 3 cleans stale values; metronome from the grid in Plan 5.

1. Flex-video spike on Safari macOS, iOS and Chrome (go/no-go for spec §7).
2. Additive score-model fields plus accessors (spec §4.1–4.3).
3. Triplet and tuplet duration code in the renderer (spec §4.4).
4. PDF import stores real dotted and triplet lengths (spec §4.4).
5. MusicXML: tuplets, ties, two voices, staff 1, spelling (spec §4.4).
6. MusicXML: grace notes, articulations, ornaments, dynamics, words, wedges, slurs (spec §4.4).
7. Engine honours tempo and meter changes (spec §8, "Engine tempo and meter changes").

## Plan 2 — Notation rendering (spec §5, §11)

- `lib/playsense-studio/notation/build-measure.ts`: one-measure VexFlow builder, ported from the prototype's `buildMeasure`, using the P1 accessors.
- A spans pass: ties, slurs and hairpins, split across systems.
- Accidental engine: key signature plus accidentals remembered within the bar, and courtesy accidentals.
- The student `staff-renderer.tsx` and the export switch to the builder.
- Studio strip: one continuous SVG over the visible range, with the 46 px placeholder kept.
- Tests: a builder snapshot of the reference-image excerpt and the accidental rules.

## Plan 3 — Studio shell and measure editing (spec §6)

**Shell:**
- hover rail (52→340 px overlay, 120 ms)
- floating PiP video
- resizable splitter
- one-row transport
- wheel: vertical zooms, horizontal pans

**Measure strip:**
- selection model: click, drag or ⇧-click selects; never mutates notes
- floating measure bar
- beat counts with the short/over states and the footer issue chip
- repeat lane
- the **+** between bars
- section-block drag

**Measure zoom:**
- zoom animation, slivers, beat bands, fill meter
- floating note toolbar and More ▾ tabs
- the full keyboard map
- V1/V2, drag to change pitch, pencil click-to-add

**Wiring:**
- `ensureEventIds` runs when a score opens
- Event-id integrity: `ensureEventIds` must also replace duplicate ids; paste, repeat and append give copied events new ids; append merges or remaps `spans`; deleting events removes spans that reference them.
- span editing
- repeat propagation

**Split:** `integrated-editor.tsx` (1286 lines) and `sync-panel.tsx` (1809 lines) are broken into focused components as they're rebuilt.

**Tempo marks:** an editable tempo mark per measure; must clean or confirm existing per-measure `tempoChange` values (stale MusicXML-import leftovers that disagree with the admin-set tempo) before the engine can honour them (see spec §8).

## Plan 6 — Drafts, publish, history (spec §9)

- **Migration:** the `studio_versions` table with RLS.
- **Hook:** `useStudioDraft(owner)` handles autosave to a draft, marking dirty and publishing.
- **Publish** writes through the existing actions.
- **UI:**
  - Publish button with the count, and the pulsing state
  - unpublished dots on the Watch/Exercise switch and section rows
  - `beforeunload` warning
  - discard draft
  - History panel with restore
- **Deprecation:** `draft_time_map_id` is marked deprecated.

## Plan 4 — Watch timing and Flex (spec §7)

- Onset detection in the peaks worker, with `hits` cached in the peaks JSON.
- Chip snapping, Auto-place bars, bar flags.
- Flex: `params.flex` on the time map, the warp-aware waveform, flex markers, Quantize, and "flex this note".
- Student player: rate-driven video through flex segments with a rate trim instead of seeks.
- **Gated on the P1 spike result.** If the spike fails, audio-only flex plus visual note placement.

## Plan 5 — Exercise and Jam, graded (spec §8)

- **Migration:** `play_bar1_seconds`, `play_count_in_bars`, `play_preroll`, with the backfill from `exercise_time_map_id`.
- **Graded workspace:**
  - tempo-clock bar lines
  - drag or Auto-align of the media
  - count-in and pre-roll controls
  - Student preview
  - Copy notes from a Watch section
- **Jam sessions** get a Studio entry.
- **Student game:**
  - count-in from the setting
  - video pre-roll or wait
  - video follows the clock through a rate trim (no 0.35 s re-seeks)
- **Highway beat lines** use the P1 grid.
- **Metronome** is scheduled from the P1 grid (per-measure tempo/meter), not the uniform `bpm`/`timeSignature` alone.

## Plan 7 — Listen, loop, MIDI (spec §10)

- Hear Recording / Score / Both: a score synth through the same timeline map.
- Loop the selection at 100%, 75% or 50% with `preservesPitch`.
- Web MIDI entry with on-screen keys in the measure zoom; chords from notes within 45 ms.
