import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CourseStudio } from '@/components/admin/course-studio/course-studio'
import { getCourseStructure } from '@/app/actions/course-builder'

interface CourseEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch course details
  const { data: course } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        id,
        name,
        country:countries(name)
      ),
      teacher:teachers(
        id,
        name,
        instrument
      )
    `)
    .eq('id', id)
    .single()

  if (!course) {
    notFound()
  }

  // Fetch all musical styles for the dropdown
  const { data: musicalStyles } = await supabase
    .from('musical_styles')
    .select('id, name, country:countries(name)')
    .order('name')

  // Fetch all teachers for the dropdown
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, instrument')
    .order('name')

  // Fetch course structure (sections -> classes -> items)
  const { data: sections } = await getCourseStructure(id)

  return (
    <CourseStudio
      course={{
        id: course.id,
        title: course.title,
        title_es: course.title_es,
        slug: course.slug,
        description: course.description,
        description_es: course.description_es,
        musical_style_id: course.musical_style_id,
        teacher_id: course.teacher_id,
        is_published: course.is_published ?? false,
        thumbnail_url: course.thumbnail_url,
        instrument: course.instrument,
        is_fundamentals: course.is_fundamentals ?? false,
      }}
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
      initialSections={(sections || []) as any}
    />
  )
}
