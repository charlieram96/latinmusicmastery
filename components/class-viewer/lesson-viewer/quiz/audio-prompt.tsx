'use client'

import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import styles from './quiz.module.css'

const BARS = 16

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–:––'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Prompt clip player: round play button, level bars that move while playing, duration. */
export function AudioPrompt({ src }: { src: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number>(NaN)
  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (playing) el.pause()
    else void el.play()
  }
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[14px] border border-border bg-sunken px-3.5 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('dashboard.classViewer.quiz.pauseClip') : t('dashboard.classViewer.quiz.playClip')}
        className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />}
      </button>
      <div className="grid h-[26px] grid-cols-[repeat(16,1fr)] items-end gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => (
          <i
            key={i}
            className={cn('block rounded-[2px] bg-gold/75', playing && styles.levelBar)}
            style={{ height: `${[10, 16, 24, 14, 20, 26, 12, 18][i % 8]}px`, animationDelay: `${(i % 4) * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{playing ? t('dashboard.classViewer.quiz.audio.playing') : fmt(duration)}</span>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  )
}
