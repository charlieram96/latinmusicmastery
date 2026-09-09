'use client'

import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GripHorizontal, GripVertical } from 'lucide-react'
import { scorePanelBounds, scorePanelSize, type ScorePosition } from '@/lib/playsense-studio/exercise-layout'
import './exercise-workspace.css'

interface WorkspaceSettings {
  position: ScorePosition
  setPosition: (position: ScorePosition) => void
  stacked: boolean
  resetSize: () => void
  scoreId: string
}
const WorkspaceContext = createContext<WorkspaceSettings | null>(null)
export function useExerciseWorkspace() { return useContext(WorkspaceContext) }
export interface ExerciseWorkspaceLayout { position: ScorePosition; side: number; stacked: number }
export const DEFAULT_EXERCISE_LAYOUT: ExerciseWorkspaceLayout = { position: 'right', side: .4, stacked: .44 }

/** Grid placement changes in place, preserving the stage, video, and session. */
export function ExerciseWorkspace({ score, children, layout, onLayoutChange }: {
  score: ReactNode; children: ReactNode; layout: ExerciseWorkspaceLayout; onLayoutChange: (layout: ExerciseWorkspaceLayout) => void
}) {
  const position = layout.position
  const setPosition = (position: ScorePosition) => onLayoutChange({ ...layout, position })
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 })
  const [dragging, setDragging] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; start: number; size: number } | null>(null)
  const scoreId = useId()
  const stacked = dimensions.width < 760
  const axis = stacked ? 'stacked' : 'side'
  const bounds = scorePanelBounds(dimensions.width, dimensions.height, stacked)
  const size = scorePanelSize(layout[axis], bounds)
  const setSize = (next: number) => onLayoutChange({
    ...layout, [axis]: Math.max(bounds.min, Math.min(bounds.max, next)) / bounds.extent,
  })
  const resetSize = () => onLayoutChange({ ...DEFAULT_EXERCISE_LAYOUT, position })

  useEffect(() => {
    const el = root.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth, height = el.clientHeight
      setDimensions(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return <WorkspaceContext.Provider value={{ position, setPosition, stacked, resetSize, scoreId }}>
    <div ref={root} className="ps-exercise-workspace" data-score-position={score ? position : 'none'} data-score-stacked={stacked} data-resizing={dragging}
      style={{ '--score-panel-size': `${size}px` } as CSSProperties}>
      {score}
      {score && position !== 'top' && <div className="ps-score-resizer" role="separator" tabIndex={0}
        aria-label={stacked ? 'Resize score height' : 'Resize score width'} aria-controls={scoreId}
        aria-orientation={stacked ? 'horizontal' : 'vertical'} aria-valuemin={bounds.min} aria-valuemax={bounds.max} aria-valuenow={size}
        aria-valuetext={`${size} pixels`} title="Drag to resize · arrow keys to adjust · double-click to reset"
        onDoubleClick={resetSize}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus({ preventScroll: true })
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointerId: event.pointerId, start: stacked ? event.clientY : event.clientX, size }
          setDragging(true)
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return
          const delta = (stacked ? event.clientY : event.clientX) - drag.current.start
          setSize(drag.current.size + delta * (stacked || position === 'right' ? -1 : 1))
        }}
        onPointerUp={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          drag.current = null
          setDragging(false)
        }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
        onPointerCancel={() => { drag.current = null; setDragging(false) }}
        onKeyDown={event => {
          const positive = stacked ? 'ArrowUp' : position === 'left' ? 'ArrowRight' : 'ArrowLeft'
          const negative = stacked ? 'ArrowDown' : position === 'left' ? 'ArrowLeft' : 'ArrowRight'
          if (![positive, negative, 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const step = event.shiftKey ? 48 : 16
          setSize(event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : size + (event.key === positive ? step : -step))
        }}><span aria-hidden="true">{stacked ? <GripHorizontal size={16}/> : <GripVertical size={16}/>}</span><small aria-hidden="true">{dragging ? `${size}px` : 'Drag to resize'}</small></div>}
      {children}
    </div>
  </WorkspaceContext.Provider>
}
