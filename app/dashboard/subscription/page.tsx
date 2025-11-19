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
} from 'lucide-react'

export default async function MySubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const hasActiveSubscription = subscription && subscription.status === 'active'
  const isCanceled = subscription?.cancel_at_period_end

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Current Plan</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </div>
            <Badge variant={hasActiveSubscription ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {hasActiveSubscription ? 'Active' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {hasActiveSubscription ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">Premium Access</span>
              </div>

              {/* Billing Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Billing Period</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
                      {new Date(subscription.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Billing Date</p>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {new Date(subscription.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cancellation Warning */}
              {isCanceled && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900 dark:text-orange-100">
                      Subscription Ending Soon
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                      Your subscription will end on{' '}
                      {new Date(subscription.current_period_end).toLocaleDateString()}.
                      You'll still have access until then.
                    </p>
                  </div>
                </div>
              )}

              {/* Benefits */}
              <div>
                <p className="text-sm font-medium mb-3">Your Benefits:</p>
                <ul className="space-y-2">
                  {[
                    'Access to all courses',
                    'Unlimited lessons and exercises',
                    'Download sheet music and backing tracks',
                    'Priority support',
                    'Exclusive masterclasses',
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Manage Subscription Button */}
              <div className="pt-4">
                <Button variant="outline" asChild>
                  <a href={`/api/stripe/customer-portal?return_url=${encodeURIComponent('/dashboard/subscription')}`}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Billing
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            /* Free Plan */
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">You're on the Free Plan</h3>
              <p className="text-muted-foreground mb-6">
                Upgrade to Premium to unlock all courses and features
              </p>
              <Button asChild size="lg">
                <Link href="/pricing">
                  <ArrowUpCircle className="mr-2 h-5 w-5" />
                  Upgrade to Premium
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      {hasActiveSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View your past invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Access your full billing history through the Customer Portal
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <a href={`/api/stripe/customer-portal?return_url=${encodeURIComponent('/dashboard/subscription')}`}>
                View Billing History
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
