import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCourse } from '@/lib/subscriptions'
import { ModuleView } from './module-view'

interface PageProps {
  params: Promise<{
    moduleId: string
  }>
}

export default async function ModulePage({ params }: PageProps) {
  const { moduleId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get module with course details
  const { data: module } = await supabase
    .from('course_modules_legacy')
    .select(`
      *,
      course:courses(
        id,
        title,
        instrument,
        musical_style:musical_styles(
          id,
          name,
          slug,
          country:countries(
            id,
            name,
            slug
          )
        )
      )
    `)
    .eq('id', moduleId)
    .single()

  if (!module) {
    notFound()
  }

  // Check access via subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = await canAccessCourse(supabase, user.id, (module.course as any)?.instrument, profile?.is_admin ?? false)

  // Check if user has access
  if (!module.is_free && !isStudent) {
    redirect(`/dashboard/course/${module.course_id}`)
  }

  // Get all modules in this course for navigation
  const { data: courseModules } = await supabase
    .from('course_modules_legacy')
    .select('id, title, order_index, is_free, module_type')
    .eq('course_id', module.course_id)
    .order('order_index')

  // Get user progress for all modules in this course
  const moduleIds = courseModules?.map(m => m.id) || []
  const { data: progressData } = await supabase
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', user.id)
    .in('module_id', moduleIds)

  const progressMap = new Map<string, any>(
    (progressData || [])
      .filter(p => p.module_id !== null)
      .map(p => [p.module_id as string, p])
  )

  // Get current module progress
  const currentProgress = progressMap.get(moduleId)

  // Find previous and next modules
  const currentIndex = courseModules?.findIndex(m => m.id === moduleId) || 0
  const previousModule = currentIndex > 0 ? courseModules?.[currentIndex - 1] : null
  const nextModule = currentIndex < (courseModules?.length || 0) - 1 ? courseModules?.[currentIndex + 1] : null

  // Check if next module is accessible (isStudent already accounts for subscription + admin)
  const canAccessNext = !!(nextModule && (nextModule.is_free || isStudent))

  return (
    <ModuleView
      module={module}
      moduleId={moduleId}
      userId={user.id}
      courseModules={courseModules || []}
      progressEntries={Array.from(progressMap.entries())}
      currentProgressCompleted={!!currentProgress?.completed}
      previousModule={previousModule || null}
      nextModule={nextModule || null}
      canAccessNext={canAccessNext}
      isStudent={isStudent}
    />
  )
}
