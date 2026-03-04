"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimonialCardProps {
  name: string;
  role: string;
  content: string;
  rating?: number;
  avatarUrl?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TestimonialCard({
  name,
  role,
  content,
  rating = 5,
  avatarUrl,
}: TestimonialCardProps) {
  const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg"
    >
      {/* Star rating */}
      <div className="mb-4 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < clampedRating
                ? "fill-primary text-primary"
                : "fill-muted text-muted"
            )}
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="mb-6 text-sm italic leading-relaxed text-card-foreground/90">
        &ldquo;{content}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-xs font-semibold text-white">
            {getInitials(name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-card-foreground">
            {name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}
