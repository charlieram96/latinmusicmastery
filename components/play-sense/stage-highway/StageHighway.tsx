'use client'

import { useTranslation } from '@/components/language-provider'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, RotateCcw, Sparkles } from 'lucide-react'
import type { ExerciseDefinition, HitGrade, SessionState } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import type { StageRenderer } from './StageRenderer'
import { createStageModel, type StageFrame } from './model'
import { percussionLaneId } from '@/lib/play-sense/percussion-lanes'
import { useLaneOrder, useHiddenInstruments } from './use-lane-order'
import { InstrumentLayout } from './instrument-layout'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { CITY_CELEBRATIONS, STAGE_CITIES, type StageCity } from './cities'
import { useStageCity } from './use-stage-city'
import { useStageTheme } from './use-stage-theme'
import { STAGE_THEMES, STAGE_THEME_IDS, type StageThemeId } from './themes'
import { PerformanceHud } from '../performance-hud'
import { StageLoading } from './stage-loading'
import './highway.css'

export interface StageHighwayProps {
  layoutScope?: 'admin' | 'student'
  exercise: ExerciseDefinition
  sessionState: SessionState
  playheadProgress: number
  /** Read the audio clock on the GPU frame, bypassing React scheduling. */
  getElapsedSeconds?: () => number
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  metronomeBeat: number
  countdownBeat?: number
  eventResultsLength: number
  eventResults: Array<{ eventIndex: number; grade: HitGrade }>
  dimAlpha?: number
  showHud?: boolean
  hideCountdown?: boolean
  fill?: boolean
  theme?: StageThemeId
  showThemePicker?: boolean
  quality?: 'standard' | 'low'
  /** Preview-only orbit view. Lessons retain the fixed, readable performance camera. */
  explore?: boolean
  /** Reset judgments between preview takes without rebuilding the GPU scene. */
  attemptId?: number
  /** Told when the 3D scene is up or has failed, e.g. so an embed can swap a poster or fall back. */
  onStatus?: (status: 'ready' | 'error') => void
}

export function StageHighway(props: StageHighwayProps) {
  const { exercise, sessionState, currentScore, currentCombo, currentAccuracy, countdownBeat,
    dimAlpha = 0, showHud = true, hideCountdown = false, fill = false, showThemePicker = true } = props
  const {locale}=useTranslation()
  const [city, setCity] = useStageCity()
  const [selectedTheme, setSelectedTheme] = useStageTheme()
  const theme = props.theme ?? selectedTheme
  const [hiddenInstruments, setHiddenInstruments] = useHiddenInstruments(exercise.instrument,props.layoutScope ?? 'student')
  const [laneOrder, setLaneOrder] = useLaneOrder(exercise.instrument,props.layoutScope ?? 'student')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [lowQuality, setLowQuality] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const previousState = useRef(sessionState)
  const attempt = useRef(0)
  useEffect(() => {
    if (previousState.current !== sessionState && (sessionState === 'selecting' || sessionState === 'countdown')) attempt.current++
    previousState.current = sessionState
    latest.current = props
  })

  useEffect(() => {
    const host = container.current
    if (!host) return
    let disposed = false
    let renderer: Pick<StageRenderer, 'destroy'> | undefined
    setReady(false); setError(null)
    // Every instrument shares the same Three.js environment and rendering path.
    const rendererModule = import('./StageRenderer').then(module=>module.StageRenderer)
    rendererModule.then(async (Renderer) => {
      await document.fonts.load('64px LMMStageNotation')
      if (disposed) return
      renderer = new Renderer(host, exercise, {
        theme,
        city,
        laneOrder,
        hiddenInstruments,
        locale,
        explore: props.explore,
        quality: lowQuality ? 'low' : props.quality ?? 'standard',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onError: message => { if (!disposed) { setError(message); latest.current.onStatus?.('error') } },
        readFrame: (): StageFrame => {
          const p = latest.current
          const running = p.sessionState === 'playing' || p.sessionState === 'countdown' || p.sessionState === 'paused'
          return {
            elapsed: running ? (p.getElapsedSeconds?.() ?? p.playheadProgress * getExerciseDuration(p.exercise)) : -2,
            showNotes: true, playing: p.sessionState === 'playing',
            results: running || p.sessionState === 'results' ? p.eventResults : [],
            attempt: p.attemptId ?? attempt.current, combo: p.currentCombo,
          }
        },
      })
      if (!disposed) { setReady(true); latest.current.onStatus?.('ready') }
    }).catch(() => {
      if (!disposed) { setError('This browser could not open the 3D stage. Try compatibility mode or a browser with hardware acceleration enabled.'); latest.current.onStatus?.('error') }
    })
    return () => { disposed = true; renderer?.destroy() }
  }, [exercise, laneOrder, hiddenInstruments, locale, city, theme, retry, lowQuality, props.quality, props.explore])

  const lanes = useMemo(()=>createStageModel(exercise,laneOrder,locale).lanes,[exercise,laneOrder,locale])
  const celebration = CITY_CELEBRATIONS[city]
  const celebrationLocale = locale === 'es' ? 'es' : 'en'
  const lastResult = props.eventResults[props.eventResults.length - 1]
  return (
    <div className={`ps-highway ${fill ? 'ps-highway-fill' : ''}`} style={{ '--ps-accent': STAGE_THEMES[theme].accent } as React.CSSProperties}>
      <div ref={container} className="ps-highway-canvas" />
      {ready && exercise.instrument==='timbale' && <div key={city} className={`ps-city-sky-sign ps-city-sky-sign-${city}`} aria-hidden="true">
        <i className="ps-sky-burst ps-sky-burst-left" /><i className="ps-sky-burst ps-sky-burst-right" />
        <strong>{celebration.title[celebrationLocale]}</strong><span>{celebration.line[celebrationLocale]}</span>
      </div>}
      {<label className="ps-city-picker">{locale==='es'?'Ciudad':'City'}<select aria-label={locale==='es'?'Ciudad del escenario':'Stage city'} value={city} disabled={sessionState==='playing'||sessionState==='countdown'} onChange={event=>setCity(event.target.value as StageCity)}>{STAGE_CITIES.map(item=><option key={item.id} value={item.id}>{locale==='es'?item.es:item.en}</option>)}</select></label>}
      {showThemePicker && STAGE_THEME_IDS.length > 1 && !props.theme && <div className="ps-theme-picker" role="group" aria-label="Stage appearance">
        {STAGE_THEME_IDS.map(id => <button type="button" key={id} aria-pressed={theme === id} onClick={() => setSelectedTheme(id)}>{STAGE_THEMES[id].name}</button>)}
      </div>}
      {getInstrumentCategory(exercise.instrument) === 'percussion' && <InstrumentLayout hidden={hiddenInstruments} onVisibilityChange={setHiddenInstruments} scoreInstruments={exercise.events.map(percussionLaneId)} lanes={lanes} disabled={sessionState==='playing'||sessionState==='countdown'} onChange={setLaneOrder} />}
      {showHud && <div className="ps-game-scoreboard"><PerformanceHud score={currentScore} combo={currentCombo} accuracy={currentAccuracy}
        hasResults={props.eventResults.length > 0} playing={sessionState === 'playing'} compact /></div>}
      {showHud && sessionState === 'playing' && lastResult && <div key={`${lastResult.eventIndex}:${lastResult.grade}`} className={`ps-judgment ps-judgment-${lastResult.grade}`}>{lastResult.grade === 'ok' ? 'Keep going' : lastResult.grade}</div>}
      {dimAlpha > 0 && <div className="ps-highway-dim" style={{ opacity: dimAlpha }} />}
      {sessionState === 'countdown' && !hideCountdown && <div className="ps-countdown"><span>Find your rhythm</span><strong key={countdownBeat}>{countdownBeat || 'Ready'}</strong></div>}
      {!ready && !error && <StageLoading />}
      {error && <div className="ps-stage-message" role="alert"><Activity size={28} /><p>{error}</p><button type="button" onClick={() => { setLowQuality(true); setRetry(n => n + 1) }}><RotateCcw size={16} /> Try compatibility mode</button></div>}
      {ready && sessionState === 'selecting' && dimAlpha === 0 && <div className="ps-stage-ready"><Sparkles size={14} /> Stage ready</div>}
    </div>
  )
}
