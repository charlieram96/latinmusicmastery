import { COURSE_INSTRUMENTS } from '@/lib/instruments'
import { createClient } from '@/lib/supabase/server'

/** Catalog choices are independent of billing instruments and teacher specialties. */
export async function getCourseInstrumentOptions(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('instruments').select('name').order('name')
  if (error) throw new Error(error.message)
  const physical = COURSE_INSTRUMENTS.filter((name) => !['Theoretical', 'Demonstrative', 'Practical'].includes(name))
  const names = [...physical, ...(data ?? []).map((row) => row.name.trim())]
  return [...new Set(names.filter(Boolean)), 'Theoretical', 'Demonstrative', 'Practical']
}
