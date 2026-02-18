'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markLessonComplete(lessonId: string, userId: string) {
  const supabase = await createClient()

  // Check if progress record exists
  const { data: existing } = await supabase
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress_legacy')
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
      .from('user_progress_legacy')
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
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress_legacy')
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
      .from('user_progress_legacy')
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

export async function markModuleComplete(moduleId: string, userId: string) {
  const supabase = await createClient()

  // Check if progress record exists
  const { data: existing } = await supabase
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress_legacy')
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
      .from('user_progress_legacy')
      .insert({
        user_id: userId,
        module_id: moduleId,
        completed: true,
        completed_at: new Date().toISOString(),
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/modules/${moduleId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateModuleProgress(
  moduleId: string,
  userId: string,
  lastPositionSeconds?: number
) {
  const supabase = await createClient()

  // Check if progress record exists
  const { data: existing } = await supabase
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .single()

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress_legacy')
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
      .from('user_progress_legacy')
      .insert({
        user_id: userId,
        module_id: moduleId,
        last_position_seconds: lastPositionSeconds,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/modules/${moduleId}`)
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

// ============================================
// New Class Item Progress (new hierarchy)
// ============================================

export async function markClassItemComplete(classItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('class_item_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('class_item_id', classItemId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('class_item_progress')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('class_item_progress')
      .insert({
        user_id: user.id,
        class_item_id: classItemId,
        completed: true,
        completed_at: new Date().toISOString(),
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateClassItemPosition(classItemId: string, lastPositionSeconds: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('class_item_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('class_item_id', classItemId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('class_item_progress')
      .update({ last_position_seconds: lastPositionSeconds })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('class_item_progress')
      .insert({
        user_id: user.id,
        class_item_id: classItemId,
        last_position_seconds: lastPositionSeconds,
      })

    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function getClassProgress(classId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Get all class_items for this class
  const { data: items } = await supabase
    .from('class_items')
    .select('id')
    .eq('class_id', classId)

  if (!items || items.length === 0) return { data: { total: 0, completed: 0, progressMap: {} } }

  const itemIds = items.map(i => i.id)

  // Get progress for these items
  const { data: progress } = await supabase
    .from('class_item_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('class_item_id', itemIds)

  const progressMap: Record<string, { completed: boolean | null; last_position_seconds: number | null }> = {}
  for (const p of progress || []) {
    progressMap[p.class_item_id] = {
      completed: p.completed,
      last_position_seconds: p.last_position_seconds,
    }
  }

  return {
    data: {
      total: items.length,
      completed: (progress || []).filter(p => p.completed).length,
      progressMap,
    },
  }
}

export async function getCourseProgress(courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Deep fetch all items for this course
  const { data: sections } = await supabase
    .from('course_sections')
    .select(`
      id,
      classes (
        id,
        items:class_items (id)
      )
    `)
    .eq('course_id', courseId)

  const allItemIds: string[] = []
  for (const section of sections || []) {
    for (const cls of section.classes || []) {
      for (const item of (cls as { items?: { id: string }[] }).items || []) {
        allItemIds.push(item.id)
      }
    }
  }

  if (allItemIds.length === 0) return { data: { total: 0, completed: 0 } }

  const { data: progress } = await supabase
    .from('class_item_progress')
    .select('class_item_id, completed')
    .eq('user_id', user.id)
    .in('class_item_id', allItemIds)
    .eq('completed', true)

  return {
    data: {
      total: allItemIds.length,
      completed: (progress || []).length,
    },
  }
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
