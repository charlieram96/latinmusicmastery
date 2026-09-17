# PlaySense Studio cutover playbook

How to migrate every legacy `soundslice_embed_url` over to a PlaySense Studio score
and decommission the iframe path. Roughly one slice at a time; a course
with 20 lessons takes a few hours of focused work.

## Before you start

- Confirm `feat/compas` is merged (or running on a deploy you can hit).
- Sign in as an admin.
- Open the audit dashboard: **`/admin/playsense-studio/audit`**. It lists every
  `class_items` row that still has a non-null `soundslice_embed_url`,
  grouped by course, with a deep link straight into each course's editor.
- Open the analytics summary on the same page. The "Legacy iframe shows
  · last 24h" tile is the regression detector — once cutover is done it
  should sit at zero.

## Per-item recipe

For each remaining item:

1. **Get the source out of Soundslice.**
   - Soundslice → open the slice → **Notation → Export → MusicXML**.
   - If MusicXML export isn't available (older slices, Pro-only features),
     export to MIDI instead. As a last resort, take a high-resolution PDF
     screenshot — you'll re-author from it in the PlaySense Studio editor.

2. **Open PlaySense Studio** for the class item.
   - In `/admin/courses/[id]`, open the class item editor and click
     **"Open PlaySense Studio"** in the "PlaySense Studio Score" section
     (this opens `/admin/playsense-studio/[classItemId]`).
   - If no score is attached yet, the Studio shows the setup screen: drop the
     `.musicxml` / `.mxl` / `.mid` file, or **"Create a blank score"** if you'll
     author from a screenshot. Score building and syncing both happen here.

3. **Polish the score** in the Studio's "Build score" section.
   - Compare the imported notation to the Soundslice original.
   - MIDI imports tend to need fixes: wrong octaves on octave-transposing
     instruments, dropped articulations, drum tracks that landed on a
     standard staff.
   - Use the Staff or Piano-roll tabs for visual edits, the List tab for
     surgical work. Changes autosave (every 5s, or Cmd/Ctrl+S).

4. **Sync notation to video** in the same Studio (the waveform editor on top).
   - Seed the markers with **Tempo grid** (set BPM + start offset) for
     steady-tempo studio tracks, or **Tap along** (play + spacebar on each
     downbeat) for live/rubato recordings.
   - Then fine-tune visually: drag the numbered measure markers onto the audio
     downbeats on the waveform, expand a measure to nudge individual beats, and
     "Loop measure" to check alignment by ear. Hit **Publish sync** when it lines
     up. Editing the score afterward keeps your dragged markers (they reconcile
     to the new measure structure).
   - When the teacher plays one note a hair early or late, click that note on
     the staff to fine-tune just that note: drag its handle on the waveform, or
     use the inspector's Timing row (±5 ms, Shift ±20, keys `[` / `]`, "Snap
     to playhead", "Reset"). Nudges live in the sync, not the score, and ride
     along when you drag measures.

5. **Smoke-test as a student.** Open the lesson page in another tab,
   confirm video plays, cursor tracks, click-to-seek lands sensibly, A/B
   loop drag works.

6. **Drop the legacy URL.** In the class item editor, expand the "Legacy
   Soundslice URL" disclosure and clear the field. Save. The audit page
   will reflect this on next refresh.

7. **Re-check the audit page.** The remaining count drops by one. Move on.

## When the audit page reaches zero

1. Watch the "Legacy iframe shows · last 24h" tile for a week. It must
   stay at zero — non-zero means a stray `soundslice_embed_url` is still
   in the DB or a class item has a PlaySense Studio score but no media URL so the
   priority cascade falls back to the iframe. Investigate via SQL.

2. Once analytics shows zero for 7 consecutive days, **apply migration
   `016_compas_legacy_check.sql`**. This adds a `CHECK (soundslice_embed_url
   IS NULL)` on `class_items` and `lessons` so future inserts/updates can't
   reintroduce a Soundslice URL. The `NOT VALID` clause means existing
   rows aren't re-validated; only new writes are blocked.

3. Optional cleanup, scheduled one release later:
   - Drop the column entirely: `ALTER TABLE class_items DROP COLUMN
     soundslice_embed_url;`
   - Same on `lessons` and `course_modules_legacy`.
   - Strip the legacy iframe branch from `class-item-renderer.tsx`.
   - Drop the `PLAYSENSE_STUDIO_ENABLED` env var lookup.

## Rollback

If the PlaySense Studio player misbehaves in production after cutover, set
`PLAYSENSE_STUDIO_ENABLED=false` in the deployment env. Lessons fall back to the
legacy iframe path automatically — no DB changes needed. Set it back to
unset (or `true`) once the issue is fixed.

## Analytics events

Logged into the `playsense_studio_events` table with `event_type` values:

| event_type | When |
|---|---|
| `playsense_studio_player_loaded` | First mount of the player on a lesson |
| `playsense_studio_play` | Each transition from paused → playing |
| `playsense_studio_seek_via_notation` | Click on the staff seeks the video |
| `playsense_studio_clip_saved` | User saves a named A/B clip |
| `playsense_studio_legacy_iframe_shown` | Soundslice iframe rendered (cutover regression) |

The audit page surfaces the last-24h count of the legacy event; for deeper
queries, hit `playsense_studio_events` directly via SQL.
