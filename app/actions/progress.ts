'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markLessonComplete(lessonId: string, userId: string) {
  const supabase = await createClient()

  // Check if progress record exists
  const { data: existing } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    // Create new record
    const { error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/lessons/${lessonId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateLessonProgress(
  lessonId: string,
  userId: string,
  lastPositionSeconds?: number
) {
  const supabase = await createClient()

  // Check if progress record exists
  const { data: existing } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress')
      .update({
        last_position_seconds: lastPositionSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    // Create new record
    const { error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        lesson_id: lessonId,
        last_position_seconds: lastPositionSeconds,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/lessons/${lessonId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function submitExerciseAttempt(
  exerciseId: string,
  userId: string,
  userAnswer: string,
  isCorrect: boolean
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('exercise_attempts')
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
      user_answer: userAnswer,
      is_correct: isCorrect,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/exercises/${exerciseId}`)
  return { success: true }
}
