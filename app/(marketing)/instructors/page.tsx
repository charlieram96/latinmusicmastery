import type { Metadata } from 'next'
import { getServerTranslator } from '@/lib/i18n/server'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { Finale } from '@/components/marketing/site/Finale'
import { Reveal } from '@/components/marketing/site/Reveal'
import { InstructorsGrid } from '@/components/marketing/instructors/InstructorsGrid'
import { displayName, presentTeacher } from '@/lib/marketing/present-teacher'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return {
    title: t('marketing.site.instructors.metaTitle'),
    description: t('marketing.site.instructors.metaDescription'),
  }
}

export default async function InstructorsPage() {
  const { t, locale } = await getServerTranslator()
  const catalog = await getMarketingCatalog(locale)
  const k = (key: string) => t(`marketing.site.instructors.${key}`)

  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: k('crumb') }]}
        title={<>{k('title')} <Accent>{k('titleAccent')}</Accent></>}
        lede={t('marketing.site.instructors.lede', { count: catalog.counts.maestros })}
      />
      <InstructorsGrid
        teachers={catalog.teachers.map(t => ({ ...presentTeacher(t), name: displayName(t.name) }))}
        groupLabel={k('filterLabel')}
        empty={k('empty')}
        resultsTemplate={k('filterResults')}
        labels={{ all: k('famAll'), perc: k('famPerc'), keys: k('famKeys'), bass: k('famBass'), strings: k('famStrings'), horns: k('famHorns'), voice: k('famVoice') }}
      />
      <section className="sec">
        <Reveal className="wrap about-split">
          <blockquote className="quote" style={{ margin: 0 }}>
            {k('quote')}
            <cite>{k('quoteCite')}</cite>
          </blockquote>
          <div className="prose">
            <p>{k('prose1')}</p>
            <p>{k('prose2')}</p>
          </div>
        </Reveal>
      </section>
      <Finale title={k('finaleTitle')} accent={k('finaleAccent')} lede={k('finaleLede')} />
    </>
  )
}
