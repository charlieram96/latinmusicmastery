import { notFound, redirect } from 'next/navigation'
import { Clock, BarChart3 } from 'lucide-react'
import styles from '@/components/class-viewer/lesson-viewer/lesson-viewer.module.css'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { localizeRow, localizeRows, CLASS_FIELDS, SECTION_FIELDS, COURSE_FIELDS, STYLE_FIELDS, ITEM_FIELDS } from '@/lib/i18n/localize'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { getComments } from '@/app/actions/comments'
import { ClassItemRenderer } from '@/components/class-viewer/class-item-renderer'
import { CommentsSection } from '@/components/comments/comments-section'
import { LessonShell } from '@/components/class-viewer/lesson-viewer/lesson-shell'
import { HeaderTitleOverride } from '@/components/dashboard/header-title-override'
import { canAccessCourse } from '@/lib/subscriptions'
import { moduleOverviewHref, toSidebarSections } from '@/lib/courses/structure'
import { ClassViewerEmpty } from './class-viewer-empty'
import { ClassViewerLocked } from './class-viewer-locked'

interface PageProps {
  params: Promise<{
    courseId: string
    classId: string
  }>
  searchParams: Promise<{
    item?: string
  }>
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default async function ClassViewerPage({ params, searchParams }: PageProps) {
  const { courseId, classId } = await params
  const { item: itemParam } = await searchParams
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get class with items
  const { data: classData } = await supabase
    .from('classes')
    .select(`
      *,
      items:class_items (*),
      section:course_sections (
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
          description,
          description_es,
          slug,
          thumbnail_url,
          instrument,
          difficulty,
          is_fundamentals,
          teacher:teachers (name, image_url),
          musical_style:musical_styles (name, name_es)
        )
      )
    `)
    .eq('id', classId)
    .single()

  if (!classData || !classData.section) {
    notFound()
  }

  // Localize the directly-fetched class/section/course to the viewer's language.
  // (The sidebar structure is localized separately in getCourseStructureForStudent.)
  const { t, locale } = await getServerTranslator()
  localizeRow(classData as Record<string, unknown>, locale, CLASS_FIELDS)
  localizeRows(classData.items as Record<string, unknown>[], locale, ITEM_FIELDS)
  localizeRow(classData.section as Record<string, unknown>, locale, SECTION_FIELDS)
  localizeRow((classData.section as any).course as Record<string, unknown>, locale, COURSE_FIELDS)
  localizeRow((classData.section as any).course?.musical_style as Record<string, unknown>, locale, STYLE_FIELDS)

  const section = classData.section as any
  const course = section.course
  if (!course) {
    notFound()
  }

  // Sort items by order_index
  const items = (classData.items as any[] || []).sort(
    (a: any, b: any) => a.order_index - b.order_index
  )

  // Active item index
  const activeIndex = Math.min(
    Math.max(0, parseInt(itemParam || '0', 10) || 0),
    Math.max(0, items.length - 1)
  )
  const activeItem = items[activeIndex] || null

  // Check access via subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = await canAccessCourse(supabase, user.id, course, profile?.is_admin ?? false)
  const locked = !classData.is_free && !isStudent

  // Get course structure for sidebar
  const structureResult = await getCourseStructureForStudent(course.id)
  const structure = structureResult.data

  // Build sidebar sections (needed for both locked and unlocked views)
  const sidebarSections = toSidebarSections(structure?.sections ?? [])

  const teacherName = (course.teacher as { name?: string } | null)?.name ?? null
  const teacherImageUrl =
    (course.teacher as { image_url?: string | null } | null)?.image_url ?? null
  const courseImageUrl = (course.thumbnail_url as string | null) ?? null
  const moduleTitle = section.title as string

  // Subscription-gated: show a paywall instead of the lesson content.
  if (locked) {
    return (
      <>
        <HeaderTitleOverride title={course.title} />
        <LessonShell
        sidebar={{
          courseId,
          currentClassId: classId,
          sections: sidebarSections,
          courseTitle: course.title,
          courseImageUrl,
          teacherName,
          teacherImageUrl,
          hasAccess: isStudent,
        }}
        header={{
          eyebrow: moduleTitle,
          eyebrowHref: moduleOverviewHref(courseId, section.id),
          title: classData.title,
        }}
        parts={null}
        footer={null}
        body={
          <div className="px-4 py-6 md:px-8">
            <ClassViewerLocked courseId={courseId} />
          </div>
        }
      />
      </>
    )
  }

  // Get progress for current class items
  const completedItemIds: string[] = []
  if (structure) {
    for (const s of structure.sections) {
      for (const cls of s.classes) {
        if (cls.id === classId) {
          completedItemIds.push(...(cls.completedItemIds || []))
        }
      }
    }
  }

  const isCurrentItemCompleted = activeItem
    ? completedItemIds.includes(activeItem.id)
    : false

  // Find next class + its title
  let nextClassId: string | null = null
  let nextClassTitle: string | null = null
  if (structure) {
    let foundCurrent = false
    outer: for (const s of structure.sections) {
      for (const cls of s.classes) {
        if (foundCurrent) {
          nextClassId = cls.id
          nextClassTitle = cls.title
          break outer
        }
        if (cls.id === classId) {
          foundCurrent = true
        }
      }
    }
  }

  // Get comments
  const commentsResult = await getComments(classId)
  const comments = commentsResult.data || []

  const durationLabel = formatDuration(activeItem?.video_duration_seconds ?? null)
  const difficulty = course.difficulty ? String(course.difficulty).toLowerCase() : null
  const levelLabel = !difficulty
    ? null
    : ['beginner', 'intermediate', 'advanced'].includes(difficulty)
      ? t(`dashboard.pages.course.difficulty.${difficulty}`)
      : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)

  // Lesson description lives below the video (not in the sidebar / header).
  // Prefer the lesson's own description; fall back to the section's.
  const lessonDescription =
    (classData.description as string | null) ||
    (section.description as string | null) ||
    null

  const body = (
    <>
      {activeItem ? (
        <div className={`px-4 md:px-8 ${styles.rise}`} style={{ animationDelay: '80ms' }}>
          <ClassItemRenderer item={activeItem} userId={user.id} playerLayout="split" nextHref={activeIndex < items.length - 1 ? `/dashboard/course/${courseId}/class/${classId}?item=${activeIndex + 1}` : nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : null} />
        </div>
      ) : (
        <div className="px-4 pt-4 md:px-8">
          <ClassViewerEmpty />
        </div>
      )}

      <div className="px-4 pb-12 pt-6 md:px-8">
        {/* Meta pills */}
        {(durationLabel || levelLabel || teacherName) && (
          <div
            className={`mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-5 ${styles.rise}`}
            style={{ animationDelay: '120ms' }}
          >
            {durationLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-3 py-1 text-xs font-medium text-foreground/80">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {durationLabel}
              </span>
            )}
            {levelLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-3 py-1 text-xs font-medium text-foreground/80">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                {levelLabel}
              </span>
            )}
            {teacherName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-raised py-1 pl-1 pr-3 text-xs font-medium text-foreground/80">
                {teacherImageUrl ? (
                  <img
                    src={teacherImageUrl}
                    alt={teacherName}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[9px] font-bold font-heading">
                    {teacherName
                      .split(' ')
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
                {teacherName}
              </span>
            )}
          </div>
        )}

        {/* Lesson description — below the video, not in the sidebar/header */}
        {lessonDescription && (
          <div className="mb-10">
            <div className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {t('dashboard.pages.modules.aboutLesson')}
            </div>
            <div className="space-y-3">
              {lessonDescription
                .split(/\n{2,}/)
                .filter((p) => p.trim().length > 0)
                .map((para, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? 'whitespace-pre-wrap text-[15.5px] leading-[1.7] text-foreground'
                        : 'whitespace-pre-wrap text-[15.5px] leading-[1.7] text-foreground/75'
                    }
                  >
                    {para}
                  </p>
                ))}
            </div>
          </div>
        )}

        <div>
          <CommentsSection
            classId={classId}
            initialComments={comments}
            userId={user.id}
          />
        </div>
      </div>
    </>
  )

  return (
    <>
      <HeaderTitleOverride title={course.title} />
      <LessonShell
      sidebar={{
        courseId,
        currentClassId: classId,
        sections: sidebarSections,
        courseTitle: course.title,
        courseImageUrl,
        teacherName,
        teacherImageUrl,
        hasAccess: isStudent,
      }}
      header={{
        eyebrow: moduleTitle,
        eyebrowHref: moduleOverviewHref(courseId, section.id),
        title: classData.title,
      }}
      parts={
        items.length > 1
          ? {
              items: items.map((it: any) => ({
                id: it.id,
                title: it.title,
                item_type: it.item_type,
              })),
              activeIndex,
              completedItemIds,
              courseId,
              classId,
            }
          : null
      }
      footer={{
        courseId,
        classId,
        currentIndex: activeIndex,
        totalItems: items.length,
        nextClassId,
        activeItemId: activeItem?.id ?? null,
        isCompleted: isCurrentItemCompleted,
        nextLabel: nextClassTitle,
      }}
      body={body}
    />
    </>
  )
}
