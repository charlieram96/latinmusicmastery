'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Disc3,
  Globe,
  Headphones,
  Lock,
  Music,
  Play,
  Plus,
  RotateCcw,
  Target,
  Video,
} from 'lucide-react'
import { HeaderTitleOverride } from '@/components/dashboard/header-title-override'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'
import { LevelDot } from '@/components/dashboard/course-poster'
import { MobileCourseBar } from '@/components/course/mobile-course-bar'
import { PathStrip } from '@/components/course/path-strip'
import { ProgressRing } from '@/components/course/progress-ring'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/components/language-provider'
import { addCourseToSubscription } from '@/app/actions/billing'
import { coverStyle } from '@/lib/course-covers'
import { initialsFor } from '@/lib/dashboard/initials'
import { formatCents } from '@/lib/payments/pricing-types'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'
import { cn } from '@/lib/utils'
import { moduleOverviewHref } from '@/lib/courses/structure'
import { buildPathNodes } from '@/lib/courses/path-nodes'
import { lessonSegments, syllabusWindow } from './syllabus-window'

interface ClassItem {
  id: string
  item_type: string | null
  video_duration_seconds: number | null
}
interface ClassRow {
  id: string
  title: string | null
  is_free: boolean | null
  items: ClassItem[]
  totalItems: number
  completedItems: number
}
interface SectionRow {
  id: string
  title: string | null
  description: string | null
  classes: ClassRow[]
}

interface CourseDetailViewProps {
  course: {
    id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    preview_video_url: string | null
    instrument: string | null
    difficulty: string | null
    is_fundamentals: boolean | null
  }
  courseId: string
  style: { name: string } | null
  country: { name: string } | null | undefined
  teacher: { id: string; name: string; instrument: string | null; image_url: string | null; bio: unknown } | null
  difficultyKey: 'beginner' | 'intermediate' | 'advanced'
  difficultyColor: string
  totalItems: number
  completedItems: number
  totalDurationMinutes: number
  remainingDuration: number
  progressPercentage: number
  nextClassId: string | null
  sections: SectionRow[]
  hasStarted: boolean
  isStudent: boolean
  locked: boolean
  canAddToPlan: boolean
  addonPriceCents: number
}

const base = 'dashboard.pages.course'

export function CourseDetailView({
  course,
  courseId,
  style,
  country,
  teacher,
  difficultyKey,
  totalItems,
  completedItems,
  totalDurationMinutes,
  remainingDuration,
  progressPercentage,
  nextClassId,
  sections,
  hasStarted,
  isStudent,
  locked,
  canAddToPlan,
  addonPriceCents,
}: CourseDetailViewProps) {
  const { t } = useTranslation()
  const [pending, startTransition] = useTransition()
  const [addError, setAddError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Modules the student expanded with "Show all N lessons".
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const nextClassHref = nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : undefined
  const classes = sections.flatMap((s) => s.classes ?? [])
  const totalLessons = classes.length
  const classDone = (c: ClassRow) => c.totalItems > 0 && c.completedItems === c.totalItems
  const doneLessons = classes.filter(classDone).length
  const currentIndex = nextClassId ? classes.findIndex((c) => c.id === nextClassId) : -1
  const currentClass = currentIndex >= 0 ? classes[currentIndex] : null
  // Finished = every item done. Lessons with no items yet never block this (the
  // server's nextClassId skips them too), so it is not "every lesson done".
  const courseFinished = totalItems > 0 && completedItems >= totalItems
  const firstLesson = classes.find((c) => c.totalItems > 0) ?? classes[0]
  const reviewHref = firstLesson ? `/dashboard/course/${courseId}/class/${firstLesson.id}` : undefined
  const subscribeHref = `/dashboard/subscribe?instrument=${encodeURIComponent(course.instrument ?? '')}&course=${course.id}`
  // One link rule for syllabus rows and path nodes: non-students go to subscribe unless the lesson is free.
  const lessonHref = (c: ClassRow) => (isStudent || !!c.is_free ? `/dashboard/course/${courseId}/class/${c.id}` : subscribeHref)
  const levelLabel = course.difficulty ? t(`${base}.difficulty.${difficultyKey}`) : t(`${base}.allLevels`)
  const minutes = (n: number) => {
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return h > 0 ? t('common.duration.hoursMinutes', { h, m }) : t('common.duration.minutes', { m })
  }
  const classMinutes = (c: ClassRow) =>
    Math.round((c.items ?? []).reduce((s, it) => s + (it.item_type === 'VIDEO' ? it.video_duration_seconds ?? 0 : 0), 0) / 60)
  const itemKinds = (c: ClassRow) =>
    [...new Set((c.items ?? []).map((it) => it.item_type).filter((k): k is string => !!k))]
      .map((k) => t(`${base}.itemTypes.${k}`))
      .join(' · ')
  const moduleTitle = (s: SectionRow, si: number) => s.title || t(`${base}.syllabus.moduleFallback`, { number: si + 1 })

  // The full-course lesson path ("Your path").
  const pathNodes = useMemo(() => {
    let n = 0
    return buildPathNodes(
      courseId,
      sections.map((s, si) => ({
        id: s.id,
        title: moduleTitle(s, si),
        classes: (s.classes ?? []).map((c) => {
          n += 1
          return {
            id: c.id,
            title: c.title || t(`${base}.syllabus.lessonFallback`, { number: n }),
            totalItems: c.totalItems,
            completedItems: c.completedItems,
            href: lessonHref(c),
            items: (c.items ?? []).flatMap((it) => (it.item_type ? [{ item_type: it.item_type, video_duration_seconds: it.video_duration_seconds }] : [])),
          }
        }),
      })),
      nextClassId
    )
    // moduleTitle only depends on t; lessonHref on the ids and isStudent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, sections, nextClassId, t, isStudent, course.id, course.instrument])

  // The summary card's progress line, shared with the phone bar.
  const progressTitle = currentClass
    ? t(`${base}.syllabus.lessonOf`, { n: currentIndex + 1, total: totalLessons })
    : courseFinished || (totalLessons > 0 && doneLessons >= totalLessons)
      ? t(`${base}.syllabus.completed`)
      : t(`${base}.syllabus.notStarted`)

  const teacherBio =
    tiptapToPlainText(teacher?.bio) ||
    t(`${base}.teacherBioFallback`, { style: style?.name || t(`${base}.latinFallback`) })

  function handleAddToPlan() {
    setAddError(null)
    startTransition(async () => {
      const res = await addCourseToSubscription(course.id)
      if (res.error) setAddError(res.error)
    })
  }

  // The main forward action, as a chunky button (header, summary card and phone bar).
  const primaryCta = (size: 'sm' | 'default' | 'lg' = 'lg', className = '') =>
    locked && canAddToPlan ? (
      <Button variant="chunky" size={size} disabled={pending} onClick={handleAddToPlan} className={className}>
        <Plus aria-hidden />
        {pending ? t(`${base}.adding`) : t(`${base}.addToPlan`, { price: formatCents(addonPriceCents) })}
      </Button>
    ) : locked ? (
      <Button asChild variant="chunky" size={size} className={className}>
        <Link href={subscribeHref}>
          <Lock aria-hidden />
          {t(`${base}.subscribeToUnlock`)}
        </Link>
      </Button>
    ) : nextClassHref ? (
      <EnterCourseModeButton
        courseId={course.id}
        href={nextClassHref}
        courseTitle={course.title}
        isNewCourse={!hasStarted}
        variant="chunky"
        size={size}
        className={className}
      >
        <Play className="fill-current" aria-hidden />
        {hasStarted ? t(`${base}.continueLesson`) : t(`${base}.startLesson`)}
      </EnterCourseModeButton>
    ) : courseFinished && reviewHref ? (
      <EnterCourseModeButton
        courseId={course.id}
        href={reviewHref}
        courseTitle={course.title}
        isNewCourse={false}
        variant="chunky"
        size={size}
        className={className}
      >
        <RotateCcw aria-hidden />
        {t(`${base}.reviewCourse`)}
      </EnterCourseModeButton>
    ) : (
      <Button variant="chunky" size={size} disabled className={className}>
        <Clock aria-hidden />
        {t(`${base}.comingSoon`)}
      </Button>
    )

  const whatYouLearn = [
    t(`${base}.whatYoullMaster.items.rhythms`, { style: style?.name || t(`${base}.latinFallback`) }),
    t(`${base}.whatYoullMaster.items.technique`),
    t(`${base}.whatYoullMaster.items.context`),
    t(`${base}.whatYoullMaster.items.playAlong`),
    t(`${base}.whatYoullMaster.items.repertoire`),
    t(`${base}.whatYoullMaster.items.confidence`),
  ]
  const included = [
    { icon: BookOpen, text: t(`${base}.included.learningItems`, { count: totalItems }) },
    ...(totalDurationMinutes > 0 ? [{ icon: Clock, text: t(`${base}.included.contentLength`, { duration: minutes(totalDurationMinutes) }) }] : []),
    { icon: Music, text: t(`${base}.included.sheetMusic`) },
    { icon: Headphones, text: t(`${base}.included.backingTracks`) },
    { icon: Award, text: t(`${base}.included.certificate`) },
  ]
  const requirements = [
    { icon: Headphones, text: t(`${base}.requirements.instrument`, { instrument: teacher?.instrument || t(`${base}.requirements.instrumentFallback`) }) },
    { icon: Music, text: t(`${base}.requirements.familiarity`) },
    { icon: Target, text: t(`${base}.requirements.dedication`) },
    { icon: Disc3, text: t(`${base}.requirements.metronome`) },
  ]

  // Lesson numbers run across modules (01, 02 … in reading order).
  const lessonNumberOf = new Map(classes.map((c, i) => [c.id, i + 1]))

  const stats: [string | number, string][] = [
    [sections.length, t(`${base}.stats.modules`)],
    [totalLessons, t(`${base}.stats.lessons`)],
    ...(totalDurationMinutes > 0 ? [[minutes(totalDurationMinutes), t(`${base}.stats.video`)] as [string, string]] : []),
    [levelLabel, t(`${base}.stats.level`)],
  ]

  // Phone bar: a chunky "Go" into the next lesson, or the same gate CTA as the page.
  const mobileAction =
    !locked && nextClassHref ? (
      <EnterCourseModeButton
        courseId={course.id}
        href={nextClassHref}
        courseTitle={course.title}
        isNewCourse={!hasStarted}
        variant="chunky"
        size="sm"
      >
        <Play className="fill-current" aria-hidden />
        {t(`${base}.syllabus.go`)}
        <span className="sr-only"> · {hasStarted ? t(`${base}.continueLesson`) : t(`${base}.startLesson`)}</span>
      </EnterCourseModeButton>
    ) : (
      primaryCta('sm')
    )

  const renderRow = (cls: ClassRow) => {
    const lessonNumber = lessonNumberOf.get(cls.id) ?? 0
    const done = classDone(cls)
    const current = cls.id === nextClassId
    const accessible = isStudent || !!cls.is_free
    const href = lessonHref(cls)
    const mins = classMinutes(cls)
    const sub = [itemKinds(cls) || t(cls.totalItems === 1 ? `${base}.itemCountOne` : `${base}.itemCountOther`, { count: cls.totalItems })]
    if (current && cls.totalItems > 0) sub.push(t(`${base}.syllabus.itemsDone`, { done: cls.completedItems, total: cls.totalItems }))
    if (cls.is_free && !isStudent) sub.push(t(`${base}.syllabus.freePreview`))
    return (
      <li key={cls.id}>
        <Link
          href={href}
          className={cn(
            'group flex items-center gap-3.5 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-accent/40',
            current ? 'border-primary/50 ring-[3px] ring-primary/[0.12]' : 'border-border'
          )}
        >
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold',
              done ? 'bg-success/[0.14] text-success' : current ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : current ? <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> : !accessible ? <Lock className="h-3 w-3" aria-hidden /> : lessonNumber}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold transition-colors group-hover:text-primary">{cls.title || t(`${base}.syllabus.lessonFallback`, { number: lessonNumber })}</span>
            <span className="block truncate text-xs text-muted-foreground">{sub.join(' · ')}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
            {mins > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {minutes(mins)}
              </span>
            ) : null}
            {current && accessible ? (
              <span className="hidden rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground sm:inline-block">{t(`${base}.continueLesson`)}</span>
            ) : done ? (
              <span className="hidden text-xs font-semibold text-foreground sm:inline-block">{t('dashboard.pages.myCourses.row.review')}</span>
            ) : null}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div className={cn('lg:pb-0', locked ? 'pb-36' : 'pb-24')}>
      <HeaderTitleOverride title={course.title} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Link href="/dashboard/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t(`${base}.backToCourses`)}
          </Link>

          {/* ── Hero ── */}
          <header className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {course.is_fundamentals ? <Badge variant="secondary">{t('dashboard.pages.courses.fundamentals')}</Badge> : null}
                {style ? <Badge variant="secondary"><Music className="h-3 w-3" aria-hidden />{style.name}</Badge> : null}
                {teacher?.instrument ? <Badge variant="secondary"><Disc3 className="h-3 w-3" aria-hidden />{teacher.instrument}</Badge> : null}
                {country ? <Badge variant="secondary"><Globe className="h-3 w-3" aria-hidden />{country.name}</Badge> : null}
                <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <LevelDot difficulty={course.difficulty} />
                  {levelLabel}
                </span>
              </div>
              <h1 className="text-balance font-heading text-3xl font-extrabold tracking-tight md:text-[38px] md:leading-[1.05]">{course.title}</h1>
              {teacher ? (
                <div className="mt-3 flex items-center gap-2.5 text-sm">
                  <Avatar className="h-8 w-8 text-[11px]">
                    {teacher.image_url ? <AvatarImage src={teacher.image_url} alt="" /> : null}
                    <AvatarFallback>{initialsFor(teacher.name)}</AvatarFallback>
                  </Avatar>
                  <span>
                    <b className="font-semibold">{teacher.name}</b>
                    {teacher.instrument ? <span className="text-muted-foreground"> · {teacher.instrument}</span> : null}
                  </span>
                  <Link href="/dashboard/teachers" className="text-xs font-semibold text-primary hover:underline">
                    {t('dashboard.pages.teachers.viewProfile')}
                  </Link>
                </div>
              ) : null}
            </div>
            {/* Phones: full width, each button grows and wraps onto its own row when it has to. */}
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:shrink-0 max-sm:[&>*]:flex-1">
              {course.preview_video_url ? (
                <Button variant="outline" size="lg" onClick={() => setPreviewOpen(true)}>
                  <Video aria-hidden />
                  {t(`${base}.watchPreview`)}
                </Button>
              ) : null}
              {primaryCta('lg')}
            </div>
          </header>
          {addError ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{addError}</p>
          ) : null}

          {/* Phones and tablets: the summary card's stats (the card itself is lg-only). */}
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 lg:hidden">
            {stats.map(([v, l]) => (
              <div key={l} className="flex flex-col-reverse">
                <dt className="text-[11px] text-muted-foreground">{l}</dt>
                <dd className="whitespace-nowrap font-heading text-[15px] font-bold">{String(v)}</dd>
              </div>
            ))}
          </dl>

          {/* ── Your path: laid on the page, no card ── */}
          {pathNodes.length > 0 ? (
            <section aria-labelledby="your-path" className="mt-7">
              <div className="mb-1 flex min-h-9 items-baseline gap-2.5 sm:pr-24">
                <h2 id="your-path" className="whitespace-nowrap font-heading text-xl font-bold tracking-tight">{t(`${base}.path.heading`)}</h2>
                <span className="truncate text-[13px] tabular-nums text-muted-foreground">
                  · {t(totalLessons === 1 ? `${base}.path.doneOfOne` : `${base}.path.doneOf`, { done: doneLessons, total: totalLessons })}
                </span>
              </div>
              <PathStrip
                items={pathNodes}
                ariaLabel={t(`${base}.path.heading`)}
                showArrows
                showModuleFlags
                arrowsClassName="bottom-full top-auto mb-1 max-sm:hidden"
              />
            </section>
          ) : null}

          {course.description ? <p className="mb-6 mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{course.description}</p> : null}

          {/* ── Compact syllabus ── */}
          <div className={cn(!course.description && 'mt-6')}>
            {sections.map((section, si) => {
              const list = section.classes ?? []
              const sDone = list.length > 0 && list.every(classDone)
              const sCurrent = list.some((c) => c.id === nextClassId)
              const status = sDone ? t(`${base}.syllabus.completed`) : sCurrent ? t(`${base}.syllabus.inProgress`) : t(`${base}.syllabus.notStarted`)
              const win = syllabusWindow(list.map((c) => c.id), nextClassId)
              const open = !!expanded[section.id]
              const rows = open ? list : list.filter((c) => win.visible.includes(c.id))
              return (
                <section key={section.id} className="mb-6" aria-labelledby={`module-${section.id}`}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
                    <span className={cn('min-w-[44px] font-heading text-[28px] font-extrabold tracking-tight', sDone ? 'text-success' : 'text-primary')}>
                      {String(si + 1).padStart(2, '0')}
                    </span>
                    <h2 id={`module-${section.id}`} className="min-w-0 font-heading text-lg font-bold tracking-tight">
                      {/* Module title opens the module overview page (full description + lessons). */}
                      <Link
                        href={moduleOverviewHref(courseId, section.id)}
                        className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {moduleTitle(section, si)}
                      </Link>
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground sm:ml-auto">
                      {t(list.length === 1 ? `${base}.lessonCountOne` : `${base}.lessonCountOther`, { count: list.length })} · {status}
                    </span>
                  </div>
                  {list.length > 0 ? (
                    <div className="mb-3 flex gap-[3px] sm:ml-[58px]" aria-hidden>
                      {lessonSegments(list, nextClassId).map((seg, k) => (
                        <i key={k} data-segment={seg.state} className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted">
                          {seg.state !== 'upcoming' ? (
                            <span
                              className={cn('block h-full rounded-full', seg.state === 'done' ? 'bg-success' : 'bg-primary')}
                              style={{ width: `${seg.state === 'done' ? 100 : Math.max(20, Math.round(seg.fraction * 100))}%` }}
                            />
                          ) : null}
                        </i>
                      ))}
                    </div>
                  ) : null}
                  {section.description ? (
                    <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:ml-[58px]">{section.description}</p>
                  ) : null}
                  {list.length > 0 ? (
                    <ol id={`module-${section.id}-lessons`} className={cn('ml-0 flex-col gap-2 sm:ml-[58px]', rows.length === 0 ? 'hidden' : 'flex')}>
                      {rows.map(renderRow)}
                    </ol>
                  ) : null}
                  {win.collapsible ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2.5 sm:ml-[58px]"
                      aria-expanded={open}
                      aria-controls={`module-${section.id}-lessons`}
                      onClick={() => setExpanded((e) => ({ ...e, [section.id]: !open }))}
                    >
                      <ChevronDown className={cn('transition-transform duration-state ease-smooth', open && 'rotate-180')} aria-hidden />
                      {open
                        ? t(`${base}.syllabus.showFewer`)
                        : t(list.length === 1 ? `${base}.syllabus.showAllOne` : `${base}.syllabus.showAll`, { count: list.length })}
                    </Button>
                  ) : null}
                </section>
              )
            })}
          </div>

          <section className="mb-8 mt-10">
            <h2 className="mb-3.5 font-heading text-xl font-bold tracking-tight">{t(`${base}.whatYoullMaster.heading`)}</h2>
            <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-5">
              {whatYouLearn.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3.5 font-heading text-xl font-bold tracking-tight">{t(`${base}.requirements.heading`)}</h2>
            <ul className="flex flex-col gap-2.5">
              {requirements.map((req) => (
                <li key={req.text} className="flex items-center gap-2.5 text-sm text-foreground/85">
                  <req.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{req.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {teacher ? (
            <section className="mb-8">
              <h2 className="mb-3.5 font-heading text-xl font-bold tracking-tight">{t(`${base}.yourInstructor`)}</h2>
              <div className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
                <Avatar className="h-[76px] w-[76px] rounded-lg text-xl">
                  {teacher.image_url ? <AvatarImage src={teacher.image_url} alt="" className="rounded-lg" /> : null}
                  <AvatarFallback className="rounded-lg text-white" style={{ background: coverStyle(style?.name) }}>
                    {initialsFor(teacher.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-base font-bold tracking-tight">{teacher.name}</h3>
                    {teacher.instrument ? <Badge variant="secondary">{teacher.instrument}</Badge> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{teacherBio}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/teachers">{t('dashboard.pages.teachers.viewProfile')}</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/feedback">
                        <Video aria-hidden />
                        {t('dashboard.pages.feedback.request.title')}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {/* ── Summary card ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="relative aspect-video bg-sunken">
              {course.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt="" fill sizes="360px" className="object-cover" />
              ) : (
                <span className="absolute inset-0" style={{ background: coverStyle(style?.name) }} aria-hidden />
              )}
              {course.preview_video_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-white/[0.22] bg-white/[0.12] px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  {t(`${base}.watchPreview`)}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-4 p-[18px]">
              <div className="flex items-center gap-3">
                <ProgressRing pct={progressPercentage} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{progressTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[currentClass?.title, remainingDuration > 0 ? t(`${base}.syllabus.left`, { duration: minutes(remainingDuration) }) : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stats.map(([v, l]) => (
                  <div key={l} className="rounded-lg bg-secondary px-3 py-2.5">
                    <span className="block font-heading text-base font-bold leading-tight">{String(v)}</span>
                    <span className="text-[11px] text-muted-foreground">{l}</span>
                  </div>
                ))}
              </div>
              {primaryCta('lg', 'w-full')}
              {isStudent && !locked ? (
                <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-xs font-semibold text-success">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  {t(`${base}.syllabus.inYourPlan`)}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1.5">
                {included.map((item) => (
                  <li key={item.text} className="flex items-center gap-2 text-[13px]">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    <span className="truncate">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {course.preview_video_url ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl overflow-hidden border-border bg-background p-0">
            <DialogTitle className="sr-only">{t(`${base}.previewHeading`)}</DialogTitle>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={course.preview_video_url}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <MobileCourseBar progressPercentage={progressPercentage} title={progressTitle} subtitle={currentClass?.title} action={mobileAction} stacked={locked} />
    </div>
  )
}
