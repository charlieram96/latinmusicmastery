"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  title: string;
  description?: string | null;
  instrument?: string;
  difficulty?: string;
  imageUrl?: string | null;
  href: string;
  teacher?: string;
}

export default function CourseCard({
  title,
  description,
  instrument,
  difficulty,
  imageUrl,
  href,
  teacher,
}: CourseCardProps) {
  return (
    <Link href={href} className="group block">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden rounded-2xl border bg-card transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-lg"
      >
        {/* Image area */}
        <div className="relative aspect-video overflow-hidden rounded-t-2xl">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-orange-400/20 to-amber-500/30" />
          )}

          {/* Instrument badge overlay */}
          {instrument && (
            <span className="absolute right-3 top-3 rounded-full bg-primary/90 px-2 py-1 text-xs font-medium text-white">
              {instrument}
            </span>
          )}
        </div>

        {/* Content area */}
        <div className="p-5">
          <h3 className="font-semibold line-clamp-1">{title}</h3>

          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            {difficulty && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  difficulty.toLowerCase() === "beginner" &&
                    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                  difficulty.toLowerCase() === "intermediate" &&
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                  difficulty.toLowerCase() === "advanced" &&
                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
            )}

            {teacher && (
              <span className="truncate text-xs text-muted-foreground">
                {teacher}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
