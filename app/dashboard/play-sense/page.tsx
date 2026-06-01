import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StagePlayer } from '@/components/play-sense/stage/stage-player'
import type { ExerciseDefinition } from '@/lib/play-sense/types'

export default async function PlaySensePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: exercises } = await supabase
    .from('play_sense_exercises')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true })

  // Transform DB rows to ExerciseDefinition type
  const exerciseDefinitions: ExerciseDefinition[] = (exercises || []).map((ex) => ({
    id: ex.id,
    title: ex.title,
    description: ex.description || '',
    instrument: ex.instrument as ExerciseDefinition['instrument'],
    bpm: ex.bpm,
    timeSignature: (ex.time_signature as [number, number]) || [4, 4],
    swing: Number(ex.swing),
    difficulty: ex.difficulty as ExerciseDefinition['difficulty'],
    measures: ex.measures,
    loopCount: ex.loop_count,
    events: ex.events as unknown as ExerciseDefinition['events'],
    audioUrl: ex.audio_url || undefined,
  }))

  // The Stage renders as a full-viewport fixed overlay (above the dashboard
  // sidebar/header) for an immersive performance-mode experience.
  return <StagePlayer exercises={exerciseDefinitions} />
}
