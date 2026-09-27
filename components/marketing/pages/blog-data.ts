// Server-only: reads blog_posts through the Supabase server client.
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n'
import { readingMinutes, type PostCard } from '@/lib/marketing/pages/blog'

export type { PostCard }


type T = (key: string, params?: Record<string, string | number>) => string
type Row = { id: string; slug: string; title: string; excerpt: string | null; category: string | null; cover_image_url: string | null; published_at: string | null; content?: string | null }

const KNOWN_CATEGORIES = ['News', 'Tutorials', 'Features', 'History', 'Education']
export const CARD_COLUMNS = 'id, title, slug, excerpt, content, cover_image_url, author_name, category, tags, published_at'

export function categoryLabel(t: T, category: string): string {
  return KNOWN_CATEGORIES.includes(category) ? t(`marketing.site.blog.cats.${category}`) : category
}

export function formatPostDate(iso: string | null, locale: Locale): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-419' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

export function toCard(row: Row, t: T, locale: Locale): PostCard {
  const category = row.category ?? ''
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category,
    categoryLabel: categoryLabel(t, category),
    coverUrl: row.cover_image_url,
    minutes: readingMinutes(row.content),
    date: formatPostDate(row.published_at, locale),
  }
}

/** Published posts, newest first. */
export async function getPublishedPosts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select(CARD_COLUMNS)
    .eq('is_published', true)
    .order('published_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
