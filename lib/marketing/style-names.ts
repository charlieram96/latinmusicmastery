// Server-only: uses next/headers through the Supabase server client.
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * slug → English `musical_styles.name`. Sleeve covers are seeded with the
 * English style name so a course's cover is identical on every page and in
 * both languages (the catalog's style names are localized).
 */
export const getEnglishStyleNames = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('musical_styles').select('slug, name')
  if (error) throw error
  return Object.fromEntries((data ?? []).map(s => [s.slug, s.name]))
})
