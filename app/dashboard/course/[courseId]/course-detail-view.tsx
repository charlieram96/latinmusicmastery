'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  PlayCircle,
  ChevronLeft,
  Clock,
  BookOpen,
  User,
  BarChart3,
  Target,
  Music,
  Globe,
  Disc3,
  Award,
  Headphones,
  Lock,
  Plus,
} from 'lucide-react'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'
import { CurriculumNavigator } from '@/components/course/curriculum-navigator'
import { HeroStatsStrip } from '@/components/course/hero-stats-strip'
import { MobileCourseBar } from '@/components/course/mobile-course-bar'
import { getInstrumentColor } from '@/lib/instruments'
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

  const nextClassHref = nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : undefined

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
        difficulty: course.difficulty
          ? difficultyLabel
          : t('dashboard.pages.course.allLevels'),
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

  return (
    <div className="pb-24 lg:pb-0">
      {/* ── Cinematic Hero ── */}
      <div className="relative -mx-6 -mt-[calc(56px+1.5rem)] overflow-hidden">
        {course.thumbnail_url && (
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover animate-slow-zoom"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-terracotta/[0.05]" />

        <div className="relative px-6 md:px-10 pt-[calc(56px+2rem)] pb-16 min-h-[480px] lg:min-h-[540px] flex flex-col justify-end">
          {/* Back button */}
          <div className="absolute top-[calc(56px+1rem)] left-6 md:left-10">
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="gap-2 backdrop-blur-md bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/dashboard/courses">
                <ChevronLeft className="h-4 w-4" />
                {t('dashboard.pages.course.backToCourses')}
              </Link>
            </Button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {style && (
              <Badge
                variant="outline"
                className="animate-fade-in-up-delayed backdrop-blur-sm bg-white/10 border-white/20 text-white/90"
                style={{ animationDelay: '0.1s' }}
              >
                <Music className="h-3 w-3 mr-1" />
                {style.name}
              </Badge>
            )}
            {teacher?.instrument && (
              <Badge
                variant="outline"
                className="animate-fade-in-up-delayed backdrop-blur-sm bg-white/10 border-white/20 text-white/90"
                style={{ animationDelay: '0.2s' }}
              >
                <Disc3 className="h-3 w-3 mr-1" />
                {teacher.instrument}
              </Badge>
            )}
            {country && (
              <Badge
                variant="outline"
                className="animate-fade-in-up-delayed backdrop-blur-sm bg-white/10 border-white/20 text-white/90"
                style={{ animationDelay: '0.3s' }}
              >
                <Globe className="h-3 w-3 mr-1" />
                {country.name}
              </Badge>
            )}
            {course.difficulty && (
              <Badge
                variant="outline"
                className="animate-fade-in-up-delayed capitalize backdrop-blur-sm bg-white/10 border-white/20 text-white/90"
                style={{ animationDelay: '0.4s' }}
              >
                {difficultyLabel}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1
            className="animate-fade-in-up-delayed text-4xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight leading-[1.1] text-white max-w-4xl mb-4"
            style={{ animationDelay: '0.15s' }}
          >
            {course.title}
          </h1>

          {/* Description */}
          {course.description && (
            <p
              className="animate-fade-in-up-delayed text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl mb-8"
              style={{ animationDelay: '0.25s' }}
            >
              {course.description}
            </p>
          )}

          {/* Instructor + CTA */}
          <div
            className="animate-fade-in-up-delayed flex flex-wrap items-center justify-between gap-6"
            style={{ animationDelay: '0.35s' }}
          >
            {teacher && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  {teacher.image_url ? (
                    <img
                      src={teacher.image_url}
                      alt={teacher.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/30"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium mb-0.5">
                    {t('dashboard.pages.course.instructor')}
                  </p>
                  <p className="font-semibold text-white text-lg">{teacher.name}</p>
                  {teacher.instrument && <p className="text-sm text-white/60">{teacher.instrument}</p>}
                </div>
              </div>
            )}

            {locked && canAddToPlan ? (
              <div className="flex flex-col items-end gap-2">
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={handleAddToPlan}
                  className="h-14 px-10 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)] text-base"
                >
                  <Plus className="h-5 w-5 mr-2" />
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
                className="h-14 px-10 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)] text-base"
              >
                <Link
                  href={`/dashboard/subscribe?instrument=${encodeURIComponent(course.instrument ?? '')}&course=${course.id}`}
                >
                  <Lock className="h-5 w-5 mr-2" />
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
                className="h-14 px-10 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)] text-base"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                {hasStarted
                  ? t('dashboard.pages.course.continueCourse')
                  : t('dashboard.pages.course.beginCourse')}
              </EnterCourseModeButton>
            ) : (
              <Button size="lg" disabled className="h-14 px-10 rounded-2xl text-base">
                <Clock className="h-5 w-5 mr-2" />
                {t('dashboard.pages.course.comingSoon')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="relative z-10 -mt-12 mx-4 md:mx-8 lg:mx-12 mb-12">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-stripe p-6 md:p-8">
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

      {/* ── Content Area (2-column grid) ── */}
      <section className="px-4 md:px-8 lg:px-12 mb-16">
        <div className="grid gap-10 lg:gap-14 lg:grid-cols-12">
          {/* Left column */}
          <div className="lg:col-span-7 space-y-10">
            {/* Preview Video */}
            {course.preview_video_url && (
              <div>
                <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                  {t('dashboard.pages.course.previewLabel')}
                </p>
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6">
                  {t('dashboard.pages.course.previewHeading')}
                </h2>
                <div className="rounded-xl overflow-hidden">
                  <div className="aspect-video bg-muted">
                    <iframe
                      src={course.preview_video_url}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            )}

            {/* What You'll Learn */}
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                {t('dashboard.pages.course.whatYoullMaster.label')}
              </p>
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6">
                {t('dashboard.pages.course.whatYoullMaster.heading')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {whatYouLearn.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* This Course Includes */}
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                {t('dashboard.pages.course.included.label')}
              </p>
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6">
                {t('dashboard.pages.course.included.heading')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {includedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm capitalize">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                {t('dashboard.pages.course.requirements.label')}
              </p>
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6">
                {t('dashboard.pages.course.requirements.heading')}
              </h2>
              <ul className="space-y-4">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <req.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm leading-relaxed pt-1">{req.text}</span>
                  </li>
                ))}
              </ul>
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

          {/* Right column — Curriculum Navigator (desktop sticky sidebar) */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="sticky top-20 border-l border-border pl-8">
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
      </section>

      {/* ── Teacher Spotlight ── */}
      {teacher && (
        <section className="mt-16 py-12 bg-muted/30 border-y border-border">
          <div className="max-w-4xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
            {teacher.image_url ? (
              <img
                src={teacher.image_url}
                alt={teacher.name}
                className="w-28 h-28 rounded-2xl object-cover mb-6"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <User className="w-14 h-14 text-primary" />
              </div>
            )}
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
              {t('dashboard.pages.course.yourInstructor')}
            </p>
            <h3 className="text-2xl md:text-3xl font-heading font-bold mb-2">{teacher.name}</h3>
            {teacher.instrument && (
              <Badge variant="outline" className={`${getInstrumentColor(teacher.instrument)} mb-4`}>
                <Disc3 className="h-3 w-3 mr-1" />
                {teacher.instrument}
              </Badge>
            )}
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              {tiptapToPlainText(teacher.bio) ||
                t('dashboard.pages.course.teacherBioFallback', {
                  style: style?.name || t('dashboard.pages.course.latinFallback'),
                })}
            </p>
          </div>
        </section>
      )}

      {/* ── Subscription CTA (if not subscribed) ── */}
      {!isStudent && (
        <section className="mx-4 md:mx-8 lg:mx-12 mt-12 mb-16">
          <div className="relative rounded-2xl marketing-gradient-warm p-8 md:p-12 text-center overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl md:text-3xl font-heading font-bold text-white mb-3">
                {t('dashboard.pages.course.unlockAccess.title')}
              </h3>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">
                {t('dashboard.pages.course.unlockAccess.body')}
              </p>
              <Button asChild size="lg" variant="secondary" className="h-12 px-8 rounded-xl text-base font-semibold">
                <Link href="/dashboard/subscription">{t('dashboard.pages.course.unlockAccess.cta')}</Link>
              </Button>
            </div>
          </div>
        </section>
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
