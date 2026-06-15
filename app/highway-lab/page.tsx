'use client'

// Highway Lab — local review + tuning bench for the Obsidian Glass highway.
// Three demo instruments (congas 3 lanes / timbales 6 / piano 88 keys),
// transport, hit simulation incl. autoplay, width presets, and live sliders
// bound 1:1 to GlassStyle.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ExerciseDefinition, ExerciseEvent, HitGrade, Instrument, Technique } from '@/lib/play-sense/types'
import { GlassApp } from '@/components/play-sense/glass-highway/GlassApp'
import { DEFAULT_GLASS_STYLE, type GlassStyle } from '@/components/play-sense/glass-highway/style'
import { getExerciseDuration, generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'

// ── Demo content ──────────────────────────────────────────────────────────

function congaEvent(beat: number, measure: number, technique: Technique, surface: string, accent = false): ExerciseEvent {
  return { beat, measure, instrument: 'conga', technique, hand: 'R', duration: 0.5, vexKey: 'g/4', accent, surface }
}

const CONGA_EXERCISE: ExerciseDefinition = {
  id: 'lab-conga', title: 'Tumbao Básico', description: 'Lab demo',
  instrument: 'conga', bpm: 100, timeSignature: [4, 4], swing: 0,
  difficulty: 'beginner', measures: 4, loopCount: 100,
  events: [
    congaEvent(1, 1, 'open', 'tumba'), congaEvent(2, 1, 'slap', 'quinto'), congaEvent(2.5, 1, 'open', 'conga'),
    congaEvent(3, 1, 'open', 'tumba'), congaEvent(4, 1, 'slap', 'quinto', true), congaEvent(4.5, 1, 'open', 'conga'),
    congaEvent(1, 2, 'open', 'conga'), congaEvent(2, 2, 'slap', 'quinto'), congaEvent(3, 2, 'open', 'tumba'),
    congaEvent(3.5, 2, 'open', 'conga'), congaEvent(4, 2, 'slap', 'quinto', true),
    congaEvent(1, 3, 'open', 'tumba'), congaEvent(1.5, 3, 'open', 'conga'), congaEvent(2, 3, 'slap', 'quinto'),
    congaEvent(3, 3, 'open', 'tumba'), congaEvent(4, 3, 'open', 'conga'), congaEvent(4.5, 3, 'slap', 'quinto', true),
    congaEvent(1, 4, 'open', 'conga'), congaEvent(2, 4, 'open', 'tumba'), congaEvent(2.5, 4, 'slap', 'quinto'),
    congaEvent(3, 4, 'open', 'conga'), congaEvent(4, 4, 'slap', 'tumba', true),
  ],
}

function timbaleEvent(beat: number, measure: number, surface: string, accent = false): ExerciseEvent {
  return { beat, measure, instrument: 'timbale', technique: 'open', hand: 'R', duration: 0.5, vexKey: 'g/4', accent, surface }
}

const TIMBALE_EXERCISE: ExerciseDefinition = {
  id: 'lab-timbale', title: 'Cáscara con Campana', description: 'Lab demo',
  instrument: 'timbale', bpm: 96, timeSignature: [4, 4], swing: 0,
  difficulty: 'intermediate', measures: 2, loopCount: 100,
  events: [
    // cáscara pattern + campana downbeats + fills across all six surfaces
    timbaleEvent(1, 1, 'cascara'), timbaleEvent(1, 1, 'campana', true), timbaleEvent(1.5, 1, 'cascara'),
    timbaleEvent(2.5, 1, 'cascara'), timbaleEvent(3, 1, 'campana'), timbaleEvent(3, 1, 'cascara'),
    timbaleEvent(4, 1, 'cascara'), timbaleEvent(4.5, 1, 'jamblock'),
    timbaleEvent(1, 2, 'cascara'), timbaleEvent(1, 2, 'campana', true), timbaleEvent(2, 2, 'macho'),
    timbaleEvent(2.5, 2, 'macho'), timbaleEvent(3, 2, 'hembra'), timbaleEvent(3.5, 2, 'cascara'),
    timbaleEvent(4, 2, 'cencerro'), timbaleEvent(4.5, 2, 'hembra', true),
  ],
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function midiName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function pianoEvent(beat: number, measure: number, midi: number, chordId?: string): ExerciseEvent {
  return {
    beat, measure, instrument: 'piano' as Instrument, technique: 'open', hand: 'R',
    duration: 0.5, vexKey: 'g/4', accent: false,
    expectedPitch: midi, expectedNoteName: midiName(midi), chordId,
  }
}

// Montuno-ish demo: low tumbao bass, mid chords, sparkling top runs — spreads
// across the keyboard so the 88-key layout proves itself.
const PIANO_EXERCISE: ExerciseDefinition = {
  id: 'lab-piano', title: 'Montuno en Do', description: 'Lab demo',
  instrument: 'piano', bpm: 104, timeSignature: [4, 4], swing: 0,
  difficulty: 'intermediate', measures: 2, loopCount: 100,
  events: [
    // M1 — C major
    pianoEvent(1, 1, 36), pianoEvent(1, 1, 60, 'c1'), pianoEvent(1, 1, 64, 'c1'), pianoEvent(1, 1, 67, 'c1'),
    pianoEvent(1.5, 1, 55), pianoEvent(2, 1, 60), pianoEvent(2.5, 1, 64),
    pianoEvent(3, 1, 43), pianoEvent(3, 1, 67), pianoEvent(3.5, 1, 72),
    pianoEvent(4, 1, 76), pianoEvent(4.5, 1, 79),
    // M2 — F / G turn
    pianoEvent(1, 2, 29), pianoEvent(1, 2, 57, 'f1'), pianoEvent(1, 2, 60, 'f1'), pianoEvent(1, 2, 65, 'f1'),
    pianoEvent(1.5, 2, 53), pianoEvent(2, 2, 58), pianoEvent(2.5, 2, 60),
    pianoEvent(3, 2, 31), pianoEvent(3, 2, 59), pianoEvent(3.5, 2, 63),
    pianoEvent(4, 2, 67), pianoEvent(4.5, 2, 82),
  ],
}

const EXERCISES = {
  congas: CONGA_EXERCISE,
  timbales: TIMBALE_EXERCISE,
  piano: PIANO_EXERCISE,
} as const

type InstrumentKey = keyof typeof EXERCISES

// ── Tuning sliders ────────────────────────────────────────────────────────

interface SliderDef { key: keyof GlassStyle; label: string; min: number; max: number; step: number }
interface SliderGroup { title: string; sliders: SliderDef[] }

const SLIDER_GROUPS: SliderGroup[] = [
  {
    title: 'Timing',
    sliders: [
      { key: 'approachSec', label: 'Fall time (s)', min: 1, max: 6, step: 0.1 },
      { key: 'hitLineFraction', label: 'Hit line position', min: 0.6, max: 0.92, step: 0.01 },
    ],
  },
  {
    title: 'Notes',
    sliders: [
      { key: 'noteAspect', label: 'Note height', min: 0.2, max: 0.6, step: 0.01 },
      { key: 'trailLength', label: 'Trail length', min: 0, max: 16, step: 0.5 },
      { key: 'trailAlpha', label: 'Trail glow', min: 0, max: 1, step: 0.01 },
      { key: 'reflectionAlpha', label: 'Reflection', min: 0, max: 0.6, step: 0.01 },
      { key: 'reflectionFalloff', label: 'Reflection reach', min: 0.1, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Perfect splash',
    sliders: [
      { key: 'splashDropletCount', label: 'Droplets', min: 4, max: 32, step: 1 },
      { key: 'splashSpeed', label: 'Eject speed', min: 100, max: 900, step: 10 },
      { key: 'splashGravity', label: 'Gravity', min: 300, max: 3000, step: 50 },
      { key: 'flashAlpha', label: 'Flash', min: 0, max: 1, step: 0.01 },
      { key: 'mistAlpha', label: 'Mist', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Good crack',
    sliders: [
      { key: 'chunkCount', label: 'Chunks', min: 2, max: 8, step: 1 },
      { key: 'chunkSpeed', label: 'Spread speed', min: 40, max: 400, step: 10 },
    ],
  },
  {
    title: 'Miss',
    sliders: [
      { key: 'missShakeAmp', label: 'Shake amount', min: 0, max: 10, step: 0.5 },
      { key: 'missShakeFreq', label: 'Shake speed', min: 5, max: 80, step: 1 },
      { key: 'missSinkAlpha', label: 'Sink dimness', min: 0.1, max: 1, step: 0.01 },
      { key: 'rippleAlpha', label: 'Glass ripple', min: 0, max: 1, step: 0.01 },
      { key: 'redGlowAlpha', label: 'Red seep', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Scene',
    sliders: [
      { key: 'laneLineAlpha', label: 'Lane lines', min: 0, max: 1, step: 0.01 },
      { key: 'hitLineGlowAlpha', label: 'Hit line glow', min: 0, max: 1, step: 0.01 },
      { key: 'hitLineShimmerSpeed', label: 'Shimmer speed', min: 0, max: 8, step: 0.1 },
      { key: 'glassSheenAlpha', label: 'Glass sheen', min: 0, max: 0.4, step: 0.005 },
      { key: 'glareAlpha', label: 'Glare', min: 0, max: 0.3, step: 0.005 },
      { key: 'glareSpeed', label: 'Glare period (s)', min: 2, max: 16, step: 0.5 },
      { key: 'dustCount', label: 'Dust', min: 0, max: 40, step: 1 },
      { key: 'dustAlpha', label: 'Dust glow', min: 0, max: 1, step: 0.01 },
      { key: 'bgGlowAlpha', label: 'Stage halo', min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Receptors',
    sliders: [
      { key: 'padFillAlpha', label: 'Pad fill', min: 0, max: 0.5, step: 0.01 },
      { key: 'padStrokeAlpha', label: 'Pad stroke', min: 0, max: 1, step: 0.01 },
      { key: 'padFlashAlpha', label: 'Pad flash', min: 0, max: 1, step: 0.01 },
      { key: 'keyLightAlpha', label: 'Key light', min: 0, max: 1, step: 0.01 },
    ],
  },
]

const WIDTH_PRESETS = [
  { label: 'Full', width: null },
  { label: 'Drawer', width: 480 },
  { label: 'Card', width: 360 },
  { label: 'Phone', width: 320 },
] as const

/** Weighted random autoplay grade — mostly perfect so the stage feels alive. */
function randomGrade(): HitGrade | 'miss' {
  const r = Math.random()
  if (r < 0.5) return 'perfect'
  if (r < 0.75) return 'good'
  if (r < 0.85) return 'ok'
  return 'miss'
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HighwayLabPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<GlassApp | null>(null)
  const startTimeRef = useRef(0)
  const playingRef = useRef(false)
  const speedRef = useRef(1)
  const autoplayRef = useRef(false)
  const autoPointerRef = useRef(0)
  const expectedRef = useRef<Array<{ eventIndex: number; timestamp: number }>>([])
  const durationRef = useRef(0)

  const [instrument, setInstrument] = useState<InstrumentKey>('congas')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [autoplay, setAutoplay] = useState(false)
  const [showHud, setShowHud] = useState(true)
  const [stageWidth, setStageWidth] = useState<number | null>(null)
  const [style, setStyle] = useState<GlassStyle>({ ...DEFAULT_GLASS_STYLE })
  const [panelOpen, setPanelOpen] = useState(true)

  const exercise = useMemo(() => EXERCISES[instrument], [instrument])

  // (Re)create the app when exercise or HUD mode changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let app: GlassApp | null = null
    let mounted = true
    playingRef.current = false
    setPlaying(false)
    autoPointerRef.current = 0
    expectedRef.current = generateExpectedTimestamps(exercise).map((e) => ({
      eventIndex: e.eventIndex, timestamp: e.timestamp,
    }))
    GlassApp.create(container, { showHud }).then((instance) => {
      if (!mounted) { instance.destroy(); return }
      app = instance
      appRef.current = instance
      instance.init(exercise)
      durationRef.current = getExerciseDuration(exercise)
    }).catch(console.error)
    return () => { mounted = false; app?.destroy(); appRef.current = null }
  }, [exercise, showHud])

  // Live style sync
  useEffect(() => {
    if (appRef.current) appRef.current.style = style
  }, [style])

  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { autoplayRef.current = autoplay }, [autoplay])

  // Playhead + autoplay loop
  useEffect(() => {
    let raf: number
    let scoreAcc = 0
    let comboAcc = 0
    const tick = () => {
      const app = appRef.current
      if (app && playingRef.current && durationRef.current > 0) {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000) * speedRef.current
        app.playheadProgress = elapsed / durationRef.current
        app.metronomeBeat = elapsed / (60 / exercise.bpm)

        if (autoplayRef.current) {
          const expected = expectedRef.current
          while (
            autoPointerRef.current < expected.length &&
            expected[autoPointerRef.current].timestamp <= elapsed
          ) {
            const { eventIndex } = expected[autoPointerRef.current]
            const grade = randomGrade()
            if (grade === 'miss') {
              app.triggerMiss(eventIndex)
              comboAcc = 0
            } else {
              app.triggerHitEffect(eventIndex, grade)
              scoreAcc += grade === 'perfect' ? 100 : grade === 'good' ? 70 : 40
              comboAcc += 1
            }
            autoPointerRef.current++
          }
          app.currentScore = scoreAcc
          app.currentCombo = comboAcc
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [exercise])

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

  const restart = useCallback(() => {
    const app = appRef.current
    if (!app) return
    app.init(exercise) // clears hit/miss state
    app.currentScore = 0
    app.currentCombo = 0
    autoPointerRef.current = 0
    startTimeRef.current = Date.now()
    playingRef.current = true
    setPlaying(true)
  }, [exercise])

  const triggerHit = useCallback((grade: HitGrade) => {
    const app = appRef.current
    if (!app) return
    const idx = app.getClosestEventIndex()
    if (idx !== null) {
      if (grade === 'miss') app.triggerMiss(idx)
      else app.triggerHitEffect(idx, grade)
    }
  }, [])

  const updateStyle = (key: keyof GlassStyle, value: number) => {
    setStyle((prev) => ({ ...prev, [key]: value }))
  }

  const copyStyle = () => {
    navigator.clipboard.writeText(JSON.stringify(style, null, 2)).catch(() => {})
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0808] text-[#f1ece6]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 h-12 border-b border-white/[0.07] flex-shrink-0">
        <h1 className="text-[13px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
          Highway Lab <span className="text-[#ed8a2c]">· Obsidian Glass</span>
        </h1>

        <div className="flex items-center gap-1 ml-2">
          {(Object.keys(EXERCISES) as InstrumentKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setInstrument(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                instrument === key
                  ? 'bg-[#ed8a2c] text-[#1a1008]'
                  : 'bg-white/[0.06] text-[#9a8f83] hover:text-[#f1ece6]'
              }`}
            >
              {key}
              <span className="ml-1 opacity-60">
                {key === 'congas' ? '3' : key === 'timbales' ? '6' : '88'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {WIDTH_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setStageWidth(p.width)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                stageWidth === p.width
                  ? 'bg-white/[0.14] text-[#f1ece6]'
                  : 'bg-white/[0.04] text-[#6a615a] hover:text-[#9a8f83]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 ml-3 text-[10px] text-[#9a8f83] cursor-pointer select-none">
            <input type="checkbox" checked={showHud} onChange={(e) => setShowHud(e.target.checked)} className="accent-[#ed8a2c]" />
            HUD
          </label>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Stage */}
        <div className="flex-1 min-w-0 flex items-stretch justify-center bg-[#060505]">
          <div
            className="relative h-full overflow-hidden"
            style={stageWidth ? { width: stageWidth, boxShadow: '0 0 0 1px rgba(255,255,255,0.07)' } : { width: '100%' }}
          >
            <div ref={containerRef} className="absolute inset-0" />
          </div>
        </div>

        {/* Panel */}
        <div className={`flex-shrink-0 transition-all duration-200 ${panelOpen ? 'w-72' : 'w-7'} bg-[#121010] border-l border-white/[0.07] flex flex-col relative`}>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="absolute -left-6 top-3 w-6 h-12 bg-[#191614] rounded-l flex items-center justify-center text-[#9a8f83] hover:text-[#f1ece6] text-xs z-20"
          >
            {panelOpen ? '›' : '‹'}
          </button>

          {panelOpen && (
            <>
              <div className="p-3 border-b border-white/[0.07] flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold text-[#1a1008] transition-transform active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #f2a12c, #c9543c)' }}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button
                    onClick={restart}
                    className="px-2.5 py-1.5 rounded-md text-[10px] bg-white/[0.06] text-[#9a8f83] hover:text-[#f1ece6]"
                  >
                    ↺
                  </button>
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-mono ${
                        speed === s ? 'bg-[#ed8a2c]/20 text-[#f2a12c]' : 'bg-white/[0.04] text-[#6a615a]'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                <div className="flex gap-1">
                  <button onClick={() => triggerHit('perfect')} className="flex-1 py-1 rounded text-[10px] bg-[#fff6e6]/10 text-[#fff6e6]">Perfect</button>
                  <button onClick={() => triggerHit('good')} className="flex-1 py-1 rounded text-[10px] bg-[#f2a12c]/15 text-[#f2a12c]">Good</button>
                  <button onClick={() => triggerHit('ok')} className="flex-1 py-1 rounded text-[10px] bg-[#c9543c]/20 text-[#e8a18f]">OK</button>
                  <button onClick={() => triggerHit('miss')} className="flex-1 py-1 rounded text-[10px] bg-[#cb3145]/20 text-[#e8788a]">Miss</button>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[#9a8f83] cursor-pointer select-none">
                  <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} className="accent-[#ed8a2c]" />
                  Autoplay — grade every note as it lands
                </label>

                <div className="flex items-center gap-2">
                  <button onClick={() => setStyle({ ...DEFAULT_GLASS_STYLE })} className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-[#9a8f83] hover:text-[#f1ece6]">Reset</button>
                  <button onClick={copyStyle} className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-[#9a8f83] hover:text-[#f1ece6]">Copy JSON</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {SLIDER_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="text-[9.5px] uppercase tracking-[0.2em] text-[#6a615a] mb-2" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                      {group.title}
                    </p>
                    <div className="space-y-2.5">
                      {group.sliders.map(({ key, label, min, max, step }) => {
                        const value = style[key]
                        return (
                          <div key={key}>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-[#9a8f83] text-[10px]">{label}</span>
                              <span className="text-[#c9bbaa] text-[10px] font-mono">
                                {step >= 1 ? value.toFixed(0) : value.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range" min={min} max={max} step={step} value={value}
                              onChange={(e) => updateStyle(key, parseFloat(e.target.value))}
                              className="w-full h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ed8a2c]"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
