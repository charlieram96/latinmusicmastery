import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StagePlayer } from '@/components/play-sense/stage/stage-player'
import { getPublishedSongs } from '@/app/actions/playsense-studio'
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise'
import type { ExerciseDefinition } from '@/lib/play-sense/types'

export default async function PlaySensePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  // The Stage renders as a full-viewport fixed overlay (above the dashboard
  // sidebar/header) for an immersive performance-mode experience.
  return <StagePlayer exercises={exerciseDefinitions} />
}
