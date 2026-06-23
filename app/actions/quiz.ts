'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { QuizQuestion } from '@/types/modules'

// Fetch the ordered series of questions for a quiz/exercise class item.
// RLS gates read access to the parent class item's course.
export async function getQuizQuestions(
  classItemId: string
): Promise<{ data: QuizQuestion[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('class_item_id', classItemId)
    .order('order_index', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as QuizQuestion[] }
}

// ── Admin CRUD ─────────────────────────────────────────────────────────
type QuestionInput = {
  question?: string
  question_type?: string
  options?: unknown
  correct_answer?: string | null
  explanation?: string | null
  // Spanish overlays (fall back to the English columns when empty)
  question_es?: string | null
  explanation_es?: string | null
  options_es?: unknown
}

export async function createQuizQuestion(classItemId: string, input: QuestionInput) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('quiz_questions')
    .select('order_index')
    .eq('class_item_id', classItemId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      class_item_id: classItemId,
      order_index: nextOrder,
      question: input.question ?? '',
      question_type: input.question_type ?? 'multiple_choice',
      options: (input.options ?? null) as never,
      correct_answer: input.correct_answer ?? null,
      explanation: input.explanation ?? null,
      question_es: input.question_es ?? null,
      explanation_es: input.explanation_es ?? null,
      options_es: (input.options_es ?? null) as never,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  return { data: data as QuizQuestion }
}

export async function updateQuizQuestion(questionId: string, input: QuestionInput) {
  const supabase = await createClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.question !== undefined) updates.question = input.question
  if (input.question_type !== undefined) updates.question_type = input.question_type
  if (input.options !== undefined) updates.options = input.options
  if (input.correct_answer !== undefined) updates.correct_answer = input.correct_answer
  if (input.explanation !== undefined) updates.explanation = input.explanation
  if (input.question_es !== undefined) updates.question_es = input.question_es
  if (input.explanation_es !== undefined) updates.explanation_es = input.explanation_es
  if (input.options_es !== undefined) updates.options_es = input.options_es

  const { data, error } = await supabase
    .from('quiz_questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  return { data: data as QuizQuestion }
}

export async function deleteQuizQuestion(questionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('quiz_questions').delete().eq('id', questionId)
  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  return { success: true }
}

export async function reorderQuizQuestions(classItemId: string, questionIds: string[]) {
  const supabase = await createClient()
  await Promise.all(
    questionIds.map((id, index) =>
      supabase.from('quiz_questions').update({ order_index: index }).eq('id', id)
    )
  )
  revalidatePath('/admin/courses')
  return { success: true }
}
