'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Music, ArrowRight, Plus, AlertCircle } from 'lucide-react'
import { SUBSCRIBABLE_INSTRUMENTS, INSTRUMENT_CONFIG } from '@/lib/instruments'
import { formatCents, type PricingMap } from '@/lib/payments/pricing-types'
import { cn } from '@/lib/utils'

interface CoursePick {
  id: string
  title: string
  slug: string
  description: string | null
}

interface SubscribeClientProps {
  prices: PricingMap
  subscribedInstruments: string[]
  coursesByInstrument: Record<string, CoursePick[]>
  initialInstrument: string | null
  initialCourseId: string | null
  canceled: boolean
}

type Cadence = 'month' | 'year'

export function SubscribeClient({
  prices,
  subscribedInstruments,
  coursesByInstrument,
  initialInstrument,
  initialCourseId,
  canceled,
}: SubscribeClientProps) {
  const [instrument, setInstrument] = useState<string | null>(
    initialInstrument && !subscribedInstruments.includes(initialInstrument) ? initialInstrument : null
  )
  const [includedGenreId, setIncludedGenreId] = useState<string | null>(initialCourseId)
  const [addonGenreIds, setAddonGenreIds] = useState<string[]>([])
  const [cadence, setCadence] = useState<Cadence>('month')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableCourses = instrument ? coursesByInstrument[instrument] ?? [] : []
  const totalGenres = (includedGenreId ? 1 : 0) + addonGenreIds.length
  const addonCount = Math.max(0, totalGenres - 1)

  // Annual + add-ons is intentionally blocked in v1 (see plan).
  const annualBlocksAddons = cadence === 'year' && addonCount > 0

  const monthlyTotalCents =
    cadence === 'month'
      ? prices.base_monthly.amount_cents + addonCount * prices.addon_monthly.amount_cents
      : prices.base_annual.amount_cents

  const totalLabel = useMemo(() => {
    if (cadence === 'month') return `${formatCents(monthlyTotalCents)} / month`
    return `${formatCents(monthlyTotalCents)} / year`
  }, [cadence, monthlyTotalCents])

  const canSubmit =
    !!instrument &&
    !!includedGenreId &&
    !annualBlocksAddons &&
    !isLoading

  async function handleSubmit() {
    if (!canSubmit || !instrument || !includedGenreId) return
    setError(null)
    setIsLoading(true)

    const genreCourseIds = [includedGenreId, ...addonGenreIds]

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrument, interval: cadence, genreCourseIds }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Checkout failed')
        setIsLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e: any) {
      setError(e?.message ?? 'Checkout failed')
      setIsLoading(false)
    }
  }

  function toggleAddon(courseId: string) {
    if (cadence === 'year') return
    setAddonGenreIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">
          Pick an instrument, your first genre course (the fundamentals course is included free), and
          optional extra genres on monthly plans.
        </p>
      </div>

      {canceled && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <span>Checkout was canceled. Pick again to try.</span>
        </div>
      )}

      {/* ── Step 1: Instrument ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          1. Instrument
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {SUBSCRIBABLE_INSTRUMENTS.map((inst) => {
            const isSubscribed = subscribedInstruments.includes(inst)
            const isSelected = instrument === inst
            const cfg = INSTRUMENT_CONFIG[inst]
            if (isSubscribed) {
              return (
                <div
                  key={inst}
                  className="rounded-xl border border-dashed bg-muted/40 px-3 py-4 text-center opacity-60"
                  title="You're already subscribed to this instrument"
                >
                  <p className="text-sm font-medium text-muted-foreground">{inst}</p>
                  <p className="text-[10px] text-muted-foreground">Subscribed</p>
                </div>
              )
            }
            return (
              <button
                key={inst}
                onClick={() => {
                  setInstrument(inst)
                  setIncludedGenreId(null)
                  setAddonGenreIds([])
                }}
                className={cn(
                  'relative rounded-xl border px-3 py-4 text-sm font-medium transition-all',
                  cfg?.color,
                  isSelected ? 'border-current shadow-md scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-sm'
                )}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-current/20">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
                {inst}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Step 2: Genre courses ──────────────────────────────────────── */}
      {instrument && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            2. Your courses
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            One genre course is included. On monthly plans, you can pick extra ones for{' '}
            <strong>{formatCents(prices.addon_monthly.amount_cents)} / month</strong> each.
            The instrument fundamentals course is included automatically.
          </p>

          {availableCourses.length === 0 ? (
            <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              No genre courses are published for {instrument} yet.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableCourses.map((c) => {
                const isIncluded = includedGenreId === c.id
                const isAddon = addonGenreIds.includes(c.id)
                const isSelected = isIncluded || isAddon
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (!includedGenreId) {
                        setIncludedGenreId(c.id)
                      } else if (isIncluded) {
                        // Deselect the included → promote first addon if any.
                        const [nextIncluded, ...rest] = addonGenreIds
                        setIncludedGenreId(nextIncluded ?? null)
                        setAddonGenreIds(rest)
                      } else {
                        toggleAddon(c.id)
                      }
                    }}
                    className={cn(
                      'flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all',
                      isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40'
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium">{c.title}</span>
                      {isIncluded && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Included
                        </span>
                      )}
                      {isAddon && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          +{formatCents(prices.addon_monthly.amount_cents)}/mo
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: Cadence ────────────────────────────────────────────── */}
      {includedGenreId && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            3. Billing
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCadence('month')}
              className={cn(
                'rounded-xl border px-4 py-4 text-left transition-all',
                cadence === 'month' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40'
              )}
            >
              <div className="text-sm font-semibold">Monthly</div>
              <div className="mt-1 text-lg font-bold">{formatCents(prices.base_monthly.amount_cents)}/mo</div>
              <div className="mt-1 text-xs text-muted-foreground">+ {formatCents(prices.addon_monthly.amount_cents)} per extra genre</div>
            </button>
            <button
              onClick={() => {
                setCadence('year')
                setAddonGenreIds([]) // annual signup is base-only in v1
              }}
              className={cn(
                'rounded-xl border px-4 py-4 text-left transition-all',
                cadence === 'year' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40'
              )}
            >
              <div className="text-sm font-semibold">Annual <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Save 17%</span></div>
              <div className="mt-1 text-lg font-bold">{formatCents(prices.base_annual.amount_cents)}/yr</div>
              <div className="mt-1 text-xs text-muted-foreground">Add extra genres after signup</div>
            </button>
          </div>
          {annualBlocksAddons && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-500">
              Annual signup is base-only. We unchecked your extra genres — you can add them after signup
              from the manage page.
            </p>
          )}
        </section>
      )}

      {/* ── Summary + CTA ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{includedGenreId ? totalLabel : '—'}</div>
            {includedGenreId && cadence === 'month' && addonCount > 0 && (
              <div className="text-xs text-muted-foreground">
                Base + {addonCount} add-on{addonCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <Button size="lg" disabled={!canSubmit} onClick={handleSubmit}>
            {isLoading ? 'Redirecting…' : (<>Continue to payment <ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>
        </div>
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!instrument && (
          <p className="text-xs text-muted-foreground"><Music className="mr-1 inline h-3 w-3" />Pick an instrument to start.</p>
        )}
        {instrument && !includedGenreId && (
          <p className="text-xs text-muted-foreground"><Plus className="mr-1 inline h-3 w-3" />Pick the genre course to include with your subscription.</p>
        )}
      </div>
    </div>
  )
}
