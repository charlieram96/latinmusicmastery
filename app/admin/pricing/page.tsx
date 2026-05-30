import { getPricing } from '@/lib/payments/pricing-source'
import { PricingForm } from './pricing-form'

export const metadata = {
  title: 'Pricing — Admin',
}

export default async function AdminPricingPage() {
  const prices = await getPricing()

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit the dollar amounts shown across the site and the Stripe price IDs the checkout charges.
            Stripe prices are immutable — when you change an amount, create a new price in the Stripe
            dashboard and paste its ID below so the two stay in sync.
          </p>
        </div>

        <PricingForm prices={prices} />
      </div>
    </div>
  )
}
