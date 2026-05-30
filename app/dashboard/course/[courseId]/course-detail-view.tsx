'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  CheckCircle2,
  PlayCircle,
  ChevronLeft,
  Clock,
  BookOpen,
  BarChart3,
  Target,
  Music,
  Globe,
  Disc3,
  Award,
  Headphones,
  Lock,
  Plus,
  Layers,
  Video,
} from 'lucide-react'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'
import { CurriculumNavigator } from '@/components/course/curriculum-navigator'
import { HeroStatsStrip } from '@/components/course/hero-stats-strip'
import { MobileCourseBar } from '@/components/course/mobile-course-bar'
import { InstructorBar } from '@/components/course/instructor-bar'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'
import { useTranslation } from '@/components/language-provider'
import { useTransition, useState } from 'react'
import { addCourseToSubscription } from '@/app/actions/billing'
import { formatCents } from '@/lib/payments/pricing-types'

interface CourseDetailViewProps {
  course: any
  courseId: string
  style: any
  country: any
  teacher: any
  difficultyKey: 'beginner' | 'intermediate' | 'advanced'
  difficultyColor: string
  totalItems: number
  completedItems: number
  totalDurationMinutes: number
  remainingDuration: number
  progressPercentage: number
  nextClassId: string | null
  sections: any[]
  hasStarted: boolean
  isStudent: boolean
  locked: boolean
  canAddToPlan: boolean
  addonPriceCents: number
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

export function CourseDetailView({
  course,
  courseId,
  style,
  country,
  teacher,
  difficultyKey,
  difficultyColor,
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
  const difficultyLabel = t(`dashboard.pages.course.difficulty.${difficultyKey}`)
  const [pending, startTransition] = useTransition()
  const [addError, setAddError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const nextClassHref = nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : undefined

  const totalLessons = sections.reduce((acc: number, s: any) => acc + (s.classes?.length ?? 0), 0)
  const levelLabel = course.difficulty ? difficultyLabel : t('dashboard.pages.course.allLevels')
  const teacherBio =
    tiptapToPlainText(teacher?.bio) ||
    t('dashboard.pages.course.teacherBioFallback', {
      style: style?.name || t('dashboard.pages.course.latinFallback'),
    })

  function handleAddToPlan() {
    setAddError(null)
    startTransition(async () => {
      const res = await addCourseToSubscription(course.id)
      if (res.error) setAddError(res.error)
    })
  }

  const whatYouLearn = [
    t('dashboard.pages.course.whatYoullMaster.items.rhythms', {
      style: style?.name || t('dashboard.pages.course.latinFallback'),
    }),
    t('dashboard.pages.course.whatYoullMaster.items.technique'),
    t('dashboard.pages.course.whatYoullMaster.items.context'),
    t('dashboard.pages.course.whatYoullMaster.items.playAlong'),
    t('dashboard.pages.course.whatYoullMaster.items.repertoire'),
    t('dashboard.pages.course.whatYoullMaster.items.confidence'),
  ]

  const includedItems = [
    { icon: BookOpen, text: t('dashboard.pages.course.included.learningItems', { count: totalItems }) },
    { icon: Clock, text: t('dashboard.pages.course.included.contentLength', { duration: formatDuration(totalDurationMinutes) }) },
    { icon: Music, text: t('dashboard.pages.course.included.sheetMusic') },
    { icon: Headphones, text: t('dashboard.pages.course.included.backingTracks') },
    { icon: Award, text: t('dashboard.pages.course.included.certificate') },
    {
      icon: BarChart3,
      text: t('dashboard.pages.course.included.difficulty', {
        difficulty: course.difficulty ? difficultyLabel : t('dashboard.pages.course.allLevels'),
      }),
    },
  ]

  const requirements = [
    {
      icon: Headphones,
      text: t('dashboard.pages.course.requirements.instrument', {
        instrument: teacher?.instrument || t('dashboard.pages.course.requirements.instrumentFallback'),
      }),
    },
    { icon: Music, text: t('dashboard.pages.course.requirements.familiarity') },
    { icon: Target, text: t('dashboard.pages.course.requirements.dedication') },
    { icon: Disc3, text: t('dashboard.pages.course.requirements.metronome') },
  ]

  const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.14em] text-primary'
  const sectionTitleClass =
    'mt-2 font-heading text-2xl md:text-[34px] font-extrabold tracking-[-0.025em] text-foreground'

  const metaDot = <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />

  return (
    <div className="-mx-6 -mt-[calc(56px+1.5rem)] pb-24 lg:pb-0">
      {/* ── Cinematic Hero ── */}
      <div className="relative overflow-hidden bg-[#0a0a0a]">
        {course.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 h-full w-full animate-slow-zoom object-cover"
            style={{ objectPosition: '70% 30%' }}
          />
        )}
        {/* Scrim — dark on the left for legibility, dark at the bottom for the fade */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.78) 30%, rgba(0,0,0,0.5) 58%, rgba(0,0,0,0.66) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 24%, transparent 46%, hsl(var(--background)) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-terracotta/[0.05]" />

        <div className="relative mx-auto flex min-h-[560px] w-full max-w-[1240px] flex-col justify-end px-6 pb-16 pt-[calc(56px+3rem)] md:px-10 lg:min-h-[620px]">
          {/* Back button */}
          <div className="absolute left-6 top-[calc(56px+1rem)] z-10 md:left-10">
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="gap-2 rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md hover:bg-black/60 hover:text-white"
            >
              <Link href="/dashboard/courses">
                <ChevronLeft className="h-4 w-4" />
                {t('dashboard.pages.course.backToCourses')}
              </Link>
            </Button>
          </div>

          <div className="max-w-[680px]">
            {/* Tags */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {style && (
                <Badge
                  variant="outline"
                  className="animate-fade-in-up-delayed border-white/15 bg-white/10 text-white/90 backdrop-blur-sm"
                  style={{ animationDelay: '0.1s' }}
                >
                  <Music className="mr-1 h-3 w-3" />
                  {style.name}
                </Badge>
              )}
              {teacher?.instrument && (
                <Badge
                  variant="outline"
                  className="animate-fade-in-up-delayed border-white/15 bg-white/10 text-white/90 backdrop-blur-sm"
                  style={{ animationDelay: '0.2s' }}
                >
                  <Disc3 className="mr-1 h-3 w-3" />
                  {teacher.instrument}
                </Badge>
              )}
              {country && (
                <Badge
                  variant="outline"
                  className="animate-fade-in-up-delayed border-white/15 bg-white/10 text-white/90 backdrop-blur-sm"
                  style={{ animationDelay: '0.3s' }}
                >
                  <Globe className="mr-1 h-3 w-3" />
                  {country.name}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1
              className="animate-fade-in-up-delayed font-heading text-[clamp(3rem,6.5vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-white"
              style={{ animationDelay: '0.15s' }}
            >
              {course.title}
            </h1>

            {/* Description */}
            {course.description && (
              <p
                className="animate-fade-in-up-delayed mt-5 max-w-[46ch] text-lg leading-[1.55] text-white/80"
                style={{ animationDelay: '0.25s' }}
              >
                {course.description}
              </p>
            )}

            {/* Meta row */}
            <div
              className="animate-fade-in-up-delayed mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm font-medium text-white/80"
              style={{ animationDelay: '0.3s' }}
            >
              <span className="inline-flex items-center gap-2">
                <Layers className="h-[15px] w-[15px] text-primary" />
                {sections.length} module{sections.length !== 1 ? 's' : ''}
              </span>
              {metaDot}
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-[15px] w-[15px] text-primary" />
                {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
              </span>
              {metaDot}
              <span className="inline-flex items-center gap-2">
                <Target className="h-[15px] w-[15px] text-primary" />
                {levelLabel}
              </span>
            </div>

            {/* Actions */}
            <div
              className="animate-fade-in-up-delayed mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '0.4s' }}
            >
              {locked && canAddToPlan ? (
                <div className="flex flex-col items-start gap-2">
                  <Button
                    size="lg"
                    disabled={pending}
                    onClick={handleAddToPlan}
                    className="h-12 rounded-full px-8 text-base shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)]"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    {pending ? 'Adding…' : `Add to my plan (+${formatCents(addonPriceCents)}/mo)`}
                  </Button>
                  {addError && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                      {addError}
                    </p>
                  )}
                </div>
              ) : locked ? (
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-8 text-base shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)]"
                >
                  <Link
                    href={`/dashboard/subscribe?instrument=${encodeURIComponent(course.instrument ?? '')}&course=${course.id}`}
                  >
                    <Lock className="mr-2 h-5 w-5" />
                    {t('dashboard.pages.course.subscribeToUnlock')}
                  </Link>
                </Button>
              ) : nextClassHref ? (
                <EnterCourseModeButton
                  courseId={course.id}
                  href={nextClassHref}
                  courseTitle={course.title}
                  isNewCourse={!hasStarted}
                  size="lg"
                  className="h-12 rounded-full px-8 text-base shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)]"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  {hasStarted
                    ? t('dashboard.pages.course.continueCourse')
                    : t('dashboard.pages.course.beginCourse')}
                </EnterCourseModeButton>
              ) : (
                <Button size="lg" disabled className="h-12 rounded-full px-8 text-base">
                  <Clock className="mr-2 h-5 w-5" />
                  {t('dashboard.pages.course.comingSoon')}
                </Button>
              )}

              {course.preview_video_url && (
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setPreviewOpen(true)}
                  className="h-12 rounded-full border border-white/20 bg-white/10 px-6 text-base text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                >
                  <Video className="mr-2 h-5 w-5" />
                  {t('dashboard.pages.course.watchPreview')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Centered content column ── */}
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        {/* Stats bar (overlaps hero) */}
        <div className="relative z-10 -mt-14 mb-4">
          <div className="overflow-hidden rounded-[20px] border border-border shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
            <HeroStatsStrip
              progressPercentage={progressPercentage}
              completedItems={completedItems}
              totalItems={totalItems}
              remainingDuration={remainingDuration}
              difficulty={course.difficulty || 'All'}
              difficultyColor={difficultyColor}
            />
          </div>
        </div>

        {/* Instructor bar */}
        {teacher && (
          <InstructorBar
            name={teacher.name}
            instrument={teacher.instrument}
            imageUrl={teacher.image_url}
            bio={teacherBio}
          />
        )}

        {/* ── Body (2-column) ── */}
        <section className="mt-12 mb-16">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_408px] lg:gap-14">
            {/* Left column */}
            <div className="space-y-12">
              {/* What You'll Master */}
              <div>
                <span className={eyebrowClass}>{t('dashboard.pages.course.whatYoullMaster.label')}</span>
                <h2 className={sectionTitleClass}>{t('dashboard.pages.course.whatYoullMaster.heading')}</h2>
                <div className="mt-6 grid gap-x-9 gap-y-5 sm:grid-cols-2">
                  {whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-[22px] w-[22px] flex-shrink-0 text-primary" />
                      <p className="text-[15.5px] leading-relaxed text-foreground/80">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* This Course Includes */}
              <div>
                <span className={eyebrowClass}>{t('dashboard.pages.course.included.label')}</span>
                <h2 className={sectionTitleClass}>{t('dashboard.pages.course.included.heading')}</h2>
                <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
                  {includedItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 rounded-[14px] border border-border bg-card p-4"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
                        <item.icon className="h-[19px] w-[19px]" />
                      </span>
                      <span className="text-[14.5px] font-medium capitalize text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div>
                <span className={eyebrowClass}>{t('dashboard.pages.course.requirements.label')}</span>
                <h2 className={sectionTitleClass}>{t('dashboard.pages.course.requirements.heading')}</h2>
                <div className="mt-4 divide-y divide-border">
                  {requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-4 py-4">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted text-primary">
                        <req.icon className="h-5 w-5" />
                      </span>
                      <p className="text-[15.5px] leading-snug text-foreground/85">{req.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Curriculum (inline, below content on small screens) */}
              <div className="lg:hidden">
                <div className="border-t border-border pt-10">
                  <CurriculumNavigator
                    sections={sections}
                    nextClassId={nextClassId}
                    courseId={courseId}
                    progressPercentage={progressPercentage}
                    totalItems={totalItems}
                    totalDurationMinutes={totalDurationMinutes}
                    hasStarted={hasStarted}
                  />
                </div>
              </div>
            </div>

            {/* Right column — Curriculum (desktop sticky) */}
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <CurriculumNavigator
                  sections={sections}
                  nextClassId={nextClassId}
                  courseId={courseId}
                  progressPercentage={progressPercentage}
                  totalItems={totalItems}
                  totalDurationMinutes={totalDurationMinutes}
                  hasStarted={hasStarted}
                />
              </div>
            </aside>
          </div>
        </section>

        {/* ── Subscription CTA (if not subscribed) ── */}
        {!isStudent && (
          <section className="mb-16">
            <div className="marketing-gradient-warm relative overflow-hidden rounded-2xl p-8 text-center md:p-12">
              <div className="relative z-10">
                <h3 className="mb-3 font-heading text-2xl font-bold text-white md:text-3xl">
                  {t('dashboard.pages.course.unlockAccess.title')}
                </h3>
                <p className="mx-auto mb-6 max-w-lg text-white/80">
                  {t('dashboard.pages.course.unlockAccess.body')}
                </p>
                <Button asChild size="lg" variant="secondary" className="h-12 rounded-xl px-8 text-base font-semibold">
                  <Link href="/dashboard/subscription">{t('dashboard.pages.course.unlockAccess.cta')}</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Preview modal ── */}
      {course.preview_video_url && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl overflow-hidden border-border bg-background p-0">
            <DialogTitle className="sr-only">{t('dashboard.pages.course.previewHeading')}</DialogTitle>
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
      )}

      {/* ── Mobile Sticky CTA Bar ── */}
      <MobileCourseBar
        courseId={course.id}
        nextClassHref={nextClassHref}
        courseTitle={course.title}
        hasStarted={hasStarted}
        progressPercentage={progressPercentage}
      />
    </div>
  )
}
