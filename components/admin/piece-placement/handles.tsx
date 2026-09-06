'use client'

import { cn } from '@/lib/utils'
import { HANDLES, type Handle } from '@/lib/quiz/transform'

const POS: Record<Handle, string> = {
  nw: '-left-1.5 -top-1.5 cursor-nwse-resize',
  n: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-1.5 -top-1.5 cursor-nesw-resize',
  e: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-right-1.5 -bottom-1.5 cursor-nwse-resize',
  s: 'left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize',
  sw: '-left-1.5 -bottom-1.5 cursor-nesw-resize',
  w: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
}

/** Eight resize handles for an absolutely positioned box. `tone="neutral"` is used for image layers. */
export function Handles({ onDown, tone = 'primary' }: { onDown: (e: React.PointerEvent, handle: Handle) => void; tone?: 'primary' | 'neutral' }) {
  return (
    <>
      {HANDLES.map((h) => (
        <span
          key={h}
          data-handle={h}
          onPointerDown={(e) => onDown(e, h)}
          className={cn(
            'absolute z-[3] h-[11px] w-[11px] rounded-[3px] border-[1.5px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]',
            tone === 'primary' ? 'border-primary' : 'border-foreground',
            POS[h],
          )}
        />
      ))}
    </>
  )
}
