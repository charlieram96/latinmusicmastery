'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { resolvePageTitle } from '@/lib/dashboard/page-title'
import {
  getHeaderOverride,
  getServerHeaderOverride,
  subscribeHeaderOverride,
} from '@/components/dashboard/header-title-store'

const subscribeNever = () => () => {}

/**
 * Route-aware header title: today's date over "Home", "Home ›" over the page
 * name, or, when a page sets an override, the section name over the page's own
 * title (a course, a lesson).
 */
export function HeaderTitle() {
  const pathname = usePathname()
  const { t, locale } = useTranslation()
  const { titleKey, crumb } = resolvePageTitle(pathname)
  const override = useSyncExternalStore(subscribeHeaderOverride, getHeaderOverride, getServerHeaderOverride)
  // The date is rendered after mount only, so the server never guesses the client's day.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const dateText = mounted
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date())
    : ''

  const crumbText = override ? t(titleKey) : crumb === 'date' ? null : t('dashboard.nav.home')
  const titleText = override ? override.title : t(titleKey)

  return (
    <div className="hidden min-w-0 md:block">
      <div className="flex h-4 items-center gap-1 text-xs text-muted-foreground">
        {crumbText === null ? (
          <span suppressHydrationWarning className="inline-block first-letter:uppercase">
            {dateText}
          </span>
        ) : (
          <>
            <span className="truncate">{crumbText}</span>
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          </>
        )}
      </div>
      <div className="truncate font-heading text-[15px] font-bold leading-tight tracking-tight">{titleText}</div>
    </div>
  )
}
