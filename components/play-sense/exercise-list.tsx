'use client'

import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { getInstrumentLabel, getDifficultyColor } from '@/lib/play-sense/exercise-utils'
import { staggerContainer, staggerItem, DIFFICULTY_BORDER } from '@/lib/play-sense/animations'
import { Play, Music } from 'lucide-react'

interface ExerciseListProps {
  exercises: ExerciseDefinition[]
  onSelect: (exercise: ExerciseDefinition) => void
}

export function ExerciseList({ exercises, onSelect }: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <div className="bg-card dark:bg-slate-900 rounded-2xl border border-border p-10 text-center">
        <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-foreground">No exercises available</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Check back soon for new percussion exercises.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid gap-3"
    >
      {exercises.map((exercise) => (
        <motion.div
          key={exercise.id}
          variants={staggerItem}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'group relative bg-card dark:bg-slate-900 rounded-xl border p-4 cursor-pointer',
            'transition-all duration-200',
            'hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-slate-950/50',
            'hover:border-muted-foreground/30',
            DIFFICULTY_BORDER[exercise.difficulty] || 'border-border'
          )}
          onClick={() => onSelect(exercise)}
        >
          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(59,130,246,0.04), transparent 40%)',
            }}
          />

          <div className="flex items-center justify-between relative">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">{exercise.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {exercise.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {getInstrumentLabel(exercise.instrument)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs border-current/20',
                    getDifficultyColor(exercise.difficulty)
                  )}
                >
                  {exercise.difficulty}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {exercise.bpm} BPM
                </span>
                <span className="text-xs text-muted-foreground">
                  {exercise.measures} bars
                  {exercise.loopCount > 1 ? ` x${exercise.loopCount}` : ''}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
