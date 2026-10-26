'use client'

import { useCallback, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { adminLabel } from '@/lib/i18n/admin-labels'
import { cn } from '@/lib/utils'

/** Admin label lookup in the current platform language. */
export function useAdminLabel() {
  const { locale } = useTranslation()
  return useCallback((text: string) => adminLabel(text, locale), [locale])
}

export type Flash = { kind: 'success' | 'error'; text: string } | null

export function useFlash() {
  const [flash, setFlash] = useState<Flash>(null)
  return { flash, setFlash, ok: (text: string) => setFlash({ kind: 'success', text }), fail: (text: string) => setFlash({ kind: 'error', text }) }
}

export function FlashMessage({ flash, className }: { flash: Flash; className?: string }) {
  if (!flash) return null
  const success = flash.kind === 'success'
  return (
    <p
      role={success ? 'status' : 'alert'}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
        success ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
        className,
      )}
    >
      {success ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
      {flash.text}
    </p>
  )
}

export function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Dollars text ↔ cents. */
export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2)
}
export function inputToCents(value: string): number {
  const n = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
