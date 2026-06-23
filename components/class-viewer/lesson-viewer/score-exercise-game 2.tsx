'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import type { BackingTrack } from '@/app/actions/playsense-studio'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { RhythmHighway } from '@/components/play-sense/rhythm-highway/RhythmHighway'
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer'
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
  /** The lesson's score — rendered as staff notation alongside the highway while playing. */
  score?: ScoreDocument
  /** When set (video lessons), the results screen offers "Watch demo again" which
   *  flips the parent back to the instructional video. */
  onWatchDemo?: () => void
  /** Instrument backing tracks the student can choose to hear. When provided
   *  (even empty), the selection — not the legacy exercise.audioUrl — drives the
   *  engine's backing audio. Tracks are equal-length and pre-synced. */
  backingTracks?: BackingTrack[]
  /** Optional exercise-part video: plays MUTED in sync with the engine clock,
   *  starting at its crop offset (window length = the score's length). */
  exerciseVideo?: { url: string; startSeconds: number } | null
}

/**
 * Single-exercise "rockband" test view: the rhythm highway + live input grading
 * engine, fed by an ExerciseDefinition derived from the lesson's PlaySense score.
 *
 * This is a focused, playlist-free embedding of the same engine that powers
 * the standalone /play-sense stage (components/play-sense/stage/stage-player.tsx).
 */
export function ScoreExerciseGame({
  exercise,
  score,
  onWatchDemo,
  backingTracks,
  exerciseVideo,
}: ScoreExerciseGameProps) {
  // Which backing tracks the student wants to hear — all of them by default.
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    () => new Set((backingTracks ?? []).map((t) => t.id))
  )
  const selectedUrls = useMemo(
    () => (backingTracks ?? []).filter((t) => selectedTrackIds.has(t.id)).map((t) => t.audioUrl),
    [backingTracks, selectedTrackIds]
  )

  // An explicit (possibly empty) selection only when backing tracks are
  // authored; otherwise the legacy path (exercise.audioUrl) stays in charge.
  const session = useExerciseSession(backingTracks ? { backingTrackUrls: selectedUrls } : {})
  const stableExercise = useMemo(() => exercise, [exercise])

  // --- Optional exercise video, synced to the engine clock ---
  // Muted visual reference: seek to the crop start on countdown, play during
  // 'playing', and re-seek only when drifted (>0.35s) so it stays smooth.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const exerciseDurationSec = useMemo(() => getExerciseDuration(exercise), [exercise])
  useEffect(() => {
    const v = videoRef.current
    if (!v || !exerciseVideo) return
    const start = exerciseVideo.startSeconds
    if (session.sessionState === 'playing') {
      const expected = start + session.playheadProgress * exerciseDurationSec
      if (Math.abs(v.currentTime - expected) > 0.35) v.currentTime = expected
      if (v.paused) void v.play().catch(() => {})
    } else if (session.sessionState === 'countdown') {
      if (!v.paused) v.pause()
      if (Math.abs(v.currentTime - start) > 0.05) v.currentTime = start
    } else if (!v.paused) {
      v.pause()
    }
  }, [session.sessionState, session.playheadProgress, exerciseVideo, exerciseDurationSec])

  const toggleTrack = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // The staff renderer reports the active track's single-pass duration; the
  // playhead progress (0..1 across all loops) maps back onto one pass so the
  // cursor cycles through the notation once per loop.
  const [staffDurationMs, setStaffDurationMs] = useState<number | null>(null)
  const loopCount = Math.max(1, exercise.loopCount || 1)
  const staffMs =
    staffDurationMs != null
      ? ((session.playheadProgress * loopCount) % 1) * staffDurationMs
      : 0

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
      {isActive && (
        <div className="border-b border-border bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground">Now it&apos;s your turn</p>
          <p className="text-xs text-muted-foreground">
            Play along with the highway — you&apos;ll be graded on your timing.
          </p>
        </div>
      )}

      {/* Backing-track selection — pick the instruments to hear before starting. */}
      {session.sessionState === 'selecting' && backingTracks && backingTracks.length > 0 && (
        <div className="border-b border-border bg-background/60 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Play along with
          </p>
          <div className="flex flex-wrap gap-2">
            {backingTracks.map((t) => {
              const on = selectedTrackIds.has(t.id)
              return (
                <label
                  key={t.id}
                  className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggleTrack(t.id)}
                  />
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                  />
                  {t.label}
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Selected tracks play in sync with the notes while you&apos;re graded.
          </p>
        </div>
      )}

      <div className="relative flex min-h-[360px] flex-col md:flex-row">
        {/* Optional exercise video — muted, follows the engine clock. */}
        {showCanvas && exerciseVideo && (
          <div className="flex shrink-0 items-center justify-center border-b border-border bg-black md:w-2/5 md:border-b-0 md:border-r">
            <video
              ref={videoRef}
              src={exerciseVideo.url}
              muted
              playsInline
              preload="auto"
              className="max-h-[360px] w-full object-contain"
            />
          </div>
        )}
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

      {showCanvas && score && (
        <div className="max-h-64 overflow-y-auto border-t border-border bg-background/40 px-3 py-2">
          <StaffRenderer
            score={score}
            trackIndex={0}
            currentMs={staffMs}
            layoutMode="wrapped"
            onDurationKnown={setStaffDurationMs}
          />
        </div>
      )}

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
