'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { WaitlistDetailsModal } from '@/components/marketing/WaitlistDetailsModal'
import { useWaitlistOptions } from './waitlist-options'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Pill email field + "Save my seat". A valid email opens the existing details
 * modal, which submits through the `joinWaitlist` server action.
 */
export function WaitlistSignup({ id, className = '', arrow = true }: { id: string; className?: string; arrow?: boolean }) {
  const { t } = useTranslation()
  const { instruments, styles } = useWaitlistOptions()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setError(t('marketing.site.common.invalidEmail')); return }
    setError('')
    setOpen(true)
  }

  return (
    <>
      <form className={`signup${done ? ' done' : ''} ${className}`} onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={id} className="sr-only">{t('marketing.site.common.emailLabel')}</label>
          <input id={id} type="email" autoComplete="email" placeholder={t('marketing.site.common.emailPlaceholder')} value={email}
            onChange={e => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-err`} />
        </div>
        <button className="btn btn-hot" type="submit">
          <span>{t('marketing.site.common.saveSeat')}</span>
          {arrow && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div className="signup-ok" role="status">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{t('marketing.site.common.onList')}</span>
        </div>
      </form>
      <p className="err" id={`${id}-err`} aria-live="polite">{error}</p>
      <WaitlistDetailsModal open={open} onOpenChange={setOpen} email={email.trim()} instruments={instruments} styles={styles}
        onSuccess={() => { setOpen(false); setDone(true) }} />
    </>
  )
}
