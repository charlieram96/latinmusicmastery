'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from '@/components/language-provider'
import { videoPictureBounds } from '@/components/playsense-studio/shared/video-watermark'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { cascaraCue, cascaraNotation, type CoachingCue } from '@/lib/play-sense/cascara-coaching'
import './cascara-video-coaching.css'

export function CascaraVideoCoaching({ exercise, state, getElapsedSeconds, tempoRate, bar1, pausedSeconds }: {
  exercise: ExerciseDefinition; state: string; getElapsedSeconds: () => number; tempoRate: number; bar1: number; pausedSeconds: number
}) {
  const { locale } = useTranslation()
  const reducedMotion = useReducedMotion()
  const notation = useMemo(() => cascaraNotation(exercise), [exercise])
  const [notationFrame, setNotationFrame] = useState({ visible: false, active: -1 })
  const ref = useRef<HTMLDivElement>(null)
  const [cue, setCue] = useState<CoachingCue | null>(null)
  useEffect(() => {
    const layer = ref.current
    const parent = layer?.parentElement
    if (!layer || !parent) return
    let frame = 0
    let previous = ''
    let previousNotes = ''
    const tick = () => {
      const video = parent.querySelector('video')
      if (video?.videoWidth) {
        const box = video.getBoundingClientRect(), container = parent.getBoundingClientRect()
        const p = videoPictureBounds(box.width, box.height, video.videoWidth, video.videoHeight, getComputedStyle(video).objectFit)
        layer.style.left = `${box.left - container.left + p.x}px`
        layer.style.top = `${box.top - container.top + p.y}px`
        layer.style.width = `${p.width}px`
        layer.style.height = `${p.height}px`
        layer.style.visibility = 'visible'
      } else layer.style.visibility = 'hidden'
      // During pre-roll, track the actual picture/audio, including media startup latency.
      const seconds = state === 'paused' ? pausedSeconds : (state === 'countdown' || state === 'playing') && video && !video.paused ? video.currentTime - bar1 : getElapsedSeconds() * tempoRate
      const visible = (state === 'playing' || state === 'paused') && seconds >= 0 && seconds < notation.end
      const active = visible ? notation.notes.findLastIndex(note => seconds >= note.seconds && seconds < note.seconds + Math.min(.22, notation.beat * .42)) : -1
      const notesKey = `${visible}:${active}`
      if (notesKey !== previousNotes) { previousNotes = notesKey; setNotationFrame({ visible, active }) }
      const next = visible ? null : cascaraCue(exercise, seconds, state, locale === 'es')
      const key = next ? JSON.stringify(next) : 'none'
      if (key !== previous) { previous = key; setCue(next) }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [exercise, state, getElapsedSeconds, tempoRate, bar1, locale, pausedSeconds, notation])

  return <div ref={ref} className="lmm-coaching" style={{ visibility: 'hidden' }}>
    <AnimatePresence>
    {cue && <motion.div key={cue.kind === 'count' ? 'count' : cue.key}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : cue.kind === 'count' ? .12 : .65 }} className={`lmm-coaching-card lmm-coaching-${cue.kind}`}>
      <div className="lmm-coaching-eyebrow">{cue.detail}</div>
      {cue.number !== undefined ? <div className="lmm-coaching-count-row">
        <strong className="lmm-coaching-number">{cue.number}</strong>
        <div><span className="lmm-coaching-ready">{cue.text}</span><div className="lmm-coaching-dots" aria-hidden="true">
          {Array.from({ length: exercise.timeSignature[0] }, (_, i) => <i key={i} data-active={i + 1 === cue.number} />)}
        </div></div>
      </div> : <div className="lmm-coaching-title font-heading">{cue.text}</div>}
    </motion.div>}
    </AnimatePresence>
    <AnimatePresence>
      {notationFrame.visible && <motion.div className="lmm-cascara-notation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .65 }}>
        <div className="lmm-coaching-eyebrow">{locale === 'es' ? 'CÁSCARA 2–3 · MANO DERECHA' : 'CÁSCARA 2–3 · RIGHT HAND'}</div>
        <div className="lmm-cascara-caption font-heading">{locale === 'es' ? 'Sigue las notas' : 'Follow the notes'}</div>
        <svg viewBox="0 0 460 170" role="img" aria-label={locale === 'es' ? 'Cuatro compases de cáscara: cada golpe ilumina su nota' : 'Four bars of cáscara: each hit lights its note'}>
          {[0, 1, 2, 3].map(bar => {
            const x = 12 + (bar % 2) * 224, y = 51 + Math.floor(bar / 2) * 80
            return <g key={bar}>
              <path d={`M${x} ${y}h212 M${x} ${y - 10}v20 M${x + 212} ${y - 10}v20`} className="lmm-cascara-staff" />
              <text x={x + 3} y={y - 32} className="lmm-cascara-bar">{bar + 1}</text>
              {Array.from({ length: exercise.timeSignature[0] }, (_, i) => <text key={i} x={x + 17 + i * 47} y={y + 24} className="lmm-cascara-beat">{i + 1}</text>)}
              {Array.from({ length: exercise.timeSignature[0] * 2 }, (_, i) => {
                const beat = 1 + i / 2
                const silent = !notation.notes.some(note => note.measure === bar + 1 && beat >= note.beat && beat < note.beat + note.duration - .001)
                const restX = x + 17 + (beat - 1) * 47
                return silent ? <g key={`rest-${i}`} className="lmm-cascara-rest"><circle cx={restX - 3} cy={y - 7} r="3" /><path d={`M${restX - 3} ${y - 7}q6 5 9 -3l-7 23`} /></g> : null
              })}
              {notation.notes.map((note, index) => note.measure === bar + 1 && <g key={note.id} className="lmm-cascara-note" data-lit={notationFrame.active === index}>
                <ellipse cx={x + 17 + (note.beat - 1) * 47} cy={y} rx="5.2" ry="3.7" transform={`rotate(-20 ${x + 17 + (note.beat - 1) * 47} ${y})`} />
                <path d={`M${x + 22 + (note.beat - 1) * 47} ${y}v-27`} />
                {(note.duration === 1.5 || note.duration === .75) && <circle cx={x + 27 + (note.beat - 1) * 47} cy={y - 3} r="1.8" />}
                {note.duration < 1 && <path d={`M${x + 22 + (note.beat - 1) * 47} ${y - 27}q15 7 5 18`} />}
              </g>)}
            </g>
          })}
        </svg>
      </motion.div>}
    </AnimatePresence>
  </div>
}
