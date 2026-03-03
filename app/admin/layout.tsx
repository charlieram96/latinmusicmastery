import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, Globe, Music, BookOpen, Users, GraduationCap, BarChart3, MessageSquare, Drum, DollarSign } from 'lucide-react'
import { AdminHeader } from '@/components/admin/admin-header'

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

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/financials', label: 'Financials', icon: DollarSign },
    { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
    { href: '/admin/countries', label: 'Countries', icon: Globe },
    { href: '/admin/styles', label: 'Musical Styles', icon: Music },
    { href: '/admin/courses', label: 'Courses', icon: BookOpen },
    { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
    { href: '/admin/play-sense', label: 'Play Sense', icon: Drum },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <AdminHeader />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r bg-card flex-shrink-0">
          <div className="sticky top-0 flex flex-col h-screen w-full">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold">Admin Panel</h2>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-4 border-t">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
