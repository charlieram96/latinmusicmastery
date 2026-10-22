'use client'

import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from '@/components/language-provider'
import { exerciseVideoGuidance } from '@/lib/playsense-studio/exercise-video-guidance'
import { LessonStartCard } from './lesson-start-card'
import { CoachingCard } from '@/components/class-viewer/lesson-viewer/coaching-card'
import './exercise-video-guidance.css'

/** Same media-clock layers in student playback and the authoring monitor. */
export function ExerciseVideoGuidance({ itemId, videoRef, state, onStart, watch = false }: { itemId: string; videoRef: RefObject<HTMLVideoElement | null>; state?: string; onStart?: () => void; watch?: boolean }) {
  const profile = exerciseVideoGuidance[itemId]
  const { locale } = useTranslation()
  const es = locale === 'es'
  const [localPhase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready')
  const phase = state ? (state === 'selecting' ? 'ready' : state === 'results' ? 'done' : 'playing') : localPhase
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [visible, setVisible] = useState(true)
  const [error, setError] = useState('')
  const changePhase = (next: typeof phase) => setPhase(next)
  useEffect(() => {
    const video = videoRef.current
    if (!profile || !video) return
    const update = () => { setTime(video.currentTime); setDuration(Number.isFinite(video.duration) ? video.duration : 0) }
    const play = () => {
      if (state) { update(); return }
      changePhase('playing'); setError(''); update()
    }
    const pause = () => update()
    const ended = () => changePhase('done')
    // A deliberate seek retains the selected media time and normal paused state.
    const seek = () => { if (state) { update(); return }; if (video.currentTime > .05) changePhase('playing'); else { video.pause(); changePhase('ready') }; update() }
    video.addEventListener('play', play); video.addEventListener('pause', pause)
    video.addEventListener('ended', ended); video.addEventListener('timeupdate', update)
    video.addEventListener('loadedmetadata', update); video.addEventListener('seeked', seek)
    update()
    return () => {
      video.removeEventListener('play', play); video.removeEventListener('pause', pause)
      video.removeEventListener('ended', ended); video.removeEventListener('timeupdate', update)
      video.removeEventListener('loadedmetadata', update); video.removeEventListener('seeked', seek)
    }
  }, [profile, videoRef, state])
  if (!profile) return null
  const start = () => {
    if (onStart) { onStart(); return }
    const video = videoRef.current
    if (!video) return
    if (phase === 'done') {
      video.pause(); video.currentTime = 0; changePhase('ready'); return
    }
    changePhase('playing')
    void video.play().catch(() => { changePhase('ready'); setError(es ? 'Pulsa Comenzar otra vez para reproducir.' : 'Press Start again to play.') })
  }
  // Brief cues with gaps, after the teacher’s opening count; no invented hand arrows or round totals.
  const cueIndex = [Math.max(4, duration * .3), Math.max(8, duration * .65)].findIndex(at => time >= at && time < at + Math.min(2.2, duration * .1))
  const watchAnnouncement = watch && profile.watchIntro && time >= profile.watchIntro.start && time < profile.watchIntro.end
  return <div className="exercise-video-guidance">
    {phase !== 'playing' ? <LessonStartCard
      title={phase === 'done' ? (es ? '¡Bien hecho!' : 'Well done!') : es ? profile.es : profile.en}
      label={phase === 'done' ? (es ? 'PRÁCTICA COMPLETADA' : 'PRACTICE COMPLETE') : (es ? 'SON CUBANO · PREPÁRATE' : 'CUBAN SON · GET READY')}
      detail={phase === 'done' ? (es ? 'Cada repetición te ayuda a mejorar.' : 'Every repetition helps you improve.') : (es ? profile.introEs ?? 'Escucha la cuenta del instructor y sigue el pulso.' : profile.introEn ?? 'Listen to the instructor’s count and follow the pulse.')}
      pills={es ? ['Precisión', 'Tiempo', 'Control'] : ['Precision', 'Timing', 'Control']}
      action={phase === 'done' ? (es ? 'Repetir' : 'Replay') : (es ? 'Comenzar' : 'Start')} onStart={start}
    /> : <>
      {profile.tipsEs.length > 0 && <button className="exercise-guidance-toggle" aria-pressed={visible} onClick={() => setVisible(!visible)}>{es ? 'Consejos' : 'Tips'} {visible ? '✓' : '—'}</button>}
      {visible && watchAnnouncement && <div className="exercise-guidance-tip"><CoachingCard cue={{ kind: 'tip', key: 'watch-example', text: es ? 'Te muestro cómo hacerlo' : 'Let me show you how', detail: es ? 'ESCUCHA LA CUENTA Y OBSERVA' : 'LISTEN TO THE COUNT AND WATCH' }} /></div>}
      {visible && !watchAnnouncement && cueIndex >= 0 && !!profile.tipsEs[cueIndex] && <div className="exercise-guidance-tip"><CoachingCard key={cueIndex} cue={{ kind: 'tip', key: String(cueIndex), text: (es ? profile.tipsEs : profile.tipsEn)[cueIndex], detail: es ? 'PRECISIÓN · TIEMPO · CONTROL' : 'PRECISION · TIMING · CONTROL' }} /></div>}
    </>}
    {error && <p role="alert" className="absolute bottom-2 left-2 text-sm text-destructive">{error}</p>}
  </div>
}
