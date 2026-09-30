'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Menu, Home, Globe, Music, BookOpen, Users, GraduationCap, BarChart3, MessageSquare, DollarSign, Drum, Guitar, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
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
]

export function AdminMobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="lmm-admin-navigation w-[280px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Admin Panel</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="lmm-nav-return flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground"
          >
            <ArrowLeft className="h-5 w-5"/> Back to Dashboard
          </Link>
        </div>
      </SheetContent>
      </Sheet>
    </>
  )
}
