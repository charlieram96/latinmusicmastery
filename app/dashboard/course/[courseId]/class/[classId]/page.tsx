import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { localizeRow, localizeRows, CLASS_FIELDS, SECTION_FIELDS, COURSE_FIELDS, STYLE_FIELDS, ITEM_FIELDS } from '@/lib/i18n/localize'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { getComments } from '@/app/actions/comments'
import { ClassItemRenderer } from '@/components/class-viewer/class-item-renderer'
import { CommentsSection } from '@/components/comments/comments-section'
import { LessonModeShell, type LessonModeShellProps } from '@/components/class-viewer/lesson-viewer/lesson-mode/lesson-mode-shell'
import { canAccessCourse } from '@/lib/subscriptions'
import { railLessons } from '@/lib/courses/lesson-rail'
import { buildPathNodes } from '@/lib/courses/path-nodes'
import { dateKeyFor, todayKey } from '@/lib/dashboard/time-zone'
import { ClassViewerEmpty } from './class-viewer-empty'
import { ClassViewerLocked } from './class-viewer-locked'

interface PageProps {
  params: Promise<{
    courseId: string
    classId: string
  }>
  searchParams: Promise<{
    item?: string
    preview?: string
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
  const { item: itemParam, preview } = await searchParams
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

  const teacherName = (course.teacher as { name?: string } | null)?.name ?? null
  const teacherImageUrl =
    (course.teacher as { image_url?: string | null } | null)?.image_url ?? null
  const moduleTitle = section.title as string

  // The lesson rail: this module's lessons as path nodes; the next lesson for the celebration.
  const structureSections = structure?.sections ?? []
  const { lessons: rail, moduleIndex } = railLessons(courseId, structureSections, classId, isStudent)
  const pathNodes = buildPathNodes(courseId, structureSections, classId)
  const currentNode = pathNodes.findIndex((n) => n.kind === 'lesson' && n.id === classId)
  const nextNode = currentNode === -1 ? undefined : pathNodes.slice(currentNode + 1).find((n) => n.kind === 'lesson')

  // Streak and weekly goal: the dashboard's source (completed parts, local day keys).
  const { data: completionRows } = await supabase
    .from('class_item_progress')
    .select('completed_at, class_item_id')
    .eq('user_id', user.id)
    .eq('completed', true)
    .not('completed_at', 'is', null)
  const today = todayKey()
  const lessonItemIds = new Set(items.map((item: { id: string }) => item.id))
  const dateKeys = (completionRows ?? []).map((r) => dateKeyFor(r.completed_at as string))
  const practice = {
    dateKeys,
    today,
    // This lesson's parts already saved today: the celebration's "before" leaves them out.
    lessonToday: (completionRows ?? []).filter((r, i) => dateKeys[i] === today && lessonItemIds.has(r.class_item_id as string)).length,
  }

  const difficulty = course.difficulty ? String(course.difficulty).toLowerCase() : null
  const levelLabel = !difficulty
    ? null
    : ['beginner', 'intermediate', 'advanced'].includes(difficulty)
      ? t(`dashboard.pages.course.difficulty.${difficulty}`)
      : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
  // Prefer the lesson's own description; fall back to the section's.
  const lessonDescription =
    (classData.description as string | null) ||
    (section.description as string | null) ||
    null

  const shared: Omit<LessonModeShellProps, 'parts' | 'activeIndex' | 'progress' | 'body' | 'comments' | 'commentCount' | 'about'> = {
    course: { id: courseId, title: course.title },
    module: { id: section.id, title: moduleTitle, index: Math.max(0, moduleIndex) },
    lesson: { id: classId, title: classData.title },
    rail,
    practice,
    teacherName,
    nextLesson: nextNode && nextNode.kind === 'lesson'
      ? { title: nextNode.title, kind: nextNode.types.includes('play') ? 'play' : nextNode.types.includes('video') ? 'video' : nextNode.types[0] ?? 'other', minutes: nextNode.minutes, href: nextNode.href }
      : null,
  }
  const teacherMeta = teacherName ? { name: teacherName, imageUrl: teacherImageUrl } : null

  // Subscription-gated: show a paywall instead of the lesson content.
  if (locked) {
    return (
      <LessonModeShell
        {...shared}
        parts={[]}
        activeIndex={0}
        progress={null}
        about={{ description: lessonDescription, meta: { level: levelLabel, teacher: teacherMeta } }}
        comments={null}
        commentCount={0}
        body={<ClassViewerLocked courseId={courseId} />}
      />
    )
  }

  // Get progress for current class items
  const completedItemIds: string[] = []
  for (const s of structureSections) {
    for (const cls of s.classes) {
      if (cls.id === classId) {
        completedItemIds.push(...(cls.completedItemIds || []))
      }
    }
  }

  const isCurrentItemCompleted = activeItem
    ? completedItemIds.includes(activeItem.id)
    : false

  // Find next class + its title
  let nextClassId: string | null = null
  let nextClassTitle: string | null = null
  let foundCurrent = false
  outer: for (const s of structureSections) {
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

  // Get comments
  const commentsResult = await getComments(classId)
  const comments = commentsResult.data || []

  const durationLabel = formatDuration(activeItem?.video_duration_seconds ?? null)

  const body = activeItem ? (
    <div data-lesson-item>
      <ClassItemRenderer item={activeItem} userId={user.id} playerLayout="split" teacherName={teacherName} previewExercise={process.env.NODE_ENV === 'development' && preview === 'exercise'} previewLesson={process.env.NODE_ENV === 'development' && preview === 'lesson'} nextHref={activeIndex < items.length - 1 ? `/dashboard/course/${courseId}/class/${classId}?item=${activeIndex + 1}` : nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : null} />
    </div>
  ) : (
    <ClassViewerEmpty />
  )

  return (
    <LessonModeShell
      {...shared}
      parts={items.map((it: { id: string; title: string; item_type: string }) => ({ id: it.id, title: it.title, item_type: it.item_type }))}
      activeIndex={activeIndex}
      progress={{
        courseId,
        classId,
        currentIndex: activeIndex,
        totalItems: items.length,
        itemIds: items.map((item: { id: string }) => item.id),
        completedItemIds,
        nextClassId,
        activeItemId: activeItem?.id ?? null,
        activeItemType: activeItem?.item_type ?? null,
        isCompleted: isCurrentItemCompleted,
        nextLabel: activeIndex < items.length - 1 ? items[activeIndex + 1].title : nextClassTitle,
      }}
      about={{ description: lessonDescription, meta: { duration: durationLabel, level: levelLabel, teacher: teacherMeta } }}
      comments={<CommentsSection classId={classId} initialComments={comments} userId={user.id} />}
      commentCount={comments.length}
      body={body}
    />
  )
}
