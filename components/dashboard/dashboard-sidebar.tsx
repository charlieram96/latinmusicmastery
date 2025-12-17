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
  Settings,
  Shield,
  User,
  Video,
  Users,
  CreditCard,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface DashboardSidebarProps {
  isAdmin?: boolean
  isTeacher?: boolean
  userEmail?: string
  userName?: string
  userAvatar?: string
}

// Section 1: Personal
const personalNavItems = [
  {
    title: 'Home',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'My Courses',
    href: '/dashboard/my-courses',
    icon: BookOpen,
  },
]

// Section 2: Discover
const discoverNavItems = [
  {
    title: 'Browse Courses',
    href: '/dashboard/courses',
    icon: Library,
  },
  {
    title: 'Teachers',
    href: '/dashboard/teachers',
    icon: GraduationCap,
  },
  {
    title: 'Achievements',
    href: '/dashboard/achievements',
    icon: Award,
  },
]

// Section 3: Connect
const connectNavItems = [
  {
    title: 'Teacher Feedback',
    href: '/dashboard/feedback',
    icon: Video,
  },
  {
    title: 'Community',
    href: '/dashboard/community',
    icon: Users,
  },
]

// Section 4: Settings
const settingsNavItems = [
  {
    title: 'Subscription',
    href: '/dashboard/subscription',
    icon: CreditCard,
  },
]


export function DashboardSidebar({
  isAdmin = false,
  isTeacher = false,
  userEmail = '',
  userName = '',
  userAvatar = ''
}: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="none" className="fixed inset-y-0 left-0 z-50 bg-sidebar border-r w-[241px] hidden md:flex p-[20px] pt-0">
      {/* Logo */}
      <SidebarHeader className="h-[55px] flex items-center justify-center mx-[-20px] bg-sidebar">
        <Link href="/dashboard">
          <Image
            src="/large-color-logo.svg"
            alt="Latin Music Mastery"
            width={150}
            height={30}
            className="h-[30px] w-auto mt-[5px]"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Section 1: Personal */}
        <SidebarGroup className="px-0 py-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {personalNavItems.map((item) => {
                const Icon = item.icon
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        isActive && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-0 bg-border/50" />

        {/* Section 2: Discover */}
        <SidebarGroup className="px-0 py-4">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Discover
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {discoverNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        isActive && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-0 bg-border/50" />

        {/* Section 3: Connect */}
        <SidebarGroup className="px-0 py-4">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Connect
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {connectNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        isActive && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-0 bg-border/50" />

        {/* Section 4: Settings */}
        <SidebarGroup className="px-0 py-4">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {settingsNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        isActive && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Teacher Portal - Only for teachers */}
        {isTeacher && (
          <>
            <SidebarSeparator className="mx-0 bg-border/50" />
            <SidebarGroup className="px-0 py-4">
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Teacher
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith('/teacher')}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        pathname.startsWith('/teacher') && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href="/teacher">
                        <GraduationCap className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">Teacher Portal</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Admin Panel - Only for admins */}
        {isAdmin && (
          <>
            <SidebarSeparator className="mx-0 bg-border/50" />
            <SidebarGroup className="px-0 py-4">
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith('/admin')}
                      className={cn(
                        "h-10 px-3 gap-3 font-medium hover:bg-secondary justify-start",
                        pathname.startsWith('/admin') && "bg-secondary text-foreground"
                      )}
                    >
                      <Link href="/admin">
                        <Shield className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm">Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Profile Section */}
      <SidebarFooter className="mt-auto pt-4 mx-[-20px] px-[20px]">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-secondary transition-colors group"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={userAvatar} alt={userName || 'User'} />
            <AvatarFallback className="bg-primary text-white text-sm font-semibold">
              {userEmail?.split('@')[0].slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 text-sm font-medium truncate">
            {userName || 'My Account'}
          </span>
          <Settings className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
