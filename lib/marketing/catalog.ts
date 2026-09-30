/**
 * Pure view-model builder for the marketing site. Every count and list the
 * public pages show comes from here, computed from the live tables, so the
 * site can never drift from the catalog.
 */

export interface CatalogInput {
  countries: { id: string; name: string; slug: string }[]
  styles: { id: string; name: string; slug: string; country_id: string | null }[]
  courses: {
    id: string
    title: string
    instrument: string | null
    musical_style_id: string | null
    is_fundamentals: boolean | null
    is_published: boolean | null
    teacher_id: string | null
  }[]
  teachers: {
    id: string
    name: string
    /** English free text; drives instrument matching. */
    instrument: string | null
    /** Localized label for display (defaults to `instrument`). */
    instrument_display?: string | null
    image_url: string | null
    specialties: string[] | null
  }[]
  /** Rows in the `instruments` table (the catalog of instruments we teach or will teach). */
  instrumentCount: number
}

export interface CatalogCourse {
  id: string
  title: string
  instrument: string
  styleSlug: string | null
  styleName: string | null
  countrySlug: string | null
  countryCode: string | null
  fundamentals: boolean
  teacherId: string | null
}

export interface CatalogInstrument {
  key: string
  fundamentals: CatalogCourse | null
  /** Style courses (fundamentals excluded). */
  courses: CatalogCourse[]
  total: number
  teacherIds: string[]
}

export interface CatalogStyle { slug: string; name: string; live: boolean; courseCount: number }

export interface CatalogCountry {
  slug: string
  name: string
  code: string
  geo: string
  color: string
  styles: CatalogStyle[]
}

export interface CatalogTeacher {
  id: string
  name: string
  instrument: string
  imageUrl: string | null
  specialties: string[]
  seatKeys: string[]
}

export interface Catalog {
  courses: CatalogCourse[]
  instruments: CatalogInstrument[]
  countries: CatalogCountry[]
  teachers: CatalogTeacher[]
  counts: { courses: number; maestros: number; instruments: number; styles: number; countries: number }
}

export const COUNTRY_META: Record<string, { code: string; geo: string; color: string }> = {
  cuba: { code: 'CU', geo: 'La Habana · 23.11°N 82.37°W', color: '#FFA524' },
  'puerto-rico': { code: 'PR', geo: 'San Juan · 18.47°N 66.11°W', color: '#FF324D' },
  'republica-dominicana': { code: 'DO', geo: 'Santo Domingo · 18.49°N 69.93°W', color: '#A58BFF' },
  colombia: { code: 'CO', geo: 'Barranquilla · 10.97°N 74.80°W', color: '#2FD1B5' },
}

/** Display order for instruments (stage-plot order, back row first). */
export const INSTRUMENT_ORDER = ['Timbal', 'Conga', 'Minor Percussion', 'Drums', 'Piano', 'Bass', 'Tres', 'Guitar', 'Violin', 'Saxophone', 'Trumpet', 'Voice']

const NOT_AN_INSTRUMENT = new Set(['various'])

const SEAT_KEYWORDS: [RegExp, string][] = [
  [/timbal/, 'Timbal'],
  [/conga/, 'Conga'],
  [/minor perc|percussion/, 'Minor Percussion'],
  [/drum/, 'Drums'],
  [/piano|acorde[oó]n|accordion/, 'Piano'],
  [/\bbass\b|\bbajo\b/, 'Bass'],
  [/\btres\b/, 'Tres'],
  [/guitar/, 'Guitar'],
  [/viol[ií]n/, 'Violin'],
  [/trumpet|trompeta/, 'Trumpet'],
  [/\bsax/, 'Saxophone'],
  [/vocal|voice|singer|\bvoz\b/, 'Voice'],
]

/** Map a free-text `teachers.instrument` value to course instrument keys, in the order they appear. */
export function teacherSeatKeys(text: string | null | undefined): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const hits: { at: number; key: string }[] = []
  for (const [re, key] of SEAT_KEYWORDS) {
    const m = lower.match(re)
    if (m && m.index !== undefined && !hits.some(h => h.key === key)) hits.push({ at: m.index, key })
  }
  return hits.sort((a, b) => a.at - b.at).map(h => h.key)
}

export function buildCatalog(input: CatalogInput): Catalog {
  const countryById = new Map(input.countries.map(c => [c.id, c]))
  const styleById = new Map(input.styles.map(s => [s.id, s]))

  const courses: CatalogCourse[] = input.courses
    .filter(c => c.is_published && c.instrument && !NOT_AN_INSTRUMENT.has(c.instrument.toLowerCase()))
    .map(c => {
      const style = c.musical_style_id ? styleById.get(c.musical_style_id) : undefined
      const country = style?.country_id ? countryById.get(style.country_id) : undefined
      return {
        id: c.id,
        title: c.title,
        instrument: c.instrument as string,
        styleSlug: style?.slug ?? null,
        styleName: style?.name ?? null,
        countrySlug: country?.slug ?? null,
        countryCode: country ? COUNTRY_META[country.slug]?.code ?? null : null,
        fundamentals: !!c.is_fundamentals,
        teacherId: c.teacher_id,
      }
    })

  const teachers: CatalogTeacher[] = input.teachers.map(t => ({
    id: t.id,
    name: t.name,
    instrument: t.instrument_display ?? t.instrument ?? '',
    imageUrl: t.image_url,
    specialties: t.specialties ?? [],
    seatKeys: teacherSeatKeys(t.instrument),
  }))

  const byInstrument = new Map<string, CatalogCourse[]>()
  for (const c of courses) {
    const list = byInstrument.get(c.instrument) ?? []
    list.push(c)
    byInstrument.set(c.instrument, list)
  }
  const rank = (k: string) => { const i = INSTRUMENT_ORDER.indexOf(k); return i < 0 ? 99 : i }
  const instruments: CatalogInstrument[] = [...byInstrument.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      fundamentals: list.find(c => c.fundamentals) ?? null,
      courses: list.filter(c => !c.fundamentals),
      total: list.length,
      teacherIds: teachers.filter(t => t.seatKeys.includes(key)).map(t => t.id),
    }))

  const countries: CatalogCountry[] = input.countries.map(country => {
    const meta = COUNTRY_META[country.slug] ?? { code: country.slug.slice(0, 2).toUpperCase(), geo: '', color: '#FFA524' }
    const styles: CatalogStyle[] = input.styles
      .filter(s => s.country_id === country.id)
      .map(s => {
        const courseCount = courses.filter(c => c.styleSlug === s.slug).length
        return { slug: s.slug, name: s.name, live: courseCount > 0, courseCount }
      })
      .sort((a, b) => Number(b.live) - Number(a.live) || b.courseCount - a.courseCount || a.name.localeCompare(b.name))
    return { slug: country.slug, name: country.name, code: meta.code, geo: meta.geo, color: meta.color, styles }
  })

  return {
    courses,
    instruments,
    countries,
    teachers,
    counts: {
      courses: courses.length,
      maestros: teachers.length,
      instruments: input.instrumentCount,
      styles: input.styles.filter(s => s.country_id && countryById.has(s.country_id)).length,
      countries: input.countries.length,
    },
  }
}
