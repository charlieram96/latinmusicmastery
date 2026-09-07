'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Centre } from '@/lib/quiz/placement'
import { SNAP_STEP, clampPieceWidth, moveRect, resizeRect, snap as snapTo, type Handle, type Rect } from '@/lib/quiz/transform'

export type TransformSpec =
  | { mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; boxRatio?: number; onChange: (r: Rect) => void }
  | { mode: 'centre'; centre: Centre; onChange: (c: Centre) => void }
  | { mode: 'size'; width: number; onChange: (w: number) => void }

interface Session {
  spec: TransformSpec
  startX: number
  startY: number
  canvasW: number
  canvasH: number
  moved: boolean
}

/**
 * Pointer-capture drag sessions in canvas-percent space. Call `begin` from a
 * pointerdown on a box, sprite or handle; spread `handlers` on the canvas root
 * (the captured events bubble there). `onEnd(moved)` fires once per session.
 */
export function useCanvasTransform(canvasRef: React.RefObject<HTMLElement | null>, opts: { snap: boolean; onEnd?: (moved: boolean) => void }) {
  const session = useRef<Session | null>(null)
  const lastMoved = useRef(false)
  const step = opts.snap ? SNAP_STEP : null
  const onEnd = useRef(opts.onEnd)
  useEffect(() => {
    onEnd.current = opts.onEnd
  }, [opts.onEnd])

  const begin = useCallback(
    (e: React.PointerEvent, spec: TransformSpec) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // best-effort; the captured target stays mounted
      }
      const r = canvas.getBoundingClientRect()
      session.current = { spec, startX: e.clientX, startY: e.clientY, canvasW: r.width, canvasH: r.height, moved: false }
    },
    [canvasRef],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = session.current
      if (!s) return
      const dxPx = e.clientX - s.startX
      const dyPx = e.clientY - s.startY
      if (Math.abs(dxPx) + Math.abs(dyPx) > 3) s.moved = true
      if (!s.moved) return
      const dx = (dxPx / s.canvasW) * 100
      const dy = (dyPx / s.canvasH) * 100
      const { spec } = s
      if (spec.mode === 'move') spec.onChange(moveRect(spec.rect, dx, dy, step))
      else if (spec.mode === 'resize') spec.onChange(resizeRect(spec.rect, spec.handle ?? 'se', dx, dy, step, !!spec.keepRatio, spec.boxRatio))
      else if (spec.mode === 'centre') spec.onChange({ x: snapTo(spec.centre.x + dx, step), y: snapTo(spec.centre.y + dy, step) })
      else if (spec.mode === 'size') spec.onChange(clampPieceWidth(spec.width + dx))
    },
    [step],
  )

  const end = useCallback(() => {
    if (!session.current) return
    lastMoved.current = session.current.moved
    const moved = session.current.moved
    session.current = null
    onEnd.current?.(moved)
  }, [])

  const consumeClick = useCallback(() => {
    const moved = lastMoved.current
    lastMoved.current = false
    return moved
  }, [])

  return { begin, handlers: { onPointerMove, onPointerUp: end, onPointerCancel: end }, consumeClick }
}
