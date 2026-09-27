import { getServerTranslator } from '@/lib/i18n/server'
import { WaitlistSignup } from './WaitlistSignup'
import { FinaleVideo } from './FinaleVideo'

/**
 * Closing waitlist block: the band seen through giant knocked-out type, then
 * the pitch and the signup. Renders the page's `#join` target.
 */
export async function Finale({ title, accent, lede }: { title?: string; accent?: string; lede?: string } = {}) {
  const { t } = await getServerTranslator()
  return (
    <section className="finale" id="join">
      <div className="video-fallback" aria-hidden="true" />
      <FinaleVideo />
      <div className="knock"><div className="knock-type" aria-hidden="true">{t('marketing.site.finale.knock')}</div></div>
      <div className="finale-body">
        <div className="wrap">
          <h2 className="h2" style={{ fontSize: 'clamp(34px,4.4vw,64px)' }}>
            {title ?? t('marketing.site.finale.title')} <span className="serif grad-text">{accent ?? t('marketing.site.finale.titleAccent')}</span>
          </h2>
          <p className="lede" style={{ marginTop: 18 }}>{lede ?? t('marketing.site.finale.lede')}</p>
          <WaitlistSignup id="email-join" arrow={false} />
        </div>
      </div>
    </section>
  )
}
