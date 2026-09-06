import { createClient } from '@/lib/supabase/server'
import { MobileSidebarTrigger } from '@/components/dashboard/mobile-sidebar-trigger'
import { HeaderTitle } from '@/components/dashboard/header-title'
import { HeaderSearch } from '@/components/dashboard/header-search'
import { HeaderStreak } from '@/components/dashboard/header-streak-server'
import { HeaderNotifications } from '@/components/dashboard/header-notifications-server'
import { DashboardHeaderWrapper } from '@/components/dashboard/dashboard-header-wrapper'
import { AccountMenu } from '@/components/dashboard/account-menu'

/**
 * Contextual header: where you are on the left; search, streak, notifications
 * and the account on the right. Theme and language live in the rail footer.
 */
export async function DashboardHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, { data: teacherProfile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('is_admin, email, full_name, avatar_url').eq('id', user.id).single(),
    supabase.from('teachers').select('id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('instrument_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <DashboardHeaderWrapper>
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <MobileSidebarTrigger />
        <HeaderTitle />

        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch />
          <HeaderStreak userId={user.id} />
          <HeaderNotifications userId={user.id} />
          <AccountMenu
            name={profile?.full_name || ''}
            email={user.email || profile?.email || ''}
            avatarUrl={profile?.avatar_url ?? null}
            hasSubscription={!!subscription}
            isAdmin={profile?.is_admin || false}
            isTeacher={!!teacherProfile}
          />
        </div>
      </div>
    </DashboardHeaderWrapper>
  )
}
