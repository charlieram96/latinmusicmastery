import { createClient } from '@/lib/supabase/server'
import { HeaderContinueClient } from './header-continue'

interface LastClass {
  classId: string
  courseId: string
  classTitle: string
  courseTitle: string
}

async function getLastClass(userId: string): Promise<LastClass | null> {
  const supabase = await createClient()

  // Get most recent incomplete class item progress, joined back to class/course
  const { data } = await supabase
    .from('class_item_progress')
    .select(`
      class_item_id,
      class_items (
        id,
        class_id,
        classes (
          id,
          title,
          section:course_sections (
            course_id,
            courses (
              id,
              title,
              slug
            )
          )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!data || !data.class_items) {
    return null
  }

  const item = data.class_items as any
  const cls = item.classes
  const section = cls?.section
  const course = section?.courses

  if (!cls || !course) {
    return null
  }

  return {
    classId: cls.id,
    courseId: course.slug || course.id,
    classTitle: cls.title,
    courseTitle: course.title,
  }
}

export async function HeaderContinue({ userId }: { userId: string }) {
  const lastClass = await getLastClass(userId)

  if (!lastClass) {
    return null
  }

  return (
    <HeaderContinueClient
      classId={lastClass.classId}
      courseId={lastClass.courseId}
      classTitle={lastClass.classTitle}
      courseTitle={lastClass.courseTitle}
    />
  )
}
