import type { Locale } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { formatCents } from '@/lib/payments/pricing-types'
import { joinNames } from './list'

type T = (key: string, params?: Record<string, string | number>) => string

export interface FaqCategory { id: string; title: string; items: { q: string; a: string }[] }

const K = 'marketing.site.faq'

/**
 * FAQ content with the facts filled in from live data: prices from the
 * pricing table (cents) and the instruments that have published courses.
 */
export function buildFaq({ t, locale, prices, instrumentKeys }: {
  t: T
  locale: Locale
  prices: { base_monthly: number; base_annual: number; addon_monthly: number }
  instrumentKeys: readonly string[]
}): FaqCategory[] {
  const qa = (k: string, a?: string) => ({ q: t(`${K}.${k}Q`), a: a ?? t(`${K}.${k}A`) })
  const list = joinNames(instrumentKeys.map(k => instrumentLabel(k, locale)), locale)
  return [
    {
      id: 'getting-started',
      title: t(`${K}.cats.start`),
      items: [
        qa('start.what'),
        qa('start.experience'),
        qa('start.instruments', list ? t(`${K}.start.instrumentsA`, { list }) : t(`${K}.start.instrumentsNone`)),
        qa('start.lessons'),
      ],
    },
    {
      id: 'billing',
      title: t(`${K}.cats.billing`),
      items: [
        qa('billing.cost', t(`${K}.billing.costA`, {
          base: formatCents(prices.base_monthly),
          annual: formatCents(prices.base_annual),
          addon: formatCents(prices.addon_monthly),
        })),
        qa('billing.founding'),
        qa('billing.cancel'),
        qa('billing.secure'),
      ],
    },
    {
      id: 'playsense',
      title: t(`${K}.cats.playsense`),
      items: [qa('playsense.needs'), qa('playsense.download'), qa('playsense.percussion')],
    },
  ]
}
