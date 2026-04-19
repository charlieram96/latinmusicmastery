import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesView } from './courses-view'

interface PageProps {
  searchParams: Promise<{
    search?: string
    teachers?: string
    difficulty?: string
    style?: string
    instrument?: string
    view?: string
  }>
}

export default async function BrowseCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch filter options and user progress
  const [
    { data: teachers },
    { data: styles },
    { data: userProgress }
  ] = await Promise.all([
    supabase.from('teachers').select('id, name').order('name'),
    supabase.from('musical_styles').select('name').order('name'),
    supabase.from('user_progress_legacy').select('module_id, completed, module:course_modules_legacy(course_id)').eq('user_id', user.id)
  ])

  // Create a map of course progress
  const courseProgressMap = new Map<string, { started: boolean; completed: number }>()
  userProgress?.forEach((progress: any) => {
    const courseId = progress.module?.course_id
    if (courseId) {
      const existing = courseProgressMap.get(courseId) || { started: false, completed: 0 }
      existing.started = true
      if (progress.completed) existing.completed++
      courseProgressMap.set(courseId, existing)
    }
  })

  // Build course query with filters
  let query = supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        name,
        country:countries(name, slug)
      ),
      teacher:teachers(id, name, instrument, image_url),
      course_modules_legacy(id)
    `)
    .eq('is_published', true)

  // Apply search filter
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
  }

  // Apply difficulty filter
  if (params.difficulty) {
    query = query.eq('difficulty', params.difficulty)
  }

  // Apply style filter
  if (params.style) {
    query = query.eq('musical_style.name', params.style)
  }

  // Apply instrument filter directly on courses table
  if (params.instrument) {
    query = query.eq('instrument', params.instrument)
  }

  const { data: courses } = await query.order('created_at', { ascending: false })

  // Filter by teachers client-side (Supabase doesn't support IN on foreign keys easily)
  let filteredCourses = courses || []
  if (params.teachers) {
    const teacherIds = params.teachers.split(',')
    filteredCourses = filteredCourses.filter((course: any) =>
      course.teacher && teacherIds.includes(course.teacher.id)
    )
  }

  // Filter by style client-side for nested filter
  if (params.style) {
    filteredCourses = filteredCourses.filter((course: any) =>
      course.musical_style?.name === params.style
    )
  }

  // Get total count (unfiltered)
  const { count: totalCount } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)

  // Group courses by instrument when showing "All"
  const coursesByInstrument = new Map<string, any[]>()
  if (!params.instrument) {
    filteredCourses.forEach((course: any) => {
      const inst = course.instrument || 'Other'
      if (!coursesByInstrument.has(inst)) coursesByInstrument.set(inst, [])
      coursesByInstrument.get(inst)!.push(course)
    })
  } else {
    coursesByInstrument.set(params.instrument, filteredCourses)
  }
  const showGroupHeadings = !params.instrument && coursesByInstrument.size > 1

  const view = params.view || 'grid'

  return (
    <CoursesView
      params={params}
      filteredCourses={filteredCourses}
      coursesByInstrument={Array.from(coursesByInstrument.entries())}
      showGroupHeadings={showGroupHeadings}
      view={view}
      teachers={teachers || []}
      styles={styles || []}
      totalCount={totalCount || 0}
      courseProgressEntries={Array.from(courseProgressMap.entries())}
    />
  )
}
