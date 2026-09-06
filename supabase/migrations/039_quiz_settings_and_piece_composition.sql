-- 039_quiz_settings_and_piece_composition.sql
-- 1) Per-quiz presentation settings ({"mode": "focus" | "sheet"}), read by
--    lib/quiz/quiz-settings.ts; anything else falls back to focus.
ALTER TABLE public.class_items
  ADD COLUMN IF NOT EXISTS quiz_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) piece_placement backgrounds become a composition
--    { color, aspect, layers: [{ id, imageUrl, x, y, width, height }] } inside
--    options (see lib/quiz/composition.ts). The old single image_url becomes one
--    full-bleed layer. `aspect` stays null because SQL cannot read image
--    dimensions; the student stage measures the layer at runtime and the
--    builder writes the real value on first save. image_url is cleared so the
--    composition is the single source of truth.
UPDATE public.quiz_questions
SET options = jsonb_set(
      coalesce(options, '{"pieces": []}'::jsonb),
      '{background}',
      jsonb_build_object(
        'color', '#0A0A0A',
        'aspect', null,
        'layers', CASE WHEN image_url IS NOT NULL AND btrim(image_url) <> ''
          THEN jsonb_build_array(jsonb_build_object(
                 'id', 'legacy', 'imageUrl', image_url,
                 'x', 0, 'y', 0, 'width', 100, 'height', 100))
          ELSE '[]'::jsonb END)),
    image_url = NULL,
    updated_at = now()
WHERE question_type = 'piece_placement'
  AND (options -> 'background') IS NULL;
