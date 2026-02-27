import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExercisePlayer } from '@/components/play-sense/exercise-player'
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Play Sense</h1>
        <p className="text-muted-foreground mt-1">
          Practice percussion patterns with real-time feedback
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="bg-slate-950 rounded-2xl p-4 md:p-6 border border-slate-800/50"
          style={{
            background: 'linear-gradient(145deg, rgba(2,6,23,0.95), rgba(15,23,42,0.9))',
          }}
        >
          <ExercisePlayer exercises={exerciseDefinitions} />
        </div>
      </div>
    </>
  )
}
