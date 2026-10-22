'use client'

import { PrecountControl } from '@/components/playsense-studio/shared/precount-control'
import { useTransportCountIn } from '@/components/playsense-studio/player/state/use-transport-count-in'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { barPracticeScore } from '@/lib/play-sense/bar-practice-score'
import { trackDurationMs, qnToTrackMs } from '@/lib/playsense-studio/time-mapping'
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer'
import { ScoreHeading } from '@/components/playsense-studio/shared/score-heading'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useTranslation } from '@/components/language-provider'
import { VideoStage } from '@/components/playsense-studio/player/video/video-stage'
import { TransportBar } from '@/components/playsense-studio/player/transport/transport-bar'
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock'
import { useVideoClickTrack } from '@/components/playsense-studio/player/state/use-video-click-track'
import type { BarPracticeClip } from '@/lib/play-sense/bar-practice'
import type { BarResult } from '@/lib/play-sense/bar-results'

export function BarPracticeDialog({ bar, clip, videoUrl, onClose, score }: { score?: ScoreDocument; bar: BarResult; clip: BarPracticeClip; videoUrl: string; onClose: () => void }) {
  const { locale } = useTranslation(), es = locale === 'es'
  const excerpt = useMemo(() => score ? barPracticeScore(score, bar.bar, clip.bpm) : null, [score, bar.bar, clip.bpm])
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent showCloseButton={false} className="flex h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-none flex-col gap-2 overflow-hidden p-3 sm:max-w-none sm:p-5">
      <button type="button" onClick={onClose} aria-label={es ? 'Cerrar práctica' : 'Close practice'} className="absolute right-3 top-3 rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4"/></button>
      <DialogTitle className="pr-8">{es ? `Practiquemos el compás ${bar.bar}` : `Let's practice bar ${bar.bar}`}</DialogTitle>
      <DialogDescription>{es ? 'Escúchalo despacio, sigue el pulso y repítelo a tu ritmo. Puedes bajar la velocidad y activar el metrónomo. Al cerrar volverás a tus resultados.' : 'Listen slowly, follow the beat and repeat at your own pace. Lower the speed and turn on the metronome. Close to return to your results.'}</DialogDescription>
      <p className="text-xs text-muted-foreground">{es ? `En esta toma: ${bar.missed} notas omitidas · ${bar.early} adelantadas · ${bar.late} atrasadas.` : `This take: ${bar.missed} missed notes · ${bar.early} early · ${bar.late} late.`}</p>
      <ClipPlayer clip={clip} videoUrl={videoUrl} score={excerpt}/>
      <button type="button" onClick={onClose} className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{es ? 'Cerrar y volver a los resultados' : 'Close and return to results'}</button>
    </DialogContent>
  </Dialog>
}

function ClipPlayer({ clip, videoUrl, score }: { score: ScoreDocument | null; clip: BarPracticeClip; videoUrl: string }) {
  const { locale } = useTranslation(), es = locale === 'es'
  const [view, setView] = useState('both')
  const [trackIndex, setTrackIndex] = useState(0)
  const notationDuration = useMemo(() => score?.tracks[trackIndex] ? trackDurationMs(score.tracks[trackIndex], score) : 0, [score, trackIndex])
  const ref = useRef<HTMLVideoElement>(null)
  const clock = useVideoTransportClock(ref, { onEnded: () => {
    const video = ref.current
    if (video) { video.currentTime = clip.start; void video.play().catch(() => setError(true)) }
  } })
  const countIn = useTransportCountIn()
  const [countInBars, setCountInBars] = useState<0|1|2>(1)
  const seeded = useRef(false)
  const [clickOn, setClickOn] = useState(false), [clickVolume, setClickVolume] = useState(.5)
  const [volume, setVolume] = useState(1), [muted, setMuted] = useState(false)
  const [error, setError] = useState(false)
  const end = Math.min(clip.end, clock.durationSeconds || clip.end)
  const grid = useMemo(() => Array.from({ length: clip.beats }, (_, i) => clip.start + (clip.clickOffsetSeconds ?? 0) + i * clip.beatSeconds).filter(time => time < clip.end), [clip])
  useVideoClickTrack({ videoRef: ref, grid, enabled: clickOn, volume: clickVolume })
  const startPlayback = () => {
    void countIn.start({ bpm: 60 / clip.beatSeconds * clock.playbackRate, denominator: 4, beats: clip.beats, bars: countInBars, volume: clickVolume || .2 }, () => { void ref.current?.play().catch(() => {}) })
  }
  useEffect(() => {
    if (!clock.isReady || seeded.current) return
    seeded.current = true
    if (clock.durationSeconds + .01 < clip.end) { setError(true); return }
    clock.loadLoop(clip.start, clip.end)
    clock.seek(clip.start)
    // One measure of preparation before the first loop; loops themselves stay continuous.
    startPlayback()
  }, [clock, clip])
  useEffect(() => { if (ref.current) { ref.current.volume = volume; ref.current.muted = muted } }, [volume, muted])
  useEffect(() => { const video = ref.current; return () => { video?.pause() } }, [])
  const play = () => {
    if (countIn.remaining) { countIn.cancel(); return }
    if (error) return
    if (clock.isPlaying) clock.pause()
    else startPlayback()
  }
  return <>
    {error && <p role="alert">{es ? 'No se pudo reproducir el compás completo. Revisa el video y su sincronización.' : 'Unable to play the complete bar. Check the video and its synchronization.'}</p>}
    {countIn.error && <p role="alert" className="text-sm">{es ? 'Pulsa Reproducir para activar el sonido de la cuenta previa.' : 'Press Play to enable the count-in audio.'}</p>}
    {score && <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs"><label className="flex items-center gap-2">{es ? 'Mostrar' : 'Show'}<select aria-label={es ? 'Vista de práctica' : 'Practice view'} value={view} onChange={event => setView(event.target.value)} className="rounded-lg border bg-background px-2 py-1"><option value="both">{es ? 'Video y partitura' : 'Video and score'}</option><option value="video">{es ? 'Solo video' : 'Video only'}</option><option value="score">{es ? 'Solo partitura' : 'Score only'}</option></select></label>
      {score.tracks.length > 1 && <label className="flex items-center gap-2">{es ? 'Pentagrama' : 'Staff'}<select value={trackIndex} onChange={event => setTrackIndex(Number(event.target.value))}>{score.tracks.map((track,i) => <option key={i} value={i}>{track.displayName}</option>)}</select></label>}
    </div>}
    <div className="relative min-h-0 flex-1" style={score && view === 'score' ? { display: 'none' } : undefined}>
    <VideoStage ref={ref} src={videoUrl} className="h-full w-full [&_video]:object-contain" startLabel={es ? 'Reproducir compás' : 'Play bar'} onFirstPlay={play}/>
    {countIn.remaining > 0 && <div className="pointer-events-none absolute inset-0 grid place-content-center bg-black/25 text-center text-white"><span className="text-sm font-semibold">{es ? 'Prepárate' : 'Get ready'}</span><output role="status" className="text-7xl font-bold tabular-nums drop-shadow-lg">{countIn.remaining}</output></div>}
    </div>
    {score && view !== 'video' && <section tabIndex={0} aria-label={es ? 'Partitura del compás en práctica' : 'Practice bar score'} className="min-h-0 overflow-auto rounded-lg border bg-card px-2" style={view === 'both' ? { height: 'clamp(145px, 27dvh, 250px)', flexShrink: 0 } : { flex: 1 }}>
      <ScoreHeading score={score} bpm={Math.round(clip.bpm * clock.playbackRate)}/>
      <StaffRenderer score={score} trackIndex={trackIndex} compact layoutMode="scroll" zoom={.85}
        currentMs={Math.max(0, clock.currentSeconds-clip.start)/(clip.end-clip.start)*notationDuration}
        getCurrentMs={() => Math.max(0, clock.getCurrentSeconds()-clip.start)/(clip.end-clip.start)*notationDuration}
        onSeek={target => { countIn.cancel(); clock.seek(clip.start + Math.min(.999999, Math.max(0, qnToTrackMs(score.tracks[trackIndex], score, target.qn) / notationDuration)) * (clip.end-clip.start)) }}/>
    </section>}
    <div className="shrink-0 rounded-lg border bg-card p-1">
      <TransportBar currentSeconds={Math.max(0, clock.currentSeconds - clip.start)} durationSeconds={Math.max(0,end-clip.start)} isPlaying={clock.isPlaying || countIn.remaining > 0} playbackRate={clock.playbackRate}
        onToggle={play} onRestart={() => { countIn.cancel(); clock.seek(clip.start) }} onSeek={seconds => { countIn.cancel(); clock.seek(Math.min(end-.001,Math.max(clip.start,clip.start+seconds))) }} onRateChange={rate => { countIn.cancel(); clock.setPlaybackRate(rate) }}
        metronomeControls={<PrecountControl bars={countInBars} remaining={countIn.remaining} onChange={bars => { countIn.cancel(); setCountInBars(bars) }}/>}
        loopA={0} loopB={end-clip.start} loopEnabled loopLocked onToggleLoop={() => clock.loadLoop(clip.start,end)} onClearLoop={() => clock.loadLoop(clip.start,end)}
        bpm={clip.bpm} beatsPerMeasure={clip.beats} clickOn={clickOn} onClickOnChange={setClickOn} clickAligned clickVolume={clickVolume} onClickVolumeChange={setClickVolume}
        videoVolume={volume} videoMuted={muted} onVideoVolumeChange={setVolume} onVideoMutedChange={setMuted}/>
    </div>
  </>
}
