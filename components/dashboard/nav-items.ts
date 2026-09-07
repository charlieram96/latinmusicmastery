import {
  Award,
  AudioWaveform,
  BookOpen,
  Crown,
  Drum,
  GraduationCap,
  Home,
  Library,
  Shield,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

export type NavGroupKey = 'learn' | 'discover' | 'connect' | 'tools' | 'manage'

export interface NavItemDef {
  /** Key under `dashboard.nav`. */
  labelKey: string
  href: string
  icon: LucideIcon
  /** Extra route prefixes that should light this item up. */
  activePrefixes?: string[]
}

export interface NavGroup {
  key: NavGroupKey
  items: NavItemDef[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'learn',
    items: [
      { labelKey: 'home', href: '/dashboard', icon: Home },
      {
        labelKey: 'myCourses',
        href: '/dashboard/my-courses',
        icon: BookOpen,
        activePrefixes: ['/dashboard/course', '/dashboard/modules'],
      },
      { labelKey: 'progress', href: '/dashboard/progress', icon: TrendingUp },
    ],
  },
  {
    key: 'discover',
    items: [
      { labelKey: 'browseCourses', href: '/dashboard/courses', icon: Library },
      { labelKey: 'teachers', href: '/dashboard/teachers', icon: GraduationCap },
      { labelKey: 'masterClass', href: '/dashboard/master-class', icon: Crown },
      { labelKey: 'achievements', href: '/dashboard/achievements', icon: Award },
    ],
  },
  {
    key: 'connect',
    items: [
      { labelKey: 'teacherFeedback', href: '/dashboard/feedback', icon: Video },
      { labelKey: 'community', href: '/dashboard/community', icon: Users },
    ],
  },
  {
    key: 'tools',
    items: [
      { labelKey: 'tuner', href: '/dashboard/tuner', icon: AudioWaveform },
      { labelKey: 'playSense', href: '/dashboard/play-sense', icon: Drum },
    ],
  },
]

/** Role-gated group; empty for regular learners. */
export function manageItems(isTeacher: boolean, isAdmin: boolean): NavItemDef[] {
  const items: NavItemDef[] = []
  if (isTeacher) items.push({ labelKey: 'teacherPortal', href: '/teacher', icon: GraduationCap })
  if (isAdmin) items.push({ labelKey: 'adminPanel', href: '/admin', icon: Shield })
  return items
}

export function navGroups(isTeacher: boolean, isAdmin: boolean): NavGroup[] {
  const manage = manageItems(isTeacher, isAdmin)
  return manage.length ? [...NAV_GROUPS, { key: 'manage', items: manage }] : NAV_GROUPS
}

export function isNavActive(pathname: string, item: NavItemDef): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/'
  const prefixes = [item.href, ...(item.activePrefixes ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Bottom tab bar on phones. */
export const TAB_ITEMS: { labelKey: string; href: string; icon: LucideIcon; activePrefixes?: string[] }[] = [
  { labelKey: 'home', href: '/dashboard', icon: Home },
  { labelKey: 'courses', href: '/dashboard/courses', icon: Library, activePrefixes: ['/dashboard/my-courses'] },
  { labelKey: 'practice', href: '/dashboard/play-sense', icon: Drum, activePrefixes: ['/dashboard/tuner'] },
  { labelKey: 'profile', href: '/dashboard/settings', icon: Users, activePrefixes: ['/dashboard/subscription', '/dashboard/progress'] },
]
