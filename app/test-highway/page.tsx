'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { HighwayApp } from '@/components/play-sense/rhythm-highway/HighwayApp'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { DEFAULT_NOTE_STYLE } from '@/components/play-sense/rhythm-highway/NoteManager'
import type { NoteStyle } from '@/components/play-sense/rhythm-highway/NoteManager'

const MOCK_EXERCISE: ExerciseDefinition = {
  id: 'preview',
  title: 'Tumbao Basico',
  description: 'Preview exercise',
  instrument: 'conga',
  bpm: 100,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 4,
  loopCount: 100,
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

const SLIDER_CONFIG: { key: keyof NoteStyle; label: string; min: number; max: number; step: number }[] = [
  { key: 'thickness', label: 'Puck Thickness', min: 0, max: 60, step: 1 },
  { key: 'topFaceAlpha', label: 'Top Face', min: 0, max: 1, step: 0.01 },
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
  { key: 'verticalEdgeAlpha', label: 'Vertical Edges', min: 0, max: 1, step: 0.01 },
  { key: 'dropShadowAlpha', label: 'Drop Shadow', min: 0, max: 1, step: 0.01 },
  { key: 'wingLineAlpha', label: 'Wing Lines', min: 0, max: 1, step: 0.01 },
  { key: 'pulseGlowAlpha', label: 'Pulse Glow', min: 0, max: 0.3, step: 0.005 },
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
  const [panelOpen, setPanelOpen] = useState(true)

  // Mount PixiJS
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

    return () => {
      mounted = false
      app?.destroy()
      appRef.current = null
    }
  }, [])

  // Sync note style to PixiJS
  useEffect(() => {
    const app = appRef.current
    if (app) app.noteStyle = noteStyle
  }, [noteStyle])

  // Animation loop
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
    if (!playingRef.current) {
      startTimeRef.current = Date.now()
      playingRef.current = true
      setPlaying(true)
    } else {
      playingRef.current = false
      setPlaying(false)
    }
  }, [])

  const triggerHit = useCallback((grade: HitGrade) => {
    const app = appRef.current
    if (!app) return
    const elapsed = ((Date.now() - startTimeRef.current) / 1000) * speed
    const progress = durationRef.current > 0 ? (elapsed % durationRef.current) / durationRef.current : 0
    const currentTime = progress * durationRef.current
    const eventIdx = Math.floor(currentTime / (60 / MOCK_EXERCISE.bpm)) % (MOCK_EXERCISE.events.length * MOCK_EXERCISE.loopCount)
    app.triggerHitEffect(eventIdx, grade)
  }, [speed])

  const triggerMiss = useCallback(() => {
    const app = appRef.current
    if (!app) return
    const elapsed = ((Date.now() - startTimeRef.current) / 1000) * speed
    const progress = durationRef.current > 0 ? (elapsed % durationRef.current) / durationRef.current : 0
    const currentTime = progress * durationRef.current
    const eventIdx = Math.floor(currentTime / (60 / MOCK_EXERCISE.bpm)) % (MOCK_EXERCISE.events.length * MOCK_EXERCISE.loopCount)
    app.triggerMiss(eventIdx)
  }, [speed])

  const updateStyle = (key: keyof NoteStyle, value: number) => {
    setNoteStyle(prev => ({ ...prev, [key]: value }))
  }

  const resetStyle = () => setNoteStyle({ ...DEFAULT_NOTE_STYLE })

  const copyStyle = () => {
    const code = JSON.stringify(noteStyle, null, 2)
    navigator.clipboard.writeText(code).catch(() => {})
  }

  return (
    <div className="h-screen w-screen bg-black flex">
      {/* Highway canvas */}
      <div ref={containerRef} className="flex-1 min-h-0" />

      {/* Note Style Sliders Panel */}
      <div className={`flex-shrink-0 transition-all duration-200 ${panelOpen ? 'w-72' : 'w-8'} bg-zinc-950 border-l border-zinc-800 flex flex-col relative`}>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute -left-6 top-4 w-6 h-12 bg-zinc-800 rounded-l flex items-center justify-center text-zinc-400 hover:text-white text-xs z-20"
        >
          {panelOpen ? '>' : '<'}
        </button>

        {panelOpen && (
          <>
            {/* Top controls bar */}
            <div className="p-3 border-b border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-[10px] font-mono tracking-wider flex-1">NOTE STYLE</span>
                <button onClick={resetStyle} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white">Reset</button>
                <button onClick={copyStyle} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white">Copy</button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex-1"
                >
                  {playing ? 'Pause' : 'Play'}
                </button>
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-1 rounded text-[10px] font-mono ${
                      speed === s ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => triggerHit('perfect')} className="flex-1 py-0.5 rounded text-[10px] bg-cyan-900/30 text-cyan-400">Perfect</button>
                <button onClick={() => triggerHit('good')} className="flex-1 py-0.5 rounded text-[10px] bg-green-900/30 text-green-400">Good</button>
                <button onClick={() => triggerHit('ok')} className="flex-1 py-0.5 rounded text-[10px] bg-yellow-900/30 text-yellow-400">OK</button>
                <button onClick={() => triggerMiss()} className="flex-1 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400">Miss</button>
              </div>
            </div>

            {/* Sliders */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {SLIDER_CONFIG.map(({ key, label, min, max, step }) => (
                <div key={key}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-zinc-500 text-[10px]">{label}</span>
                    <span className="text-zinc-400 text-[10px] font-mono">{noteStyle[key].toFixed(key === 'thickness' ? 0 : 2)}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={noteStyle[key]}
                    onChange={(e) => updateStyle(key, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
