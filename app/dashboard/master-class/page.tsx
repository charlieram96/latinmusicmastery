import { createClient } from '@/lib/supabase/server'
import { MasterClassView } from './master-class-view'

export default async function MasterClassPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      thumbnail_url,
      difficulty,
      teacher_name,
      teacher_image_url,
      instrument,
      musical_style:musical_styles(name)
    `)
    .eq('is_master_class', true)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

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
