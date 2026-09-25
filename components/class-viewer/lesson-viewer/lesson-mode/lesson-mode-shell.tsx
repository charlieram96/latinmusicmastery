'use client'

// The L2 lesson frame: rail | (top bar / stage / action bar), plus the About &
// comments drawer and the end-of-lesson celebration. Server-rendered content
// arrives as slots (body, comments). Parts reach the action bar through the
// LessonFrame context (see lesson-frame.tsx).

import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { markClassItemComplete } from '@/app/actions/progress'
import { useTranslation } from '@/components/language-provider'
import { WorkspaceToolsSlotProvider } from '@/components/playsense-studio/player/workspace-tools-slot'
import { summarizeLessonProgress, type LessonProgressInput } from '@/lib/courses/lesson-progress-summary'
import { moduleOverviewHref } from '@/lib/courses/structure'
import type { RailLesson } from '@/lib/courses/lesson-rail'
import { celebrationStats } from '@/lib/dashboard/lesson-celebration'
import { LessonProgressProvider, useLessonProgress } from '../lesson-progress-context'
import { LessonFrameProvider, useActionClaims } from './lesson-frame'
import { LessonActionBar } from './lesson-action-bar'
import { LessonRail, LessonRailList } from './lesson-rail'
import { LessonTopBar, type TopBarPart } from './lesson-top-bar'
import { LessonDrawer, type LessonMeta } from './lesson-drawer'
import { LessonDone, type NextLessonCard } from './lesson-done'
import './lesson-mode.css'

export interface LessonModeShellProps {
  course: { id: string; title: string }
  module: { id: string; title: string; index: number }
  lesson: { id: string; title: string }
  rail: RailLesson[]
  parts: TopBarPart[]
  activeIndex: number
  /** Null for a paywalled lesson: no parts to complete. */
  progress: LessonProgressInput | null
  /** Completion day keys (the dashboard's streak source) and today's key. */
  practice: { dateKeys: string[]; today: string } | null
  about: { description: string | null; meta: LessonMeta }
  comments: ReactNode
  commentCount: number
  teacherName: string | null
  nextLesson: NextLessonCard | null
  body: ReactNode
  /** Local previews pass a no-op so nothing writes student progress. */
  saveCompletion?: typeof markClassItemComplete
}

export function LessonModeShell(props: LessonModeShellProps) {
  return <LessonProgressProvider key={props.lesson.id} itemIds={props.progress?.itemIds ?? []}
    initialCompletedItemIds={props.progress?.completedItemIds ?? []} saveCompletion={props.saveCompletion}>
    <LessonModeFrame {...props} />
  </LessonProgressProvider>
}

function LessonModeFrame({ course, module, lesson, rail, parts, activeIndex, progress, practice, about, comments, commentCount,
  teacherName, nextLesson, body }: LessonModeShellProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const live = useLessonProgress()
  const claims = useActionClaims()
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null)
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Opening another part (a tab, browser Back) leaves the celebration.
  const [celebratedPart, setCelebratedPart] = useState(activeIndex)
  if (celebrating && celebratedPart !== activeIndex) setCelebrating(false)
  if (!celebrating && celebratedPart !== activeIndex) setCelebratedPart(activeIndex)

  const courseHref = `/dashboard/course/${course.id}`
  const completedItemIds = live?.completedItemIds ?? progress?.completedItemIds ?? []
  const added = progress ? completedItemIds.filter(id => !progress.completedItemIds.includes(id)).length : 0
  const summary = progress
    ? summarizeLessonProgress(progress, { completedItemIds, item: progress.activeItemId ? live?.items[progress.activeItemId] : undefined })
    : null
  // A part whose save is still in flight counts as finished for the celebration:
  // the student has done the work, and a failed save keeps its Retry in the bar.
  const saving = progress ? progress.itemIds.filter(id => live?.items[id]?.status === 'saving' && !completedItemIds.includes(id)) : []
  const finishedHere = added + saving.length
  const lessonFinished = !!progress && progress.totalItems > 0 && completedItemIds.filter(id => progress.itemIds.includes(id)).length + saving.length === progress.totalItems
  // Celebrate only a lesson finished in this visit, from its last part.
  const celebrate = !!practice && !!summary && !summary.hasNextPart && lessonFinished && finishedHere > 0
  const stats = useMemo(() => practice ? celebrationStats(practice.dateKeys, practice.today, finishedHere) : null, [practice, finishedHere])

  const advance = useCallback(() => {
    if (!summary) { router.push(courseHref); return }
    if (celebrate) setCelebrating(true)
    else router.push(summary.nextHref)
  }, [summary, celebrate, router, courseHref])

  const onPrimary = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!celebrate) return
    event.preventDefault()
    setCelebrating(true)
  }

  const frame = useMemo(() => ({ actionHost, topClaim: claims.top, claim: claims.claim, advance, teacherName }),
    [actionHost, claims.top, claims.claim, advance, teacherName])

  return <LessonFrameProvider value={frame}>
    <WorkspaceToolsSlotProvider host={toolsHost}>
      <div data-lesson-shell data-lesson-mode className="lx">
        <LessonRail courseHref={courseHref} courseTitle={course.title} moduleTitle={module.title} moduleIndex={module.index}
          lessons={rail} currentDone={!!summary?.lessonDone} />
        <div className="lx-main">
          <LessonTopBar courseTitle={course.title} courseHref={courseHref} moduleTitle={module.title}
            moduleHref={moduleOverviewHref(course.id, module.id)} title={lesson.title} parts={parts} activeIndex={activeIndex}
            completedItemIds={completedItemIds} activeStatus={progress?.activeItemId ? live?.items[progress.activeItemId]?.status : undefined}
            courseId={course.id} classId={lesson.id} streak={stats?.streak.after ?? 0} onOpenDrawer={() => setDrawerOpen(true)} />
          <main data-dashboard-main data-lesson-stage className="lx-stage">
            <div className="lx-fill" hidden={celebrating} inert={celebrating}>{body}</div>
            {celebrating && stats && <LessonDone stats={stats} lessonTitle={lesson.title} partCount={progress?.totalItems ?? 0}
              nextLesson={nextLesson} courseHref={courseHref} />}
          </main>
          <LessonActionBar progress={progress} claimed={claims.claimed} tone={claims.tone} onActionHost={setActionHost}
            onToolsHost={setToolsHost} onPrimary={onPrimary} primaryLabel={celebrate ? t('dashboard.classViewer.lessonMode.finishLesson') : null} />
        </div>
        <LessonDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title={lesson.title} description={about.description}
          meta={about.meta} comments={comments} commentCount={commentCount}
          lessons={<LessonRailList lessons={rail} open />} />
      </div>
    </WorkspaceToolsSlotProvider>
  </LessonFrameProvider>
}
