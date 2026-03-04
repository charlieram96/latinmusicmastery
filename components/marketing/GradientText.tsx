"use client";

import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

const tagMap = {
  span: "span",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  p: "p",
} as const;

type TagName = keyof typeof tagMap;

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
  as?: TagName;
}

export default function GradientText({
  children,
  className,
  gradient = "from-primary via-orange-400 to-amber-500",
  as = "span",
}: GradientTextProps) {
  const Tag = tagMap[as] as ElementType;

  return (
    <Tag
      className={cn(
        "bg-gradient-to-r bg-clip-text text-transparent",
        gradient,
        className
      )}
    >
      {children}
    </Tag>
  );
}
