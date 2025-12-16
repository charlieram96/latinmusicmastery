import { createClient } from '@/lib/supabase/server'
import { HeaderContinueClient } from './header-continue'

interface LastLesson {
  lessonId: string
  lessonTitle: string
  courseTitle: string
}

async function getLastLesson(userId: string): Promise<LastLesson | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_progress')
    .select(`
      lesson_id,
      lessons (
        id,
        title,
        courses (
          title
        )
      )
    `)
    .eq('user_id', userId)
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!data || !data.lessons) {
    return null
  }

  const lesson = data.lessons as any

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    courseTitle: lesson.courses?.title || 'Course',
  }
}

export async function HeaderContinue({ userId }: { userId: string }) {
  const lastLesson = await getLastLesson(userId)

  if (!lastLesson) {
    return null
  }

  return (
    <HeaderContinueClient
      lessonId={lastLesson.lessonId}
      lessonTitle={lastLesson.lessonTitle}
      courseTitle={lastLesson.courseTitle}
    />
  )
}
