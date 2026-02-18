import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { getComments } from '@/app/actions/comments'
import { ClassViewerNav } from '@/components/class-viewer/class-viewer-nav'
import { ClassStepIndicator } from '@/components/class-viewer/class-step-indicator'
import { ClassItemRenderer } from '@/components/class-viewer/class-item-renderer'
import { ClassNavigation } from '@/components/class-viewer/class-navigation'
import { CourseSidebar } from '@/components/class-viewer/course-sidebar'
import { CommentsSection } from '@/components/comments/comments-section'

interface PageProps {
  params: Promise<{
    courseId: string
    classId: string
  }>
  searchParams: Promise<{
    item?: string
  }>
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
          slug,
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

  const course = (classData.section as any).course
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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('rank, is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = profile?.rank === 'student' || profile?.is_admin

  // Check access
  if (!classData.is_free && !isStudent) {
    redirect(`/dashboard/course/${courseId}`)
  }

  // Get course structure for sidebar
  const structureResult = await getCourseStructureForStudent(course.id)
  const structure = structureResult.data

  // Get progress for current class items
  const completedItemIds: string[] = []
  if (structure) {
    for (const section of structure.sections) {
      for (const cls of section.classes) {
        if (cls.id === classId) {
          completedItemIds.push(...(cls.completedItemIds || []))
        }
      }
    }
  }

  const isCurrentItemCompleted = activeItem
    ? completedItemIds.includes(activeItem.id)
    : false

  // Find next class
  let nextClassId: string | null = null
  if (structure) {
    let foundCurrent = false
    for (const section of structure.sections) {
      for (const cls of section.classes) {
        if (foundCurrent) {
          nextClassId = cls.id
          break
        }
        if (cls.id === classId) {
          foundCurrent = true
        }
      }
      if (nextClassId) break
    }
  }

  // Get comments
  const commentsResult = await getComments(classId)
  const comments = commentsResult.data || []

  // Build sidebar sections
  const sidebarSections = structure?.sections.map((s: any) => ({
    id: s.id,
    title: s.title,
    totalItems: s.totalItems,
    completedItems: s.completedItems,
    classes: s.classes.map((c: any) => ({
      id: c.id,
      title: c.title,
      totalItems: c.totalItems,
      completedItems: c.completedItems,
    })),
  })) || []

  return (
    <>
      {/* Top Navigation */}
      <ClassViewerNav
        courseId={courseId}
        courseTitle={course.title}
        classTitle={classData.title}
        classItemId={activeItem?.id || null}
        isCompleted={isCurrentItemCompleted}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step Indicator */}
          {items.length > 1 && (
            <ClassStepIndicator
              items={items}
              activeIndex={activeIndex}
              completedItemIds={completedItemIds}
              courseId={courseId}
              classId={classId}
            />
          )}

          {/* Item Content */}
          {activeItem ? (
            <ClassItemRenderer item={activeItem} userId={user.id} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No content available for this class yet.
            </div>
          )}

          {/* Navigation */}
          <ClassNavigation
            courseId={courseId}
            classId={classId}
            currentIndex={activeIndex}
            totalItems={items.length}
            nextClassId={nextClassId}
          />

          {/* Comments */}
          <CommentsSection
            classId={classId}
            initialComments={comments}
            userId={user.id}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <CourseSidebar
            courseId={courseId}
            currentClassId={classId}
            sections={sidebarSections}
          />
        </div>
      </div>
    </>
  )
}
