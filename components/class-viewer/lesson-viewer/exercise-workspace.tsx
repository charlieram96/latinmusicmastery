'use client'

// The play view's layout lives in the lesson workspace (SplitWorkspace), and
// the lesson action bar holds its layout switcher. ExerciseScore only reads its
// placement here: a side panel (vertical toolbar, fills the height) or a strip
// on top, plus the id the lesson links to.

import { createContext, useContext, useId, useMemo, type ReactNode } from 'react'
import type { WorkspaceController } from '@/components/playsense-studio/player/use-workspace-layout'
import type { WorkspaceLayout, WorkspaceState } from '@/lib/playsense-studio/workspace-layout'
import './exercise-workspace.css'

export type ScorePosition = 'left' | 'top' | 'right'

interface WorkspaceSettings {
  position: ScorePosition
  scoreId: string
}
const WorkspaceContext = createContext<WorkspaceSettings | null>(null)
export function useExerciseWorkspace() { return useContext(WorkspaceContext) }

/** Stacked reads as a single line (the old "top"); everything else keeps the wrapped reading. */
export function scorePositionFor(state: WorkspaceState, layout: WorkspaceLayout): ScorePosition {
  if (layout === 'stack') return 'top'
  return layout === 'side' && state.swap ? 'left' : 'right'
}

export function ExerciseScoreWorkspaceBridge({ controller, children }: { controller: WorkspaceController; children: ReactNode }) {
  const scoreId = useId()
  const { state, layout } = controller
  const value = useMemo<WorkspaceSettings>(() => ({
    position: scorePositionFor(state, layout),
    scoreId,
  }), [state, layout, scoreId])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
