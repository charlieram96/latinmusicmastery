'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  CreditCard,
  Calendar,
  ArrowUpCircle,
  AlertCircle,
  Crown,
  Music,
  Plus,
} from 'lucide-react'
import { ManageSubscriptionButton } from '@/components/manage-subscription-button'
import { useTranslation } from '@/components/language-provider'

interface SubscriptionViewProps {
  activeSubs: any[]
  hasAllAccess: boolean
  instrumentSubs: any[]
  hasAnySub: boolean
}

export function SubscriptionView({
  activeSubs,
  hasAllAccess,
  instrumentSubs,
  hasAnySub,
}: SubscriptionViewProps) {
  const { t, locale } = useTranslation()
  const dateLocale = locale === 'es' ? 'es-ES' : 'en-US'

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('dashboard.pages.subscription.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.pages.subscription.subtitle')}
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
                  {t('dashboard.pages.subscription.redundant.title')}
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                  {t('dashboard.pages.subscription.redundant.body')}
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
                        {sub.plan_type === 'all_access'
                          ? t('dashboard.pages.subscription.planNames.allAccess')
                          : sub.instrument}
                      </CardTitle>
                      <CardDescription>
                        {sub.plan_type === 'all_access'
                          ? t('dashboard.pages.subscription.planDescriptions.allAccess')
                          : t('dashboard.pages.subscription.planDescriptions.instrument', {
                              instrument: sub.instrument,
                            })}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={sub.cancel_at_period_end ? 'secondary' : 'default'}
                    className="text-sm px-3 py-1"
                  >
                    {sub.cancel_at_period_end
                      ? t('dashboard.pages.subscription.badge.canceling')
                      : t('dashboard.pages.subscription.badge.active')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Billing Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {t('dashboard.pages.subscription.billing.period')}
                      </p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {new Date(sub.current_period_start).toLocaleDateString(dateLocale)} -{' '}
                          {new Date(sub.current_period_end).toLocaleDateString(dateLocale)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {sub.cancel_at_period_end
                          ? t('dashboard.pages.subscription.billing.accessUntil')
                          : t('dashboard.pages.subscription.billing.nextBilling')}
                      </p>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {new Date(sub.current_period_end).toLocaleDateString(dateLocale)}
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
                          {t('dashboard.pages.subscription.endingSoon.title')}
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                          {t('dashboard.pages.subscription.endingSoon.body', {
                            date: new Date(sub.current_period_end).toLocaleDateString(dateLocale),
                          })}
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
                <Link href="/dashboard/subscribe">
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  {t('dashboard.pages.subscription.upgradeToAllAccess')}
                </Link>
              </Button>
            )}
            {!hasAllAccess && (
              <Button asChild variant="outline">
                <Link href="/dashboard/subscribe">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dashboard.pages.subscription.addInstrument')}
                </Link>
              </Button>
            )}
            <ManageSubscriptionButton />
          </div>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.pages.subscription.history.title')}</CardTitle>
              <CardDescription>{t('dashboard.pages.subscription.history.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.subscription.history.body')}
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
              <h3 className="text-lg font-semibold mb-2">{t('dashboard.pages.subscription.empty.title')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('dashboard.pages.subscription.empty.body')}
              </p>
              <Button asChild size="lg">
                <Link href="/dashboard/subscribe">
                  <ArrowUpCircle className="mr-2 h-5 w-5" />
                  {t('dashboard.pages.subscription.empty.cta')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
