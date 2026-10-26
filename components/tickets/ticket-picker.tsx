'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { formatEventShortDate, formatMoney } from '@/lib/tickets/format'
import type { TierSaleState } from '@/lib/tickets/checkout'

export interface PickerTier {
  id: string
  name: string
  description: string
  priceCents: number
  state: TierSaleState
  left: number | null
  salesStartAt: string | null
}

interface TicketPickerProps {
  eventId: string
  currency: string
  timezone: string
  maxPerOrder: number
  tiers: PickerTier[]
  salesOpen: boolean
  /** Prefill for signed-in buyers. */
  defaultName: string
  defaultEmail: string
}

const T = 'tickets.event'
const LOW_STOCK = 10

/** Tier quantities + buyer details → /api/events/checkout → Stripe (or the order page when free). */
export function TicketPicker({ eventId, currency, timezone, maxPerOrder, tiers, salesOpen, defaultName, defaultEmail }: TicketPickerProps) {
  const { t, locale } = useTranslation()
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const onSale = tiers.filter((tier) => tier.state === 'on_sale')
    return onSale.length === 1 ? { [onSale[0].id]: 1 } : {}
  })
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)

  const count = Object.values(qty).reduce((a, b) => a + b, 0)
  const total = useMemo(() => tiers.reduce((sum, tier) => sum + (qty[tier.id] ?? 0) * tier.priceCents, 0), [qty, tiers])
  const price = (cents: number) => (cents === 0 ? t(`${T}.free`) : formatMoney(cents, currency, locale))

  const change = (tier: PickerTier, delta: number) => {
    setError(null)
    setQty((current) => {
      const now = current[tier.id] ?? 0
      const others = count - now
      const cap = Math.min(maxPerOrder - others, tier.left ?? Infinity)
      const next = Math.max(0, Math.min(now + delta, cap))
      return { ...current, [tier.id]: next }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (count === 0) return setError(t(`${T}.errors.empty`))
    if (name.trim().length < 2) return setError(t(`${T}.errors.name`))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t(`${T}.errors.email`))
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/events/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          items: Object.entries(qty).filter(([, q]) => q > 0).map(([tierId, quantity]) => ({ tierId, quantity })),
          name: name.trim(),
          email: email.trim(),
          locale,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      // Every error code the checkout route returns has a message under tickets.event.errors.
      setError(t(`${T}.errors.${data.error ?? 'generic'}`))
    } catch {
      setError(t(`${T}.errors.generic`))
    }
    setStatus('idle')
  }

  const tierTag = (tier: PickerTier) => {
    if (tier.state === 'sold_out') return t(`${T}.soldOut`)
    if (tier.state === 'not_started') {
      return tier.salesStartAt ? t(`${T}.onSaleFrom`, { date: formatEventShortDate(tier.salesStartAt, timezone, locale) }) : t(`${T}.soon`)
    }
    if (tier.state === 'ended') return t(`${T}.salesEnded`)
    return null
  }

  return (
    <form className="tp" onSubmit={submit} noValidate>
      <h2>{t(`${T}.tickets`)}</h2>
      <ul className="tp-tiers">
        {tiers.map((tier) => {
          const q = qty[tier.id] ?? 0
          const tag = tierTag(tier)
          const disabled = !salesOpen || tier.state !== 'on_sale'
          const cap = Math.min(maxPerOrder - (count - q), tier.left ?? Infinity)
          return (
            <li key={tier.id} className="tp-tier" data-active={q > 0} data-disabled={disabled}>
              <div>
                <div className="tp-name">{tier.name}</div>
                {tier.description && <div className="tp-desc">{tier.description}</div>}
                <div className="tp-price">
                  {price(tier.priceCents)}
                  {tier.state === 'on_sale' && tier.left !== null && tier.left <= LOW_STOCK && (
                    <small>{t(`${T}.left`, { count: tier.left })}</small>
                  )}
                </div>
              </div>
              {tag || disabled ? (
                <span className="tp-tag">{tag ?? t(`${T}.unavailable`)}</span>
              ) : (
                <div className="tp-step" role="group" aria-label={t(`${T}.quantityFor`, { tier: tier.name })}>
                  <button type="button" onClick={() => change(tier, -1)} disabled={q === 0} aria-label={t(`${T}.decrease`)}>−</button>
                  <output aria-live="polite">{q}</output>
                  <button type="button" onClick={() => change(tier, 1)} disabled={q >= cap} aria-label={t(`${T}.increase`)}>+</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {salesOpen && (
        <>
          <div className="tp-fields">
            <label htmlFor="tp-name">{t(`${T}.name`)}
              <input id="tp-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label htmlFor="tp-email">{t(`${T}.email`)}
              <input id="tp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          </div>
          <div className="tp-total">
            <span>{t(`${T}.total`, { count })}</span>
            <b>{count === 0 ? '—' : price(total)}</b>
          </div>
          {error && <p className="ev-notice bad" role="alert">{error}</p>}
          <button type="submit" className="btn btn-hot" disabled={status === 'sending' || count === 0}>
            {status === 'sending' ? t(`${T}.processing`) : total === 0 && count > 0 ? t(`${T}.reserve`) : t(`${T}.checkout`)}
          </button>
          <p className="tp-fine">{total === 0 && count > 0 ? t(`${T}.freeNote`) : t(`${T}.secureNote`)}</p>
        </>
      )}
    </form>
  )
}
