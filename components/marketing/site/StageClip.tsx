'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useInViewVideo } from './useInViewVideo'

const LEN = 11.6 // seconds of clip used before looping through a dip to black
const BEAT = 60 / 100 // the recorded exercise runs at 100 BPM
const TOTAL_MEASURES = 4

/**
 * A recording of the real PlaySense Miami stage with the app's HUD rebuilt in
 * HTML on top (sharp at any size). HUD numbers are derived from the clip's
 * time so they stay in step with the notes on screen.
 */
export function StageClip({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [dip, setDip] = useState(false)
  const [pop, setPop] = useState(0)
  useInViewVideo(ref, 0.2)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    let looping = false
    const restart = () => {
      if (looping) return
      looping = true
      setDip(true)
      window.setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); window.setTimeout(() => { setDip(false); looping = false }, 120) }, 340)
    }
    const id = window.setInterval(() => {
      if (v.paused) return
      if (v.currentTime > LEN) restart()
      setTime(v.currentTime)
    }, 120)
    v.addEventListener('ended', restart)
    return () => { window.clearInterval(id); v.removeEventListener('ended', restart) }
  }, [])

  const hits = Math.floor(time / (BEAT / 2))
  const measure = Math.min(TOTAL_MEASURES - 1, Math.floor(time / (BEAT * 4)) % TOTAL_MEASURES)
  const score = Math.min(100, Math.round((hits * 100) / 22))
  useEffect(() => { if (hits > 0 && hits % 3 === 0) setPop(p => p + 1) }, [hits])

  return (
    <div className={`stage ${className}`}>
      <video ref={ref} muted playsInline preload="metadata" poster="/marketing/stage-miami-poster.jpg" aria-label={t('marketing.site.stageClip.label')}>
        <source src="/marketing/stage-miami.mp4" type="video/mp4" />
        <source src="/marketing/stage-miami.webm" type="video/webm" />
      </video>
      <div className={`stage-dip${dip ? ' on' : ''}`} />
      <div className="sh sh-tl">
        <span className="sh-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><ellipse cx="12" cy="6" rx="6" ry="2.2" /><path d="M6 6c0 5 1 9 2.5 14h7C17 15 18 11 18 6" /><path d="M7.5 11h9M8.5 16h7" /></svg>
        </span>
        <div><small>{t('marketing.site.stageClip.demoPerformance').toUpperCase()}</small><b>{t('marketing.site.stageClip.exercise')}</b><span>{t('marketing.site.stageClip.exerciseMeta')}</span></div>
      </div>
      <div className="sh sh-tr">
        <div className="sh-score">
          <div><span>{t('marketing.site.stageClip.score')}</span><b>{score}<small>/ 100</small></b></div>
          <div className="cb"><span>{t('marketing.site.stageClip.combo')}</span><b>{hits}<small>{t('marketing.site.stageClip.inARow')}</small></b></div>
          <div className="ac"><span>{t('marketing.site.stageClip.accuracy')}</span><b>100%</b></div>
        </div>
        <div className="sh-band"><small>{t('marketing.site.stageClip.withBand').toUpperCase()}</small><b>{t('marketing.site.stageClip.band')}</b></div>
      </div>
      <div key={pop} className={`sh-pop${pop ? ' show' : ''}`} aria-hidden="true">{t('marketing.site.stageClip.perfect').toUpperCase()}</div>
      <div className="sh sh-bl"><i />{t('marketing.site.stageClip.simulated')}</div>
      <div className="sh sh-br">
        <span className="meas" aria-hidden="true">{Array.from({ length: TOTAL_MEASURES }, (_, i) => <i key={i} className={i <= measure ? 'on' : ''} />)}</span>
        <span>{t('marketing.site.stageClip.measure', { n: measure + 1, total: TOTAL_MEASURES })}</span>
      </div>
    </div>
  )
}
