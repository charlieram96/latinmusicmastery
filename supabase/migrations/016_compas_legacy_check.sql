-- POST-CUTOVER ONLY. Do not apply this migration until M9 cutover is
-- complete (every legacy soundslice_embed_url has been replaced with a
-- Compás score and its row's value set to NULL).
--
-- Adds a CHECK that prevents new non-null inserts/updates of
-- soundslice_embed_url. NOT VALID skips re-validating existing rows so
-- this is safe to apply mid-flight, but for cleanliness we recommend
-- waiting until the audit page reports zero remaining. The column is
-- kept for one release cycle in case rollback is needed; drop it after
-- analytics confirms zero `compas_legacy_iframe_shown` events for a
-- week.

ALTER TABLE class_items
  ADD CONSTRAINT class_items_no_new_soundslice
  CHECK (soundslice_embed_url IS NULL) NOT VALID;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_no_new_soundslice
  CHECK (soundslice_embed_url IS NULL) NOT VALID;
