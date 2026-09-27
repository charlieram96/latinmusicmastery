'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { CONTACT_TOPICS, topicSubject, validateContact, type ContactField, type ContactValues } from '@/lib/marketing/pages/contact'

export const SUPPORT_EMAIL = 'support@latinmusicmastery.com'

const C = 'marketing.site.contact'
const ERR_KEY: Record<ContactField, string> = { name: 'errName', email: 'errEmail', topic: 'errTopic', message: 'errMessage' }
const EMPTY: ContactValues = { name: '', email: '', topic: 'general', message: '' }

/** Contact form posting JSON to /api/contact, with inline validation and a visible failure state. */
export function ContactForm() {
  const { t } = useTranslation()
  const [values, setValues] = useState<ContactValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<ContactField, ContactField>>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const sentRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => { if (status === 'sent') sentRef.current?.focus() }, [status])

  const set = (field: ContactField, value: string) => {
    setValues(v => ({ ...v, [field]: value }))
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validateContact(values)
    setErrors(found)
    const first = (['name', 'email', 'topic', 'message'] as const).find(f => found[f])
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          subject: topicSubject(values.topic),
          message: values.message.trim(),
        }),
      })
      setStatus(res.ok ? 'sent' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  const reset = () => { setValues(EMPTY); setErrors({}); setStatus('idle') }
  const err = (f: ContactField) => errors[f] ? <p className="err cf-err" id={`cf-${f}-err`}>{t(`${C}.${ERR_KEY[f]}`)}</p> : null
  const described = (f: ContactField) => (errors[f] ? `cf-${f}-err` : undefined)

  return (
    <form ref={formRef} className={`cform${status === 'sent' ? ' done' : ''}`} noValidate onSubmit={submit}>
      <div className="hide-done" style={{ display: 'grid', gap: 18 }}>
        <div className="row2">
          <div className="cf-field">
            <label htmlFor="cf-name">{t(`${C}.name`)}
              <input id="cf-name" data-field="name" autoComplete="name" placeholder={t(`${C}.namePlaceholder`)} value={values.name}
                onChange={e => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={described('name')} />
            </label>
            {err('name')}
          </div>
          <div className="cf-field">
            <label htmlFor="cf-email">{t(`${C}.email`)}
              <input id="cf-email" data-field="email" type="email" autoComplete="email" placeholder={t(`${C}.emailPlaceholder`)} value={values.email}
                onChange={e => set('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={described('email')} />
            </label>
            {err('email')}
          </div>
        </div>
        <div role="group" aria-labelledby="cf-topic-label" aria-describedby={described('topic')}>
          <span className="sp-label" id="cf-topic-label">{t(`${C}.topic`)}</span>
          <div className="topics" style={{ marginTop: 8 }}>
            {CONTACT_TOPICS.map((topic, i) => (
              <button key={topic.key} type="button" className="fchip" data-field={i === 0 ? 'topic' : undefined}
                aria-pressed={values.topic === topic.key} onClick={() => set('topic', topic.key)}>
                {t(`${C}.topics.${topic.key}`)}
              </button>
            ))}
          </div>
          {err('topic')}
        </div>
        <div className="cf-field">
          <label htmlFor="cf-msg">{t(`${C}.message`)}
            <textarea id="cf-msg" data-field="message" placeholder={t(`${C}.messagePlaceholder`)} value={values.message}
              onChange={e => set('message', e.target.value)} aria-invalid={!!errors.message} aria-describedby={described('message')} />
          </label>
          {err('message')}
        </div>
        <div aria-live="polite">
          {status === 'failed' && <p className="cf-fail" role="alert">{t(`${C}.errSend`, { email: SUPPORT_EMAIL })}</p>}
        </div>
        <button className="btn btn-hot" type="submit" style={{ justifySelf: 'start' }} disabled={status === 'sending'} aria-busy={status === 'sending'}>
          <span>{status === 'sending' ? t(`${C}.sending`) : t(`${C}.send`)}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="sent" role="status" tabIndex={-1} ref={sentRef}>
        {status === 'sent' && (
          <>
            <b style={{ fontSize: 18 }}>{t(`${C}.sentTitle`)}</b>
            <p style={{ color: 'var(--humo)', marginTop: 6 }}>{t(`${C}.sentBody`)}</p>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>{t(`${C}.sendAnother`)}</button>
          </>
        )}
      </div>
    </form>
  )
}
