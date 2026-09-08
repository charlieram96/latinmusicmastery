'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, LayoutGrid, List, Search, SearchX, X } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { CoursePoster, InstrumentGlyph, LevelDot, type PosterCourse } from '@/components/dashboard/course-poster'
import { CourseThumb } from '@/components/dashboard/home/course-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/components/language-provider'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { cn } from '@/lib/utils'

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
type Level = (typeof LEVELS)[number]
type Sort = 'newest' | 'title' | 'lessons'
const ANY = 'any'

export interface BrowseCourse extends PosterCourse {
  description: string | null
  createdAt: string | null
}

interface CoursesViewProps {
  courses: BrowseCourse[]
}

export function CoursesView({ courses }: CoursesViewProps) {
  const { t, locale } = useTranslation()
  const params = useSearchParams()
  const base = 'dashboard.pages.courses'

  const [q, setQ] = useState('')
  const [instrument, setInstrument] = useState<string | null>(() => {
    const initial = params.get('instrument')
    return initial && courses.some((c) => c.instrument === initial) ? initial : null
  })
  const [level, setLevel] = useState<Level | null>(null)
  const [style, setStyle] = useState<string>(ANY)
  const [teacher, setTeacher] = useState<string>(ANY)
  const [country, setCountry] = useState<string>(ANY)
  const [sort, setSort] = useState<Sort>('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // ── Facets ──────────────────────────────────────────────────────
  const instruments = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) if (c.instrument) counts.set(c.instrument, (counts.get(c.instrument) ?? 0) + 1)
    const order = [...SUBSCRIBABLE_INSTRUMENTS] as string[]
    return [...counts.entries()]
      .sort((a, b) => {
        const ia = order.indexOf(a[0]), ib = order.indexOf(b[0])
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        return b[1] - a[1]
      })
      .map(([name, count]) => ({ name, count }))
  }, [courses])
  // The compiler memoizes these; `courses` only changes on navigation.
  const unique = (pick: (c: BrowseCourse) => string | null) =>
    [...new Set(courses.map(pick).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))
  const styles = unique((c) => c.styleName)
  const teachers = unique((c) => c.teacherName)
  const countries = unique((c) => c.countryName)

  // ── Filter and sort ──────────────────────────────────────────────
  const filtered = courses
    .filter((c) => {
      if (instrument && c.instrument !== instrument) return false
      if (level && c.difficulty !== level) return false
      if (style !== ANY && c.styleName !== style) return false
      if (teacher !== ANY && c.teacherName !== teacher) return false
      if (country !== ANY && c.countryName !== country) return false
      if (q) {
        const hay = [c.title, c.styleName, c.instrument, instrumentLabel(c.instrument, locale), c.teacherName, c.countryName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    .sort((a, b) => {
      // Courses that already have lessons come before empty placeholders in every order.
      const ready = Number(b.lessons > 0) - Number(a.lessons > 0)
      if (ready !== 0) return ready
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'lessons') return b.lessons - a.lessons || a.title.localeCompare(b.title)
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })

  const levelLabel = (lv: Level) => t(`${base}.difficulty.${lv}`)
  const chips = [
    instrument ? { key: 'i', label: instrumentLabel(instrument, locale), remove: () => setInstrument(null) } : null,
    level ? { key: 'l', label: levelLabel(level), remove: () => setLevel(null) } : null,
    style !== ANY ? { key: 's', label: style, remove: () => setStyle(ANY) } : null,
    teacher !== ANY ? { key: 't', label: teacher, remove: () => setTeacher(ANY) } : null,
    country !== ANY ? { key: 'c', label: country, remove: () => setCountry(ANY) } : null,
    q ? { key: 'q', label: `“${q}”`, remove: () => setQ('') } : null,
  ].filter((c): c is { key: string; label: string; remove: () => void } => c !== null)
  const clearAll = () => {
    setInstrument(null)
    setLevel(null)
    setStyle(ANY)
    setTeacher(ANY)
    setCountry(ANY)
    setQ('')
  }

  const n = filtered.length
  const countText = `${n} ${n === 1 ? t(`${base}.resultCourse`) : t(`${base}.resultCourses`)}`

  return (
    <>
      <PageHeader
        crumb={t(`${base}.eyebrow`)}
        title={t(`${base}.title`)}
        description={t(`${base}.subtitleBrowse`, { count: courses.length })}
        actions={
          <label className="relative block w-72 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(`${base}.searchPlaceholder`)}
              aria-label={t(`${base}.searchPlaceholder`)}
              className="h-10 pl-9"
            />
          </label>
        }
        className="mb-6"
      >
        {/* Instrument strip: the first choice a learner makes, so it is the hero. */}
        <div role="group" aria-label={t(`${base}.facets.instrument`)} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {instruments.map(({ name, count }) => {
            const on = instrument === name
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => setInstrument(on ? null : name)}
                className={cn(
                  'relative isolate flex flex-col gap-2 overflow-hidden rounded-xl border p-3.5 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  on ? 'border-primary/50 bg-primary/[0.08]' : 'border-border bg-card hover:border-foreground/15'
                )}
              >
                <InstrumentGlyph instrument={name} className="h-[26px] w-[26px] text-primary" />
                <span className="font-heading text-sm font-bold">{instrumentLabel(name, locale)}</span>
                <span className="-mt-1.5 text-xs text-muted-foreground">
                  {t(count === 1 ? `${base}.courseCountOne` : `${base}.courseCount`, { count })}
                </span>
                <InstrumentGlyph
                  instrument={name}
                  className={cn('absolute -bottom-5 -right-4 -z-10 h-20 w-20 rotate-[-10deg]', on ? 'text-primary opacity-[0.14]' : 'text-foreground opacity-[0.05]')}
                />
              </button>
            )
          })}
        </div>
      </PageHeader>

      {/* Toolbar: level, style, teacher, country; count, sort and view on the right. */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label={t(`${base}.facets.level`)} className="inline-flex rounded-lg bg-secondary p-1">
          {([null, ...LEVELS] as (Level | null)[]).map((lv) => {
            const on = level === lv
            return (
              <button
                key={lv ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setLevel(lv)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  on ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {lv ? <LevelDot difficulty={lv} /> : null}
                {lv ? levelLabel(lv) : t(`${base}.allLevels`)}
              </button>
            )
          })}
        </div>
        <FacetSelect value={style} onChange={setStyle} options={styles} label={t(`${base}.facets.genre`)} any={t(`${base}.any`)} />
        <FacetSelect value={teacher} onChange={setTeacher} options={teachers} label={t(`${base}.facets.teacher`)} any={t(`${base}.any`)} />
        <FacetSelect value={country} onChange={setCountry} options={countries} label={t(`${base}.facets.country`)} any={t(`${base}.any`)} />
        <span className="flex-1" />
        <span className="text-sm text-muted-foreground">
          <b className="font-semibold text-foreground">{n}</b> {n === 1 ? t(`${base}.resultCourse`) : t(`${base}.resultCourses`)}
        </span>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-9 w-[170px]" aria-label={t(`${base}.sort.label`)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="newest">{t(`${base}.sort.newest`)}</SelectItem>
            <SelectItem value="title">{t(`${base}.sort.title`)}</SelectItem>
            <SelectItem value="lessons">{t(`${base}.sort.lessons`)}</SelectItem>
          </SelectContent>
        </Select>
        <div role="group" aria-label={t(`${base}.view.label`)} className="inline-flex overflow-hidden rounded-lg border border-border">
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={t(`${base}.view.${v}`)}
              onClick={() => setView(v)}
              className={cn('grid h-9 w-9 place-items-center transition-colors', view === v ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {v === 'grid' ? <LayoutGrid className="h-4 w-4" aria-hidden /> : <List className="h-4 w-4" aria-hidden />}
            </button>
          ))}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/[0.12] pl-3 pr-1.5 text-xs font-semibold text-primary">
              {chip.label}
              <button
                type="button"
                onClick={chip.remove}
                aria-label={t(`${base}.removeFilter`, { label: chip.label })}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/20"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearAll} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {t(`${base}.clearAll`)}
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t(`${base}.empty.title`)}
          body={t(`${base}.empty.subtitle`)}
          action={
            <Button variant="outline" onClick={clearAll}>
              {t(`${base}.empty.clearFilters`)}
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((c, i) => (
            <CoursePoster key={c.id} course={c} priority={i < 4} compact />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/course/${c.slug || c.id}`}
              className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-3.5 transition-colors hover:bg-accent/40 sm:gap-5"
            >
              <CourseThumb src={c.thumbnailUrl} styleName={c.styleName} alt="" className="h-[60px] w-24" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                  {[c.isFundamentals ? t(`${base}.fundamentals`) : c.styleName, c.instrument ? instrumentLabel(c.instrument, locale) : null, c.countryName].filter(Boolean).join(' · ')}
                </p>
                <h3 className="truncate font-heading text-base font-bold tracking-tight transition-colors group-hover:text-primary">{c.title}</h3>
                <p className="truncate text-sm text-muted-foreground">
                  {[c.teacherName, c.lessons > 0 ? t(`${base}.lessonCount`, { count: c.lessons }) : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                <LevelDot difficulty={c.difficulty} />
                {c.difficulty ? levelLabel(c.difficulty as Level) : t(`${base}.allLevels`)}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">{countText}</p>
    </>
  )
}

function FacetSelect({
  value,
  onChange,
  options,
  label,
  any,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label: string
  any: string
}) {
  if (options.length === 0) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
