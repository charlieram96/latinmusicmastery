'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition, EventResult, SessionState, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { FretboardView } from './fretboard-view'
import { PianoKeyboardView } from './piano-keyboard-view'
import { ViolinFingerboardView } from './violin-fingerboard-view'
import type { Instrument } from '@/lib/play-sense/types'
import {
  countdownPop,
  gradeFloat,
  GRADE_LABELS,
} from '@/lib/play-sense/animations'
import { Music2, ChevronLeft } from 'lucide-react'
import { VisualMetronome } from './visual-metronome'
import { CongaView } from './conga-view'
import { PLAYSENSE_INSTRUMENTS } from '@/lib/play-sense/playsense-mappings'
import type { AudioMode } from '@/hooks/use-exercise-session'

interface VisualizationPanelProps {
  exercise: ExerciseDefinition | null
  sessionState: SessionState
  eventResults: EventResult[]
  playheadProgress: number
  countdownBeat: number
  floatingGrades: Array<{ grade: string; id: number }>
  edgeFlash: boolean
  metronomeBeat: number
  metronomeDownbeat: boolean
  detectedMidiNote?: number | null
  audioMode?: AudioMode | null
}

function getViewType(instrument: Instrument): 'fretboard' | 'piano' | 'violin' {
  if (instrument === 'piano') return 'piano'
  if (instrument === 'violin') return 'violin'
  return 'fretboard'
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
      className="absolute left-1/2 top-[75%] -translate-x-1/2 pointer-events-none z-20"
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

export function VisualizationPanel({
  exercise,
  sessionState,
  eventResults,
  playheadProgress,
  countdownBeat,
  floatingGrades,
  edgeFlash,
  metronomeBeat,
  metronomeDownbeat,
  detectedMidiNote,
  audioMode,
}: VisualizationPanelProps) {
  // Idle state — instrument illustration with glow
  if (!exercise || sessionState === 'idle') {
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

  const isPlaying = sessionState === 'playing'

  return (
    <div
      className={cn(
        'flex-1 flex flex-col relative overflow-hidden transition-shadow duration-150',
        edgeFlash && 'shadow-[inset_0_0_30px_hsl(30,85%,55%,0.12)]'
      )}
    >
      {/* Full-bleed fretboard with overlays */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Instrument visualization — fills entire panel */}
        <div className="flex-1 min-h-0">
          {(() => {
            // PlaySense mode: show drum visualization for supported instruments
            if (audioMode === 'playsense' && PLAYSENSE_INSTRUMENTS.has(exercise.instrument)) {
              return <CongaView instrument={exercise.instrument} isPlaying={isPlaying} />
            }
            const viewType = getViewType(exercise.instrument)
            const viewProps = { exercise, eventResults, playheadProgress, isPlaying, detectedMidiNote }
            if (viewType === 'piano') return <PianoKeyboardView {...viewProps} />
            if (viewType === 'violin') return <ViolinFingerboardView {...viewProps} />
            return <FretboardView {...viewProps} />
          })()}
        </div>

        {/* Visual metronome pulse */}
        {(sessionState === 'countdown' || sessionState === 'playing') && (
          <VisualMetronome beat={metronomeBeat} isDownbeat={metronomeDownbeat} />
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {sessionState === 'countdown' && (
            <motion.div
              key="countdown-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-background/60"
            >
              <div className="text-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={countdownBeat}
                    variants={countdownPop}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="text-8xl font-black text-foreground"
                    style={{
                      textShadow: '0 0 40px hsl(30,85%,55%,0.5), 0 0 80px hsl(14,52%,53%,0.3)',
                    }}
                  >
                    {countdownBeat || '...'}
                  </motion.p>
                </AnimatePresence>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-muted-foreground mt-4 tracking-widest uppercase"
                >
                  Get ready
                </motion.p>
                <motion.div
                  key={`ring-${countdownBeat}`}
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-amber-400/50"
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

        {/* Exercise context bar — overlaid top-left */}
        <div className="absolute top-2 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
          <span className="text-xs font-heading font-semibold text-foreground/60 tracking-wide drop-shadow-sm">{exercise.title}</span>
          <span className="text-xs font-mono text-muted-foreground/60 drop-shadow-sm">
            {exercise.bpm} BPM &middot; {exercise.timeSignature[0]}/{exercise.timeSignature[1]}
          </span>
        </div>

      </div>
    </div>
  )
}
