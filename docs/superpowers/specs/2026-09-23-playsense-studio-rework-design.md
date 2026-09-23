# PlaySense Studio rework — design

**Date:** 2026-09-23 · **Branch:** `playsense` · **Status:** approved direction, pending spec review
**Prototype of record:** https://claude.ai/artifact/Nr2Mc37Kv1oMYxxUZvYd11 (v6). v1 is a rejected direction; v2–v6 are iterations of this design.

## 1. Why

Building and timing scores in the Studio is slow and fragile:

- A click in the measure strip adds or moves notes by accident.
- The notation can't express common marks: dynamics, hairpins, slurs, tuplets other than 3, grace notes, text, naturals and endings.
- Measures shrink to placeholders when zoomed out, and repeats are hard to see.
- Too much chrome is always on screen.
- Some timing problems are real bugs:
  - The student game got 6/8 and 2/2 tempos wrong. **Fixed**, see §12.
  - Every autosave goes live to students immediately.
  - The graded video jumps whenever it drifts more than 0.35 s from the note clock.

The goal is a clean, fast Studio for all lesson types that keeps today's model and look:

- Watch sections are synced by hand.
- The Exercise is its own score.
- The waveform keeps today's look.

## 2. Decisions (settled with the user across six prototype rounds)

1. **Keep today's architecture and look.** Score-as-clock for every lesson (v1) was rejected. The waveform keeps its current drawing (600 peaks/s, 1px strokes at 55%, amber number chips, gold selection).
2. **One instrument per score.** No parts and no multi-staff.
3. **Full single-staff notation:**
   - durations down to 64ths, single and double dots
   - any tuplet n:m, grace notes (acciaccatura and appoggiatura)
   - articulations: staccato, staccatissimo, tenuto, accent, marcato and fermata
   - ornaments: trill, mordent and turn
   - dynamics from ppp to fff, plus fp and sfz
   - crescendo/diminuendo hairpins, slurs and ties
   - text such as "div." or "dolce"
   - naturals, double sharps and double flats, courtesy accidentals
   - clef, key and time changes, tempo marks, repeat barlines, 1st and 2nd endings
   - a second voice
4. **Watch and Exercise keep separate scores.**
   - Watch can have several sections, because the teacher explains, plays, then explains again.
   - The Exercise is one continuous score.
   - No migration is needed.
   - "Copy notes from a Watch section" gives a one-time head start.
5. **Watch timing stays hand-synced,** with these additions:
   - snapping bar lines to detected hits
   - Auto-place bars
   - bars that look off get a flag
   - Flex Time (§7)
6. **Exercise and Jam timing is the tempo clock.**
   - Notes sit on the tempo grid.
   - The play-along video or jam track follows the clock and never pulls the notes around.
   - Count-in of 1 or 2 bars, with optional video pre-roll during it.
7. **Grading:** voice 1 only on the highway. Everything else is shown but not graded; grace notes are never graded.
8. **Draft vs live** with a prominent Publish button and clear unpublished-change warnings.
9. **History per section/exercise:** published versions and draft autosaves, with restore.
10. **Also included:**
    - listen to the score (Recording / Score / Both)
    - loop the selection at 100%, 75% or 50% speed
    - MIDI keyboard entry
11. **Import stays as is.** The user trusts the current import. The known importer bugs are fixed as part of the notation model work (§4.4).

## 3. Non-goals

- Orchestral or multi-part scores.
- Score-as-clock for Watch.
- Redesigning the import UI.
- Changing how the Watch click anchor works for students. It was already decided that the graded run is left untouched and the Watch anchor stays per section.

## 4. Score model (additive)

Files:

- `components/playsense-studio/shared/score-model/types.ts`
- `components/playsense-studio/shared/score-model/serialization.ts` (zod)
- new `score-model/accessors.ts`

`durationQN` stays the real length, including dots and tuplet scaling.

**The change is additive, and `schemaVersion` stays 1.** The legacy fields `dotted`, `triplet`, `articulation` and `spellingHint` are read today by 11, 8, 6 and 4 files. They stay valid, and new code reads through accessors (`eventDots`, `eventTuplet`, `eventArticulations`, `eventSpelling`) that prefer the new field and fall back to the legacy one. Writers set the legacy field too whenever it can express the value (1 dot, a 3:2 tuplet), so old readers keep working until they migrate.

### 4.1 Event changes (`NoteBase`)

| Field | Type | Notes |
|---|---|---|
| `dots` | `1 \| 2` | Supersedes `dotted` (accessor: `dots ?? (dotted ? 1 : 0)`). |
| `tuplet` | `{ id: string; n: number; m: number }` | Supersedes `triplet` (accessor: `tuplet ?? (triplet ? {n:3,m:2} : null)`). |
| `articulations` | `Array<'staccato' \| 'staccatissimo' \| 'tenuto' \| 'accent' \| 'marcato' \| 'fermata'>` | Supersedes the single `articulation`. |
| `ornament` | `'trill' \| 'mordent' \| 'turn'` | |
| `dynamic` | `'ppp' \| 'pp' \| 'p' \| 'mp' \| 'mf' \| 'f' \| 'ff' \| 'fff' \| 'fp' \| 'sfz'` | |
| `text` | `string` | Shown above the staff. |
| `grace` | `Array<{ midi: number; spelling?: Spelling; slash: boolean }>` | Leads into the event; takes no time. |
| `id` | `string` | Stable event id, used by spans, flex and nudges. Assigned by `ensureEventIds` when an editor opens a score, and persisted on the next save. |

`slurToNext` is superseded by spans. Nothing sets it today, so there is nothing to convert.

### 4.2 Pitch spelling

- New type: `Spelling = { step: 'A'…'G'; alter: -2..2; showAccidental?: 'auto' | 'always' }`.
- It is optional on `Note` and on each chord note.
- `spellingHint` is kept. `eventSpelling` falls back to parsing it.
- Rendering computes accidentals itself: the key signature plus accidentals remembered within the bar, with `'always'` forcing a courtesy accidental.

### 4.3 Score and measure additions

- `ScoreDocument.spans: Array<{ id; type: 'slur' | 'cresc' | 'dim'; from: eventId; to: eventId }>`
- `Measure.clef?: 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'` (the default comes from the instrument)
- `Measure.repeatStart?`, `Measure.repeatEnd?` for notated repeat signs
- `Measure.volta?: '1.' | '2.'`
- `Measure.endBarline` gains `'double'`
- The existing `Measure.repeat` (written-out passes) is unchanged. It remains the source of the passes in the Studio's repeat lane.

### 4.4 Importer and renderer corrections

These fall out of the model work:

- **Triplets drawn as 16ths.** `vexflowDurationCode` in `lib/playsense-studio/score-to-vexflow.ts` undoes the dot but not the tuplet scaling.
- **PDF import of dotted notes and triplets.** The prompt correctly asks for the un-dotted value plus flags, but `recognized-score.ts` `convertEvent` stores that value unchanged. Fix: apply `effectiveDurationQN` there.
- **MusicXML import:**
  - Read `<time-modification>` (tuplets) and `<tie>`.
  - Read `<voice>`, keeping voice 1 and 2.
  - Read `<slur>`, `<dynamics>`, `<words>`, `<grace>`, articulations and ornaments.
  - Honour `<backup>/<forward>` so a second voice isn't appended after the first.

## 5. Rendering

- A shared builder `lib/playsense-studio/notation/build-measure.ts` produces VexFlow objects for one measure. Every notation surface uses it: the Studio strip, the measure zoom, the student score and the export.
- It handles:
  - notes, rests, dots, tuplets, grace notes
  - accidentals following the rules in §4.2
  - articulations, ornaments, dynamics (Bravura glyphs) and text
  - beams per beat, with tuplets kept whole
  - voice 2 with stems down
- **Studio strip:** one continuous SVG across the visible range. Staves are placed at their bars' time spans, so there are no barline gaps and slurs and hairpins can cross barlines. Measures narrower than 46 px render as numbered placeholders.
- **Student staff renderer** (`player/notation/renderers/staff-renderer.tsx`) switches to the shared builder, so the two can't drift.

## 6. Studio UX (all lesson types)

The layout follows prototype v6.

- **Shell:** app bar, hover rail, stage, one-row transport.
- **Hover rail:**
  - Collapsed, it is a 52 px icon strip with a status badge.
  - On hover it opens to 340 px over the stage, taking 120 ms. The stage doesn't move.
  - Sections: media or sections, placement or exercise settings, score settings, sync status, history.
- **Floating video (PiP):** draggable, and can shrink to a pill. It replaces the rail's video column.
- **Stage** (top to bottom):
  - the waveform (today's drawing)
  - a floating tools cluster
  - the sections lane (draggable blocks)
  - backing lanes
  - a resizable splitter (110–360 px; double-click resets)
  - the measure strip
- **Wheel:** vertical zooms around the pointer, horizontal or ⇧ pans.
- **Measure strip:**
  - Click selects a bar, drag across or ⇧-click selects several, double-click or ⏎ zooms in. Clicks never add or move notes.
  - Each bar shows its beat count (e.g. `3/3`): gold when short, with the missing time hatched where it's missing; red when over.
  - A footer chip jumps between problem bars.
  - A repeat lane shows each group as "Repeat ×N · k bars", later passes hatched as "pass p of N". Clicking a band opens its popover.
  - A **+** between bars adds an empty bar, a copy of the left bar, or pasted bars.
- **Floating measure bar** over the selection:
  - info: bar range, start time, tempo, flags, flex amount
  - actions: Edit, Loop, Quantize (Watch only), Repeat ▾, Duplicate, Copy, Paste, Bar ▾ (time, key, clef, tempo, barlines, endings), Clear, Delete
- **Measure zoom:**
  - The bar animates up to fill the strip, with its neighbours as dimmed slivers.
  - The waveform zooms to the bar, beats are shaded 1-2-3, and a fill meter shows how much of the bar is used.
  - ⌘←/→ moves to the next or previous bar.
  - A floating note toolbar holds durations whole to 16th, dot, rest, tie, ♭♮♯, triplet and **More ▾**.
  - More ▾ has tabs: Durations (32nd, 64th, double dot, double accidentals), Tuplets, Marks, Dynamics (with lines), Text, Timing (nudge, and flex this note).
  - Keyboard entry: A–G, ⇧ for chords, 1–7 for duration, `.`, R, T, +, S, arrow keys, ⌫.
  - Also: drag a note to change its pitch, V1/V2, click-to-add with the pencil, and MIDI or on-screen keys (§10).
- **Repeats:** passes stay written out (as today, `Measure.repeat`), so each pass syncs to the recording on its own. An edit to one pass reaches every pass (`propagate`). Students see repeat signs.
- **Existing behaviour to reuse:**
  - structural edits with timing carried along: `lib/playsense-studio/measure-edits.ts`, `components/playsense-studio/sync/structural-timing.ts`
  - measure clipboard: `measure-clipboard.ts`
  - repeats: `repeats.ts`

## 7. Watch timing (video lessons and the exercise Watch part)

The model is unchanged: the draggable waypoint time map (`score_time_maps` method `drag`) plus per-note nudges (`params.nudges`).

- **Hit detection:** a client-side onset detector (log-energy flux, adaptive threshold, refined to the first sample over 30% of the local peak) runs on the decoded audio next to the peaks. Hits are cached in the peaks JSON as `hits: number[]`.
- **Snapping:** a dragged bar chip snaps its bar line or its first attacked note onto a hit within 8 px. ⌘ skips snapping and ⌥ swaps ripple/single (as today).
- **Auto-place bars:**
  1. Fit one steady tempo to note onsets against hits, widening the window as it goes.
  2. Let each bar settle onto the hit under its first attacked note.
  3. Tween the markers into place. It can be undone.
- **Flags:** a bar is flagged when its first attacked note has no hit within 90 ms or is more than 30 ms off, or when its tempo differs from the median by more than 5%. The flag shows as a dot on the waveform chip, in the measure bar info and in Sync status.
- **Section drag:** dragging a block in the sections lane moves every bar, snapping the first note to a hit.
- **Flex Time:**
  - **Data:** `params.flex: Array<{ src: number; dst: number; anchor: boolean }>` on the same time map. `src` is seconds in the original media, `dst` is seconds on the timeline. Piecewise-linear between markers, untouched outside them.
  - **UI:**
    - A Flex toggle (F). Clicking a hit adds a marker and pins the neighbouring hits as anchors.
    - Dragging snaps to written notes and shows "±ms · %".
    - Stretched regions are tinted: blue slower, orange faster.
    - Double-click removes a marker.
    - **Quantize** (measure bar) pulls a selection's hits toward the notes with a strength slider (default 70%), with a preview count and Reset.
    - **Timing tab:** "Flex the recording onto this note".
  - **Student playback:** the video element plays at `playbackRate = segment ratio` with `preservesPitch = true`. Its rate is updated at segment boundaries from rAF, and drift beyond 60 ms is corrected with a gentle rate trim (±3%) rather than a seek. Notes and the cursor use timeline time.
  - **Admin playback:** the waveform is drawn through the warp, and audio plays the same way as the student's.
  - **Gate:** a spike on Safari macOS, iOS and Chrome must confirm smooth rate changes before this ships (task 1 of the plan).

## 8. Exercise and Jam (graded)

- **Score:** Exercise keeps `class_items.score_document_id` as its own continuous score (as today). All bars are graded, voice 1 only. **Copy notes from a Watch section** replaces the exercise notes with a copy of a chosen section's score, with ids regenerated and repeats flattened; it can be undone.
- **Clock:** bar times are `offset + qnFromStart × 60 / tempo`, honouring tempo and meter changes (see the engine note below). Bar lines can't be dragged. In the Studio, the admin lines up the media by dragging the waveform or the green Exercise block (it snaps), or with **Auto-align**, which picks the offset that puts the most graded onsets on hits. The panel shows "k/n notes on a hit".
- **New columns on `class_items`** (shared by EXERCISE and JAM_SESSION):
  - `play_bar1_seconds numeric`: where bar 1 lands in the play-along video or jam track. Replaces the exercise drag map for media placement.
  - `play_count_in_bars smallint not null default 1 check (play_count_in_bars between 1 and 2)`
  - `play_preroll boolean not null default true`
  - **Backfill:** `play_bar1_seconds` comes from the first waypoint of the current `exercise_time_map_id` (all 3 live exercises have one). `exercise_time_map_id` stays for backing-track conversion until those move to QN-only (`position_qn` is already authoritative).
- **Student game** (`score-exercise-game.tsx`, `use-exercise-session.ts`):
  - The count-in length comes from `play_count_in_bars` × the first bar's meter.
  - During the count-in the video plays from `bar1 − countIn` if pre-roll is on, and otherwise waits on bar 1.
  - After that the video follows the clock through `bar1 + engineSeconds` with a rate trim, not the current 0.35 s re-seek.
  - Trim remains a clamp.
- **Engine tempo and meter changes:** `scoreToExerciseDefinition` gains per-measure `tempoChange` and `timeSignature` support. `beatToTimestamp` uses a precomputed bar-start table instead of `(measure−1)·beatsPerMeasure`. `backing-track-timing.ts` drops its known-limitation note.
- **Student preview in the Studio:** plays the count-in click with a 3-2-1 overlay, then the graded bars, and stops at the end.
- **Jam sessions:**
  - Get a Studio entry: `app/admin/playsense-studio/[classItemId]/page.tsx` routes `JAM_SESSION` to the graded workspace, and the course editor links to it.
  - The audio is `audio_url`, and the whole score is graded.
  - Jam sessions use the same `play_*` columns as exercises.

## 9. Draft vs live and history

- **New table `studio_versions`:**

  ```sql
  create table studio_versions (
    id uuid primary key default gen_random_uuid(),
    owner_kind text not null check (owner_kind in ('section','exercise','song')),
    owner_id uuid not null,
    kind text not null check (kind in ('draft','published')),
    score jsonb not null,         -- ScoreDocument v2
    timing jsonb not null,        -- { waypoints|bar1Seconds, nudges, flex, anchor, countIn, preroll }
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id)
  );
  create index on studio_versions (owner_kind, owner_id, created_at desc);
  ```

  RLS: admin-only read and write, following the existing admin policies on `score_documents`.
- **Autosave** writes the current draft by upserting the newest `draft` row per owner. A new draft row is created at most once a minute, with a cap of 40 rows per owner; older drafts are pruned.
- **Students** keep reading the live rows exactly as today (`score_documents`, `score_time_maps`, section and class_item columns), so no student code changes for this.
- **Publish:**
  1. Writes the draft into the live rows through the existing actions: `saveScoreDocument`, `publishTimeMap`, the anchor and trim actions, plus the new `play_*` columns.
  2. Inserts a `published` version.
  3. Deletes the superseded time map, as the exercise branch already does.
  It covers one owner, or all dirty owners in the lesson with "Publish all".
- **Unpublished state:** "*n* unpublished changes" in the app bar, a pulsing Publish button with a count, a gold dot on the Watch/Exercise switch and on section rows, and a warning when leaving the page. Publish shows what changed in each part and offers "Discard this draft".
- **History panel** (per owner): published and draft rows, with the live one marked. Restore loads a version as the new draft.
- The unused `class_item_score_sections.draft_time_map_id` (migration 034) is superseded. It is left in place and marked deprecated in `types/database.ts`.

## 10. Listening, looping, MIDI

- **Hear: Recording / Score / Both.**
  - "Score" synthesises voice 1 (and voice 2 at lower level) with the Web Audio envelope from the prototype, scheduled from the playhead, tied notes merged. It follows the same timeline mapping as the note overlay (bars, nudges, flex).
  - The recording goes through a gain node set to 0 in Score mode.
- **Loop:**
  - Loop in the measure bar (L) sets `{a, b}`. Playback restarts at `bt[a]` when it passes `bt[b+1]`.
  - The loop chip sets the speed to 100%, 75% or 50% through `playbackRate`, with `preservesPitch` on the media element.
  - The waveform shows the loop bracket.
- **MIDI entry:**
  - In the measure zoom (K), request Web MIDI. Note-on enters the exact pitch, spelled by key, like typing a letter. Notes within 45 ms become a chord.
  - On-screen keys (2 octaves, octave shift) are the fallback.
  - `lib/playsense-studio/midi-recording.ts` stays for real-time recording.

## 11. Student-side notation

The shared builder (§5) draws every new mark on the student score. The highway grades voice 1 only: grace notes are skipped, chords stay as today (`chordId`), and tuplet onsets use their exact `durationQN` positions.

## 12. Fixes already made (2026-09-23, uncommitted at time of writing)

- **Tempo units.** `scoreToExerciseDefinition` now converts quarter-note BPM to the engine's denominator-beat BPM: `engineBpm = tempo / beatLengthInQN(ts)`. 6/8 had run at half speed and 2/2 at double. Tests are in `lib/play-sense/__tests__/score-to-exercise.test.ts`. No live exercise changes, since all are 4/4. The student UI now shows "192 BPM" for 6/8 at ♩=96; that label is accepted for now.
- **Audible count-in.** `useMetronome` count-in clicks are always audible, even with the running click off. Tests are in `hooks/__tests__/use-metronome.test.tsx`.
- **Checked and deliberately not changed:**
  - The exercise click anchor isn't sent to students (prior decision).
  - The legacy demo-audio fallback (no exercise uses it).

## 13. Testing

- **Unit (vitest):**
  - score model v1→v2 upgrade and zod round-trip
  - build-measure (durations, tuplets, accidental rules, beaming)
  - MusicXML and PDF conversion fixtures, including the reference-image excerpt
  - onset detector on synthetic audio (known onsets ±6 ms)
  - auto-place, snapping, flags, flex map (src↔dst inverse, monotonicity, quantize plan)
  - exercise clock (tempo and meter changes)
  - count-in and pre-roll timing
  - publish/draft actions (mocked Supabase, following the existing action tests)
  - repeat propagation
- **Component:** measure selection never mutates notes; the unpublished badge appears on edit and clears on publish.
- **Browser (Chrome MCP, dev server with the hosted dev DB):**
  - build a section from scratch with the keyboard and the palette
  - auto-place and flex a video section
  - publish and confirm the student view changes only after publishing
  - an exercise with a 2-bar count-in and pre-roll
  - a 6/8 exercise plays at the right speed
- **Spike:** flex video playback on iOS Safari (§7).

## 14. Risks

- **Flex video on iOS:** if rate changes stutter, fall back to audio-only flex plus visual note placement. That fallback is decided now, so the spike has a clear pass/fail.
- **VexFlow cost** of the continuous strip while scrolling: cache per-measure layout, re-render only visible bars, and rAF-throttle.
- **Model compatibility:** additive fields plus legacy fallbacks. Zod strips unknown keys, so old deployments would drop the new fields on save. The Studio and the student player therefore ship from the same build (they already do).
- **Draft/publish touches every save path:** the plan introduces it behind a single `useStudioDraft` hook so each workspace changes in one place.
