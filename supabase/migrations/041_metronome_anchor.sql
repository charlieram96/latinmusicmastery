-- ============================================
-- 041_metronome_anchor
--
-- A per-section phase reference for the student click track: ONE video second
-- known to land on a beat. Combined with the section score's initialTempo it
-- defines an infinite beat grid, so the click can be locked to the recording
-- instead of to whenever the student happened to press play.
--
-- The anchor marks ANY beat, not necessarily a downbeat -- it carries no bar
-- information, which is why the click is deliberately UNIFORM (no accent).
--
-- Two values, one meaning:
--   metronome_anchor_seconds is AUTHORITATIVE AT READ TIME. It is what plays.
--   metronome_anchor_qn      is AUTHORITATIVE AT REBASE TIME. It is what the
--                            admin MEANT, so republishing a re-dragged sync
--                            moves the anchor with the music instead of
--                            leaving it behind.
--
-- Same idea as 040's position_qn, with one difference: publishTimeMap DELETES
-- the superseded map, so there is no old map left to compare against at read
-- time. The rebase therefore happens on WRITE, inside the publish.
--
-- No CHECK on sign: a negative anchor is legal. The grid extends infinitely in
-- both directions and a rebase can legitimately extrapolate the reference beat
-- to before t=0. A CHECK here could fail a publish.
-- ============================================

ALTER TABLE class_item_score_sections
  ADD COLUMN IF NOT EXISTS metronome_anchor_seconds     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS metronome_anchor_qn          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS metronome_anchor_time_map_id UUID
    REFERENCES score_time_maps(id) ON DELETE SET NULL;

-- Seed every already-synced section from its first waypoint -- exactly the
-- value the studio inspector has been displaying as "Anchor at Xs". Nothing
-- changes visibly for an admin, and every published lesson gets a working click
-- immediately. Guarded on IS NULL so it is safe to re-run.
UPDATE class_item_score_sections s
   SET metronome_anchor_seconds     = w.video_time_seconds,
       metronome_anchor_qn          = w.musical_position_qn,
       metronome_anchor_time_map_id = s.active_time_map_id
  FROM score_time_waypoints w
 WHERE s.active_time_map_id IS NOT NULL
   AND s.metronome_anchor_seconds IS NULL
   AND w.time_map_id = s.active_time_map_id
   AND w.musical_position_qn = (
     SELECT MIN(w2.musical_position_qn)
       FROM score_time_waypoints w2
      WHERE w2.time_map_id = s.active_time_map_id
   );

-- No new index: idx_sections_class_item (class_item_id, section_index) already
-- covers the only read path.
-- No RLS change: 028's policies are FOR ALL / FOR SELECT and column-agnostic.
