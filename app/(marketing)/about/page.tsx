import type { Metadata } from 'next'
import { getServerTranslator } from '@/lib/i18n/server'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { AboutVideo } from '@/components/marketing/pages/AboutVideo'
import '../styles/pages.css'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.about.metaTitle'), description: t('marketing.site.about.metaDescription') }
}

const A = 'marketing.site.about'

export default async function AboutPage() {
  const { t, locale } = await getServerTranslator()
  const { counts } = await getMarketingCatalog(locale)

  const values = [
    { key: 'authentic', color: '#FFA524' },
    { key: 'structured', color: '#FF324D' },
    { key: 'rooted', color: '#2FD1B5' },
  ]
  const numbers = [
    { n: counts.courses, label: t(`${A}.numCourses`) },
    { n: counts.maestros, label: t(`${A}.numMaestros`) },
    { n: counts.instruments, label: t(`${A}.numInstruments`) },
    { n: counts.styles, label: t(`${A}.numStyles`) },
    { n: counts.countries, label: t(`${A}.numCountries`) },
  ]

  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: t(`${A}.crumb`) }]}
        title={<>{t(`${A}.title`)} <Accent>{t(`${A}.titleAccent`)}</Accent></>}
        lede={t(`${A}.lede`)}
      />

      <section className="sec">
        <div className="wrap about-split">
          <AboutVideo />
          <Reveal>
            <p className="eyebrow" style={{ marginBottom: 22 }}>{t(`${A}.eyebrow`)}</p>
            <p className="manifesto">{t(`${A}.manifesto`)} <Accent>{t(`${A}.manifestoAccent`)}</Accent></p>
            <div className="prose" style={{ marginTop: 28 }}>
              <p>{t(`${A}.p1`)}</p>
              <p>{t(`${A}.p2`)}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }} aria-label={t(`${A}.valuesLabel`)}>
        <div className="wrap">
          <Reveal className="values">
            {values.map(v => (
              <div key={v.key} style={{ ['--c' as string]: v.color }}>
                <h3>{t(`${A}.${v.key}Title`)}</h3>
                <p>{t(`${A}.${v.key}Body`)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <div className="wrap">
        <div className="numbers" style={{ borderTop: '1px solid var(--line)' }} role="group" aria-label={t(`${A}.numbersLabel`)}>
          {numbers.map(x => (
            <div className="num" key={x.label}><b>{x.n}</b><span>{x.label}</span></div>
          ))}
        </div>
      </div>

      <Finale title={t(`${A}.finaleTitle`)} accent={t(`${A}.finaleAccent`)} lede={t(`${A}.finaleLede`)} />
    </>
  )
}
