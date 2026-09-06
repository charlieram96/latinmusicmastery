'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { isNavActive, navGroups, TAB_ITEMS } from './nav-items'
import { useSidebarState } from './sidebar-state'
import { initialsFor } from '@/lib/dashboard/initials'
import type { DashboardSidebarProps } from './dashboard-sidebar'

/** Routes with their own fixed bottom chrome (course action bar, lesson player). */
const TAB_BAR_HIDDEN_PREFIXES = ['/dashboard/course/', '/dashboard/modules/']

export function MobileNavSheet({
  isAdmin = false,
  isTeacher = false,
  userEmail = '',
  userName = '',
  userAvatar = null,
  hasSubscription = false,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { mobileOpen, setMobileOpen } = useSidebarState()
  const groups = navGroups(isTeacher, isAdmin)

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[300px] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">{t('dashboard.nav.label')}</SheetTitle>
        <div className="flex h-14 items-center gap-2 px-4">
          <Image src="/logo-solo-color.svg" alt="" width={32} height={24} className="h-6 w-8 object-contain" />
          <Image src="/sidebar-logo.svg" alt="Latin Music Mastery" width={196} height={22} className="h-[22px] w-auto" />
        </div>
        <nav aria-label={t('dashboard.nav.label')} className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map((group) => (
            <div key={group.key} className="mb-1">
              <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t(`dashboard.nav.groups.${group.key}`)}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-lg pl-[10px] pr-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      active && 'bg-primary/[0.12] text-primary hover:bg-primary/[0.16]'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{t(`dashboard.nav.${item.labelKey}`)}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="group/rail" data-pinned="true">
            <LanguageToggle variant="rail" />
            <ThemeToggle variant="rail" />
          </div>
          <Link
            href="/dashboard/settings"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 items-center rounded-lg pl-1 pr-2 hover:bg-sidebar-accent"
          >
            <Avatar className="h-8 w-8 shrink-0">
              {userAvatar ? <AvatarImage src={userAvatar} alt={userName || 'User'} /> : null}
              <AvatarFallback>{initialsFor(userName, userEmail)}</AvatarFallback>
            </Avatar>
            <span className="ml-3 min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{userName || userEmail.split('@')[0]}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {hasSubscription ? t('dashboard.nav.plan.active') : t('dashboard.nav.plan.free')}
              </span>
            </span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  if (TAB_BAR_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null

  return (
    <nav
      aria-label={t('dashboard.nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {TAB_ITEMS.map((item) => {
        const Icon = item.icon
        const active = isNavActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground',
              active && 'text-primary'
            )}
          >
            <Icon className="h-5 w-5" />
            {t(`dashboard.nav.tabs.${item.labelKey}`)}
          </Link>
        )
      })}
    </nav>
  )
}
