'use client'

import { useCallback, useRef } from 'react'
import { SNAP_STEP, clampPieceWidth, moveRect, resizeRect, type Handle, type Rect } from '@/lib/quiz/transform'

export type TransformSpec =
  | { mode: 'move' | 'resize'; rect: Rect; handle?: Handle; keepRatio?: boolean; onChange: (r: Rect) => void }
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
 * pointerdown on a box or handle; spread `handlers` on the canvas root (the
 * captured events bubble there). Pattern from
 * components/playsense-studio/studio/editable-measure-strip.tsx.
 */
export function useCanvasTransform(canvasRef: React.RefObject<HTMLElement | null>, snap: boolean) {
  const session = useRef<Session | null>(null)
  const lastMoved = useRef(false)
  const step = snap ? SNAP_STEP : null

  const begin = useCallback(
    (e: React.PointerEvent, spec: TransformSpec) => {
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // capture is best-effort; window-level fallbacks are not needed because the captured target stays mounted
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
      const dx = (dxPx / s.canvasW) * 100
      const dy = (dyPx / s.canvasH) * 100
      const { spec } = s
      if (spec.mode === 'move') spec.onChange(moveRect(spec.rect, dx, dy, step))
      else if (spec.mode === 'resize') spec.onChange(resizeRect(spec.rect, spec.handle ?? 'se', dx, dy, step, !!spec.keepRatio))
      else if (spec.mode === 'size') spec.onChange(clampPieceWidth(spec.width + dx))
    },
    [step],
  )

  const end = useCallback(() => {
    lastMoved.current = !!session.current?.moved
    session.current = null
  }, [])

  const consumeClick = useCallback(() => {
    const moved = lastMoved.current
    lastMoved.current = false
    return moved
  }, [])

  return { begin, handlers: { onPointerMove, onPointerUp: end, onPointerCancel: end }, consumeClick }
}
