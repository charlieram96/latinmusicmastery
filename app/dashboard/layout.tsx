import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'

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
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "55px",
          "--sidebar-width-mobile": "0px",
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <DashboardSidebar isAdmin={profile?.is_admin || false} />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <DashboardHeader />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto pt-[50px]">
            <div className="container mx-auto p-6 max-w-[1440px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
