import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email, full_name')
    .eq('id', user.id)
    .single()

  // Check if user is a teacher
  const { data: teacherProfile } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const isTeacher = !!teacherProfile

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "240px",
          "--sidebar-width-mobile": "0px",
        } as React.CSSProperties
      }
    >
      <DashboardLayoutClient
        sidebar={
          <DashboardSidebar
            isAdmin={profile?.is_admin || false}
            isTeacher={isTeacher}
            userEmail={user.email || profile?.email || ''}
            userName={profile?.full_name || ''}
          />
        }
        header={<DashboardHeader />}
      >
        {children}
      </DashboardLayoutClient>
    </SidebarProvider>
  )
}
