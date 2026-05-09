'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { PlaylistView } from './playlist-view'
import { NowPlayingBar } from './now-playing-bar'
import { CalibrationWizard } from './calibration-wizard'
import { ResultsSummary } from './results-summary'
import { saveAttempt } from '@/app/actions/play-sense'
import { MELODIC_EXERCISES } from '@/lib/play-sense/melodic-exercises'
import {
  fadeInUp,
  slideInLeft,
  standardTransition,
  GRADE_LABELS,
  gradeFloat,
} from '@/lib/play-sense/animations'
import { ArrowLeft, AlertTriangle, Music2, ChevronLeft } from 'lucide-react'
import { AudioModePrompt } from './audio-mode-prompt'
import { PlaysenseTestPanel } from './playsense-test-panel'
import { RhythmHighway } from './rhythm-highway/RhythmHighway'

interface ExercisePlayerProps {
  exercises: ExerciseDefinition[]
}

function FloatingGrade({ grade, id }: { grade: string; id: number }) {
  const color = GRADE_COLORS[grade as HitGrade] || '#94a3b8'
  const label = GRADE_LABELS[grade] || grade

  return (
    <motion.div
      key={id}
      variants={gradeFloat}
      initial="hidden"
      animate="visible"
      className="absolute left-1/2 top-[68%] -translate-x-1/2 pointer-events-none z-40"
      style={{ color }}
    >
      <span
        className="text-3xl font-black tracking-tight"
        style={{ textShadow: `0 0 20px ${color}, 0 0 40px ${color}40` }}
      >
        +{label}
      </span>
    </motion.div>
  )
}

export function ExercisePlayer({ exercises }: ExercisePlayerProps) {
  const allExercises = useMemo(
    () => [...exercises, ...MELODIC_EXERCISES],
    [exercises]
  )
  const session = useExerciseSession()
  const [floatingGrades, setFloatingGrades] = useState<Array<{ grade: string; id: number }>>([])
  const gradeIdRef = useRef(0)
  const prevEventCountRef = useRef(0)

  // Save attempt to Supabase when results are ready
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
        events: session.eventResults.map(e => ({
          eventIndex: e.eventIndex,
          grade: e.grade,
          offsetMs: e.offsetMs,
          timing: e.timing,
          onsetEnergy: e.onsetEnergy,
        })),
      }).catch(console.error)
    }
  }, [session.sessionState, session.attemptStats, session.exercise, session.eventResults])

  // Floating grade labels on every new event result
  useEffect(() => {
    const count = session.eventResults.length
    if (
      count > prevEventCountRef.current &&
      session.lastHitGrade &&
      session.sessionState === 'playing'
    ) {
      const id = ++gradeIdRef.current
      setFloatingGrades(prev => [...prev.slice(-3), { grade: session.lastHitGrade!, id }])
      setTimeout(() => {
        setFloatingGrades(prev => prev.filter(g => g.id !== id))
      }, 1100)
    }
    prevEventCountRef.current = count
  }, [session.eventResults.length, session.lastHitGrade, session.sessionState])

  const isActive = session.sessionState === 'selecting' ||
    session.sessionState === 'countdown' ||
    session.sessionState === 'playing'

  const showPlaylist = session.sessionState === 'idle' || isActive

  // The canvas stays mounted whenever an exercise is selected, regardless of which state
  // we're in — selecting, countdown, or playing. Modal prompts ride on top.
  const showCanvas = !!session.exercise && isActive

  // The audio-mode prompt shows when an exercise is loaded but no input has been picked
  const showAudioModePrompt =
    session.sessionState === 'selecting' && session.audioMode === null

  // The PlaySense test panel shows when the user picked PlaySense and BLE setup is in progress
  const showPlaysenseTest =
    session.sessionState === 'selecting' &&
    session.audioMode === 'playsense' &&
    !!session.exercise

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      <AnimatePresence mode="wait">
        {/* Calibrating state — full panel */}
        {session.sessionState === 'calibrating' && (
          <motion.div
            key="calibrating"
            variants={slideInLeft}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={standardTransition}
            className="flex-1 flex flex-col gap-4 p-4"
          >
            <Button variant="ghost" size="sm" onClick={session.goToSelect} className="self-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-lg">
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
          </motion.div>
        )}

        {/* Results state — full panel */}
        {session.sessionState === 'results' && session.attemptStats && session.exercise && (
          <motion.div
            key="results"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={standardTransition}
            className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto"
          >
            <Button variant="ghost" size="sm" onClick={session.goToSelect} className="self-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" />
              All Exercises
            </Button>
            <ResultsSummary
              stats={session.attemptStats}
              exerciseTitle={session.exercise.title}
              onRetry={session.retry}
              onNext={session.goToSelect}
            />
          </motion.div>
        )}

        {/* Main layout: playlist + canvas + now playing */}
        {showPlaylist && (
          <motion.div
            key="main"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={standardTransition}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex-1 flex min-h-0">
              {/* Playlist sidebar — desktop */}
              <div className={cn(
                'shrink-0 border-r border-border hidden md:flex flex-col transition-all duration-300',
                isActive ? 'w-[220px] lg:w-[260px]' : 'w-[300px] lg:w-[340px]',
              )}>
                <PlaylistView
                  exercises={allExercises}
                  selectedExercise={session.exercise}
                  isPlaying={session.sessionState === 'playing'}
                  onSelect={session.selectExercise}
                />
              </div>

              {/* Mobile playlist — full screen when idle */}
              {session.sessionState === 'idle' && (
                <div className="flex-1 md:hidden">
                  <PlaylistView
                    exercises={allExercises}
                    selectedExercise={session.exercise}
                    isPlaying={false}
                    onSelect={session.selectExercise}
                  />
                </div>
              )}

              {/* Canvas + overlays */}
              <div className={cn(
                'flex-1 flex flex-col min-h-0',
                isActive ? 'p-2' : 'p-4',
                session.sessionState === 'idle' && 'hidden md:flex',
              )}>
                {/* Idle empty state — only when no exercise selected */}
                {!session.exercise && session.sessionState === 'idle' && (
                  <IdleEmptyState />
                )}

                {/* Persistent canvas when an exercise is selected */}
                {showCanvas && session.exercise && (
                  <div className="flex-1 flex relative min-h-0">
                    <div className="flex-1 flex min-h-0 relative">
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

                      {/* Floating grade labels during play */}
                      <AnimatePresence>
                        {floatingGrades.map(fg => (
                          <FloatingGrade key={fg.id} grade={fg.grade} id={fg.id} />
                        ))}
                      </AnimatePresence>

                      {/* Audio-mode prompt — modal overlay on canvas */}
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

                      {/* PlaySense test panel — modal overlay on canvas */}
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

                      {/* Exercise title strip — top-left, only during play */}
                      {session.sessionState === 'playing' && (
                        <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                          <span className="text-xs font-semibold text-white/60 tracking-wide drop-shadow-sm">
                            {session.exercise.title}
                          </span>
                          <span className="text-xs font-mono text-white/50 drop-shadow-sm">
                            {session.exercise.bpm} BPM &middot; {session.exercise.timeSignature[0]}/{session.exercise.timeSignature[1]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Now Playing Bar — shown when exercise selected */}
            <AnimatePresence>
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
            </AnimatePresence>

            {/* Error states */}
            {session.audioError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-4 p-3 rounded-xl border border-red-500/30 bg-destructive/10"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">{session.audioError}</p>
                    {session.hasPermission === false && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Please allow microphone access in your browser settings.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IdleEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-muted-foreground relative">
        <div className="absolute inset-0 -m-8 rounded-full bg-primary/5 blur-2xl" />
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Music2 className="w-20 h-20 mx-auto mb-4 relative" />
        </motion.div>
        <p className="text-sm relative">Choose an exercise to start practicing</p>
        <div className="hidden md:flex items-center gap-1 justify-center mt-2 text-xs text-muted-foreground/60 relative">
          <ChevronLeft className="w-3 h-3" />
          <span>Pick from the playlist</span>
        </div>
      </div>
    </div>
  )
}
