'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { Check, Crosshair, Gauge, Maximize, RotateCcw, Sparkles, Timer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/components/language-provider'
import { videoPictureBounds, VideoWatermark } from '../shared/video-watermark'
import styles from './video-effects-preview.module.css'
import { LessonTipCard } from '../shared/lesson-tip-card'
import { LessonStartCard } from '../shared/lesson-start-card'
import { videoPreviewCues, videoRoundAt } from '@/lib/playsense-studio/video-preview-cues'
import { lessonPresentationFor } from '@/lib/playsense-studio/lesson-presentation'
import { LessonVideoPlayer } from '@/components/class-viewer/lesson-viewer/lesson-video-player'

import {useAudioSource,useSelectedAudio} from '../shared/use-audio-source'

import { TransportBar } from '../player/transport/transport-bar'

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'ended'

export function VideoEffectsPreview({ videoUrl, onOpen, showSobao = false, title, audioSourceItemId }: { audioSourceItemId?: string; videoUrl: string; onOpen: () => void; showSobao?: boolean; title: string }) {
  const { locale } = useTranslation()
  const es = locale === 'es'
  const presentation = lessonPresentationFor(videoUrl)
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="st-btn-primary inline-flex items-center gap-2" onClick={() => { onOpen(); setOpen(true) }}>
      <Sparkles aria-hidden className="h-4 w-4" />{es ? 'Probar efectos' : 'Preview effects'}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[96vw] max-w-6xl gap-3 overflow-hidden rounded-2xl border-primary/20 bg-background p-3 sm:max-w-6xl sm:p-5">
        <div className="pr-8">
          <DialogTitle className="flex items-center gap-2 font-heading"><Sparkles aria-hidden className="h-4 w-4 text-primary" />{presentation ? title : es ? 'Tu ritmo. Tu momento.' : 'Your rhythm. Your moment.'}</DialogTitle>
          <DialogDescription>{presentation ? (es ? 'Presentación de la lección · Vista previa local' : 'Lesson presentation · Local preview') : es ? 'Prueba visual · Cuenta, observa y toca a tu ritmo.' : 'Visual preview · Count in, watch and play at your pace.'}</DialogDescription>
        </div>
        {open && (presentation ? <LessonVideoPlayer key={videoUrl} src={videoUrl} audioSourceItemId={audioSourceItemId} /> : <EffectsPlayer key={videoUrl} videoUrl={videoUrl} audioSourceItemId={audioSourceItemId} es={es} showSobao={showSobao} title={title} />)}
      </DialogContent>
    </Dialog>
  </>
}

export function EffectsPlayer({ videoUrl, es, showSobao, title, videoRef, onDuration, preview = true, bpm = 120, anchorSeconds = 0, audioSourceItemId }: { audioSourceItemId?: string; videoUrl: string; es: boolean; showSobao: boolean; title: string; videoRef?: RefObject<HTMLVideoElement | null>; onDuration?: (duration: number) => void; preview?: boolean; bpm?: number; anchorSeconds?: number }) {
  const ownVideo = useRef<HTMLVideoElement>(null)
  const video = videoRef ?? ownVideo
  const [phase, setPhase] = useState<Phase>('ready')
  const [count, setCount] = useState(3)
  const totalRounds = showSobao ? 5 : 1
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const seek = (seconds: number) => {
    if (!video.current) return
    video.current.currentTime = seconds
    setTime(seconds)
    if (phase === 'countdown' || phase === 'ready' || phase === 'ended') setPhase('paused')
  }

  const audioSource=useAudioSource(audioSourceItemId??'', 'watch',videoUrl)
  const audioError=useSelectedAudio(video,audioSource.settings,{volume,muted,loaded:audioSource.loaded})
  const [error, setError] = useState('')
  const [tips, setTips] = useState(true)
  const [technique, setTechnique] = useState(true)
  const [picture, setPicture] = useState({ x: 0, y: 0, width: 0, height: 0 })
  useEffect(() => {
    const el = video.current
    if (!el) return
    const update = () => setPicture(videoPictureBounds(el.clientWidth, el.clientHeight, el.videoWidth, el.videoHeight))
    const observer = new ResizeObserver(update)
    observer.observe(el); el.addEventListener('loadedmetadata', update); update()
    return () => { observer.disconnect(); el.removeEventListener('loadedmetadata', update) }
  }, [])
  const play = () => {
    const el = video.current
    if (!el) return
    void el.play().catch(() => { setPhase('paused'); setError(es ? 'Pulsa reproducir para continuar.' : 'Press play to continue.') })
  }
  const reset = () => {
    video.current?.pause()
    if (video.current) video.current.currentTime = 0
    setTime(0); setError(''); setPhase('ready')
  }
  const start = () => {
    if (!video.current) return
    video.current.pause()
    video.current.currentTime = 0
    setTime(0); setCount(3); setError(''); setPhase('countdown')
  }
  useEffect(() => {
    if (phase !== 'countdown') return
    const timer = setTimeout(() => {
      if (count > 1) setCount(count - 1)
      else play()
    }, 1000)
    return () => clearTimeout(timer)
    // The countdown owns its timer; closing the dialog unmounts this player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count])
  useEffect(() => {
    const el = video.current
    return () => { el?.pause() }
  }, [])
  const { round, roundTime } = videoRoundAt(time, bpm, anchorSeconds, totalRounds)
  const schedule = videoPreviewCues(time, duration, showSobao, round === totalRounds, roundTime)
  const cue = Math.max(0, schedule.tip)
  const cues = es ? [
    ['PRECISIÓN', 'Cada golpe cuenta.', 'Busca un ataque claro y definido.'],
    ['TIEMPO', 'Mantén el pulso.', 'Escucha el patrón y deja que te guíe.'],
    ['CONTROL', 'Relaja. Respira. Toca.', 'Movimiento pequeño, sonido consistente.'],
    ['CONTINUIDAD', 'Sigue hasta el final.', 'Si un golpe se escapa, vuelve al pulso.'],
  ] : [
    ['PRECISION', 'Make every hit count.', 'Aim for a clear, defined attack.'],
    ['TIMING', 'Stay with the pulse.', 'Listen to the pattern and let it guide you.'],
    ['CONTROL', 'Relax. Breathe. Play.', 'Small movements. Consistent sound.'],
    ['KEEP GOING', 'Finish with the flow.', 'Miss a hit? Come back to the pulse.'],
  ]
  const annotations = schedule.annotations.map(kind => ({ kind, ... (kind === 'cascara'
    ? { path: 'M 12 35 Q 6 49 16 61 M 10 59 L 16 61 L 15 54', x: 16, y: 61, left: '4%', top: '25%', label: es ? 'Mano derecha · Cáscara' : 'Right hand · Cáscara' }
    : kind === 'cascara-overhead'
    ? { path: 'M 76 43 Q 88 44 90 63 M 85 58 L 90 63 L 93 56', x: 90, y: 66, left: '61%', top: '33%', label: es ? 'Mano derecha · Cáscara' : 'Right hand · Cáscara' }
    : kind === 'sobao-front'
    ? { path: 'M 86 27 Q 88 40 74 48 M 75 41 L 74 48 L 81 47', x: 73, y: 49, left: '77%', top: '16%', label: es ? 'Mano izquierda · Sobao' : 'Left hand · Sobao' }
    : { path: 'M 16 42 Q 13 56 27 67 M 21 66 L 27 67 L 26 61', x: 28, y: 71, left: '5%', top: '32%', label: es ? 'Mano izquierda · Sobao' : 'Left hand · Sobao' }) }))
  const Icon = [Crosshair, Timer, Gauge, Sparkles][cue]
  const active = phase === 'playing' || phase === 'paused'
  return <div ref={container} className="flex min-h-0 flex-col">
    {(audioError||audioSource.error)&&<p role="alert">{audioError||audioSource.error}</p>}
    <div className={styles.stage}>
      <video ref={video} src={videoUrl} playsInline preload="metadata" className={styles.video}
        onLoadedMetadata={() => { const d = video.current?.duration; const seconds = d && Number.isFinite(d) ? d : 0; setDuration(seconds); onDuration?.(seconds) }}
        onSeeked={() => setTime(video.current?.currentTime ?? 0)}
        onPause={() => { if (phase === 'playing') setPhase('paused') }}
        onTimeUpdate={() => { const el = video.current; if (!el) return; if (loopEnabled && loopA !== null && loopB !== null && el.currentTime >= loopB) el.currentTime = loopA; setTime(el.currentTime) }}
        onPlay={() => { setPhase('playing'); setError('') }}
        onEnded={() => setPhase('ended')}
        onError={() => { setError(es ? 'No se pudo cargar el video.' : 'Unable to load the video.'); setPhase('paused') }} />
      <VideoWatermark />
      {active && showSobao && technique && annotations.map(annotation => <div key={annotation.kind} className={styles.annotation} style={{ left: picture.x, top: picture.y, width: picture.width, height: picture.height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><path d={annotation.path} /><circle cx={annotation.x} cy={annotation.y} r="4" /></svg>
        <span className={styles.annotationLabel} style={{ left: annotation.left, top: annotation.top }}>{annotation.label}</span>
      </div>)}
      {active && <>
        <span className={styles.roundCounter} aria-live="polite">{es ? 'VUELTA' : 'ROUND'} {round} / {totalRounds}</span>
        {schedule.finalNotice && <div role="status" className={styles.lastRound}>{es ? 'ÚLTIMA VUELTA · ¡VAMOS!' : 'LAST ROUND · LET’S GO!'}</div>}
        {tips && schedule.tip >= 0 && !(technique && schedule.technique) && <LessonTipCard key={cue} icon={<Icon aria-hidden size={23}/>} label={cues[cue][0]} title={cues[cue][1]} detail={cues[cue][2]} style={{opacity:schedule.tipOpacity}}/>}
      </>}
      {phase === 'ready' && <LessonStartCard title={title}
        label={`${totalRounds} ${es ? 'VUELTAS · ¿LISTO PARA TOCAR?' : 'ROUNDS · READY TO PLAY?'}`}
        detail={es ? 'Encuentra el pulso. Suelta las manos.' : 'Find the pulse. Relax your hands.'}
        pills={[es ? 'Precisión' : 'Precision', es ? 'Tiempo' : 'Timing', 'Control']}
        action={es ? 'Comenzar' : 'Let’s play'} onStart={start}/>}
      {phase === 'countdown' && <div className={styles.scrim}><div className={styles.intro}>
        <p className={styles.eyebrow}>LATIN MUSIC MASTERY</p>
        <p className={styles.readyLabel}>{es ? 'PREPÁRATE' : 'GET READY'}</p>
        <div key={count} className={styles.count} role="status" aria-live="polite">{count}</div>
        <p>{es ? 'Respira. El ritmo empieza contigo.' : 'Take a breath. The rhythm starts with you.'}</p>
      </div></div>}
      {phase === 'ended' && <div className={styles.scrim}>
        <div className={styles.intro}>
          <div className={styles.finishIcon}><Check size={34} /></div>
          <p className={styles.eyebrow}>{es ? 'PRÁCTICA COMPLETADA' : 'PRACTICE COMPLETE'}</p>
          <h2>{es ? '¡Bien hecho!' : 'Well done!'}</h2>
          <p>{es ? 'Cada repetición te ayuda a mejorar.' : 'Every repetition helps you improve.'}</p>
          <div className={styles.pills}><span>{es ? 'Escucha' : 'Listen'}</span><span>{es ? 'Siente' : 'Feel'}</span><span>{es ? 'Repite' : 'Repeat'}</span></div>
          <button type="button" className={styles.primary} onClick={reset}><RotateCcw size={18} />{es ? 'Repetir ejercicio' : 'Replay exercise'}</button>
          <p className={styles.disclaimer}>{preview ? (es ? 'Vista de efectos · Sin evaluación del desempeño' : 'Effects preview · Performance is not evaluated') : (es ? 'Sin evaluación del desempeño' : 'Performance is not evaluated')}</p>
        </div>
      </div>}
    </div>
    <div className="relative z-30 shrink-0 rounded-xl border border-border bg-card px-2 py-1">
      <TransportBar currentSeconds={time} durationSeconds={duration} isPlaying={phase === 'playing' || phase === 'countdown'} playbackRate={rate}
        onToggle={() => { if (phase === 'ready' || phase === 'ended') start(); else if (phase === 'countdown') setPhase('paused'); else if (phase === 'playing') { video.current?.pause(); setPhase('paused'); } else play() }}
        onRestart={reset} onSeek={seek} onRateChange={value => { if (video.current) video.current.playbackRate = value; setRate(value) }}
        bpm={bpm} beatsPerMeasure={4} loopA={loopA} loopB={loopB} loopEnabled={loopEnabled}
        onSetLoopA={setLoopA} onSetLoopB={value => { setLoopB(value); setLoopEnabled(true) }}
        onToggleLoop={() => setLoopEnabled(value => !value)} onClearLoop={() => { setLoopEnabled(false); setLoopA(null); setLoopB(null) }}
        videoMuted={muted} onVideoMutedChange={setMuted} videoVolume={volume} onVideoVolumeChange={setVolume}
        fullscreenControl={<button type="button" className="st-iconbtn" aria-label={es ? 'Pantalla completa' : 'Fullscreen'} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen() }}><Maximize size={16}/></button>}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-semibold text-primary">{es ? 'Vuelta' : 'Round'} {round}/{totalRounds}</span>
      {showSobao && <button type="button" className="st-chip" aria-pressed={technique} onClick={() => setTechnique(!technique)}>{es ? 'Señalar mano' : 'Hand guide'} {technique ? '✓' : '—'}</button>}
      <button type="button" className="st-chip ml-auto" aria-pressed={tips} onClick={() => setTips(!tips)}>{es ? 'Consejos' : 'Tips'} {tips ? '✓' : '—'}</button>
      <button type="button" className="st-chip" onClick={reset}><RotateCcw size={14} />{es ? 'Repetir' : 'Replay'}</button>
    </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
