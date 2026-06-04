'use client'

import { useState } from 'react'
import { Eye, Gamepad2 } from 'lucide-react'
import {
  PlaysenseStudioPlayer,
  type PlaysenseStudioPlayerScoreTrack,
  type PlaysenseStudioPlayerTimeMap,
} from '@/components/playsense-studio/player/playsense-studio-player'
import { ScoreExerciseGame } from './score-exercise-game'
import { cn } from '@/lib/utils'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import type { ExerciseDefinition } from '@/lib/play-sense/types'

interface ExerciseViewProps {
  classItemId: string
  videoUrl: string | null
  score: ScoreDocument
  tracks: PlaysenseStudioPlayerScoreTrack[]
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null
  /** Derived from `score` server-side via scoreToExerciseDefinition. */
  exercise: ExerciseDefinition
  playerLayout?: 'stack' | 'split'
}

type Mode = 'watch' | 'play'

/**
 * Exercise lesson. When there's an instructional video, the student starts in
 * "Watch & Learn" (the video + synced staff) and switches to "Play the Exercise"
 * (the fixed-BPM rhythm highway + grading) when ready — a REVERSIBLE toggle, so
 * they can rewatch the demo between attempts (also reachable from the results
 * screen's "Watch demo again"). With no video, only the graded highway shows.
 */
export function ExerciseView({
  classItemId,
  videoUrl,
  score,
  tracks,
  activeTimeMap,
  exercise,
  playerLayout = 'stack',
}: ExerciseViewProps) {
  // Demo first: default to Watch when there's a video to watch.
  const [mode, setMode] = useState<Mode>(videoUrl ? 'watch' : 'play')

  // No video → no Watch mode; just the graded highway.
  if (!videoUrl) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Play the Exercise</h3>
        <ScoreExerciseGame exercise={exercise} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
        <ToggleTab active={mode === 'watch'} onClick={() => setMode('watch')}>
          <Eye className="w-4 h-4" />
          Watch &amp; Learn
        </ToggleTab>
        <ToggleTab active={mode === 'play'} onClick={() => setMode('play')}>
          <Gamepad2 className="w-4 h-4" />
          Play the Exercise
        </ToggleTab>
      </div>

      {mode === 'watch' ? (
        <PlaysenseStudioPlayer
          classItemId={classItemId}
          videoUrl={videoUrl}
          score={score}
          tracks={tracks}
          activeTimeMap={activeTimeMap}
          layout={playerLayout}
        />
      ) : (
        <ScoreExerciseGame exercise={exercise} onWatchDemo={() => setMode('watch')} />
      )}
    </div>
  )
}

function ToggleTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
