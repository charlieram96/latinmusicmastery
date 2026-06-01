'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { HighwayApp } from '@/components/play-sense/rhythm-highway/HighwayApp'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { DEFAULT_NOTE_STYLE } from '@/components/play-sense/rhythm-highway/NoteManager'
import type { NoteStyle } from '@/components/play-sense/rhythm-highway/NoteManager'
import { DEFAULT_FADE_STYLE, DEFAULT_CONGA_STYLE } from '@/components/play-sense/rhythm-highway/Highway'
import type { FadeStyle, CongaStyle } from '@/components/play-sense/rhythm-highway/Highway'

const MOCK_EXERCISE: ExerciseDefinition = {
  id: 'preview', title: 'Tumbao Basico', description: 'Preview exercise',
  instrument: 'conga', bpm: 100, timeSignature: [4, 4], swing: 0,
  difficulty: 'beginner', measures: 4, loopCount: 100,
  events: [
    { beat: 1, measure: 1, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 2, measure: 1, instrument: 'conga', technique: 'slap', hand: 'L', duration: 0.5, vexKey: 'a/4', accent: false, surface: 'quinto' },
    { beat: 2.5, measure: 1, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 3, measure: 1, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 4, measure: 1, instrument: 'conga', technique: 'slap', hand: 'R', duration: 0.5, vexKey: 'a/4', accent: true, surface: 'quinto' },
    { beat: 4.5, measure: 1, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 1, measure: 2, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 2, measure: 2, instrument: 'conga', technique: 'slap', hand: 'L', duration: 0.5, vexKey: 'a/4', accent: false, surface: 'quinto' },
    { beat: 3, measure: 2, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 3.5, measure: 2, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 4, measure: 2, instrument: 'conga', technique: 'slap', hand: 'R', duration: 0.5, vexKey: 'a/4', accent: true, surface: 'quinto' },
    { beat: 1, measure: 3, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 1.5, measure: 3, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 2, measure: 3, instrument: 'conga', technique: 'slap', hand: 'R', duration: 0.5, vexKey: 'a/4', accent: false, surface: 'quinto' },
    { beat: 3, measure: 3, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 4, measure: 3, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 4.5, measure: 3, instrument: 'conga', technique: 'slap', hand: 'L', duration: 0.5, vexKey: 'a/4', accent: true, surface: 'quinto' },
    { beat: 1, measure: 4, instrument: 'conga', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 2, measure: 4, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'tumba' },
    { beat: 2.5, measure: 4, instrument: 'conga', technique: 'slap', hand: 'R', duration: 0.5, vexKey: 'a/4', accent: false, surface: 'quinto' },
    { beat: 3, measure: 4, instrument: 'conga', technique: 'open', hand: 'L', duration: 0.5, vexKey: 'g/4', accent: false, surface: 'conga' },
    { beat: 4, measure: 4, instrument: 'conga', technique: 'slap', hand: 'R', duration: 0.5, vexKey: 'a/4', accent: true, surface: 'tumba' },
  ],
}

type Tab = 'notes' | 'congas' | 'fade'

interface SliderDef { key: string; label: string; min: number; max: number; step: number }

const NOTE_SLIDERS: SliderDef[] = [
  { key: 'thickness', label: 'Puck Thickness', min: 0, max: 60, step: 1 },
  { key: 'topFaceAlpha', label: 'Top Face', min: 0, max: 1, step: 0.01 },
  { key: 'topSheenAlpha', label: 'Top Sheen (cream)', min: 0, max: 1, step: 0.01 },
  { key: 'topRimGlowAlpha', label: 'Top Rim Glow', min: 0, max: 1, step: 0.01 },
  { key: 'topRimMainAlpha', label: 'Top Rim Main', min: 0, max: 1, step: 0.01 },
  { key: 'topRimWhiteAlpha', label: 'Top Rim White', min: 0, max: 1, step: 0.01 },
  { key: 'neonBloomAlpha', label: 'Neon Bloom', min: 0, max: 0.5, step: 0.01 },
  { key: 'bottomFaceAlpha', label: 'Bottom Face', min: 0, max: 1, step: 0.01 },
  { key: 'sideWallAlpha', label: 'Side Wall', min: 0, max: 1, step: 0.01 },
  { key: 'sideHighlightAlpha', label: 'Side Highlight (L)', min: 0, max: 0.5, step: 0.01 },
  { key: 'sideShadowAlpha', label: 'Side Shadow (R)', min: 0, max: 0.5, step: 0.01 },
  { key: 'topFaceShadowAlpha', label: 'Top Shadow on Side', min: 0, max: 1, step: 0.01 },
  { key: 'bottomRimAlpha', label: 'Bottom Rim Neon', min: 0, max: 1, step: 0.01 },
  { key: 'bottomRimWhiteAlpha', label: 'Bottom Rim White', min: 0, max: 1, step: 0.01 },
  { key: 'midFaceAlpha', label: 'Mid Face', min: 0, max: 1, step: 0.01 },
  { key: 'midRimAlpha', label: 'Mid Rim', min: 0, max: 1, step: 0.01 },
  { key: 'verticalEdgeAlpha', label: 'Vertical Edges', min: 0, max: 1, step: 0.01 },
  { key: 'dropShadowAlpha', label: 'Drop Shadow', min: 0, max: 1, step: 0.01 },
  { key: 'wingLineAlpha', label: 'Wing Lines', min: 0, max: 1, step: 0.01 },
  { key: 'pulseGlowAlpha', label: 'Pulse Glow', min: 0, max: 0.3, step: 0.005 },
]

const CONGA_SLIDERS: SliderDef[] = [
  { key: 'bodyWidth', label: 'Body Width (rx)', min: 20, max: 200, step: 1 },
  { key: 'bodyHeight', label: 'Body Height (ry)', min: 10, max: 100, step: 1 },
  { key: 'barrelHeight', label: 'Barrel Height', min: 0, max: 120, step: 1 },
  { key: 'barrelSideAlpha', label: 'Barrel Sides', min: 0, max: 1, step: 0.01 },
  { key: 'barrelBottomAlpha', label: 'Barrel Bottom', min: 0, max: 1, step: 0.01 },
  { key: 'barrelFillAlpha', label: 'Barrel Fill', min: 0, max: 1, step: 0.01 },
  { key: 'outerGlowAlpha', label: 'Outer Glow', min: 0, max: 1, step: 0.01 },
  { key: 'outerGlowStrokeAlpha', label: 'Outer Glow Stroke', min: 0, max: 1, step: 0.01 },
  { key: 'headSurfaceAlpha', label: 'Head Surface', min: 0, max: 1, step: 0.01 },
  { key: 'mainRimAlpha', label: 'Main Rim', min: 0, max: 1, step: 0.01 },
  { key: 'whiteRimAlpha', label: 'White Rim', min: 0, max: 1, step: 0.01 },
  { key: 'innerRingAlpha', label: 'Inner Ring', min: 0, max: 1, step: 0.01 },
  { key: 'centerDotAlpha', label: 'Center Dot', min: 0, max: 1, step: 0.01 },
]

const FADE_SLIDERS: SliderDef[] = [
  { key: 'solidExtend', label: 'Solid Extend', min: 0, max: 0.5, step: 0.01 },
  { key: 'fadeLength', label: 'Fade Length', min: 0, max: 0.5, step: 0.01 },
]

export default function TestHighwayPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HighwayApp | null>(null)
  const startTimeRef = useRef(0)
  const playingRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const durationRef = useRef(0)
  const [noteStyle, setNoteStyle] = useState<NoteStyle>({ ...DEFAULT_NOTE_STYLE })
  const [congaStyle, setCongaStyle] = useState<CongaStyle>({ ...DEFAULT_CONGA_STYLE })
  const [fadeStyle, setFadeStyle] = useState<FadeStyle>({ ...DEFAULT_FADE_STYLE })
  const [panelOpen, setPanelOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('notes')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let app: HighwayApp | null = null
    let mounted = true
    HighwayApp.create(container).then((instance) => {
      if (!mounted) { instance.destroy(); return }
      app = instance
      appRef.current = instance
      instance.init(MOCK_EXERCISE)
      durationRef.current = getExerciseDuration(MOCK_EXERCISE)
    }).catch(console.error)
    return () => { mounted = false; app?.destroy(); appRef.current = null }
  }, [])

  useEffect(() => { if (appRef.current) appRef.current.noteStyle = noteStyle }, [noteStyle])
  useEffect(() => { if (appRef.current) appRef.current.congaStyle = congaStyle }, [congaStyle])
  useEffect(() => { if (appRef.current) appRef.current.fadeStyle = fadeStyle }, [fadeStyle])

  useEffect(() => {
    let raf: number
    const tick = () => {
      const app = appRef.current
      if (app && playingRef.current && durationRef.current > 0) {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000) * speed
        const progress = (elapsed % durationRef.current) / durationRef.current
        app.playheadProgress = progress
        app.currentScore = Math.floor(elapsed * 50)
        app.currentCombo = Math.floor((elapsed % 20) * 3)
        app.currentAccuracy = 85 + Math.sin(elapsed * 0.5) * 10
        app.metronomeBeat = (elapsed / (60 / MOCK_EXERCISE.bpm)) % 1
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  const togglePlay = useCallback(() => {
    if (!playingRef.current) { startTimeRef.current = Date.now(); playingRef.current = true; setPlaying(true) }
    else { playingRef.current = false; setPlaying(false) }
  }, [])

  const triggerHit = useCallback((grade: HitGrade) => {
    const app = appRef.current; if (!app) return
    const idx = app.getClosestEventIndex()
    if (idx !== null) app.triggerHitEffect(idx, grade)
  }, [])

  const triggerMiss = useCallback(() => {
    const app = appRef.current; if (!app) return
    const idx = app.getClosestEventIndex()
    if (idx !== null) app.triggerMiss(idx)
  }, [])

  const currentStyles = tab === 'notes' ? noteStyle : tab === 'congas' ? congaStyle : fadeStyle
  const currentSliders = tab === 'notes' ? NOTE_SLIDERS : tab === 'congas' ? CONGA_SLIDERS : FADE_SLIDERS
  const updateStyle = (key: string, value: number) => {
    if (tab === 'notes') setNoteStyle(prev => ({ ...prev, [key]: value }))
    else if (tab === 'congas') setCongaStyle(prev => ({ ...prev, [key]: value }))
    else setFadeStyle(prev => ({ ...prev, [key]: value }))
  }
  const resetStyle = () => {
    if (tab === 'notes') setNoteStyle({ ...DEFAULT_NOTE_STYLE })
    else if (tab === 'congas') setCongaStyle({ ...DEFAULT_CONGA_STYLE })
    else setFadeStyle({ ...DEFAULT_FADE_STYLE })
  }
  const copyStyle = () => {
    navigator.clipboard.writeText(JSON.stringify(currentStyles, null, 2)).catch(() => {})
  }

  return (
    <div className="h-screen w-screen bg-black flex">
      <div ref={containerRef} className="flex-1 min-h-0" />

      <div className={`flex-shrink-0 transition-all duration-200 ${panelOpen ? 'w-72' : 'w-8'} bg-zinc-950 border-l border-zinc-800 flex flex-col relative`}>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute -left-6 top-4 w-6 h-12 bg-zinc-800 rounded-l flex items-center justify-center text-zinc-400 hover:text-white text-xs z-20"
        >
          {panelOpen ? '>' : '<'}
        </button>

        {panelOpen && (
          <>
            <div className="p-3 border-b border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button onClick={resetStyle} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white">Reset</button>
                <button onClick={copyStyle} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white">Copy</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex-1">
                  {playing ? 'Pause' : 'Play'}
                </button>
                {[0.5, 1, 2].map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`px-2 py-1 rounded text-[10px] font-mono ${speed === s ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                  >{s}x</button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => triggerHit('perfect')} className="flex-1 py-0.5 rounded text-[10px] bg-cyan-900/30 text-cyan-400">Perfect</button>
                <button onClick={() => triggerHit('good')} className="flex-1 py-0.5 rounded text-[10px] bg-green-900/30 text-green-400">Good</button>
                <button onClick={() => triggerHit('ok')} className="flex-1 py-0.5 rounded text-[10px] bg-yellow-900/30 text-yellow-400">OK</button>
                <button onClick={() => triggerMiss()} className="flex-1 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400">Miss</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-1">
                {(['notes', 'congas', 'fade'] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                      tab === t ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {currentSliders.map(({ key, label, min, max, step }) => {
                const value = (currentStyles as unknown as Record<string, number>)[key] ?? 0
                return (
                  <div key={`${tab}-${key}`}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-zinc-500 text-[10px]">{label}</span>
                      <span className="text-zinc-400 text-[10px] font-mono">
                        {max >= 2 ? value.toFixed(0) : value.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step} value={value}
                      onChange={(e) => updateStyle(key, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
