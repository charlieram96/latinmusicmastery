import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  XCircle,
  Clock,
  BarChart3,
} from 'lucide-react'
import { getFinancials } from '@/app/actions/admin'
import { formatCurrency, PLAN_PRICES } from '@/lib/pricing'

export default async function AdminFinancialsPage() {
  const financials = await getFinancials()

  const maxMonthlyRevenue = Math.max(...financials.monthlyRevenue.map(m => m.revenue), 1)

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Financials</h1>
        <p className="text-muted-foreground">
          Revenue, subscription metrics, and billing data from Stripe
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financials.mrr)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly recurring revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (12mo)</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financials.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From paid Stripe invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financials.activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {financials.instrumentActive} instrument, {financials.allAccessActive} all-access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Churn</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financials.recentChurn}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Canceled in last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Revenue Breakdown
            </CardTitle>
            <CardDescription>MRR by plan type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Instrument Plans</span>
                  <span className="text-muted-foreground">
                    {financials.instrumentActive} x {formatCurrency(PLAN_PRICES.instrument)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress
                    value={financials.mrr > 0 ? ((financials.instrumentActive * PLAN_PRICES.instrument) / financials.mrr) * 100 : 0}
                    className="h-3"
                  />
                  <span className="w-24 text-sm font-medium text-right">
                    {formatCurrency(financials.instrumentActive * PLAN_PRICES.instrument)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">All-Access Plans</span>
                  <span className="text-muted-foreground">
                    {financials.allAccessActive} x {formatCurrency(PLAN_PRICES.all_access)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress
                    value={financials.mrr > 0 ? ((financials.allAccessActive * PLAN_PRICES.all_access) / financials.mrr) * 100 : 0}
                    className="h-3"
                  />
                  <span className="w-24 text-sm font-medium text-right">
                    {formatCurrency(financials.allAccessActive * PLAN_PRICES.all_access)}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between font-medium">
                  <span>Total MRR</span>
                  <span>{formatCurrency(financials.mrr)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscription Health
            </CardTitle>
            <CardDescription>Current subscription status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2">
              <div className="p-4 rounded-lg border text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-1 text-green-500">
                  <CreditCard className="w-5 h-5" />
                  {financials.activeCount}
                </div>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-1 text-red-500">
                  <XCircle className="w-5 h-5" />
                  {financials.canceledCount}
                </div>
                <p className="text-sm text-muted-foreground">Canceled</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-1 text-orange-500">
                  <AlertTriangle className="w-5 h-5" />
                  {financials.pastDueCount}
                </div>
                <p className="text-sm text-muted-foreground">Past Due</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-1 text-yellow-500">
                  <Clock className="w-5 h-5" />
                  {financials.pendingCancelCount}
                </div>
                <p className="text-sm text-muted-foreground">Pending Cancel</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monthly Revenue
          </CardTitle>
          <CardDescription>Actual revenue from paid Stripe invoices (last 12 months)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {financials.monthlyRevenue.map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <span className="w-20 text-sm text-muted-foreground">{month.month}</span>
                <div className="flex-1">
                  <Progress
                    value={(month.revenue / maxMonthlyRevenue) * 100}
                    className="h-2"
                  />
                </div>
                <span className="w-20 text-sm font-medium text-right">
                  {formatCurrency(month.revenue)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Recent Subscriptions
          </CardTitle>
          <CardDescription>Last 20 subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {financials.recentSubs.length > 0 ? (
            <div className="space-y-2">
              {financials.recentSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{sub.userName}</p>
                      <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Badge
                          variant={sub.planType === 'all_access' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {sub.planType === 'all_access' ? 'All-Access' : sub.instrument || 'Instrument'}
                        </Badge>
                        <Badge
                          variant={
                            sub.status === 'active'
                              ? sub.cancelAtPeriodEnd
                                ? 'outline'
                                : 'default'
                              : sub.status === 'past_due'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {sub.cancelAtPeriodEnd ? 'Canceling' : sub.status}
                        </Badge>
                      </div>
                      {sub.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No subscriptions yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
