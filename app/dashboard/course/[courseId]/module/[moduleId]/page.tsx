import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow, localizeCourse, SECTION_FIELDS } from '@/lib/i18n/localize'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { LessonShell } from '@/components/class-viewer/lesson-viewer/lesson-shell'
import { canAccessCourse } from '@/lib/subscriptions'
import {
  summarizeModule,
  toSidebarSections,
  videoDurationSeconds,
} from '@/lib/courses/structure'
import { ModuleOverviewBody, type ModuleOverviewLesson } from './module-overview-body'

// Student module overview: full module description + its lessons (with their
// descriptions), rendered inside the lesson viewer shell so the course
// sidebar stays put with this module highlighted and expanded.

interface PageProps {
  params: Promise<{
    courseId: string
    moduleId: string
  }>
}

// Shape of the section + course join below (the generated join types treat
// to-one relations loosely, so we narrow once here instead of using `any`).
interface SectionRow {
  id: string
  title: string
  description: string | null
  course_id: string
  course: {
    id: string
    title: string
    slug: string | null
    thumbnail_url: string | null
    instrument: string | null
    difficulty: string | null
    is_fundamentals: boolean | null
    teacher: { name: string | null; image_url: string | null } | null
  } | null
}

export default async function ModuleOverviewPage({ params }: PageProps) {
  const { courseId, moduleId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Module (course_sections) with its course, same join shape as the lesson page.
  const { data: sectionData } = await supabase
    .from('course_sections')
    .select(`
      id,
      title,
      title_es,
      description,
      description_es,
      course_id,
      course:courses (
        id,
        title,
        title_es,
        slug,
        thumbnail_url,
        instrument,
        difficulty,
        is_fundamentals,
        teacher:teachers (name, image_url)
      )
    `)
    .eq('id', moduleId)
    .single()

  const section = sectionData as unknown as SectionRow | null
  const course = section?.course
  if (!section || !course) {
    notFound()
  }
  // The course segment may be a slug or a UUID (never filter on course_id);
  // reject a module that belongs to a different course than the URL says.
  if (course.id !== courseId && course.slug !== courseId) {
    notFound()
  }

  const locale = await getServerLocale()
  localizeRow(section as unknown as Record<string, unknown>, locale, SECTION_FIELDS)
  localizeCourse(course as unknown as Record<string, unknown>, locale)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  const hasAccess = await canAccessCourse(supabase, user.id, course, profile?.is_admin ?? false)

  // Already localized, ordered, and progress-enriched.
  const structureResult = await getCourseStructureForStudent(course.id)
  const sections = structureResult.data?.sections ?? []
  const moduleIndex = sections.findIndex((s) => s.id === moduleId)
  if (moduleIndex === -1) {
    notFound()
  }
  const structureModule = sections[moduleIndex]

  const summary = summarizeModule(structureModule)
  const lessons: ModuleOverviewLesson[] = structureModule.classes.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? null,
    isFree: c.is_free ?? false,
    totalItems: c.totalItems,
    completedItems: c.completedItems,
    durationSeconds: videoDurationSeconds(c.items),
  }))

  const teacherName = course.teacher?.name ?? null
  const teacherImageUrl = course.teacher?.image_url ?? null
  const courseImageUrl = course.thumbnail_url ?? null

  return (
    <LessonShell
      sidebar={{
        courseId,
        currentClassId: null,
        currentSectionId: moduleId,
        sections: toSidebarSections(sections),
        courseTitle: course.title,
        courseImageUrl,
        teacherName,
        teacherImageUrl,
        hasAccess,
      }}
      header={{
        eyebrow: course.title,
        eyebrowHref: `/dashboard/course/${courseId}`,
        title: structureModule.title,
      }}
      parts={null}
      footer={null}
      body={
        // Wrapped like the lesson page's body: a bare client-component element
        // handed straight to a client slot prop trips React's dev-only
        // missing-key check when the shell renders it among its children.
        <>
          <ModuleOverviewBody
            courseId={courseId}
            moduleIndex={moduleIndex}
            description={structureModule.description ?? null}
            hasAccess={hasAccess}
            summary={summary}
            lessons={lessons}
          />
        </>
      }
    />
  )
}
