-- 037_class_item_subtitles_jsonb.sql
-- Up to 9 subtitle tracks per lesson video, stored as a jsonb array of
-- {"lang": "<lowercase bcp47 code>", "src": "<public vtt url>"}. Replaces the
-- two fixed columns from 035. Still deliberately NOT a base/_es localize pair:
-- the player needs every track simultaneously so the student can switch
-- caption language independently of the UI locale.

ALTER TABLE public.class_items
  ADD COLUMN IF NOT EXISTS subtitles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill (en first, then es — the old picker order). `||` concatenates jsonb
-- arrays, so an absent track contributes an empty array.
UPDATE public.class_items
SET subtitles =
  CASE WHEN subtitles_en_url IS NOT NULL AND btrim(subtitles_en_url) <> ''
       THEN jsonb_build_array(jsonb_build_object('lang', 'en', 'src', subtitles_en_url))
       ELSE '[]'::jsonb END
  ||
  CASE WHEN subtitles_es_url IS NOT NULL AND btrim(subtitles_es_url) <> ''
       THEN jsonb_build_array(jsonb_build_object('lang', 'es', 'src', subtitles_es_url))
       ELSE '[]'::jsonb END
WHERE subtitles_en_url IS NOT NULL OR subtitles_es_url IS NOT NULL;

-- Shape guard. AND/OR evaluation order is not guaranteed in Postgres, so the
-- length check sits inside CASE and jsonb_array_length never sees a non-array.
-- Per-language uniqueness needs an aggregate (not allowed in CHECK), so that
-- lives in the updateClassItem server action + the admin UI.
ALTER TABLE public.class_items
  ADD CONSTRAINT class_items_subtitles_shape CHECK (
    CASE
      WHEN jsonb_typeof(subtitles) = 'array' THEN jsonb_array_length(subtitles) <= 9
      ELSE false
    END
  );

ALTER TABLE public.class_items
  DROP COLUMN IF EXISTS subtitles_en_url,
  DROP COLUMN IF EXISTS subtitles_es_url;

NOTIFY pgrst, 'reload schema';
