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
  Shield,
  Video,
  Users,
  CreditCard,
  Drum,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { LanguageToggle } from '@/components/language-toggle'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

interface DashboardSidebarProps {
  isAdmin?: boolean
  isTeacher?: boolean
  userEmail?: string
  userName?: string
  userAvatar?: string
}

type NavKey =
  | 'home'
  | 'myCourses'
  | 'browseCourses'
  | 'teachers'
  | 'masterClass'
  | 'achievements'
  | 'teacherFeedback'
  | 'community'
  | 'tuner'
  | 'playSense'
  | 'subscription'
  | 'teacherPortal'
  | 'adminPanel'

interface NavItemDef {
  labelKey: NavKey
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const personalNavItems: NavItemDef[] = [
  { labelKey: 'home', href: '/dashboard', icon: Home },
  { labelKey: 'myCourses', href: '/dashboard/my-courses', icon: BookOpen },
]

const discoverNavItems: NavItemDef[] = [
  { labelKey: 'browseCourses', href: '/dashboard/courses', icon: Library },
  { labelKey: 'teachers', href: '/dashboard/teachers', icon: GraduationCap },
  { labelKey: 'masterClass', href: '/dashboard/master-class', icon: Crown },
  { labelKey: 'achievements', href: '/dashboard/achievements', icon: Award },
]

const connectNavItems: NavItemDef[] = [
  { labelKey: 'teacherFeedback', href: '/dashboard/feedback', icon: Video },
  { labelKey: 'community', href: '/dashboard/community', icon: Users },
]

const toolsNavItems: NavItemDef[] = [
  { labelKey: 'tuner', href: '/dashboard/tuner', icon: AudioWaveform },
  { labelKey: 'playSense', href: '/dashboard/play-sense', icon: Drum },
]

const settingsNavItems: NavItemDef[] = [
  { labelKey: 'subscription', href: '/dashboard/subscription', icon: CreditCard },
]

function NavItem({ item, pathname, label }: { item: NavItemDef; pathname: string; label: string }) {
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
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NavSection({
  items,
  pathname,
  t,
}: {
  items: NavItemDef[]
  pathname: string
  t: (key: string) => string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {items.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          pathname={pathname}
          label={t(`dashboard.nav.${item.labelKey}`)}
        />
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
  const { t } = useTranslation()

  return (
    <nav className="fixed inset-y-0 left-0 z-50 w-16 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col items-center py-4 gap-4">
      {/* Logo */}
      <Link href="/" className="mb-2">
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
        <NavSection items={personalNavItems} pathname={pathname} t={t} />
        <Separator />
        <NavSection items={discoverNavItems} pathname={pathname} t={t} />
        <Separator />
        <NavSection items={connectNavItems} pathname={pathname} t={t} />
        <Separator />
        <NavSection items={toolsNavItems} pathname={pathname} t={t} />
        <Separator />
        <NavSection items={settingsNavItems} pathname={pathname} t={t} />

        {isTeacher && (
          <>
            <Separator />
            <div className="flex flex-col items-center gap-1">
              <NavItem
                item={{ labelKey: 'teacherPortal', href: '/teacher', icon: GraduationCap }}
                pathname={pathname}
                label={t('dashboard.nav.teacherPortal')}
              />
            </div>
          </>
        )}

        {isAdmin && (
          <>
            <Separator />
            <div className="flex flex-col items-center gap-1">
              <NavItem
                item={{ labelKey: 'adminPanel', href: '/admin', icon: Shield }}
                pathname={pathname}
                label={t('dashboard.nav.adminPanel')}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer — Language toggle + Avatar */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <LanguageToggle variant="icon" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-center"
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
            {t('dashboard.nav.settings')}
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  )
}
