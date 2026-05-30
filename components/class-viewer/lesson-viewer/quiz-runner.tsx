'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markClassItemComplete } from '@/app/actions/progress'
import type { QuizQuestion } from '@/types/modules'

interface QuizRunnerProps {
  classItemId: string
  questions: QuizQuestion[]
  /** Label shown in the header — "Quiz" or "Exercise". */
  kind?: 'Quiz' | 'Exercise'
}

type Choice = { id: string; text: string }
type Pair = { id: string; left: string; right: string }
type Blank = { id: string; answer: string }
type OrderItem = { id: string; text: string; correctPosition: number }

function norm(s: string) {
  return s.toLowerCase().trim()
}

/**
 * Grade a single question against the student's answer.
 * The `answer` shape depends on question_type (see each input renderer below).
 */
function gradeQuestion(q: QuizQuestion, answer: unknown): boolean {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
      // answer = selected choice id; correct_answer = correct choice id
      return typeof answer === 'string' && !!q.correct_answer && answer === q.correct_answer
    case 'true_false':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'text_answer':
    case 'audio':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      return blanks.length > 0 && blanks.every((b) => norm(given[b.id] ?? '') === norm(b.answer))
    }
    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      // given maps left.id -> chosen right text
      return pairs.length > 0 && pairs.every((p) => norm(given[p.id] ?? '') === norm(p.right))
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      const order = (answer as string[]) ?? [] // array of item ids in student's order
      if (order.length !== items.length || items.length === 0) return false
      const byId = new Map(items.map((it) => [it.id, it]))
      return order.every((id, idx) => byId.get(id)?.correctPosition === idx)
    }
    default:
      return false
  }
}

export function QuizRunner({ classItemId, questions, kind = 'Quiz' }: QuizRunnerProps) {
  const ordered = useMemo(
    () => [...questions].sort((a, b) => a.order_index - b.order_index),
    [questions]
  )
  const [index, setIndex] = useState(0)
  // Pre-seed ordering questions with a stable shuffled order so grading has a
  // defined answer even if the student never reorders.
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const qq of questions) {
      if (qq.question_type === 'ordering_sequence') {
        const items = ((qq.options ?? {}) as Record<string, unknown>).items as OrderItem[] | undefined
        init[qq.id] = shuffleStable((items ?? []).map((it) => it.id), qq.id)
      }
    }
    return init
  })
  const [graded, setGraded] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)

  if (ordered.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          This {kind.toLowerCase()} has no questions yet.
        </CardContent>
      </Card>
    )
  }

  const q = ordered[index]
  const isGraded = q.id in graded
  const answer = answers[q.id]

  const setAnswer = (value: unknown) => setAnswers((prev) => ({ ...prev, [q.id]: value }))

  const hasAnswer = (() => {
    if (q.question_type === 'fill_in_blank' || q.question_type === 'matching_pairs') {
      return answer && Object.keys(answer as object).length > 0
    }
    if (q.question_type === 'ordering_sequence') return true // always has an order
    return typeof answer === 'string' && answer.trim().length > 0
  })()

  const handleCheck = () => {
    const correct = gradeQuestion(q, answer)
    setGraded((prev) => ({ ...prev, [q.id]: correct }))
  }

  const handleNext = async () => {
    if (index < ordered.length - 1) {
      setIndex(index + 1)
    } else {
      setFinished(true)
      // Mark the class item complete once the student reaches the end.
      await markClassItemComplete(classItemId).catch(() => {})
    }
  }

  const handleRestart = () => {
    setAnswers({})
    setGraded({})
    setIndex(0)
    setFinished(false)
  }

  if (finished) {
    const correctCount = ordered.filter((qq) => graded[qq.id]).length
    const pct = Math.round((correctCount / ordered.length) * 100)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{kind} complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-4xl font-black">
              {correctCount}/{ordered.length}
            </p>
            <p className="text-muted-foreground mt-1">{pct}% correct</p>
          </div>
          <div className="space-y-2">
            {ordered.map((qq, i) => (
              <div
                key={qq.id}
                className="flex items-center gap-3 text-sm p-3 rounded-lg border border-border"
              >
                {graded[qq.id] ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  {i + 1}. {qq.question}
                </span>
              </div>
            ))}
          </div>
          <Button onClick={handleRestart} variant="outline" className="w-full" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const correct = graded[q.id]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {kind}: Question {index + 1} of {ordered.length}
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {Object.keys(graded).length}/{ordered.length} answered
          </span>
        </div>
        {/* progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted mt-2 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(index / ordered.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg font-medium">{q.question}</p>

        <QuestionInput
          question={q}
          answer={answer}
          disabled={isGraded}
          onChange={setAnswer}
        />

        {/* Feedback */}
        {isGraded && (
          <div
            className={cn(
              'p-4 rounded-lg border-2',
              correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            )}
          >
            <div className="flex items-start gap-3">
              {correct ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={cn(
                    'font-semibold',
                    correct ? 'text-green-900' : 'text-red-900'
                  )}
                >
                  {correct ? 'Correct!' : 'Not quite right'}
                </p>
                {q.explanation && (
                  <p
                    className={cn(
                      'text-sm mt-1',
                      correct ? 'text-green-700' : 'text-red-700'
                    )}
                  >
                    {q.explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          {!isGraded ? (
            <Button onClick={handleCheck} disabled={!hasAnswer} size="lg">
              Check Answer
            </Button>
          ) : (
            <Button onClick={handleNext} size="lg">
              {index < ordered.length - 1 ? 'Next' : 'Finish'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Per-type input widgets ──────────────────────────────────────────────
function QuestionInput({
  question: q,
  answer,
  disabled,
  onChange,
}: {
  question: QuizQuestion
  answer: unknown
  disabled: boolean
  onChange: (value: unknown) => void
}) {
  const opts = (q.options ?? {}) as Record<string, unknown>

  switch (q.question_type) {
    case 'multiple_choice': {
      const choices = (opts.choices as Choice[]) ?? []
      return (
        <div className="space-y-2">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(c.id)}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                answer === c.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
                disabled && 'cursor-default opacity-90'
              )}
            >
              {c.text}
            </button>
          ))}
        </div>
      )
    }
    case 'true_false':
      return (
        <div className="flex gap-3">
          {['true', 'false'].map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v)}
              className={cn(
                'flex-1 p-4 rounded-lg border-2 capitalize transition-all',
                answer === v
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )
    case 'text_answer':
    case 'audio':
      return (
        <Input
          placeholder={q.question_type === 'audio' ? 'Type what you hear…' : 'Type your answer…'}
          value={(answer as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const text = (opts.text as string) ?? ''
      const given = (answer as Record<string, string>) ?? {}
      return (
        <div className="space-y-3">
          {text && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {text.replace(/\{\{(\w+)\}\}/g, '____')}
            </p>
          )}
          {blanks.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded min-w-[90px]">
                {b.id}
              </span>
              <Input
                value={given[b.id] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
                placeholder="Your answer"
              />
            </div>
          ))}
        </div>
      )
    }
    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      const rightChoices = shuffleStable(pairs.map((p) => p.right), q.id)
      return (
        <div className="space-y-2">
          {pairs.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{p.left}</span>
              <span className="text-muted-foreground">→</span>
              <Select
                value={given[p.id] ?? ''}
                disabled={disabled}
                onValueChange={(v) => onChange({ ...given, [p.id]: v })}
              >
                <SelectTrigger className="flex-1">
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
          ))}
        </div>
      )
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      // Answer is pre-seeded with a stable shuffled order by the parent.
      const current = (answer as string[]) ?? items.map((it) => it.id)
      const move = (from: number, dir: -1 | 1) => {
        const to = from + dir
        if (to < 0 || to >= current.length) return
        const next = [...current]
        ;[next[from], next[to]] = [next[to], next[from]]
        onChange(next)
      }
      const byId = new Map(items.map((it) => [it.id, it]))
      return (
        <div className="space-y-2">
          {current.map((id, i) => (
            <div key={id} className="flex items-center gap-2 p-3 rounded-lg border border-border">
              <span className="text-sm font-medium w-6">{i + 1}.</span>
              <span className="flex-1 text-sm">{byId.get(id)?.text}</span>
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-6 p-0"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-6 p-0"
                  disabled={disabled || i === current.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
      )
    }
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unsupported question type: {q.question_type}
        </p>
      )
  }
}

// Stable shuffle seeded by a string so option order doesn't reshuffle on every render.
function shuffleStable<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
