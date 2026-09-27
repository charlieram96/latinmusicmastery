import type { CatalogCourse } from './catalog'

/** Explore page filter state. `'all'` means no filter on that axis. */
export type ExploreFilter = { instrument: string; country: string; q: string }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Filter the catalog for the explore grid. The query is matched without case
 * or accents against the style, the instrument (raw key and its display
 * label) and the course title.
 */
export function filterCourses(courses: CatalogCourse[], f: ExploreFilter, label: (instrumentKey: string) => string): CatalogCourse[] {
  const q = fold(f.q)
  return courses.filter(c =>
    (f.instrument === 'all' || c.instrument === f.instrument) &&
    (f.country === 'all' || c.countrySlug === f.country) &&
    (!q || fold(`${c.styleName ?? ''} ${label(c.instrument)} ${c.instrument} ${c.title}`).includes(q)),
  )
}

/** Resolve `?instrument=` to a catalog key (exact, then case-insensitive), else `'all'`. */
export function initialInstrument(param: string | undefined, keys: string[]): string {
  if (!param) return 'all'
  if (keys.includes(param)) return param
  const lower = param.trim().toLowerCase()
  return keys.find(k => k.toLowerCase() === lower) ?? 'all'
}

/** Order courses by style (in the given slug order, unknown styles last), then by stage-plot instrument order. */
export function sortCourses(courses: CatalogCourse[], styleOrder: string[], instrumentOrder: string[]): CatalogCourse[] {
  const rank = (list: string[], v: string | null) => { const i = v === null ? -1 : list.indexOf(v); return i < 0 ? list.length : i }
  return [...courses].sort((a, b) =>
    rank(styleOrder, a.styleSlug) - rank(styleOrder, b.styleSlug) ||
    rank(instrumentOrder, a.instrument) - rank(instrumentOrder, b.instrument) ||
    a.instrument.localeCompare(b.instrument))
}
