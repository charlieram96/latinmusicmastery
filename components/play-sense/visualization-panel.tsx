'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition, EventResult, SessionState, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { getInstrumentLabel } from '@/lib/play-sense/exercise-utils'
import { NotationView } from './notation-view'
import { LiveScoreHUD } from './live-score-hud'
import {
  countdownPop,
  gradeFloat,
  GRADE_LABELS,
} from '@/lib/play-sense/animations'
import { Music2 } from 'lucide-react'

interface VisualizationPanelProps {
  exercise: ExerciseDefinition | null
  sessionState: SessionState
  eventResults: EventResult[]
  playheadProgress: number
  countdownBeat: number
  floatingGrades: Array<{ grade: string; id: number }>
  edgeFlash: boolean

  // Live scoring
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  tempoDrift: number
  lastHitGrade: string | null
  inputLevel: number
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

export function VisualizationPanel({
  exercise,
  sessionState,
  eventResults,
  playheadProgress,
  countdownBeat,
  floatingGrades,
  edgeFlash,
  currentScore,
  currentCombo,
  currentAccuracy,
  tempoDrift,
  lastHitGrade,
  inputLevel,
}: VisualizationPanelProps) {
  // Idle state — instrument illustration
  if (!exercise || sessionState === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-600">
          <Music2 className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select an exercise to begin</p>
        </div>
      </div>
    )
  }

  const isPlaying = sessionState === 'playing'

  return (
    <div
      className={cn(
        'flex-1 flex flex-col relative rounded-xl overflow-hidden transition-shadow duration-150',
        edgeFlash && 'shadow-[inset_0_0_30px_rgba(59,130,246,0.15)]'
      )}
    >
      {/* Countdown overlay */}
      <AnimatePresence>
        {sessionState === 'countdown' && (
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
                  key={countdownBeat}
                  variants={countdownPop}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-8xl font-black text-white"
                  style={{
                    textShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(147,51,234,0.3)',
                  }}
                >
                  {countdownBeat || '...'}
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
              <motion.div
                key={`ring-${countdownBeat}`}
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

      {/* Main content: notation + HUD */}
      <div className={cn(
        'flex-1 grid gap-4',
        isPlaying ? 'grid-cols-1 xl:grid-cols-[1fr_200px]' : 'grid-cols-1'
      )}>
        {/* Notation */}
        <div className={cn(
          'min-h-0',
          sessionState === 'countdown' && 'opacity-40'
        )}>
          <NotationView
            exercise={exercise}
            eventResults={eventResults}
            playheadProgress={playheadProgress}
            isPlaying={isPlaying}
          />
        </div>

        {/* Live Score HUD — desktop */}
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="hidden xl:block"
          >
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/30 p-3">
              <LiveScoreHUD
                score={currentScore}
                combo={currentCombo}
                accuracy={currentAccuracy}
                tempoDrift={tempoDrift}
                lastHitGrade={lastHitGrade}
                inputLevel={inputLevel}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Mobile live score — compact */}
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between xl:hidden p-3 mt-2 bg-slate-900/60 backdrop-blur-sm rounded-lg border border-slate-700/30"
        >
          <div className="flex items-center gap-4 text-sm font-mono text-slate-200">
            <span>Score: {Math.round(currentScore)}%</span>
            <span className={cn(
              currentCombo >= 10 && 'text-orange-400',
              currentCombo >= 5 && currentCombo < 10 && 'text-yellow-400'
            )}>
              Combo: {currentCombo}x
            </span>
            <span>Acc: {Math.round(currentAccuracy)}%</span>
          </div>
          {lastHitGrade && (
            <span
              className="text-xs font-bold"
              style={{ color: GRADE_COLORS[lastHitGrade as HitGrade] }}
            >
              {GRADE_LABELS[lastHitGrade] || lastHitGrade}
            </span>
          )}
        </motion.div>
      )}
    </div>
  )
}
