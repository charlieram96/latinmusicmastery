import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesView } from './courses-view'

export default async function BrowseCoursesPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch all published courses — filtering happens client-side in the faceted rail
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        name,
        country:countries(name, slug)
      ),
      teacher:teachers(id, name, instrument, image_url),
      course_sections(classes(id))
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return <CoursesView courses={courses || []} />
}
