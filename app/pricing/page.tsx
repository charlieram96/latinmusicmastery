import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Music } from 'lucide-react'
import { SubscribeButton } from '@/components/subscribe-button'
import { ManageSubscriptionButton } from '@/components/manage-subscription-button'
import { getActiveSubscriptions } from '@/lib/subscriptions'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const activeSubs = await getActiveSubscriptions(supabase, user.id)
  const hasAllAccess = activeSubs.some((s) => s.plan_type === 'all_access')
  const subscribedInstruments = new Set(
    activeSubs.filter((s) => s.plan_type === 'instrument').map((s) => s.instrument)
  )
  const hasAnySub = activeSubs.length > 0

  // Get course counts per instrument
  const { data: courses } = await supabase
    .from('courses')
    .select('instrument')
    .eq('is_published', true)

  const courseCountMap: Record<string, number> = {}
  for (const c of courses || []) {
    if (c.instrument && c.instrument !== 'Various') {
      courseCountMap[c.instrument] = (courseCountMap[c.instrument] || 0) + 1
    }
  }

  const instrumentPriceId = process.env.NEXT_PUBLIC_STRIPE_INSTRUMENT_PRICE_ID || ''
  const allAccessPriceId = process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_PRICE_ID || ''

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Subscribe to a single instrument or get unlimited access to everything
        </p>
      </div>

      {/* All-Access Card */}
      <div className="max-w-2xl mx-auto mb-16">
        <Card className="relative border-primary shadow-lg">
          <div className="absolute -top-4 left-0 right-0 flex justify-center">
            <Badge className="px-4 py-1 gap-1">
              <Crown className="w-3 h-3" />
              Best Value
            </Badge>
          </div>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">All-Access</CardTitle>
            <CardDescription>
              Every instrument, every course, unlimited learning
            </CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">$69.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                'All 9 instruments included',
                'Every course and lesson',
                'Soundslice interactive tools',
                'Full progress tracking',
                'New content added monthly',
                'Cancel anytime',
              ].map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {hasAllAccess ? (
              <div className="space-y-2">
                <Badge variant="default" className="w-full justify-center py-2">
                  Current Plan
                </Badge>
                <ManageSubscriptionButton />
              </div>
            ) : (
              <SubscribeButton
                priceId={allAccessPriceId}
                planType="all_access"
                label="Get All-Access"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instrument Grid */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Or subscribe per instrument</h2>
        <p className="text-muted-foreground text-center mb-8">
          $14.99/month per instrument — only pay for what you play
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {SUBSCRIBABLE_INSTRUMENTS.map((instrument) => {
            const count = courseCountMap[instrument] || 0
            const isSubscribed = subscribedInstruments.has(instrument)

            return (
              <Card key={instrument} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      {instrument}
                    </CardTitle>
                    {(isSubscribed || hasAllAccess) && (
                      <Badge variant={hasAllAccess && !isSubscribed ? 'secondary' : 'default'}>
                        {hasAllAccess && !isSubscribed ? 'Included' : 'Subscribed'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {count} {count === 1 ? 'course' : 'courses'} available
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isSubscribed || hasAllAccess ? (
                    <Badge variant="outline" className="w-full justify-center py-2">
                      {hasAllAccess ? 'Included in All-Access' : 'Active'}
                    </Badge>
                  ) : (
                    <SubscribeButton
                      priceId={instrumentPriceId}
                      planType="instrument"
                      instrument={instrument}
                      label={`$14.99/mo`}
                    />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Manage existing subs */}
      {hasAnySub && !hasAllAccess && (
        <div className="text-center mb-16">
          <ManageSubscriptionButton />
        </div>
      )}

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What's the difference between plans?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The Instrument Plan ($14.99/mo) gives you access to all courses for a single instrument.
                The All-Access Plan ($69.99/mo) unlocks every instrument and every course on the platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I subscribe to multiple instruments?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes! You can subscribe to as many individual instruments as you like. If you play 3 or more instruments,
                the All-Access plan is usually the better deal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I cancel anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes! You can cancel any subscription at any time. You'll continue to have access until the end of your billing period.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I upgrade from instrument plans to All-Access?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Absolutely! You can upgrade to All-Access at any time. Your existing instrument subscriptions can be
                managed through the billing portal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We accept all major credit cards (Visa, Mastercard, American Express) and debit cards through Stripe.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
