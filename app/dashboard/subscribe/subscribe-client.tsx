'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { SUBSCRIBABLE_INSTRUMENTS, INSTRUMENT_CONFIG } from '@/lib/instruments'
import { PLAN_PRICES, formatCurrency } from '@/lib/pricing'
import { Crown, Music, Check, ArrowRight, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubscribeClientProps {
  subscribedInstruments: string[]
  instrumentPriceId: string
  allAccessPriceId: string
}

export function SubscribeClient({
  subscribedInstruments,
  instrumentPriceId,
  allAccessPriceId,
}: SubscribeClientProps) {
  const [selectedPlan, setSelectedPlan] = useState<'instrument' | 'all_access' | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidSelection =
    selectedPlan === 'all_access' ||
    (selectedPlan === 'instrument' && selectedInstrument !== null)

  const handleContinue = async () => {
    if (!isValidSelection || !selectedPlan) return
    setIsLoading(true)
    setError(null)

    const priceId = selectedPlan === 'all_access' ? allAccessPriceId : instrumentPriceId

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          planType: selectedPlan,
          instrument: selectedPlan === 'instrument' ? selectedInstrument : undefined,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError('Failed to start checkout. Please try again.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Unlock courses and start your Latin music journey.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Per Instrument */}
        <button
          onClick={() => {
            setSelectedPlan('instrument')
            setSelectedInstrument(null)
          }}
          className={cn(
            'relative text-left rounded-2xl border-2 p-6 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selectedPlan === 'instrument'
              ? 'border-primary bg-primary/5 shadow-md'
              : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
          )}
        >
          {selectedPlan === 'instrument' && (
            <motion.span
              layoutId="plan-check"
              className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          )}

          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Music className="h-5 w-5 text-primary" />
          </div>

          <h3 className="text-lg font-semibold mb-1">Per Instrument</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Deep dive into one instrument with full course access.
          </p>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{formatCurrency(PLAN_PRICES.instrument)}</span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
        </button>

        {/* All-Access */}
        <button
          onClick={() => {
            setSelectedPlan('all_access')
            setSelectedInstrument(null)
          }}
          className={cn(
            'relative text-left rounded-2xl border-2 p-6 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selectedPlan === 'all_access'
              ? 'border-primary bg-primary/5 shadow-md'
              : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
          )}
        >
          {/* Popular badge */}
          <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>

          {selectedPlan === 'all_access' && (
            <motion.span
              layoutId="plan-check"
              className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          )}

          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Crown className="h-5 w-5 text-primary" />
          </div>

          <h3 className="text-lg font-semibold mb-1">All-Access</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Every instrument, every course, every masterclass.
          </p>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{formatCurrency(PLAN_PRICES.all_access)}</span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
        </button>
      </div>

      {/* Instrument Grid — animated reveal */}
      <AnimatePresence>
        {selectedPlan === 'instrument' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mb-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Select your instrument</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {SUBSCRIBABLE_INSTRUMENTS.map((instrument) => {
                  const isSubscribed = subscribedInstruments.includes(instrument)
                  const isSelected = selectedInstrument === instrument
                  const config = INSTRUMENT_CONFIG[instrument]

                  if (isSubscribed) {
                    return (
                      <div
                        key={instrument}
                        className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-4 opacity-50 cursor-not-allowed"
                      >
                        <span className="text-sm font-medium text-muted-foreground truncate max-w-full">{instrument}</span>
                        <span className="text-[10px] text-muted-foreground">Subscribed</span>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={instrument}
                      onClick={() => setSelectedInstrument(instrument)}
                      className={cn(
                        'relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-4 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        config?.color,
                        isSelected
                          ? 'border-current shadow-md scale-[1.03]'
                          : 'hover:scale-[1.02] hover:shadow-sm'
                      )}
                    >
                      {isSelected && (
                        <motion.span
                          className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-current/20"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </motion.span>
                      )}
                      <span className="truncate max-w-full">{instrument}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* CTA */}
      <Button
        size="lg"
        className="w-full sm:w-auto"
        disabled={!isValidSelection || isLoading}
        onClick={handleContinue}
      >
        {isLoading ? (
          'Redirecting to checkout...'
        ) : (
          <>
            Continue to Payment
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {!isValidSelection && (
        <p className="mt-3 text-xs text-muted-foreground">
          {selectedPlan === 'instrument'
            ? 'Select an instrument above to continue.'
            : 'Choose a plan above to continue.'}
        </p>
      )}
    </div>
  )
}
