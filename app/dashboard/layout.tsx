import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client'
import { MobileNavSheet, MobileTabBar } from '@/components/dashboard/mobile-nav'
import { SidebarStateProvider } from '@/components/dashboard/sidebar-state'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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

  const navProps = {
    isAdmin: profile?.is_admin || false,
    isTeacher: !!teacherProfile,
    userEmail: user.email || profile?.email || '',
    userName: profile?.full_name || '',
    userAvatar: profile?.avatar_url ?? null,
    hasSubscription: !!subscription,
  }

  return (
    <SidebarStateProvider>
      <DashboardLayoutClient
        sidebar={<DashboardSidebar {...navProps} />}
        header={<DashboardHeader />}
        mobileNav={
          <>
            <MobileNavSheet {...navProps} />
            <MobileTabBar />
          </>
        }
      >
        {children}
      </DashboardLayoutClient>
    </SidebarStateProvider>
  )
}
