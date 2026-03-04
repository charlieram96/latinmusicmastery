"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

interface BlogPostCardProps {
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  authorName: string;
  category: string;
  publishedAt?: string | null;
  tags?: string[];
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

export default function BlogPostCard({
  title,
  slug,
  excerpt,
  coverImageUrl,
  authorName,
  category,
  publishedAt,
  tags,
}: BlogPostCardProps) {
  return (
    <Link href={`/blog/${slug}`} className="group block">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden rounded-2xl border bg-card transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-lg"
      >
        {/* Image area */}
        <div className="relative aspect-video overflow-hidden">
          {coverImageUrl ? (
            <Image
              src={coverImageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-orange-400/20 to-amber-500/30">
              <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-white">
                {category}
              </span>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
            {category}
          </span>
          <h3 className="mt-1.5 font-semibold line-clamp-2">{title}</h3>
          {excerpt && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{authorName}</span>
            {publishedAt && <span>{formatDate(publishedAt)}</span>}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
