'use client'

// Lesson done (L2): a full-width celebration over the stage. The streak flame
// with the day count flipping in, the weekly goal (lessons against WEEK_GOAL,
// the dashboard's count) with today's lessons popping in, achievement progress
// growing from where it was, and the next lesson. Actions live in the bar.

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, BookOpen, ChevronRight, Crown, Flame, Music2, ListChecks, Star, Target, Trophy, Video, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { CelebrationStats } from '@/lib/dashboard/lesson-celebration'
import type { PathLessonType } from '@/lib/courses/path-nodes'
import { Confetti } from '../quiz/confetti'
import { ActionMessage, LessonAction } from './lesson-frame'
import './lesson-mode.css'

const MILESTONE_ICON: Record<string, typeof Star> = { Star, Flame, Zap, Target, Trophy, Crown, BookOpen }
const KIND_ICON: Record<PathLessonType, typeof Star> = { video: Video, play: Music2, quiz: ListChecks, other: BookOpen }
const pct = (value: number, goal: number) => `${Math.round(Math.min(1, goal > 0 ? value / goal : 0) * 100)}%`

export interface NextLessonCard { title: string; kind: PathLessonType; minutes: number | null; href: string }

export function LessonDone({ stats, lessonTitle, partCount, nextLesson, courseHref }: {
  stats: CelebrationStats
  lessonTitle: string
  partCount: number
  nextLesson: NextLessonCard | null
  courseHref: string
}) {
  const { t } = useTranslation()
  const base = 'dashboard.classViewer.lessonMode.done'
  const { streak, week } = stats
  const toGo = Math.max(0, week.goal - week.after)
  const KindIcon = nextLesson ? KIND_ICON[nextLesson.kind] : BookOpen

  return <section data-lesson-done className="lx-done" aria-labelledby="lx-done-title">
    <Confetti />
    <div className="lx-dn-hero">
      <div className="lx-streak-big" role="img" aria-label={`${streak.after} ${t(streak.after === 1 ? `${base}.streakOne` : `${base}.streak`)}`}>
        <span className="lx-flame" aria-hidden><Flame className="h-full w-full" strokeWidth={1.4} /></span>
        <span className="lx-flip tabular-nums" aria-hidden>
          {streak.before !== streak.after && <span className="lx-flip-old">{streak.before}</span>}
          <span data-streak-value className={cn(streak.before !== streak.after && 'lx-flip-new')}>{streak.after}</span>
        </span>
        <b aria-hidden>{t(streak.after === 1 ? `${base}.streakOne` : `${base}.streak`)}</b>
      </div>
      <div className="lx-dn-copy">
        <span className="lx-eyebrow">{t(`${base}.eyebrow`)}</span>
        <h2 id="lx-done-title">{t(`${base}.heading`, { title: lessonTitle })}</h2>
        <p className="text-muted-foreground">
          {t(week.after === 1 ? `${base}.weekOne` : `${base}.week`, { count: week.after, goal: week.goal })}.{' '}
          {toGo === 0 ? t(`${base}.goalMet`) : t(toGo === 1 ? `${base}.toGoOne` : `${base}.toGo`, { count: toGo })}
        </p>
        <div className="lx-week" role="img" aria-label={t(`${base}.weekLabel`)}>
          {Array.from({ length: week.goal }, (_, i) => {
            const state = i < Math.min(week.before, week.goal) ? 'done' : i < Math.min(week.after, week.goal) ? 'new' : 'todo'
            return <i key={i} data-week-segment data-state={state} style={{ animationDelay: `${300 + (i - week.before) * 120}ms` }} />
          })}
        </div>
      </div>
    </div>

    <div className="lx-dn-grid">
      {stats.milestones.map(m => {
        const Icon = MILESTONE_ICON[m.iconName] ?? Star
        const unlocked = m.after >= m.requirement
        return <div key={m.key} data-milestone className="lx-ach">
          <span className="lx-medal" aria-hidden><Icon className="h-5 w-5" /></span>
          <div className="grid min-w-0 gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <b className="truncate">{m.title}</b>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {unlocked ? t(`${base}.unlocked`) : t(m.unit === 'lessons' ? `${base}.lessonsProgress` : `${base}.daysProgress`, { value: m.after, goal: m.requirement })}
              </span>
            </div>
            <div className="lx-bar-fill"><i data-milestone-bar style={{ '--from': pct(m.before, m.requirement), '--to': pct(m.after, m.requirement) } as CSSProperties} /></div>
          </div>
        </div>
      })}
      {nextLesson && <Link href={nextLesson.href} data-next-lesson-card className="lx-next">
        <span className="lx-next-art" aria-hidden><KindIcon className="h-7 w-7" /></span>
        <span className="grid min-w-0">
          <span className="lx-eyebrow">{t(`${base}.upNext`)}</span>
          <b className="truncate">{nextLesson.title}</b>
          <span className="text-xs text-muted-foreground">
            {t(`dashboard.classViewer.lessonMode.rail.kind.${nextLesson.kind}`)}
            {nextLesson.minutes != null && <> · {t('dashboard.classViewer.lessonMode.rail.minutes', { count: nextLesson.minutes })}</>}
          </span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 text-muted-foreground" />
      </Link>}
    </div>

    <LessonAction tone="success">
      <ActionMessage live icon={<Trophy className="h-5 w-5" />} title={t(`${base}.saved`)}
        detail={nextLesson ? t(partCount === 1 ? `${base}.savedDetailOne` : `${base}.savedDetail`, { title: lessonTitle, count: partCount }) : t(`${base}.courseDone`)} />
      <Button asChild variant={nextLesson ? 'chunky-ghost' : 'chunky'} data-primary={nextLesson ? undefined : ''}>
        <Link href={courseHref} data-done-back>{t('dashboard.classViewer.lessonMode.backToCourse')}</Link>
      </Button>
      {nextLesson && <Button asChild variant="chunky" data-primary="">
        <Link href={nextLesson.href} data-done-next>{t(`${base}.nextLesson`)}<ArrowRight className="h-4 w-4" /></Link>
      </Button>}
    </LessonAction>
  </section>
}
