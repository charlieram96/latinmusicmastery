'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { formatCents } from '@/lib/payments/pricing-types'
import { quote, yearlySavingPercent, type Billing, type PriceCents } from '@/lib/marketing/pricing-calc'

export type CalcInstrument = { key: string; label: string; styleCourses: number }

/**
 * Instrument + number of styles + billing → animated total. Prices come from
 * the `pricing` table (passed in); nothing here is hard-coded.
 */
export function PricingCalculator({ instruments, prices, defaultKey }: { instruments: CalcInstrument[]; prices: PriceCents; defaultKey?: string }) {
  const { t } = useTranslation()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.pricing.calc.${s}`, p)
  const [inst, setInst] = useState(defaultKey ?? instruments[0]?.key ?? '')
  const [styles, setStyles] = useState(1)
  const [billing, setBilling] = useState<Billing>('m')
  const current = instruments.find(i => i.key === inst) ?? instruments[0]
  const max = Math.max(1, current?.styleCourses ?? 1)
  const q = quote({ billing, styles, maxStyles: max, prices })
  const shown = useTween(q.amountCents)
  const pct = yearlySavingPercent(prices)

  return (
    <div className="calc">
      <div className="calc-row">
        <div className="calc-lbl"><span className="sp-label">{k('instrument')}</span><span className="sp-label">{k('available', { n: current?.styleCourses ?? 0 })}</span></div>
        <div className="inst-pick" role="group" aria-label={k('instrument')}>
          {instruments.map(i => <button key={i.key} type="button" aria-pressed={i.key === inst} onClick={() => { setInst(i.key); setStyles(s => Math.min(s, Math.max(1, i.styleCourses))) }}>{i.label}</button>)}
        </div>
      </div>
      <div className="calc-row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
        <div><span className="sp-label">{k('styles')}</span><p style={{ color: 'var(--humo)', fontSize: 14.5, marginTop: 6 }}>{k('stylesHint', { addon: formatCents(prices.addon_monthly) })}</p></div>
        <div className="stepper">
          <button type="button" aria-label={k('fewer')} disabled={q.styles <= 1} onClick={() => setStyles(q.styles - 1)}>−</button>
          <output className="tnum" aria-live="polite">{q.styles === 1 ? k('styleOne') : k('styleMany', { n: q.styles })}</output>
          <button type="button" aria-label={k('more')} disabled={q.styles >= max} onClick={() => setStyles(q.styles + 1)}>+</button>
        </div>
      </div>
      <div className="calc-row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
        <span className="sp-label">{k('billing')}</span>
        <div className="seg" role="group" aria-label={k('billing')}>
          <button type="button" aria-pressed={billing === 'm'} onClick={() => setBilling('m')}>{k('monthly')}</button>
          <button type="button" aria-pressed={billing === 'y'} onClick={() => setBilling('y')}>{k('yearly', { pct })}</button>
        </div>
      </div>
      <div className="total">
        <div className="total-amt tnum"><sup>$</sup><span>{(shown / 100).toFixed(2)}</span><small>{q.per === 'mo' ? k('perMonth') : k('perYear')}</small></div>
        <div className="total-break tnum">
          {billing === 'm'
            ? <>{k('base', { price: formatCents(prices.base_monthly) })}{q.extraMonthlyCents > 0 && <><br />{k('extras', { n: q.styles - 1, price: formatCents(prices.addon_monthly) })}</>}</>
            : <><b>{k('save', { price: formatCents(q.savingsCents) })}</b>{q.extraMonthlyCents > 0 && <><br />{k('extrasYearly', { price: formatCents(q.extraMonthlyCents) })}</>}</>}
        </div>
      </div>
      <a className="btn btn-hot" href="#join" style={{ ['--h' as string]: '58px', fontSize: 16 }}>{k('cta')}</a>
    </div>
  )
}

function useTween(target: number) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setV(target); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 520), e = 1 - Math.pow(1 - k, 4), x = a + (target - a) * e
      from.current = x; setV(x)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}
