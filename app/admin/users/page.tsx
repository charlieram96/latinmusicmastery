import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, Shield, GraduationCap, ChevronRight, CreditCard, DollarSign, UserX, CalendarClock } from 'lucide-react'
import { getUsers, getUserStats } from '@/app/actions/admin'
import { formatCurrency } from '@/lib/pricing'
import { UserFilters } from '@/components/admin/user-filters'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; status?: string; plan?: string }>
}) {
  const params = await searchParams
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const status = (params.status || 'all') as 'all' | 'subscribed' | 'free'
  const plan = (params.plan || 'all') as 'all' | 'instrument' | 'all_access'
  const limit = 20
  const offset = (page - 1) * limit

  const [{ users, total }, stats] = await Promise.all([
    getUsers({
      search: search || undefined,
      subscriptionStatus: status,
      planType: plan,
      limit,
      offset,
    }),
    getUserStats(),
  ])

  const totalPages = Math.ceil((total || 0) / limit)

  const paginationParams = new URLSearchParams()
  if (search) paginationParams.set('search', search)
  if (status !== 'all') paginationParams.set('status', status)
  if (plan !== 'all') paginationParams.set('plan', plan)
  const baseQuery = paginationParams.toString()

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Subscribers', value: stats.totalSubscribers, icon: CreditCard, color: 'text-green-500', bg: 'bg-green-500/10', sub: `${stats.instrumentCount} instrument · ${stats.allAccessCount} all-access` },
    { label: 'Free Users', value: stats.freeUsers, icon: UserX, color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
    { label: 'MRR', value: formatCurrency(stats.mrr), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-1">Users</h1>
        <p className="text-muted-foreground">Manage users, assign roles, and link teacher accounts</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border bg-card p-5">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${s.bg} mb-3`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-3xl font-bold mb-0.5">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
              {s.sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</div>}
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <UserFilters />
      </div>

      {/* Users List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <h2 className="font-bold">Users</h2>
          </div>
          <span className="text-sm text-muted-foreground">{total || 0} total</span>
        </div>

        {users && users.length > 0 ? (
          <div className="divide-y">
            {users.map((user: any) => {
              const activeSubs = (user.subscriptions || []).filter((s: any) => s.status === 'active')
              return (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url} alt={user.full_name} />
                      <AvatarFallback className="text-xs">
                        {user.email?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">{user.full_name || 'No name'}</span>
                        {user.is_admin && (
                          <Badge variant="destructive" className="h-4 text-[10px] px-1">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        )}
                        {user.teachers && user.teachers.length > 0 && (
                          <Badge variant="secondary" className="h-4 text-[10px] px-1">
                            <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                            Teacher
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      {activeSubs.length > 0 ? (
                        <div className="space-y-0.5">
                          <div className="flex gap-1 flex-wrap justify-end">
                            {activeSubs.map((sub: any) => (
                              <Badge key={sub.id} variant="default" className="text-xs h-5">
                                {sub.plan_type === 'all_access' ? 'All-Access' : sub.instrument || 'Instrument'}
                              </Badge>
                            ))}
                          </div>
                          {activeSubs[0]?.current_period_end && (
                            <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                              <CalendarClock className="w-3 h-3" />
                              {new Date(activeSubs[0].current_period_end).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">Free</Badge>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No users found</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${baseQuery}${baseQuery ? '&' : ''}page=${page - 1}`}>
                    Previous
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${baseQuery}${baseQuery ? '&' : ''}page=${page + 1}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
