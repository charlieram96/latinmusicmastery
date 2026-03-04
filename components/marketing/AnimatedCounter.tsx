"use client";

import { useEffect, useRef } from "react";
import {
  useMotionValue,
  useTransform,
  animate,
  motion,
} from "framer-motion";
import { useInView } from "react-intersection-observer";

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export default function AnimatedCounter({
  end,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
}: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => {
    const formatted = latest.toFixed(decimals);
    // Add thousand separators for readability
    const [intPart, decPart] = formatted.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart ? `${withCommas}.${decPart}` : withCommas;
  });
  const hasAnimated = useRef(false);

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.3,
  });

  useEffect(() => {
    if (inView && !hasAnimated.current) {
      hasAnimated.current = true;
      animate(motionValue, end, {
        duration,
        ease: "easeOut",
      });
    }
  }, [inView, end, duration, motionValue]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
