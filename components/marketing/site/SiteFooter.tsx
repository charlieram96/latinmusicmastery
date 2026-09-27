import Link from 'next/link'
import { getServerTranslator } from '@/lib/i18n/server'
import { SOCIAL } from '@/lib/marketing/social'
import { LogoMark } from './LogoMark'

export async function SiteFooter() {
  const { t } = await getServerTranslator()
  const f = (k: string) => t(`marketing.site.footer.${k}`)
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <Link className="brand" href="/"><LogoMark /><span className="brand-name">Latin Music<small>MASTERY</small></span></Link>
            <p style={{ color: 'var(--humo)', marginTop: 16, maxWidth: '34ch', fontSize: 15 }}>{f('tagline')}</p>
          </div>
          <div>
            <h4>{f('platform')}</h4>
            <ul>
              <li><Link href="/explore">{f('explore')}</Link></li>
              <li><Link href="/playsense">{f('playsense')}</Link></li>
              <li><Link href="/pricing">{f('pricing')}</Link></li>
              <li><Link href="/instructors">{f('instructors')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{f('company')}</h4>
            <ul>
              <li><Link href="/about">{f('about')}</Link></li>
              <li><Link href="/blog">{f('blog')}</Link></li>
              <li><Link href="/faq">{f('faq')}</Link></li>
              <li><Link href="/contact">{f('contact')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{f('follow')}</h4>
            <ul>
              {SOCIAL.map(s => <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="ftr-base">
          <span>{t('marketing.site.footer.rights', { year: new Date().getFullYear() })}</span>
          <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <Link href="/privacy">{f('privacy')}</Link>
            <Link href="/terms">{f('terms')}</Link>
            <Link href="/accessibility">{f('accessibility')}</Link>
          </span>
          <span>{f('madeIn')}</span>
        </div>
      </div>
    </footer>
  )
}
