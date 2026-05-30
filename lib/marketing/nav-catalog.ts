import 'server-only'

import { createClient } from '@/lib/supabase/server'

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

  const [{ data: courseInstruments }, { data: styles }] = await Promise.all([
    supabase.from('courses').select('instrument').not('instrument', 'is', null),
    supabase.from('musical_styles').select('slug, name').order('name'),
  ])

  const instrumentNames = Array.from(
    new Set(
      (courseInstruments ?? [])
        .map((r) => (r.instrument ?? '').trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

  return {
    instruments: instrumentNames.map((name) => ({ slug: name, name })),
    styles: styles ?? [],
  }
}
