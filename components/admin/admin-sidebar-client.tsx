'use client'

import { useTranslation } from '@/components/language-provider'
import { adminLabel } from '@/lib/i18n/admin-labels'
import { AdminText } from '@/components/admin/admin-text'


import { useState } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Globe, Music, BookOpen, Users, GraduationCap, BarChart3,
  MessageSquare, DollarSign, Drum, LayoutDashboard, Guitar, ArrowLeft, Mail, Tag,
  Loader2, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LanguageToggle } from '@/components/language-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [{ href: '/admin', label: 'Dashboard', icon: Home, exact: true }],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/courses', label: 'Courses', icon: BookOpen },
      { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
      { href: '/admin/styles', label: 'Musical Styles', icon: Music },
      { href: '/admin/instruments', label: 'Instruments', icon: Guitar },
      { href: '/admin/countries', label: 'Countries', icon: Globe },
      { href: '/admin/play-sense', label: 'Play Sense', icon: Drum },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/waitlist', label: 'Waitlist', icon: Mail },
      { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/financials', label: 'Financials', icon: DollarSign },
      { href: '/admin/pricing', label: 'Pricing', icon: Tag },
    ],
  },
]

function NavigationPending() {
  const { pending } = useLinkStatus()
  return <span role={pending ? 'status' : undefined} className="absolute right-2 top-1/2 -translate-y-1/2">
    {pending && <><Loader2 aria-hidden className="h-4 w-4 animate-spin text-primary" /><span className="sr-only"><AdminText text={"Loading…"} /></span></>}
  </span>
}

export function AdminSidebarClient() {
  const { locale } = useTranslation()
  const pathname = usePathname()
  // Immersive editors (PlaySense Studio, Course Studio) collapse the dashboard
  // to an icon rail so the workspace gets the full width. Everywhere else the
  // sidebar stays expanded — there is no manual toggle.
  const onImmersiveRoute =
    pathname.startsWith('/admin/playsense-studio') ||
    /^\/admin\/courses\/(?!new$)[^/]+/.test(pathname)

  const [hovering, setHovering] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)

  const collapsed = onImmersiveRoute
  // Show full labels when not collapsed, or while hovering the collapsed rail.
  const expanded = !collapsed || hovering || languageMenuOpen
  // When the collapsed rail is hovered, float the full panel OVER the content so
  // the page never shifts; the in-flow <aside> keeps the rail's 64px footprint.
  const overlay = collapsed && expanded

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        // z-index must beat <main> (a later sibling): the hover overlay lives in
        // this aside's stacking context, so the aside itself has to sit on top.
        'relative hidden md:block h-screen sticky top-0 flex-shrink-0',
        overlay ? 'z-50' : 'z-30',
        collapsed ? 'w-16' : 'w-[240px]'
      )}
    >
      <div
        className={cn(
          'lmm-admin-navigation flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200',
          expanded ? 'w-[240px]' : 'w-16',
          overlay && 'absolute top-0 left-0 z-40 shadow-xl'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex h-14 flex-shrink-0 items-center border-b border-sidebar-border',
            expanded ? 'gap-2.5 px-4' : 'justify-center px-0'
          )}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/10">
            <LayoutDashboard className="h-5 w-5 text-sidebar-primary" />
          </span>
          {expanded && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-heading text-[14px] font-bold leading-4 tracking-wide text-sidebar-foreground"> <AdminText text={"Admin Panel"} /> </span>
              <span className="text-[11px] leading-4 text-sidebar-foreground/65">
                Latin Music Mastery
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3', expanded ? 'px-2.5' : 'px-2')}>
          {navGroups.map((group, gi) => (
            <div key={group.label ?? 'top'} className={cn(gi > 0 && 'mt-4')}>
              {group.label &&
                (expanded ? (
                  <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/65">
                    {<AdminText text={group.label} />}
                  </p>
                ) : (
                  <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
                ))}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + '/')

                  const linkContent = (
                    <Link
                      href={item.href}
                      aria-label={adminLabel(item.label, locale)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        'group relative flex items-center rounded-lg text-[14px] font-medium transition-colors',
                        expanded ? 'gap-3 px-2.5 py-2.5' : 'justify-center py-2',
                        isActive
                          ? 'bg-sidebar-primary/10 text-sidebar-primary'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <NavigationPending />
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {expanded && <span className="min-w-0 flex-1 truncate">{<AdminText text={item.label} />}</span>}
                      {expanded && isActive && (
                        <span className="h-1 w-1 flex-shrink-0 rounded-full bg-sidebar-primary" />
                      )}
                    </Link>
                  )

                  if (!expanded) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {<AdminText text={item.label} />}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return <div key={item.href}>{linkContent}</div>
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-2">
          <LanguageToggle variant="icon" onOpenChange={setLanguageMenuOpen} className="mb-2" />
          {!expanded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  aria-label={adminLabel("Back to Dashboard", locale)}
                  title={adminLabel("Back to Dashboard", locale)}
                  className="lmm-nav-return flex items-center justify-center rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}> <AdminText text={"Back to Dashboard"} /> </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
                  aria-label={adminLabel("Back to Dashboard", locale)}
                  title={adminLabel("Back to Dashboard", locale)}
              className="lmm-nav-return flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <ArrowLeft className="h-5 w-5" /> <AdminText text={"Back to Dashboard"} /> </Link>
          )}
        </div>
      </div>
    </aside>
  )
}
