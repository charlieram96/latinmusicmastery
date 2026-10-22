'use client'

// The L2 lesson frame: rail | (top bar / stage / action bar), plus the About &
// comments drawer and the end-of-lesson celebration. Server-rendered content
// arrives as slots (body, comments). Parts reach the action bar through the
// LessonFrame context (see lesson-frame.tsx).

import { useLearningMode } from '@/components/learning-mode/store'
import { TimbalitoContext, TimbalitoGuide } from '@/components/learning-mode/timbalito'
import { timbalScene } from '@/components/learning-mode/theater/timbal-scenes'
import { TimbalTheater, TheaterClassContext } from '@/components/learning-mode/theater/timbal-theater'
import { LessonNarration } from '@/components/lesson-narration/lesson-narration'
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
import { LessonSequence } from './lesson-sequence'
import { CourseSequenceContext } from '@/components/solfeo/course-sequence-navigation'
import { activitySequence } from '@/lib/courses/activity-sequence'
import { LessonActionBar } from './lesson-action-bar'
import { LessonRail, LessonRailList } from './lesson-rail'
import { LessonTopBar, type TopBarPart } from './lesson-top-bar'
import { LessonDrawer, type LessonMeta } from './lesson-drawer'
import { LessonDone, type NextLessonCard } from './lesson-done'
import { LessonSidebar, type LessonSidebarSection } from '../lesson-sidebar'
import './lesson-mode.css'

export interface LessonModeShellProps {
  course: { id: string; title: string }
  module: { id: string; title: string; index: number }
  lesson: { id: string; title: string }
  rail: RailLesson[]
  sections?: LessonSidebarSection[]
  hasAccess?: boolean
  parts: TopBarPart[]
  activeIndex: number
  /** Null for a paywalled lesson: no parts to complete. */
  progress: LessonProgressInput | null
  /** Completion day keys (the dashboard's streak source), today's key, and how many of today's keys
      are this lesson's parts (so the celebration's "before" is the state before this lesson). */
  practice: { dateKeys: string[]; today: string; lessonToday?: number } | null
  about: { description: string | null; meta: LessonMeta }
  comments: ReactNode
  commentCount: number
  teacherName: string | null
  nextLesson: NextLessonCard | null
  theaterEmpty?: boolean
  body: ReactNode
  /** Local previews pass a no-op so nothing writes student progress. */
  saveCompletion?: typeof markClassItemComplete
}

export function LessonModeShell(props: LessonModeShellProps) {
  return <TimbalitoContext.Provider value={/timbal/i.test(props.course.title)}><LessonProgressProvider key={props.lesson.id} itemIds={props.progress?.itemIds ?? []}
    initialCompletedItemIds={props.progress?.completedItemIds ?? []} saveCompletion={props.saveCompletion}>
    <LessonModeFrame {...props} />
  </LessonProgressProvider></TimbalitoContext.Provider>
}

function LessonModeFrame({ course, module, lesson, rail, parts, activeIndex, progress, practice, about, comments, commentCount,
  teacherName, nextLesson, body, sections, theaterEmpty = false, hasAccess = false }: LessonModeShellProps) {
  const { t, locale } = useTranslation()
  const learningMode = useLearningMode()
  const router = useRouter()
  const live = useLessonProgress()
  const claims = useActionClaims()
  const [transportHost, setTransportHost] = useState<HTMLElement | null>(null)
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null)
  const [clipsHost, setClipsHost] = useState<HTMLElement | null>(null)
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [footerCollapsed, setFooterCollapsed] = useState(false)
  const [footerSpace, setFooterSpace] = useState(0)
  const footerContent = useRef<HTMLDivElement>(null)
  const footerId = useId()
  const hideFooter = footerCollapsed
  const discussionRef = useRef<HTMLElement>(null)
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
  const stats = useMemo(() => practice ? celebrationStats(practice.dateKeys, practice.today, finishedHere, practice.lessonToday ?? 0) : null, [practice, finishedHere])

  // advance() is stable (it reads the latest state from a ref) so the frame
  // value, and every part reading it, does not change on each shell render.
  const latest = useRef({ summary, celebrate, courseHref, router })
  useLayoutEffect(() => { latest.current = { summary, celebrate, courseHref, router } })
  const advance = useCallback(() => {
    const { summary, celebrate, courseHref, router } = latest.current
    if (!summary) { router.push(courseHref); return }
    if (celebrate) setCelebrating(true)
    else router.push(summary.nextHref)
  }, [])

  const onPrimary = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!celebrate) return
    // A new tab / window (ctrl, cmd, shift, middle click) opens the link as usual.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setCelebrating(true)
  }

  const frame = useMemo(() => ({ registerTransport: setTransportHost, actionHost, clipsHost, topClaim: claims.top, claim: claims.claim, advance, teacherName }),
    [actionHost, clipsHost, claims.top, claims.claim, advance, teacherName])

  const narrationTarget = useRef<HTMLDivElement|null>(null)
  const isNarratedLesson = parts[activeIndex]?.item_type === 'VIDEO'
  const sequence = activitySequence({ courseId: course.id, classId: lesson.id,
    classes: sections?.flatMap(section => section.classes) ?? rail, parts, activeIndex, t })
  if (!sections && !sequence.next && nextLesson) sequence.next = { ...nextLesson, classId: '' }
  return <CourseSequenceContext.Provider value={sequence}><LessonFrameProvider value={frame}>
    <WorkspaceToolsSlotProvider host={toolsHost}>
      <div data-lesson-shell data-kids-world={learningMode === 'kids'} data-lesson-mode className="lx" data-course-navigation={!!sections} data-navigation-collapsed={sidebarCollapsed}
        style={{ '--lesson-footer-space': `${hideFooter ? footerSpace : 0}px` } as CSSProperties}>
        {sections ? <LessonSidebar courseId={course.id} currentClassId={lesson.id} sections={sections.map(section => ({ ...section,
          completedItems: section.completedItems + (section.classes.some(item => item.id === lesson.id) ? added : 0),
          classes: section.classes.map(item => item.id === lesson.id ? { ...item, completedItems: Math.min(item.totalItems, item.completedItems + added) } : item),
        }))} courseTitle={course.title} teacherName={teacherName} hasAccess={hasAccess}
          collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
          : <LessonRail courseHref={courseHref} courseTitle={course.title} moduleTitle={module.title} moduleIndex={module.index}
          lessons={rail} currentDone={!!summary?.lessonDone} />}
        <div className="lx-main">
          <LessonTopBar courseTitle={course.title} courseHref={courseHref} moduleTitle={module.title}
            moduleHref={moduleOverviewHref(course.id, module.id)} title={lesson.title} parts={parts} activeIndex={activeIndex}
            completedItemIds={completedItemIds} activeStatus={progress?.activeItemId ? live?.items[progress.activeItemId]?.status : undefined}
            courseId={course.id} classId={lesson.id} streak={stats?.streak.after ?? 0} onOpenDrawer={() => setDrawerOpen(true)} />
          <main data-dashboard-main data-lesson-stage className="lx-stage">
            <div className="lx-fill" hidden={celebrating} inert={celebrating}>
              {learningMode === 'kids' && /timbal/i.test(course.title) && !['VIDEO','QUIZ'].includes(parts[activeIndex]?.item_type) && <div data-shell-timbalito className="flex justify-end"><TimbalitoGuide compact/></div>}
              {!theaterEmpty && !!timbalScene(lesson.id) ? <TheaterClassContext.Provider value={lesson.id}><div ref={narrationTarget}>{body}</div></TheaterClassContext.Provider> : <TimbalTheater classId={lesson.id} empty={theaterEmpty && progress !== null}><div ref={narrationTarget}>{body}</div></TimbalTheater>}
              {comments != null && <section key={lesson.id} ref={discussionRef} data-lesson-community tabIndex={-1}
                aria-label={t('dashboard.classViewer.lessonMode.drawer.comments')}
                className="mx-auto mt-8 w-full max-w-[1200px] border-t border-border pt-6 pb-4 outline-none">
                {comments}
              </section>}
            </div>
            {celebrating && stats && <LessonDone stats={stats} lessonTitle={lesson.title} partCount={progress?.totalItems ?? 0}
              nextLesson={nextLesson} courseHref={courseHref} />}
          </main>
          <div className="lx-bottom" data-collapsed={hideFooter}>
            <button type="button" className="lx-bottom-toggle"
              aria-expanded={!hideFooter} aria-controls={footerId}
              aria-label={locale === 'es' ? (hideFooter ? 'Mostrar controles y navegación' : 'Recoger controles y navegación') : (hideFooter ? 'Show controls and navigation' : 'Collapse controls and navigation')}
              title={locale === 'es' ? (hideFooter ? 'Mostrar controles y navegación' : 'Recoger controles y navegación') : (hideFooter ? 'Show controls and navigation' : 'Collapse controls and navigation')}
              onClick={() => {
                if (!hideFooter) setFooterSpace(Math.max(0, (footerContent.current?.getBoundingClientRect().height ?? 0) - 12))
                setFooterCollapsed(value => !value)
              }}>{hideFooter ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
            <div id={footerId} ref={footerContent} hidden={hideFooter}>
            <LessonActionBar transportHost={celebrating ? null : transportHost} narration={!transportHost && isNarratedLesson && !celebrating ? <LessonNarration target={narrationTarget} resetKey={`${lesson.id}:${activeIndex}`}/> : null} progress={progress} claimed={claims.claimed} tone={claims.tone} onActionHost={setActionHost}
            onClipsHost={learningMode === 'kids' ? setClipsHost : undefined} onToolsHost={setToolsHost} onPrimary={onPrimary} primaryLabel={celebrate ? t('dashboard.classViewer.lessonMode.finishLesson') : null} />
          <LessonSequence course={course} lesson={lesson} sections={sections} rail={rail} parts={parts} activeIndex={activeIndex} nextLesson={nextLesson} />
            </div>
          </div>
        </div>
        <LessonDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title={lesson.title} description={about.description}
          meta={about.meta} comments={comments == null ? null : <button type="button"
            className="rounded-lg border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/25"
            onClick={() => {
              setDrawerOpen(false)
              setCelebrating(false)
              requestAnimationFrame(() => {
                discussionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                discussionRef.current?.focus({ preventScroll: true })
              })
            }}>{locale === 'es' ? 'Ver conversación debajo de la lección' : 'View discussion below the lesson'}</button>} commentCount={commentCount}
          lessons={<LessonRailList lessons={rail} open />} />
      </div>
    </WorkspaceToolsSlotProvider>
  </LessonFrameProvider></CourseSequenceContext.Provider>
}
