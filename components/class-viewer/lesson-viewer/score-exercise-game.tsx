'use client'

import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { RhythmHighway } from '@/components/play-sense/rhythm-highway/RhythmHighway'
import { NowPlayingBar } from '@/components/play-sense/now-playing-bar'
import { CalibrationWizard } from '@/components/play-sense/calibration-wizard'
import { ResultsSummary } from '@/components/play-sense/results-summary'
import { AudioModePrompt } from '@/components/play-sense/audio-mode-prompt'
import { PlaysenseTestPanel } from '@/components/play-sense/playsense-test-panel'
import { saveAttempt } from '@/app/actions/play-sense'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ScoreExerciseGameProps {
  /** The exercise derived from the authored score (see lib/play-sense/score-to-exercise). */
  exercise: ExerciseDefinition
  /** When set (video lessons), the results screen offers "Watch demo again" which
   *  flips the parent back to the instructional video. */
  onWatchDemo?: () => void
}

/**
 * Single-exercise "rockband" test view: the rhythm highway + live input grading
 * engine, fed by an ExerciseDefinition derived from the lesson's PlaySense score.
 *
 * This is a focused, playlist-free embedding of the same engine that powers
 * the standalone /play-sense stage (components/play-sense/stage/stage-player.tsx).
 */
export function ScoreExerciseGame({ exercise, onWatchDemo }: ScoreExerciseGameProps) {
  const session = useExerciseSession()
  const stableExercise = useMemo(() => exercise, [exercise])

  // Auto-select this exercise so the session is ready to configure + play.
  useEffect(() => {
    session.selectExercise(stableExercise)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableExercise])

  // Persist the attempt when results are ready.
  useEffect(() => {
    if (session.sessionState === 'results' && session.attemptStats && session.exercise) {
      saveAttempt({
        exerciseId: session.exercise.id,
        score: session.attemptStats.score,
        accuracy: session.attemptStats.accuracy,
        perfectCount: session.attemptStats.perfectCount,
        goodCount: session.attemptStats.goodCount,
        okCount: session.attemptStats.okCount,
        missCount: session.attemptStats.missCount,
        extraHits: session.attemptStats.extraHits,
        maxCombo: session.attemptStats.maxCombo,
        maxStreak: session.attemptStats.maxStreak,
        avgOffsetMs: session.attemptStats.avgOffsetMs,
        tempoDriftMs: session.attemptStats.tempoDriftMs,
        durationSeconds: session.attemptStats.durationSeconds,
        events: session.eventResults.map((e) => ({
          eventIndex: e.eventIndex,
          grade: e.grade,
          offsetMs: e.offsetMs,
          timing: e.timing,
          onsetEnergy: e.onsetEnergy,
        })),
      }).catch(console.error)
    }
  }, [session.sessionState, session.attemptStats, session.exercise, session.eventResults])

  const isActive =
    session.sessionState === 'selecting' ||
    session.sessionState === 'countdown' ||
    session.sessionState === 'playing'

  const showCanvas = !!session.exercise && isActive

  const showAudioModePrompt =
    session.sessionState === 'selecting' && session.audioMode === null

  const showPlaysenseTest =
    session.sessionState === 'selecting' &&
    session.audioMode === 'playsense' &&
    !!session.exercise

  // Calibrating — full panel
  if (session.sessionState === 'calibrating') {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={session.goToSelect}
          className="mb-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="max-w-lg mx-auto">
          <CalibrationWizard
            isCalibrating={session.isCalibrating}
            calibrationData={session.calibrationData}
            calibrationBeat={session.calibrationBeat}
            totalCalibrationBeats={session.totalCalibrationBeats}
            calibrationError={session.calibrationError}
            onStartCalibration={session.startCalibration}
            onSkip={() => session.startExercise()}
            onClearCalibration={() => session.startCalibration()}
            audioMode={session.audioMode}
          />
        </div>
      </div>
    )
  }

  // Results — full panel
  if (session.sessionState === 'results' && session.attemptStats && session.exercise) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <ResultsSummary
          stats={session.attemptStats}
          exerciseTitle={session.exercise.title}
          onRetry={session.retry}
          onWatchDemo={onWatchDemo}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="relative min-h-[360px] flex">
        {showCanvas && session.exercise ? (
          <div className="flex-1 relative min-h-[360px] flex">
            <RhythmHighway
              exercise={session.exercise}
              sessionState={session.sessionState}
              playheadProgress={session.playheadProgress}
              currentScore={session.currentScore}
              currentCombo={session.currentCombo}
              currentAccuracy={session.currentAccuracy}
              metronomeBeat={session.metronomeBeat}
              countdownBeat={session.countdownBeat}
              eventResultsLength={session.eventResults.length}
              eventResults={session.eventResults}
              dimAlpha={showAudioModePrompt || showPlaysenseTest ? 0.55 : 0}
            />

            <AnimatePresence>
              {showAudioModePrompt && (
                <motion.div
                  key="audio-mode-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 flex items-center justify-center p-4"
                >
                  <div className="w-full max-w-md">
                    <AudioModePrompt
                      onSelect={session.setAudioMode}
                      instrument={session.exercise.instrument}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showPlaysenseTest && (
                <motion.div
                  key="playsense-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 flex items-center justify-center p-4"
                >
                  <div className="w-full max-w-lg">
                    <PlaysenseTestPanel
                      instrument={session.exercise.instrument}
                      onReady={session.startExercise}
                      onBack={session.clearAudioMode}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {session.sessionState === 'playing' && (
              <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                <span className="text-xs font-semibold text-white/60 tracking-wide drop-shadow-sm">
                  {session.exercise.title}
                </span>
                <span className="text-xs font-mono text-white/50 drop-shadow-sm">
                  {session.exercise.bpm} BPM &middot; {session.exercise.timeSignature[0]}/
                  {session.exercise.timeSignature[1]}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[360px]">
            Preparing the test…
          </div>
        )}
      </div>

      {session.exercise && isActive && (
        <NowPlayingBar
          exercise={session.exercise}
          sessionState={session.sessionState}
          playheadProgress={session.playheadProgress}
          calibrationData={session.calibrationData}
          noisyRoomMode={session.noisyRoomMode}
          inputLevel={session.inputLevel}
          isListening={session.isListening}
          isMicTesting={session.isMicTesting}
          backingTrackLoading={session.backingTrackLoading}
          backingTrackLoaded={session.backingTrackLoaded}
          audioMetronome={session.audioMetronome}
          audioMode={session.audioMode}
          onAudioModeChange={session.setAudioMode}
          currentScore={session.currentScore}
          currentCombo={session.currentCombo}
          currentAccuracy={session.currentAccuracy}
          lastHitGrade={session.lastHitGrade}
          onStart={session.startExercise}
          onStop={session.stopExercise}
          onCalibrate={session.startCalibration}
          onTestMic={session.testMic}
          onStopTestMic={session.stopTestMic}
          onNoisyRoomChange={session.setNoisyRoomMode}
          onAudioMetronomeChange={session.setAudioMetronome}
        />
      )}

      {session.audioError && (
        <div className="m-4 p-3 rounded-xl border border-red-500/30 bg-destructive/10">
          <p className="text-sm text-muted-foreground">{session.audioError}</p>
        </div>
      )}
    </div>
  )
}
