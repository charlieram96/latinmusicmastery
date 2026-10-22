'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import { flushSync } from 'react-dom'
import { observePresentationFrames } from '@/lib/playsense-studio/presentation-frame-clock'
import { Sparkles } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { spokenCountAt } from '@/lib/playsense-studio/ritmo-spoken-counts'
import { RitmoHeritage } from './ritmo-heritage'
import { PercussionStaff } from './percussion-staff-cue'
import { percussionStaffAt } from '@/lib/playsense-studio/percussion-staff'
import { HandCoordinationGrid } from './hand-coordination-cue'
import { handCoordinationAt } from '@/lib/playsense-studio/hand-coordination'
import { VocalRhythmCue } from './vocal-rhythm-cue'
import { vocalRhythmAt } from '@/lib/playsense-studio/cascara-paso-presentation'
import { ReferencePresentationCue } from './reference-presentation-cue'
import { lessonPresentationFor, presentationCuesAt, presentationProgress, type LessonPresentation } from '@/lib/playsense-studio/lesson-presentation'
import { measureVideoLocalBounds } from '@/lib/playsense-studio/video-local-bounds'
import { videoPictureBounds } from './video-watermark'
import './lesson-presentation.css'

/** Shared by student, studio and score/video stages; no separate playback clock. */
export function LessonPresentationOverlay({ src }: { src: string }) {
  const presentation = lessonPresentationFor(src)
  return presentation ? <Presentation key={src} presentation={presentation} src={src} /> : null
}

function Presentation({ presentation, src }: { presentation: LessonPresentation; src: string }) {
  const root = useRef<HTMLDivElement>(null)
  const { locale } = useTranslation()
  const lang = locale === 'es' ? 'es' : 'en'
  const reduced = useReducedMotion()
  const [enabled, setEnabled] = useState(true)
  const [time, setTime] = useState(0)
  const [picture, setPicture] = useState<CSSProperties>({ visibility: 'hidden' })
  useEffect(() => {
    const parent = root.current?.parentElement
    const video = parent?.querySelector('video')
    if (!parent || !video) return
    // Commit in the decoded-frame callback before the browser paints that frame.
    // timeupdate/currentTime can precede or follow the actual picture by a frame.
    const stopFrames = observePresentationFrames(video, seconds => {
      flushSync(() => setTime(seconds))
    })
    const resize = () => {
      const v = measureVideoLocalBounds(video, parent)
      const box = videoPictureBounds(v.width, v.height, video.videoWidth, video.videoHeight, getComputedStyle(video).objectFit)
      setPicture({ left: v.left + box.x, top: v.top + box.y, width: box.width, height: box.height, visibility: box.width ? 'visible' : 'hidden' })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(video); observer.observe(parent)
    video.addEventListener('loadedmetadata', resize)
    resize()
    return () => {
      stopFrames(); observer.disconnect()
      video.removeEventListener('loadedmetadata', resize)
    }
  }, [])
  const cues = enabled ? presentationCuesAt(presentation, time) : []
  const vocal = enabled ? vocalRhythmAt(presentation.vocalRhythms ?? [], time) : null
  const hands = enabled ? handCoordinationAt(presentation.handCoordination ?? [], time) : null
  const staff = enabled ? percussionStaffAt(presentation.percussionStaff ?? [], time) : null
  const spoken = enabled ? spokenCountAt(presentation.spokenCounts ?? [], time) : null
  return <div ref={root} className="lmm-presentation" style={picture} data-presentation={presentation.id}>
    {presentation.cues.some(cue => cue.kind === 'son-influence' || cue.kind === 'son-oriente') &&
      // Warm the text mask before its first cut; no image fetch on entrance.
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/local-course-assets/son-influence/parchment.png" alt="" aria-hidden style={{ display: 'none' }} />}
    <button type="button" className="lmm-presentation-toggle"  aria-pressed={enabled}
      aria-label={lang === 'es' ? 'Animaciones de la lección' : 'Lesson animations'}
      title={lang === 'es' ? 'Mostrar u ocultar animaciones' : 'Show or hide animations'}
      onClick={() => setEnabled(value => !value)}><Sparkles size={14} aria-hidden /><span>{lang === 'es' ? 'Animaciones' : 'Animations'}</span><span aria-hidden>{enabled ? '✓' : '—'}</span></button>
    {staff && <PercussionStaff cue={staff.cue} slot={staff.slot} lang={lang} />}
    {hands && <HandCoordinationGrid cue={hands.cue} slot={hands.slot} lang={lang} />}
    {vocal && <VocalRhythmCue phrase={vocal} time={time} lang={lang} reduced={Boolean(reduced)} />}
    {spoken && <div className="lmm-spoken-count" data-spoken-count={spoken.beat.number} role="img" aria-label={`${lang === 'es' ? 'Cuenta' : 'Count'}: ${spoken.beat.number}`}>
      {[1,2,3,4].map(number => <span key={number} className={spoken.beat.number === number ? 'is-current' : ''} aria-hidden>{number}</span>)}
    </div>}
    {cues.map(cue => {
      const enter = presentationProgress(time, cue.start)
      const exit = presentationProgress(cue.end - time, 0, .45)
      return <div key={cue.id} className={`lmm-presentation-cue lmm-presentation-${cue.kind}`} data-cue={cue.id}
      style={{ opacity: reduced || (cue.kind === 'son-influence' || cue.kind === 'son-oriente') ? 1 : Math.min(enter, exit), transform: undefined }}>
      {cue.kind === 'heritage' || cue.kind === 'instrument' ? <RitmoHeritage cue={cue} lang={lang} time={time} src={src} /> : <ReferencePresentationCue cue={cue} lang={lang} time={time} reduced={Boolean(reduced)} />}
    </div>})}
  </div>
}
