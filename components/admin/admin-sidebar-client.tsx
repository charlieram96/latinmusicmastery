'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Globe, Music, BookOpen, Users, GraduationCap, BarChart3,
  MessageSquare, DollarSign, Drum, ChevronLeft, ChevronRight,
  LayoutDashboard, Guitar, ArrowLeft, Mail, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/financials', label: 'Financials', icon: DollarSign },
  { href: '/admin/pricing', label: 'Pricing', icon: Tag },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/admin/countries', label: 'Countries', icon: Globe },
  { href: '/admin/styles', label: 'Musical Styles', icon: Music },
  { href: '/admin/instruments', label: 'Instruments', icon: Guitar },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
  { href: '/admin/play-sense', label: 'Play Sense', icon: Drum },
  { href: '/admin/waitlist', label: 'Waitlist', icon: Mail },
]

const STORAGE_KEY = 'admin-sidebar-collapsed'

export function AdminSidebarClient() {
  const pathname = usePathname()
  // The PlaySense Studio is an immersive editor — collapse the dashboard to an
  // icon rail there so it stays out of the way (overrides the stored preference).
  const onStudioRoute = pathname.startsWith('/admin/playsense-studio')

  const [storedCollapsed, setStoredCollapsed] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setStoredCollapsed(stored === 'true')
    }
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = !storedCollapsed
    setStoredCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  if (!mounted) return null

  const collapsed = onStudioRoute ? true : storedCollapsed
  // Show full labels when not collapsed, or while hovering the collapsed rail.
  const expanded = !collapsed || hovering
  // When the collapsed rail is hovered, float the full panel OVER the content so
  // the page never shifts; the in-flow <aside> keeps the rail's 64px footprint.
  const overlay = collapsed && hovering

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'relative hidden md:block h-screen sticky top-0 flex-shrink-0',
        collapsed ? 'w-16' : 'w-[206px]'
      )}
    >
      <div
        className={cn(
          'flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-200',
          expanded ? 'w-[206px]' : 'w-16',
          overlay && 'absolute top-0 left-0 z-40 shadow-xl'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center border-b border-sidebar-border flex-shrink-0', expanded ? 'h-14 px-5' : 'h-14 justify-center px-0')}>
          {expanded ? (
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-sidebar-primary flex-shrink-0" />
              <span className="text-sm font-bold tracking-wide text-sidebar-foreground">Admin Panel</span>
            </div>
          ) : (
            <LayoutDashboard className="w-4 h-4 text-sidebar-primary" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors relative group',
                  isActive
                    ? 'bg-sidebar-primary/10 text-sidebar-primary border-l-2 border-sidebar-primary pl-[9px]'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  !expanded && 'justify-center px-0 border-l-0 pl-0',
                  !expanded && isActive && 'text-sidebar-primary bg-sidebar-primary/10'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {expanded && item.label}
              </Link>
            )

            if (!expanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.href}>{linkContent}</div>
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-1 flex-shrink-0">
          {!expanded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center rounded-lg p-2 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Back to Dashboard
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
          )}

          {/* Toggle button — hidden in the Studio, where the rail is route-forced. */}
          {!onStudioRoute && (
            <button
              onClick={toggle}
              className={cn(
                'flex items-center rounded-lg p-2 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full',
                expanded ? 'gap-2 px-2.5' : 'justify-center'
              )}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {!expanded ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
