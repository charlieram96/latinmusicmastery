'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { resolvePageTitle } from '@/lib/dashboard/page-title'

const subscribeNever = () => () => {}

/** Route-aware header title: today's date over "Home", or "Home ›" over the page name. */
export function HeaderTitle() {
  const pathname = usePathname()
  const { t, locale } = useTranslation()
  const { titleKey, crumb } = resolvePageTitle(pathname)
  // The date is rendered after mount only, so the server never guesses the client's day.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const dateText = mounted
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date())
    : ''

  return (
    <div className="hidden min-w-0 md:block">
      <div className="flex h-4 items-center gap-1 text-xs text-muted-foreground">
        {crumb === 'date' ? (
          <span suppressHydrationWarning className="inline-block first-letter:uppercase">
            {dateText}
          </span>
        ) : (
          <>
            <span>{t('dashboard.nav.home')}</span>
            <ChevronRight className="h-3 w-3" aria-hidden />
          </>
        )}
      </div>
      <div className="truncate font-heading text-[15px] font-bold leading-tight tracking-tight">
        {t(titleKey)}
      </div>
    </div>
  )
}
