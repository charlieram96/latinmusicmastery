import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse, localizeRow, localizeSectionTree, COURSE_FIELDS } from '@/lib/i18n/localize'
import { getPricing } from '@/lib/payments/pricing-source'
import {
  classHref,
  completedItemIds,
  courseCompletion,
  courseHref,
  currentClassIndexFor,
  moduleIndexForClass,
  orderedClasses,
} from '@/lib/dashboard/course-progress'
import type { MyCourseRow, PlanCourse, PlanSummary } from '@/types/dashboard'
import { MyCoursesView } from './my-courses-view'
import type { MyCoursesFilter, MyCoursesSort } from '@/components/dashboard/my-courses-toolbar'

interface PageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>
}

/* ── Row shapes returned by the queries below ─────────────────────── */
interface ItemRow {
  id: string
}
interface ClassRow {
  id: string
  title: string
  order_index: number | null
  items: ItemRow[] | null
}
interface SectionRow {
  id: string
  order_index: number | null
  classes: ClassRow[] | null
}
interface CourseRow {
  id: string
  title: string
  slug: string | null
  thumbnail_url: string | null
  instrument: string | null
  is_fundamentals: boolean | null
  teacher_name: string | null
  teacher: { name: string; image_url: string | null } | null
  musical_style: { name: string; country: { name: string } | null } | null
  course_sections: SectionRow[] | null
}
interface EnrollmentRow {
  enrolled_at: string | null
  last_accessed_at: string | null
  course: CourseRow | null
}
interface PlanCourseRow {
  id: string
  title: string
  slug: string | null
  thumbnail_url: string | null
  instrument: string | null
  musical_style: { name: string } | null
}
interface SubRow {
  id: string
  instrument: string
  billing_interval: string | null
  status: string
  base_current_period_end: string | null
  cancel_at_period_end: boolean | null
  subscription_courses: { course: PlanCourseRow | null }[] | null
}

const FILTERS: MyCoursesFilter[] = ['all', 'in-progress', 'completed']
const SORTS: MyCoursesSort[] = ['recent', 'progress', 'alphabetical']

export default async function MyCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filter: MyCoursesFilter = FILTERS.includes(params.filter as MyCoursesFilter)
    ? (params.filter as MyCoursesFilter)
    : 'all'
  const sort: MyCoursesSort = SORTS.includes(params.sort as MyCoursesSort) ? (params.sort as MyCoursesSort) : 'recent'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: enrollmentData }, { data: subData }, { data: profile }, prices] = await Promise.all([
    supabase
      .from('course_enrollments')
      .select(
        `
        enrolled_at, last_accessed_at,
        course:courses(
          *,
          course_sections(
            id, order_index,
            classes(
              id, title, title_es, order_index,
              items:class_items(id)
            )
          ),
          musical_style:musical_styles(name, name_es, country:countries(name, name_es)),
          teacher:teachers(name, image_url)
        )
      `
      )
      .eq('user_id', user.id),
    supabase
      .from('instrument_subscriptions')
      .select(
        `
        id, instrument, billing_interval, status, base_current_period_end, cancel_at_period_end,
        subscription_courses(
          course:courses(id, title, title_es, slug, thumbnail_url, instrument, musical_style:musical_styles(name, name_es))
        )
      `
      )
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
    getPricing(),
  ])

  const enrollments = (enrollmentData ?? []) as unknown as EnrollmentRow[]
  const subs = (subData ?? []) as unknown as SubRow[]
  const isAdmin = !!profile?.is_admin
  const locale = await getServerLocale()
  for (const enrollment of enrollments) {
    if (!enrollment.course) continue
    const course = enrollment.course as unknown as Record<string, unknown>
    localizeCourse(course, locale)
    localizeSectionTree(course['course_sections'] as Record<string, unknown>[] | undefined, locale)
  }

  const courses = enrollments.filter((e): e is EnrollmentRow & { course: CourseRow } => e.course !== null)

  // One progress query for every item across every enrolled course.
  const allItemIds = courses
    .flatMap((e) => orderedClasses(e.course.course_sections).flatMap((c) => c.items ?? []))
    .map((it) => it.id)
  const { data: progressData } =
    allItemIds.length > 0
      ? await supabase
          .from('class_item_progress')
          .select('class_item_id, completed, updated_at, created_at')
          .eq('user_id', user.id)
          .in('class_item_id', allItemIds)
      : { data: [] }
  const progress = progressData ?? []
  const completed = completedItemIds(progress)

  // ── Entitlements: fundamentals for each subscribed instrument, plus entitled style courses ──
  const activeInstruments = new Set(subs.filter((s) => s.status === 'active').map((s) => s.instrument))
  const entitledCourseIds = new Set(
    subs.filter((s) => s.status === 'active').flatMap((s) => (s.subscription_courses ?? []).map((sc) => sc.course?.id)).filter(Boolean) as string[]
  )
  const { data: fundamentalsData } =
    subs.length > 0
      ? await supabase
          .from('courses')
          .select('id, title, title_es, slug, thumbnail_url, instrument, musical_style:musical_styles(name, name_es)')
          .eq('is_fundamentals', true)
          .eq('is_published', true)
          .in('instrument', subs.map((s) => s.instrument))
      : { data: [] }
  const fundamentals = (fundamentalsData ?? []) as unknown as PlanCourseRow[]

  const rows: MyCourseRow[] = courses.map(({ course, enrolled_at, last_accessed_at }) => {
    const classes = orderedClasses(course.course_sections)
    const completion = courseCompletion(classes, completed)
    const currentClassIndex = currentClassIndexFor(classes, progress, completed)
    const currentClass = currentClassIndex === null ? null : classes[currentClassIndex]
    const firstClass = classes[0] ?? null
    const resumeTarget = completion.status === 'completed' ? null : (currentClass ?? firstClass)
    const covered =
      (!!course.is_fundamentals && !!course.instrument && activeInstruments.has(course.instrument)) ||
      entitledCourseIds.has(course.id)
    return {
      id: course.id,
      slug: course.slug ?? course.id,
      title: course.title,
      thumbnailUrl: course.thumbnail_url,
      styleName: course.musical_style?.name ?? null,
      countryName: course.musical_style?.country?.name ?? null,
      teacherName: course.teacher?.name ?? course.teacher_name ?? null,
      instrument: course.instrument,
      totalClasses: completion.totalClasses,
      doneClasses: completion.doneClasses,
      totalModules: course.course_sections?.length ?? 0,
      currentModuleIndex: currentClassIndex === null ? null : moduleIndexForClass(course.course_sections, currentClassIndex),
      currentClassIndex,
      currentClassTitle: currentClass?.title ?? null,
      pct: completion.pct,
      status: completion.status,
      href: courseHref(course),
      resumeHref: resumeTarget ? classHref(course, resumeTarget.id) : courseHref(course),
      lastAccessed: last_accessed_at ?? enrolled_at,
      inPlan: isAdmin || subs.length === 0 ? null : covered,
    }
  })
  const rowById = new Map(rows.map((r) => [r.id, r]))

  const toPlanCourse = (c: PlanCourseRow, kind: PlanCourse['kind']): PlanCourse => {
    localizeRow(c as unknown as Record<string, unknown>, locale, COURSE_FIELDS)
    if (c.musical_style) localizeRow(c.musical_style as unknown as Record<string, unknown>, locale, ['name'])
    const row = rowById.get(c.id)
    return {
      id: c.id,
      title: c.title,
      href: courseHref(c),
      resumeHref: row?.resumeHref ?? courseHref(c),
      thumbnailUrl: c.thumbnail_url,
      styleName: c.musical_style?.name ?? null,
      kind,
      pct: row ? row.pct : null,
      status: row ? row.status : null,
    }
  }

  const plans: PlanSummary[] = subs.map((s) => {
    const fundamental = fundamentals.find((f) => f.instrument === s.instrument)
    const styles = (s.subscription_courses ?? []).map((sc) => sc.course).filter((c): c is PlanCourseRow => !!c)
    const priceRow = s.billing_interval === 'year' ? prices.base_annual : prices.base_monthly
    return {
      id: s.id,
      instrument: s.instrument,
      interval: s.billing_interval ?? 'month',
      status: s.status,
      renewsAt: s.base_current_period_end,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
      priceCents: priceRow.amount_cents,
      addonPriceCents: prices.addon_monthly.amount_cents,
      currency: priceRow.currency,
      courses: [...(fundamental ? [toPlanCourse(fundamental, 'fundamentals')] : []), ...styles.map((c) => toPlanCourse(c, 'style'))],
    }
  })

  const counts = {
    all: rows.length,
    inProgress: rows.filter((r) => r.status === 'in-progress').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  }

  const visible = rows
    .filter((r) => (filter === 'all' ? true : r.status === filter))
    .sort((a, b) => {
      if (sort === 'progress') return b.pct - a.pct || a.title.localeCompare(b.title)
      if (sort === 'alphabetical') return a.title.localeCompare(b.title)
      return new Date(b.lastAccessed ?? 0).getTime() - new Date(a.lastAccessed ?? 0).getTime()
    })

  return (
    <MyCoursesView
      courses={visible}
      counts={counts}
      filter={filter}
      sort={sort}
      plans={plans}
      basePrice={{ cents: prices.base_monthly.amount_cents, currency: prices.base_monthly.currency }}
      isAdmin={isAdmin}
    />
  )
}
