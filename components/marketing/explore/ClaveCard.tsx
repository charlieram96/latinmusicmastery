import { BASS_HITS, BONGO_HITS, type ClaveKey } from '@/lib/marketing/style-clave'

type T = (key: string, params?: Record<string, string | number>) => string

const STEPS = Array.from({ length: 16 }, (_, s) => s)

/**
 * A still two-bar step grid of the style's clave (the home groove's markup,
 * without playback). Son adds the bongó bell and the bass tumbao; rumba shows
 * the clave alone.
 */
export function ClaveCard({ clave, hits, t }: { clave: ClaveKey; hits: number[]; t: T }) {
  const k = (key: string) => t(`marketing.site.style.clave.${key}`)
  const rows: [string, string, number[]][] = [[k('clave'), '#F6EBDD', hits]]
  if (clave === 'son32') rows.push([k('bongo'), '#FFC94D', BONGO_HITS], [k('bass'), '#2FD1B5', BASS_HITS])
  const describe = rows.map(([name, , on]) => `${name} ${on.map(s => `${(s % 8 >> 1) + 1}${s % 2 ? '&' : ''}`).join(' ')}`).join('; ')
  return (
    <div className="clave-card">
      <p className="sp-label" style={{ marginBottom: 14 }}>{k(clave)}</p>
      <div className="seq-rows" role="img" aria-label={t('marketing.site.style.clave.gridLabel', { rows: describe })}>
        {rows.map(([name, color, on]) => (
          <div key={name} className="seq-row" style={{ ['--c' as string]: color }}>
            <span className="seq-lbl"><b><i />{name}</b></span>
            <div className="cells">{STEPS.map(s => <span key={s} className={`cell${on.includes(s) ? ' on' : ''}`} />)}</div>
          </div>
        ))}
      </div>
      <div className="counts" style={{ marginTop: 8 }} aria-hidden="true">
        <span />
        <div>{STEPS.map(s => (s % 2 ? <span key={s}>&amp;</span> : <b key={s}>{(s % 8) / 2 + 1}</b>))}</div>
      </div>
      <p style={{ color: 'var(--humo)', fontSize: 14.5, marginTop: 16 }}>{k(clave === 'son32' ? 'noteSon' : 'noteRumba')}</p>
      <a className="btn btn-ghost btn-sm" href="/#groove" style={{ marginTop: 16 }}>{k('hear')}</a>
    </div>
  )
}
