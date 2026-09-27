'use client'

import { useState } from 'react'

export type CurriculumSection = { id: string; title: string; lessons: { id: string; title: string; free: boolean }[] }

const Chev = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

/** Numbered sections that open to their lessons; empty sections read "In production". The first opens by default. */
export function Curriculum({ sections, labels }: {
  sections: CurriculumSection[]
  labels: { lessons: string; lessonsOne: string; inProduction: string; inProductionBody: string; freePreview: string; plan: string }
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(sections[0] ? [sections[0].id] : []))
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return (
    <div className="curric">
      {sections.map((s, i) => {
        const isOpen = open.has(s.id)
        const n = s.lessons.length
        return (
          <div key={s.id} className={`sec-item${isOpen ? ' open' : ''}`}>
            <button type="button" aria-expanded={isOpen} aria-controls={`sec-${s.id}`} onClick={() => toggle(s.id)}>
              <span className="no tnum">{String(i + 1).padStart(2, '0')}</span>
              <span className="tt">{s.title}</span>
              <span className="ct">{n ? (n === 1 ? labels.lessonsOne : labels.lessons).replace('{n}', String(n)) : labels.inProduction}</span>
              <span className="chev"><Chev /></span>
            </button>
            <div className="sec-list" id={`sec-${s.id}`} inert={!isOpen}>
              <div>
                {n ? (
                  <ol>{s.lessons.map(l => <li key={l.id}><span>{l.title}</span><span className={l.free ? 'lock free' : 'lock'}>{l.free ? labels.freePreview : labels.plan}</span></li>)}</ol>
                ) : <p className="inprod">{labels.inProductionBody}</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
