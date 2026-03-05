import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminSidebarClient } from '@/components/admin/admin-sidebar-client'

export default async function AdminLayout({
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

  if (!profile?.is_admin) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <AdminHeader />

      <div className="flex">
        {/* Desktop Sidebar */}
        <AdminSidebarClient />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
