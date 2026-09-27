// Server-only: uses next/headers through the Supabase server client.
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { buildCatalog, type Catalog } from './catalog'

type Named = { name: string; name_es: string | null }
const loc = (locale: Locale, r: Named): string => (locale === "es" && r.name_es) || r.name

/**
 * Everything the marketing pages list or count, localized for `locale`.
 * One query per table, memoised per request.
 */
export const getMarketingCatalog = cache(async (locale: Locale): Promise<Catalog> => {
  const supabase = await createClient()
  const [countries, styles, courses, teachers, instruments] = await Promise.all([
    supabase.from('countries').select('id, name, name_es, slug').order('name'),
    supabase.from('musical_styles').select('id, name, name_es, slug, country_id').order('name'),
    supabase.from('courses').select('id, title, title_es, instrument, musical_style_id, is_fundamentals, is_published, teacher_id, order_index').order('order_index'),
    supabase.from('teachers').select('id, name, instrument, instrument_es, image_url, specialties').order('name'),
    supabase.from('instruments').select('id', { count: 'exact', head: true }),
  ])
  for (const r of [countries, styles, courses, teachers]) if (r.error) throw r.error

  return buildCatalog({
    countries: (countries.data ?? []).map(c => ({ id: c.id, slug: c.slug, name: loc(locale, c) })),
    styles: (styles.data ?? []).map(s => ({ id: s.id, slug: s.slug, country_id: s.country_id, name: loc(locale, s) })),
    courses: (courses.data ?? []).map(c => ({
      id: c.id,
      title: (locale === 'es' && c.title_es) || c.title,
      instrument: c.instrument,
      musical_style_id: c.musical_style_id,
      is_fundamentals: c.is_fundamentals,
      is_published: c.is_published,
      teacher_id: c.teacher_id,
    })),
    teachers: (teachers.data ?? []).map(t => ({
      id: t.id,
      name: t.name,
      instrument: t.instrument,
      instrument_display: locale === 'es' ? (t.instrument_es || (t.instrument ? instrumentLabel(t.instrument, locale) : null)) : t.instrument,
      image_url: t.image_url,
      specialties: t.specialties,
    })),
    instrumentCount: instruments.count ?? 0,
  })
})
