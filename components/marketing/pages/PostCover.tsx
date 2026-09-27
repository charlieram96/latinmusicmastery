import Image from 'next/image'
import { Sleeve } from '@/components/marketing/site/Sleeve'
import { coverIsOptimizable, sleeveTitle } from '@/lib/marketing/pages/blog'

/** A post's cover image, or a record sleeve seeded by its slug when it has none. */
export function PostCover({ post, sizes, priority = false, minLabel, className = '' }: {
  post: { slug: string; title: string; coverUrl: string | null; categoryLabel: string }
  sizes: string
  priority?: boolean
  minLabel: string
  className?: string
}) {
  if (post.coverUrl) {
    return (
      <div className={`pcover ${className}`}>
        <Image src={post.coverUrl} alt="" fill sizes={sizes} priority={priority} unoptimized={!coverIsOptimizable(post.coverUrl)} style={{ objectFit: 'cover' }} />
      </div>
    )
  }
  return <Sleeve className={className} title={sleeveTitle(post.title)} topLeft={post.categoryLabel} topRight={minLabel} seed={post.slug} />
}
