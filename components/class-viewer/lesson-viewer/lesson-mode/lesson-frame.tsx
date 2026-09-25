'use client'

// The lesson frame's shared state: the action bar's portal host, the claims
// parts make on it (a claim hides the lesson's own message and can tint the
// bar), and advance() — the lesson's "continue" (next part, the celebration,
// or the next lesson). Outside a lesson (previews, admin) there is no frame and
// <LessonAction> renders its children in place.

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type ActionTone = 'neutral' | 'success' | 'danger'

export interface LessonFrameValue {
  actionHost: HTMLElement | null
  /** Only the newest claim shows (a celebration over a finished quiz, say). */
  topClaim: string | null
  claim: (id: string, claim: { tone: ActionTone } | null) => void
  advance: () => void
  teacherName: string | null
  /** Inside a lesson but must not take over the action bar (see OutsideLessonFrame). */
  noClaim?: boolean
}

const FrameContext = createContext<LessonFrameValue | null>(null)

export function LessonFrameProvider({ value, children }: { value: LessonFrameValue; children: ReactNode }) {
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>
}

/** Content that must not claim the action bar (an exercise's follow-up questions sit under its game).
    It keeps the lesson's advance(), so finishing it still leads to the celebration. */
export function OutsideLessonFrame({ children }: { children: ReactNode }) {
  const frame = useContext(FrameContext)
  const value = useMemo(() => frame && { ...frame, noClaim: true }, [frame])
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>
}

export function useLessonFrame(): LessonFrameValue | null {
  return useContext(FrameContext)
}

/** Claims on the action bar, newest last; the newest claim sets the tone. */
export function useActionClaims() {
  const [claims, setClaims] = useState<[string, ActionTone][]>([])
  const claim = useCallback((id: string, next: { tone: ActionTone } | null) => {
    setClaims(prev => {
      const index = prev.findIndex(([key]) => key === id)
      if (!next) return index === -1 ? prev : prev.filter(([key]) => key !== id)
      if (index === -1) return [...prev, [id, next.tone]]
      if (prev[index][1] === next.tone) return prev
      const copy = prev.slice()
      copy[index] = [id, next.tone]
      return copy
    })
  }, [])
  return useMemo(() => ({
    claim,
    claimed: claims.length > 0,
    top: claims.at(-1)?.[0] ?? null,
    tone: (claims.at(-1)?.[1] ?? 'neutral') as ActionTone,
  }), [claim, claims])
}

/** A part's content for the action bar: message on the left, its actions on the right. */
export function LessonAction({ tone = 'neutral', className, children }: { tone?: ActionTone; className?: string; children: ReactNode }) {
  const frame = useLessonFrame()
  const id = useId()
  const claim = frame?.noClaim ? undefined : frame?.claim
  useLayoutEffect(() => { claim?.(id, { tone }) }, [claim, id, tone])
  useLayoutEffect(() => () => claim?.(id, null), [claim, id])
  if (!frame || frame.noClaim) return <div className={cn('lx-action-inline', className)} data-tone={tone}>{children}</div>
  return frame.actionHost && frame.topClaim === id ? createPortal(children, frame.actionHost) : null
}

/** Badge, bold line and detail — the left side of the action bar. */
export function ActionMessage({ icon, title, detail, live = false }: { icon: ReactNode; title: ReactNode; detail?: ReactNode; live?: boolean }) {
  return <div className="lx-msg" role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined} aria-atomic={live || undefined}>
    {icon != null && <span className="lx-msg-badge" aria-hidden>{icon}</span>}
    <div className="min-w-0">
      <b>{title}</b>
      {detail && <span className="lx-msg-detail">{detail}</span>}
    </div>
  </div>
}
