'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Globe, Music, BookOpen, Users, GraduationCap, BarChart3,
  MessageSquare, DollarSign, Drum, ChevronLeft, ChevronRight,
  LayoutDashboard, Guitar, ArrowLeft,
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
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/admin/countries', label: 'Countries', icon: Globe },
  { href: '/admin/styles', label: 'Musical Styles', icon: Music },
  { href: '/admin/instruments', label: 'Instruments', icon: Guitar },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
  { href: '/admin/play-sense', label: 'Play Sense', icon: Drum },
]

const STORAGE_KEY = 'admin-sidebar-collapsed'

export function AdminSidebarClient() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  if (!mounted) return null

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 bg-zinc-900 text-zinc-100 flex-shrink-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center border-b border-zinc-800 flex-shrink-0', collapsed ? 'h-14 justify-center px-0' : 'h-14 px-5')}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm font-bold tracking-wide text-white">Admin Panel</span>
          </div>
        )}
        {collapsed && <LayoutDashboard className="w-4 h-4 text-amber-400" />}
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
                  ? 'bg-amber-400/10 text-amber-400 border-l-2 border-amber-400 pl-[9px]'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                collapsed && 'justify-center px-0 border-l-0 pl-0',
                collapsed && isActive && 'text-amber-400 bg-amber-400/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          )

          if (collapsed) {
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
      <div className="border-t border-zinc-800 p-2 space-y-1 flex-shrink-0">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-lg p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
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
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          className={cn(
            'flex items-center rounded-lg p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors w-full',
            collapsed ? 'justify-center' : 'gap-2 px-2.5'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
