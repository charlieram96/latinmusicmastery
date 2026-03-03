'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { PlaylistView } from './playlist-view'
import { NowPlayingBar } from './now-playing-bar'
import { VisualizationPanel } from './visualization-panel'
import { CalibrationWizard } from './calibration-wizard'
import { ResultsSummary } from './results-summary'
import { saveAttempt } from '@/app/actions/play-sense'
import {
  fadeInUp,
  slideInLeft,
  standardTransition,
} from '@/lib/play-sense/animations'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

interface ExercisePlayerProps {
  exercises: ExerciseDefinition[]
}

export function ExercisePlayer({ exercises }: ExercisePlayerProps) {
  const session = useExerciseSession()
  const [floatingGrades, setFloatingGrades] = useState<Array<{ grade: string; id: number }>>([])
  const gradeIdRef = useRef(0)
  const [edgeFlash, setEdgeFlash] = useState(false)
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

  // Edge flash on onset detection
  useEffect(() => {
    if (session.lastHitGrade && session.sessionState === 'playing') {
      setEdgeFlash(true)
      const t = setTimeout(() => setEdgeFlash(false), 150)
      return () => clearTimeout(t)
    }
  }, [session.lastHitGrade, session.sessionState, session.eventResults.length])

  const isActive = session.sessionState === 'selecting' ||
    session.sessionState === 'countdown' ||
    session.sessionState === 'playing'

  const showPlaylist = session.sessionState === 'idle' || isActive

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
            <Button variant="ghost" size="sm" onClick={session.goToSelect} className="self-start text-slate-400 hover:text-slate-200">
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
                  onStartCalibration={session.startCalibration}
                  onSkip={() => session.startExercise()}
                  onClearCalibration={() => session.startCalibration()}
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
            <Button variant="ghost" size="sm" onClick={session.goToSelect} className="self-start text-slate-400 hover:text-slate-200">
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

        {/* Main layout: playlist + visualization + now playing */}
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
                'w-[300px] lg:w-[340px] shrink-0 border-r border-slate-800/40 hidden md:flex flex-col',
                // On mobile when idle, show full-width playlist
              )}>
                <PlaylistView
                  exercises={exercises}
                  selectedExercise={session.exercise}
                  isPlaying={session.sessionState === 'playing'}
                  onSelect={session.selectExercise}
                />
              </div>

              {/* Mobile playlist — full screen when idle */}
              {session.sessionState === 'idle' && (
                <div className="flex-1 md:hidden">
                  <PlaylistView
                    exercises={exercises}
                    selectedExercise={session.exercise}
                    isPlaying={false}
                    onSelect={session.selectExercise}
                  />
                </div>
              )}

              {/* Visualization panel */}
              <div className={cn(
                'flex-1 flex flex-col min-h-0 p-4',
                session.sessionState === 'idle' && 'hidden md:flex',
              )}>
                <VisualizationPanel
                  exercise={session.exercise}
                  sessionState={session.sessionState}
                  eventResults={session.eventResults}
                  playheadProgress={session.playheadProgress}
                  countdownBeat={session.countdownBeat}
                  floatingGrades={floatingGrades}
                  edgeFlash={edgeFlash}
                  currentScore={session.currentScore}
                  currentCombo={session.currentCombo}
                  currentAccuracy={session.currentAccuracy}
                  tempoDrift={session.tempoDrift}
                  lastHitGrade={session.lastHitGrade}
                  inputLevel={session.inputLevel}
                />
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
                  backingTrackLoading={session.backingTrackLoading}
                  backingTrackLoaded={session.backingTrackLoaded}
                  onStart={session.startExercise}
                  onStop={session.stopExercise}
                  onCalibrate={session.startCalibration}
                  onNoisyRoomChange={session.setNoisyRoomMode}
                />
              )}
            </AnimatePresence>

            {/* Error states */}
            {session.audioError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-4 p-3 rounded-xl border border-red-500/30 bg-red-950/30"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-300">{session.audioError}</p>
                    {session.hasPermission === false && (
                      <p className="text-xs text-slate-400 mt-1">
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
