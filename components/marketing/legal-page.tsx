import { ReactNode } from 'react'
import { getServerTranslator } from '@/lib/i18n/server'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import '@/app/(marketing)/styles/pages.css'

interface LegalPageProps {
  title: string
  /** e.g. "May 21, 2026" — omit if the document has no separate effective date. */
  effectiveDate?: string
  lastUpdated: string
  children: ReactNode
}

/** "May 21, 2026" → the reader's locale; anything unparseable is shown as written. */
function localDate(value: string, locale: string): string {
  const d = new Date(`${value} UTC`)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-419' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d)
}

/**
 * Shared shell for the legal/policy pages (Terms, Privacy, Accessibility) in
 * the Noche look: a PageHead, then the document in a ~68ch prose column.
 * The documents themselves are English only; Spanish readers get a note.
 */
export async function LegalPage({ title, effectiveDate, lastUpdated, children }: LegalPageProps) {
  const { t, locale } = await getServerTranslator()
  const words = title.split(' ')
  const head = words.length > 1 ? words.slice(0, -1).join(' ') : ''
  const last = words[words.length - 1]

  return (
    <article className="legal-page">
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: title }]}
        title={<span className="legal-title" lang="en">{head && `${head} `}<Accent>{last}</Accent></span>}
      >
        <p className="post-meta">
          {effectiveDate && <span>{t('marketing.site.legal.effective', { date: localDate(effectiveDate, locale) })}</span>}
          <span>{t('marketing.site.legal.updated', { date: localDate(lastUpdated, locale) })}</span>
        </p>
        {locale === 'es' && <p className="legal-note" lang="es">{t('marketing.site.legal.englishOnly')}</p>}
      </PageHead>
      <div className="wrap">
        <div className="legal-prose" lang="en">{children}</div>
      </div>
    </article>
  )
}
