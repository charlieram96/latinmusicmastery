import { createClient } from '@/lib/supabase/server'
import { NewCourseForm } from '@/components/admin/course-studio/new-course-form'

export default async function NewCoursePage() {
  const supabase = await createClient()

  const { data: musicalStyles } = await supabase
    .from('musical_styles')
    .select('id, name, country:countries(name)')
    .order('name')

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, instrument')
    .order('name')

  return (
    <NewCourseForm
      musicalStyles={(musicalStyles || []).map((style: any) => ({
        id: style.id,
        name: style.name,
        country: style.country,
      }))}
      teachers={(teachers || []).map((teacher: any) => ({
        id: teacher.id,
        name: teacher.name,
        instrument: teacher.instrument,
      }))}
    />
  )
}
