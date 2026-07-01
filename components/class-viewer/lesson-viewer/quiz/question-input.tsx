'use client'

import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, GripVertical, Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  norm,
  shuffleStable,
  type AssemblyPart,
  type AssemblyZone,
  type AudioChoice,
  type Blank,
  type Choice,
  type OrderItem,
  type Pair,
} from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { InstrumentAssemblyInput } from './instrument-assembly-input'
import { OptionTile, type TileState } from './option-tile'

/** Play/pause control for an audio answer choice. Renders as a span (not a
 *  button) so it can live inside the OptionTile button without nesting. */
function AudioChoicePlayer({ url, label }: { url?: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      el.currentTime = 0
      void el.play()
    }
  }
  return (
    <span className="flex items-center gap-3">
      <span
        role="button"
        tabIndex={0}
        aria-label={playing ? 'Pause clip' : 'Play clip'}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e)
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </span>
      <span className="flex-1">{label}</span>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </span>
  )
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export function QuestionInput({
  question: q,
  answer,
  isGraded,
  onChange,
}: {
  question: QuizQuestion
  answer: unknown
  isGraded: boolean
  onChange: (v: unknown) => void
}) {
  const opts = (q.options ?? {}) as Record<string, unknown>

  switch (q.question_type) {
    case 'multiple_choice': {
      const choices = (opts.choices as Choice[]) ?? []
      return (
        <div className="space-y-3">
          {choices.map((c, i) => {
            const selected = answer === c.id
            let state: TileState = selected ? 'selected' : 'idle'
            if (isGraded) state = q.correct_answer === c.id ? 'correct' : selected ? 'incorrect' : 'idle'
            return (
              <OptionTile key={c.id} label={LETTERS[i]} state={state} disabled={isGraded} onClick={() => onChange(c.id)}>
                {c.text}
              </OptionTile>
            )
          })}
        </div>
      )
    }

    case 'audio_choice': {
      const mode = (opts.optionMode as 'text' | 'audio') ?? 'text'
      const choices = (opts.choices as AudioChoice[]) ?? []
      return (
        <div className="space-y-4">
          {q.audio_url && (
            <div className="rounded-2xl border border-border bg-muted/50 p-3">
              <audio src={q.audio_url} controls className="w-full" />
            </div>
          )}
          <div className="space-y-3">
            {choices.map((c, i) => {
              const selected = answer === c.id
              let state: TileState = selected ? 'selected' : 'idle'
              if (isGraded) state = q.correct_answer === c.id ? 'correct' : selected ? 'incorrect' : 'idle'
              return (
                <OptionTile key={c.id} label={LETTERS[i]} state={state} disabled={isGraded} onClick={() => onChange(c.id)}>
                  {mode === 'audio' ? (
                    <AudioChoicePlayer url={c.audioUrl} label={c.text?.trim() || `Clip ${i + 1}`} />
                  ) : (
                    c.text
                  )}
                </OptionTile>
              )
            })}
          </div>
        </div>
      )
    }

    case 'instrument_assembly': {
      const zones = (opts.zones as AssemblyZone[]) ?? []
      const parts = (opts.parts as AssemblyPart[]) ?? []
      const placement = (answer as Record<string, string>) ?? {}
      return (
        <InstrumentAssemblyInput
          imageUrl={q.image_url}
          zones={zones}
          parts={parts}
          placement={placement}
          isGraded={isGraded}
          onChange={(v) => onChange(v)}
        />
      )
    }

    case 'true_false': {
      const values = [
        { v: 'true', label: 'True' },
        { v: 'false', label: 'False' },
      ]
      return (
        <div className="grid grid-cols-2 gap-3">
          {values.map(({ v, label }) => {
            const selected = norm(String(answer ?? '')) === v
            let state: TileState = selected ? 'selected' : 'idle'
            if (isGraded) state = norm(q.correct_answer ?? '') === v ? 'correct' : selected ? 'incorrect' : 'idle'
            return (
              <OptionTile key={v} state={state} disabled={isGraded} onClick={() => onChange(v)}>
                <span className="block w-full text-center text-lg font-semibold">{label}</span>
              </OptionTile>
            )
          })}
        </div>
      )
    }

    case 'text_answer':
    case 'audio':
      return (
        <Input
          className="h-12 rounded-xl text-base"
          placeholder={q.question_type === 'audio' ? 'Type what you hear…' : 'Type your answer…'}
          value={(answer as string) ?? ''}
          disabled={isGraded}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const text = (opts.text as string) ?? ''
      const given = (answer as Record<string, string>) ?? {}
      const blankById = new Map(blanks.map((b) => [b.id, b]))

      if (text && /\{\{(\w+)\}\}/.test(text)) {
        const parts = text.split(/(\{\{\w+\}\})/g)
        return (
          <p className="text-lg leading-loose">
            {parts.map((part, i) => {
              const m = part.match(/^\{\{(\w+)\}\}$/)
              if (!m) return <span key={i}>{part}</span>
              const id = m[1]
              const b = blankById.get(id)
              const val = given[id] ?? ''
              const ok = isGraded && b && norm(val) === norm(b.answer)
              return (
                <input
                  key={i}
                  value={val}
                  disabled={isGraded}
                  onChange={(e) => onChange({ ...given, [id]: e.target.value })}
                  placeholder="…"
                  className={cn(
                    'mx-1 inline-block w-32 rounded-lg border-b-2 bg-primary/5 px-2 py-0.5 text-center font-semibold outline-none focus:border-primary',
                    isGraded
                      ? ok
                        ? 'border-green-500 text-green-700 dark:text-green-400'
                        : 'border-red-500 text-red-700 dark:text-red-400'
                      : 'border-primary/40',
                  )}
                />
              )
            })}
          </p>
        )
      }

      // Fallback: labeled inputs when there is no placeholder text.
      return (
        <div className="space-y-3">
          {blanks.map((b) => {
            const val = given[b.id] ?? ''
            const ok = isGraded && norm(val) === norm(b.answer)
            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className="min-w-[90px] rounded-lg bg-muted px-2 py-1 font-mono text-xs">{b.id}</span>
                <Input
                  value={val}
                  disabled={isGraded}
                  onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
                  placeholder="Your answer"
                  className={cn('rounded-xl', isGraded && (ok ? 'border-green-500' : 'border-red-500'))}
                />
              </div>
            )
          })}
        </div>
      )
    }

    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      const rightChoices = shuffleStable(pairs.map((p) => p.right), q.id)
      return (
        <div className="space-y-3">
          {pairs.map((p) => {
            const val = given[p.id] ?? ''
            const ok = isGraded && norm(val) === norm(p.right)
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors',
                  isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border',
                )}
              >
                <span className="flex-1 font-medium">{p.left}</span>
                <span className="text-muted-foreground">→</span>
                <Select value={val} disabled={isGraded} onValueChange={(v) => onChange({ ...given, [p.id]: v })}>
                  <SelectTrigger className="flex-1 rounded-xl">
                    <SelectValue placeholder="Choose match" />
                  </SelectTrigger>
                  <SelectContent>
                    {rightChoices.map((r, i) => (
                      <SelectItem key={`${r}-${i}`} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )
    }

    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      const current = (answer as string[]) ?? items.map((it) => it.id)
      const byId = new Map(items.map((it) => [it.id, it]))
      const move = (from: number, dir: -1 | 1) => {
        const to = from + dir
        if (to < 0 || to >= current.length) return
        const next = [...current]
        ;[next[from], next[to]] = [next[to], next[from]]
        onChange(next)
      }
      return (
        <div className="space-y-2">
          {current.map((id, i) => {
            const it = byId.get(id)
            const ok = isGraded && it?.correctPosition === i
            return (
              <motion.div
                key={id}
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-3',
                  isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border bg-card',
                )}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{it?.text}</span>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={isGraded || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isGraded || i === current.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )
    }

    default:
      return <p className="text-sm text-muted-foreground">Unsupported question type: {q.question_type}</p>
  }
}
