'use client'

import { useState } from 'react'
import { ArrowLeft, Gamepad2 } from 'lucide-react'
import {
  PlaysenseStudioPlayer,
  type PlayerSection,
  type PlaysenseStudioPlayerScoreTrack,
  type PlaysenseStudioPlayerTimeMap,
} from '@/components/playsense-studio/player/playsense-studio-player'
import { ScoreExerciseGame } from './score-exercise-game'
import type { BackingTrack } from '@/app/actions/playsense-studio'
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
  /** Published, placed WATCH-part sections (scored notation synced to the demo
   *  video). When non-empty, Watch mode uses the sectioned player; otherwise it
   *  falls back to the graded score over the video. */
  sections?: PlayerSection[]
  playerLayout?: 'stack' | 'split'
  /** Instrument backing tracks for the play part (student selects before starting). */
  backingTracks?: BackingTrack[]
  /** Optional exercise-part video. Cropped to the score's length, or synced to
   *  the notation via `timeMap` when one is published. */
  exerciseVideo?: {
    url: string
    startSeconds: number
    timeMap: PlaysenseStudioPlayerTimeMap | null
  } | null
}

type Mode = 'watch' | 'play'

/**
 * Exercise lesson. The student watches the instructor's demo at their own pace —
 * play, rewind, loop, slow down — then proceeds to "Now it's your turn": the
 * fixed-BPM rhythm highway + staff, where they're graded. "Watch again" returns
 * to the demo. With no video, only the graded highway shows.
 */
export function ExerciseView({
  classItemId,
  videoUrl,
  score,
  tracks,
  activeTimeMap,
  exercise,
  sections,
  playerLayout = 'stack',
  backingTracks,
  exerciseVideo,
}: ExerciseViewProps) {
  // Demo first: start in Watch when there's a video; otherwise go straight to play.
  const [mode, setMode] = useState<Mode>(videoUrl ? 'watch' : 'play')

  // No video → no Watch mode; just the graded highway + staff.
  if (!videoUrl) {
    return (
      <ScoreExerciseGame
        exercise={exercise}
        score={score}
        backingTracks={backingTracks}
        exerciseVideo={exerciseVideo}
      />
    )
  }

  if (mode === 'watch') {
    // The authored WATCH part (sections synced to the demo) when it exists;
    // otherwise fall back to the graded score over the video.
    const hasSections = !!sections && sections.length > 0
    return (
      <div className="space-y-4">
        {hasSections ? (
          <PlaysenseStudioPlayer
            classItemId={classItemId}
            videoUrl={videoUrl}
            score={sections[0].score}
            tracks={sections[0].tracks}
            activeTimeMap={sections[0].activeTimeMap}
            sections={sections}
            layout={playerLayout}
          />
        ) : (
          <PlaysenseStudioPlayer
            classItemId={classItemId}
            videoUrl={videoUrl}
            score={score}
            tracks={tracks}
            activeTimeMap={activeTimeMap}
            layout={playerLayout}
          />
        )}
        <div className="flex justify-end">
          <button
            onClick={() => setMode('play')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Gamepad2 className="h-4 w-4" />
            Now it&apos;s your turn
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setMode('watch')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Watch again
      </button>
      <ScoreExerciseGame
        exercise={exercise}
        score={score}
        onWatchDemo={() => setMode('watch')}
        backingTracks={backingTracks}
        exerciseVideo={exerciseVideo}
      />
    </div>
  )
}
