'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowUpRight, ChevronDown, CircleHelp, Drum, Headphones, Maximize2, Pause, Piano, Play, Move3D, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { StageHighway } from '@/components/play-sense/stage-highway/StageHighway'
import { STAGE_THEMES } from '@/components/play-sense/stage-highway/themes'
import { backingBandLabel } from '@/components/play-sense/stage-highway/band'
import { createStageModel } from '@/components/play-sense/stage-highway/model'
import { getExerciseDuration, generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'
import { gradeSingleOnset, computeStats } from '@/lib/play-sense/scoring'
import type { EventResult, Instrument } from '@/lib/play-sense/types'
import { makeDemoExercise } from '@/lib/play-sense/demo-exercises'
import { DEMO_LEAD_IN, comboOf, createDemoSession, frameDelta, resetDemoSession, stepDemoSession } from '@/lib/play-sense/demo-session'
import { PerformanceHud } from '@/components/play-sense/performance-hud'
import { PerformanceResultsDialog } from '@/components/play-sense/performance-results'
import './preview.css'

const THEME_COPY = {
  studio: { eyebrow: 'MIAMI SESSIONS', description: 'The sun just set over Biscayne Bay. The band is ready. Find your place in the groove.', icon: Headphones },
}
const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k']

export default function PlaySensePreview() {
  const theme = 'studio'
  const [instrument, setInstrument] = useState<Instrument>('conga')
  const [running, setRunning] = useState(true)
  const [demo, setDemo] = useState(true)
  const [sound, setSound] = useState(false)
  const [elapsed, setElapsed] = useState(DEMO_LEAD_IN)
  const [results, setResults] = useState<EventResult[]>([])
  const [take, setTake] = useState(0)
  const [help, setHelp] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const resumeAfterReview = useRef(true)
  const [explore, setExplore] = useState(false)
  const [activeLane, setActiveLane] = useState<number | null>(null)
  const session = useRef(createDemoSession())
  const lastFrame = useRef(0)
  const audio = useRef<AudioContext | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const soundRef = useRef(sound)
  const laneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exercise = useMemo(() => makeDemoExercise(instrument), [instrument])
  const model = useMemo(() => createStageModel(exercise), [exercise])
  const expected = useMemo(() => generateExpectedTimestamps(exercise), [exercise])
  const duration = getExerciseDuration(exercise)
  const stats = useMemo(() => computeStats(results, 0, Math.max(0, elapsed)), [results, elapsed])
  const playableLanes = useMemo(() => [...new Set(model.notes.map(n => n.lane))].sort((a,b) => a-b), [model])
  const latest = useRef({ running, demo, model, expected, exercise, duration })
  useEffect(() => { latest.current = { running, demo, model, expected, exercise, duration } }, [running, demo, model, expected, exercise, duration])
  useEffect(() => { soundRef.current = sound }, [sound])
  const reset = useCallback(() => {
    resetDemoSession(session.current)
    setElapsed(DEMO_LEAD_IN); setResults([]); setTake(t => t + 1)
  }, [])
  const tone = useCallback((lane: number) => {
    const context = audio.current
    if (!soundRef.current || !context || context.state !== 'running') return
    const instrument = latest.current.exercise.instrument
    const pitch = latest.current.model.lanes[lane]?.midi ?? 45 + lane * 5
    const oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = instrument === 'piano' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(440 * 2 ** ((pitch - 69) / 12), context.currentTime)
    if (instrument !== 'piano') oscillator.frequency.exponentialRampToValueAtTime(75 + lane * 28, context.currentTime + 0.09)
    gain.gain.setValueAtTime(0, context.currentTime)
    gain.gain.linearRampToValueAtTime(0.13, context.currentTime + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (instrument === 'piano' ? 0.35 : 0.16))
    oscillator.connect(gain); gain.connect(context.destination)
    oscillator.start(); oscillator.stop(context.currentTime + 0.4)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }, [])
  useEffect(() => {
    let raf = 0, lastUI = 0
    const tick = (now: number) => {
      const dt = frameDelta(now, lastFrame.current)
      lastFrame.current = now
      const state = latest.current
      if (state.running && !document.hidden) {
        const step = stepDemoSession(session.current, dt, state)
        if (state.demo) for (const result of step.added) tone(state.model.notes.find(n => n.index === result.eventIndex)?.lane ?? 0)
        if (step.looped) { setResults([]); setTake(value => value + 1) }
        else if (step.added.length) setResults(session.current.results)
        if (step.ended) setRunning(false)
      }
      if (now - lastUI >= 50) { setElapsed(session.current.elapsed); lastUI = now }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tone])
  useEffect(() => () => { void audio.current?.close(); if (laneTimer.current) clearTimeout(laneTimer.current) }, [])

  const strike = useCallback((lane: number) => {
    const state = latest.current
    const live = session.current
    if (state.demo || !state.running || live.elapsed < 0) return
    const target = state.model.lanes[lane]
    const note = target.midi ?? Number(target.id)
    const result = gradeSingleOnset(live.elapsed, 1, state.expected, live.matched, state.exercise.difficulty, 0, 0,
      state.exercise.instrument === 'piano' ? 'pitched' : 'percussion', state.exercise.instrument === 'piano' ? note : undefined,
      undefined, state.exercise.instrument === 'piano' ? undefined : target.id, 'midi')
    tone(lane); setActiveLane(lane)
    if (laneTimer.current) clearTimeout(laneTimer.current)
    laneTimer.current = setTimeout(() => setActiveLane(null), 130)
    if (result) { live.results = [...live.results, result]; setResults(live.results) }
  }, [tone])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (resultsOpen) return
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return
      const index = KEYS.indexOf(event.key.toLowerCase())
      if (index >= 0 && playableLanes[index] != null) { event.preventDefault(); strike(playableLanes[index]) }
      if (event.code === 'Space') { event.preventDefault(); setRunning(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [strike, playableLanes, resultsOpen])

  const toggleSound = async () => {
    if (!audio.current) audio.current = new AudioContext()
    await audio.current.resume(); setSound(v => !v)
  }
  const current = STAGE_THEMES[theme], ThemeIcon = THEME_COPY[theme].icon
  const combo = comboOf(results)
  const seconds = (n: number) => `${Math.floor(Math.max(0,n) / 60)}:${String(Math.floor(Math.max(0,n) % 60)).padStart(2, '0')}`
  const last = results[results.length - 1]
  return <main className="ps-preview" data-theme={theme}>
    <header className="ps-preview-header">
      <Link href="/dashboard/play-sense" className="ps-preview-brand"><span className="ps-brand-symbol"><Image src="/logo-solo-color.svg" alt="" width={32} height={26} priority/></span><strong>PlaySense<span>BY LATIN MUSIC MASTERY</span></strong></Link>
      <span className="ps-preview-badge"><span/> Miami sessions <b>PLAYSENSE</b></span>
      <Link href="/dashboard/play-sense" className="ps-preview-back">Back to practice <ArrowUpRight size={15}/></Link>
    </header>
    <div className="ps-direction-bar">
      <div className="ps-direction-intro"><span className="ps-overline">STEP INTO THE SESSION</span><h1>Your place in the band.</h1></div>
    </div>
    <section className={`ps-preview-stage ${explore ? 'ps-exploring' : ''}`} ref={stage} aria-label={`${current.name} playable stage`}>
      <StageHighway exercise={exercise} attemptId={take} theme={theme} sessionState="playing" getElapsedSeconds={() => session.current.elapsed}
        playheadProgress={Math.max(0,elapsed) / duration} currentScore={stats.score} currentCombo={combo} currentAccuracy={stats.accuracy}
        metronomeBeat={Math.floor(Math.max(0,elapsed) * exercise.bpm / 60) % 4 + 1} eventResultsLength={results.length} eventResults={results} fill showHud={false} hideCountdown explore={explore}/>
      <div className="ps-preview-vignette"/>
      {theme === 'studio' && <div className="ps-backing-band"><span>WITH THE BAND</span><strong>{backingBandLabel(instrument)}</strong></div>}
      <Button variant="outline" size="sm" className="ps-explore-button" aria-pressed={explore} onClick={() => setExplore(value => !value)}><Move3D size={14}/>{explore ? 'Return to performance' : 'Explore the stage'}</Button>
      {explore && <span className="ps-explore-hint">Drag to look around · Scroll to zoom</span>}
      <div className="ps-stage-topline">
        <div className="ps-song"><span className="ps-song-icon">{instrument === 'piano' ? <Piano size={22}/> : <Drum size={22}/>}</span><div><span className="ps-overline">{demo ? 'DEMO PERFORMANCE' : 'YOUR PERFORMANCE'}</span><h2>{exercise.title}</h2><p>Latin foundations <span>•</span> {exercise.bpm} BPM <span>•</span> 4/4</p></div></div>
        <PerformanceHud score={stats.score} combo={combo} accuracy={stats.accuracy} hasResults={results.length > 0} playing={running} compact />
      </div>
      <div className="ps-world-caption"><span className="ps-world-icon"><ThemeIcon size={16}/></span><span>{THEME_COPY[theme].eyebrow}</span><h3>{current.name}<span>.</span></h3><p>{THEME_COPY[theme].description}</p><div className="ps-world-line"/></div>
      <div className="ps-preview-side"><span className="ps-overline">SESSION</span><div className="ps-session-beats">{[0,1,2,3].map(i=><i key={i} className={elapsed >= 0 && Math.floor(elapsed*exercise.bpm/60)%4===i?'on':''}/>)}</div><p>{elapsed<0?'Get ready':elapsed>=duration?'Phrase complete':`Measure ${Math.floor(Math.max(0,elapsed)*exercise.bpm/60/4)%4+1} of 4`}</p><span className="ps-session-tag">{demo?'AUTOPLAY':'LIVE INPUT'}</span></div>
      {elapsed < 0 && <div className="ps-preview-countdown"><span>FIND THE PULSE</span><strong>{Math.ceil(-elapsed)}</strong></div>}
      {elapsed >= 0 && last && <div key={`${last.eventIndex}:${last.grade}`} className={`ps-preview-hit ${last.grade === 'miss' ? 'miss' : ''}`}><span>{last.grade === 'perfect' ? '✦' : ''}</span>{last.grade === 'ok' ? 'Keep going' : last.grade}</div>}
      <div className="ps-preview-stage-bottom"><span><span className="ps-status-dot"/>{demo ? 'Demo · hits are simulated' : 'Match the notes at the light line'}</span><button onClick={() => { if (!document.fullscreenElement) void stage.current?.requestFullscreen(); else void document.exitFullscreen() }} aria-label="Toggle full screen"><Maximize2 size={17}/></button></div>
    </section>
    <div className="ps-preview-controls">
      <div className="ps-transport-buttons"><button className="ps-icon-button" onClick={() => { reset(); setRunning(true) }} aria-label="Restart phrase"><RotateCcw size={17}/></button><Button size="icon" className="ps-preview-play" onClick={() => { if (elapsed>=duration) reset(); setRunning(v=>!v) }} aria-label={running?'Pause preview':'Play preview'}>{running?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</Button><span className="ps-time">{seconds(elapsed)} <i>/ {seconds(duration)}</i></span></div>
      <div className="ps-progress" role="progressbar" aria-label="Phrase progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1,Math.max(0,elapsed/duration))*100)}><span style={{width:`${Math.min(100,Math.max(0,elapsed/duration*100))}%`}}/></div>
      <label className="ps-instrument-select">{instrument==='piano'?<Piano size={17}/>:<Drum size={17}/>}<select value={instrument} onChange={e=>{setInstrument(e.target.value as Instrument); reset(); setRunning(true)}} aria-label="Preview instrument"><option value="conga">Congas</option><option value="timbale">Timbales</option><option value="piano">Piano</option></select><ChevronDown size={13}/></label>
      <button className="ps-icon-button" onClick={()=>void toggleSound()} aria-label={sound?'Mute preview':'Enable preview sound'}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
      <div className="ps-play-mode" role="group" aria-label="Preview play mode"><button aria-pressed={demo} onClick={()=>{setDemo(true);reset();setRunning(true)}}>Watch demo</button><button aria-pressed={!demo} onClick={()=>{setDemo(false);reset();setRunning(true)}}><Play size={12}/> Try it</button></div>
    </div>
    <footer className="ps-preview-footer"><div>{demo ? <><span className="ps-footer-spark"><Sparkles size={15}/></span><span>PlaySense sessions. <strong>Settle in. Find the groove.</strong></span></> : <div className="ps-touch-pads">{playableLanes.slice(0,8).map((lane,i)=><button key={lane} className={activeLane===lane?'active':''} onPointerDown={e=>{e.preventDefault();strike(lane)}} aria-label={`Play ${model.lanes[lane].label}`}><kbd>{KEYS[i].toUpperCase()}</kbd>{model.lanes[lane].label}</button>)}</div>}</div><Button size="sm" className="ps-results-preview-button" onClick={()=>{resumeAfterReview.current=running;setRunning(false);setResultsOpen(true)}}>View results <ArrowUpRight size={14}/></Button><button className="ps-help" aria-expanded={help} onClick={()=>setHelp(v=>!v)}><CircleHelp size={15}/> How to play</button></footer>
    <PerformanceResultsDialog open={resultsOpen} onClose={()=>{setResultsOpen(false);setRunning(resumeAfterReview.current)}}
      stats={stats} exerciseTitle={exercise.title} demo={demo}
      onRetry={()=>{setResultsOpen(false);reset();setRunning(true)}}
      onNext={()=>{setResultsOpen(false);setRunning(resumeAfterReview.current)}} nextLabel="Back to studio" />
    {help && <div className="ps-help-panel"><strong>Play at the light line.</strong><p>Watch the notes travel toward you. Select Try it, then use the labeled keyboard keys or tap the pads as each note reaches the glowing line. Space pauses the preview. Preview sound is synthesized; your lessons use their own backing tracks.</p><p>In lessons and practice, choose MIDI for your piano, a microphone for acoustic instruments, or your connected PlaySense device.</p></div>}
  </main>
}
