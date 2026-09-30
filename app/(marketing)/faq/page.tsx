import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerTranslator } from '@/lib/i18n/server'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { getPricing } from '@/lib/payments/pricing-source'
import { buildFaq } from '@/lib/marketing/pages/faq'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { FaqNav } from '@/components/marketing/pages/FaqNav'
import '../styles/pages.css'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.faq.metaTitle'), description: t('marketing.site.faq.metaDescription') }
}

const F = 'marketing.site.faq'

export default async function FaqPage() {
  const { t, locale } = await getServerTranslator()
  const [catalog, pricing] = await Promise.all([getMarketingCatalog(locale), getPricing()])
  const faq = buildFaq({
    t,
    locale,
    prices: {
      base_monthly: pricing.base_monthly.amount_cents,
      base_annual: pricing.base_annual.amount_cents,
      addon_monthly: pricing.addon_monthly.amount_cents,
    },
    instrumentKeys: catalog.instruments.map(i => i.key),
  })

  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: t(`${F}.crumb`) }]}
        title={<>{t(`${F}.title`)} <Accent>{t(`${F}.titleAccent`)}</Accent></>}
        lede={<>{t(`${F}.lede`)} <Link href="/contact" style={{ color: 'var(--ambar)' }}>{t(`${F}.ledeLink`)}</Link></>}
      />
      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <div className="wrap faq-grid">
          <FaqNav label={t(`${F}.navLabel`)} items={faq.map(c => ({ id: c.id, title: c.title }))} />
          <div>
            {faq.map((cat, i) => (
              <div className="faq-cat" id={cat.id} key={cat.id}>
                <h2>{cat.title}</h2>
                {cat.items.map((item, j) => (
                  <details className="qa" key={j} open={i === 0 && j === 0}>
                    <summary><span>{item.q}</span><i aria-hidden="true">+</i></summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
