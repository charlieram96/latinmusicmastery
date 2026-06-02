'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Check, X, BookOpen, Globe } from 'lucide-react'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'
import { coverStyle, glyph, levelColor } from '@/lib/course-covers'
import { useTranslation } from '@/components/language-provider'
import './browse-courses.css'

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const

interface CoursesViewProps {
  courses: any[]
}

export function CoursesView({ courses }: CoursesViewProps) {
  const { t } = useTranslation()

  const [q, setQ] = useState('')
  const [instruments, setInstruments] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [genres, setGenres] = useState<string[]>([])

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const lessonsOf = (c: any) =>
    c.course_sections?.reduce((acc: number, s: any) => acc + (s.classes?.length || 0), 0) || 0

  const difficultyLabel = (d: string | null) => {
    if (d === 'beginner') return t('dashboard.pages.courses.difficulty.beginner')
    if (d === 'intermediate') return t('dashboard.pages.courses.difficulty.intermediate')
    if (d === 'advanced') return t('dashboard.pages.courses.difficulty.advanced')
    return d || ''
  }

  // Derived facets
  const countBy = (inst: string) => courses.filter((c) => c.instrument === inst).length
  const instrumentFacets = SUBSCRIBABLE_INSTRUMENTS
    .map((inst) => ({ inst, count: countBy(inst) }))
    .filter((x) => x.count > 0)
  const genreList = Array.from(
    new Set(courses.map((c) => c.musical_style?.name).filter(Boolean) as string[])
  ).sort()

  // Live filter — union within a facet, intersection across facets
  const filtered = courses.filter((c) => {
    if (instruments.length && !instruments.includes(c.instrument)) return false
    if (levels.length && !levels.includes(c.difficulty)) return false
    const g = c.musical_style?.name
    if (genres.length && !genres.includes(g)) return false
    if (q) {
      const hay = `${c.title} ${g || ''} ${c.instrument || ''} ${c.teacher?.name || ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  const activeChips = [
    ...instruments.map((v) => ({ key: 'i' + v, label: v, remove: () => toggle(instruments, setInstruments, v) })),
    ...genres.map((v) => ({ key: 'g' + v, label: v, remove: () => toggle(genres, setGenres, v) })),
    ...levels.map((v) => ({ key: 'l' + v, label: difficultyLabel(v), remove: () => toggle(levels, setLevels, v) })),
  ]
  const clearAll = () => {
    setInstruments([])
    setLevels([])
    setGenres([])
    setQ('')
  }

  const n = filtered.length
  const countNoun = n === 1 ? t('dashboard.pages.courses.resultCourse') : t('dashboard.pages.courses.resultCourses')

  return (
    <div className="bc-browse">
      <div className="bc-pagehead">
        <span className="eyebrow">{t('dashboard.pages.courses.eyebrow')}</span>
        <h1 className="bc-title">{t('dashboard.pages.courses.title')}</h1>
        <p className="bc-sub">
          {t('dashboard.pages.courses.subtitleBrowse', { count: courses.length })}
        </p>
      </div>

      <div className="a-wrap">
        {/* ---- Filter rail ---- */}
        <aside className="a-rail">
          <div className="a-search">
            <Search size={16} className="text-muted-foreground" />
            <input
              placeholder={t('dashboard.pages.courses.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {instrumentFacets.length > 0 && (
            <div className="a-facet">
              <h4>{t('dashboard.pages.courses.facets.instrument')}</h4>
              <div className="a-facetlist">
                {instrumentFacets.map(({ inst, count }) => {
                  const on = instruments.includes(inst)
                  return (
                    <button
                      key={inst}
                      className={'a-frow' + (on ? ' active' : '')}
                      onClick={() => toggle(instruments, setInstruments, inst)}
                    >
                      <span className="ck">{on && <Check size={12} strokeWidth={3} />}</span>
                      {inst}
                      <span className="cnt">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="a-facet">
            <h4>{t('dashboard.pages.courses.facets.level')}</h4>
            <div className="a-pillrow">
              {LEVELS.map((lv) => {
                const on = levels.includes(lv)
                return (
                  <button
                    key={lv}
                    className={'a-pill' + (on ? ' active' : '')}
                    onClick={() => toggle(levels, setLevels, lv)}
                  >
                    <span className="bc-level">
                      <span className="dot" style={{ background: `hsl(${levelColor(lv)})` }} />
                      {difficultyLabel(lv)}
                    </span>
                    {on && <Check size={14} className="text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>

          {genreList.length > 0 && (
            <div className="a-facet">
              <h4>{t('dashboard.pages.courses.facets.genre')}</h4>
              <div className="a-facetlist">
                {genreList.map((g) => {
                  const on = genres.includes(g)
                  return (
                    <button
                      key={g}
                      className={'a-frow' + (on ? ' active' : '')}
                      onClick={() => toggle(genres, setGenres, g)}
                    >
                      <span className="ck">{on && <Check size={12} strokeWidth={3} />}</span>
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ---- Results ---- */}
        <div>
          <div className="a-rhead">
            <div className="a-count">
              <b>{n}</b> {countNoun}
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="a-activechips">
              {activeChips.map((ch) => (
                <span className="a-chip" key={ch.key}>
                  {ch.label}
                  <button onClick={ch.remove} aria-label={`Remove ${ch.label}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
              <button className="a-clear" onClick={clearAll}>
                {t('dashboard.pages.courses.clearAll')}
              </button>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="a-grid">
              {filtered.map((c) => (
                <CourseCard key={c.id} course={c} lessons={lessonsOf(c)} difficultyLabel={difficultyLabel} t={t} />
              ))}
            </div>
          ) : (
            <div className="a-empty">
              <BookOpen size={40} className="mx-auto mb-4 text-muted-foreground" />
              <h3>{t('dashboard.pages.courses.empty.title')}</h3>
              <p>{t('dashboard.pages.courses.empty.subtitle')}</p>
              <button onClick={clearAll}>{t('dashboard.pages.courses.empty.clearFilters')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function initialsOf(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function CourseCard({
  course: c,
  lessons,
  difficultyLabel,
  t,
}: {
  course: any
  lessons: number
  difficultyLabel: (d: string | null) => string
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const hasPhoto = !!c.thumbnail_url
  const genre = c.musical_style?.name
  const country = c.musical_style?.country?.name
  const teacherName = c.teacher?.name || t('dashboard.pages.courses.instructor')
  const teacherRole = c.teacher?.instrument || c.instrument

  return (
    <Link href={`/dashboard/course/${c.slug || c.id}`} className="a-card">
      <div className="bc-cover a-cov">
        {hasPhoto ? (
          <img className="photo" src={c.thumbnail_url} alt={c.title} />
        ) : (
          <>
            <div className="grad" style={{ background: coverStyle(genre) }} />
            <svg
              className="glyph"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: glyph(c.instrument) }}
            />
            <div className="noise" />
          </>
        )}
        <div className="scrim" />
        <div className="cov-content">
          <div className="toprow">
            <span className="genre-lab">{genre || t('dashboard.pages.courses.badges.courseFallback')}</span>
            {c.difficulty && (
              <span className="lvl-chip">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 9999,
                    background: `hsl(${levelColor(c.difficulty)})`,
                    display: 'inline-block',
                  }}
                />
                {difficultyLabel(c.difficulty)}
              </span>
            )}
          </div>
          {c.instrument && <span className="instr-lab">{c.instrument}</span>}
        </div>
      </div>

      <div className="a-body">
        <h3 className="a-ctitle">{c.title}</h3>
        <p className="a-blurb">
          {c.description ||
            t('dashboard.pages.courses.descriptionFallback', {
              style: genre || t('dashboard.pages.courses.latinMusic'),
            })}
        </p>
        <div className="a-meta">
          <span className="mi">
            <BookOpen size={14} />
            {t('dashboard.pages.courses.lessonCount', { count: lessons })}
          </span>
          {country && (
            <span className="mi">
              <Globe size={14} />
              {country}
            </span>
          )}
        </div>
        <div className="a-foot">
          <span className="bc-avatar">
            {c.teacher?.image_url ? (
              <img src={c.teacher.image_url} alt={teacherName} />
            ) : (
              <span>{initialsOf(c.teacher?.name)}</span>
            )}
          </span>
          <span className="who">
            <div className="n">{teacherName}</div>
            {teacherRole && <div className="r">{teacherRole}</div>}
          </span>
        </div>
      </div>
    </Link>
  )
}
