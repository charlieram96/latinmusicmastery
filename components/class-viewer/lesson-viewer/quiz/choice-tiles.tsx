'use client'

import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { norm, type AudioChoice, type Choice } from '@/lib/quiz/grading'
import { AudioPrompt } from './audio-prompt'
import type { QuestionInputProps } from './input-props'
import { OptionTile, tileState } from './option-tile'
import styles from './quiz.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** Play/pause control for an audio answer choice. A span, not a button, so it can live inside the tile button. */
function AudioChoicePlayer({ url, label }: { url?: string; label: string }) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause()
    else {
      el.currentTime = 0
      void el.play()
    }
  }
  return (
    <span className="flex items-center gap-3">
      <span
        role="button"
        tabIndex={0}
        aria-label={playing ? t('dashboard.classViewer.quiz.pauseClip') : t('dashboard.classViewer.quiz.playClip')}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e)
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary transition-colors hover:bg-primary/25"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1">{label}</span>
      {url && <audio ref={audioRef} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />}
    </span>
  )
}

/** multiple_choice and audio_choice. Audio choice shows the prompt player above and two columns when wide. */
export function ChoiceTiles({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const isAudio = q.question_type === 'audio_choice'
  const mode = isAudio ? ((opts.optionMode as 'text' | 'audio') ?? 'text') : 'text'
  const choices = ((opts.choices as (Choice | AudioChoice)[]) ?? []).slice(0, LETTERS.length)
  return (
    <div className="grid gap-3.5">
      {isAudio && q.audio_url && <AudioPrompt src={q.audio_url} />}
      <div role="radiogroup" className={cn('grid gap-2.5', isAudio && styles.tilesWide)}>
        {choices.map((c, i) => (
          <OptionTile
            key={c.id}
            letter={LETTERS[i]}
            hint={String(i + 1)}
            state={tileState(q.correct_answer === c.id, answer === c.id, isGraded)}
            disabled={isGraded}
            onClick={() => onChange(c.id)}
          >
            {mode === 'audio' ? (
              <AudioChoicePlayer url={(c as AudioChoice).audioUrl} label={c.text?.trim() || t('dashboard.classViewer.quiz.clip', { n: i + 1 })} />
            ) : (
              c.text
            )}
          </OptionTile>
        ))}
      </div>
    </div>
  )
}

/** true_false as two large cards. T and F keys are handled by the focus stage; the hints show them. */
export function TrueFalseTiles({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const values = [
    { v: 'true', label: t('dashboard.classViewer.quiz.true'), key: 'T' },
    { v: 'false', label: t('dashboard.classViewer.quiz.false'), key: 'F' },
  ]
  const picked = norm(String(answer ?? ''))
  const correct = norm(q.correct_answer ?? '')
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {values.map(({ v, label, key }) => (
        <OptionTile key={v} size="big" letter={key} hint={key} state={tileState(correct === v, picked === v, isGraded)} disabled={isGraded} onClick={() => onChange(v)}>
          {label}
        </OptionTile>
      ))}
    </div>
  )
}
