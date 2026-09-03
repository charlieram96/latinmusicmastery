import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { pick } from '@/lib/i18n/localize'
import { instrumentLabel } from '@/lib/i18n/instruments'

export type NavCatalogItem = { slug: string; name: string }

export interface NavCatalog {
  instruments: NavCatalogItem[]
  styles: NavCatalogItem[]
}

/**
 * Instruments + musical styles used to build the header "Explore" mega-menu.
 *
 * Styles come from the curated `musical_styles` table (clean slugs; courses join
 * via musical_style_id). Instruments come from the DISTINCT free-text
 * `courses.instrument` values, because that's what the /explore?instrument=
 * filter matches against — sourcing them anywhere else risks dead links.
 */
export async function getNavCatalog(): Promise<NavCatalog> {
  const supabase = await createClient()

  const locale = await getServerLocale()
  const [{ data: courseInstruments }, { data: styles }] = await Promise.all([
    supabase.from('courses').select('instrument').not('instrument', 'is', null),
    supabase.from('musical_styles').select('slug, name, name_es').order('name'),
  ])

  const instrumentNames = Array.from(
    new Set(
      (courseInstruments ?? [])
        .map((r) => (r.instrument ?? '').trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

  return {
    // `slug` stays the raw English value because /explore?instrument= matches it verbatim.
    instruments: instrumentNames.map((name) => ({ slug: name, name: instrumentLabel(name, locale) })),
    styles: (styles ?? []).map((s) => ({
      slug: s.slug,
      name: pick(locale, s.name, (s as { name_es?: string | null }).name_es ?? null) ?? s.name,
    })),
  }
}
