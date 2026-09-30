'use client'

import { useMemo, useState } from 'react'
import { MaestroCard } from '@/components/marketing/site/MaestroCard'
import type { CatalogTeacher } from '@/lib/marketing/catalog'
import { FAMILIES, familyCounts, teacherFamilies, type FamilyKey } from '@/lib/marketing/teacher-families'

type Filter = FamilyKey | 'all'

/** Sticky family chips over the maestro grid. Filtering is client-side; families nobody plays are hidden. */
export function InstructorsGrid({ teachers, labels, groupLabel, empty, resultsTemplate }: {
  teachers: CatalogTeacher[]
  labels: Record<Filter, string>
  groupLabel: string
  empty: string
  /** e.g. `{count} maestros shown`, announced when the filter changes. */
  resultsTemplate: string
}) {
  const [cur, setCur] = useState<Filter>('all')
  const counts = useMemo(() => familyCounts(teachers), [teachers])
  const filters: Filter[] = ['all', ...FAMILIES.map(f => f.key).filter(k => counts[k] > 0)]
  const shown = cur === 'all' ? teachers : teachers.filter(t => teacherFamilies(t.seatKeys).includes(cur))

  return (
    <>
      <div className="toolbar">
        <div className="wrap filters" role="group" aria-label={groupLabel} style={{ width: '100%' }}>
          {filters.map(k => (
            <button key={k} type="button" className="fchip" aria-pressed={cur === k} onClick={() => setCur(k)}>
              {labels[k]} <small>{counts[k]}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{cur === 'all' ? '' : resultsTemplate.replace('{count}', String(shown.length))}</p>
      <div className="wrap">
        {shown.length > 0
          ? <div className="igrid">{shown.map(t => <MaestroCard key={t.id} teacher={t} href={`/instructors/${t.id}`} sizes="(max-width: 640px) 100vw, 320px" />)}</div>
          : <p className="lede" style={{ paddingTop: 32 }}>{empty}</p>}
      </div>
    </>
  )
}
