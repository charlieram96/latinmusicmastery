-- 026_quiz_questions.sql
-- A quiz (or exercise) class_item is a CONTAINER for a series of questions.
-- Previously each class_item held a single inline question (question/options/
-- correct_answer columns), which (a) capped quizzes at one question and
-- (b) silently failed to render because the student renderer required a flat
-- `correct_answer` that the richer question types never populate.
--
-- This migration introduces a child table so a quiz can hold an ordered series
-- of questions, and backfills the existing inline questions into it. The inline
-- columns on class_items are intentionally LEFT IN PLACE (legacy EXERCISE path
-- still reads them) but quizzes now read from quiz_questions.

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_item_id uuid NOT NULL REFERENCES public.class_items(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  question text NOT NULL,
  question_type text NOT NULL,          -- one of QuestionType (multiple_choice, true_false, ...)
  options jsonb,                         -- per-type structure: choices / pairs / blanks / items
  correct_answer text,                   -- choice id | 'true'|'false' | text answer (null for option-embedded types)
  explanation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_questions_class_item_order_idx
  ON public.quiz_questions (class_item_id, order_index);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Students may read a question iff they may read its parent class_item
-- (mirrors the class_items SELECT policy via the same has_course_access oracle).
DROP POLICY IF EXISTS "Users see quiz questions they may access" ON public.quiz_questions;
CREATE POLICY "Users see quiz questions they may access"
  ON public.quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_items ci
      JOIN public.classes cl ON cl.id = ci.class_id
      JOIN public.course_sections sec ON sec.id = cl.section_id
      WHERE ci.id = quiz_questions.class_item_id
        AND (cl.is_free = true OR public.has_course_access(sec.course_id))
    )
  );

-- Admins manage everything (mirrors "Admins can manage class items").
DROP POLICY IF EXISTS "Admins can manage quiz questions" ON public.quiz_questions;
CREATE POLICY "Admins can manage quiz questions"
  ON public.quiz_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── Backfill: lift each existing inline question into a quiz_questions row ──
-- Only for QUIZ/EXERCISE items that actually have a question and no questions yet.
INSERT INTO public.quiz_questions (class_item_id, order_index, question, question_type, options, correct_answer, explanation)
SELECT
  ci.id,
  0,
  ci.question,
  COALESCE(ci.question_type, 'multiple_choice'),
  ci.options,
  ci.correct_answer,
  ci.explanation
FROM public.class_items ci
WHERE ci.item_type IN ('QUIZ', 'EXERCISE')
  AND ci.question IS NOT NULL
  AND length(btrim(ci.question)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.quiz_questions q WHERE q.class_item_id = ci.id
  );
