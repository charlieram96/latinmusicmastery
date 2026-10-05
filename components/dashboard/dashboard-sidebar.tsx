'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Settings } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle, RAIL_REVEAL } from '@/components/theme-toggle'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { initialsFor } from '@/lib/dashboard/initials'
import { isNavActive, navGroups, type NavItemDef } from './nav-items'

export interface DashboardSidebarProps {
  isAdmin?: boolean
  isTeacher?: boolean
  userEmail?: string
  userName?: string
  userAvatar?: string | null
  hasSubscription?: boolean
}

/** Shown only while collapsed (the group hairlines). */
const HIDE_WHEN_OPEN = 'transition-opacity duration-150 group-hover/rail:opacity-0 group-data-[expanded=true]/rail:opacity-0'

function RailItem({ item, active, label }: { item: NavItemDef; active: boolean; label: string }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-active={active}
      className={cn(
        'relative flex h-10 w-full items-center rounded-lg pl-[10px] pr-2 text-sidebar-foreground/70 transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-foreground',
        'data-[active=true]:bg-primary/[0.12] data-[active=true]:text-primary data-[active=true]:hover:bg-primary/[0.16]'
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-3 bottom-2.5 top-2.5 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn('ml-[22px] truncate text-sm font-medium', RAIL_REVEAL)}>{label}</span>
    </Link>
  )
}

/**
 * Hover-expanding rail. 64px at rest, 248px while the pointer is over it. It
 * overlays the page, so nothing reflows, and every row keeps its height in
 * both states so icons never move. The mark is centered in either width.
 */
export function DashboardSidebar({
  isAdmin = false,
  isTeacher = false,
  userEmail = '',
  userName = '',
  userAvatar = null,
  hasSubscription = false,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const groups = navGroups(isTeacher, isAdmin)

  return (
    <nav
      aria-label={t('dashboard.nav.label')}
      className={cn(
        'group/rail fixed inset-y-0 left-0 z-50 hidden w-16 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground md:flex',
        'transition-[width,box-shadow] duration-200 ease-out hover:w-[264px] hover:shadow-pop'
      )}
    >
      {/* Brand row: the mark stays centered in whichever width the rail has. */}
      <div className="flex h-10 items-center justify-center">
        <Link
          href="/dashboard"
          aria-label={t('dashboard.nav.home')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Image src="/logo-solo-color.svg" alt="" width={32} height={24} priority className="h-6 w-8 object-contain" />
        </Link>
      </div>

      {/* Groups. Each label row is 24px in both states: a hairline collapsed, the name expanded. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            <div className="relative flex h-[34px] items-center px-2.5 pt-2.5">
              <span aria-hidden className={cn('absolute left-2 right-2 top-1/2 h-px bg-sidebar-border', HIDE_WHEN_OPEN)} />
              <span className={cn('truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground', RAIL_REVEAL)}>
                {t(`dashboard.nav.groups.${group.key}`)}
              </span>
            </div>
            {group.items.map((item) => (
              <RailItem
                key={item.href}
                item={item}
                active={isNavActive(pathname, item)}
                label={t(`dashboard.nav.${item.labelKey}`)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Footer: preferences and account. Every row is 40px in both states. */}
      <div className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border pt-2">
        <LanguageToggle variant="rail" />
        <ThemeToggle variant="rail" />
        <RailItem item={{ href: '/dashboard/settings', icon: Settings, labelKey: 'settings' }} active={pathname.startsWith('/dashboard/settings')} label={t('dashboard.nav.settings')} />
        <Link
          href="/dashboard/settings"
          aria-label={t('dashboard.nav.settings')}
          className="flex h-10 w-full items-center rounded-lg pl-1 pr-2 hover:bg-sidebar-accent"
        >
          <Avatar className="h-8 w-8 shrink-0">
            {userAvatar ? <AvatarImage src={userAvatar} alt={userName || 'User'} /> : null}
            <AvatarFallback>{initialsFor(userName, userEmail)}</AvatarFallback>
          </Avatar>
          <span className={cn('ml-4 min-w-0 leading-tight', RAIL_REVEAL)}>
            <span className="block truncate text-sm font-semibold text-sidebar-foreground">
              {userName || userEmail.split('@')[0]}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {hasSubscription ? t('dashboard.nav.plan.active') : t('dashboard.nav.plan.free')}
            </span>
          </span>
        </Link>
      </div>
    </nav>
  )
}
