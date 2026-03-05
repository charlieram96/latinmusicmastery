import { createClient } from '@/lib/supabase/server'
import { UserNav } from '@/components/user-nav'
import { MobileSidebarTrigger } from '@/components/dashboard/mobile-sidebar-trigger'
import { HeaderSearch } from '@/components/dashboard/header-search'
import { HeaderStreak } from '@/components/dashboard/header-streak-server'
import { HeaderContinue } from '@/components/dashboard/header-continue-server'
import { HeaderNotifications } from '@/components/dashboard/header-notifications-server'
import { DashboardHeaderWrapper } from '@/components/dashboard/dashboard-header-wrapper'
import { ThemeToggle } from '@/components/theme-toggle'

export async function DashboardHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email, full_name')
    .eq('id', user.id)
    .single()


  return (
    <DashboardHeaderWrapper>
      <div className="flex h-14 items-center px-6 gap-4">
        {/* Mobile Menu Toggle */}
        <MobileSidebarTrigger />

        <p className="hidden md:flex text-sm font-medium text-foreground flex-1">
          Welcome to Latin Music Mastery
        </p>
        <div className="flex-1 md:hidden" />

        {/* Right side items */}
        <div className="flex items-center gap-3">
          {/* Continue Learning */}
          <HeaderContinue userId={user.id} />

          {/* Notifications */}
          <HeaderNotifications userId={user.id} />

          {/* Learning Streak */}
          <HeaderStreak userId={user.id} />

          {/* Search Bar */}
          <HeaderSearch />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Dropdown */}
          <UserNav
            user={user}
            isAdmin={profile?.is_admin || false}
          />
        </div>
      </div>
    </DashboardHeaderWrapper>
  )
}
