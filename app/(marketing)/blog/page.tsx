import type { Metadata } from 'next'
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: 'Blog - Latin Music Mastery',
  description: 'Insights, tutorials, and stories from the world of Latin music education.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import BlogPostCard from "@/components/marketing/BlogPostCard";
import NewsletterForm from "@/components/marketing/NewsletterForm";

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

const categories = ["All", "Tutorials", "History", "Education", "News", "Features"];

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, cover_image_url, author_name, category, tags, published_at"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const featuredPost = posts?.[0] ?? null;
  const remainingPosts = posts?.slice(1) ?? [];

  return (
    <>
      <PageHero
        title="Blog"
        subtitle="Insights, tutorials, and stories from the world of Latin music."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]}
      />

      {/* Featured post section */}
      {featuredPost && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionWrapper>
            <Link href={`/blog/${featuredPost.slug}`} className="group block">
              <div className="overflow-hidden rounded-2xl border bg-card transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-xl md:grid md:grid-cols-2">
                {/* Image */}
                <div className="relative aspect-video md:aspect-auto">
                  {featuredPost.cover_image_url ? (
                    <Image
                      src={featuredPost.cover_image_url}
                      alt={featuredPost.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-orange-400/20 to-amber-500/30" />
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col justify-center p-8">
                  <span className="text-xs font-medium uppercase tracking-wider text-primary">
                    {featuredPost.category}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                    {featuredPost.title}
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="mt-3 text-muted-foreground line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{featuredPost.author_name}</span>
                    {featuredPost.published_at && (
                      <>
                        <span className="text-border">|</span>
                        <span>{formatDate(featuredPost.published_at)}</span>
                      </>
                    )}
                  </div>
                  {featuredPost.tags && featuredPost.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {featuredPost.tags.map((tag) => (
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
              </div>
            </Link>
          </SectionWrapper>
        </div>
      )}

      {/* Category filter pills */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Post grid */}
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-8">
        {remainingPosts.length > 0 ? (
          <SectionWrapper>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {remainingPosts.map((post) => (
                <BlogPostCard
                  key={post.id}
                  title={post.title}
                  slug={post.slug}
                  excerpt={post.excerpt}
                  coverImageUrl={post.cover_image_url}
                  authorName={post.author_name}
                  category={post.category}
                  publishedAt={post.published_at}
                  tags={post.tags ?? undefined}
                />
              ))}
            </div>
          </SectionWrapper>
        ) : !featuredPost ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-20 text-center">
            <h3 className="text-xl font-semibold">No blog posts yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon for insights, tutorials, and stories from the
              world of Latin music.
            </p>
          </div>
        ) : null}
      </div>

      {/* Newsletter */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <NewsletterForm />
      </div>
    </>
  );
}
