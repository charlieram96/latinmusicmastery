import { Badge } from '@/components/ui/badge'
import {
  DollarSign, TrendingUp, CreditCard, AlertTriangle, XCircle, Clock,
} from 'lucide-react'
import { getFinancials } from '@/app/actions/admin'
import { formatCurrency, PLAN_PRICES } from '@/lib/pricing'

export default async function AdminFinancialsPage() {
  const financials = await getFinancials()

  const maxMonthlyRevenue = Math.max(...financials.monthlyRevenue.map(m => m.revenue), 1)

  const heroStats = [
    {
      label: 'MRR',
      value: formatCurrency(financials.mrr),
      sub: 'Monthly recurring revenue',
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Total Revenue (12mo)',
      value: formatCurrency(financials.totalRevenue),
      sub: 'From paid Stripe invoices',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Active Subscriptions',
      value: financials.activeCount,
      sub: `${financials.instrumentActive} instrument · ${financials.allAccessActive} all-access`,
      icon: CreditCard,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Recent Churn',
      value: financials.recentChurn,
      sub: 'Canceled in last 30 days',
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  ]

  const instrumentMrr = financials.instrumentActive * PLAN_PRICES.instrument
  const allAccessMrr = financials.allAccessActive * PLAN_PRICES.all_access

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-1">Financials</h1>
        <p className="text-muted-foreground">Revenue, subscription metrics, and billing data from Stripe</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {heroStats.map((s) => {
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

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Breakdown */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">Revenue Breakdown</h2>
          <p className="text-sm text-muted-foreground mb-6">MRR by plan type</p>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Instrument Plans</span>
                <span className="text-muted-foreground">
                  {financials.instrumentActive} × {formatCurrency(PLAN_PRICES.instrument)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${financials.mrr > 0 ? (instrumentMrr / financials.mrr) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-20 text-right">{formatCurrency(instrumentMrr)}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">All-Access Plans</span>
                <span className="text-muted-foreground">
                  {financials.allAccessActive} × {formatCurrency(PLAN_PRICES.all_access)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${financials.mrr > 0 ? (allAccessMrr / financials.mrr) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-20 text-right">{formatCurrency(allAccessMrr)}</span>
              </div>
            </div>
            <div className="pt-4 border-t flex justify-between font-bold">
              <span>Total MRR</span>
              <span className="text-green-500">{formatCurrency(financials.mrr)}</span>
            </div>
          </div>
        </div>

        {/* Subscription Health */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">Subscription Health</h2>
          <p className="text-sm text-muted-foreground mb-6">Current subscription status breakdown</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border bg-green-500/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-green-500">
                <CreditCard className="w-5 h-5" />
                {financials.activeCount}
              </div>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="p-4 rounded-xl border bg-red-500/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-red-500">
                <XCircle className="w-5 h-5" />
                {financials.canceledCount}
              </div>
              <p className="text-xs text-muted-foreground">Canceled</p>
            </div>
            <div className="p-4 rounded-xl border bg-orange-500/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-orange-500">
                <AlertTriangle className="w-5 h-5" />
                {financials.pastDueCount}
              </div>
              <p className="text-xs text-muted-foreground">Past Due</p>
            </div>
            <div className="p-4 rounded-xl border bg-yellow-500/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-yellow-500">
                <Clock className="w-5 h-5" />
                {financials.pendingCancelCount}
              </div>
              <p className="text-xs text-muted-foreground">Pending Cancel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <h2 className="font-bold text-lg mb-1">Monthly Revenue</h2>
        <p className="text-sm text-muted-foreground mb-6">Actual revenue from paid Stripe invoices (last 12 months)</p>
        <div className="space-y-3">
          {financials.monthlyRevenue.map((month) => (
            <div key={month.month} className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground font-mono">{month.month.slice(5)}/{month.month.slice(2, 4)}</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(month.revenue / maxMonthlyRevenue) * 100}%` }}
                />
              </div>
              <span className="w-20 text-xs font-bold text-right">{formatCurrency(month.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Subscriptions */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold text-lg">Recent Subscriptions</h2>
          <p className="text-sm text-muted-foreground">Last 20 subscriptions</p>
        </div>
        {financials.recentSubs.length > 0 ? (
          <div className="divide-y">
            {financials.recentSubs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between px-6 py-3.5"
              >
                <div>
                  <p className="font-medium text-sm">{sub.userName}</p>
                  <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={sub.planType === 'all_access' ? 'default' : 'secondary'} className="text-xs">
                    {sub.planType === 'all_access' ? 'All-Access' : sub.instrument || 'Instrument'}
                  </Badge>
                  <Badge
                    variant={
                      sub.status === 'active'
                        ? sub.cancelAtPeriodEnd ? 'outline' : 'default'
                        : sub.status === 'past_due' ? 'destructive' : 'secondary'
                    }
                    className="text-xs"
                  >
                    {sub.cancelAtPeriodEnd ? 'Canceling' : sub.status}
                  </Badge>
                  {sub.createdAt && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No subscriptions yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
