import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StagePlayer } from '@/components/play-sense/stage/stage-player'
import { getPublishedSongs } from '@/app/actions/playsense-studio'
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { makeDemoExercise } from '@/lib/play-sense/demo-exercises'

export default async function PlaySensePage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Local design review uses the real app player, with clearly identified sample phrases.
  if (process.env.NODE_ENV === 'development' && (await searchParams).preview === 'studio') {
    return <StagePlayer preview exercises={(['conga', 'timbale', 'piano'] as const).map(makeDemoExercise)} />
  }

  // Songs are score-backed: the highway is derived from the ScoreDocument at
  // runtime (single source of truth, fixed-BPM clock — no video).
  const { data: songs } = await getPublishedSongs()

  const exerciseDefinitions: ExerciseDefinition[] = (songs || []).map((song) =>
    scoreToExerciseDefinition(song.parsedScore, {
      id: song.id,
      title: song.title,
      difficulty: song.difficulty,
      trackIndex: song.trackIndex,
    })
  )

  // The stage fills the dashboard content area, retaining the app navigation.
  return <StagePlayer exercises={exerciseDefinitions} />
}
