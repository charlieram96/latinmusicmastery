import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { canAccessCourse, hasInstrumentSubscription } from '@/lib/subscriptions'
import { getPricing } from '@/lib/payments/pricing-source'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse } from '@/lib/i18n/localize'
import { CourseDetailView } from './course-detail-view'

interface PageProps {
  params: Promise<{
    courseId: string
  }>
}

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get course with style, country, and teacher
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)

  let courseQuery = supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        id, name, name_es, slug,
        country:countries(id, name, name_es, slug)
      ),
      teacher:teachers(id, name, instrument, image_url, bio)
    `)
    .eq('is_published', true)

  if (isUUID) {
    courseQuery = courseQuery.eq('id', courseId)
  } else {
    courseQuery = courseQuery.eq('slug', courseId)
  }

  const { data: course } = await courseQuery.single()
  if (!course) {
    notFound()
  }

  const locale = await getServerLocale()
  localizeCourse(course as Record<string, unknown>, locale)

  // Check admin status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = await canAccessCourse(supabase, user.id, course, profile?.is_admin ?? false)

  // Get course structure with progress
  const structureResult = await getCourseStructureForStudent(course.id)
  const structure = structureResult.data

  const totalItems = structure?.totalItems || 0
  const completedItems = structure?.completedItems || 0
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  const totalDurationMinutes = Math.round((structure?.totalDurationSeconds || 0) / 60)
  const completedDurationMinutes = Math.round((structure?.completedDurationSeconds || 0) / 60)
  const remainingDuration = totalDurationMinutes - completedDurationMinutes
  const nextClassId = structure?.nextClassId || null
  const sections = structure?.sections || []
  const hasStarted = completedItems > 0

  // Subscription gate: the CTA should prompt to subscribe (not "Begin Course")
  // when the user can't access the class they'd land on and it isn't free.
  let nextClassIsFree = false
  for (const section of sections) {
    const cls = section.classes?.find((c: any) => c.id === nextClassId)
    if (cls) {
      nextClassIsFree = cls.is_free ?? false
      break
    }
  }
  const locked = !!nextClassId && !isStudent && !nextClassIsFree

  // If the user already has the instrument subscription but doesn't own this
  // particular genre course, we offer "Add to my plan" instead of "Subscribe".
  const hasInstrumentSub = course.instrument
    ? await hasInstrumentSubscription(supabase, user.id, course.instrument)
    : false
  const canAddToPlan = locked && hasInstrumentSub && !course.is_fundamentals
  const prices = await getPricing()
  const addonPriceCents = prices.addon_monthly.amount_cents

  const style = course.musical_style
  const country = style?.country
  const teacher = course.teacher

  const difficultyConfig = {
    beginner: { color: 'text-green-500', bg: 'bg-green-500/10' },
    intermediate: { color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    advanced: { color: 'text-red-500', bg: 'bg-red-500/10' },
  } as const
  const difficultyKey = (course.difficulty as keyof typeof difficultyConfig) in difficultyConfig
    ? (course.difficulty as keyof typeof difficultyConfig)
    : 'beginner'
  const difficulty = difficultyConfig[difficultyKey]

  return (
    <CourseDetailView
      course={course}
      courseId={courseId}
      style={style}
      country={country}
      teacher={teacher}
      difficultyKey={difficultyKey}
      difficultyColor={difficulty.color}
      totalItems={totalItems}
      completedItems={completedItems}
      totalDurationMinutes={totalDurationMinutes}
      remainingDuration={remainingDuration}
      progressPercentage={progressPercentage}
      nextClassId={nextClassId}
      sections={sections}
      hasStarted={hasStarted}
      isStudent={isStudent}
      locked={locked}
      canAddToPlan={canAddToPlan}
      addonPriceCents={addonPriceCents}
    />
  )
}
