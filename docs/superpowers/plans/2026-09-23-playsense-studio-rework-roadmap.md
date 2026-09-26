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

**Done 2026-09-23.** Shared builder (notation/build-measure.ts), accidental engine, spans, key signatures, clefs, voice 2 (display only). The continuous single-SVG Studio strip moved to Plan 3 (the strip is rebuilt there); until then strip spans draw within a measure.

- `lib/playsense-studio/notation/build-measure.ts`: one-measure VexFlow builder, ported from the prototype's `buildMeasure`, using the P1 accessors.
- A spans pass: ties, slurs and hairpins, split across systems.
- Accidental engine: key signature plus accidentals remembered within the bar, and courtesy accidentals.
- The student `staff-renderer.tsx` and the export switch to the builder.
- Tests: a builder snapshot of the reference-image excerpt and the accidental rules.

## Plan 3 — Studio shell and measure editing (spec §6)

**3a done 2026-09-24** (shell, strip selection, beat counts, measure bar, repeat/gap/Bar menus, tempo-mark confirmation, section drag, event ids, continuous staff). 3b — measure zoom and note editing — follows.

### Plan 3b — done 2026-09-25

- the measure zoom (the animation, slivers, beat bands, fill meter) (done)
- the floating note toolbar and the More ▾ tabs (done)
- the full keyboard map (done)
- V1/V2 editing (done)
- drag to change pitch, moved from the strip into the zoom (done)
- pencil click-to-add (done)
- span editing (slur, cresc/dim), with span mirroring across repeat passes via `passEventId` (done)
- tuplet group editing consistency (done)
- beam grouping for additive meters (done)
- the legacy triplet `[8,16,16,8]` grouping (done)
- the footer hint wording `⏎ edit notes` (done)
- a slur or hairpin whose far end is outside the continuous staff's drawn window isn't drawn; draw it open at the window edge (done)
- debounce the continuous staff's redraw during zoom (done in the Plan 3a final fix)

**Follow-ups from 3b:**
- the pencil and ghost ignore the dimmed voice
- picking a different tuplet ratio on a tuplet group merges instead of switching (as in v6)
- dead CSS in the old insert toolbar block of app/globals.css
- the zoom's staves redraw on timing changes

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

### Plan 6 — done 2026-09-25

Branch feat/studio-rework-p6; plan `2026-09-25-studio-rework-p6-drafts-publish-history.md`. Before this plan, sync timing autosave published live on every drag. Now nothing in the Studio reaches students except Publish and the immediate actions (trim, media, backing tracks, sections, Replace score, song visibility). Migration 043 must be applied before this ships: until then the admin Studio cannot load drafts.

Settled while building:
- The student section reader stays draft-free. The admin page uses `getStudioScoreSectionsForClassItem`.
- A null draft anchor means "keep live", so publish never clears a click anchor. The published history row records what actually went live, re-read after publishTimeMap rebases or seeds the anchor.
- Publish and discard (and restore) run in the owner's save queue. A generation counter drops saves overtaken by an adopt, and SyncPanel's own debounces drain through a pre-flush before any flush.

**Follow-ups from 6:**
- One draft row per owner, so two admins editing the same part are last-write-wins.
- Undoing back to the live content still counts as unpublished. A no-diff publish still records a history row.
- `getStudioDrafts` reads owners one at a time. Section loading now costs 1–2 extra queries per section on the admin page.
- The legacy `classItem` branch of `publishTimeMap` still doesn't delete superseded maps.
- SyncPanel's unmount flush doesn't check `placeArmed`.
- The publish popover has no Escape or focus handling, and History shows no per-row busy spinner.
- The local section cache is patched before the unmount save's outcome is known.

## Plan 4 — Watch timing and Flex (spec §7)

- Onset detection in the peaks worker, with `hits` cached in the peaks JSON.
- Chip snapping, Auto-place bars, bar flags.
- Flex: `params.flex` on the time map, the warp-aware waveform, flex markers, Quantize, and "flex this note".
- Student player: rate-driven video through flex segments with a rate trim instead of seeks.
- **Gated on the P1 spike result.** If the spike fails, audio-only flex plus visual note placement.

### Plan 4b — done 2026-09-26 (Flex Time)

Plan `2026-09-26-studio-rework-p4b-flex.md`. The flex-spike gate was treated as passed on the user's instruction ("assume it works now"). **Record the spike results when the user runs `/flex-spike`.**

What shipped:
- **The flex map.** `params.flex = {src, dst, anchor}[]` is a monotonic warp between media time (the video file) and timeline time (bars and notes). It is identity outside its points and when empty, so unflexed lessons are unchanged.
- **Students.** The cursor, seeks, loops and click follow the flexed timeline. The video rate is set per segment with `preservesPitch`, multiplied by the student's own speed.
- **The Studio.** The admin works in timeline time, with conversions at the clock, seeks and trim. The waveform draws through the warp, and hits are converted for snapping, flags and Auto-place.
- **Flex tools.** A Flex toggle (a chip, and F when the zoom is closed); hit grips; points with anchors, dragged with note snapping and a `±ms · %` label; blue/orange stretch tints. Quantize (strength, preview, Apply, Reset flex) is in the measure bar, and "Flex the recording onto this note" in the Timing tab.

Settled while building:
- **No drift trim.** The notation is derived from the video's own media time, so it can't drift.
- **The rate driver** is disabled when there's no flex. On handoff it restores the user's speed and the element's own pitch setting.
- **Flex points** lie inside the section span.
- **The label %** is the playback speed of the segment to the left.
- **Identity edges.** Every edit normalizes the flex so the map is identity outside its outermost points. This is guarded by a 500-sequence property test.
- **Moving all the bars clears the flex.** Section drag, Auto-place and placement clear it, with a notice, and Auto-place's undo restores it.

**Follow-ups from 4b:**
- Backing-lane clips (media) and the playhead (timeline) differ slightly inside a flexed region.
- The per-hook pitch snapshot doesn't track an element swap while flexed.
- A flexed section drag draws against the still-flexed waveform until it's released.
- One click may land slightly off at a flex boundary (the 120 ms look-ahead).
- Browser and ear checks are pending, including the flex-spike device results.

### Plan 4a — done 2026-09-26 (hits, snapping, Auto-place, flags)

Plan `2026-09-25-studio-rework-p4a-hits-and-auto-place.md`. Plan 4 was split: **4b (Flex) still waits for the flex-spike device results.**

What shipped:
- **Hit detection.** An offline detector (log-energy flux, an adaptive block-median threshold, and a 30%-of-peak refinement) runs on the 8 kHz mixdown. Hits are cached as an optional `hits` field in the `-hires-v2` peaks JSON. Older caches have no hits, and the admin presses Re-analyze once.
- **Snapping.** Bar chips and section drags snap to hits within 8 px. ⌘ skips the snap and ⌥ swaps ripple/single.
- **Flags.** Bars get a chip dot, the measure bar shows the reason, and Sync status shows the count.
- **Auto-place bars.** It glides the bars into place with a one-step "Undo auto-place".

Settled while building:
- **Auto-place is a local refinement.** The markers decide which beat is which, and Auto-place fixes the fine offset and tempo only. The candidate radius is min(0.5 beat, 0.45 × the smallest opening note spacing). A whole-beat jump from a count-in, from playing that continues past the section, or from noise is impossible by construction. The cost: the first bar must be placed near its note first, and the chip's title says so.
- **A chance-aware gate.** It needs ≥ 12 tight matches, ≥ 70% of onsets, z ≥ 5 against the hit density, and RMS ≤ 40 ms. Sections with under 12 onsets always refuse.
- **The tween** is a `useMarkerTween` hook with pure writes. A foreign marker write cancels it, and it is safe under StrictMode and during playback.

**Follow-ups from 4a:**
- A strong onset 0–150 ms after a dense loud passage can be missed (a detector property). It degrades to a "No hit near the first note" flag. Check this on real recordings.
- Straight eighths with the first bar placed 0.3+ beat off land a whole eighth off, silently. The markers decide, as ruled.
- A missed first note plus markers at the edge of the contract refuses (a safe null).
- Very steady rubato-free playing is assumed. ±2% rubato and triplet swing refuse.
- A same-batch foreign write during the 300 ms tween can be lost (a rare race).

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
- Honour Measure.tempoChange only when score.tempoMarksConfirmed is true (P3a added the flag and the keep/clear prompt).


### Plan 5 — done 2026-09-26

Plan `2026-09-26-studio-rework-p5-graded.md`. Migration 044 (`play_bar1_seconds`, `play_count_in_bars`, `play_preroll`) was APPLIED. The 3 live exercises that had maps got bar 1 backfilled from each map's qn 0.

What shipped:
- **The grid.** It honours confirmed tempo marks. The metronome, count-in (1–2 bars, counting down) and highway beat lines follow it.
- **The student play-along.** It follows the clock from bar 1 with a ±3% rate trim, pre-roll or wait, and holds the last frame at the end of the file.
- **Graded owners (EXERCISE and JAM).** They draft and publish only the play settings, never a time map.
- **The graded Studio.** Locked tempo bar lines; drag the Exercise block or waveform to move bar 1 (snapped); Auto-align; Count-in and Pre-roll controls; a k/n on-hit readout.
- **Studio tools.** The Student preview (the real game in a dialog), and Copy notes from a Watch section (undoable).
- **Jam sessions.** A Studio route, a course-editor link, and a graded student view with the jam track audible.

Settled while building:
- **Live backing tracks carry stale `position_qn`.** Students place backing tracks with a video at `timeline_start − bar1`, and never read `position_qn`.
- **A missing draft play means "keep live".** For graded owners, diffs are normalized so legacy waypoints and anchors never show as changes.
- **Behaviour changes.** The live maps had squeezed their final bar, so linear placement now reaches the end of the file up to about 1.7 s later there. Unmapped multi-loop videos fold back to bar 1 on each pass.

**Follow-ups from 5:**
- Auto-align could re-centre on the mean residual (it's biased by up to 30 ms with jittery hits).
- Place at playhead sets bar 1 unsnapped.
- QUIZ items also show the Studio link (pre-existing).
- Browser and ear checks.

## Plan 7 — Listen, loop, MIDI (spec §10)

- Hear Recording / Score / Both: a score synth through the same timeline map.
- Loop the selection at 100%, 75% or 50% with `preservesPitch`.
- Web MIDI entry with on-screen keys in the measure zoom; chords from notes within 45 ms.
- the one-row transport: still two rows (TransportBar is shared with the student player, so it's redone with Plan 7's Hear/Loop controls)
- MIDI-recorded notes get event ids only on the next open; assign them when recorded

## Carried forward from Plan 1 reviews

- **P2:**
  - Renderers must draw dots from `eventDots` (double dots are invisible today). (done in P2)
  - Guard slur spans where `from === to`. (done in P2)
- **P3:**
  - Beam grouping for additive meters such as 7/8 (today 2+2+2+1).
  - A slur's open start at a line break has no draw-level smoke test (data-level covered).
  - Event-id integrity: `ensureEventIds` replaces duplicate ids; paste, repeat and append give copied events new ids; spans are merged or remapped. (done in P3a)
  - Rename one of `MeasureClip.spans` (video-time) / `ScoreDocument.spans` (notation) before they meet in the clipboard. (done in P3a)
  - Tuplet group editing: toggling one member of an n:m group must keep the whole group consistent (today one id can end up with mixed ratios).
  - Tuplet group ids should carry the per-import token too (done in P3a).
- **P3 / P5:**
  - Add a larger real-world MusicXML fixture that runs through `parseScoreDocument`.
  - Assert that `measure.number` equals its index + 1 wherever the grid is built.
- **Before P4 ships:**
  - Record the Flex spike device results in spec §7.
  - Delete `app/(dev)/flex-spike`.
- **Sheet-music export branch (before it merges):**
  - engrave.ts must add the key signature at row starts and on keyChanged, and draw the tuplets `formatMeasureVoice` now returns; descriptors drop in-key accidentals.
- **Test hygiene:** rename the backing-track-timing test "with a tempo change". Its grid varies `secPerQN`, which `buildExerciseGrid` never produces while tempo changes are ignored.
