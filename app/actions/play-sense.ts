'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveAttempt(data: {
  exerciseId: string
  score: number
  accuracy: number
  perfectCount: number
  goodCount: number
  okCount: number
  missCount: number
  extraHits: number
  maxCombo: number
  maxStreak: number
  avgOffsetMs: number
  tempoDriftMs: number
  durationSeconds: number
  events: Array<{
    eventIndex: number
    grade: string
    offsetMs: number | null
    timing: string | null
    onsetEnergy: number | null
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Insert attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('play_sense_attempts')
    .insert({
      user_id: user.id,
      exercise_id: data.exerciseId,
      score: data.score,
      accuracy: data.accuracy,
      perfect_count: data.perfectCount,
      good_count: data.goodCount,
      ok_count: data.okCount,
      miss_count: data.missCount,
      extra_hits: data.extraHits,
      max_combo: data.maxCombo,
      max_streak: data.maxStreak,
      avg_offset_ms: data.avgOffsetMs,
      tempo_drift_ms: data.tempoDriftMs,
      duration_seconds: data.durationSeconds,
    })
    .select('id')
    .single()

  if (attemptError) throw attemptError

  // Insert attempt events in batch
  if (data.events.length > 0) {
    const eventRows = data.events.map(e => ({
      attempt_id: attempt.id,
      event_index: e.eventIndex,
      grade: e.grade,
      offset_ms: e.offsetMs,
      timing: e.timing,
      onset_energy: e.onsetEnergy,
    }))

    const { error: eventsError } = await supabase
      .from('play_sense_attempt_events')
      .insert(eventRows)

    if (eventsError) throw eventsError
  }

  return attempt.id
}

/** The student's best saved accuracy on one exercise (null when none), for Part done's comparison. */
export async function getBestAttemptAccuracy(exerciseId: string): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('play_sense_attempts')
    .select('accuracy')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .not('accuracy', 'is', null)
    .order('accuracy', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return typeof data?.accuracy === 'number' ? data.accuracy : null
}

export async function getUserAttempts(exerciseId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('play_sense_attempts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (exerciseId) {
    query = query.eq('exercise_id', exerciseId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
