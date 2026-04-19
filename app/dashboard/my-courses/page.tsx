import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MyCoursesView } from './my-courses-view'

interface PageProps {
  searchParams: Promise<{
    filter?: 'all' | 'in-progress' | 'completed'
    sort?: 'recent' | 'progress' | 'alphabetical'
  }>
}

export default async function MyCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's course enrollments with new hierarchy
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select(`
      *,
      course:courses(
        *,
        course_sections(
          id, title, order_index,
          classes(
            id, title, order_index,
            items:class_items(id)
          )
        ),
        musical_style:musical_styles(
          name,
          country:countries(name)
        ),
        teacher:teachers(name, image_url)
      )
    `)
    .eq('user_id', user.id)

  // Collect all item IDs across all enrolled courses
  const allItemIds: string[] = []
  const courseItemMap = new Map<string, string[]>()

  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds: string[] = []
    for (const section of course.course_sections || []) {
      for (const cls of section.classes || []) {
        for (const item of cls.items || []) {
          itemIds.push(item.id)
          allItemIds.push(item.id)
        }
      }
    }
    courseItemMap.set(course.id, itemIds)
  }

  // Get progress for all items in one query
  let progressData: any[] = []
  if (allItemIds.length > 0) {
    const { data } = await supabase
      .from('class_item_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('class_item_id', allItemIds)
    progressData = data || []
  }

  const completedItemIds = new Set(
    progressData.filter(p => p.completed).map(p => p.class_item_id)
  )

  // Build enriched courses array
  let enrolledCourses = (enrollments || []).map((enrollment: any) => {
    const course = enrollment.course
    if (!course) return null

    const itemIds = courseItemMap.get(course.id) || []
    const totalItems = itemIds.length
    const completedCount = itemIds.filter(id => completedItemIds.has(id)).length

    // Sort sections and classes by order_index to compute current position
    const sortedSections = [...(course.course_sections || [])]
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((section: any) => ({
        ...section,
        classes: [...(section.classes || [])]
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)),
      }))

    const totalSections = sortedSections.length

    // Find current (first incomplete) class
    let currentSectionTitle: string | null = null
    let currentSectionIndex: number | null = null
    let currentClassTitle: string | null = null
    let currentClassId: string | null = null

    if (totalItems > 0 && completedCount < totalItems) {
      // Walk sections → classes → items to find first incomplete class
      let found = false
      for (let si = 0; si < sortedSections.length && !found; si++) {
        const section = sortedSections[si]
        for (const cls of section.classes || []) {
          const classItemIds = (cls.items || []).map((item: any) => item.id)
          const allComplete = classItemIds.length > 0 && classItemIds.every((id: string) => completedItemIds.has(id))
          if (!allComplete) {
            currentSectionTitle = section.title || `Module ${si + 1}`
            currentSectionIndex = si + 1
            currentClassTitle = cls.title || 'Untitled Class'
            currentClassId = cls.id
            found = true
            break
          }
        }
      }

      // Fallback to first section/class if nothing found (e.g. 0 progress)
      if (!found && sortedSections.length > 0) {
        const firstSection = sortedSections[0]
        currentSectionTitle = firstSection.title || 'Module 1'
        currentSectionIndex = 1
        const firstClass = firstSection.classes?.[0]
        if (firstClass) {
          currentClassTitle = firstClass.title || 'Untitled Class'
          currentClassId = firstClass.id
        }
      }
    }
    // If completedCount === totalItems && totalItems > 0 → complete, leave nulls

    return {
      ...course,
      totalLessons: totalItems,
      completedLessons: completedCount,
      lastAccessed: enrollment.last_accessed_at || enrollment.enrolled_at,
      enrolledAt: enrollment.enrolled_at,
      currentSectionTitle,
      currentSectionIndex,
      totalSections,
      currentClassTitle,
      currentClassId,
    }
  }).filter(Boolean) as any[]

  // Apply filter
  const filter = params.filter || 'all'
  if (filter === 'in-progress') {
    enrolledCourses = enrolledCourses.filter(c =>
      c.completedLessons > 0 && c.completedLessons < c.totalLessons
    )
  } else if (filter === 'completed') {
    enrolledCourses = enrolledCourses.filter(c =>
      c.completedLessons === c.totalLessons && c.totalLessons > 0
    )
  }

  // Apply sort
  const sort = params.sort || 'recent'
  if (sort === 'recent') {
    enrolledCourses.sort((a, b) =>
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    )
  } else if (sort === 'progress') {
    enrolledCourses.sort((a, b) => {
      const progressA = a.totalLessons > 0 ? a.completedLessons / a.totalLessons : 0
      const progressB = b.totalLessons > 0 ? b.completedLessons / b.totalLessons : 0
      return progressB - progressA
    })
  } else if (sort === 'alphabetical') {
    enrolledCourses.sort((a, b) => a.title.localeCompare(b.title))
  }

  // Get counts for filter badges (from unfiltered data)
  const allCourses = (enrollments || []).map((e: any) => {
    const course = e.course
    if (!course) return null
    const itemIds = courseItemMap.get(course.id) || []
    return {
      totalLessons: itemIds.length,
      completedLessons: itemIds.filter(id => completedItemIds.has(id)).length,
    }
  }).filter(Boolean) as any[]

  const counts = {
    all: allCourses.length,
    inProgress: allCourses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons).length,
    completed: allCourses.filter(c => c.completedLessons === c.totalLessons && c.totalLessons > 0).length,
  }

  return <MyCoursesView enrolledCourses={enrolledCourses} counts={counts} filter={filter} />
}
