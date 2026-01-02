import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CourseBuilder } from '@/components/admin/course-builder'
import { CourseEditForm } from '@/components/admin/course-edit-form'
import { CourseModule } from '@/types/modules'

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

  // Fetch course modules
  const { data: modules } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', id)
    .order('order_index')

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </Link>
        <h1 className="text-3xl font-bold">Edit Course</h1>
        <p className="text-muted-foreground mt-2">
          Update course details and manage content
        </p>
      </div>

      {/* Edit Form */}
      <CourseEditForm
        course={{
          id: course.id,
          title: course.title,
          slug: course.slug,
          description: course.description,
          musical_style_id: course.musical_style_id,
          teacher_id: course.teacher_id,
          is_published: course.is_published,
          thumbnail_url: course.thumbnail_url,
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
      />

      {/* Course Builder */}
      <div className="mt-8">
        <CourseBuilder
          courseId={course.id}
          initialModules={(modules || []) as CourseModule[]}
        />
      </div>
    </div>
  )
}
