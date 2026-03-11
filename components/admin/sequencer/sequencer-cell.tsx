'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { Technique, Hand } from '@/lib/play-sense/types'
import { getTechniqueColor, getTechniqueLabel } from '@/lib/play-sense/fretboard-utils'

interface SequencerCellProps {
  active: boolean
  selected: boolean
  accent: boolean
  hand?: Hand
  technique: Technique
  isDownbeat: boolean
  isBeatStart: boolean
  zoom: number
  onMouseDown: () => void
  onMouseEnter: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export const SequencerCell = memo(function SequencerCell({
  active,
  selected,
  accent,
  hand,
  technique,
  isDownbeat,
  isBeatStart,
  zoom,
  onMouseDown,
  onMouseEnter,
  onContextMenu,
}: SequencerCellProps) {
  const size = Math.round(36 * zoom)
  const color = getTechniqueColor(technique)

  return (
    <div
      className={cn(
        'border border-slate-800/60 cursor-pointer transition-colors duration-75 flex items-center justify-center relative select-none',
        isDownbeat && 'border-l-2 border-l-slate-500',
        isBeatStart && !isDownbeat && 'border-l border-l-slate-600',
        active
          ? cn(
              'hover:brightness-110',
              selected && 'ring-2 ring-white ring-inset'
            )
          : 'bg-slate-900/50 hover:bg-slate-800/80',
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: active ? color : undefined,
        opacity: active ? (accent ? 1 : 0.75) : undefined,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
    >
      {active && (
        <>
          {accent && (
            <span className="absolute -top-0.5 right-0.5 text-[8px] font-bold text-white/90">&gt;</span>
          )}
          {hand === 'L' && (
            <span className="text-[9px] font-bold text-white/90">L</span>
          )}
        </>
      )}
    </div>
  )
})
