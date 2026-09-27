import type { Metadata } from 'next'
import '../styles/playsense.css'
import { getServerTranslator } from '@/lib/i18n/server'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { LiveStage } from '@/components/marketing/playsense/LiveStage'
import { StaffWorkspace } from '@/components/marketing/playsense/StaffWorkspace'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.playsense.metaTitle'), description: t('marketing.site.playsense.metaDescription') }
}

const FEATURE_ICONS = [
  <path key="a" d="M3 12h3l3-7 4 14 3-7h5" />,
  <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  <><circle cx="7" cy="17" r="3" /><circle cx="17" cy="15" r="3" /><path d="M10 17V5l10-2v12" /></>,
  <path key="d" d="M7 4v16M17 4v16M7 8h10M7 16h10" />,
  <path key="e" d="M4 7h16M4 12h16M4 17h16" />,
  <><path d="M6 3h9l4 4v14H6z" /><path d="M9 13h7M9 17h5" /></>,
]

export default async function PlaySensePage() {
  const { t } = await getServerTranslator()
  const k = (s: string) => t(`marketing.site.playsense.${s}`)
  return (
    <>
      <PageHead
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: k('crumb') }]}
        title={<>{k('title')}<Accent>{k('titleAccent')}</Accent></>}
        lede={k('lede')}
      />

      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <div className="wrap"><LiveStage /></div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><div><p className="eyebrow">{k('how.eyebrow')}</p><h2 className="h2" style={{ marginTop: 18 }}>{k('how.title')} <Accent>{k('how.titleAccent')}</Accent></h2></div></div>
          <Reveal className="steps3">
            {[1, 2, 3].map(n => <div key={n}><b>{n}</b><h3>{k(`how.s${n}Title`)}</h3><p>{k(`how.s${n}Body`)}</p></div>)}
          </Reveal>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <div><p className="eyebrow">{k('chart.eyebrow')}</p><h2 className="h2" style={{ marginTop: 18 }}>{k('chart.title')} <Accent>{k('chart.titleAccent')}</Accent></h2></div>
            <p className="lede">{k('chart.lede')}</p>
          </div>
          <StaffWorkspace />
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="fgrid">
            {FEATURE_ICONS.map((icon, i) => (
              <div key={i}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                <h3>{k(`features.f${i + 1}Title`)}</h3>
                <p>{k(`features.f${i + 1}Body`)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <Finale title={k('finale.title')} accent={k('finale.titleAccent')} lede={k('finale.lede')} />
    </>
  )
}
