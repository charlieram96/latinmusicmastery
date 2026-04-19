import type { Metadata } from 'next'
import { createClient } from "@/lib/supabase/server";
import BlogContent from "./blog-content";

export const metadata: Metadata = {
  title: 'Blog - Latin Music Mastery',
  description: 'Insights, tutorials, and stories from the world of Latin music education.',
}

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, cover_image_url, author_name, category, tags, published_at"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return <BlogContent posts={posts} />;
}
