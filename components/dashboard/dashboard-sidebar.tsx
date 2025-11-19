'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  BookOpen,
  Library,
  GraduationCap,
  TrendingUp,
  CreditCard,
  Award,
  HelpCircle,
  Settings,
  Shield,
} from 'lucide-react'
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
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface DashboardSidebarProps {
  isAdmin?: boolean
}

const mainNavItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'My Courses',
    href: '/dashboard/my-courses',
    icon: BookOpen,
  },
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
    title: 'My Progress',
    href: '/dashboard/progress',
    icon: TrendingUp,
  },
  {
    title: 'My Subscription',
    href: '/dashboard/subscription',
    icon: CreditCard,
  },
  {
    title: 'Achievements',
    href: '/dashboard/achievements',
    icon: Award,
  },
]

const bottomNavItems = [
  {
    title: 'Help & Support',
    href: '/dashboard/help',
    icon: HelpCircle,
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export function DashboardSidebar({ isAdmin = false }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar className="group/sidebar bg-white border-r pt-[50px] w-[55px] hover:w-[220px] transition-[width] duration-300 ease-in-out md:block">
      <SidebarContent className="gap-0">
        {/* Main Navigation */}
        <SidebarGroup className="px-3 py-5">
          <SidebarGroupLabel className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-9 px-2 gap-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 justify-start",
                        isActive && "bg-gray-100 dark:bg-gray-800 text-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Panel - Only for admins */}
        {isAdmin && (
          <SidebarGroup className="px-3 py-5 mt-2">
            <SidebarGroupLabel className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/admin')}
                    className={cn(
                      "h-9 px-2 gap-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 justify-start",
                      pathname.startsWith('/admin') && "bg-gray-100 dark:bg-gray-800 text-foreground"
                    )}
                  >
                    <Link href="/admin">
                      <Shield className="h-[18px] w-[18px] flex-shrink-0" />
                      <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer Navigation */}
      <SidebarFooter className="px-3 py-4 border-t">
        <SidebarMenu className="gap-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={cn(
                    "h-9 px-2 gap-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 justify-start",
                    isActive && "bg-gray-100 dark:bg-gray-800 text-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="text-sm opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
