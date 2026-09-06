import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse, localizeSectionTree } from '@/lib/i18n/localize'
import {
  classHref,
  completedItemIds,
  courseCompletion,
  courseHref,
  currentClassIndexFor,
  moduleIndexForClass,
  orderedClasses,
} from '@/lib/dashboard/course-progress'
import type { MyCourseRow } from '@/types/dashboard'
import { MyCoursesView } from './my-courses-view'
import type { MyCoursesFilter, MyCoursesSort } from '@/components/dashboard/my-courses-toolbar'

interface PageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>
}

/* ── Row shapes returned by the query below ───────────────────────── */
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

  const { data: enrollmentData } = await supabase
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
    .eq('user_id', user.id)

  const enrollments = (enrollmentData ?? []) as unknown as EnrollmentRow[]
  const locale = await getServerLocale()
  for (const enrollment of enrollments) {
    if (!enrollment.course) continue
    const course = enrollment.course as unknown as Record<string, unknown>
    localizeCourse(course, locale)
    localizeSectionTree(course['course_sections'] as Record<string, unknown>[] | undefined, locale)
  }

  const courses = enrollments.filter((e): e is EnrollmentRow & { course: CourseRow } => e.course !== null)

  // One progress query for every item across every enrolled course.
  const allItemIds = courses.flatMap((e) => orderedClasses(e.course.course_sections).flatMap((c) => c.items ?? [])).map((it) => it.id)
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

  const rows: MyCourseRow[] = courses.map(({ course, enrolled_at, last_accessed_at }) => {
    const classes = orderedClasses(course.course_sections)
    const completion = courseCompletion(classes, completed)
    const currentClassIndex = currentClassIndexFor(classes, progress, completed)
    const currentClass = currentClassIndex === null ? null : classes[currentClassIndex]
    const firstClass = classes[0] ?? null
    const resumeTarget = completion.status === 'completed' ? null : (currentClass ?? firstClass)
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

  return <MyCoursesView courses={visible} counts={counts} filter={filter} sort={sort} />
}
