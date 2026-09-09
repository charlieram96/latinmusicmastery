'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Eye, Maximize2, Minimize2, Music2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { lessonExerciseHeight } from '@/lib/playsense-studio/lesson-viewport'
import './exercise-mode.css'

/** Resize the existing lesson in place: no portal, second player, or session restart. */
export function ExerciseModeFrame({ title, hasVideo, hasScore, preview, onWatchDemo, children }: {
  title: string
  hasVideo: boolean
  hasScore: boolean
  preview: boolean
  onWatchDemo?: () => void
  children: ReactNode
}) {
  const [immersive, setImmersive] = useState(true)
  const [showVideo, setShowVideo] = useState(true)
  const [showScore, setShowScore] = useState(true)
  const frame = useRef<HTMLDivElement>(null)
  const modeButton = useRef<HTMLButtonElement>(null)
  const scrollPosition = useRef(0)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el || immersive) return
    const scroller = el.closest<HTMLElement>('[data-dashboard-main]')
    const lesson = el.closest<HTMLElement>('[data-lesson-shell]')
    const footer = lesson?.querySelector<HTMLElement>('[data-lesson-footer] > div')
    let pending = 0
    const measure = () => {
      pending = 0
      const visibleBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight)
      const bottom = Math.min(visibleBottom, scroller?.getBoundingClientRect().bottom ?? visibleBottom)
      const height = lessonExerciseHeight(bottom, el.getBoundingClientRect().top,
        scroller?.scrollTop ?? window.scrollY, footer?.getBoundingClientRect().height ?? 0)
      const value = `${height}px`
      if (el.style.getPropertyValue('--lesson-exercise-height') !== value) el.style.setProperty('--lesson-exercise-height', value)
    }
    const schedule = () => { if (!pending) pending = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    // Watch the surrounding layout as well as the viewport: titles may wrap,
    // navigation can expand, and lesson controls can change while playing.
    for (const target of [scroller, lesson?.querySelector('[data-lesson-heading]'), el.parentElement, footer]) {
      if (target) observer.observe(target)
    }
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    measure()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(pending)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [immersive])

  useEffect(() => {
    if (immersive) modeButton.current?.focus({ preventScroll: true })
    else {
      const scroller = frame.current?.closest('[data-dashboard-main]')
      if (scroller) scroller.scrollTop = scrollPosition.current
      modeButton.current?.focus({ preventScroll: true })
    }
  }, [immersive])

  useEffect(() => {
    if (!immersive) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Let an open settings menu or dialog handle its own Escape first.
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="menu"], [role="listbox"]')) return
      setImmersive(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [immersive])

  const toggleMode = () => {
    if (!immersive) scrollPosition.current = frame.current?.closest('[data-dashboard-main]')?.scrollTop ?? 0
    setImmersive(value => !value)
  }

  return <div ref={frame} className="ps-exercise-mode" data-exercise-immersive={immersive} data-video-visible={showVideo} data-score-visible={showScore}>
    <header className="ps-exercise-toolbar">
      <div className="ps-exercise-identity"><Image src="/logo-solo-color.svg" alt="Latin Music Mastery" width={32} height={24} /><div><span>PlaySense <i>/</i> {preview ? 'Lesson preview' : 'Exercise'}</span><h2 title={title}>{title}</h2></div></div>
      <div className="ps-exercise-view-controls" role="group" aria-label="Exercise view">
        {hasVideo && <Button type="button" variant="ghost" size="sm" onClick={() => setShowVideo(value => !value)} aria-pressed={showVideo} aria-label="Show instructor video"><Video size={16} /><span>Video</span></Button>}
        {hasScore && <Button type="button" variant="ghost" size="sm" onClick={() => setShowScore(value => !value)} aria-pressed={showScore} aria-label="Show musical score"><Music2 size={16} /><span>Score</span></Button>}
        {onWatchDemo && <Button type="button" variant="ghost" size="sm" className="ps-exercise-watch" onClick={onWatchDemo} aria-label="Watch demo"><Eye size={16} /><span>Watch demo</span></Button>}
        <Button ref={modeButton} type="button" variant="outline" size="sm" className="ps-exercise-mode-toggle" onClick={toggleMode} aria-label={immersive ? 'Exit exercise mode' : 'Enter exercise mode'} title={immersive ? 'Return to lesson view (Esc)' : 'Enter immersive exercise mode'}>
          {immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{immersive ? 'Lesson view' : 'Exercise mode'}</span>{immersive && <kbd>esc</kbd>}
        </Button>
      </div>
    </header>
    <div className="ps-exercise-content">{children}</div>
  </div>
}
