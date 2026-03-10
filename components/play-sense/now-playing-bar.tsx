'use client'

import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition, SessionState, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { getInstrumentLabel, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { GRADE_LABELS, scaleIn, comboFire, GRADE_GLOW } from '@/lib/play-sense/animations'
import { slideUp } from '@/lib/play-sense/animations'
import {
  Play,
  Square,
  Settings2,
  Loader2,
  Volume2,
  VolumeX,
  Flame,
  Mic,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface NowPlayingBarProps {
  exercise: ExerciseDefinition
  sessionState: SessionState
  playheadProgress: number
  calibrationData: { latencyMs: number } | null
  noisyRoomMode: boolean
  inputLevel: number
  backingTrackLoading: boolean
  backingTrackLoaded: boolean
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  lastHitGrade: string | null
  onStart: () => void
  onStop: () => void
  onCalibrate: () => void
  onNoisyRoomChange: (enabled: boolean) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function AnimatedNumber({ value, isActive }: { value: number; isActive: boolean }) {
  const spring = useSpring(0, { stiffness: 120, damping: 20 })
  const display = useTransform(spring, (v) => `${Math.round(v)}%`)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isActive) {
      spring.set(value)
    } else {
      spring.set(0)
    }
  }, [value, isActive, spring])

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      if (ref.current) ref.current.textContent = v
    })
    return unsubscribe
  }, [display])

  return <span ref={ref}>{isActive ? `${Math.round(value)}%` : '--'}</span>
}

export function NowPlayingBar({
  exercise,
  sessionState,
  playheadProgress,
  calibrationData,
  noisyRoomMode,
  inputLevel,
  backingTrackLoading,
  backingTrackLoaded,
  currentScore,
  currentCombo,
  currentAccuracy,
  lastHitGrade,
  onStart,
  onStop,
  onCalibrate,
  onNoisyRoomChange,
}: NowPlayingBarProps) {
  const totalDuration = getExerciseDuration(exercise)
  const elapsed = playheadProgress * totalDuration
  const isActive = sessionState === 'playing' || sessionState === 'countdown'
  const isPlaying = sessionState === 'playing'

  const comboColor = isPlaying && currentCombo >= 10
    ? 'text-orange-400'
    : isPlaying && currentCombo >= 5
      ? 'text-yellow-400'
      : 'text-foreground'

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-card/95 backdrop-blur-md border-t border-border"
    >
      {/* Progress bar — unchanged */}
      <div className="h-1 w-full bg-secondary relative group cursor-pointer">
        <motion.div
          className="h-full rounded-r-full"
          style={{
            background: 'linear-gradient(90deg, hsl(30,85%,55%), hsl(14,52%,53%), hsl(38,58%,58%))',
            width: `${(sessionState === 'playing' ? playheadProgress : 0) * 100}%`,
            boxShadow: sessionState === 'playing' ? '0 2px 8px hsl(30,85%,55%,0.3)' : 'none',
          }}
          transition={{ duration: 0.1 }}
        />
        {sessionState === 'playing' && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_hsla(30,85%,55%,0.8)] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${playheadProgress * 100}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>

      {/* ─── Three-Column Layout ─── */}
      <div className="flex flex-col sm:flex-row items-stretch">

        {/* ── Left Column — Play + Song ── */}
        <div className="shrink-0 px-4 py-3 flex items-center gap-4 sm:w-[270px] md:w-[310px]">
          {/* Play/Stop button — large & prominent */}
          <div className="shrink-0">
            {sessionState === 'selecting' && (
              <Button
                onClick={onStart}
                disabled={backingTrackLoading}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white border-0 rounded-full h-12 w-12 p-0 shadow-lg shadow-primary/30"
              >
                {backingTrackLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>
            )}

            {sessionState === 'countdown' && (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="border-border text-muted-foreground rounded-full h-12 w-12 p-0"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
              </Button>
            )}

            {sessionState === 'playing' && (
              <Button
                onClick={onStop}
                size="sm"
                className="bg-secondary hover:bg-secondary/80 text-foreground border-0 rounded-full h-12 w-12 p-0"
              >
                <Square className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Song info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate leading-tight">{exercise.title}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">{getInstrumentLabel(exercise.instrument)}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-border text-muted-foreground">
                {exercise.difficulty}
              </Badge>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground font-mono">{exercise.bpm} BPM</span>
            </div>
            {sessionState === 'playing' && (
              <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums mt-0.5 block">
                {formatTime(elapsed)} / {formatTime(totalDuration)}
              </span>
            )}
          </div>
        </div>

        {/* ── Center Column — Hero Stats (widest) ── */}
        <motion.div
          className="flex-1 min-w-0 py-3 px-4 sm:px-6 bg-secondary/30 flex items-center justify-center"
          animate={{ opacity: isPlaying ? 1 : 0.4 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-6 sm:gap-10 md:gap-14">
            {/* Score — largest */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                Score
              </span>
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-heading text-foreground tabular-nums">
                <AnimatedNumber value={currentScore} isActive={isPlaying} />
              </span>
            </div>

            {/* Combo */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                Combo
              </span>
              <motion.div
                className="flex items-center gap-1"
                variants={comboFire}
                animate={isPlaying && currentCombo >= 5 ? 'active' : 'idle'}
                key={currentCombo}
              >
                <span className={cn(
                  'text-xl sm:text-2xl md:text-3xl font-black font-mono tabular-nums',
                  comboColor
                )}>
                  {isPlaying ? `${currentCombo}x` : '--'}
                </span>
                {currentCombo >= 5 && isPlaying && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    <Flame className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5',
                      currentCombo >= 10 ? 'text-orange-400' : 'text-yellow-400'
                    )} />
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Accuracy */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                Accuracy
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl font-bold font-heading text-foreground tabular-nums">
                <AnimatedNumber value={currentAccuracy} isActive={isPlaying} />
              </span>
            </div>

            {/* Grade badge */}
            <AnimatePresence mode="wait">
              {isPlaying && lastHitGrade && (
                <motion.div
                  key={lastHitGrade}
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{
                    color: GRADE_COLORS[lastHitGrade as HitGrade],
                    backgroundColor: `${GRADE_COLORS[lastHitGrade as HitGrade]}15`,
                    boxShadow: GRADE_GLOW[lastHitGrade] || 'none',
                  }}
                >
                  {GRADE_LABELS[lastHitGrade] || lastHitGrade}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Right Column — Settings ── */}
        <div className="shrink-0 px-4 py-3 sm:w-[360px] md:w-[380px] hidden sm:flex flex-col justify-center gap-2.5">
          {/* Calibrate */}
          {!calibrationData ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCalibrate}
              className="text-muted-foreground hover:text-foreground h-8 text-xs px-3 w-full justify-start"
            >
              <Settings2 className="w-4 h-4 mr-2 shrink-0" />
              Calibrate
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-3 h-8">
              <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Latency</span>
              <span className="text-xs font-mono text-foreground ml-auto">{calibrationData.latencyMs.toFixed(0)}ms</span>
            </div>
          )}

          {/* Noisy room toggle */}
          <div className="flex items-center gap-2 px-3 h-8">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Noisy Room</span>
            <div className="ml-auto">
              <Switch
                checked={noisyRoomMode}
                onCheckedChange={onNoisyRoomChange}
              />
            </div>
          </div>

          {/* Mic level meter */}
          <div className="flex items-center gap-2 px-3 h-8">
            <Mic className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Mic</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.min(inputLevel * 500, 100)}%`,
                  backgroundColor:
                    inputLevel * 500 > 80 ? '#ef4444' :
                    inputLevel * 500 > 50 ? '#eab308' : '#22c55e',
                }}
              />
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
