'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition, SessionState } from '@/lib/play-sense/types'
import { getInstrumentLabel, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { SensitivitySettings } from './sensitivity-settings'
import { slideUp } from '@/lib/play-sense/animations'
import {
  Play,
  Square,
  Settings2,
  Headphones,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface NowPlayingBarProps {
  exercise: ExerciseDefinition
  sessionState: SessionState
  playheadProgress: number
  calibrationData: { latencyMs: number } | null
  noisyRoomMode: boolean
  inputLevel: number
  backingTrackLoading: boolean
  backingTrackLoaded: boolean
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

export function NowPlayingBar({
  exercise,
  sessionState,
  playheadProgress,
  calibrationData,
  noisyRoomMode,
  inputLevel,
  backingTrackLoading,
  backingTrackLoaded,
  onStart,
  onStop,
  onCalibrate,
  onNoisyRoomChange,
}: NowPlayingBarProps) {
  const totalDuration = getExerciseDuration(exercise)
  const elapsed = playheadProgress * totalDuration
  const isActive = sessionState === 'playing' || sessionState === 'countdown'

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-card/95 backdrop-blur-md border-t border-border"
    >
      {/* Progress bar — thin line at top of bar */}
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
        {/* Glow dot at progress head */}
        {sessionState === 'playing' && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_hsla(30,85%,55%,0.8)] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${playheadProgress * 100}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Left: exercise info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Album art placeholder */}
            <div className={cn(
              'w-10 h-10 rounded-md flex items-center justify-center shrink-0 transition-transform duration-300',
              isActive
                ? 'bg-gradient-to-br from-primary/20 to-[hsl(14,52%,53%)]/20 border border-primary/30'
                : 'bg-secondary border border-border'
            )}>
              {exercise.audioUrl ? (
                <Volume2 className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{exercise.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">{getInstrumentLabel(exercise.instrument)}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-border text-muted-foreground">
                  {exercise.difficulty}
                </Badge>
                <span className="text-[11px] text-muted-foreground font-mono">{exercise.bpm} BPM</span>
                {!exercise.audioUrl && (
                  <span className="text-[10px] text-muted-foreground">Metronome only</span>
                )}
              </div>
            </div>
          </div>

          {/* Center: controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Time elapsed */}
            {sessionState === 'playing' && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 text-right hidden sm:block">
                {formatTime(elapsed)}
              </span>
            )}

            {sessionState === 'selecting' && (
              <>
                <Button
                  onClick={onStart}
                  disabled={backingTrackLoading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white border-0 rounded-full h-9 w-9 p-0"
                >
                  {backingTrackLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </Button>
              </>
            )}

            {sessionState === 'countdown' && (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="border-border text-muted-foreground rounded-full h-9 w-9 p-0"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            )}

            {sessionState === 'playing' && (
              <Button
                onClick={onStop}
                size="sm"
                className="bg-secondary hover:bg-secondary/80 text-foreground border-0 rounded-full h-9 w-9 p-0"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* Time total */}
            {sessionState === 'playing' && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 hidden sm:block">
                {formatTime(totalDuration)}
              </span>
            )}
          </div>

          {/* Right: calibration + sensitivity */}
          <div className="flex items-center gap-3 shrink-0">
            {sessionState === 'selecting' && !calibrationData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCalibrate}
                className="text-muted-foreground hover:text-foreground h-8 text-xs hidden sm:flex"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1" />
                Calibrate
              </Button>
            )}

            {calibrationData && (
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">
                {calibrationData.latencyMs.toFixed(0)}ms
              </span>
            )}

            {(sessionState === 'selecting' || sessionState === 'playing') && (
              <div className="hidden md:block">
                <SensitivitySettings
                  noisyRoomMode={noisyRoomMode}
                  onNoisyRoomChange={onNoisyRoomChange}
                  inputLevel={inputLevel}
                />
              </div>
            )}

            {sessionState === 'selecting' && (
              <div className="flex items-center gap-1 text-muted-foreground sm:hidden">
                <Headphones className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
