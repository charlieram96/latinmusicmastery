'use client'

import {
  PlaysenseStudioPlayer,
  type PlaysenseStudioPlayerScoreTrack,
  type PlaysenseStudioPlayerTimeMap,
} from '@/components/playsense-studio/player/playsense-studio-player'
import { ScoreExerciseGame } from './score-exercise-game'
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

/**
 * Exercise = video + notation staff (the PlaySense pentagram) on top, and the
 * "rockband" rhythm-highway test view underneath. Both are derived from a single
 * authored score: the player syncs the staff to the video, and the game grades
 * the student's live playing of the same notes.
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
  return (
    <div className="space-y-6">
      {/* Top — video + notation staff (learn / reference) */}
      {videoUrl && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Watch &amp; Learn</h3>
          <PlaysenseStudioPlayer
            classItemId={classItemId}
            videoUrl={videoUrl}
            score={score}
            tracks={tracks}
            activeTimeMap={activeTimeMap}
            layout={playerLayout}
          />
        </div>
      )}

      {/* Bottom — rhythm-highway test (play & get graded) */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Play the Exercise</h3>
        <ScoreExerciseGame exercise={exercise} />
      </div>
    </div>
  )
}
