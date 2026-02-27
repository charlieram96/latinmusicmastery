'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { GRADE_COLORS, type HitGrade } from '@/lib/play-sense/types'
import { getInstrumentLabel } from '@/lib/play-sense/exercise-utils'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { NotationView } from './notation-view'
import { CalibrationWizard } from './calibration-wizard'
import { LiveScoreHUD } from './live-score-hud'
import { ResultsSummary } from './results-summary'
import { ExerciseList } from './exercise-list'
import { SensitivitySettings } from './sensitivity-settings'
import { saveAttempt } from '@/app/actions/play-sense'
import {
  fadeInUp,
  slideInLeft,
  countdownPop,
  gradeFloat,
  GRADE_LABELS,
  standardTransition,
} from '@/lib/play-sense/animations'
import {
  Play,
  Square,
  ArrowLeft,
  Settings2,
  AlertTriangle,
  Headphones,
} from 'lucide-react'

interface ExercisePlayerProps {
  exercises: ExerciseDefinition[]
}

// Floating grade component
function FloatingGrade({ grade, id }: { grade: string; id: number }) {
  const color = GRADE_COLORS[grade as HitGrade] || '#94a3b8'
  const label = GRADE_LABELS[grade] || grade

  return (
    <motion.div
      key={id}
      variants={gradeFloat}
      initial="hidden"
      animate="visible"
      className="absolute left-1/2 top-1/3 -translate-x-1/2 pointer-events-none z-20"
      style={{ color }}
    >
      <span
        className="text-2xl font-black tracking-tight"
        style={{ textShadow: `0 0 16px ${color}` }}
      >
        +{label}
      </span>
    </motion.div>
  )
}

export function ExercisePlayer({ exercises }: ExercisePlayerProps) {
  const session = useExerciseSession()
  const [floatingGrades, setFloatingGrades] = useState<Array<{ grade: string; id: number }>>([])
  const gradeIdRef = useRef(0)
  const [edgeFlash, setEdgeFlash] = useState(false)
  const prevLastHitGradeRef = useRef<string | null>(null)

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

  // Floating grade labels on hit
  useEffect(() => {
    if (
      session.lastHitGrade &&
      session.sessionState === 'playing' &&
      session.lastHitGrade !== prevLastHitGradeRef.current
    ) {
      const id = ++gradeIdRef.current
      setFloatingGrades(prev => [...prev.slice(-3), { grade: session.lastHitGrade!, id }])
      setTimeout(() => {
        setFloatingGrades(prev => prev.filter(g => g.id !== id))
      }, 1100)
    }
    prevLastHitGradeRef.current = session.lastHitGrade
  }, [session.lastHitGrade, session.sessionState])

  // Edge flash on onset detection
  useEffect(() => {
    if (session.lastHitGrade && session.sessionState === 'playing') {
      setEdgeFlash(true)
      const t = setTimeout(() => setEdgeFlash(false), 150)
      return () => clearTimeout(t)
    }
  }, [session.lastHitGrade, session.sessionState, session.eventResults.length])

  // Compute overall progress for the bottom bar
  const overallProgress = session.sessionState === 'playing' ? session.playheadProgress : 0

  return (
    <AnimatePresence mode="wait">
      {/* Idle state — show exercise list */}
      {session.sessionState === 'idle' && (
        <motion.div
          key="idle"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={standardTransition}
          className="space-y-4"
        >
          <ExerciseList exercises={exercises} onSelect={session.selectExercise} />
        </motion.div>
      )}

      {/* Calibrating state */}
      {session.sessionState === 'calibrating' && (
        <motion.div
          key="calibrating"
          variants={slideInLeft}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={standardTransition}
          className="space-y-4"
        >
          <Button variant="ghost" size="sm" onClick={session.goToSelect}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <CalibrationWizard
            isCalibrating={session.isCalibrating}
            calibrationData={session.calibrationData}
            calibrationBeat={session.calibrationBeat}
            totalCalibrationBeats={session.totalCalibrationBeats}
            onStartCalibration={session.startCalibration}
            onSkip={() => session.startExercise()}
            onClearCalibration={() => session.startCalibration()}
          />
        </motion.div>
      )}

      {/* Results state */}
      {session.sessionState === 'results' && session.attemptStats && session.exercise && (
        <motion.div
          key="results"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={standardTransition}
          className="space-y-4"
        >
          <Button variant="ghost" size="sm" onClick={session.goToSelect}>
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

      {/* Selecting / Countdown / Playing states */}
      {(session.sessionState === 'selecting' ||
        session.sessionState === 'countdown' ||
        session.sessionState === 'playing') &&
        session.exercise && (
          <motion.div
            key="active"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={standardTransition}
            className="space-y-4 relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={session.goToSelect}
                  disabled={session.sessionState === 'playing' || session.sessionState === 'countdown'}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">{session.exercise.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">
                      {getInstrumentLabel(session.exercise.instrument)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {session.exercise.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {session.exercise.bpm} BPM
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main content area with edge flash */}
            <div
              className={cn(
                'relative rounded-xl transition-shadow duration-150',
                edgeFlash && 'shadow-[inset_0_0_30px_rgba(59,130,246,0.15)]'
              )}
            >
              {/* Countdown overlay */}
              <AnimatePresence>
                {session.sessionState === 'countdown' && (
                  <motion.div
                    key="countdown-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-xl"
                  >
                    <div className="text-center">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={session.countdownBeat}
                          variants={countdownPop}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="text-8xl font-black text-white"
                          style={{
                            textShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(147,51,234,0.3)',
                          }}
                        >
                          {session.countdownBeat || '...'}
                        </motion.p>
                      </AnimatePresence>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm text-slate-400 mt-4 tracking-widest uppercase"
                      >
                        Get ready
                      </motion.p>
                      {/* Beat ring animation */}
                      <motion.div
                        key={`ring-${session.countdownBeat}`}
                        initial={{ scale: 0.5, opacity: 0.8 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-blue-400/50"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Floating grade labels */}
              <AnimatePresence>
                {floatingGrades.map(fg => (
                  <FloatingGrade key={fg.id} grade={fg.grade} id={fg.id} />
                ))}
              </AnimatePresence>

              {/* Notation + HUD grid */}
              <div className={cn(
                'grid gap-4',
                session.sessionState === 'playing' ? 'grid-cols-1 lg:grid-cols-[1fr_220px]' : 'grid-cols-1'
              )}>
                {/* Notation */}
                <div className={session.sessionState === 'countdown' ? 'opacity-40' : ''}>
                  <NotationView
                    exercise={session.exercise}
                    eventResults={session.eventResults}
                    playheadProgress={session.playheadProgress}
                    isPlaying={session.sessionState === 'playing'}
                  />
                </div>

                {/* Live Score HUD - desktop */}
                {session.sessionState === 'playing' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="hidden lg:block"
                  >
                    <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                      <LiveScoreHUD
                        score={session.currentScore}
                        combo={session.currentCombo}
                        accuracy={session.currentAccuracy}
                        tempoDrift={session.tempoDrift}
                        lastHitGrade={session.lastHitGrade}
                        inputLevel={session.inputLevel}
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile live score - compact */}
            {session.sessionState === 'playing' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between lg:hidden p-3 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50"
              >
                <div className="flex items-center gap-4 text-sm font-mono text-slate-200">
                  <span>Score: {Math.round(session.currentScore)}%</span>
                  <span className={cn(
                    session.currentCombo >= 10 && 'text-orange-400',
                    session.currentCombo >= 5 && session.currentCombo < 10 && 'text-yellow-400'
                  )}>
                    Combo: {session.currentCombo}x
                  </span>
                  <span>Acc: {Math.round(session.currentAccuracy)}%</span>
                </div>
                {session.lastHitGrade && (
                  <span
                    className="text-xs font-bold"
                    style={{ color: GRADE_COLORS[session.lastHitGrade as HitGrade] }}
                  >
                    {GRADE_LABELS[session.lastHitGrade] || session.lastHitGrade}
                  </span>
                )}
              </motion.div>
            )}

            {/* Progress bar - bottom */}
            {session.sessionState === 'playing' && (
              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
                    width: `${overallProgress * 100}%`,
                  }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}

            {/* Controls */}
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-3 flex-wrap">
                {session.sessionState === 'selecting' && (
                  <>
                    <Button
                      onClick={() => session.startExercise()}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Practice
                    </Button>
                    {!session.calibrationData && (
                      <Button variant="outline" onClick={session.startCalibration} className="border-slate-600 text-slate-300 hover:bg-slate-800">
                        <Settings2 className="w-4 h-4 mr-2" />
                        Calibrate
                      </Button>
                    )}
                    {session.calibrationData && (
                      <span className="text-xs text-slate-400">
                        Latency: {session.calibrationData.latencyMs.toFixed(1)}ms
                      </span>
                    )}
                  </>
                )}

                {session.sessionState === 'playing' && (
                  <Button
                    variant="destructive"
                    onClick={session.stopExercise}
                    className="bg-red-600/80 hover:bg-red-600"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}

                {session.sessionState === 'countdown' && (
                  <Button variant="outline" disabled className="border-slate-600 text-slate-400">
                    Starting...
                  </Button>
                )}

                <div className="flex-1" />

                {session.sessionState === 'selecting' && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Headphones className="w-3 h-3" />
                    <span>Headphones recommended</span>
                  </div>
                )}
              </div>

              {(session.sessionState === 'selecting' || session.sessionState === 'playing') && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <SensitivitySettings
                    noisyRoomMode={session.noisyRoomMode}
                    onNoisyRoomChange={session.setNoisyRoomMode}
                    inputLevel={session.inputLevel}
                  />
                </div>
              )}
            </div>

            {/* Error states */}
            {session.audioError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border border-red-500/30 bg-red-950/30"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
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
  )
}
