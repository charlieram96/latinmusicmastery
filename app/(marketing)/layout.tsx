import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { getWaitlistOptions } from '@/lib/waitlist/options'
import { getNavCatalog } from '@/lib/marketing/nav-catalog'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ instruments, styles }, navCatalog] = await Promise.all([
    getWaitlistOptions(),
    getNavCatalog(),
  ])

  return (
    <>
      <MarketingHeader instruments={navCatalog.instruments} styles={navCatalog.styles} />
      <main className="min-h-screen">{children}</main>
      <MarketingFooter instruments={instruments} styles={styles} />
    </>
  )
}
