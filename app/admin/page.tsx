import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import {
  Globe, Music, BookOpen, Users, DollarSign, CreditCard,
  BarChart3, GraduationCap, Drum, Guitar, Dumbbell, ArrowRight,
} from 'lucide-react'
import { getUserStats } from '@/app/actions/admin'
import { formatCurrency } from '@/lib/pricing'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: countriesCount },
    { count: stylesCount },
    { count: coursesCount },
    { count: exercisesCount },
    stats,
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('musical_styles').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('exercises').select('*', { count: 'exact', head: true }),
    getUserStats(),
    supabase
      .from('profiles')
      .select('*, subscriptions(status, plan_type, instrument)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const heroStats = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      href: '/admin/users',
    },
    {
      label: 'Active Subscribers',
      value: stats.totalSubscribers,
      icon: CreditCard,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      href: '/admin/users?status=subscribed',
    },
    {
      label: 'MRR',
      value: formatCurrency(stats.mrr),
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      href: '/admin/financials',
    },
    {
      label: 'Courses',
      value: coursesCount || 0,
      icon: BookOpen,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      href: '/admin/courses',
    },
  ]

  const quickLinks = [
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, description: 'Growth & engagement' },
    { href: '/admin/financials', label: 'Financials', icon: DollarSign, description: 'Revenue & billing' },
    { href: '/admin/feedback', label: 'Feedback', icon: GraduationCap, description: 'Student requests' },
    { href: '/admin/countries', label: 'Countries', icon: Globe, description: `${countriesCount || 0} countries` },
    { href: '/admin/styles', label: 'Musical Styles', icon: Music, description: `${stylesCount || 0} styles` },
    { href: '/admin/instruments', label: 'Instruments', icon: Guitar, description: 'Link styles & countries' },
    { href: '/admin/play-sense', label: 'Play Sense', icon: Drum, description: 'Percussion exercises' },
    { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap, description: 'Manage instructors' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Latin Music Mastery platform overview</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {heroStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${stat.bg} mb-3`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold mb-0.5">{stat.value}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                {stat.label}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Users */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-bold text-lg">Recent Users</h2>
            <Link href="/admin/users" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {recentUsers && recentUsers.length > 0 ? (
              recentUsers.map((user: any) => {
                const activeSubs = (user.subscriptions || []).filter((s: any) => s.status === 'active')
                return (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{user.full_name || 'No name'}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSubs.length > 0 ? (
                        <Badge variant="default" className="text-xs">
                          {activeSubs[0]?.plan_type === 'all_access' ? 'All-Access' : activeSubs[0]?.instrument || 'Subscriber'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Free</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm">No users yet</div>
            )}
          </div>
        </div>

        {/* Platform Health + Quick Links */}
        <div className="space-y-4">
          {/* Platform Health */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-lg mb-4">Platform Health</h2>
            <div className="space-y-3">
              {[
                { label: 'Countries', value: countriesCount || 0, icon: Globe },
                { label: 'Musical Styles', value: stylesCount || 0, icon: Music },
                { label: 'Courses', value: coursesCount || 0, icon: BookOpen },
                { label: 'Exercises', value: exercisesCount || 0, icon: Dumbbell },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  <span className="font-bold text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-lg mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.slice(0, 6).map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
