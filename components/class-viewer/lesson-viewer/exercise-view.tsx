'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import {
  PlaysenseStudioPlayer,
  type PlayerSection,
  type PlaysenseStudioPlayerScoreTrack,
  type PlaysenseStudioPlayerTimeMap,
} from '@/components/playsense-studio/player/playsense-studio-player'
import { ScoreExerciseGame } from './score-exercise-game'
import { useTranslation } from '@/components/language-provider'
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
    trimOutSeconds?: number | null
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
  // Surfaces the big centered CTA once the demo has played to the end.
  const [videoEnded, setVideoEnded] = useState(false)
  const { t } = useTranslation()

  // The game owns its immersive layout; the lesson sidebar preference is retained.
  const goToPlay = () => {
    setMode('play')
  }

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
        <div className="relative">
          {hasSections ? (
            <PlaysenseStudioPlayer
              classItemId={classItemId}
              videoUrl={videoUrl}
              score={sections[0].score}
              tracks={sections[0].tracks}
              activeTimeMap={sections[0].activeTimeMap}
              sections={sections}
              layout={playerLayout}
              onEnded={() => setVideoEnded(true)}
            />
          ) : (
            <PlaysenseStudioPlayer
              classItemId={classItemId}
              videoUrl={videoUrl}
              score={score}
              tracks={tracks}
              activeTimeMap={activeTimeMap}
              layout={playerLayout}
              onEnded={() => setVideoEnded(true)}
            />
          )}

          {/* Demo finished → big centered CTA over the player. */}
          <AnimatePresence>
            {videoEnded && (
              <motion.div
                key="turn-cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-[2px]"
              >
                <motion.button
                  onClick={goToPlay}
                  initial={{ scale: 0.92 }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-2xl ring-4 ring-primary/30 transition hover:opacity-90"
                >
                  <Gamepad2 className="h-5 w-5" />
                  {t('dashboard.classViewer.exercise.yourTurn')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end">
          <button
            onClick={goToPlay}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Gamepad2 className="h-4 w-4" />
            {t('dashboard.classViewer.exercise.yourTurn')}
          </button>
        </div>
      </div>
    )
  }

  const goToWatch = () => {
    setVideoEnded(false)
    setMode('watch')
  }

  // "Watch again" now lives inside the game's header strip (via onWatchDemo).
  return (
    <ScoreExerciseGame
      exercise={exercise}
      score={score}
      onWatchDemo={goToWatch}
      backingTracks={backingTracks}
      exerciseVideo={exerciseVideo}
    />
  )
}
