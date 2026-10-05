'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { updatePricing } from '@/app/actions/pricing'
import type { PricingMap, PricingKey } from '@/lib/payments/pricing-types'

interface PricingFormProps {
  prices: PricingMap
}

const ROW_LABELS: Record<PricingKey, { title: string; subtitle: string }> = {
  base_monthly:  { title: 'Base — Monthly',  subtitle: 'Per instrument, billed monthly. Includes fundamentals + 1 genre course.' },
  base_annual:   { title: 'Base — Annual',   subtitle: 'Per instrument, billed annually (15% off the base only).' },
  addon_monthly: { title: 'Add-on Genre',    subtitle: 'Each additional genre course on the same instrument, billed monthly.' },
}

const KEYS: PricingKey[] = ['base_monthly', 'base_annual', 'addon_monthly']

function centsToDollars(c: number): string {
  return (c / 100).toFixed(2)
}

export function PricingForm({ prices }: PricingFormProps) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await updatePricing(formData)
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'success', text: 'Prices saved. Public pages will refresh shortly.' })
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {KEYS.map((key) => {
        const row = prices[key]
        const labels = ROW_LABELS[key]
        const updated = row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'

        return (
          <div key={key} className="rounded-2xl border bg-card p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">{labels.title}</h2>
                <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
              </div>
              <code className="text-[11px] text-muted-foreground">{key}</code>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${key}.dollars`}><AdminText text={"Amount (USD)"} /></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id={`${key}.dollars`}
                    name={`${key}.dollars`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={centsToDollars(row.amount_cents)}
                    className="pl-7"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${key}.stripe_price_id`}>Stripe price_id</Label>
                <Input
                  id={`${key}.stripe_price_id`}
                  name={`${key}.stripe_price_id`}
                  type="text"
                  placeholder="price_..."
                  defaultValue={row.stripe_price_id}
                  spellCheck={false}
                />
                {!row.stripe_price_id && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    No Stripe price_id set — checkout will fail until you add one.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${key}.description`}><AdminText text={"Internal description"} /></Label>
                <Input
                  id={`${key}.description`}
                  name={`${key}.description`}
                  type="text"
                  defaultValue={row.description ?? ''}
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground"><AdminText text={"Last updated:"} /> {updated}</p>
          </div>
        )
      })}

      {message && (
        <div
          className={
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ' +
            (message.kind === 'success'
              ? 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive')
          }
        >
          {message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <AdminText text={"Saving…"} /> : 'Save prices'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong><AdminText text={"Reminder:"} /></strong> Stripe prices are immutable. If you change an amount, create a new
        recurring price in Stripe (under the right Product), paste its ID into the field above, and
        archive the old price in Stripe. New subscriptions will use the new price; existing
        subscriptions keep their original price until you migrate them.
      </p>
    </form>
  )
}
