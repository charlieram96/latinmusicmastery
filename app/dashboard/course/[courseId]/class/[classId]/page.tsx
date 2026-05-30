import { notFound, redirect } from 'next/navigation'
import { Clock, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { getComments } from '@/app/actions/comments'
import { ClassItemRenderer } from '@/components/class-viewer/class-item-renderer'
import { CommentsSection } from '@/components/comments/comments-section'
import { LessonShell } from '@/components/class-viewer/lesson-viewer/lesson-shell'
import { canAccessCourse } from '@/lib/subscriptions'
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
        course_id,
        course:courses (
          id,
          title,
          description,
          slug,
          instrument,
          difficulty,
          is_fundamentals,
          teacher:teachers (name),
          musical_style:musical_styles (name)
        )
      )
    `)
    .eq('id', classId)
    .single()

  if (!classData || !classData.section) {
    notFound()
  }

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
  const sidebarSections = structure?.sections.map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    totalItems: s.totalItems,
    completedItems: s.completedItems,
    classes: s.classes.map((c: any) => ({
      id: c.id,
      title: c.title,
      totalItems: c.totalItems,
      completedItems: c.completedItems,
    })),
  })) || []

  const teacherName = (course.teacher as { name?: string } | null)?.name ?? null
  const moduleTitle = section.title as string

  // Subscription-gated: show a paywall instead of the lesson content.
  if (locked) {
    return (
      <LessonShell
        sidebar={{
          courseId,
          currentClassId: classId,
          sections: sidebarSections,
          courseTitle: course.title,
          teacherName,
        }}
        header={{
          moduleTitle,
          title: classData.title,
          subtitle: classData.description,
        }}
        parts={null}
        footer={null}
        body={
          <div className="px-4 py-6 md:px-8">
            <ClassViewerLocked courseId={courseId} />
          </div>
        }
      />
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
  const levelLabel = course.difficulty
    ? String(course.difficulty).charAt(0).toUpperCase() + String(course.difficulty).slice(1)
    : null

  const body = (
    <>
      {activeItem ? (
        <div className="px-4 pt-4 md:px-8">
          <ClassItemRenderer item={activeItem} userId={user.id} playerLayout="split" />
        </div>
      ) : (
        <div className="px-4 pt-4 md:px-8">
          <ClassViewerEmpty />
        </div>
      )}

      <div className="px-4 pb-12 pt-6 md:px-8">
        {/* Compact meta strip */}
        {(durationLabel || levelLabel || teacherName) && (
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-5">
            {durationLabel && (
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(0_0%_78%)]">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {durationLabel}
              </span>
            )}
            {levelLabel && (
              <>
                {durationLabel && <span className="h-3.5 w-px bg-border" />}
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(0_0%_78%)]">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  {levelLabel}
                </span>
              </>
            )}
            {teacherName && (
              <>
                {(durationLabel || levelLabel) && (
                  <span className="h-3.5 w-px bg-border" />
                )}
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(0_0%_78%)]">
                  {teacherName}
                </span>
              </>
            )}
          </div>
        )}

        <div className="max-w-[860px]">
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
    <LessonShell
      sidebar={{
        courseId,
        currentClassId: classId,
        sections: sidebarSections,
        courseTitle: course.title,
        teacherName,
      }}
      header={{
        moduleTitle,
        title: classData.title,
        subtitle: classData.description,
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
  )
}
