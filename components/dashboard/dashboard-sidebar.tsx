'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  BookOpen,
  Library,
  GraduationCap,
  Award,
  AudioWaveform,
  Crown,
  Settings,
  Shield,
  Video,
  Users,
  CreditCard,
  Drum,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface DashboardSidebarProps {
  isAdmin?: boolean
  isTeacher?: boolean
  userEmail?: string
  userName?: string
  userAvatar?: string
}

const personalNavItems = [
  { title: 'Home', href: '/dashboard', icon: Home },
  { title: 'My Courses', href: '/dashboard/my-courses', icon: BookOpen },
]

const discoverNavItems = [
  { title: 'Browse Courses', href: '/dashboard/courses', icon: Library },
  { title: 'Teachers', href: '/dashboard/teachers', icon: GraduationCap },
  { title: 'Master Class', href: '/dashboard/master-class', icon: Crown },
  { title: 'Achievements', href: '/dashboard/achievements', icon: Award },
]

const connectNavItems = [
  { title: 'Teacher Feedback', href: '/dashboard/feedback', icon: Video },
  { title: 'Community', href: '/dashboard/community', icon: Users },
]

const toolsNavItems = [
  { title: 'Tuner', href: '/dashboard/tuner', icon: AudioWaveform },
  { title: 'Play Sense', href: '/dashboard/play-sense', icon: Drum },
]

const settingsNavItems = [
  { title: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
]

function NavItem({ item, pathname }: { item: { title: string; href: string; icon: React.ComponentType<{ className?: string }> }; pathname: string }) {
  const Icon = item.icon
  const isActive = item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[12px] w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <Icon className="h-[18px] w-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  )
}

function NavSection({ items, pathname }: { items: typeof personalNavItems; pathname: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {items.map((item) => (
        <NavItem key={item.href} item={item} pathname={pathname} />
      ))}
    </div>
  )
}

function Separator() {
  return <div className="w-8 h-px bg-border mx-auto" />
}

export function DashboardSidebar({
  isAdmin = false,
  isTeacher = false,
  userEmail = '',
  userName = '',
  userAvatar = ''
}: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-y-0 left-0 z-50 w-16 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col items-center py-4 gap-4">
      {/* Logo */}
      <Link href="/dashboard" className="mb-2">
        <Image
          src="/logo-solo-color.svg"
          alt="Latin Music Mastery"
          width={28}
          height={28}
          className="h-7 w-7"
        />
      </Link>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <NavSection items={personalNavItems} pathname={pathname} />
        <Separator />
        <NavSection items={discoverNavItems} pathname={pathname} />
        <Separator />
        <NavSection items={connectNavItems} pathname={pathname} />
        <Separator />
        <NavSection items={toolsNavItems} pathname={pathname} />
        <Separator />
        <NavSection items={settingsNavItems} pathname={pathname} />

        {isTeacher && (
          <>
            <Separator />
            <div className="flex flex-col items-center gap-1">
              <NavItem
                item={{ title: 'Teacher Portal', href: '/teacher', icon: GraduationCap }}
                pathname={pathname}
              />
            </div>
          </>
        )}

        {isAdmin && (
          <>
            <Separator />
            <div className="flex flex-col items-center gap-1">
              <NavItem
                item={{ title: 'Admin Panel', href: '/admin', icon: Shield }}
                pathname={pathname}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer — Avatar only */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/dashboard/settings"
            className="mt-auto flex items-center justify-center"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={userAvatar} alt={userName || 'User'} />
              <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                {userEmail?.split('@')[0].slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          Settings
        </TooltipContent>
      </Tooltip>
    </nav>
  )
}
