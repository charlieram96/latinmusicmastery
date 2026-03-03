import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  CreditCard,
  Calendar,
  CheckCircle,
  ArrowUpCircle,
  AlertCircle,
  Crown,
  Music,
  Plus,
} from 'lucide-react'
import { ManageSubscriptionButton } from '@/components/manage-subscription-button'
import { getActiveSubscriptions } from '@/lib/subscriptions'

export default async function MySubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all subscriptions (not just active)
  const { data: allSubs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const activeSubs = (allSubs || []).filter((s) => s.status === 'active')
  const hasAllAccess = activeSubs.some((s) => s.plan_type === 'all_access')
  const instrumentSubs = activeSubs.filter((s) => s.plan_type === 'instrument')
  const hasAnySub = activeSubs.length > 0

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscriptions and billing details
        </p>
      </div>

      {hasAnySub ? (
        <div className="space-y-6">
          {/* Redundant instrument subs warning */}
          {hasAllAccess && instrumentSubs.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-orange-900 dark:text-orange-100">
                  Redundant Instrument Subscriptions
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                  You have an All-Access plan which already includes all instruments.
                  You can cancel your individual instrument subscriptions through the billing portal to avoid extra charges.
                </p>
              </div>
            </div>
          )}

          {/* Subscription Cards */}
          {activeSubs.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {sub.plan_type === 'all_access' ? (
                      <Crown className="h-5 w-5 text-primary" />
                    ) : (
                      <Music className="h-5 w-5" />
                    )}
                    <div>
                      <CardTitle className="text-xl">
                        {sub.plan_type === 'all_access' ? 'All-Access' : sub.instrument}
                      </CardTitle>
                      <CardDescription>
                        {sub.plan_type === 'all_access'
                          ? 'Full access to all instruments and courses'
                          : `Access to all ${sub.instrument} courses`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={sub.cancel_at_period_end ? 'secondary' : 'default'} className="text-sm px-3 py-1">
                    {sub.cancel_at_period_end ? 'Canceling' : 'Active'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Billing Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Billing Period</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {new Date(sub.current_period_start).toLocaleDateString()} -{' '}
                          {new Date(sub.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {sub.cancel_at_period_end ? 'Access Until' : 'Next Billing Date'}
                      </p>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {new Date(sub.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Warning */}
                  {sub.cancel_at_period_end && (
                    <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-orange-900 dark:text-orange-100">
                          Subscription Ending Soon
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                          Your subscription will end on{' '}
                          {new Date(sub.current_period_end).toLocaleDateString()}.
                          You'll still have access until then.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            {!hasAllAccess && (
              <Button asChild>
                <Link href="/pricing">
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Upgrade to All-Access
                </Link>
              </Button>
            )}
            {!hasAllAccess && (
              <Button asChild variant="outline">
                <Link href="/pricing">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Instrument
                </Link>
              </Button>
            )}
            <ManageSubscriptionButton />
          </div>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View your past invoices and payments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access your full billing history through the Customer Portal
              </p>
              <ManageSubscriptionButton />
            </CardContent>
          </Card>
        </div>
      ) : (
        /* No subscription */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-6">
                Subscribe to unlock courses and start learning
              </p>
              <Button asChild size="lg">
                <Link href="/pricing">
                  <ArrowUpCircle className="mr-2 h-5 w-5" />
                  View Plans
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
