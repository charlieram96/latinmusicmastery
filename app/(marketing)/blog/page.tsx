import type { Metadata } from 'next'
import { getServerTranslator } from '@/lib/i18n/server'
import { postCategories } from '@/lib/marketing/pages/blog'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { BlogBrowser } from '@/components/marketing/pages/BlogBrowser'
import { NewsletterSignup } from '@/components/marketing/pages/NewsletterSignup'
import { WaitlistSignup } from '@/components/marketing/site/WaitlistSignup'
import { categoryLabel, getPublishedPosts, toCard } from '@/components/marketing/pages/blog-data'
import '../styles/pages.css'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('marketing.site.blog.metaTitle'), description: t('marketing.site.blog.metaDescription') }
}

const B = 'marketing.site.blog'

export default async function BlogPage() {
  const { t, locale } = await getServerTranslator()
  const rows = await getPublishedPosts()
  const posts = rows.map(r => toCard(r, t, locale))
  const categories = postCategories(posts).map(key => ({ key, label: categoryLabel(t, key) }))

  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: t(`${B}.crumb`) }]}
        title={<>{t(`${B}.title`)} <Accent>{t(`${B}.titleAccent`)}</Accent></>}
        lede={t(`${B}.lede`)}
      />
      {posts.length > 0 ? (
        <BlogBrowser posts={posts} categories={categories} />
      ) : (
        <div className="wrap blog-empty">
          <h2>{t(`${B}.emptyTitle`)}</h2>
          <p>{t(`${B}.emptyBody`)}</p>
          <WaitlistSignup id="blog-empty-email" />
        </div>
      )}
      <div className="wrap" style={{ paddingBlock: 'clamp(72px,8vw,120px)' }}>
        <NewsletterSignup />
      </div>
    </>
  )
}
