'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, RotateCcw, X } from 'lucide-react'
import {
  PlaysenseStudioPlayer,
  type PlayerOverlayContext,
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
  /** Named in the Watch message ("Watch {teacher} play it once"). */
  teacherName?: string | null
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
  teacherName = null,
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
  const dismissCta = () => setVideoEnded(false)

  // Escape closes the end-of-demo card, like any other dismissable layer.
  useEffect(() => {
    if (!videoEnded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) dismissCta()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [videoEnded])

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
    const watched = hasSections
      ? { score: sections[0].score, tracks: sections[0].tracks, activeTimeMap: sections[0].activeTimeMap, sections }
      : { score, tracks, activeTimeMap, sections: undefined }

    // Demo finished → a card over the player offering the next step. The
    // player draws it over its own box (the full-bleed workspace in the split
    // layout), which is the only way to centre it on what the student was
    // watching rather than on the player plus the clips panel beneath it.
    // Closing it (X, backdrop, Escape) hands the ended video back with its
    // transport, so a passage can still be scrubbed and re-watched.
    const turnCta = ({ restart }: PlayerOverlayContext) => (
      <AnimatePresence>
        {videoEnded && (
          <motion.div
            key="turn-cta"
            data-testid="turn-cta"
            role="dialog"
            aria-label={t('dashboard.classViewer.exercise.demoFinished')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={dismissCta}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-card/95 p-6 text-center shadow-2xl"
            >
              <button
                type="button"
                onClick={dismissCta}
                aria-label={t('dashboard.classViewer.exercise.closeOverlay')}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">PlaySense</p>
              <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground">
                {t('dashboard.classViewer.exercise.demoFinished')}
              </h3>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {t('dashboard.classViewer.exercise.demoFinishedHint')}
              </p>
              <button
                type="button"
                data-action="your-turn"
                onClick={goToPlay}
                className="mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90"
              >
                <Gamepad2 className="h-5 w-5" />
                {t('dashboard.classViewer.exercise.yourTurn')}
              </button>
              <button
                type="button"
                data-action="watch-again"
                onClick={() => { dismissCta(); restart() }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <RotateCcw className="h-4 w-4" />
                {t('dashboard.classViewer.exercise.watchAgain')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )

    return (
      <div className="space-y-4">
        <PlaysenseStudioPlayer
          classItemId={classItemId}
          videoUrl={videoUrl}
          score={watched.score}
          tracks={watched.tracks}
          activeTimeMap={watched.activeTimeMap}
          sections={watched.sections}
          layout={playerLayout}
          onEnded={() => setVideoEnded(true)}
          overlay={turnCta}
        />

        <div className="flex justify-center">
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
