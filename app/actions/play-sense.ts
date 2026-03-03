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

export async function getExercises() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('play_sense_exercises')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true })

  if (error) throw error
  return data
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

// Admin actions
export async function createExercise(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) throw new Error('Not authorized')

  const eventsJson = formData.get('events') as string
  let events
  try {
    events = JSON.parse(eventsJson)
  } catch {
    throw new Error('Invalid JSON for events')
  }

  const timeSignatureJson = formData.get('time_signature') as string
  let timeSignature
  try {
    timeSignature = JSON.parse(timeSignatureJson)
  } catch {
    timeSignature = [4, 4]
  }

  const audioUrl = formData.get('audio_url') as string | null

  const { error } = await supabase
    .from('play_sense_exercises')
    .insert({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      instrument: formData.get('instrument') as string,
      bpm: Number(formData.get('bpm')),
      time_signature: timeSignature,
      swing: Number(formData.get('swing') || 0),
      difficulty: formData.get('difficulty') as string,
      measures: Number(formData.get('measures')),
      loop_count: Number(formData.get('loop_count') || 1),
      events,
      is_published: formData.get('is_published') === 'true',
      order_index: Number(formData.get('order_index') || 0),
      audio_url: audioUrl || null,
    })

  if (error) throw error

  revalidatePath('/admin/play-sense')
  revalidatePath('/dashboard/play-sense')
}

export async function updateExercise(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) throw new Error('Not authorized')

  const eventsJson = formData.get('events') as string
  let events
  try {
    events = JSON.parse(eventsJson)
  } catch {
    throw new Error('Invalid JSON for events')
  }

  const timeSignatureJson = formData.get('time_signature') as string
  let timeSignature
  try {
    timeSignature = JSON.parse(timeSignatureJson)
  } catch {
    timeSignature = [4, 4]
  }

  const audioUrl = formData.get('audio_url') as string | null

  const { error } = await supabase
    .from('play_sense_exercises')
    .update({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      instrument: formData.get('instrument') as string,
      bpm: Number(formData.get('bpm')),
      time_signature: timeSignature,
      swing: Number(formData.get('swing') || 0),
      difficulty: formData.get('difficulty') as string,
      measures: Number(formData.get('measures')),
      loop_count: Number(formData.get('loop_count') || 1),
      events,
      is_published: formData.get('is_published') === 'true',
      order_index: Number(formData.get('order_index') || 0),
      audio_url: audioUrl || null,
    })
    .eq('id', id)

  if (error) throw error

  revalidatePath('/admin/play-sense')
  revalidatePath('/dashboard/play-sense')
}

export async function deleteExercise(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) throw new Error('Not authorized')

  const { error } = await supabase
    .from('play_sense_exercises')
    .delete()
    .eq('id', id)

  if (error) throw error

  revalidatePath('/admin/play-sense')
  revalidatePath('/dashboard/play-sense')
}
