import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { coverIsOptimizable, readingMinutes } from '@/lib/marketing/pages/blog'
import { PageHead } from '@/components/marketing/site/PageHead'
import { Finale } from '@/components/marketing/site/Finale'
import { PostBody } from '@/components/marketing/pages/PostBody'
import { PostCover } from '@/components/marketing/pages/PostCover'
import { CARD_COLUMNS, categoryLabel, formatPostDate, toCard } from '@/components/marketing/pages/blog-data'
import '../../styles/pages.css'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  return {
    title: post ? `${post.title} - Latin Music Mastery` : 'Blog Post - Latin Music Mastery',
    description: post?.excerpt ?? 'Read this article on Latin Music Mastery blog.',
  }
}

const B = 'marketing.site.blog'

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { t, locale } = await getServerTranslator()
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  if (!post) notFound()

  // Related: same category first, then the latest others, three in all.
  const { data: others } = await supabase
    .from('blog_posts')
    .select(CARD_COLUMNS)
    .eq('is_published', true)
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(12)
  const pool = others ?? []
  const related = [...pool.filter(p => p.category === post.category), ...pool.filter(p => p.category !== post.category)]
    .slice(0, 3)
    .map(r => toCard(r, t, locale))

  const category = post.category ? categoryLabel(t, post.category) : null
  const date = formatPostDate(post.published_at, locale)
  const meta = [
    category,
    date,
    post.author_name ? t(`${B}.by`, { name: post.author_name }) : null,
    t(`${B}.minRead`, { n: readingMinutes(post.content) }),
  ].filter(Boolean)

  return (
    <>
      <PageHead
        crumbs={[
          { label: t('marketing.site.common.home'), href: '/' },
          { label: t(`${B}.crumb`), href: '/blog' },
          { label: post.title },
        ]}
        title={<span className="post-title">{post.title}</span>}
        lede={post.excerpt ?? undefined}
      >
        <p className="post-meta">{meta.map((m, i) => <span key={i}>{m}</span>)}</p>
      </PageHead>

      <article className="wrap post-article">
        {post.cover_image_url && (
          <div className="pcover post-hero-cover">
            <Image src={post.cover_image_url} alt="" fill sizes="(max-width: 900px) 100vw, 900px" priority unoptimized={!coverIsOptimizable(post.cover_image_url)} style={{ objectFit: 'cover' }} />
          </div>
        )}
        <PostBody content={post.content ?? ''} />
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <ul className="post-tags" aria-label={t(`${B}.tags`)}>
            {post.tags.map((tag: string) => <li key={tag}>{tag}</li>)}
          </ul>
        )}
        <Link href="/blog" className="btn btn-ghost btn-sm post-back">← {t(`${B}.back`)}</Link>
      </article>

      {related.length > 0 && (
        <section className="wrap post-related" aria-labelledby="related-title">
          <h2 id="related-title" className="post-related-title">{t(`${B}.related`)}</h2>
          <div className="bgrid">
            {related.map(p => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="post">
                <PostCover post={p} sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" minLabel={t(`${B}.minShort`, { n: p.minutes })} />
                <span className="pcat">{p.categoryLabel}{p.date ? ` · ${p.date}` : ''}</span>
                <h3>{p.title}</h3>
                {p.excerpt && <p>{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Finale title={t(`${B}.finaleTitle`)} accent={t(`${B}.finaleAccent`)} />
    </>
  )
}
