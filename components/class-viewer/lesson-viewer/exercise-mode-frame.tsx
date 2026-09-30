'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Eye, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { lessonExerciseHeight, lessonStageHeight } from '@/lib/playsense-studio/lesson-viewport'
import { useLessonFrame } from './lesson-mode/lesson-frame'
import './exercise-mode.css'

/** Resize the existing lesson in place: no portal, second player, or session restart.
 *  Showing or hiding the teacher video is the workspace's "music only" layout. */
export function ExerciseModeFrame({ title, hasScore, preview, onWatchDemo, children }: {
  title: string
  hasScore: boolean
  preview: boolean
  onWatchDemo?: () => void
  children: ReactNode
}) {
  const { t, locale } = useTranslation()
  const es = locale === 'es'
  // The lesson shell is already immersive: there the frame only fits the stage.
  const inLesson = !!useLessonFrame()
  const [immersive, setImmersive] = useState(!inLesson)
  const frame = useRef<HTMLDivElement>(null)
  const modeButton = useRef<HTMLButtonElement>(null)
  const scrollPosition = useRef(0)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el || immersive) return
    const scroller = el.closest<HTMLElement>('[data-dashboard-main]')
    const lesson = el.closest<HTMLElement>('[data-lesson-shell]')
    const footer = lesson?.querySelector<HTMLElement>('[data-lesson-footer] > div')
    // The L2 stage: its content (.lx-fill) pads the bottom; the frame fills the rest exactly.
    const fill = inLesson ? el.closest<HTMLElement>('.lx-fill') : null
    let pending = 0
    const measure = () => {
      pending = 0
      const visibleBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight)
      const bottom = Math.min(visibleBottom, scroller?.getBoundingClientRect().bottom ?? visibleBottom)
      const top = el.getBoundingClientRect().top
      const scrollTop = scroller?.scrollTop ?? window.scrollY
      const height = fill
        ? lessonStageHeight(bottom, top, scrollTop, parseFloat(getComputedStyle(fill).paddingBottom) || 0)
        : lessonExerciseHeight(bottom, top, scrollTop, footer?.getBoundingClientRect().height ?? 0)
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
  }, [immersive, inLesson])

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

  return <div ref={frame} className="ps-exercise-mode" data-exercise-immersive={immersive} data-lesson-mode={inLesson || undefined}>
    {!inLesson && <header className="ps-exercise-toolbar">
      <div className="ps-exercise-identity"><Image src="/logo-solo-color.svg" alt="Latin Music Mastery" width={48} height={36} /><div><span>PlaySense <i>/</i> {preview ? (es ? 'Vista previa del ejercicio' : 'Exercise preview') : (es ? 'Ejercicio' : 'Exercise')}</span><h2 title={title}>{title}</h2></div></div>
      <div className="ps-exercise-view-controls" role="group" aria-label={es ? 'Vista del ejercicio' : 'Exercise view'}>
        {onWatchDemo && <Button type="button" variant="ghost" size="sm" className="ps-exercise-watch" onClick={onWatchDemo} aria-label={t('dashboard.classViewer.exercise.watchTeacher')}><Eye size={16} /><span>{t('dashboard.classViewer.exercise.watchTeacher')}</span></Button>}
        <Button ref={modeButton} type="button" variant="outline" size="sm" className="ps-exercise-mode-toggle" onClick={toggleMode} aria-label={immersive ? (es ? 'Salir del modo ejercicio' : 'Exit exercise mode') : (es ? 'Entrar al modo ejercicio' : 'Enter exercise mode')} title={immersive ? (es ? 'Volver a la lección (Esc)' : 'Return to lesson view (Esc)') : (es ? 'Abrir ejercicio inmersivo' : 'Enter immersive exercise mode')}>
          {immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{immersive ? (es ? 'Ver lección' : 'Lesson view') : (es ? 'Modo ejercicio' : 'Exercise mode')}</span>{immersive && <kbd>esc</kbd>}
        </Button>
      </div>
    </header>}
    <div className="ps-exercise-content">{children}</div>
  </div>
}
