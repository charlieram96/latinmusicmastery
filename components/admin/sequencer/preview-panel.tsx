'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GlassHighway } from '@/components/play-sense/glass-highway'
import { VisualMetronome } from '@/components/play-sense/visual-metronome'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import type { UseAdminPlaybackResult } from '@/hooks/use-admin-playback'
import { Play, Square, Repeat, Volume2, VolumeX } from 'lucide-react'

interface PreviewPanelProps {
  exercise: ExerciseDefinition | null
  playback: UseAdminPlaybackResult
}

export function PreviewPanel({ exercise, playback }: PreviewPanelProps) {
  const [mode, setMode] = useState<'static' | 'animated'>('static')

  if (!exercise || exercise.events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-sm text-muted-foreground">
        Add notes in the sequencer to see the preview
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex rounded-lg bg-slate-800/50 p-0.5">
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === 'static' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setMode('static')}
          >
            Static
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === 'animated' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setMode('animated')}
          >
            Animated
          </button>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {exercise.bpm} BPM &middot; {exercise.events.length} notes
        </span>
      </div>

      {/* Canvas preview — the same PixiJS highway used in PlaySense */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-800/50 flex">
        <GlassHighway
          exercise={exercise}
          sessionState={mode === 'animated' && playback.isPlaying ? 'playing' : 'selecting'}
          playheadProgress={mode === 'animated' ? playback.playheadProgress : 0}
          currentScore={0}
          currentCombo={0}
          currentAccuracy={100}
          metronomeBeat={playback.currentBeat}
          eventResultsLength={0}
          eventResults={[]}
        />

        {/* Visual metronome overlay during animated playback */}
        {mode === 'animated' && playback.isPlaying && (
          <VisualMetronome
            beat={playback.currentBeat}
            isDownbeat={playback.isDownbeat}
          />
        )}
      </div>

      {/* Transport bar (animated mode) */}
      {mode === 'animated' && (
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant={playback.isPlaying ? 'destructive' : 'default'}
            size="sm"
            className="h-8"
            onClick={() => {
              if (playback.isPlaying) {
                playback.stop()
              } else if (exercise) {
                playback.play(exercise)
              }
            }}
          >
            {playback.isPlaying ? (
              <><Square className="w-3 h-3 mr-1" /> Stop</>
            ) : (
              <><Play className="w-3 h-3 mr-1" /> Play</>
            )}
          </Button>

          <Button
            variant={playback.loop ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => playback.setLoop(!playback.loop)}
          >
            <Repeat className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => playback.setMetronomeMuted(!playback.metronomeMuted)}
          >
            {playback.metronomeMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </Button>

          <span className="text-xs text-muted-foreground ml-auto">
            {exercise.bpm} BPM
          </span>
        </div>
      )}
    </div>
  )
}
