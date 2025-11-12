import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe, Music, BookOpen, FileText, Dumbbell, Users } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get counts for all entities
  const [
    { count: countriesCount },
    { count: stylesCount },
    { count: coursesCount },
    { count: lessonsCount },
    { count: exercisesCount },
    { count: usersCount },
  ] = await Promise.all([
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('musical_styles').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('exercises').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  // Get active subscriptions count
  const { count: activeSubscriptionsCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Get recent users
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    {
      title: 'Countries',
      value: countriesCount || 0,
      icon: Globe,
      href: '/admin/countries',
      description: 'Total countries',
    },
    {
      title: 'Musical Styles',
      value: stylesCount || 0,
      icon: Music,
      href: '/admin/styles',
      description: 'Total styles',
    },
    {
      title: 'Courses',
      value: coursesCount || 0,
      icon: BookOpen,
      href: '/admin/courses',
      description: 'Total courses',
    },
    {
      title: 'Lessons',
      value: lessonsCount || 0,
      icon: FileText,
      href: '/admin/lessons',
      description: 'Total lessons',
    },
    {
      title: 'Exercises',
      value: exercisesCount || 0,
      icon: Dumbbell,
      href: '/admin/exercises',
      description: 'Total exercises',
    },
    {
      title: 'Users',
      value: usersCount || 0,
      icon: Users,
      href: '/admin/users',
      description: 'Total registered users',
    },
  ]

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your Latin Music Mastery platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>Active paid subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeSubscriptionsCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Estimate</CardTitle>
            <CardDescription>Monthly recurring revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${((activeSubscriptionsCount || 0) * 29).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>Latest registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUsers && recentUsers.length > 0 ? (
              recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{user.full_name || 'No name'}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No users yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
