import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { UserNav } from '@/components/user-nav'
import { Button } from '@/components/ui/button'
import { MobileSidebarTrigger } from '@/components/dashboard/mobile-sidebar-trigger'
import { HeaderSearch } from '@/components/dashboard/header-search'
import { HeaderStreak } from '@/components/dashboard/header-streak-server'
import { HeaderContinue } from '@/components/dashboard/header-continue-server'
import { DashboardHeaderWrapper } from '@/components/dashboard/dashboard-header-wrapper'

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
      <div className="flex h-[50px] items-center px-6 gap-4">
        {/* Mobile Menu Toggle */}
        <MobileSidebarTrigger />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side items */}
        <div className="flex items-center gap-3">
          {/* Continue Learning */}
          <HeaderContinue userId={user.id} />

          {/* Learning Streak */}
          <HeaderStreak userId={user.id} />

          {/* Help Button */}
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/20 hover:text-primary" asChild>
            <Link href="/dashboard/help">
              <HelpCircle className="h-5 w-5" />
            </Link>
          </Button>

          {/* Search Bar */}
          <HeaderSearch />

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
