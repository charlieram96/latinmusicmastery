-- ============================================
-- 042_backing_gain_and_exercise_anchor
--
-- 1) Backing tracks get an authored LEVEL. Until now the studio mixer was a
--    deliberate binary audition mute ("not a mixer") and students heard one
--    shared gain driven only by headphones-vs-speaker-safe. The admin now
--    authors the balance between instruments and it ships to students.
--
--    Attenuate only (0..1): 1 is the file's own level and nothing can be
--    boosted into clipping. DEFAULT 1 leaves every existing track sounding
--    exactly as it does today.
--
--    Note this is separate from the studio's audition on/off, which stays
--    ephemeral. Effective gain is `enabled ? level : 0` -- muting a track to
--    listen past it must not destroy the level you authored.
--
-- 2) EXERCISE items get their own metronome anchor. 041 gave one to every
--    scored SECTION, but an exercise is not a section: it reaches the sync
--    panel with no sectionId, so it had nowhere to store one.
--
--    Same two-value rule as 041:
--      metronome_anchor_seconds is AUTHORITATIVE AT READ TIME -- it is what plays.
--      metronome_anchor_qn      is AUTHORITATIVE AT REBASE TIME -- what the admin
--                               meant, so republishing a re-dragged sync moves
--                               the anchor with the music.
--    No CHECK on sign: a negative anchor is legal and a rebase can legitimately
--    extrapolate the reference beat to before t=0.
-- ============================================

ALTER TABLE class_item_backing_tracks
  ADD COLUMN IF NOT EXISTS gain DOUBLE PRECISION NOT NULL DEFAULT 1;

ALTER TABLE class_item_backing_tracks
  DROP CONSTRAINT IF EXISTS backing_track_placement_valid;
ALTER TABLE class_item_backing_tracks
  ADD CONSTRAINT backing_track_placement_valid CHECK (
    timeline_start_seconds >= 0
    AND trim_in_seconds >= 0
    AND (trim_out_seconds IS NULL OR trim_out_seconds > trim_in_seconds)
    AND (source_duration_seconds IS NULL OR source_duration_seconds > 0)
    AND gain >= 0 AND gain <= 1
  );

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS metronome_anchor_seconds     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS metronome_anchor_qn          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS metronome_anchor_time_map_id UUID
    REFERENCES score_time_maps(id) ON DELETE SET NULL;

-- Seed each synced exercise from its play-along map's first waypoint, the same
-- way 041 seeded sections. Guarded on IS NULL so it is safe to re-run.
UPDATE class_items ci
   SET metronome_anchor_seconds     = w.video_time_seconds,
       metronome_anchor_qn          = w.musical_position_qn,
       metronome_anchor_time_map_id = ci.exercise_time_map_id
  FROM score_time_waypoints w
 WHERE ci.exercise_time_map_id IS NOT NULL
   AND ci.metronome_anchor_seconds IS NULL
   AND w.time_map_id = ci.exercise_time_map_id
   AND w.musical_position_qn = (
     SELECT MIN(w2.musical_position_qn)
       FROM score_time_waypoints w2
      WHERE w2.time_map_id = ci.exercise_time_map_id
   );

-- No RLS change: 029's policies are FOR ALL / FOR SELECT and column-agnostic.
