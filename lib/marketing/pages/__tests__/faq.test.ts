import { describe, expect, it } from 'vitest'
import { buildFaq } from '../faq'

// A fake translator that echoes the key plus its params, so we can see what was interpolated.
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join('|')}` : key

const prices = { base_monthly: 1999, base_annual: 19999, addon_monthly: 999 }

describe('buildFaq', () => {
  it('has the three categories in order', () => {
    const faq = buildFaq({ t, locale: 'en', prices, instrumentKeys: ['Piano'] })
    expect(faq.map(c => c.id)).toEqual(['getting-started', 'billing', 'playsense'])
    expect(faq.every(c => c.items.length > 0)).toBe(true)
  })
  it('interpolates formatted prices into the cost answer', () => {
    const cost = buildFaq({ t, locale: 'en', prices, instrumentKeys: ['Piano'] })[1].items[0]
    expect(cost.a).toBe('marketing.site.faq.billing.costA|base=$19.99|annual=$199.99|addon=$9.99')
  })
  it('lists the live instruments, localized and joined', () => {
    const inst = buildFaq({ t, locale: 'es', prices, instrumentKeys: ['Timbal', 'Bass', 'Violin'] })[0].items[2]
    expect(inst.a).toBe('marketing.site.faq.start.instrumentsA|list=Timbal, Bajo y Violín')
  })
  it('falls back when no instrument is live', () => {
    const inst = buildFaq({ t, locale: 'en', prices, instrumentKeys: [] })[0].items[2]
    expect(inst.a).toBe('marketing.site.faq.start.instrumentsNone')
  })
  it('never mentions a free trial, Cuatro, Tango or Bossa nova keys', () => {
    const all = JSON.stringify(buildFaq({ t, locale: 'en', prices, instrumentKeys: ['Piano'] }))
    expect(all).not.toMatch(/trial|cuatro|tango|bossa/i)
  })
})
