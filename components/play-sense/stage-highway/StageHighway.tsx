'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, RotateCcw, Sparkles } from 'lucide-react'
import type { ExerciseDefinition, HitGrade, SessionState } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import type { StageRenderer } from './StageRenderer'
import type { StageFrame } from './model'
import { useStageTheme } from './use-stage-theme'
import { STAGE_THEMES, STAGE_THEME_IDS, type StageThemeId } from './themes'
import { PerformanceHud } from '../performance-hud'
import { StageLoading } from './stage-loading'
import './highway.css'

export interface StageHighwayProps {
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
}

export function StageHighway(props: StageHighwayProps) {
  const { exercise, sessionState, currentScore, currentCombo, currentAccuracy, countdownBeat,
    dimAlpha = 0, showHud = true, hideCountdown = false, fill = false, showThemePicker = true } = props
  const [selectedTheme, setSelectedTheme] = useStageTheme()
  const theme = props.theme ?? selectedTheme
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
    let renderer: StageRenderer | undefined
    setReady(false); setError(null)
    import('./StageRenderer').then(({ StageRenderer }) => {
      if (disposed) return
      renderer = new StageRenderer(host, exercise, {
        theme,
        explore: props.explore,
        quality: lowQuality ? 'low' : props.quality ?? 'standard',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onError: message => { if (!disposed) setError(message) },
        readFrame: (): StageFrame => {
          const p = latest.current
          const running = p.sessionState === 'playing' || p.sessionState === 'countdown'
          return {
            elapsed: running ? (p.getElapsedSeconds?.() ?? p.playheadProgress * getExerciseDuration(p.exercise)) : -2,
            showNotes: true, playing: p.sessionState === 'playing',
            results: running || p.sessionState === 'results' ? p.eventResults : [],
            attempt: p.attemptId ?? attempt.current, combo: p.currentCombo,
          }
        },
      })
      if (!disposed) setReady(true)
    }).catch(() => {
      if (!disposed) setError('This browser could not open the 3D stage. Try compatibility mode or a browser with hardware acceleration enabled.')
    })
    return () => { disposed = true; renderer?.destroy() }
  }, [exercise, theme, retry, lowQuality, props.quality, props.explore])

  const lastResult = props.eventResults[props.eventResults.length - 1]
  return (
    <div className={`ps-highway ${fill ? 'ps-highway-fill' : ''}`} style={{ '--ps-accent': STAGE_THEMES[theme].accent } as React.CSSProperties}>
      <div ref={container} className="ps-highway-canvas" />
      {showThemePicker && STAGE_THEME_IDS.length > 1 && !props.theme && <div className="ps-theme-picker" role="group" aria-label="Stage appearance">
        {STAGE_THEME_IDS.map(id => <button type="button" key={id} aria-pressed={theme === id} onClick={() => setSelectedTheme(id)}>{STAGE_THEMES[id].name}</button>)}
      </div>}
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
