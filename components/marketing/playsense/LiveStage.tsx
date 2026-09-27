'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Drum, Piano } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { StageClip } from '@/components/marketing/site/StageClip'
import { backingPercussion } from '@/components/play-sense/stage-highway/band'
import { makeDemoExercise } from '@/lib/play-sense/demo-exercises'
import { generateExpectedTimestamps, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { computeStats } from '@/lib/play-sense/scoring'
import {
  DEMO_LEAD_IN, comboOf, createDemoSession, demoMeasure, frameDelta, resetDemoSession, stepDemoSession,
} from '@/lib/play-sense/demo-session'
import type { EventResult, Instrument } from '@/lib/play-sense/types'

// The 3D stage (three.js) only loads on the client, and only once the visitor scrolls near it.
const StageHighway = dynamic(() => import('@/components/play-sense/stage-highway/StageHighway').then(m => m.StageHighway), { ssr: false })

const INSTRUMENTS: Instrument[] = ['conga', 'timbale', 'piano']
const MEASURES = 4
const POP_EVERY = 4

type Mode = 'probe' | 'live' | 'clip'

function canRunLiveStage(): boolean {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/**
 * The real PlaySense Miami stage in demo mode, driven exactly like
 * /playsense-preview: a synthetic phrase, a rAF clock from the lead-in, every
 * note auto-graded perfect, looping. The HUD is HTML (the StageClip look) fed
 * by the live demo state. Falls back to the recorded clip without WebGL, under
 * reduced motion, or when the renderer reports an error.
 */
export function LiveStage() {
  const { t } = useTranslation()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.playsense.stage.${s}`, p)
  const c = (s: string, p?: Record<string, string | number>) => t(`marketing.site.stageClip.${s}`, p)
  const [mode, setMode] = useState<Mode>('probe')
  const [near, setNear] = useState(false)
  const [ready, setReady] = useState(false)
  const [lowQuality, setLowQuality] = useState(false)
  const [instrument, setInstrument] = useState<Instrument>('conga')
  const [take, setTake] = useState(0)
  const [results, setResults] = useState<EventResult[]>([])
  const [elapsed, setElapsed] = useState(DEMO_LEAD_IN)
  const box = useRef<HTMLDivElement>(null)
  const session = useRef(createDemoSession())
  const inView = useRef(false)

  const exercise = useMemo(() => makeDemoExercise(instrument), [instrument])
  const expected = useMemo(() => generateExpectedTimestamps(exercise), [exercise])
  const duration = getExerciseDuration(exercise)
  const latest = useRef({ expected, duration })
  useEffect(() => { latest.current = { expected, duration } }, [expected, duration])

  useEffect(() => {
    // Client-only capability probe; the first paint is the poster either way.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(canRunLiveStage() ? 'live' : 'clip')
    setLowQuality(matchMedia('(max-width: 767px)').matches)
  }, [])

  // Mount the stage once it is within 200px of the viewport; run the clock only while it is on screen.
  useEffect(() => {
    const el = box.current
    if (mode !== 'live' || !el) return
    const mount = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); mount.disconnect() } }, { rootMargin: '200px 0px' })
    const watch = new IntersectionObserver(es => { inView.current = es[es.length - 1].isIntersecting })
    mount.observe(el); watch.observe(el)
    return () => { mount.disconnect(); watch.disconnect() }
  }, [mode])

  useEffect(() => {
    if (mode !== 'live' || !near) return
    let raf = 0, last = 0, lastUI = 0
    const tick = (now: number) => {
      const dt = frameDelta(now, last)
      last = now
      if (inView.current && !document.hidden) {
        const step = stepDemoSession(session.current, dt, { ...latest.current, demo: true })
        if (step.looped) { setResults([]); setTake(n => n + 1) }
        else if (step.added.length) setResults(session.current.results)
        if (now - lastUI >= 50) { setElapsed(session.current.elapsed); lastUI = now }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, near])

  const pick = (next: Instrument) => {
    if (next === instrument) return
    resetDemoSession(session.current)
    setInstrument(next); setResults([]); setElapsed(DEMO_LEAD_IN); setTake(n => n + 1); setReady(false)
  }

  const label = (i: Instrument) => k(i === 'timbale' ? 'timbale' : i === 'piano' ? 'piano' : 'conga')
  const caption = <div className="stage-cap"><span>{k('caption', { exercise: exercise.title, instrument: label(mode === 'clip' ? 'conga' : instrument) })}</span><span>{k('hint')}</span></div>

  if (mode === 'clip') return <><StageClip />{caption}</>

  const stats = computeStats(results, 0, Math.max(0, elapsed))
  const combo = comboOf(results)
  const measure = demoMeasure(elapsed, exercise.bpm)
  const pop = combo > 0 && combo % POP_EVERY === 0 ? combo : 0
  const Icon = instrument === 'piano' ? Piano : instrument === 'timbale' ? Drum : null

  return (
    <>
      <div ref={box} className={`stage live-stage${ready ? ' is-ready' : ''}`} role="img" aria-label={k('label')}>
        {mode === 'live' && near && (
          <StageHighway
            exercise={exercise} attemptId={take} theme="studio" sessionState="playing"
            getElapsedSeconds={() => session.current.elapsed}
            playheadProgress={Math.max(0, elapsed) / duration}
            currentScore={stats.score} currentCombo={combo} currentAccuracy={stats.accuracy}
            metronomeBeat={Math.floor(Math.max(0, elapsed) * exercise.bpm / 60) % 4 + 1}
            eventResultsLength={results.length} eventResults={results}
            fill showHud={false} hideCountdown showThemePicker={false}
            quality={lowQuality ? 'low' : 'standard'}
            onStatus={s => { if (s === 'ready') setReady(true); else setMode('clip') }}
          />
        )}
        <div className="live-poster" aria-hidden="true">{!ready && near && <span className="live-loading">{k('loading')}</span>}</div>
        <div className="sh sh-tl" aria-hidden="true">
          <span className="sh-ic">
            {Icon ? <Icon strokeWidth={1.6} /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><ellipse cx="12" cy="6" rx="6" ry="2.2" /><path d="M6 6c0 5 1 9 2.5 14h7C17 15 18 11 18 6" /><path d="M7.5 11h9M8.5 16h7" /></svg>}
          </span>
          <div><small>{c('demoPerformance').toUpperCase()}</small><b>{exercise.title}</b><span>{k('meta', { bpm: exercise.bpm })}</span></div>
        </div>
        <div className="sh sh-tr" aria-hidden="true">
          <div className="sh-score">
            <div><span>{c('score')}</span><b>{Math.round(stats.score)}<small>/ 100</small></b></div>
            <div className="cb"><span>{c('combo')}</span><b>{combo}<small>{c('inARow')}</small></b></div>
            <div className="ac"><span>{c('accuracy')}</span><b>{results.length ? `${Math.round(stats.accuracy)}%` : '—'}</b></div>
          </div>
          <div className="sh-band"><small>{c('withBand').toUpperCase()}</small><b>{k('band', { percussion: label(backingPercussion(instrument)) })}</b></div>
        </div>
        <div key={pop} className={`sh-pop${pop ? ' show' : ''}`} aria-hidden="true">{c('perfect').toUpperCase()}</div>
        <div className="sh sh-bl" aria-hidden="true"><i />{c('simulated')}</div>
        <div className="sh sh-br" aria-hidden="true">
          <span className="meas">{Array.from({ length: MEASURES }, (_, i) => <i key={i} className={elapsed >= 0 && i < measure ? 'on' : ''} />)}</span>
          <span>{elapsed < 0 ? k('getReady') : c('measure', { n: measure, total: MEASURES })}</span>
        </div>
      </div>
      <div className="live-tools">
        <div className="seg" role="group" aria-label={k('instrument')}>
          {INSTRUMENTS.map(i => <button key={i} type="button" aria-pressed={i === instrument} onClick={() => pick(i)}>{label(i)}</button>)}
        </div>
      </div>
      {caption}
    </>
  )
}
