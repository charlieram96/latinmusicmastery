import type { Metadata } from 'next'
import './styles/home.css'
import { getServerTranslator } from '@/lib/i18n/server'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { getPricing, formatCents } from '@/lib/payments/pricing-source'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { SEATS, defaultSeatKey } from '@/lib/marketing/stage-plot'
import { Finale } from '@/components/marketing/site/Finale'
import { Marquee } from '@/components/marketing/home/Marquee'
import { Numbers } from '@/components/marketing/home/Numbers'
import type { PlotSeat } from '@/components/marketing/home/StagePlot'
import { AtlasSection, GrooveSection, HeroSection, MaestrosSection, PlaySenseSection, PricingSection, StageSection } from '@/components/marketing/home/sections'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return {
    title: t('metadata.home.title'),
    description: t('metadata.home.description'),
    openGraph: {
      title: t('metadata.home.title'),
      description: t('metadata.home.ogDescription'),
      type: 'website',
    },
  }
}

export default async function MarketingHomePage() {
  const { t, locale } = await getServerTranslator()
  const [catalog, pricing] = await Promise.all([getMarketingCatalog(locale), getPricing()])
  const prices = {
    base_monthly: pricing.base_monthly.amount_cents,
    base_annual: pricing.base_annual.amount_cents,
    addon_monthly: pricing.addon_monthly.amount_cents,
  }

  const teacherById = new Map(catalog.teachers.map(tc => [tc.id, tc]))
  const seats: Record<string, PlotSeat> = {}
  for (const seat of SEATS) {
    const inst = catalog.instruments.find(i => i.key === seat.key)
    const teacherIds = inst?.teacherIds ?? catalog.teachers.filter(tc => tc.seatKeys.includes(seat.key)).map(tc => tc.id)
    seats[seat.key] = {
      key: seat.key,
      label: instrumentLabel(seat.key, locale),
      soon: !inst || inst.total === 0,
      hasFundamentals: !!inst?.fundamentals,
      total: inst?.total ?? 0,
      styles: (inst?.courses ?? []).map(c => ({ id: c.id, name: c.styleName ?? c.title })),
      teachers: teacherIds.flatMap(id => {
        const tc = teacherById.get(id)
        return tc ? [{ id: tc.id, name: tc.name, instrument: tc.instrument, imageUrl: tc.imageUrl }] : []
      }),
    }
  }
  const defaultKey = defaultSeatKey(catalog.instruments)

  const patricio = catalog.teachers.find(tc => tc.name.includes('Patricio'))
  const chip = patricio?.imageUrl ? { name: patricio.name, imageUrl: patricio.imageUrl } : null

  const calcInstruments = catalog.instruments
    .filter(i => i.courses.length > 0)
    .map(i => ({ key: i.key, label: instrumentLabel(i.key, locale), styleCourses: i.courses.length }))
  const calcDefault = calcInstruments.some(i => i.key === defaultKey) ? defaultKey : calcInstruments[0]?.key ?? ''

  return (
    <>
      <HeroSection t={t} counts={catalog.counts} price={formatCents(prices.base_monthly)} chip={chip} />
      <Marquee countries={catalog.countries} label={t('marketing.site.home.marquee.label')} />
      <Numbers counts={catalog.counts} />
      <StageSection t={t} seats={seats} defaultKey={defaultKey} />
      <AtlasSection t={t} countries={catalog.countries} />
      <GrooveSection t={t} />
      <PlaySenseSection t={t} />
      <MaestrosSection t={t} teachers={catalog.teachers.filter(tc => tc.imageUrl)} />
      <PricingSection t={t} instruments={calcInstruments} prices={prices} defaultKey={calcDefault} />
      <Finale />
    </>
  )
}
