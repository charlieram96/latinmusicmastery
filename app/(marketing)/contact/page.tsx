import type { Metadata } from 'next'
import { getServerTranslator } from '@/lib/i18n/server'
import { SOCIAL } from '@/lib/marketing/social'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { ContactForm, SUPPORT_EMAIL } from '@/components/marketing/pages/ContactForm'
import { CopyEmail } from '@/components/marketing/pages/CopyEmail'
import '../styles/pages.css'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.contact.metaTitle'), description: t('marketing.site.contact.metaDescription') }
}

const C = 'marketing.site.contact'

export default async function ContactPage() {
  const { t } = await getServerTranslator()
  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: t(`${C}.crumb`) }]}
        title={<>{t(`${C}.title`)} <Accent>{t(`${C}.titleAccent`)}</Accent></>}
        lede={t(`${C}.lede`)}
      />
      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <div className="wrap contact-grid">
          <ContactForm />
          <div className="side-info">
            <div className="info">
              <span className="sp-label">{t(`${C}.emailCard`)}</span>
              <b><a id="cf-mail" className="cf-mail" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></b>
              <CopyEmail email={SUPPORT_EMAIL} targetId="cf-mail" />
            </div>
            <div className="info">
              <span className="sp-label">{t(`${C}.responseCard`)}</span>
              <b>{t(`${C}.responseValue`)}</b>
              <p>{t(`${C}.responseBody`)}</p>
            </div>
            <div className="info">
              <span className="sp-label">{t(`${C}.followCard`)}</span>
              <p>{t(`${C}.followBody`)}</p>
              <ul className="cf-social">
                {SOCIAL.map(s => <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
