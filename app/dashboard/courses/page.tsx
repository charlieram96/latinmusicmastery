import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse } from '@/lib/i18n/localize'
import { CoursesView, type BrowseCourse } from './courses-view'

interface CourseRow {
  id: string
  slug: string | null
  title: string
  description: string | null
  thumbnail_url: string | null
  instrument: string | null
  difficulty: string | null
  is_fundamentals: boolean | null
  created_at: string | null
  teacher_name: string | null
  musical_style: { name: string; country: { name: string } | null } | null
  teacher: { id: string; name: string; instrument: string | null; image_url: string | null } | null
  course_sections: { classes: { id: string }[] | null }[] | null
}

export default async function BrowseCoursesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Every published course; filtering happens client-side so it is instant.
  const { data } = await supabase
    .from('courses')
    .select(
      `
      *,
      musical_style:musical_styles(name, name_es, country:countries(name, name_es, slug)),
      teacher:teachers(id, name, instrument, instrument_es, image_url),
      course_sections(classes(id))
    `
    )
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const locale = await getServerLocale()
  const rows = (data ?? []) as unknown as CourseRow[]
  for (const c of rows) localizeCourse(c as unknown as Record<string, unknown>, locale)

  const courses: BrowseCourse[] = rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    thumbnailUrl: c.thumbnail_url,
    instrument: c.instrument,
    styleName: c.musical_style?.name ?? null,
    countryName: c.musical_style?.country?.name ?? null,
    difficulty: c.difficulty,
    isFundamentals: !!c.is_fundamentals,
    lessons: (c.course_sections ?? []).reduce((acc, s) => acc + (s.classes?.length ?? 0), 0),
    teacherName: c.teacher?.name ?? c.teacher_name ?? null,
    teacherImage: c.teacher?.image_url ?? null,
    createdAt: c.created_at,
  }))

  return <CoursesView courses={courses} />
}
