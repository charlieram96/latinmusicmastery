import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  // Build pagination query string
  const paginationParams = new URLSearchParams()
  if (search) paginationParams.set('search', search)
  if (status !== 'all') paginationParams.set('status', status)
  if (plan !== 'all') paginationParams.set('plan', plan)
  const baseQuery = paginationParams.toString()

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">
          Manage users, assign roles, and link teacher accounts
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <CreditCard className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscribers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.instrumentCount} instrument, {stats.allAccessCount} all-access
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Free Users</CardTitle>
            <UserX className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.freeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.mrr)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <UserFilters />
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Users
          </CardTitle>
          <CardDescription>
            {total || 0} total user{(total || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user: any) => {
                const activeSubs = (user.subscriptions || []).filter((s: any) => s.status === 'active')
                return (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url} alt={user.full_name} />
                        <AvatarFallback>
                          {user.email?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name || 'No name'}</span>
                          {user.is_admin && (
                            <Badge variant="destructive" className="h-5">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {user.teachers && user.teachers.length > 0 && (
                            <Badge variant="secondary" className="h-5">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              Teacher
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        {activeSubs.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex gap-1 flex-wrap justify-end">
                              {activeSubs.map((sub: any) => (
                                <Badge key={sub.id} variant="default" className="text-xs">
                                  {sub.plan_type === 'all_access' ? 'All-Access' : sub.plan_type === 'instrument' ? sub.instrument || 'Instrument' : sub.plan_type}
                                </Badge>
                              ))}
                            </div>
                            {activeSubs[0]?.current_period_end && (
                              <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                                <CalendarClock className="w-3 h-3" />
                                Renews {new Date(activeSubs[0].current_period_end).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">Free</Badge>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${baseQuery}${baseQuery ? '&' : ''}page=${page - 1}`}>
                    Previous
                  </Link>
                </Button>
              )}
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${baseQuery}${baseQuery ? '&' : ''}page=${page + 1}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
