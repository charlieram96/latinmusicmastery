'use client'

// Fixed lesson footer: previous · mark complete · next.
// Offset from the left by the dashboard rail + course sidebar via CSS.

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markClassItemComplete } from '@/app/actions/progress'
import styles from './lesson-viewer.module.css'

interface LessonFooterProps {
  courseId: string
  classId: string
  currentIndex: number
  totalItems: number
  nextClassId: string | null
  activeItemId: string | null
  isCompleted: boolean
  nextLabel?: string | null
}

export function LessonFooter({
  courseId,
  classId,
  currentIndex,
  totalItems,
  nextClassId,
  activeItemId,
  isCompleted,
  nextLabel,
}: LessonFooterProps) {
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(isCompleted)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < totalItems - 1

  const prevHref = hasPrev
    ? `/dashboard/course/${courseId}/class/${classId}?item=${currentIndex - 1}`
    : null

  const nextHref = hasNext
    ? `/dashboard/course/${courseId}/class/${classId}?item=${currentIndex + 1}`
    : nextClassId
      ? `/dashboard/course/${courseId}/class/${nextClassId}`
      : null

  const nextText = hasNext ? 'Next' : nextClassId ? nextLabel || 'Next class' : null

  const handleComplete = async () => {
    if (!activeItemId || done) return
    setSaving(true)
    try {
      const result = await markClassItemComplete(activeItemId)
      if (result?.error) {
        alert('Failed to mark as complete. Please try again.')
      } else {
        setDone(true)
      }
    } catch {
      alert('An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        styles.footer,
        'fixed bottom-0 right-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-sunken/90 px-8 py-3 backdrop-blur-xl'
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] origin-left bg-primary transition-transform duration-300"
        style={{
          transform: `scaleX(${totalItems > 0 ? (currentIndex + 1) / totalItems : 0})`,
        }}
      />
      {prevHref ? (
        <Link
          href={prevHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Link>
      ) : (
        <span />
      )}

      <button
        onClick={handleComplete}
        disabled={saving || done || !activeItemId}
        className={cn(
          'inline-flex h-[42px] items-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          done
            ? 'cursor-default bg-success text-white'
            : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-60'
        )}
      >
        <Check className="h-3.5 w-3.5" />
        {done ? 'Completed' : saving ? 'Saving…' : 'Mark as completed'}
      </button>

      {nextHref ? (
        <Link
          href={nextHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {nextText} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}
