'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Pin, PinOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { initialsFor } from '@/lib/dashboard/initials'
import { isNavActive, navGroups, type NavItemDef } from './nav-items'
import { useSidebarState } from './sidebar-state'

export interface DashboardSidebarProps {
  isAdmin?: boolean
  isTeacher?: boolean
  userEmail?: string
  userName?: string
  userAvatar?: string | null
  hasSubscription?: boolean
}

/**
 * Text that is only visible while the rail is expanded (hover, keyboard focus,
 * or pinned). It fades in place; its container never changes size, so icons
 * keep their position between the two states.
 */
const REVEAL =
  'opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100'
const HIDE_WHEN_OPEN =
  'transition-opacity duration-150 group-hover/rail:opacity-0 group-has-[:focus-visible]/rail:opacity-0 group-data-[pinned=true]/rail:opacity-0'

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
      <span className={cn('ml-3 truncate text-sm font-medium', REVEAL)}>{label}</span>
    </Link>
  )
}

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
  const { pinned, setPinned } = useSidebarState()
  const groups = navGroups(isTeacher, isAdmin)

  return (
    <nav
      aria-label={t('dashboard.nav.label')}
      data-pinned={pinned}
      className={cn(
        'group/rail fixed inset-y-0 left-0 z-50 hidden w-16 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground md:flex',
        'transition-[width,box-shadow] duration-200 ease-out',
        'hover:w-[248px] hover:shadow-pop has-[:focus-visible]:w-[248px] data-[pinned=true]:w-[248px] data-[pinned=true]:shadow-none'
      )}
    >
      {/* Brand row: fixed height, mark stays put, lockup fades in beside it. */}
      <div className="relative flex h-10 items-center">
        <Link
          href="/dashboard"
          aria-label={t('dashboard.nav.home')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Image src="/logo-solo-color.svg" alt="" width={32} height={24} priority className="h-6 w-8 object-contain" />
        </Link>
        <Image
          src="/sidebar-logo.svg"
          alt="Latin Music Mastery"
          width={196}
          height={22}
          className={cn('ml-1 h-[22px] w-auto max-w-[150px] shrink-0 object-contain object-left', REVEAL)}
        />
        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          aria-label={pinned ? t('dashboard.nav.unpin') : t('dashboard.nav.pin')}
          aria-pressed={pinned}
          className={cn(
            'absolute right-0 top-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
            REVEAL
          )}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      </div>

      {/* Groups. Each label row is 24px in both states: a hairline collapsed, the name expanded. */}
      <div className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            <div className="relative flex h-6 items-center px-2.5">
              <span aria-hidden className={cn('absolute left-2 right-2 top-1/2 h-px bg-sidebar-border', HIDE_WHEN_OPEN)} />
              <span
                className={cn(
                  'truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground',
                  REVEAL
                )}
              >
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
        <Link
          href="/dashboard/settings"
          aria-label={t('dashboard.nav.settings')}
          className="flex h-10 w-full items-center rounded-lg pl-1 pr-2 hover:bg-sidebar-accent"
        >
          <Avatar className="h-8 w-8 shrink-0">
            {userAvatar ? <AvatarImage src={userAvatar} alt={userName || 'User'} /> : null}
            <AvatarFallback>{initialsFor(userName, userEmail)}</AvatarFallback>
          </Avatar>
          <span className={cn('ml-3 min-w-0 leading-tight', REVEAL)}>
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
