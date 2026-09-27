'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const B = 'marketing.site.blog'

/**
 * Blog newsletter box. Client-only, exactly as before the redesign: it
 * confirms locally and does not send the address anywhere yet.
 */
export function NewsletterSignup() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const okRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (done) okRef.current?.focus() }, [done])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setError(t(`${B}.newsInvalid`)); return }
    setError('')
    setDone(true)
  }

  return (
    <section className="news" aria-labelledby="news-title">
      <div>
        <h2 id="news-title" className="news-title">{t(`${B}.newsTitle`)} <span className="serif grad-text">{t(`${B}.newsAccent`)}</span></h2>
        <p className="news-body">{t(`${B}.newsBody`)}</p>
      </div>
      <div>
        <form className={`signup${done ? ' done' : ''}`} onSubmit={submit} noValidate style={{ marginTop: 0 }}>
          <div className="field">
            <label htmlFor="news-email" className="sr-only">{t(`${B}.newsLabel`)}</label>
            <input id="news-email" type="email" autoComplete="email" placeholder={t('marketing.site.common.emailPlaceholder')} value={email}
              onChange={e => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby="news-email-err" />
          </div>
          <button className="btn btn-ghost" type="submit">{t(`${B}.newsCta`)}</button>
          <div className="signup-ok" role="status" tabIndex={-1} ref={okRef}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{t(`${B}.newsDone`)}</span>
          </div>
        </form>
        <p className="err" id="news-email-err" aria-live="polite">{error}</p>
      </div>
    </section>
  )
}
