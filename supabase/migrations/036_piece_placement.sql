-- The instrument_assembly question type is replaced by piece_placement:
-- students now drag pieces freely over the background image and a piece is
-- correct when its center lands inside a hidden per-piece target area.
-- The old zones/parts options shape is incompatible with the new builder, so
-- existing rows are reset to an empty config for re-authoring.
UPDATE public.quiz_questions
SET question_type = 'piece_placement',
    options = '{"pieces": []}'::jsonb,
    options_es = NULL
WHERE question_type = 'instrument_assembly';
