import type { Metadata } from 'next'
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { createClient: createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
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
import PageHero from "@/components/marketing/PageHero";
import CTABanner from "@/components/marketing/CTABanner";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import BlogPostCard from "@/components/marketing/BlogPostCard";
import { User } from "lucide-react";

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

function estimateReadingTime(content: string): number {
  const minutes = Math.ceil(content.length / 1000);
  return Math.max(1, minutes);
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Detect ## headings
    if (line.trim().startsWith("## ")) {
      const headingText = line.trim().replace(/^##\s+/, "");
      elements.push(
        <h2
          key={`h-${i}`}
          className="mt-8 mb-4 text-2xl font-bold text-foreground"
        >
          {renderInlineFormatting(headingText)}
        </h2>
      );
      i++;
      continue;
    }

    // Detect numbered lists (lines starting with a digit followed by a dot)
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: { key: number; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push({
          key: i,
          text: lines[i].trim().replace(/^\d+\.\s+/, ""),
        });
        i++;
      }
      elements.push(
        <ol
          key={`ol-${listItems[0].key}`}
          className="mb-4 list-decimal space-y-2 pl-6 text-foreground"
        >
          {listItems.map((item) => (
            <li key={item.key}>{renderInlineFormatting(item.text)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Default: paragraph
    elements.push(
      <p
        key={`p-${i}`}
        className="mb-4 text-foreground leading-relaxed"
      >
        {renderInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`b-${match.index}`} className="font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    notFound();
  }

  // Fetch related posts (same category, excluding current)
  const { data: relatedPosts } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, cover_image_url, author_name, category, published_at"
    )
    .eq("is_published", true)
    .eq("category", post.category)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(3);

  const readingTime = estimateReadingTime(post.content);

  return (
    <>
      {/* Breadcrumbs via PageHero-style header area */}
      <div className="border-b bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/blog"
              className="hover:text-foreground transition-colors"
            >
              Blog
            </Link>
            <span>/</span>
            <span className="text-foreground line-clamp-1">{post.title}</span>
          </nav>
        </div>
      </div>

      {/* Article header */}
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-8">
        <span className="text-xs font-medium uppercase tracking-wider text-primary">
          {post.category}
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          {post.title}
        </h1>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{post.author_name}</span>
          {post.published_at && (
            <>
              <span className="text-border">|</span>
              <span>{formatDate(post.published_at)}</span>
            </>
          )}
          <span className="text-border">|</span>
          <span>{readingTime} min read</span>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Cover image */}
      {post.cover_image_url && (
        <div className="mx-auto max-w-4xl px-6">
          <div className="relative aspect-video overflow-hidden rounded-2xl">
            <Image
              src={post.cover_image_url}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}

      {/* Article content */}
      <article className="mx-auto max-w-3xl px-6 py-8">
        {renderContent(post.content)}
      </article>

      {/* Author bio section */}
      <div className="mx-auto max-w-3xl px-6 pb-12">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-6">
          {post.author_image_url ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
              <Image
                src={post.author_image_url}
                alt={post.author_name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold">{post.author_name}</p>
            <p className="text-sm text-muted-foreground">
              Author at Latin Music Mastery
            </p>
          </div>
        </div>
      </div>

      {/* Related posts */}
      {relatedPosts && relatedPosts.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <SectionWrapper>
            <h2 className="mb-8 text-2xl font-bold tracking-tight">
              Related Articles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((relPost) => (
                <BlogPostCard
                  key={relPost.id}
                  title={relPost.title}
                  slug={relPost.slug}
                  excerpt={relPost.excerpt}
                  coverImageUrl={relPost.cover_image_url}
                  authorName={relPost.author_name}
                  category={relPost.category}
                  publishedAt={relPost.published_at}
                />
              ))}
            </div>
          </SectionWrapper>
        </div>
      )}

      <CTABanner />
    </>
  );
}
