import { createClient } from '@/lib/supabase/server'
import { HeaderContinueClient } from './header-continue'

interface LastModule {
  moduleId: string
  moduleTitle: string
  courseTitle: string
}

async function getLastModule(userId: string): Promise<LastModule | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_progress')
    .select(`
      module_id,
      course_modules (
        id,
        title,
        courses (
          title
        )
      )
    `)
    .eq('user_id', userId)
    .eq('completed', false)
    .not('module_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!data || !data.course_modules) {
    return null
  }

  const mod = data.course_modules as any

  return {
    moduleId: mod.id,
    moduleTitle: mod.title,
    courseTitle: mod.courses?.title || 'Course',
  }
}

export async function HeaderContinue({ userId }: { userId: string }) {
  const lastModule = await getLastModule(userId)

  if (!lastModule) {
    return null
  }

  return (
    <HeaderContinueClient
      moduleId={lastModule.moduleId}
      moduleTitle={lastModule.moduleTitle}
      courseTitle={lastModule.courseTitle}
    />
  )
}
