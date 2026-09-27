import Link from 'next/link'
import { Sleeve } from '@/components/marketing/site/Sleeve'
import type { CatalogCourse } from '@/lib/marketing/catalog'
import { instrumentLabel } from '@/lib/i18n/instruments'
import type { Locale } from '@/lib/i18n'

type T = (key: string, params?: Record<string, string | number>) => string

/** A course as a record sleeve plus its caption, linking to the course preview. */
/** Sleeve seed shared by every page: the ENGLISH style name (or 'Fundamentals') + the raw instrument value. */
export const sleeveSeed = (englishStyle: string | null | undefined, instrument: string | null | undefined) => `${englishStyle ?? 'Fundamentals'}${instrument ?? ''}`

export function Poster({ course, t, locale, englishStyle, index = 0 }: { course: CatalogCourse; t: T; locale: Locale; englishStyle: string | null; index?: number }) {
  const inst = instrumentLabel(course.instrument, locale)
  const style = course.styleName
  const sleeveTitle = course.fundamentals
    ? <>{inst}<br />{t('marketing.site.explore.fundamentals')}</>
    : style ?? course.title
  const caption = course.fundamentals
    ? t('marketing.site.explore.fundamentalsOf', { instrument: inst })
    : style ? t('marketing.site.explore.courseName', { style, instrument: inst }) : course.title
  return (
    <Link className="poster" href={`/course-preview/${course.id}`} style={{ animationDelay: `${Math.min(index, 16) * 30}ms` }}>
      <Sleeve
        title={sleeveTitle}
        topLeft={inst}
        topRight={course.fundamentals ? t('marketing.site.explore.start') : course.countryCode ?? undefined}
        seed={sleeveSeed(englishStyle, course.instrument)}
      />
      <div className="pmeta"><b>{caption}</b><span aria-hidden="true">{t('marketing.site.common.previewArrow')}</span></div>
    </Link>
  )
}
