'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { LogoMark } from './LogoMark'

const LINKS = [
  { href: '/explore', key: 'explore', match: ['/explore', '/course-preview'] },
  { href: '/instructors', key: 'instructors', match: ['/instructors'] },
  { href: '/playsense', key: 'playsense', match: ['/playsense'] },
  { href: '/pricing', key: 'pricing', match: ['/pricing'] },
  { href: '/about', key: 'about', match: ['/about'] },
] as const

/** Jump to this page's waitlist if it has one, otherwise the home page's. */
function goToJoin(e: React.MouseEvent) {
  const el = document.getElementById('join')
  if (!el) return
  e.preventDefault()
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

export function SiteHeader() {
  const { t, locale, setLocale, locales } = useTranslation()
  const path = usePathname() ?? '/'
  const [scrolled, setScrolled] = useState(false)
  // The sheet remembers the path it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === path
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn(typeof v === 'function' ? (v(open) ? path : null) : v ? path : null)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOn(null) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])

  const isCur = (m: readonly string[]) => m.some(p => path === p || path.startsWith(p + '/'))

  return (
    <header className={`hdr${scrolled || open ? ' scrolled' : ''}`}>
      <div className="wrap hdr-in">
        <Link className="brand" href="/" aria-label="Latin Music Mastery">
          <LogoMark />
          <span className="brand-name">Latin Music<small>MASTERY</small></span>
        </Link>
        <nav className="nav" aria-label={t('marketing.site.nav.main')}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={isCur(l.match) ? 'cur' : undefined} aria-current={isCur(l.match) ? 'page' : undefined}>
              {t(`marketing.site.nav.${l.key}`)}
            </Link>
          ))}
        </nav>
        <div className="lang" role="group" aria-label={t('marketing.site.nav.language')}>
          {locales.map(l => (
            <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <Link className="btn btn-hot btn-sm" href="/#join" onClick={goToJoin}>{t('marketing.site.common.joinWaitlist')}</Link>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mkt-menu" onClick={() => setOpen(o => !o)}>
          <span className="sr-only">{open ? t('marketing.site.common.close') : t('marketing.site.common.menu')}</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="msheet" id="mkt-menu">
          <nav aria-label={t('marketing.site.nav.main')}>
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} aria-current={isCur(l.match) ? 'page' : undefined}>{t(`marketing.site.nav.${l.key}`)}</Link>
            ))}
          </nav>
          <Link className="btn btn-hot" href="/#join" onClick={e => { setOpen(false); goToJoin(e) }}>{t('marketing.site.common.joinWaitlist')}</Link>
        </div>
      )}
    </header>
  )
}
