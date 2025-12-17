import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, MessageSquare, User, ArrowLeft } from 'lucide-react'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is a teacher
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!teacher) {
    redirect('/dashboard')
  }

  const navItems = [
    { href: '/teacher', label: 'Dashboard', icon: Home },
    { href: '/teacher/feedback', label: 'Feedback Requests', icon: MessageSquare },
    { href: '/teacher/profile', label: 'My Profile', icon: User },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="sticky top-0 flex flex-col h-screen">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold">Teacher Portal</h2>
            <p className="text-sm text-muted-foreground mt-1">{teacher.name}</p>
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
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
