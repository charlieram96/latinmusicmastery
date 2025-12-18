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

export async function enrollInCourse(courseId: string) {
  const supabase = await createClient()

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single()

  if (existing) {
    // Update last_accessed_at
    const { error } = await supabase
      .from('course_enrollments')
      .update({
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    // Create new enrollment
    const { error } = await supabase
      .from('course_enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-courses')
  return { success: true }
}

export async function updateCourseAccess(courseId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Update last_accessed_at for existing enrollment
  const { error } = await supabase
    .from('course_enrollments')
    .update({
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('course_id', courseId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
