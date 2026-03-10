'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { getInstrumentLabel, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { staggerContainer, staggerItem, equalizerBar } from '@/lib/play-sense/animations'
import { Play, Music2, Volume2 } from 'lucide-react'

interface PlaylistViewProps {
  exercises: ExerciseDefinition[]
  selectedExercise: ExerciseDefinition | null
  isPlaying: boolean
  onSelect: (exercise: ExerciseDefinition) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Mini equalizer bars for the currently playing track
function EqualizerIcon() {
  return (
    <div className="flex items-end gap-[2px] h-3 w-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          variants={equalizerBar}
          initial="idle"
          animate="active"
          className="w-[3px] bg-primary rounded-full origin-bottom"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

const DIFFICULTY_DOT: Record<string, string> = {
  beginner: 'bg-emerald-400 shadow-[0_0_4px_hsl(142,69%,58%,0.4)]',
  intermediate: 'bg-amber-400 shadow-[0_0_4px_hsl(38,92%,50%,0.4)]',
  advanced: 'bg-rose-400 shadow-[0_0_4px_hsl(351,95%,71%,0.4)]',
}

export function PlaylistView({ exercises, selectedExercise, isPlaying, onSelect }: PlaylistViewProps) {
  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-4">
        <Music2 className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground text-center">No exercises yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Playlist header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Exercises
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground/60 bg-secondary/80 rounded-full px-2 py-0.5">
          {exercises.length}
        </span>
      </div>

      {/* Track list */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
      >
        {exercises.map((exercise, index) => {
          const isSelected = selectedExercise?.id === exercise.id
          const isCurrentlyPlaying = isSelected && isPlaying
          const duration = getExerciseDuration(exercise)

          return (
            <motion.div
              key={exercise.id}
              variants={staggerItem}
              onClick={() => onSelect(exercise)}
              className={cn(
                'group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150',
                'hover:bg-gradient-to-r hover:from-primary/[0.03] hover:to-transparent',
                isSelected && 'bg-primary/5 border-l-2 border-primary',
                !isSelected && 'border-l-2 border-transparent',
              )}
            >
              {/* Track number / play icon / equalizer */}
              <div className="w-6 flex items-center justify-center shrink-0">
                {isCurrentlyPlaying ? (
                  <EqualizerIcon />
                ) : (
                  <>
                    <span className={cn(
                      'text-xs font-mono tabular-nums group-hover:hidden',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                    <Play className={cn(
                      'w-3.5 h-3.5 hidden group-hover:block',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </>
                )}
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}>
                  {exercise.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted-foreground truncate">
                    {getInstrumentLabel(exercise.instrument)}
                  </span>
                  {exercise.audioUrl && (
                    <Volume2 className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>

              {/* Difficulty dot */}
              <div className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                DIFFICULTY_DOT[exercise.difficulty] || 'bg-muted-foreground'
              )} />

              {/* BPM */}
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-10 text-right shrink-0">
                {exercise.bpm}
              </span>

              {/* Duration */}
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 text-right shrink-0">
                {formatDuration(duration)}
              </span>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
