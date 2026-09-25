'use client'

// The play view's layout now lives in the lesson workspace (SplitWorkspace).
// ExerciseScore still reads its placement through useExerciseWorkspace (it
// picks wrapped vs. single-line reading from it and offers a Left / Top /
// Right menu), so this module bridges that old shape onto the workspace
// controller until the score drops the menu.

import { createContext, useContext, useId, useMemo, type ReactNode } from 'react'
import type { WorkspaceController } from '@/components/playsense-studio/player/use-workspace-layout'
import type { WorkspaceLayout, WorkspaceState } from '@/lib/playsense-studio/workspace-layout'
import './exercise-workspace.css'

export type ScorePosition = 'left' | 'top' | 'right'

interface WorkspaceSettings {
  position: ScorePosition
  setPosition: (position: ScorePosition) => void
  stacked: boolean
  resetSize: () => void
  scoreId: string
}
const WorkspaceContext = createContext<WorkspaceSettings | null>(null)
export function useExerciseWorkspace() { return useContext(WorkspaceContext) }

/** Stacked reads as a single line (the old "top"); everything else keeps the wrapped reading. */
export function scorePositionFor(state: WorkspaceState, layout: WorkspaceLayout): ScorePosition {
  if (layout === 'stack') return 'top'
  return layout === 'side' && state.swap ? 'left' : 'right'
}

export function layoutForScorePosition(position: ScorePosition): Partial<WorkspaceState> {
  if (position === 'top') return { layout: 'stack', swap: false }
  return { layout: 'side', swap: position === 'left' }
}

export function ExerciseScoreWorkspaceBridge({ controller, children }: { controller: WorkspaceController; children: ReactNode }) {
  const scoreId = useId()
  const { state, layout, update, setLayout, defaults, beforeLayoutChangeRef } = controller
  const value = useMemo<WorkspaceSettings>(() => ({
    position: scorePositionFor(state, layout),
    setPosition: (position) => {
      const next = layoutForScorePosition(position)
      if (next.layout !== state.layout) setLayout(next.layout!)
      else beforeLayoutChangeRef.current?.()
      update({ swap: next.swap })
    },
    stacked: layout === 'stack',
    resetSize: () => update({ split: defaults.split, musicSplit: defaults.musicSplit }),
    scoreId,
  }), [state, layout, update, setLayout, defaults, beforeLayoutChangeRef, scoreId])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
