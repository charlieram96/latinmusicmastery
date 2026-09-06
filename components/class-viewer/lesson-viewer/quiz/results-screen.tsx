'use client'

import { ArrowRight, Check, ChevronDown, Minus, RotateCcw, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useContainerWidth } from '@/hooks/use-container-width'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import { cn } from '@/lib/utils'
import { outcomeOf, percentScore, totalScore } from '@/lib/quiz/engine'
import { countCorrectPieces, fullCorrectLabel, userAnswerLabel } from '@/lib/quiz/labels'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { Confetti } from './confetti'
import { ScoreRing } from './score-ring'
import { TypeChip } from './type-chip'
import styles from './quiz.module.css'

const REPORT_MIN_WIDTH = 960
type Filter = 'all' | 'missed'

function useTier(pct: number, kind: string) {
  const { t } = useTranslation()
  const headline =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.perfect')
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.greatWork')
        : pct >= 50
          ? t('dashboard.classViewer.quiz.results.niceEffort')
          : t('dashboard.classViewer.quiz.results.keepPracticing')
  const sub =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.nailedIt', { kind: kind.toLowerCase() })
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.gettingHang')
        : t('dashboard.classViewer.quiz.results.reviewAndRetry')
  return { headline, sub }
}

function Stats({ questions, graded }: { questions: QuizQuestion[]; graded: Record<string, number> }) {
  const { t } = useTranslation()
  const correct = questions.filter((q) => (graded[q.id] ?? 0) >= 1).length
  const missed = questions.filter((q) => (graded[q.id] ?? 0) === 0).length
  const partly = questions.length - correct - missed
  const cell = (n: number, label: string, tone: string) => (
    <div className="grid gap-0.5 rounded-xl border border-border bg-sunken p-3 text-center">
      <b className={cn('font-heading text-xl font-extrabold tabular-nums', tone)}>{n}</b>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </div>
  )
  return (
    <div className="grid w-full max-w-[520px] grid-cols-3 gap-2.5">
      {cell(correct, t('dashboard.classViewer.quiz.results.stats.correct'), 'text-success')}
      {cell(partly, t('dashboard.classViewer.quiz.results.stats.partly'), 'text-primary')}
      {cell(missed, t('dashboard.classViewer.quiz.results.stats.missed'), 'text-terracotta')}
    </div>
  )
}

function FilterChips({ filter, setFilter, missed }: { filter: Filter; setFilter: (f: Filter) => void; missed: number }) {
  const { t } = useTranslation()
  const chip = (f: Filter, label: string) => (
    <button
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      className={cn('rounded-full border px-2.5 py-1.5 text-xs transition-colors', filter === f ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center gap-2">
      {chip('all', t('dashboard.classViewer.quiz.review.all'))}
      {chip('missed', t('dashboard.classViewer.quiz.review.missed', { count: missed }))}
    </div>
  )
}

function ReviewList({
  questions,
  answers,
  graded,
  filter,
  openAll,
}: {
  questions: QuizQuestion[]
  answers: Record<string, unknown>
  graded: Record<string, number>
  filter: Filter
  openAll: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const list = questions.filter((q) => filter === 'all' || (graded[q.id] ?? 0) < 1)
  if (list.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.classViewer.quiz.results.nothingMissed')}</p>
  return (
    <div className="grid gap-2">
      {list.map((q) => {
        const score = graded[q.id] ?? 0
        const tone = outcomeOf(score)
        const i = questions.indexOf(q)
        const isOpen = openAll || open === q.id
        const said = q.question_type === 'piece_placement' ? t('dashboard.classViewer.quiz.results.piecesPlaced', countCorrectPieces(q, answers[q.id])) : userAnswerLabel(q, answers[q.id])
        const right = q.question_type === 'true_false' ? t(fullCorrectLabel(q) === 'true' ? 'dashboard.classViewer.quiz.true' : 'dashboard.classViewer.quiz.false') : fullCorrectLabel(q)
        const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
        return (
          <div key={q.id} className="overflow-hidden rounded-[14px] border border-border bg-card">
            <button
              type="button"
              onClick={() => !openAll && setOpen(isOpen ? null : q.id)}
              className={cn('grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left', !openAll && 'hover:bg-foreground/3')}
            >
              <span className={cn('grid h-[26px] w-[26px] place-items-center rounded-lg text-white', tone === 'ok' && 'bg-success', tone === 'part' && 'bg-primary', tone === 'bad' && 'bg-terracotta')}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium">
                {i + 1}. {q.question}
                <span className="mt-1 block"><TypeChip type={q.question_type} /></span>
              </span>
              {!openAll && <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />}
            </button>
            {isOpen && (
              <div className={cn('grid gap-1.5 px-4 pb-4 pl-[54px] text-[13.5px] leading-relaxed', styles.rise)}>
                {tone !== 'ok' && said && (
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <span className="pt-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t('dashboard.classViewer.quiz.review.youSaid')}</span>
                    <b className={cn('font-semibold', q.question_type !== 'piece_placement' && 'text-terracotta line-through')}>{said}</b>
                  </div>
                )}
                {right && (
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <span className="pt-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t('dashboard.classViewer.quiz.review.answer')}</span>
                    <b className="font-semibold text-success">{right}</b>
                  </div>
                )}
                {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
                {!right && !q.explanation && tone === 'ok' && <p className="text-muted-foreground">{t('dashboard.classViewer.quiz.results.noDetails')}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * End of quiz. Report card (two columns, every answer expanded) when the quiz
 * is at least 960px wide; hero ring with a collapsible review below that.
 */
export function ResultsScreen({
  kind,
  questions,
  answers,
  graded,
  onRestart,
  nextHref = null,
}: {
  kind: string
  questions: QuizQuestion[]
  answers: Record<string, unknown>
  graded: Record<string, number>
  onRestart: () => void
  nextHref?: string | null
}) {
  const { t } = useTranslation()
  const [prefs] = useQuizPrefs()
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const [filter, setFilter] = useState<Filter>('all')
  const total = totalScore(questions, graded)
  const pct = percentScore(questions, graded)
  const { headline, sub } = useTier(pct, kind)
  const missed = questions.filter((q) => (graded[q.id] ?? 0) < 1).length
  const wide = width >= REPORT_MIN_WIDTH
  const scoreLabel = Number.isInteger(total) ? String(total) : total.toFixed(1)

  useEffect(() => {
    playCue(pct >= 70 ? 'fanfare' : 'soft', prefs.sound)
    // play once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = (column: boolean) => (
    <div className={cn('flex flex-wrap justify-center gap-2.5', column && 'w-full flex-col')}>
      {nextHref && (
        <Button asChild size="lg" className={cn('rounded-xl', column && 'w-full')}>
          <Link href={nextHref}>
            {t('dashboard.classViewer.quiz.results.continueNext')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {!wide && missed > 0 && (
        <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setFilter('missed')}>
          {t('dashboard.classViewer.quiz.results.reviewMissed', { count: missed })}
        </Button>
      )}
      <Button variant="outline" size="lg" className={cn('rounded-xl', column && 'w-full')} onClick={onRestart}>
        <RotateCcw className="h-4 w-4" /> {t('dashboard.classViewer.quiz.results.tryAgain')}
      </Button>
    </div>
  )

  const summary = (ringSize: number) => (
    <>
      {pct >= 80 && <Confetti />}
      <span className="font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.results.complete', { kind })}</span>
      <ScoreRing pct={pct} size={ringSize} />
      <h2 className={cn('font-heading text-[28px] font-black tracking-[-0.02em]', styles.bounceIn)}>{headline}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
      <p className="text-sm font-semibold">
        <span className="text-primary">{scoreLabel}</span>
        <span className="text-muted-foreground"> / {questions.length} {t('dashboard.classViewer.quiz.results.correct')}</span>
      </p>
      <Stats questions={questions} graded={graded} />
    </>
  )

  return (
    <div ref={ref}>
      {wide ? (
        <div className="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-[18px]">
          <div className="sticky top-5 grid gap-3.5">
            <div className="relative grid justify-items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card p-6 text-center">
              {summary(132)}
              <div className="mt-3 w-full">{actions(true)}</div>
            </div>
          </div>
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="mr-auto font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.review.titleAll')}</span>
              <FilterChips filter={filter} setFilter={setFilter} missed={missed} />
            </div>
            <ReviewList questions={questions} answers={answers} graded={graded} filter={filter} openAll />
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="relative grid justify-items-center gap-2 overflow-hidden rounded-3xl border border-border bg-card p-6 text-center sm:p-9">
            {summary(156)}
            <div className="mt-3">{actions(false)}</div>
          </div>
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="mr-auto font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.review.title')}</span>
              <FilterChips filter={filter} setFilter={setFilter} missed={missed} />
            </div>
            <ReviewList questions={questions} answers={answers} graded={graded} filter={filter} openAll={false} />
          </div>
        </div>
      )}
    </div>
  )
}
