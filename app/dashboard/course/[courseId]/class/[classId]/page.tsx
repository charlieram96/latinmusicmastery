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
import { canAccessCourse } from '@/lib/subscriptions'

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
          description,
          slug,
          instrument,
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

  // Check access via subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = await canAccessCourse(supabase, user.id, course.instrument, profile?.is_admin ?? false)

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
    <div className="-m-6 flex h-[calc(100vh-3.5rem)]">
      {/* Left Sidebar */}
      <aside className="hidden lg:flex w-80 flex-shrink-0 border-r bg-muted/30 flex-col overflow-y-auto">
        <CourseSidebar
          courseId={courseId}
          currentClassId={classId}
          sections={sidebarSections}
          courseTitle={course.title}
          courseDescription={course.description}
        />
      </aside>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Top Navigation */}
        <ClassViewerNav
          courseId={courseId}
          courseTitle={course.title}
          classTitle={classData.title}
          classItemId={activeItem?.id || null}
          isCompleted={isCurrentItemCompleted}
        />

        <div className="p-6 space-y-6">
          {/* Class Details Header */}
          <div>
            <h1 className="text-2xl font-bold">{classData.title}</h1>
            {classData.description && (
              <p className="text-muted-foreground mt-1">{classData.description}</p>
            )}
          </div>

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
      </div>
    </div>
  )
}
