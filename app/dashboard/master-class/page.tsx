import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse } from '@/lib/i18n/localize'
import { MasterClassView } from './master-class-view'

export default async function MasterClassPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      title_es,
      slug,
      thumbnail_url,
      difficulty,
      teacher_name,
      teacher_image_url,
      instrument,
      musical_style:musical_styles(name, name_es)
    `)
    .eq('is_master_class', true)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const locale = await getServerLocale()
  for (const c of courses ?? []) localizeCourse(c as Record<string, unknown>, locale)

  const masterClasses = courses || []

  const totalClasses = masterClasses.length
  const uniqueTeachers = [...new Set(masterClasses.map(c => c.teacher_name))].length
  const uniqueInstruments = [...new Set(masterClasses.map(c => c.instrument).filter(Boolean))].length

  return (
    <MasterClassView
      masterClasses={masterClasses}
      totalClasses={totalClasses}
      uniqueTeachers={uniqueTeachers}
      uniqueInstruments={uniqueInstruments}
    />
  )
}
