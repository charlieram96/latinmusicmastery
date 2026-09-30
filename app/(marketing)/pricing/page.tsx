import type { Metadata } from 'next'
import '../styles/pricing.css'
import Link from 'next/link'
import { getServerTranslator } from '@/lib/i18n/server'
import { getPricing } from '@/lib/payments/pricing-source'
import { formatCents } from '@/lib/payments/pricing-types'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { yearlySavingPercent, type PriceCents } from '@/lib/marketing/pricing-calc'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { PricingCalculator, type CalcInstrument } from '@/components/marketing/site/PricingCalculator'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { PlanCards, CheckIcon } from '@/components/marketing/pricing/PlanCards'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.pricing.metaTitle'), description: t('marketing.site.pricing.metaDescription') }
}

export default async function PricingPage() {
  const { locale, t } = await getServerTranslator()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.pricing.${s}`, p)
  const [pricing, catalog] = await Promise.all([getPricing(), getMarketingCatalog(locale)])
  const prices: PriceCents = {
    base_monthly: pricing.base_monthly.amount_cents,
    base_annual: pricing.base_annual.amount_cents,
    addon_monthly: pricing.addon_monthly.amount_cents,
  }
  const base = formatCents(prices.base_monthly), annual = formatCents(prices.base_annual), addon = formatCents(prices.addon_monthly)
  const instruments: CalcInstrument[] = catalog.instruments
    .filter(i => i.courses.length > 0)
    .map(i => ({ key: i.key, label: instrumentLabel(i.key, locale), styleCourses: i.courses.length }))
  const defaultKey = [...instruments].sort((a, b) => b.styleCourses - a.styleCourses)[0]?.key

  const CHECK = Symbol('check')
  const rows: [string, string | typeof CHECK, string | typeof CHECK][] = [
    [k('compare.instruments'), k('compare.instrumentsOne'), k('compare.instrumentsAll', { n: instruments.length })],
    [k('compare.fundamentals'), CHECK, CHECK],
    [k('compare.styles'), k('compare.stylesPer', { addon }), k('compare.stylesAll')],
    [k('compare.playsense'), CHECK, CHECK],
    [k('compare.export'), CHECK, CHECK],
    [k('compare.progress'), CHECK, CHECK],
    [k('compare.content'), CHECK, CHECK],
    [k('compare.price'), k('compare.pricePer', { monthly: base, annual }), k('compare.priceAll')],
  ]
  const cell = (c: string | typeof CHECK) => c === CHECK ? <><CheckIcon /><span className="sr-only">{k('compare.included')}</span></> : c

  return (
    <>
      <PageHead
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: k('crumb') }]}
        title={<>{k('title')} <Accent>{k('titleAccent')}</Accent></>}
        lede={k('lede')}
      >
        <div className="glass notice"><span className="live-dot" aria-hidden="true" /><div><b>{k('noticeTitle')}</b><small>{k('noticeBody')}</small></div></div>
      </PageHead>

      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <Reveal className="wrap price-grid">
          <PricingCalculator instruments={instruments} prices={prices} defaultKey={defaultKey} />
          <PlanCards
            includesTitle={k('includes.title')}
            includes={[1, 2, 3, 4, 5].map(n => k(`includes.i${n}`))}
            allAccessTitle={k('allAccess.title')}
            allAccessBody={k('allAccess.body')}
            soon={t('marketing.site.common.comingSoon')}
          />
        </Reveal>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><div><p className="eyebrow">{k('how.eyebrow')}</p><h2 className="h2" style={{ marginTop: 18 }}>{k('how.title')} <Accent>{k('how.titleAccent')}</Accent></h2></div></div>
          <Reveal className="steps3">
            <div><b>1</b><h3>{k('how.s1Title')}</h3><p>{k('how.s1Body', { base })}</p></div>
            <div><b>2</b><h3>{k('how.s2Title')}</h3><p>{k('how.s2Body', { addon })}</p></div>
            <div><b>3</b><h3>{k('how.s3Title')}</h3><p>{k('how.s3Body', { annual, pct: yearlySavingPercent(prices) })}</p></div>
          </Reveal>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2 className="h2" style={{ fontSize: 'clamp(36px,4vw,56px)', marginBottom: 24 }}>{k('compare.title')}</h2>
          <div className="tbl">
            <table className="compare">
              <thead><tr><th scope="col">{k('compare.feature')}</th><th scope="col">{k('compare.perInstrument')}</th><th scope="col">{k('compare.allAccess')} <span className="tag" style={{ marginLeft: 6 }}>{k('compare.soon')}</span></th></tr></thead>
              <tbody>
                {rows.map(([label, per, all], i) => (
                  <tr key={i}>
                    <th scope="row">{label}</th>
                    <td>{cell(per)}</td>
                    <td className={i === rows.length - 1 ? 'dim' : undefined}>{cell(all)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: 'var(--humo-2)', fontSize: 14, marginTop: 16 }}>{k('faqPrompt')} <Link href="/faq" style={{ color: 'var(--ambar)' }}>{k('faqLink')}</Link>.</p>
        </div>
      </section>

      <Finale />
    </>
  )
}
