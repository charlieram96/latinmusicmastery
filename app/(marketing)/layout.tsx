import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { getWaitlistOptions } from '@/lib/waitlist/options'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { instruments, styles } = await getWaitlistOptions()

  return (
    <>
      <MarketingHeader />
      <main className="min-h-screen">{children}</main>
      <MarketingFooter instruments={instruments} styles={styles} />
    </>
  )
}
