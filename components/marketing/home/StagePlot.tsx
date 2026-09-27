'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { APRON_PATH, PAD, SEATS, SEAT_GLYPHS, VIEWBOX } from '@/lib/marketing/stage-plot'

export type PlotSeat = {
  key: string
  label: string
  soon: boolean
  hasFundamentals: boolean
  total: number
  styles: { id: string; name: string }[]
  teachers: { id: string; name: string; instrument: string; imageUrl: string | null }[]
}

/**
 * The orquesta stage plot: pick a seat to see that instrument's courses and
 * who teaches it. Nothing here moves on its own.
 */
export function StagePlot({ seats, defaultKey }: { seats: Record<string, PlotSeat>; defaultKey: string }) {
  const { t, locale } = useTranslation()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.home.stage.${s}`, p)
  const [sel, setSel] = useState(defaultKey)
  const seat = seats[sel]
  const def = SEATS.find(s => s.key === sel)
  const lang = locale === 'es' ? 'es' : 'en'

  const onKey = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(key) }
  }

  return (
    <div className="stage-grid">
      <div className="plot">
        <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} role="group" aria-label={k('plotLabel')}>
          <defs>
            <linearGradient id="apron" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(246,235,221,.05)" /><stop offset="1" stopColor="rgba(246,235,221,0)" />
            </linearGradient>
          </defs>
          <path d={APRON_PATH} fill="url(#apron)" stroke="rgba(246,235,221,.18)" strokeDasharray="6 6" />
          <rect x="206" y="66" width="650" height="160" rx="10" fill="rgba(246,235,221,.025)" stroke="rgba(246,235,221,.12)" />
          <text x="842" y="86" textAnchor="end" fill="rgba(246,235,221,.35)" style={{ font: "500 10px 'DM Mono',monospace", letterSpacing: '.14em' }}>{k('riser')}</text>
          <text x="450" y="604" textAnchor="middle" fill="rgba(246,235,221,.35)" style={{ font: "500 11px 'DM Mono',monospace", letterSpacing: '.3em' }}>{k('audience')}</text>
          {SEATS.map(s => {
            const info = seats[s.key]
            return (
              <g key={s.key} className={`seat${info?.soon ? ' soon' : ''}${s.key === sel ? ' sel' : ''}`} transform={`translate(${s.x} ${s.y})`}
                tabIndex={0} role="button" aria-pressed={s.key === sel}
                onClick={() => setSel(s.key)} onKeyDown={e => onKey(e, s.key)}>
                <rect className="pad" x={-PAD.w / 2} y={-PAD.h / 2} width={PAD.w} height={PAD.h} rx="18" />
                <g dangerouslySetInnerHTML={{ __html: SEAT_GLYPHS[s.glyph] }} />
                <text y="72" textAnchor="middle">{s.name[lang]}</text>
                <text y="86" textAnchor="middle" className="ch">{s.ch}{info?.soon ? ` · ${k('soonTag')}` : ''}</text>
              </g>
            )
          })}
        </svg>
        <div className="plot-meta" aria-hidden="true"><b>{k('metaTitle')}</b><br />{k('metaLine', { n: SEATS.length })}<br />Rev 26.09.26</div>
      </div>
      {seat && (
        <aside className="seat-panel">
          <p className="sr-only" aria-live="polite">{seat.soon ? `${seat.label}: ${k('inProduction')}` : `${seat.label}: ${seat.total} ${seat.total === 1 ? k('courseOne') : k('courses')}`}</p>
          <div className="sp-top">
            <div><div className="sp-name">{seat.label}</div>{def && <p className="sp-note">{def.note[lang]}</p>}</div>
            <div className="sp-count"><b className="tnum">{seat.soon ? '—' : seat.total}</b><span>{seat.soon ? k('comingSoon') : seat.total === 1 ? k('courseOne') : k('courses')}</span></div>
          </div>
          <div>
            <p className="sp-label" style={{ marginBottom: 10 }}>{k('coursesLabel')}</p>
            <div className="chips" key={sel}>
              {seat.soon
                ? <span className="chip soon">{k('inProduction')}</span>
                : <>
                    {seat.hasFundamentals && <span className="chip base">{k('fundamentals')}</span>}
                    {seat.styles.map((c, i) => <span key={c.id} className="chip" style={{ animationDelay: `${(i + 1) * 28}ms` }}>{c.name}</span>)}
                  </>}
            </div>
          </div>
          <div>
            <p className="sp-label" style={{ marginBottom: 10 }}>{k('taughtBy')}</p>
            {seat.teachers.length
              ? <div className="teachers" key={sel}>
                  {seat.teachers.map((tc, i) => (
                    <Link key={tc.id} href={`/instructors/${tc.id}`} className="tch" style={{ animationDelay: `${i * 50}ms` }}>
                      {tc.imageUrl ? <Image src={tc.imageUrl} alt="" width={44} height={44} /> : <span className="ph" />}
                      <div><b>{tc.name}</b><span>{tc.instrument}</span></div>
                    </Link>
                  ))}
                </div>
              : <p style={{ color: 'var(--humo-2)', fontSize: 14 }}>{k('tba')}</p>}
          </div>
          <div className="sp-cta">
            {seat.soon
              ? <a className="btn btn-ghost" href="#join">{k('notify')}</a>
              : <>
                  <Link className="btn btn-hot" href={`/explore?instrument=${encodeURIComponent(seat.key)}`}>{k('browse', { instrument: seat.label })}</Link>
                  {seat.hasFundamentals && <small>{k('fundamentalsIncluded')}</small>}
                </>}
          </div>
        </aside>
      )}
    </div>
  )
}
