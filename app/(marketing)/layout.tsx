import './marketing.css'
import { getWaitlistOptions } from '@/lib/waitlist/options'
import { marketingFontVars } from '@/lib/marketing/fonts'
import { SiteHeader } from '@/components/marketing/site/SiteHeader'
import { SiteFooter } from '@/components/marketing/site/SiteFooter'
import { WaitlistOptionsProvider } from '@/components/marketing/site/waitlist-options'

/**
 * Marketing shell ("Noche"). Always dark, independent of the app's theme
 * toggle; every marketing style is scoped under `.mkt` (see marketing.css).
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { instruments, styles } = await getWaitlistOptions()
  return (
    <div className={`mkt ${marketingFontVars}`} data-marketing>
      <div className="grain" aria-hidden="true" />
      <WaitlistOptionsProvider instruments={instruments} styles={styles}>
        <SiteHeader />
        <main id="top">{children}</main>
        <SiteFooter />
      </WaitlistOptionsProvider>
    </div>
  )
}
