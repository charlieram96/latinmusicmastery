"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
} from "@/lib/animation-variants";

const animationMap = {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
} as const;

type AnimationName = keyof typeof animationMap;

interface SectionWrapperProps {
  children: ReactNode;
  className?: string;
  animation?: AnimationName;
  delay?: number;
  threshold?: number;
}

export default function SectionWrapper({
  children,
  className,
  animation = "fadeInUp",
  delay = 0,
  threshold = 0.1,
}: SectionWrapperProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold,
  });

  const variants = animationMap[animation];

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.section>
  );
}
