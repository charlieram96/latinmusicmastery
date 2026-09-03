import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse } from '@/lib/i18n/localize'
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
        name_es,
        country:countries(name, name_es, slug)
      ),
      teacher:teachers(id, name, instrument, instrument_es, image_url),
      course_sections(classes(id))
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const locale = await getServerLocale()
  for (const c of courses ?? []) localizeCourse(c as Record<string, unknown>, locale)

  return <CoursesView courses={courses || []} />
}
